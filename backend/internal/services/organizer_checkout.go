package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// organizerCheckoutNode e organizerCheckoutTag leem so os campos do item do
// Organizador que o checkout precisa (preco, estoque, status, tags de
// desconto). O resto do JSON (descricao, fotos, agendamento etc.) nunca
// passa por aqui - evita que um struct incompleto apague campo ao
// re-serializar (ver decrementOrganizerStock, que usa map[string]interface{}
// justamente por isso na hora de escrever de volta).
type organizerCheckoutNode struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Name     string   `json:"name"`
	Status   string   `json:"status"`
	Price    float64  `json:"price"`
	Stock    *int     `json:"stock"`
	VolumeMl *int     `json:"volumeMl"`
	ImageURL string   `json:"imageUrl"`
	TagIds   []string `json:"tagIds"`
}

type organizerCheckoutTag struct {
	ID              string   `json:"id"`
	DiscountPercent *float64 `json:"discountPercent"`
}

type organizerCheckoutStore struct {
	Nodes []organizerCheckoutNode `json:"nodes"`
	Tags  []organizerCheckoutTag  `json:"tags"`
}

type organizerItemSummary struct {
	ID        string
	Name      string
	ImageURL  string
	UnitPrice float64
	Weight    int
}

// resolveOrganizerCheckoutItem confere preco/disponibilidade de um item do
// Organizador direto na fonte (nunca confia em preco vindo do navegador,
// mesma regra ja aplicada aos produtos do catalogo antigo). So os status
// "published" e "low-stock" podem ser comprados - os mesmos que liberam o
// botao de compra no site (ver utils/itemStatus.ts no frontend).
func (s *Service) resolveOrganizerCheckoutItem(ctx context.Context, itemID string, quantity int) (*organizerItemSummary, error) {
	raw, err := s.GetOrganizerStore(ctx)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, fmt.Errorf("item nao encontrado")
	}

	var store organizerCheckoutStore
	if err := json.Unmarshal(raw, &store); err != nil {
		return nil, err
	}

	var node *organizerCheckoutNode
	for i := range store.Nodes {
		if store.Nodes[i].ID == itemID && store.Nodes[i].Type == "item" {
			node = &store.Nodes[i]
			break
		}
	}
	if node == nil {
		return nil, fmt.Errorf("item nao encontrado")
	}
	if node.Status != "published" && node.Status != "low-stock" {
		return nil, fmt.Errorf("%s nao esta disponivel para compra no momento", node.Name)
	}
	if node.Stock != nil && *node.Stock < quantity {
		return nil, fmt.Errorf("estoque insuficiente para %s", node.Name)
	}

	bestDiscount := 0.0
	for _, tagID := range node.TagIds {
		for _, tag := range store.Tags {
			if tag.ID == tagID && tag.DiscountPercent != nil && *tag.DiscountPercent > bestDiscount {
				bestDiscount = *tag.DiscountPercent
			}
		}
	}
	finalPrice := node.Price * (1 - bestDiscount/100)
	if finalPrice < 0 {
		finalPrice = 0
	}

	// Organizador nao tem campo de peso (so volume) - usa o volume em ml como
	// aproximacao em gramas (perfume e liquido, densidade proxima da agua) e
	// cai num valor minimo de seguranca quando o item nem tem volume definido,
	// pra nunca cotar frete de graca.
	weight := 200
	if node.VolumeMl != nil && *node.VolumeMl > 0 {
		weight = *node.VolumeMl
	}

	return &organizerItemSummary{
		ID:   node.ID,
		Name: node.Name,
		// A foto e copiada para o pedido (order_items.product_image_url) em vez
		// de ser buscada depois: o item pode mudar de foto - ou sair do
		// Organizador - sem bagunçar o historico de quem ja comprou.
		ImageURL:  node.ImageURL,
		UnitPrice: finalPrice,
		Weight:    weight,
	}, nil
}

// decrementOrganizerStock baixa o estoque dos itens do Organizador depois que
// o pagamento e confirmado (mesmo momento em que o catalogo antigo baixa
// products.stock_current - ver updateStockForOrder). O SELECT ... FOR UPDATE
// trava a linha "organizer_store" em settings pelo tempo da transacao: uma
// gravacao concorrente do admin (PUT /organizer) espera essa baixa terminar
// em vez de arriscar sobrescreve-la.
func (s *Service) decrementOrganizerStock(ctx context.Context, decrements map[string]int) {
	if len(decrements) == 0 {
		return
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	var raw string
	if err := tx.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1 FOR UPDATE`, organizerStoreSettingKey).Scan(&raw); err != nil {
		return
	}

	var store map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &store); err != nil {
		return
	}
	var nodes []map[string]interface{}
	if err := json.Unmarshal(store["nodes"], &nodes); err != nil {
		return
	}

	changed := false
	for i, node := range nodes {
		id, _ := node["id"].(string)
		nodeType, _ := node["type"].(string)
		qty, wantsDecrement := decrements[id]
		if !wantsDecrement || nodeType != "item" {
			continue
		}
		stockValue, tracked := node["stock"].(float64)
		if !tracked {
			continue
		}
		next := stockValue - float64(qty)
		if next < 0 {
			next = 0
		}
		nodes[i]["stock"] = next
		if next <= 0 {
			nodes[i]["status"] = "coming-soon"
		}
		// Contador acumulado de vendas: e por ele que SaveOrganizerStore
		// descobre as baixas que a tela do admin nao viu.
		sold, _ := node["stockSold"].(float64)
		nodes[i]["stockSold"] = sold + float64(qty)
		changed = true
	}
	if !changed {
		return
	}

	nodesJSON, err := json.Marshal(nodes)
	if err != nil {
		return
	}
	store["nodes"] = nodesJSON
	finalJSON, err := json.Marshal(store)
	if err != nil {
		return
	}

	if _, err := tx.Exec(ctx, `UPDATE settings SET value = $2 WHERE key = $1`, organizerStoreSettingKey, string(finalJSON)); err != nil {
		return
	}
	tx.Commit(ctx)
}

// mergeOrganizerStockSales reaplica, sobre o JSON que o admin esta salvando,
// as vendas que aconteceram depois que a tela dele carregou o Organizador. Cada
// venda soma em stockSold do item (ver decrementOrganizerStock), e a tela do
// admin devolve o stockSold que ela conhecia junto com o resto do item. A
// diferenca entre o stockSold atual e o recebido sao vendas que o JSON recebido
// nao inclui: elas saem do estoque recebido. Assim tanto "nao mexi no estoque"
// quanto "repus 5 unidades" continuam certos mesmo com vendas no meio.
func mergeOrganizerStockSales(current, incoming []byte) (json.RawMessage, error) {
	var currentStore struct {
		Nodes []struct {
			ID        string  `json:"id"`
			StockSold float64 `json:"stockSold"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(current, &currentStore); err != nil {
		// Estado salvo corrompido: nada para reconciliar.
		return incoming, nil
	}
	soldByID := map[string]float64{}
	for _, node := range currentStore.Nodes {
		if node.StockSold > 0 {
			soldByID[node.ID] = node.StockSold
		}
	}
	if len(soldByID) == 0 {
		return incoming, nil
	}

	var store map[string]json.RawMessage
	if err := json.Unmarshal(incoming, &store); err != nil {
		return nil, errors.New("estado do organizador invalido")
	}
	var nodes []map[string]interface{}
	if err := json.Unmarshal(store["nodes"], &nodes); err != nil {
		return nil, errors.New("estado do organizador invalido")
	}

	changed := false
	for i, node := range nodes {
		id, _ := node["id"].(string)
		nodeType, _ := node["type"].(string)
		currentSold, known := soldByID[id]
		if !known || nodeType != "item" {
			continue
		}
		incomingSold, _ := node["stockSold"].(float64)
		if currentSold <= incomingSold {
			continue
		}
		nodes[i]["stockSold"] = currentSold
		changed = true
		stock, tracked := node["stock"].(float64)
		if !tracked {
			continue
		}
		next := stock - (currentSold - incomingSold)
		if next < 0 {
			next = 0
		}
		nodes[i]["stock"] = next
		if next <= 0 {
			nodes[i]["status"] = "coming-soon"
		}
	}
	if !changed {
		return incoming, nil
	}

	nodesJSON, err := json.Marshal(nodes)
	if err != nil {
		return nil, err
	}
	store["nodes"] = nodesJSON
	return json.Marshal(store)
}

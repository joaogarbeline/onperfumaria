package services

import (
	"encoding/json"
	"testing"
)

type mergedItem struct {
	Stock     *float64 `json:"stock"`
	StockSold float64  `json:"stockSold"`
	Status    string   `json:"status"`
	Name      string   `json:"name"`
}

func mergeAndRead(t *testing.T, current, incoming string) map[string]mergedItem {
	t.Helper()
	merged, err := mergeOrganizerStockSales([]byte(current), []byte(incoming))
	if err != nil {
		t.Fatalf("merge: %v", err)
	}
	var store struct {
		Nodes []struct {
			ID string `json:"id"`
			mergedItem
		} `json:"nodes"`
		Tags []any `json:"tags"`
	}
	if err := json.Unmarshal(merged, &store); err != nil {
		t.Fatalf("resultado invalido: %v (%s)", err, merged)
	}
	if store.Tags == nil {
		t.Fatalf("campos de fora de nodes foram perdidos: %s", merged)
	}
	items := map[string]mergedItem{}
	for _, node := range store.Nodes {
		items[node.ID] = node.mergedItem
	}
	return items
}

func TestMergeOrganizerStockSales(t *testing.T) {
	// No servidor: 2 vendas do "a" depois que a tela do admin carregou
	// (stock 5 -> 3, stockSold 4 -> 6).
	current := `{"nodes":[
		{"id":"a","type":"item","name":"A","status":"published","stock":3,"stockSold":6},
		{"id":"b","type":"item","name":"B","status":"published","stock":1,"stockSold":2}
	],"tags":[]}`

	t.Run("admin nao mexeu no estoque: fica o do servidor", func(t *testing.T) {
		items := mergeAndRead(t, current, `{"nodes":[
			{"id":"a","type":"item","name":"A renomeado","status":"published","stock":5,"stockSold":4}
		],"tags":[]}`)
		if got := items["a"]; *got.Stock != 3 || got.StockSold != 6 || got.Name != "A renomeado" {
			t.Fatalf("a = %+v, esperado estoque 3, stockSold 6 e o nome novo", got)
		}
	})

	t.Run("admin repos estoque: soma a reposicao as vendas", func(t *testing.T) {
		items := mergeAndRead(t, current, `{"nodes":[
			{"id":"a","type":"item","name":"A","status":"published","stock":15,"stockSold":4}
		],"tags":[]}`)
		if got := *items["a"].Stock; got != 13 {
			t.Fatalf("estoque = %v, esperado 13 (repos 10 sobre os 3 que sobraram)", got)
		}
	})

	t.Run("tela ja tinha visto as vendas: nada muda", func(t *testing.T) {
		items := mergeAndRead(t, current, `{"nodes":[
			{"id":"a","type":"item","name":"A","status":"published","stock":3,"stockSold":6}
		],"tags":[]}`)
		if got := *items["a"].Stock; got != 3 {
			t.Fatalf("estoque = %v, esperado 3", got)
		}
	})

	t.Run("venda que zera o estoque tira o item de venda", func(t *testing.T) {
		items := mergeAndRead(t, current, `{"nodes":[
			{"id":"b","type":"item","name":"B","status":"published","stock":1,"stockSold":1}
		],"tags":[]}`)
		if got := items["b"]; *got.Stock != 0 || got.Status != "coming-soon" {
			t.Fatalf("b = %+v, esperado estoque 0 e coming-soon", got)
		}
	})

	t.Run("tela carregada antes de existir stockSold conta como zero vendas vistas", func(t *testing.T) {
		items := mergeAndRead(t, current, `{"nodes":[
			{"id":"b","type":"item","name":"B","status":"published","stock":5}
		],"tags":[]}`)
		if got := items["b"]; *got.Stock != 3 || got.StockSold != 2 {
			t.Fatalf("b = %+v, esperado estoque 3 e stockSold 2", got)
		}
	})

	t.Run("item novo do admin passa intacto", func(t *testing.T) {
		items := mergeAndRead(t, current, `{"nodes":[
			{"id":"novo","type":"item","name":"Novo","status":"draft","stock":7}
		],"tags":[]}`)
		if got := items["novo"]; *got.Stock != 7 || got.StockSold != 0 {
			t.Fatalf("novo = %+v, esperado intacto", got)
		}
	})
}

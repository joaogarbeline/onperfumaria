package services

import (
	"context"
	"errors"
	"sort"

	"onperfumaria/backend/internal/models"
)

// autoCarouselLimit e o teto de itens calculados automaticamente por
// carrossel da home. Itens escolhidos manualmente no Organizador nao entram
// nessa conta.
const autoCarouselLimit = 6

func (s *Service) RecordProductEvent(ctx context.Context, customerID, sessionID, productID, eventType string) error {
	if sessionID == "" {
		return errors.New("sessao e obrigatoria")
	}
	if productID == "" {
		return errors.New("produto e obrigatorio")
	}
	if eventType != "view" && eventType != "click" {
		return errors.New("tipo de evento invalido")
	}

	var custID *string
	if customerID != "" {
		custID = &customerID
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO product_events (customer_id, session_id, product_id, event_type) VALUES ($1, $2, $3, $4)`,
		custID, sessionID, productID, eventType,
	)
	return err
}

// HomeCarousels calcula a parte automatica (baseada em regra) dos carrosseis
// da home. O Organizador continua dono dos itens escolhidos manualmente; aqui
// so devolvemos o complemento automatico, ja limitado e sem repetir produto
// entre carrosseis (prioridade: oferta > pouco estoque > novidades).
func (s *Service) HomeCarousels(ctx context.Context, customerID, sessionID string) (map[string]interface{}, error) {
	products, err := s.ListProducts(ctx)
	if err != nil {
		return nil, err
	}

	available := make([]models.Product, 0, len(products))
	for _, product := range products {
		if product.IsAvailable {
			available = append(available, product)
		}
	}

	used := map[string]bool{}

	onSale := make([]models.Product, 0)
	for _, product := range available {
		if product.AutomaticDiscountAmount > 0 {
			onSale = append(onSale, product)
		}
	}
	sort.SliceStable(onSale, func(i, j int) bool {
		return onSale[i].AutomaticDiscountAmount > onSale[j].AutomaticDiscountAmount
	})
	onSale = takeUnusedProducts(onSale, used, autoCarouselLimit)

	lowStock := make([]models.Product, 0)
	for _, product := range available {
		if product.RegisteredStock > 0 && float64(product.StockCurrent) <= 0.3*float64(product.RegisteredStock) {
			lowStock = append(lowStock, product)
		}
	}
	sort.SliceStable(lowStock, func(i, j int) bool {
		ratioI := float64(lowStock[i].StockCurrent) / float64(lowStock[i].RegisteredStock)
		ratioJ := float64(lowStock[j].StockCurrent) / float64(lowStock[j].RegisteredStock)
		return ratioI < ratioJ
	})
	lowStock = takeUnusedProducts(lowStock, used, autoCarouselLimit)

	// available ja vem ordenado por created_at desc (StoreRepository.ListProducts).
	newArrivals := takeUnusedProducts(available, used, autoCarouselLimit)

	return map[string]interface{}{
		"onSale":      onSale,
		"lowStock":    lowStock,
		"newArrivals": newArrivals,
	}, nil
}

func takeUnusedProducts(list []models.Product, used map[string]bool, limit int) []models.Product {
	result := make([]models.Product, 0, limit)
	for _, product := range list {
		if used[product.ID] {
			continue
		}
		result = append(result, product)
		used[product.ID] = true
		if len(result) >= limit {
			break
		}
	}
	return result
}

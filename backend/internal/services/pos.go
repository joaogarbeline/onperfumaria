package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

// Formas de pagamento aceitas no PDV (venda presencial). Cartao e Pix
// presenciais sao cobrados na maquininha ou no app do banco da loja; aqui so
// fica o registro, com troco no dinheiro e parcelas no credito.
var posPaymentMethods = map[string]string{
	"dinheiro": "Dinheiro",
	"pix":      "Pix",
	"debito":   "Cartão de débito",
	"credito":  "Cartão de crédito",
}

type POSSaleInput struct {
	Items []struct {
		ProductID string `json:"productId"`
		Quantity  int    `json:"quantity"`
	} `json:"items"`
	Discount       float64 `json:"discount"`
	PaymentMethod  string  `json:"paymentMethod"`
	Installments   int     `json:"installments"`
	AmountReceived float64 `json:"amountReceived"`
	CustomerName   string  `json:"customerName"`
	CustomerPhone  string  `json:"customerPhone"`
	Notes          string  `json:"notes"`
}

func roundCents(value float64) float64 {
	return math.Round(value*100) / 100
}

// CreatePOSSale registra uma venda de balcao. Preco e estoque saem do
// Organizador (nunca do navegador) e o estoque baixa na hora.
func (s *Service) CreatePOSSale(ctx context.Context, sellerID string, input POSSaleInput) (map[string]interface{}, error) {
	if len(input.Items) == 0 {
		return nil, errors.New("adicione pelo menos um produto")
	}
	if _, ok := posPaymentMethods[input.PaymentMethod]; !ok {
		return nil, errors.New("escolha a forma de pagamento")
	}

	type line struct {
		itemID   string
		name     string
		price    float64
		quantity int
		total    float64
	}
	quantities := map[string]int{}
	order := []string{}
	for _, item := range input.Items {
		if item.Quantity <= 0 {
			continue
		}
		if _, seen := quantities[item.ProductID]; !seen {
			order = append(order, item.ProductID)
		}
		quantities[item.ProductID] += item.Quantity
	}

	lines := []line{}
	subtotal := 0.0
	for _, id := range order {
		summary, err := s.resolveOrganizerCheckoutItem(ctx, id, quantities[id])
		if err != nil {
			return nil, err
		}
		total := roundCents(summary.UnitPrice * float64(quantities[id]))
		subtotal += total
		lines = append(lines, line{summary.ID, summary.Name, roundCents(summary.UnitPrice), quantities[id], total})
	}
	if len(lines) == 0 {
		return nil, errors.New("adicione pelo menos um produto")
	}
	subtotal = roundCents(subtotal)

	discount := roundCents(math.Max(0, input.Discount))
	if discount > subtotal {
		discount = subtotal
	}
	total := roundCents(subtotal - discount)

	installments := 1
	if input.PaymentMethod == "credito" && input.Installments > 1 {
		installments = int(math.Min(float64(input.Installments), 12))
	}

	var received *float64
	change := 0.0
	if input.PaymentMethod == "dinheiro" {
		amount := roundCents(input.AmountReceived)
		if amount == 0 {
			amount = total
		}
		if amount < total {
			return nil, fmt.Errorf("valor recebido menor que o total (%s)", formatBRL(total))
		}
		received = &amount
		change = roundCents(amount - total)
	}

	customerName := strings.TrimSpace(input.CustomerName)
	if customerName == "" {
		customerName = "Consumidor Final"
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var saleID string
	var createdAt time.Time
	var seller interface{}
	if sellerID != "" {
		seller = sellerID
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO pos_sales (customer_name, customer_phone, payment_method, subtotal, discount_amount, total_amount,
			installments, amount_received, change_amount, seller_id, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id::text, created_at`,
		customerName, strings.TrimSpace(input.CustomerPhone), input.PaymentMethod, subtotal, discount, total,
		installments, received, change, seller, strings.TrimSpace(input.Notes),
	).Scan(&saleID, &createdAt)
	if err != nil {
		return nil, err
	}
	for _, l := range lines {
		if _, err := tx.Exec(ctx, `
			INSERT INTO pos_sale_items (pos_sale_id, organizer_item_id, product_name, unit_price, quantity, line_total)
			VALUES ($1, $2, $3, $4, $5, $6)`, saleID, l.itemID, l.name, l.price, l.quantity, l.total); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	s.decrementOrganizerStock(ctx, quantities)
	return s.POSSale(ctx, saleID)
}

// POSSale devolve a venda com os itens (usado no comprovante).
func (s *Service) POSSale(ctx context.Context, saleID string) (map[string]interface{}, error) {
	var id, customerName, customerPhone, method, notes, status string
	var subtotal, discount, total, change float64
	var received *float64
	var installments int
	var createdAt time.Time
	err := s.db.QueryRow(ctx, `
		SELECT id::text, customer_name, customer_phone, payment_method, notes, status,
			subtotal, discount_amount, total_amount, change_amount, amount_received, installments, created_at
		FROM pos_sales WHERE id = $1`, saleID,
	).Scan(&id, &customerName, &customerPhone, &method, &notes, &status, &subtotal, &discount, &total, &change,
		&received, &installments, &createdAt)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT organizer_item_id, product_name, unit_price, quantity, line_total
		FROM pos_sale_items WHERE pos_sale_id = $1 ORDER BY product_name`, saleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var itemID, name string
		var price, lineTotal float64
		var quantity int
		if err := rows.Scan(&itemID, &name, &price, &quantity, &lineTotal); err != nil {
			return nil, err
		}
		items = append(items, map[string]interface{}{
			"productId": itemID, "name": name, "price": price, "quantity": quantity, "total": lineTotal,
		})
	}

	return map[string]interface{}{
		"id": id, "customerName": customerName, "customerPhone": customerPhone,
		"paymentMethod": method, "paymentLabel": posPaymentMethods[method], "installments": installments,
		"subtotal": subtotal, "discount": discount, "total": total,
		"amountReceived": received, "change": change, "notes": notes, "status": status,
		"createdAt": createdAt, "items": items,
	}, rows.Err()
}

// POSDay e o caixa de um dia: vendas, totais por forma de pagamento e o
// dinheiro que deve estar na gaveta.
func (s *Service) POSDay(ctx context.Context, day string) (map[string]interface{}, error) {
	location := storeLocation()
	date := time.Now().In(location).Format("2006-01-02")
	if day != "" {
		if _, err := time.ParseInLocation("2006-01-02", day, location); err != nil {
			return nil, errors.New("data invalida")
		}
		date = day
	}

	rows, err := s.db.Query(ctx, `
		SELECT ps.id::text, ps.customer_name, ps.payment_method, ps.total_amount, ps.status, ps.created_at,
			COALESCE((SELECT SUM(quantity) FROM pos_sale_items WHERE pos_sale_id = ps.id), 0)::int
		FROM pos_sales ps
		WHERE (ps.created_at AT TIME ZONE $1)::date = $2::date
		ORDER BY ps.created_at DESC`, storeTimeZone, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sales := []map[string]interface{}{}
	byMethod := map[string]float64{}
	total := 0.0
	count := 0
	for rows.Next() {
		var id, name, method, status string
		var amount float64
		var createdAt time.Time
		var items int
		if err := rows.Scan(&id, &name, &method, &amount, &status, &createdAt, &items); err != nil {
			return nil, err
		}
		if status != "cancelada" {
			byMethod[method] += amount
			total += amount
			count++
		}
		sales = append(sales, map[string]interface{}{
			"id": id, "customerName": name, "paymentMethod": method, "paymentLabel": posPaymentMethods[method],
			"total": amount, "status": status, "createdAt": createdAt, "itemsCount": items,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	methods := []map[string]interface{}{}
	for _, key := range []string{"dinheiro", "pix", "debito", "credito"} {
		methods = append(methods, map[string]interface{}{"key": key, "label": posPaymentMethods[key], "total": roundCents(byMethod[key])})
	}
	return map[string]interface{}{
		"date": date, "total": roundCents(total), "count": count, "byMethod": methods, "sales": sales,
	}, nil
}

// CancelPOSSale cancela uma venda de balcao e devolve os itens ao estoque.
func (s *Service) CancelPOSSale(ctx context.Context, saleID string) (map[string]interface{}, error) {
	var restored bool
	err := s.db.QueryRow(ctx, `
		UPDATE pos_sales SET status = 'cancelada', cancelled_at = NOW()
		WHERE id = $1 AND status <> 'cancelada'
		RETURNING true`, saleID).Scan(&restored)
	if err != nil {
		return nil, errors.New("venda nao encontrada ou ja cancelada")
	}

	rows, err := s.db.Query(ctx, `SELECT organizer_item_id, quantity FROM pos_sale_items WHERE pos_sale_id = $1`, saleID)
	if err != nil {
		return nil, err
	}
	refunds := map[string]int{}
	for rows.Next() {
		var itemID string
		var quantity int
		if err := rows.Scan(&itemID, &quantity); err == nil && itemID != "" {
			refunds[itemID] -= quantity // negativo = devolve ao estoque
		}
	}
	rows.Close()
	s.decrementOrganizerStock(ctx, refunds)
	return s.POSSale(ctx, saleID)
}

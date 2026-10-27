package services

import (
	"context"
	"time"
)

// Fuso da loja (Campo Grande-MS): "hoje" e "este mes" do painel contam pela
// hora local, nao por UTC - senao uma venda das 21h ja cairia no dia seguinte.
const storeTimeZone = "America/Campo_Grande"

// Pedido conta como venda quando o pagamento foi confirmado, esteja ele ainda
// a enviar, enviado ou entregue.
const paidOrderCondition = `o.order_status IN ('pago', 'enviado', 'entregue')`

// AdminDashboard resume as vendas online para o painel de pedidos do admin.
func (s *Service) AdminDashboard(ctx context.Context) (map[string]interface{}, error) {
	var todayRevenue, monthRevenue float64
	var todayOrders, monthOrders, awaitingPayment, toShip, shipped int
	err := s.db.QueryRow(ctx, `
		WITH local AS (
			SELECT o.*, (o.created_at AT TIME ZONE $1)::date AS local_date
			FROM orders o
		), bounds AS (
			SELECT (NOW() AT TIME ZONE $1)::date AS today,
			       date_trunc('month', NOW() AT TIME ZONE $1)::date AS month_start
		)
		SELECT
			COALESCE(SUM(o.total_amount) FILTER (WHERE `+paidOrderCondition+` AND o.local_date = b.today), 0),
			COUNT(*) FILTER (WHERE `+paidOrderCondition+` AND o.local_date = b.today),
			COALESCE(SUM(o.total_amount) FILTER (WHERE `+paidOrderCondition+` AND o.local_date >= b.month_start), 0),
			COUNT(*) FILTER (WHERE `+paidOrderCondition+` AND o.local_date >= b.month_start),
			COUNT(*) FILTER (WHERE o.order_status = 'aguardando_pagamento'
				AND o.payment_status NOT IN ('rejected', 'cancelled')
				AND o.created_at > NOW() - INTERVAL '3 days'),
			COUNT(*) FILTER (WHERE o.order_status = 'pago'),
			COUNT(*) FILTER (WHERE o.order_status = 'enviado')
		FROM local o CROSS JOIN bounds b`, storeTimeZone,
	).Scan(&todayRevenue, &todayOrders, &monthRevenue, &monthOrders, &awaitingPayment, &toShip, &shipped)
	if err != nil {
		return nil, err
	}

	averageTicket := 0.0
	if monthOrders > 0 {
		averageTicket = monthRevenue / float64(monthOrders)
	}

	days, err := s.dashboardLastDays(ctx, 7)
	if err != nil {
		return nil, err
	}
	topProducts, err := s.dashboardTopProducts(ctx)
	if err != nil {
		return nil, err
	}

	var customersTotal, customersNew int
	if err := s.db.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (
			WHERE (created_at AT TIME ZONE $1)::date >= date_trunc('month', NOW() AT TIME ZONE $1)::date)
		FROM customers WHERE is_fixed_admin = false`, storeTimeZone,
	).Scan(&customersTotal, &customersNew); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"today":           map[string]interface{}{"revenue": todayRevenue, "orders": todayOrders},
		"month":           map[string]interface{}{"revenue": monthRevenue, "orders": monthOrders, "averageTicket": averageTicket},
		"awaitingPayment": awaitingPayment,
		"toShip":          toShip,
		"shipped":         shipped,
		"lastDays":        days,
		"topProducts":     topProducts,
		"customers":       map[string]interface{}{"total": customersTotal, "newThisMonth": customersNew},
	}, nil
}

func (s *Service) dashboardLastDays(ctx context.Context, count int) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `
		WITH days AS (
			SELECT generate_series(
				(NOW() AT TIME ZONE $1)::date - ($2::int - 1),
				(NOW() AT TIME ZONE $1)::date,
				INTERVAL '1 day')::date AS day
		)
		SELECT d.day, COALESCE(SUM(o.total_amount), 0), COUNT(o.id)
		FROM days d
		LEFT JOIN orders o ON (o.created_at AT TIME ZONE $1)::date = d.day AND `+paidOrderCondition+`
		GROUP BY d.day
		ORDER BY d.day`, storeTimeZone, count)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	days := []map[string]interface{}{}
	for rows.Next() {
		var day time.Time
		var revenue float64
		var orders int
		if err := rows.Scan(&day, &revenue, &orders); err != nil {
			return nil, err
		}
		days = append(days, map[string]interface{}{"date": day.Format("2006-01-02"), "revenue": revenue, "orders": orders})
	}
	return days, rows.Err()
}

func (s *Service) dashboardTopProducts(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `
		SELECT oi.product_name, COALESCE(MAX(oi.product_image_url), ''), SUM(oi.quantity), SUM(oi.line_total)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE `+paidOrderCondition+`
		  AND (o.created_at AT TIME ZONE $1)::date >= date_trunc('month', NOW() AT TIME ZONE $1)::date
		GROUP BY oi.product_name
		ORDER BY SUM(oi.quantity) DESC, SUM(oi.line_total) DESC
		LIMIT 5`, storeTimeZone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []map[string]interface{}{}
	for rows.Next() {
		var name, imageURL string
		var quantity int
		var revenue float64
		if err := rows.Scan(&name, &imageURL, &quantity, &revenue); err != nil {
			return nil, err
		}
		products = append(products, map[string]interface{}{"name": name, "imageUrl": imageURL, "quantity": quantity, "revenue": revenue})
	}
	return products, rows.Err()
}

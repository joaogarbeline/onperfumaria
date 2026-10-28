package services

import (
	"context"
	"time"
)

// Fuso da loja (Campo Grande-MS): "hoje" e "este mes" do painel contam pela
// hora local, nao por UTC - senao uma venda das 21h ja cairia no dia seguinte.
const storeTimeZone = "America/Campo_Grande"

// AdminDashboard resume as vendas (site + balcao) para a visao geral do
// painel do admin, reaproveitando as contas dos relatorios.
func (s *Service) AdminDashboard(ctx context.Context) (map[string]interface{}, error) {
	location := storeLocation()
	now := time.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)

	todayRange := ReportRange{Period: "custom", From: today, To: today}
	monthRange := ReportRange{Period: "month", From: today.AddDate(0, 0, 1-today.Day()), To: today}
	weekRange := ReportRange{Period: "custom", From: today.AddDate(0, 0, -6), To: today}

	todaySummary, err := s.reportSummary(ctx, todayRange)
	if err != nil {
		return nil, err
	}
	monthSummary, err := s.reportSummary(ctx, monthRange)
	if err != nil {
		return nil, err
	}
	days, err := s.reportSeries(ctx, weekRange)
	if err != nil {
		return nil, err
	}
	topProducts, err := s.reportTopProducts(ctx, monthRange)
	if err != nil {
		return nil, err
	}

	var awaitingPayment, toShip, shipped, deliveredToday int
	var oldestToShip *time.Time
	if err := s.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE order_status = 'aguardando_pagamento'
				AND payment_status NOT IN ('rejected', 'cancelled')
				AND created_at > NOW() - INTERVAL '3 days'),
			COUNT(*) FILTER (WHERE order_status = 'pago'),
			COUNT(*) FILTER (WHERE order_status = 'enviado'),
			COUNT(*) FILTER (WHERE order_status = 'entregue'
				AND (created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date),
			MIN(created_at) FILTER (WHERE order_status = 'pago')
		FROM orders`, storeTimeZone,
	).Scan(&awaitingPayment, &toShip, &shipped, &deliveredToday, &oldestToShip); err != nil {
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

	// Dias que o pedido pago mais antigo esta esperando envio (alerta do painel).
	oldestToShipDays := 0
	if oldestToShip != nil {
		oldestToShipDays = int(time.Since(*oldestToShip).Hours() / 24)
	}

	return map[string]interface{}{
		"today": map[string]interface{}{
			"revenue": todaySummary.Revenue, "orders": todaySummary.Orders,
			"online": todaySummary.OnlineRevenue, "store": todaySummary.StoreRevenue,
		},
		"month": map[string]interface{}{
			"revenue": monthSummary.Revenue, "orders": monthSummary.Orders, "averageTicket": monthSummary.AverageTicket,
			"online": monthSummary.OnlineRevenue, "store": monthSummary.StoreRevenue,
			"receivable": monthSummary.Receivable,
		},
		"awaitingPayment":  awaitingPayment,
		"toShip":           toShip,
		"shipped":          shipped,
		"deliveredToday":   deliveredToday,
		"oldestToShipDays": oldestToShipDays,
		"lastDays":         days,
		"topProducts":      topProducts,
		"customers":        map[string]interface{}{"total": customersTotal, "newThisMonth": customersNew},
	}, nil
}

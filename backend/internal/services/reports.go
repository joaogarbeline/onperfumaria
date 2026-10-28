package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"strings"
	"time"

	// Fuso da loja embutido no binario: a imagem Alpine do Docker nao tem o
	// banco de fusos do sistema, e sem ele o LoadLocation falharia.
	_ "time/tzdata"
)

// ReportRange e o periodo de um relatorio, sempre em dias inteiros do fuso
// da loja (from e to inclusivos).
type ReportRange struct {
	Period string    // week | month | year | custom
	From   time.Time // meia-noite do primeiro dia
	To     time.Time // meia-noite do ultimo dia
}

func storeLocation() *time.Location {
	location, err := time.LoadLocation(storeTimeZone)
	if err != nil {
		return time.FixedZone("BRT", -4*60*60)
	}
	return location
}

// ResolveReportRange monta o periodo pedido. reference e qualquer dia dentro
// dele (o padrao e hoje); a semana vai de segunda a domingo. "custom" usa
// from/to (no maximo 3 anos).
func ResolveReportRange(period, reference, from, to string) (ReportRange, error) {
	location := storeLocation()
	parse := func(value string) (time.Time, error) {
		return time.ParseInLocation("2006-01-02", value, location)
	}

	day := time.Now().In(location)
	day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, location)
	if reference != "" {
		parsed, err := parse(reference)
		if err != nil {
			return ReportRange{}, errors.New("data de referencia invalida")
		}
		day = parsed
	}

	switch period {
	case "week":
		offset := (int(day.Weekday()) + 6) % 7 // segunda = 0
		start := day.AddDate(0, 0, -offset)
		return ReportRange{Period: period, From: start, To: start.AddDate(0, 0, 6)}, nil
	case "month", "":
		start := time.Date(day.Year(), day.Month(), 1, 0, 0, 0, 0, location)
		return ReportRange{Period: "month", From: start, To: start.AddDate(0, 1, -1)}, nil
	case "year":
		start := time.Date(day.Year(), 1, 1, 0, 0, 0, 0, location)
		return ReportRange{Period: period, From: start, To: start.AddDate(1, 0, -1)}, nil
	case "custom":
		start, err := parse(from)
		if err != nil {
			return ReportRange{}, errors.New("data inicial invalida")
		}
		end, err := parse(to)
		if err != nil {
			return ReportRange{}, errors.New("data final invalida")
		}
		if end.Before(start) {
			start, end = end, start
		}
		if end.Sub(start) > 3*366*24*time.Hour {
			return ReportRange{}, errors.New("periodo maximo de 3 anos")
		}
		return ReportRange{Period: period, From: start, To: end}, nil
	}
	return ReportRange{}, errors.New("periodo invalido")
}

// Previous e o periodo imediatamente anterior, do mesmo tamanho, para a
// comparacao "vs. periodo anterior".
func (r ReportRange) Previous() ReportRange {
	switch r.Period {
	case "week":
		return ReportRange{Period: r.Period, From: r.From.AddDate(0, 0, -7), To: r.To.AddDate(0, 0, -7)}
	case "month":
		start := r.From.AddDate(0, -1, 0)
		return ReportRange{Period: r.Period, From: start, To: r.From.AddDate(0, 0, -1)}
	case "year":
		return ReportRange{Period: r.Period, From: r.From.AddDate(-1, 0, 0), To: r.To.AddDate(-1, 0, 0)}
	}
	days := int(r.To.Sub(r.From).Hours()/24) + 1
	return ReportRange{Period: r.Period, From: r.From.AddDate(0, 0, -days), To: r.From.AddDate(0, 0, -1)}
}

func (r ReportRange) fromDate() string { return r.From.Format("2006-01-02") }
func (r ReportRange) toDate() string   { return r.To.Format("2006-01-02") }

// Vendas confirmadas do periodo nos dois canais, no fuso da loja:
// "online" (pedidos do site pagos) e "loja" (PDV, menos as canceladas).
// $1 = fuso, $2 = de, $3 = ate.
const reportSalesCTE = `
	WITH sales AS (
		SELECT o.id, 'online' AS channel, o.total_amount AS total, o.discount_amount AS discount,
			o.shipping_amount AS shipping, o.customer_id,
			CASE WHEN o.payment_method = 'pix' THEN 'pix' WHEN o.payment_method = '' THEN 'outros' ELSE 'cartao' END AS payment_group,
			CASE WHEN o.delivery_mode = '' THEN 'outros' ELSE o.delivery_mode END AS delivery_group,
			(o.created_at AT TIME ZONE $1)::date AS local_date
		FROM orders o
		WHERE o.order_status IN ('pago', 'enviado', 'entregue')
		  AND (o.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
		UNION ALL
		SELECT ps.id, 'loja', ps.total_amount, ps.discount_amount, 0, NULL,
			'loja-' || ps.payment_method, 'loja',
			(ps.created_at AT TIME ZONE $1)::date
		FROM pos_sales ps
		WHERE ps.status <> 'cancelada'
		  AND (ps.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
	), sale_items AS (
		SELECT oi.product_name, oi.quantity, oi.line_total
		FROM order_items oi JOIN sales s ON s.id = oi.order_id AND s.channel = 'online'
		UNION ALL
		SELECT pi.product_name, pi.quantity, pi.line_total
		FROM pos_sale_items pi JOIN sales s ON s.id = pi.pos_sale_id AND s.channel = 'loja'
	)`

type reportSummary struct {
	Revenue       float64 `json:"revenue"`
	Orders        int     `json:"orders"`
	AverageTicket float64 `json:"averageTicket"`
	Items         int     `json:"items"`
	Discount      float64 `json:"discount"`
	Shipping      float64 `json:"shipping"`
	OnlineRevenue float64 `json:"onlineRevenue"`
	OnlineOrders  int     `json:"onlineOrders"`
	StoreRevenue  float64 `json:"storeRevenue"`
	StoreSales    int     `json:"storeSales"`
	Customers     int     `json:"customers"`
	NewCustomers  int     `json:"newCustomers"`
	Cancelled     int     `json:"cancelled"`
	Pending       int     `json:"pending"`
	// Pedidos do site ainda sem pagamento confirmado (Pix gerado, cartao em
	// analise): dinheiro que pode entrar.
	Receivable float64 `json:"receivable"`
}

func (s *Service) reportSummary(ctx context.Context, r ReportRange) (reportSummary, error) {
	var summary reportSummary
	err := s.db.QueryRow(ctx, reportSalesCTE+`
		SELECT
			COALESCE(SUM(total), 0), COUNT(*),
			COALESCE((SELECT SUM(quantity) FROM sale_items), 0),
			COALESCE(SUM(discount), 0), COALESCE(SUM(shipping), 0),
			COALESCE(SUM(total) FILTER (WHERE channel = 'online'), 0), COUNT(*) FILTER (WHERE channel = 'online'),
			COALESCE(SUM(total) FILTER (WHERE channel = 'loja'), 0), COUNT(*) FILTER (WHERE channel = 'loja'),
			COUNT(DISTINCT customer_id)
		FROM sales`,
		storeTimeZone, r.fromDate(), r.toDate(),
	).Scan(&summary.Revenue, &summary.Orders, &summary.Items, &summary.Discount, &summary.Shipping,
		&summary.OnlineRevenue, &summary.OnlineOrders, &summary.StoreRevenue, &summary.StoreSales, &summary.Customers)
	if err != nil {
		return summary, err
	}
	if summary.Orders > 0 {
		summary.AverageTicket = summary.Revenue / float64(summary.Orders)
	}

	err = s.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE o.payment_status IN ('rejected', 'cancelled') OR o.order_status = 'cancelado'),
			COUNT(*) FILTER (WHERE o.order_status = 'aguardando_pagamento' AND o.payment_status NOT IN ('rejected', 'cancelled')),
			COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'aguardando_pagamento'
				AND o.payment_status NOT IN ('rejected', 'cancelled')), 0)
		FROM orders o
		WHERE (o.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`,
		storeTimeZone, r.fromDate(), r.toDate(),
	).Scan(&summary.Cancelled, &summary.Pending, &summary.Receivable)
	if err != nil {
		return summary, err
	}

	err = s.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM customers
		WHERE is_fixed_admin = false
		  AND (created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`,
		storeTimeZone, r.fromDate(), r.toDate(),
	).Scan(&summary.NewCustomers)
	return summary, err
}

// reportSeries quebra o periodo em dias (ate ~3 meses) ou em meses, com o
// site e a loja separados.
func (s *Service) reportSeries(ctx context.Context, r ReportRange) ([]map[string]interface{}, error) {
	byMonth := r.Period == "year" || r.To.Sub(r.From) > 93*24*time.Hour
	step, bucket, layout := "1 day", "day", "2006-01-02"
	if byMonth {
		step, bucket, layout = "1 month", "month", "2006-01"
	}

	rows, err := s.db.Query(ctx, reportSalesCTE+`, buckets AS (
			SELECT generate_series(date_trunc('`+bucket+`', $2::date), $3::date, INTERVAL '`+step+`')::date AS bucket
		)
		SELECT b.bucket,
			COALESCE(SUM(s.total), 0), COUNT(s.id),
			COALESCE(SUM(s.total) FILTER (WHERE s.channel = 'online'), 0),
			COALESCE(SUM(s.total) FILTER (WHERE s.channel = 'loja'), 0)
		FROM buckets b
		LEFT JOIN sales s ON date_trunc('`+bucket+`', s.local_date)::date = b.bucket
		GROUP BY b.bucket
		ORDER BY b.bucket`,
		storeTimeZone, r.fromDate(), r.toDate())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	series := []map[string]interface{}{}
	for rows.Next() {
		var day time.Time
		var revenue, online, store float64
		var orders int
		if err := rows.Scan(&day, &revenue, &orders, &online, &store); err != nil {
			return nil, err
		}
		series = append(series, map[string]interface{}{
			"key": day.Format(layout), "revenue": revenue, "orders": orders, "online": online, "store": store,
		})
	}
	return series, rows.Err()
}

// reportBreakdown soma as vendas agrupadas por uma coluna de "sales"
// (payment_group, delivery_group, channel).
func (s *Service) reportBreakdown(ctx context.Context, r ReportRange, column string) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, reportSalesCTE+`
		SELECT `+column+` AS grp, COALESCE(SUM(total), 0), COUNT(*)
		FROM sales
		GROUP BY grp
		ORDER BY 2 DESC`,
		storeTimeZone, r.fromDate(), r.toDate())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []map[string]interface{}{}
	for rows.Next() {
		var key string
		var revenue float64
		var orders int
		if err := rows.Scan(&key, &revenue, &orders); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{"key": key, "revenue": revenue, "orders": orders})
	}
	return result, rows.Err()
}

func (s *Service) reportTopProducts(ctx context.Context, r ReportRange) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, reportSalesCTE+`
		SELECT product_name, SUM(quantity), SUM(line_total)
		FROM sale_items
		GROUP BY product_name
		ORDER BY SUM(line_total) DESC, SUM(quantity) DESC
		LIMIT 10`,
		storeTimeZone, r.fromDate(), r.toDate())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []map[string]interface{}{}
	for rows.Next() {
		var name string
		var quantity int
		var revenue float64
		if err := rows.Scan(&name, &quantity, &revenue); err != nil {
			return nil, err
		}
		products = append(products, map[string]interface{}{"name": name, "quantity": quantity, "revenue": revenue})
	}
	return products, rows.Err()
}

func (s *Service) reportTopCustomers(ctx context.Context, r ReportRange) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, reportSalesCTE+`
		SELECT c.id::text, COALESCE(c.name, 'Cliente'), COUNT(s.id), SUM(s.total)
		FROM sales s
		JOIN customers c ON c.id = s.customer_id
		GROUP BY c.id, c.name
		ORDER BY SUM(s.total) DESC
		LIMIT 10`,
		storeTimeZone, r.fromDate(), r.toDate())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers := []map[string]interface{}{}
	for rows.Next() {
		var id, name string
		var orders int
		var revenue float64
		if err := rows.Scan(&id, &name, &orders, &revenue); err != nil {
			return nil, err
		}
		customers = append(customers, map[string]interface{}{"id": id, "name": name, "orders": orders, "revenue": revenue})
	}
	return customers, rows.Err()
}

// SalesReport e o relatorio completo do periodo, com o periodo anterior ao
// lado para comparacao.
func (s *Service) SalesReport(ctx context.Context, r ReportRange) (map[string]interface{}, error) {
	summary, err := s.reportSummary(ctx, r)
	if err != nil {
		return nil, err
	}
	previous := r.Previous()
	previousSummary, err := s.reportSummary(ctx, previous)
	if err != nil {
		return nil, err
	}
	series, err := s.reportSeries(ctx, r)
	if err != nil {
		return nil, err
	}
	byPayment, err := s.reportBreakdown(ctx, r, "payment_group")
	if err != nil {
		return nil, err
	}
	byDelivery, err := s.reportBreakdown(ctx, r, "delivery_group")
	if err != nil {
		return nil, err
	}
	topProducts, err := s.reportTopProducts(ctx, r)
	if err != nil {
		return nil, err
	}
	topCustomers, err := s.reportTopCustomers(ctx, r)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"period":          r.Period,
		"from":            r.fromDate(),
		"to":              r.toDate(),
		"previous":        map[string]string{"from": previous.fromDate(), "to": previous.toDate()},
		"summary":         summary,
		"previousSummary": previousSummary,
		"series":          series,
		"byPayment":       byPayment,
		"byDelivery":      byDelivery,
		"topProducts":     topProducts,
		"topCustomers":    topCustomers,
	}, nil
}

// SalesReportCSV e a planilha do periodo: um pedido por linha, com os itens,
// no formato do Excel em portugues (ver ExportOrdersCSV).
func (s *Service) SalesReportCSV(ctx context.Context, r ReportRange) ([]byte, error) {
	rows, err := s.db.Query(ctx, `
		WITH period_orders AS (
			SELECT o.* FROM orders o
			WHERE (o.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
		)
		SELECT o.id::text, o.created_at, COALESCE(c.name, 'Consumidor Final'), COALESCE(c.email, ''), COALESCE(c.phone, ''),
			o.payment_method, o.delivery_mode, o.order_status, o.payment_status,
			o.subtotal, o.discount_amount, o.shipping_amount, o.total_amount,
			COALESCE((SELECT string_agg(oi.quantity || 'x ' || oi.product_name, ' | ' ORDER BY oi.product_name)
				FROM order_items oi WHERE oi.order_id = o.id), '')
		FROM period_orders o
		LEFT JOIN customers c ON c.id = o.customer_id
		ORDER BY o.created_at`,
		storeTimeZone, r.fromDate(), r.toDate())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	location := storeLocation()
	money := func(value float64) string { return strings.Replace(fmt.Sprintf("%.2f", value), ".", ",", 1) }

	var buf bytes.Buffer
	buf.WriteString("\ufeff")
	writer := csv.NewWriter(&buf)
	writer.Comma = ';'
	header := []string{"Data", "Canal", "Pedido", "Cliente", "E-mail", "Telefone", "Pagamento", "Entrega", "Status",
		"Pago", "Subtotal", "Desconto", "Frete", "Total", "Itens"}
	if err := writer.Write(header); err != nil {
		return nil, err
	}
	for rows.Next() {
		var id, name, email, phone, payment, delivery, orderStatus, paymentStatus, items string
		var createdAt time.Time
		var subtotal, discount, shipping, total float64
		if err := rows.Scan(&id, &createdAt, &name, &email, &phone, &payment, &delivery, &orderStatus, &paymentStatus,
			&subtotal, &discount, &shipping, &total, &items); err != nil {
			return nil, err
		}
		paid := "Não"
		if orderStatus == "pago" || orderStatus == "enviado" || orderStatus == "entregue" {
			paid = "Sim"
		}
		if err := writer.Write([]string{
			createdAt.In(location).Format("02/01/2006 15:04"),
			"Site",
			strings.ToUpper(id[:8]),
			spreadsheetSafe(name),
			spreadsheetSafe(email),
			spreadsheetSafe(phone),
			paymentLabel(payment),
			deliveryLabel(delivery),
			orderStatusLabel(orderStatus, paymentStatus),
			paid,
			money(subtotal),
			money(discount),
			money(shipping),
			money(total),
			spreadsheetSafe(items),
		}); err != nil {
			return nil, err
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	// Vendas de balcao (PDV) do mesmo periodo, depois dos pedidos do site.
	posRows, err := s.db.Query(ctx, `
		SELECT ps.id::text, ps.created_at, ps.customer_name, ps.customer_phone, ps.payment_method, ps.status,
			ps.subtotal, ps.discount_amount, ps.total_amount,
			COALESCE((SELECT string_agg(pi.quantity || 'x ' || pi.product_name, ' | ' ORDER BY pi.product_name)
				FROM pos_sale_items pi WHERE pi.pos_sale_id = ps.id), '')
		FROM pos_sales ps
		WHERE (ps.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
		ORDER BY ps.created_at`,
		storeTimeZone, r.fromDate(), r.toDate())
	if err != nil {
		return nil, err
	}
	defer posRows.Close()
	for posRows.Next() {
		var id, name, phone, method, status, items string
		var createdAt time.Time
		var subtotal, discount, total float64
		if err := posRows.Scan(&id, &createdAt, &name, &phone, &method, &status, &subtotal, &discount, &total, &items); err != nil {
			return nil, err
		}
		statusLabel, paid := "Concluída", "Sim"
		if status == "cancelada" {
			statusLabel, paid = "Cancelada", "Não"
		}
		if err := writer.Write([]string{
			createdAt.In(location).Format("02/01/2006 15:04"),
			"Loja (PDV)",
			strings.ToUpper(id[:8]),
			spreadsheetSafe(name),
			"",
			spreadsheetSafe(phone),
			posPaymentMethods[method],
			"Balcão",
			statusLabel,
			paid,
			money(subtotal),
			money(discount),
			money(0),
			money(total),
			spreadsheetSafe(items),
		}); err != nil {
			return nil, err
		}
	}
	if err := posRows.Err(); err != nil {
		return nil, err
	}
	writer.Flush()
	return buf.Bytes(), writer.Error()
}

func paymentLabel(method string) string {
	switch method {
	case "pix":
		return "Pix"
	case "":
		return "Outros"
	}
	return "Cartão (" + method + ")"
}

func deliveryLabel(mode string) string {
	switch mode {
	case "pickup":
		return "Retirada na loja"
	case "local":
		return "Entrega local"
	case "correios":
		return "Correios"
	case "fixed":
		return "Frete fixo"
	case "manual":
		return "A combinar"
	case "":
		return ""
	}
	return mode
}

func orderStatusLabel(orderStatus, paymentStatus string) string {
	if paymentStatus == "rejected" || paymentStatus == "cancelled" || orderStatus == "cancelado" {
		return "Cancelado"
	}
	switch orderStatus {
	case "aguardando_pagamento":
		return "Aguardando pagamento"
	case "pago":
		return "Pago (a enviar)"
	case "enviado":
		return "Enviado"
	case "entregue":
		return "Entregue"
	}
	return orderStatus
}

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

// Pedidos do periodo no fuso da loja. $1 = fuso, $2 = de, $3 = ate.
const reportOrdersCTE = `
	WITH period_orders AS (
		SELECT o.*, (o.created_at AT TIME ZONE $1)::date AS local_date
		FROM orders o
		WHERE (o.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
	)`

type reportSummary struct {
	Revenue       float64 `json:"revenue"`
	Orders        int     `json:"orders"`
	AverageTicket float64 `json:"averageTicket"`
	Items         int     `json:"items"`
	Discount      float64 `json:"discount"`
	Shipping      float64 `json:"shipping"`
	Customers     int     `json:"customers"`
	NewCustomers  int     `json:"newCustomers"`
	Cancelled     int     `json:"cancelled"`
	Pending       int     `json:"pending"`
}

func (s *Service) reportSummary(ctx context.Context, r ReportRange) (reportSummary, error) {
	var summary reportSummary
	err := s.db.QueryRow(ctx, reportOrdersCTE+`
		SELECT
			COALESCE(SUM(o.total_amount) FILTER (WHERE `+paidOrderCondition+`), 0),
			COUNT(*) FILTER (WHERE `+paidOrderCondition+`),
			COALESCE((SELECT SUM(oi.quantity) FROM order_items oi
				JOIN period_orders po ON po.id = oi.order_id
				WHERE po.order_status IN ('pago', 'enviado', 'entregue')), 0),
			COALESCE(SUM(o.discount_amount) FILTER (WHERE `+paidOrderCondition+`), 0),
			COALESCE(SUM(o.shipping_amount) FILTER (WHERE `+paidOrderCondition+`), 0),
			COUNT(DISTINCT o.customer_id) FILTER (WHERE `+paidOrderCondition+`),
			COUNT(*) FILTER (WHERE o.payment_status IN ('rejected', 'cancelled') OR o.order_status = 'cancelado'),
			COUNT(*) FILTER (WHERE o.order_status = 'aguardando_pagamento'
				AND o.payment_status NOT IN ('rejected', 'cancelled'))
		FROM period_orders o`,
		storeTimeZone, r.fromDate(), r.toDate(),
	).Scan(&summary.Revenue, &summary.Orders, &summary.Items, &summary.Discount, &summary.Shipping,
		&summary.Customers, &summary.Cancelled, &summary.Pending)
	if err != nil {
		return summary, err
	}
	if summary.Orders > 0 {
		summary.AverageTicket = summary.Revenue / float64(summary.Orders)
	}
	err = s.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM customers
		WHERE is_fixed_admin = false
		  AND (created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`,
		storeTimeZone, r.fromDate(), r.toDate(),
	).Scan(&summary.NewCustomers)
	return summary, err
}

// reportSeries quebra o periodo em dias (ate ~3 meses) ou em meses.
func (s *Service) reportSeries(ctx context.Context, r ReportRange) ([]map[string]interface{}, error) {
	byMonth := r.Period == "year" || r.To.Sub(r.From) > 93*24*time.Hour
	step, bucket, layout := "1 day", "day", "2006-01-02"
	if byMonth {
		step, bucket, layout = "1 month", "month", "2006-01"
	}

	rows, err := s.db.Query(ctx, reportOrdersCTE+`, buckets AS (
			SELECT generate_series(date_trunc('`+bucket+`', $2::date), $3::date, INTERVAL '`+step+`')::date AS bucket
		)
		SELECT b.bucket, COALESCE(SUM(o.total_amount), 0), COUNT(o.id)
		FROM buckets b
		LEFT JOIN period_orders o
			ON date_trunc('`+bucket+`', o.local_date)::date = b.bucket AND `+paidOrderCondition+`
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
		var revenue float64
		var orders int
		if err := rows.Scan(&day, &revenue, &orders); err != nil {
			return nil, err
		}
		series = append(series, map[string]interface{}{"key": day.Format(layout), "revenue": revenue, "orders": orders})
	}
	return series, rows.Err()
}

// reportBreakdown soma as vendas pagas agrupadas por uma expressao SQL
// (forma de pagamento, forma de entrega).
func (s *Service) reportBreakdown(ctx context.Context, r ReportRange, groupExpr string) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, reportOrdersCTE+`
		SELECT `+groupExpr+` AS grp, COALESCE(SUM(o.total_amount), 0), COUNT(*)
		FROM period_orders o
		WHERE `+paidOrderCondition+`
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
	rows, err := s.db.Query(ctx, reportOrdersCTE+`
		SELECT oi.product_name, COALESCE(MAX(oi.product_image_url), ''), SUM(oi.quantity), SUM(oi.line_total)
		FROM order_items oi
		JOIN period_orders o ON o.id = oi.order_id
		WHERE `+paidOrderCondition+`
		GROUP BY oi.product_name
		ORDER BY SUM(oi.line_total) DESC, SUM(oi.quantity) DESC
		LIMIT 10`,
		storeTimeZone, r.fromDate(), r.toDate())
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

func (s *Service) reportTopCustomers(ctx context.Context, r ReportRange) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, reportOrdersCTE+`
		SELECT c.id::text, COALESCE(c.name, 'Cliente'), COUNT(o.id), SUM(o.total_amount)
		FROM period_orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE `+paidOrderCondition+`
		GROUP BY c.id, c.name
		ORDER BY SUM(o.total_amount) DESC
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

// Agrupamentos usados nos relatorios. Cartao vem com a bandeira (visa,
// master...) em payment_method; tudo que nao e Pix vira "cartao".
const (
	paymentGroupExpr  = `CASE WHEN o.payment_method = 'pix' THEN 'pix' WHEN o.payment_method = '' THEN 'outros' ELSE 'cartao' END`
	deliveryGroupExpr = `CASE WHEN o.delivery_mode = '' THEN 'outros' ELSE o.delivery_mode END`
)

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
	byPayment, err := s.reportBreakdown(ctx, r, paymentGroupExpr)
	if err != nil {
		return nil, err
	}
	byDelivery, err := s.reportBreakdown(ctx, r, deliveryGroupExpr)
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
	rows, err := s.db.Query(ctx, reportOrdersCTE+`
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
	header := []string{"Data", "Pedido", "Cliente", "E-mail", "Telefone", "Pagamento", "Entrega", "Status",
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

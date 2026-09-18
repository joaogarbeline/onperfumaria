package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/models"
	"onperfumaria/backend/internal/payments"
	"onperfumaria/backend/internal/repositories"
	"onperfumaria/backend/internal/shipping"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	cfg      config.Config
	db       *pgxpool.Pool
	repo     *repositories.StoreRepository
	payments payments.Provider
}

var ErrInvalidCredentials = errors.New("e-mail ou senha invalidos")

type shippingRule struct {
	Code         string
	Name         string
	RuleType     string
	Amount       float64
	MinOrder     float64
	WeightMin    int
	WeightMax    int
	RegionPrefix string
}

type CheckoutItem struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

type CheckoutInput struct {
	CustomerID      string         `json:"customerId"`
	CustomerName    string         `json:"customerName"`
	CustomerEmail   string         `json:"customerEmail"`
	CustomerPhone   string         `json:"customerPhone"`
	CustomerCPF     string         `json:"customerCpf"`
	Password        string         `json:"password"`
	CEP             string         `json:"cep"`
	Street          string         `json:"street"`
	Number          string         `json:"number"`
	Neighborhood    string         `json:"neighborhood"`
	City            string         `json:"city"`
	State           string         `json:"state"`
	DeliveryMode    string         `json:"deliveryMode"`
	PaymentMethod   string         `json:"paymentMethod"`
	CouponCode      string         `json:"couponCode"`
	CorreiosPrice   float64        `json:"correiosPrice"`
	Items           []CheckoutItem `json:"items"`
}

type ProductPayload struct {
	Name         string  `json:"name"`
	SKU          string  `json:"sku"`
	Slug         string  `json:"slug"`
	BrandID      string  `json:"brandId"`
	CategoryID   string  `json:"categoryId"`
	Description  string  `json:"description"`
	SalePrice    float64 `json:"salePrice"`
	CostPrice    float64 `json:"costPrice"`
	StockCurrent int     `json:"stockCurrent"`
	StockMinimum int     `json:"stockMinimum"`
	WeightGrams  int     `json:"weightGrams"`
	VolumeML     int     `json:"volumeMl"`
	Gender       string  `json:"gender"`
	ProductType  string  `json:"productType"`
	ImageURL     string  `json:"imageUrl"`
	IsActive     bool    `json:"isActive"`
	IsFeatured   bool    `json:"isFeatured"`
}

type CustomerProfilePayload struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	CPF          string `json:"cpf"`
}

type CustomerAddressPayload struct {
	AddressID    string `json:"addressId"`
	AddressLabel string `json:"addressLabel"`
	CEP          string `json:"cep"`
	Street       string `json:"street"`
	Number       string `json:"number"`
	Neighborhood string `json:"neighborhood"`
	City         string `json:"city"`
	State        string `json:"state"`
	IsDefault    bool   `json:"isDefault"`
}

func NewService(cfg config.Config, db *pgxpool.Pool) *Service {
	svc := &Service{
		cfg:  cfg,
		db:   db,
		repo: repositories.NewStoreRepository(db),
	}

	var mpToken string
	_ = db.QueryRow(context.Background(), `SELECT value FROM settings WHERE key = 'mp_access_token'`).Scan(&mpToken)

	if mpToken != "" {
		svc.payments = payments.NewMercadoPagoProvider(mpToken, cfg.FrontendURL)
	} else {
		svc.payments = payments.MockProvider{}
	}

	return svc
}

func (s *Service) ListProducts(ctx context.Context) ([]models.Product, error) {
	products, err := s.repo.ListProducts(ctx, false)
	if err != nil {
		return nil, err
	}
	return s.decorateProducts(ctx, products)
}

func (s *Service) ListAdminProducts(ctx context.Context) ([]models.Product, error) {
	products, err := s.repo.ListProducts(ctx, true)
	if err != nil {
		return nil, err
	}
	return s.decorateProducts(ctx, products)
}

func (s *Service) GetProduct(ctx context.Context, slug string) (*models.Product, error) {
	product, err := s.repo.GetProductBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return s.decorateProduct(ctx, *product)
}

func (s *Service) GetAdminProduct(ctx context.Context, id string) (*models.Product, error) {
	product, err := s.repo.GetProductByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.decorateProduct(ctx, *product)
}

func (s *Service) StoreHome(ctx context.Context) (map[string]interface{}, error) {
	products, err := s.ListProducts(ctx)
	if err != nil {
		return nil, err
	}

	banner := map[string]string{
		"title":    "",
		"subtitle": "",
		"imageUrl": "",
		"ctaLabel": "Explorar catalogo",
		"ctaLink":  "/catalogo",
	}
	var title, subtitle, imageURL, ctaLabel, ctaLink string
	if err := s.db.QueryRow(ctx, `SELECT title, subtitle, image_url, cta_label, cta_link FROM banners WHERE is_active = true ORDER BY created_at DESC LIMIT 1`).Scan(
		&title,
		&subtitle,
		&imageURL,
		&ctaLabel,
		&ctaLink,
	); err == nil {
		banner["title"] = title
		banner["subtitle"] = subtitle
		banner["imageUrl"] = imageURL
		banner["ctaLabel"] = ctaLabel
		banner["ctaLink"] = ctaLink
	}

	settingsRows, err := s.db.Query(ctx, `SELECT key, value FROM settings WHERE key LIKE 'benefit_%' ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer settingsRows.Close()

	benefits := []string{}
	for settingsRows.Next() {
		var key, value string
		if err := settingsRows.Scan(&key, &value); err != nil {
			return nil, err
		}
		benefits = append(benefits, value)
	}

	featured := make([]models.Product, 0, 4)
	categories := map[string]int{}
	for _, product := range products {
		if product.IsFeatured && len(featured) < 4 {
			featured = append(featured, product)
		}
		categories[product.Category]++
	}

	return map[string]interface{}{
		"hero":       banner,
		"featured":   featured,
		"categories": categories,
		"benefits":   benefits,
	}, nil
}

func (s *Service) ValidateCoupon(ctx context.Context, code string, subtotal float64) (map[string]interface{}, error) {
	if code == "" {
		return nil, errors.New("codigo do cupom obrigatorio")
	}
	var discountType string
	var value float64
	err := s.db.QueryRow(ctx, `SELECT discount_type, value FROM coupons WHERE code = $1 AND is_active = true`, strings.ToUpper(strings.TrimSpace(code))).Scan(&discountType, &value)
	if err != nil {
		return nil, errors.New("cupom invalido ou inativo")
	}
	discount := 0.0
	if discountType == "percent" {
		discount = subtotal * (value / 100)
	} else {
		discount = value
	}
	if discount > subtotal {
		discount = subtotal
	}
	return map[string]interface{}{
		"code":         strings.ToUpper(code),
		"discountType": discountType,
		"value":        value,
		"discount":     discount,
		"subtotal":     subtotal,
		"final":        subtotal - discount,
	}, nil
}

func (s *Service) StoreConfig(ctx context.Context) (map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT code, name, rule_type, amount, COALESCE(min_order_amount, 0), COALESCE(weight_min_grams, 0), COALESCE(weight_max_grams, 0), COALESCE(region_prefix, '') FROM shipping_rules WHERE is_active = true ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules, err := scanShippingRules(rows)
	if err != nil {
		return nil, err
	}
	rules = normalizeShippingRules(rules)

	options := []map[string]string{}
	for _, rule := range rules {
		if rule.RuleType == "weight" || rule.RuleType == "free_over" {
			continue
		}
		options = append(options, map[string]string{"value": rule.Code, "label": rule.Name})
	}
	options = append(options, map[string]string{"value": "correios", "label": "Correios (PAC/SEDEX)"})

	return map[string]interface{}{"shippingOptions": options}, nil
}

func (s *Service) QuoteShipping(ctx context.Context, input shipping.QuoteInput) (shipping.QuoteOutput, error) {
	rows, err := s.db.Query(ctx, `
		SELECT code, name, rule_type, amount, COALESCE(min_order_amount, 0), COALESCE(weight_min_grams, 0), COALESCE(weight_max_grams, 0), COALESCE(region_prefix, '')
		FROM shipping_rules
		WHERE is_active = true`)
	if err != nil {
		return shipping.QuoteOutput{}, err
	}
	defer rows.Close()

	rules, err := scanShippingRules(rows)
	if err != nil {
		return shipping.QuoteOutput{}, err
	}
	rules = normalizeShippingRules(rules)

	if strings.EqualFold(input.City, "CAMPO GRANDE") {
		return shipping.QuoteOutput{Amount: 0, Label: "Frete gratis - Campo Grande"}, nil
	}

	switch input.DeliveryMode {
	case "pickup":
		return findShippingRule(rules, "pickup")
	case "local":
		return findShippingRule(rules, "local")
	case "manual":
		return findShippingRule(rules, "manual")
	}

	for _, current := range rules {
		if current.RuleType == "free_over" && input.Subtotal >= current.MinOrder {
			return shipping.QuoteOutput{Amount: 0, Label: current.Name}, nil
		}
	}

	base := 0.0
	label := "Frete calculado"
	for _, current := range rules {
		if current.RuleType == "fixed" {
			base += current.Amount
			label = current.Name
		}
		if current.RuleType == "weight" && input.WeightGrams >= current.WeightMin && (current.WeightMax == 0 || input.WeightGrams <= current.WeightMax) {
			base += current.Amount
		}
		if current.RegionPrefix != "" && strings.HasPrefix(input.CEP, current.RegionPrefix) && current.RuleType == "local" && input.DeliveryMode == "fixed" {
			base = current.Amount
			label = current.Name
		}
	}

	return shipping.QuoteOutput{Amount: base, Label: label}, nil
}

func (s *Service) CustomerRegister(ctx context.Context, name, email, password, phone, cpf string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	var id string
	err = s.db.QueryRow(ctx, `
		INSERT INTO customers (name, email, phone, cpf, password_hash)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, cpf = EXCLUDED.cpf
		RETURNING id::text`, name, email, phone, cpf, string(hash)).Scan(&id)
	if err != nil {
		return "", err
	}

	return auth.GenerateToken(s.cfg.JWTSecret, id, "customer", "customer", 72*time.Hour)
}

func (s *Service) CustomerLogin(ctx context.Context, email, password string) (string, error) {
	var id, hash string
	err := s.db.QueryRow(ctx, `SELECT id::text, password_hash FROM customers WHERE email = $1`, email).Scan(&id, &hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}
	return auth.GenerateToken(s.cfg.JWTSecret, id, "customer", "customer", 72*time.Hour)
}

func (s *Service) CustomerProfile(ctx context.Context, customerID string) (map[string]interface{}, error) {
	var name, email, phone, cpf string
	err := s.db.QueryRow(ctx, `SELECT name, email, phone, COALESCE(cpf, '') FROM customers WHERE id = $1`, customerID).Scan(&name, &email, &phone, &cpf)
	if err != nil {
		return nil, err
	}

	addressRows, err := s.db.Query(ctx, `SELECT id::text, label, cep, street, number, neighborhood, city, state, is_default FROM addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC`, customerID)
	if err != nil {
		return nil, err
	}
	defer addressRows.Close()

	addresses := []map[string]interface{}{}
	for addressRows.Next() {
		var id, label, cep, street, number, neighborhood, city, state string
		var isDefault bool
		if err := addressRows.Scan(&id, &label, &cep, &street, &number, &neighborhood, &city, &state, &isDefault); err != nil {
			return nil, err
		}
		addresses = append(addresses, map[string]interface{}{
			"id": id, "label": label, "cep": cep, "street": street, "number": number, "neighborhood": neighborhood, "city": city, "state": state, "isDefault": isDefault,
		})
	}

	ordersRows, err := s.db.Query(ctx, `SELECT id::text, total_amount, payment_status, order_status, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`, customerID)
	if err != nil {
		return nil, err
	}
	defer ordersRows.Close()

	orders := []map[string]interface{}{}
	for ordersRows.Next() {
		var id, paymentStatus, orderStatus string
		var total float64
		var createdAt time.Time
		if err := ordersRows.Scan(&id, &total, &paymentStatus, &orderStatus, &createdAt); err != nil {
			return nil, err
		}
		orders = append(orders, map[string]interface{}{
			"id": id, "total": total, "paymentStatus": paymentStatus, "orderStatus": orderStatus, "createdAt": createdAt,
		})
	}

	return map[string]interface{}{
		"name": name, "email": email, "phone": phone, "cpf": cpf, "addresses": addresses, "orders": orders,
	}, nil
}

func (s *Service) UpdateCustomerProfile(ctx context.Context, customerID string, payload CustomerProfilePayload) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE customers SET name = $1, email = $2, phone = $3, cpf = $4 WHERE id = $5`,
		payload.Name, payload.Email, payload.Phone, payload.CPF, customerID,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.CustomerProfile(ctx, customerID)
}

func (s *Service) SaveCustomerAddress(ctx context.Context, customerID string, payload CustomerAddressPayload) (map[string]interface{}, error) {
	if payload.CEP == "" || payload.Street == "" || payload.Number == "" || payload.Neighborhood == "" {
		return nil, errors.New("preencha os campos obrigatorios do endereco")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if payload.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = false WHERE customer_id = $1`, customerID); err != nil {
			return nil, err
		}
	}

	if payload.AddressID != "" {
		_, err = tx.Exec(ctx, `
			UPDATE addresses
			SET label = $1, cep = $2, street = $3, number = $4, neighborhood = $5, city = $6, state = $7, is_default = $8
			WHERE id = $9 AND customer_id = $10`,
			defaultString(payload.AddressLabel, "Principal"),
			payload.CEP,
			payload.Street,
			payload.Number,
			payload.Neighborhood,
			defaultString(payload.City, "Campo Grande"),
			defaultString(payload.State, "MS"),
			payload.IsDefault,
			payload.AddressID,
			customerID,
		)
	} else {
		var hasDefault bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE customer_id = $1 AND is_default = true)`, customerID).Scan(&hasDefault); err != nil {
			return nil, err
		}
		isDefault := payload.IsDefault || !hasDefault
		_, err = tx.Exec(ctx, `
			INSERT INTO addresses (customer_id, label, cep, street, number, neighborhood, city, state, is_default)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			customerID,
			defaultString(payload.AddressLabel, "Principal"),
			payload.CEP,
			payload.Street,
			payload.Number,
			payload.Neighborhood,
			defaultString(payload.City, "Campo Grande"),
			defaultString(payload.State, "MS"),
			isDefault,
		)
	}
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.CustomerProfile(ctx, customerID)
}

func (s *Service) SetDefaultCustomerAddress(ctx context.Context, customerID, addressID string) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE id = $1 AND customer_id = $2)`, addressID, customerID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("endereco nao encontrado")
	}

	if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = false WHERE customer_id = $1`, customerID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = true WHERE id = $1 AND customer_id = $2`, addressID, customerID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.CustomerProfile(ctx, customerID)
}

func (s *Service) AdminLogin(ctx context.Context, email, password string) (string, error) {
	var id, role, hash string
	err := s.db.QueryRow(ctx, `SELECT id::text, role, password_hash FROM users_admin WHERE email = $1`, email).Scan(&id, &role, &hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}
	return auth.GenerateToken(s.cfg.JWTSecret, id, role, "admin", 24*time.Hour)
}

func (s *Service) CreateOrder(ctx context.Context, input CheckoutInput) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	customerID, err := s.ensureCustomer(ctx, tx, input.CustomerID, input.CustomerName, input.CustomerEmail, input.CustomerPhone, input.CustomerCPF, input.Password)
	if err != nil {
		return nil, err
	}

	addressID, err := s.ensureAddress(ctx, tx, customerID, input.CEP, input.Street, input.Number, input.Neighborhood, input.City, input.State)
	if err != nil {
		return nil, err
	}

	type itemSummary struct {
		ProductID string
		Name      string
		UnitPrice float64
		Quantity  int
		LineTotal float64
		Weight    int
	}

	subtotal := 0.0
	weight := 0
	orderItems := make([]itemSummary, 0, len(input.Items))
	for _, item := range input.Items {
		product, err := s.repo.GetProductByID(ctx, item.ProductID)
		if err != nil {
			return nil, err
		}
		product, err = s.decorateProduct(ctx, *product)
		if err != nil {
			return nil, err
		}
		if !product.IsActive || !product.IsAvailable || product.StockCurrent < item.Quantity {
			return nil, fmt.Errorf("estoque insuficiente para %s", product.Name)
		}

		lineTotal := product.FinalPrice * float64(item.Quantity)
		subtotal += lineTotal
		weight += product.WeightGrams * item.Quantity
		orderItems = append(orderItems, itemSummary{
			ProductID: product.ID,
			Name:      product.Name,
			UnitPrice: product.FinalPrice,
			Quantity:  item.Quantity,
			LineTotal: lineTotal,
			Weight:    product.WeightGrams,
		})
	}

	discount := 0.0
	if input.CouponCode != "" {
		var couponType string
		var value float64
		err := tx.QueryRow(ctx, `SELECT discount_type, value FROM coupons WHERE code = $1 AND is_active = true`, strings.ToUpper(input.CouponCode)).Scan(&couponType, &value)
		if err == nil {
			if couponType == "percent" {
				discount = subtotal * (value / 100)
			} else {
				discount = value
			}
		}
	}

	var shippingAmount float64
	if input.DeliveryMode == "correios" && input.CorreiosPrice > 0 {
		shippingAmount = input.CorreiosPrice
	} else {
		shippingQuote, err := s.QuoteShipping(ctx, shipping.QuoteInput{
			CEP:          input.CEP,
			WeightGrams:  weight,
			Subtotal:     subtotal - discount,
			DeliveryMode: input.DeliveryMode,
			City:         input.City,
		})
		if err != nil {
			return nil, err
		}
		shippingAmount = shippingQuote.Amount
	}

	total := subtotal - discount + shippingAmount
	paymentResult, err := s.payments.CreatePayment(total, input.PaymentMethod)
	if err != nil {
		return nil, err
	}

	mpPreferenceID := paymentResult.ProviderRef
	orderStatus := mapPaymentToOrderStatus(paymentResult.Status)
	origin := "online"

	var orderID string
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (customer_id, address_id, subtotal, shipping_amount, discount_amount, total_amount, payment_method, payment_status, order_status, origin, mp_preference_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id::text`,
		customerID, addressID, subtotal, shippingAmount, discount, total, input.PaymentMethod, paymentResult.Status, orderStatus, origin, mpPreferenceID,
	).Scan(&orderID)
	if err != nil {
		return nil, err
	}

	for _, item := range orderItems {
		if _, err := tx.Exec(ctx, `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, $5, $6)`,
			orderID, item.ProductID, item.Name, item.UnitPrice, item.Quantity, item.LineTotal); err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `INSERT INTO payments (order_id, provider, provider_reference, amount, status) VALUES ($1, 'mercadopago', $2, $3, $4)`,
		orderID, mpPreferenceID, total, paymentResult.Status); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"orderId": orderID, "paymentStatus": paymentResult.Status, "orderStatus": orderStatus,
		"shippingAmount": shippingAmount, "discount": discount, "total": total,
		"paymentUrl": paymentResult.PaymentURL,
	}, nil
}

func (s *Service) Dashboard(ctx context.Context) (models.Dashboard, error) {
	var dashboard models.Dashboard
	err := s.db.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT SUM(total_amount) FROM orders WHERE DATE(created_at) = CURRENT_DATE), 0)
				+ COALESCE((SELECT SUM(total_amount) FROM pos_sales WHERE DATE(created_at) = CURRENT_DATE), 0),
			COALESCE((SELECT SUM(total_amount) FROM orders WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0)
				+ COALESCE((SELECT SUM(total_amount) FROM pos_sales WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0),
			COALESCE((SELECT COUNT(*) FROM orders WHERE order_status = 'aguardando_pagamento'), 0),
			COALESCE((SELECT COUNT(*) FROM orders WHERE payment_status = 'paid'), 0)
				+ COALESCE((SELECT COUNT(*) FROM pos_sales), 0),
			(SELECT COUNT(*) FROM products WHERE stock_current <= stock_minimum),
			(SELECT COUNT(*) FROM customers)`).Scan(
		&dashboard.RevenueToday,
		&dashboard.RevenueMonth,
		&dashboard.PendingOrders,
		&dashboard.PaidOrders,
		&dashboard.LowStockProducts,
		&dashboard.Customers,
	)
	return dashboard, err
}

func (s *Service) Customers(ctx context.Context, search string) ([]map[string]interface{}, error) {
	var rows pgx.Rows
	var err error
	if search != "" {
		like := "%" + search + "%"
		rows, err = s.db.Query(ctx, `SELECT id::text, name, email, phone, COALESCE(cpf, ''), created_at FROM customers WHERE name ILIKE $1 OR phone ILIKE $1 ORDER BY name LIMIT 30`, like)
	} else {
		rows, err = s.db.Query(ctx, `SELECT id::text, name, email, phone, COALESCE(cpf, ''), created_at FROM customers ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers := []map[string]interface{}{}
	for rows.Next() {
		var id, name, email, phone, cpf string
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &email, &phone, &cpf, &createdAt); err != nil {
			return nil, err
		}
		customers = append(customers, map[string]interface{}{"id": id, "name": name, "email": email, "phone": phone, "cpf": cpf, "createdAt": createdAt})
	}
	return customers, rows.Err()
}

func (s *Service) ProductOptions(ctx context.Context) (map[string]interface{}, error) {
	brandsRows, err := s.db.Query(ctx, `SELECT id::text, name FROM brands ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer brandsRows.Close()

	categoriesRows, err := s.db.Query(ctx, `SELECT id::text, name FROM categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer categoriesRows.Close()

	brands := []map[string]string{}
	for brandsRows.Next() {
		var id, name string
		if err := brandsRows.Scan(&id, &name); err != nil {
			return nil, err
		}
		brands = append(brands, map[string]string{"id": id, "name": name})
	}

	categories := []map[string]string{}
	for categoriesRows.Next() {
		var id, name string
		if err := categoriesRows.Scan(&id, &name); err != nil {
			return nil, err
		}
		categories = append(categories, map[string]string{"id": id, "name": name})
	}

	return map[string]interface{}{"brands": brands, "categories": categories}, nil
}

func (s *Service) CatalogOptions(ctx context.Context) (map[string]interface{}, error) {
	result, err := s.ProductOptions(ctx)
	if err != nil {
		return nil, err
	}
	types, err := s.GetProductTypes(ctx)
	if err != nil {
		return nil, err
	}
	result["productTypes"] = types
	return result, nil
}

func (s *Service) SaveProduct(ctx context.Context, id string, payload ProductPayload) (map[string]interface{}, error) {
	if payload.Name == "" || payload.SKU == "" || payload.BrandID == "" || payload.CategoryID == "" {
		return nil, errors.New("preencha os campos obrigatorios do produto")
	}

	if payload.Slug == "" {
		payload.Slug = slugify(payload.Name)
	}

	if id == "" {
		err := s.db.QueryRow(ctx, `
			INSERT INTO products (name, sku, slug, brand_id, category_id, description, sale_price, cost_price, profit_margin, stock_current, stock_minimum, weight_grams, volume_ml, gender, product_type, image_url, is_active, is_featured)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = 0 THEN 0 ELSE (($7 - $8) / $8) * 100 END, $9, $10, $11, $12, $13, $14, $15, $16, $17)
			RETURNING id::text`,
			payload.Name, strings.ToUpper(payload.SKU), payload.Slug, payload.BrandID, payload.CategoryID, payload.Description, payload.SalePrice, payload.CostPrice, payload.StockCurrent,
			payload.StockMinimum, payload.WeightGrams, payload.VolumeML, payload.Gender, payload.ProductType, payload.ImageURL, payload.IsActive, payload.IsFeatured,
		).Scan(&id)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.db.Exec(ctx, `
			UPDATE products
			SET name = $2,
				sku = $3,
				slug = $4,
				brand_id = $5,
				category_id = $6,
				description = $7,
				sale_price = $8,
				cost_price = $9,
				profit_margin = CASE WHEN $9 = 0 THEN 0 ELSE (($8 - $9) / $9) * 100 END,
				stock_current = $10,
				stock_minimum = $11,
				weight_grams = $12,
				volume_ml = $13,
				gender = $14,
				product_type = $15,
				image_url = $16,
				is_active = $17,
				is_featured = $18
			WHERE id = $1`,
			id, payload.Name, strings.ToUpper(payload.SKU), payload.Slug, payload.BrandID, payload.CategoryID, payload.Description, payload.SalePrice, payload.CostPrice, payload.StockCurrent,
			payload.StockMinimum, payload.WeightGrams, payload.VolumeML, payload.Gender, payload.ProductType, payload.ImageURL, payload.IsActive, payload.IsFeatured,
		)
		if err != nil {
			return nil, err
		}
	}

	product, err := s.GetAdminProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"product": product}, nil
}

func (s *Service) DeactivateProduct(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `UPDATE products SET is_active = false WHERE id = $1`, id)
	return err
}

func (s *Service) POSSale(ctx context.Context, customerName, paymentMethod string, discount float64, items []CheckoutItem) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	type posItem struct {
		ProductID string
		Name      string
		Price     float64
		Quantity  int
	}

	total := 0.0
	posItems := []posItem{}
	for _, item := range items {
		product, err := s.repo.GetProductByID(ctx, item.ProductID)
		if err != nil {
			return nil, err
		}
		product, err = s.decorateProduct(ctx, *product)
		if err != nil {
			return nil, err
		}
		if !product.IsAvailable || product.StockCurrent < item.Quantity {
			return nil, fmt.Errorf("estoque insuficiente para %s", product.Name)
		}
		total += product.FinalPrice * float64(item.Quantity)
		posItems = append(posItems, posItem{ProductID: product.ID, Name: product.Name, Price: product.FinalPrice, Quantity: item.Quantity})
	}

	total -= discount
	if total < 0 {
		total = 0
	}

	if customerName == "" {
		customerName = "Consumidor Final"
	}

	var saleID string
	if err := tx.QueryRow(ctx, `INSERT INTO pos_sales (customer_name, payment_method, discount_amount, total_amount) VALUES ($1, $2, $3, $4) RETURNING id::text`,
		customerName, paymentMethod, discount, total).Scan(&saleID); err != nil {
		return nil, err
	}

	for _, item := range posItems {
		if _, err := tx.Exec(ctx, `INSERT INTO pos_sale_items (sale_id, product_id, product_name, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, $5, $6)`,
			saleID, item.ProductID, item.Name, item.Price, item.Quantity, item.Price*float64(item.Quantity)); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE products SET stock_current = stock_current - $2 WHERE id = $1 AND stock_current >= $2`, item.ProductID, item.Quantity); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO stock_movements (product_id, movement_type, quantity, reason) VALUES ($1, 'sale', $2, 'Venda PDV')`, item.ProductID, item.Quantity); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]interface{}{"saleId": saleID, "total": total, "status": "paid"}, nil
}

func (s *Service) decorateProducts(ctx context.Context, products []models.Product) ([]models.Product, error) {
	decorated := make([]models.Product, 0, len(products))
	for _, product := range products {
		enriched, err := s.decorateProduct(ctx, product)
		if err != nil {
			return nil, err
		}
		s.loadImages(ctx, enriched)
		decorated = append(decorated, *enriched)
	}
	return decorated, nil
}

func (s *Service) loadImages(ctx context.Context, product *models.Product) {
	rows, err := s.db.Query(ctx, `SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY created_at`, product.ID)
	if err != nil {
		return
	}
	defer rows.Close()
	images := []string{}
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err != nil {
			continue
		}
		images = append(images, url)
	}
	product.Images = images
	if len(images) > 0 && product.ImageURL == "" {
		product.ImageURL = images[0]
	}
}

func (s *Service) decorateProduct(ctx context.Context, product models.Product) (*models.Product, error) {
	finalPrice := product.SalePrice
	discountAmount := 0.0
	discountLabel := ""

	if product.PromotionalPrice != nil && *product.PromotionalPrice < finalPrice {
		finalPrice = *product.PromotionalPrice
		discountAmount = product.SalePrice - *product.PromotionalPrice
		discountLabel = "Promocao especial"
	}

	rows, err := s.db.Query(ctx, `
		SELECT name, target_type, discount_type, value
		FROM discount_rules
		WHERE is_active = true
		  AND (
			target_type = 'all'
			OR (target_type = 'product' AND target_id::text = $1)
			OR (target_type = 'brand' AND target_id::text = $2)
			OR (target_type = 'category' AND target_id::text = $3)
		  )`, product.ID, product.BrandID, product.CategoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bestFinal := finalPrice
	bestDiscount := discountAmount
	bestLabel := discountLabel
	for rows.Next() {
		var name, targetType, discountType string
		var value float64
		if err := rows.Scan(&name, &targetType, &discountType, &value); err != nil {
			return nil, err
		}
		candidate := product.SalePrice
		if discountType == "percent" {
			candidate = product.SalePrice * (1 - value/100)
		}
		if discountType == "fixed" {
			candidate = product.SalePrice - value
		}
		if candidate < 0 {
			candidate = 0
		}
		if candidate < bestFinal {
			bestFinal = candidate
			bestDiscount = product.SalePrice - candidate
			bestLabel = name
		}
	}

	product.FinalPrice = bestFinal
	product.AutomaticDiscountAmount = bestDiscount
	product.DiscountLabel = bestLabel
	product.IsAvailable = product.IsActive && product.StockCurrent > 0
	return &product, nil
}

func (s *Service) ensureCustomer(ctx context.Context, tx pgx.Tx, customerID, name, email, phone, cpf, password string) (string, error) {
	if customerID != "" {
		var id string
		err := tx.QueryRow(ctx, `SELECT id::text FROM customers WHERE id = $1`, customerID).Scan(&id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", errors.New("cliente autenticado nao encontrado")
			}
			return "", err
		}
		_, updateErr := tx.Exec(ctx, `UPDATE customers SET name = $1, email = $2, phone = $3, cpf = $4 WHERE id = $5`, name, email, phone, cpf, id)
		return id, updateErr
	}

	var id string
	err := tx.QueryRow(ctx, `SELECT id::text FROM customers WHERE email = $1`, email).Scan(&id)
	if err == nil {
		_, updateErr := tx.Exec(ctx, `UPDATE customers SET name = $1, phone = $2, cpf = $3 WHERE id = $4`, name, phone, cpf, id)
		return id, updateErr
	}
	if err != pgx.ErrNoRows {
		return "", err
	}
	if password == "" {
		return "", errors.New("senha obrigatoria para novo cadastro")
	}

	hash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if hashErr != nil {
		return "", hashErr
	}
	err = tx.QueryRow(ctx, `INSERT INTO customers (name, email, phone, cpf, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
		name, email, phone, cpf, string(hash)).Scan(&id)
	return id, err
}

func (s *Service) ensureAddress(ctx context.Context, tx pgx.Tx, customerID, cep, street, number, neighborhood, city, state string) (string, error) {
	if city == "" {
		city = "Campo Grande"
	}
	if state == "" {
		state = "MS"
	}
	var existingID string
	err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM addresses
		WHERE customer_id = $1
		  AND cep = $2
		  AND street = $3
		  AND number = $4
		  AND neighborhood = $5
		  AND city = $6
		  AND state = $7
		ORDER BY is_default DESC, created_at DESC
		LIMIT 1`,
		customerID, cep, street, number, neighborhood, city, state,
	).Scan(&existingID)
	if err == nil {
		return existingID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	var hasDefault bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE customer_id = $1 AND is_default = true)`, customerID).Scan(&hasDefault); err != nil {
		return "", err
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO addresses (customer_id, label, cep, street, number, neighborhood, city, state, is_default)
		VALUES ($1, 'Principal', $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text`, customerID, cep, street, number, neighborhood, city, state, !hasDefault).Scan(&id)
	return id, err
}

func mapPaymentToOrderStatus(paymentStatus string) string {
	if paymentStatus == "paid" || paymentStatus == "approved" {
		return "pago"
	}
	return "aguardando_pagamento"
}

func (s *Service) HandleMPWebhook(ctx context.Context, topic string, paymentID string) error {
	if topic != "payment" {
		return nil
	}

	mpAccessToken, err := s.GetMPSetting(ctx, "mp_access_token")
	if err != nil || mpAccessToken == "" {
		return fmt.Errorf("mercado pago nao configurado")
	}

	req, _ := http.NewRequest("GET", "https://api.mercadopago.com/v1/payments/"+paymentID, nil)
	req.Header.Set("Authorization", "Bearer "+mpAccessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var payment struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
		Order  struct {
			Type string `json:"type"`
			ID   string `json:"id"`
		} `json:"order"`
		ExternalReference string `json:"external_reference"`
	}
	if err := json.Unmarshal(respBody, &payment); err != nil {
		return err
	}

	if payment.Status != "approved" {
		return nil
	}

	result, err := s.db.Exec(ctx, `
		UPDATE orders
		SET payment_status = 'paid', order_status = 'pago', mp_payment_id = $2
		WHERE payment_status = 'pending' AND mp_preference_id = $3`,
		paymentID, payment.ExternalReference)

	if err != nil {
		return err
	}

	if result.RowsAffected() > 0 {
		s.updateStockForOrder(ctx, payment.ExternalReference)
	}

	return nil
}

func (s *Service) updateStockForOrder(ctx context.Context, orderID string) {
	rows, err := s.db.Query(ctx, `SELECT product_id, quantity FROM order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var productID string
		var quantity int
		if err := rows.Scan(&productID, &quantity); err != nil {
			continue
		}
		s.db.Exec(ctx, `UPDATE products SET stock_current = stock_current - $2 WHERE id = $1 AND stock_current >= $2`, productID, quantity)
		s.db.Exec(ctx, `INSERT INTO stock_movements (product_id, movement_type, quantity, reason) VALUES ($1, 'sale', $2, 'Venda online MP')`, productID, quantity)
	}
}

func (s *Service) GetMPSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.Query(ctx, `SELECT key, value FROM settings WHERE key IN ('mp_access_token', 'mp_public_key', 'mp_webhook_secret')`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		settings[key] = value
	}
	if _, ok := settings["mp_access_token"]; !ok {
		settings["mp_access_token"] = ""
	}
	if _, ok := settings["mp_public_key"]; !ok {
		settings["mp_public_key"] = ""
	}
	if _, ok := settings["mp_webhook_secret"]; !ok {
		settings["mp_webhook_secret"] = ""
	}
	return settings, nil
}

func (s *Service) SaveMPSetting(ctx context.Context, key, value string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, key, value)
	return err
}

func (s *Service) GetMPSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&value)
	return value, err
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	replacements := []string{" ", "-", "/", "-", "_", "-"}
	for index := 0; index < len(replacements); index += 2 {
		value = strings.ReplaceAll(value, replacements[index], replacements[index+1])
	}
	return value
}

func findShippingRule(rules []shippingRule, ruleType string) (shipping.QuoteOutput, error) {
	for _, current := range rules {
		if current.RuleType == ruleType || current.Code == ruleType {
			return shipping.QuoteOutput{Amount: current.Amount, Label: current.Name}, nil
		}
	}
	return shipping.QuoteOutput{}, fmt.Errorf("regra de frete %s nao encontrada", ruleType)
}

type OrderFilter struct {
	Search    string `json:"search"`
	Status    string `json:"status"`
	Payment   string `json:"payment"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Page      int    `json:"page"`
	Limit     int    `json:"limit"`
}

func (s *Service) Orders(ctx context.Context, filter OrderFilter) (map[string]interface{}, error) {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	offset := (filter.Page - 1) * filter.Limit

	where := []string{}
	args := []interface{}{}
	argIndex := 1

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(customer_name ILIKE $%d OR id::text ILIKE $%d)", argIndex, argIndex+1))
		likePattern := "%" + filter.Search + "%"
		args = append(args, likePattern, likePattern)
		argIndex += 2
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf("order_status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}
	if filter.Payment != "" {
		where = append(where, fmt.Sprintf("payment_status = $%d", argIndex))
		args = append(args, filter.Payment)
		argIndex++
	}
	if filter.StartDate != "" {
		where = append(where, fmt.Sprintf("created_at::date >= $%d::date", argIndex))
		args = append(args, filter.StartDate)
		argIndex++
	}
	if filter.EndDate != "" {
		where = append(where, fmt.Sprintf("created_at::date <= $%d::date", argIndex))
		args = append(args, filter.EndDate)
		argIndex++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	countSQL := `SELECT COUNT(*) FROM (
		SELECT o.id, c.name as customer_name, o.total_amount, o.payment_status, o.order_status, o.created_at, COALESCE(o.origin, 'online') as origin
		FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
		UNION ALL
		SELECT ps.id, ps.customer_name, ps.total_amount, 'paid', 'pago', ps.created_at, 'pdv'
		FROM pos_sales ps
	) combined ` + whereClause
	var total int
	if err := s.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, err
	}

	query := fmt.Sprintf(`
		SELECT id::text, customer_name, total_amount, payment_status, order_status, created_at, origin
		FROM (
			SELECT o.id, c.name as customer_name, o.total_amount, o.payment_status, o.order_status, o.created_at, COALESCE(o.origin, 'online') as origin
			FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
			UNION ALL
			SELECT ps.id, ps.customer_name, ps.total_amount, 'paid', 'pago', ps.created_at, 'pdv'
			FROM pos_sales ps
		) combined
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, argIndex, argIndex+1)

	queryArgs := append(args, filter.Limit, offset)
	rows, err := s.db.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []map[string]interface{}{}
	for rows.Next() {
		var id, name, paymentStatus, orderStatus, origin string
		var totalAmount float64
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &totalAmount, &paymentStatus, &orderStatus, &createdAt, &origin); err != nil {
			return nil, err
		}
		orders = append(orders, map[string]interface{}{
			"id": id, "customerName": name, "total": totalAmount, "paymentStatus": paymentStatus, "orderStatus": orderStatus, "createdAt": createdAt, "origin": origin,
		})
	}

	return map[string]interface{}{"orders": orders, "total": total, "page": filter.Page, "limit": filter.Limit}, rows.Err()
}

func (s *Service) ListBrands(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text, name, slug FROM brands ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	brands := []map[string]interface{}{}
	for rows.Next() {
		var id, name, slug string
		if err := rows.Scan(&id, &name, &slug); err != nil {
			return nil, err
		}
		brands = append(brands, map[string]interface{}{"id": id, "name": name, "slug": slug})
	}
	return brands, rows.Err()
}

func (s *Service) SaveBrand(ctx context.Context, id, name string) (map[string]interface{}, error) {
	if name == "" {
		return nil, errors.New("nome da marca obrigatorio")
	}
	slug := slugify(name)
	if id == "" {
		if err := s.db.QueryRow(ctx, `INSERT INTO brands (name, slug) VALUES ($1, $2) RETURNING id::text`, name, slug).Scan(&id); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.db.Exec(ctx, `UPDATE brands SET name = $2, slug = $3 WHERE id = $1`, id, name, slug); err != nil {
			return nil, err
		}
	}
	rows, err := s.db.Query(ctx, `SELECT id::text, name, slug FROM brands WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if rows.Next() {
		var resultID, resultName, resultSlug string
		rows.Scan(&resultID, &resultName, &resultSlug)
		return map[string]interface{}{"id": resultID, "name": resultName, "slug": resultSlug}, nil
	}
	return nil, errors.New("marca nao encontrada apos salvar")
}

func (s *Service) DeleteBrand(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM brands WHERE id = $1`, id)
	return err
}

func (s *Service) ListCategories(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text, name, slug FROM categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := []map[string]interface{}{}
	for rows.Next() {
		var id, name, slug string
		if err := rows.Scan(&id, &name, &slug); err != nil {
			return nil, err
		}
		categories = append(categories, map[string]interface{}{"id": id, "name": name, "slug": slug})
	}
	return categories, rows.Err()
}

func (s *Service) SaveCategory(ctx context.Context, id, name string) (map[string]interface{}, error) {
	if name == "" {
		return nil, errors.New("nome da categoria obrigatorio")
	}
	slug := slugify(name)
	if id == "" {
		if err := s.db.QueryRow(ctx, `INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id::text`, name, slug).Scan(&id); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.db.Exec(ctx, `UPDATE categories SET name = $2, slug = $3 WHERE id = $1`, id, name, slug); err != nil {
			return nil, err
		}
	}
	rows, err := s.db.Query(ctx, `SELECT id::text, name, slug FROM categories WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if rows.Next() {
		var resultID, resultName, resultSlug string
		rows.Scan(&resultID, &resultName, &resultSlug)
		return map[string]interface{}{"id": resultID, "name": resultName, "slug": resultSlug}, nil
	}
	return nil, errors.New("categoria nao encontrada apos salvar")
}

func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM categories WHERE id = $1`, id)
	return err
}

func (s *Service) GetProductTypes(ctx context.Context) ([]string, error) {
	var value string
	err := s.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'product_types'`).Scan(&value)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []string{"Importado", "Arabe", "Nacional", "Tester", "Decant"}, nil
		}
		return nil, err
	}
	var types []string
	if err := json.Unmarshal([]byte(value), &types); err != nil {
		return nil, err
	}
	return types, nil
}

func (s *Service) UpdateProductTypes(ctx context.Context, types []string) ([]string, error) {
	data, err := json.Marshal(types)
	if err != nil {
		return nil, err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO settings (key, value) VALUES ('product_types', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, string(data))
	if err != nil {
		return nil, err
	}
	return types, nil
}

func (s *Service) UpdateOrderStatus(ctx context.Context, orderID, newStatus string) error {
	validStatuses := map[string]string{
		"pago":     "aguardando_pagamento",
		"enviado":  "pago",
		"entregue": "enviado",
	}
	requiredPrev, ok := validStatuses[newStatus]
	if !ok {
		return fmt.Errorf("status invalido: %s", newStatus)
	}

	result, err := s.db.Exec(ctx, `UPDATE orders SET order_status = $2 WHERE id = $1 AND order_status = $3 AND payment_status = 'paid'`, orderID, newStatus, requiredPrev)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("transicao de status nao permitida")
	}
	return nil
}

func (s *Service) ListCoupons(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text, code, discount_type, value, is_active FROM coupons ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	coupons := []map[string]interface{}{}
	for rows.Next() {
		var id, code, discountType string
		var value float64
		var isActive bool
		if err := rows.Scan(&id, &code, &discountType, &value, &isActive); err != nil {
			return nil, err
		}
		coupons = append(coupons, map[string]interface{}{"id": id, "code": code, "discountType": discountType, "value": value, "isActive": isActive})
	}
	return coupons, rows.Err()
}

func (s *Service) SaveCoupon(ctx context.Context, id, code, discountType string, value float64, isActive bool) (map[string]interface{}, error) {
	if code == "" || discountType == "" {
		return nil, errors.New("codigo e tipo obrigatorios")
	}
	code = strings.ToUpper(code)
	if id == "" {
		if err := s.db.QueryRow(ctx, `INSERT INTO coupons (code, discount_type, value, is_active) VALUES ($1, $2, $3, $4) RETURNING id::text`, code, discountType, value, isActive).Scan(&id); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.db.Exec(ctx, `UPDATE coupons SET code = $2, discount_type = $3, value = $4, is_active = $5 WHERE id = $1`, id, code, discountType, value, isActive); err != nil {
			return nil, err
		}
	}
	return map[string]interface{}{"id": id, "code": code, "discountType": discountType, "value": value, "isActive": isActive}, nil
}

func (s *Service) DeleteCoupon(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM coupons WHERE id = $1`, id)
	return err
}

func (s *Service) ListDiscountRules(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT dr.id::text, dr.name, dr.target_type, COALESCE(dr.target_id::text, ''), dr.discount_type, dr.value, dr.is_active, COALESCE(b.name, c.name, 'Todos') as target_name FROM discount_rules dr LEFT JOIN brands b ON dr.target_type = 'brand' AND b.id = dr.target_id LEFT JOIN categories c ON dr.target_type = 'category' AND c.id = dr.target_id ORDER BY dr.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rules := []map[string]interface{}{}
	for rows.Next() {
		var id, name, targetType, targetID, discountType, targetName string
		var value float64
		var isActive bool
		if err := rows.Scan(&id, &name, &targetType, &targetID, &discountType, &value, &isActive, &targetName); err != nil {
			return nil, err
		}
		rules = append(rules, map[string]interface{}{"id": id, "name": name, "targetType": targetType, "targetId": targetID, "discountType": discountType, "value": value, "isActive": isActive, "targetName": targetName})
	}
	return rules, rows.Err()
}

func (s *Service) SaveDiscountRule(ctx context.Context, id, name, targetType, targetID, discountType string, value float64, isActive bool) (map[string]interface{}, error) {
	if name == "" || targetType == "" {
		return nil, errors.New("nome e tipo de alvo obrigatorios")
	}
	var tid interface{}
	if targetID == "" {
		tid = nil
	} else {
		tid = targetID
	}
	if id == "" {
		if err := s.db.QueryRow(ctx, `INSERT INTO discount_rules (name, target_type, target_id, discount_type, value, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text`, name, targetType, tid, discountType, value, isActive).Scan(&id); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.db.Exec(ctx, `UPDATE discount_rules SET name = $2, target_type = $3, target_id = $4, discount_type = $5, value = $6, is_active = $7 WHERE id = $1`, id, name, targetType, tid, discountType, value, isActive); err != nil {
			return nil, err
		}
	}
	return map[string]interface{}{"id": id, "name": name, "targetType": targetType, "discountType": discountType, "value": value, "isActive": isActive}, nil
}

func (s *Service) DeleteDiscountRule(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM discount_rules WHERE id = $1`, id)
	return err
}

func (s *Service) ExportOrdersCSV(ctx context.Context) ([]byte, error) {
	rows, err := s.db.Query(ctx, `SELECT o.id::text, COALESCE(c.name, 'Consumidor Final'), o.total_amount, o.payment_status, o.order_status, o.origin, o.created_at FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buf bytes.Buffer
	buf.WriteString("ID,Cliente,Total,Status Pagamento,Status Pedido,Origem,Data\n")
	for rows.Next() {
		var id, name, paymentStatus, orderStatus, origin string
		var total float64
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &total, &paymentStatus, &orderStatus, &origin, &createdAt); err != nil {
			continue
		}
		buf.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,%s,%s,%s\n", id[:8], strings.ReplaceAll(name, ",", " "), total, paymentStatus, orderStatus, origin, createdAt.Format("2006-01-02 15:04")))
	}
	return buf.Bytes(), nil
}

func (s *Service) GetOrderPublic(ctx context.Context, orderID string) (map[string]interface{}, error) {
	var order struct {
		ID            string
		CustomerName  string
		Total         float64
		PaymentStatus string
		OrderStatus   string
		Origin        string
		CreatedAt     time.Time
		Shipping      float64
		Discount      float64
	}
	err := s.db.QueryRow(ctx, `SELECT o.id::text, COALESCE(c.name, 'Consumidor Final'), o.total_amount, o.payment_status, o.order_status, COALESCE(o.origin, 'online'), o.created_at, o.shipping_amount, o.discount_amount FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`, orderID).Scan(&order.ID, &order.CustomerName, &order.Total, &order.PaymentStatus, &order.OrderStatus, &order.Origin, &order.CreatedAt, &order.Shipping, &order.Discount)
	if err != nil {
		return nil, err
	}

	itemsRows, err := s.db.Query(ctx, `SELECT product_name, unit_price, quantity FROM order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return nil, err
	}
	defer itemsRows.Close()
	items := []map[string]interface{}{}
	for itemsRows.Next() {
		var name string
		var price float64
		var qty int
		if err := itemsRows.Scan(&name, &price, &qty); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{"name": name, "price": price, "quantity": qty})
	}

	statuses := []map[string]interface{}{
		{"label": "Pedido confirmado", "done": true},
		{"label": "Pagamento aprovado", "done": order.OrderStatus != "aguardando_pagamento"},
		{"label": "Enviado", "done": order.OrderStatus == "enviado" || order.OrderStatus == "entregue"},
		{"label": "Entregue", "done": order.OrderStatus == "entregue"},
	}

	return map[string]interface{}{
		"id": order.ID, "customerName": order.CustomerName, "total": order.Total, "paymentStatus": order.PaymentStatus, "orderStatus": order.OrderStatus, "origin": order.Origin, "createdAt": order.CreatedAt, "shipping": order.Shipping, "discount": order.Discount, "items": items, "statuses": statuses,
	}, nil
}

func (s *Service) RequestPasswordReset(ctx context.Context, email string) (string, error) {
	var id string
	if err := s.db.QueryRow(ctx, `SELECT id FROM customers WHERE email = $1`, email).Scan(&id); err != nil {
		return "", err
	}
	token, err := auth.GenerateToken(s.cfg.JWTSecret, id, "customer", "reset", 1*time.Hour)
	if err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) ResetPassword(ctx context.Context, resetToken, newPassword string) error {
	claims, err := auth.ParseToken(s.cfg.JWTSecret, resetToken)
	if err != nil || claims.Scope != "reset" {
		return fmt.Errorf("token invalido ou expirado")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `UPDATE customers SET password_hash = $2 WHERE id = $1`, claims.UserID, hash)
	return err
}

func scanShippingRules(rows pgx.Rows) ([]shippingRule, error) {
	rules := []shippingRule{}
	for rows.Next() {
		var current shippingRule
		if err := rows.Scan(&current.Code, &current.Name, &current.RuleType, &current.Amount, &current.MinOrder, &current.WeightMin, &current.WeightMax, &current.RegionPrefix); err != nil {
			return nil, err
		}
		rules = append(rules, current)
	}
	return rules, rows.Err()
}

func normalizeShippingRules(rules []shippingRule) []shippingRule {
	canonical := map[string]string{
		"fixed":     "fixed",
		"pickup":    "pickup",
		"local":     "local",
		"manual":    "manual",
		"free_over": "free_over",
	}

	selected := map[string]shippingRule{}
	weightRules := []shippingRule{}
	for _, rule := range rules {
		if rule.RuleType == "weight" {
			weightRules = append(weightRules, rule)
			continue
		}

		current, exists := selected[rule.RuleType]
		preferredCode := canonical[rule.RuleType]
		if !exists || rule.Code == preferredCode || (current.Code != preferredCode && strings.Contains(rule.Code, preferredCode)) {
			selected[rule.RuleType] = rule
		}
	}

	normalized := make([]shippingRule, 0, len(selected)+len(weightRules))
	for _, key := range []string{"fixed", "free_over", "pickup", "local", "manual"} {
		if rule, exists := selected[key]; exists {
			normalized = append(normalized, rule)
		}
	}
	normalized = append(normalized, weightRules...)
	return normalized
}

func (s *Service) ListProductImages(ctx context.Context, productID string) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text, image_url FROM product_images WHERE product_id = $1 ORDER BY created_at`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	images := []map[string]interface{}{}
	for rows.Next() {
		var id, url string
		if err := rows.Scan(&id, &url); err != nil {
			continue
		}
		images = append(images, map[string]interface{}{"id": id, "url": url})
	}
	return images, nil
}

func (s *Service) AddProductImage(ctx context.Context, productID, imageURL string) (map[string]interface{}, error) {
	var id string
	err := s.db.QueryRow(ctx, `INSERT INTO product_images (product_id, image_url) VALUES ($1, $2) RETURNING id::text`, productID, imageURL).Scan(&id)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": id, "url": imageURL}, nil
}

func (s *Service) DeleteProductImage(ctx context.Context, imageID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM product_images WHERE id = $1`, imageID)
	return err
}

func (s *Service) SetProductMainImage(ctx context.Context, productID, imageURL string) error {
	_, err := s.db.Exec(ctx, `UPDATE products SET image_url = $2 WHERE id = $1`, productID, imageURL)
	return err
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

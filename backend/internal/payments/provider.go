package payments

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type PaymentResult struct {
	ProviderRef string `json:"providerRef"`
	Status      string `json:"status"`
	PaymentURL  string `json:"paymentUrl,omitempty"`
}

type Provider interface {
	CreatePayment(total float64, method string) (PaymentResult, error)
}

type MercadoPagoProvider struct {
	AccessToken string
	FrontendURL string
}

func NewMercadoPagoProvider(accessToken, frontendURL string) *MercadoPagoProvider {
	return &MercadoPagoProvider{
		AccessToken: accessToken,
		FrontendURL: frontendURL,
	}
}

func (mp *MercadoPagoProvider) CreatePayment(total float64, method string) (PaymentResult, error) {
	payload := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"title":      "Compra On Perfumaria",
				"quantity":   1,
				"unit_price": total,
			},
		},
		"back_urls": map[string]string{
			"success": mp.FrontendURL + "/checkout?status=success",
			"failure": mp.FrontendURL + "/checkout?status=failure",
			"pending": mp.FrontendURL + "/checkout?status=pending",
		},
		"auto_return": "approved",
		"notification_url": mp.FrontendURL + "/api/webhooks/mercadopago",
		"payment_methods": map[string]interface{}{
			"excluded_payment_types": []map[string]string{
				{"id": "ticket"},
			},
		},
	}

	if method == "pix" {
		payload["payment_methods"] = map[string]interface{}{
			"excluded_payment_methods": []map[string]string{
				{"id": "credit_card"},
				{"id": "debit_card"},
				{"id": "ticket"},
			},
		}
		payload["default_installments"] = 1
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.mercadopago.com/checkout/preferences", bytes.NewReader(body))
	if err != nil {
		return PaymentResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+mp.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return PaymentResult{}, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return PaymentResult{}, fmt.Errorf("mercado pago: %s", string(respBody))
	}

	var result struct {
		ID        string `json:"id"`
		InitPoint string `json:"init_point"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return PaymentResult{}, err
	}

	return PaymentResult{
		ProviderRef: result.ID,
		Status:      "pending",
		PaymentURL:  result.InitPoint,
	}, nil
}

type MockProvider struct{}

func (MockProvider) CreatePayment(total float64, method string) (PaymentResult, error) {
	return PaymentResult{
		ProviderRef: "MOCK-" + method,
		Status:      "pending",
		PaymentURL:  "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=MOCK-" + method,
	}, nil
}

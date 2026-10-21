package services

import (
	"context"
	"errors"
	"testing"

	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/payments"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestChoosePaymentsProvider(t *testing.T) {
	t.Run("sem token e sem PAYMENTS_MOCK recusa", func(t *testing.T) {
		provider, err := choosePaymentsProvider("", false, "")
		if !errors.Is(err, ErrPaymentsUnavailable) || provider != nil {
			t.Fatalf("provider=%T err=%v, esperado recusa com ErrPaymentsUnavailable", provider, err)
		}
	})

	t.Run("sem token com PAYMENTS_MOCK usa o mock", func(t *testing.T) {
		provider, err := choosePaymentsProvider("", true, "")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if _, ok := provider.(payments.MockProvider); !ok {
			t.Fatalf("provider=%T, esperado MockProvider", provider)
		}
	})

	t.Run("com token usa o Mercado Pago mesmo com PAYMENTS_MOCK", func(t *testing.T) {
		provider, err := choosePaymentsProvider("APP_USR-token", true, "")
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if _, ok := provider.(*payments.MercadoPagoProvider); !ok {
			t.Fatalf("provider=%T, esperado MercadoPagoProvider", provider)
		}
	})
}

// O banco aqui aponta para uma porta sem nada escutando: a leitura do token
// falha, como se nenhum token tivesse sido salvo. O checkout tem de parar no
// provider, antes de abrir transacao ou chamar qualquer cobranca.
func TestCreateOrderRefusedWithoutPaymentsProvider(t *testing.T) {
	db, err := pgxpool.New(context.Background(), "postgres://ninguem@127.0.0.1:1/nada?connect_timeout=2")
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	defer db.Close()

	svc := NewService(config.Config{PaymentsMock: false}, db)
	_, err = svc.CreateOrder(context.Background(), CheckoutInput{
		DeliveryMode:    "fixed",
		PaymentMethodID: "visa",
		Items:           []CheckoutItem{{ProductID: "item", Quantity: 1}},
	})
	if !errors.Is(err, ErrPaymentsUnavailable) {
		t.Fatalf("err=%v, esperado ErrPaymentsUnavailable", err)
	}
}

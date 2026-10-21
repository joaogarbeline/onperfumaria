package services

import (
	"errors"
	"testing"

	"onperfumaria/backend/internal/shipping"
)

type correiosCall struct {
	origin, destination string
	weight              int
}

// stubCorreios troca a cotacao real por uma resposta fixa durante o teste e
// guarda os argumentos recebidos, para conferir o que o servidor pediu.
func stubCorreios(t *testing.T, options []shipping.CorreiosOption, err error) *correiosCall {
	t.Helper()
	called := &correiosCall{}
	original := fetchCorreiosOptions
	fetchCorreiosOptions = func(origin, destination string, weight int) ([]shipping.CorreiosOption, error) {
		called.origin, called.destination, called.weight = origin, destination, weight
		return options, err
	}
	t.Cleanup(func() { fetchCorreiosOptions = original })
	return called
}

var correiosQuote = []shipping.CorreiosOption{
	{Service: "SEDEX", Code: "04014", Price: 48.9, Days: 2},
	{Service: "PAC", Code: "04510", Price: 27.35, Days: 6},
}

func TestQuoteCorreiosForOrderUsesServerQuote(t *testing.T) {
	called := stubCorreios(t, correiosQuote, nil)

	amount, err := quoteCorreiosForOrder("01001-000", 750, "04510")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if amount != 27.35 {
		t.Fatalf("frete = %.2f, esperado o valor do PAC cotado no servidor (27.35)", amount)
	}
	if called.origin != shipping.StoreOriginCEP || called.destination != "01001-000" || called.weight != 750 {
		t.Fatalf("cotacao pedida com %+v, esperado origem %s, destino 01001-000 e 750g", *called, shipping.StoreOriginCEP)
	}
}

func TestQuoteCorreiosForOrderRefuses(t *testing.T) {
	cases := []struct {
		name        string
		options     []shipping.CorreiosOption
		fetchErr    error
		serviceCode string
	}{
		{name: "cotacao fora do ar", fetchErr: errors.New("timeout"), serviceCode: "04510"},
		{name: "servico nao escolhido", options: correiosQuote, serviceCode: ""},
		{name: "servico que nao veio na cotacao", options: correiosQuote, serviceCode: "99999"},
		{name: "cotacao com valor zerado", options: []shipping.CorreiosOption{{Code: "04510", Price: 0}}, serviceCode: "04510"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stubCorreios(t, tc.options, tc.fetchErr)
			amount, err := quoteCorreiosForOrder("01001000", 300, tc.serviceCode)
			if err == nil {
				t.Fatalf("pedido aceito com frete %.2f, esperado recusa", amount)
			}
		})
	}
}

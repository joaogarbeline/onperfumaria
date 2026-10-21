package services

import "testing"

func TestCouponDiscount(t *testing.T) {
	cases := []struct {
		name         string
		discountType string
		value        float64
		subtotal     float64
		want         float64
	}{
		{name: "percentual", discountType: "percent", value: 10, subtotal: 200, want: 20},
		{name: "fixo menor que a compra", discountType: "fixed", value: 30, subtotal: 200, want: 30},
		{name: "fixo maior que a compra fica no subtotal", discountType: "fixed", value: 500, subtotal: 120, want: 120},
		{name: "percentual acima de 100 fica no subtotal", discountType: "percent", value: 150, subtotal: 80, want: 80},
		{name: "valor negativo nao aumenta o total", discountType: "fixed", value: -50, subtotal: 80, want: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := couponDiscount(tc.discountType, tc.value, tc.subtotal); got != tc.want {
				t.Fatalf("couponDiscount = %.2f, esperado %.2f", got, tc.want)
			}
		})
	}
}

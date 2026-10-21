package services

import "testing"

func TestValidateCoupon(t *testing.T) {
	cases := []struct {
		name         string
		code, kind   string
		value        float64
		wantAccepted bool
	}{
		{name: "percentual valido", code: "BEMVINDA10", kind: "percent", value: 10, wantAccepted: true},
		{name: "valor fixo valido", code: "MENOS20", kind: "fixed", value: 20, wantAccepted: true},
		{name: "sem codigo", code: "", kind: "percent", value: 10},
		{name: "tipo desconhecido", code: "X", kind: "frete", value: 10},
		{name: "valor zerado", code: "X", kind: "fixed", value: 0},
		{name: "valor negativo", code: "X", kind: "fixed", value: -5},
		{name: "percentual acima de 100", code: "X", kind: "percent", value: 120},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateCoupon(tc.code, tc.kind, tc.value)
			if (err == nil) != tc.wantAccepted {
				t.Fatalf("validateCoupon = %v, esperado aceito=%v", err, tc.wantAccepted)
			}
		})
	}
}

func TestSpreadsheetSafe(t *testing.T) {
	cases := map[string]string{
		"Maria Silva":              "Maria Silva",
		"=HYPERLINK(\"http://x\")": "'=HYPERLINK(\"http://x\")",
		"+5567999999999":           "'+5567999999999",
		"-1":                       "'-1",
		"@SUM(A1)":                 "'@SUM(A1)",
		"":                         "",
	}
	for input, want := range cases {
		if got := spreadsheetSafe(input); got != want {
			t.Fatalf("spreadsheetSafe(%q) = %q, esperado %q", input, got, want)
		}
	}
}

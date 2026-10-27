package services

import "testing"

func TestFormatBRL(t *testing.T) {
	cases := map[float64]string{
		0:       "R$ 0,00",
		9.9:     "R$ 9,90",
		289.9:   "R$ 289,90",
		1298.8:  "R$ 1.298,80",
		1234567: "R$ 1.234.567,00",
	}
	for value, want := range cases {
		if got := formatBRL(value); got != want {
			t.Errorf("formatBRL(%v) = %q, want %q", value, got, want)
		}
	}
}

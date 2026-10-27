package services

import "testing"

func TestResolveReportRange(t *testing.T) {
	cases := []struct {
		period, date, from, to string
		wantFrom, wantTo       string
		prevFrom, prevTo       string
	}{
		// 2026-10-22 e quinta: a semana vai de segunda 19 a domingo 25.
		{"week", "2026-10-22", "", "", "2026-10-19", "2026-10-25", "2026-10-12", "2026-10-18"},
		{"month", "2026-03-15", "", "", "2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28"},
		{"year", "2026-07-01", "", "", "2026-01-01", "2026-12-31", "2025-01-01", "2025-12-31"},
		{"custom", "", "2026-10-10", "2026-10-01", "2026-10-01", "2026-10-10", "2026-09-21", "2026-09-30"},
	}
	for _, tc := range cases {
		r, err := ResolveReportRange(tc.period, tc.date, tc.from, tc.to)
		if err != nil {
			t.Fatalf("%s: %v", tc.period, err)
		}
		if r.fromDate() != tc.wantFrom || r.toDate() != tc.wantTo {
			t.Errorf("%s: got %s..%s, want %s..%s", tc.period, r.fromDate(), r.toDate(), tc.wantFrom, tc.wantTo)
		}
		prev := r.Previous()
		if prev.fromDate() != tc.prevFrom || prev.toDate() != tc.prevTo {
			t.Errorf("%s previous: got %s..%s, want %s..%s", tc.period, prev.fromDate(), prev.toDate(), tc.prevFrom, tc.prevTo)
		}
	}

	if _, err := ResolveReportRange("decade", "", "", ""); err == nil {
		t.Error("periodo invalido deveria falhar")
	}
	if _, err := ResolveReportRange("custom", "", "2020-01-01", "2026-01-01"); err == nil {
		t.Error("periodo acima de 3 anos deveria falhar")
	}
}

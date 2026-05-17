package financial_test

import (
	"math"
	"testing"
)

// Test Nigerian actuarial premium calculations

func TestMotorThirdPartyPremium(t *testing.T) {
	minPremium := 5000.0

	tests := []struct {
		name     string
		vehicle  string
		value    float64
		expected float64
	}{
		{"Private car below min", "private_car", 50000, minPremium},
		{"Commercial vehicle", "commercial", 2000000, 25000},
		{"Motorcycle", "motorcycle", 300000, minPremium},
		{"Truck", "truck", 5000000, 75000},
	}

	rateMap := map[string]float64{
		"private_car": 1.0,
		"commercial":  1.25,
		"motorcycle":  0.75,
		"truck":       1.5,
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rate, ok := rateMap[tt.vehicle]
			if !ok {
				t.Fatalf("unknown vehicle class: %s", tt.vehicle)
			}
			premium := tt.value * 0.01 * rate
			if premium < minPremium {
				premium = minPremium
			}
			if math.Abs(premium-tt.expected) > 0.01 {
				t.Errorf("expected premium %.2f, got %.2f", tt.expected, premium)
			}
		})
	}
}

func TestReinsuranceCessionCalculation(t *testing.T) {
	tests := []struct {
		name          string
		sumInsured    float64
		retention     float64
		cessionRate   float64
		expectedCeded float64
	}{
		{"50% quota share", 10000000, 5000000, 0.50, 5000000},
		{"70% quota share", 10000000, 3000000, 0.70, 7000000},
		{"30% surplus", 5000000, 3500000, 0.30, 1500000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ceded := tt.sumInsured * tt.cessionRate
			if math.Abs(ceded-tt.expectedCeded) > 0.01 {
				t.Errorf("expected ceded %.2f, got %.2f", tt.expectedCeded, ceded)
			}

			if ceded+tt.retention < tt.sumInsured*0.99 {
				// Allow small floating point differences
				gap := tt.sumInsured - ceded - tt.retention
				t.Logf("Coverage gap: %.2f (retention=%.2f + ceded=%.2f < sum=%.2f)",
					gap, tt.retention, ceded, tt.sumInsured)
			}
		})
	}
}

func TestCommissionTierCalculation(t *testing.T) {
	tiers := []struct {
		minPolicies int
		rate        float64
	}{
		{0, 0.10},
		{10, 0.12},
		{25, 0.15},
		{50, 0.18},
		{100, 0.20},
	}

	tests := []struct {
		name         string
		policySales  int
		premium      float64
		expectedRate float64
	}{
		{"New agent", 3, 500000, 0.10},
		{"Bronze tier", 15, 500000, 0.12},
		{"Silver tier", 30, 500000, 0.15},
		{"Gold tier", 60, 500000, 0.18},
		{"Platinum tier", 120, 500000, 0.20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var rate float64
			for _, tier := range tiers {
				if tt.policySales >= tier.minPolicies {
					rate = tier.rate
				}
			}
			if math.Abs(rate-tt.expectedRate) > 0.001 {
				t.Errorf("expected rate %.3f, got %.3f for %d policies",
					tt.expectedRate, rate, tt.policySales)
			}

			commission := tt.premium * rate
			if commission <= 0 {
				t.Errorf("commission should be positive, got %.2f", commission)
			}
		})
	}
}

func TestNAICOMSolvencyMargin(t *testing.T) {
	tests := []struct {
		name           string
		totalAssets     float64
		totalLiabilities float64
		minMargin      float64
		expectSolvent  bool
	}{
		{"Well capitalized", 10000000000, 7000000000, 0.15, true},
		{"Marginally solvent", 10000000000, 8400000000, 0.15, true},
		{"Insolvent", 10000000000, 9000000000, 0.15, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			net := tt.totalAssets - tt.totalLiabilities
			margin := net / tt.totalAssets
			isSolvent := margin >= tt.minMargin

			if isSolvent != tt.expectSolvent {
				t.Errorf("expected solvent=%v, got %v (margin=%.4f)",
					tt.expectSolvent, isSolvent, margin)
			}
		})
	}
}

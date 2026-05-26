// Package outbound implements the National Outbound Remittance Platform module.
// This module handles cross-border remittance routing, sanctions screening,
// tiered billing, and provider adapter management as a feature on the payment switch.
package outbound

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// CorridorRoutingEngine selects optimal payout rails based on corridor,
// cost, SLA, provider health, and regulatory constraints.
type CorridorRoutingEngine struct {
	corridors map[string]*Corridor
	providers map[string]*Provider
	rules     []RoutingRule
	mu        sync.RWMutex
}

// Corridor represents a remittance corridor (e.g., NG→GH, NG→US)
type Corridor struct {
	ID              string            `json:"id"`
	SourceCountry   string            `json:"source_country"`
	DestCountry     string            `json:"dest_country"`
	DestCurrency    string            `json:"dest_currency"`
	Category        CorridorCategory  `json:"category"`
	Status          string            `json:"status"` // "active", "suspended", "pilot"
	MaxAmountUSD    float64           `json:"max_amount_usd"`
	MinAmountUSD    float64           `json:"min_amount_usd"`
	DailyLimitUSD   float64           `json:"daily_limit_usd"`
	Providers       []string          `json:"providers"`
	ComplianceLevel string            `json:"compliance_level"` // "standard", "enhanced", "manual_review"
	CBNApproval     string            `json:"cbn_approval"`
	SpreadCapBPS    int               `json:"spread_cap_bps"` // CBN-regulated max spread in basis points
	Metadata        map[string]string `json:"metadata"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

// CorridorCategory classifies corridors per the architecture document
type CorridorCategory string

const (
	CorridorWestAfricaLabor  CorridorCategory = "west_africa_labor"
	CorridorEducation        CorridorCategory = "education"
	CorridorMedical          CorridorCategory = "medical"
	CorridorPremiumBusiness  CorridorCategory = "premium_business"
	CorridorGeneralPersonal  CorridorCategory = "general_personal"
	CorridorGovernment       CorridorCategory = "government"
)

// Provider represents an external payout rail/partner
type Provider struct {
	ID              string        `json:"id"`
	Name            string        `json:"name"`
	Type            string        `json:"type"` // "bank", "mto", "mobile_money", "crypto_rail"
	Corridors       []string      `json:"corridors"`
	Status          string        `json:"status"` // "active", "degraded", "down", "suspended"
	AvgLatencyMs    int           `json:"avg_latency_ms"`
	SuccessRate     float64       `json:"success_rate"`
	CostPerTxnUSD   float64       `json:"cost_per_txn_usd"`
	MaxTPS          int           `json:"max_tps"`
	CurrentTPS      int           `json:"current_tps"`
	SLAGuaranteeMs  int           `json:"sla_guarantee_ms"`
	SettlementTime  string        `json:"settlement_time"` // "T+0", "T+1", "T+2"
	SanctionsRisk   string        `json:"sanctions_risk"`  // "low", "medium", "high"
	LastHealthCheck time.Time     `json:"last_health_check"`
}

// RoutingRule defines a rule for selecting providers
type RoutingRule struct {
	Priority    int              `json:"priority"`
	Condition   RoutingCondition `json:"condition"`
	Action      RoutingAction    `json:"action"`
}

// RoutingCondition defines when a rule applies
type RoutingCondition struct {
	Corridors       []string `json:"corridors,omitempty"`
	Categories      []string `json:"categories,omitempty"`
	MinAmountUSD    float64  `json:"min_amount_usd,omitempty"`
	MaxAmountUSD    float64  `json:"max_amount_usd,omitempty"`
	SenderTier      string   `json:"sender_tier,omitempty"`
}

// RoutingAction defines what to do when the rule matches
type RoutingAction struct {
	PreferProviders []string `json:"prefer_providers,omitempty"`
	ExcludeProviders []string `json:"exclude_providers,omitempty"`
	RequireSLA      int      `json:"require_sla_ms,omitempty"`
}

// RouteResult is the output of the routing decision
type RouteResult struct {
	ProviderID    string        `json:"provider_id"`
	CorridorID    string        `json:"corridor_id"`
	EstimatedTime time.Duration `json:"estimated_time"`
	CostUSD       float64       `json:"cost_usd"`
	Score         float64       `json:"score"`
	Reason        string        `json:"reason"`
}

// NewCorridorRoutingEngine creates a new routing engine with Nigerian corridors
func NewCorridorRoutingEngine() *CorridorRoutingEngine {
	engine := &CorridorRoutingEngine{
		corridors: make(map[string]*Corridor),
		providers: make(map[string]*Provider),
	}
	engine.seedNigerianCorridors()
	engine.seedProviders()
	engine.seedRoutingRules()
	return engine
}

// Route selects the best provider for a given remittance
func (e *CorridorRoutingEngine) Route(ctx context.Context, req *RouteRequest) (*RouteResult, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	corridor, ok := e.corridors[req.CorridorID]
	if !ok {
		return nil, fmt.Errorf("corridor not found: %s", req.CorridorID)
	}
	if corridor.Status != "active" {
		return nil, fmt.Errorf("corridor %s is %s", req.CorridorID, corridor.Status)
	}
	if req.AmountUSD > corridor.MaxAmountUSD {
		return nil, fmt.Errorf("amount %.2f exceeds corridor max %.2f", req.AmountUSD, corridor.MaxAmountUSD)
	}
	if req.AmountUSD < corridor.MinAmountUSD {
		return nil, fmt.Errorf("amount %.2f below corridor min %.2f", req.AmountUSD, corridor.MinAmountUSD)
	}

	// Get eligible providers for this corridor
	eligible := e.getEligibleProviders(corridor, req)
	if len(eligible) == 0 {
		return nil, fmt.Errorf("no eligible providers for corridor %s", req.CorridorID)
	}

	// Score and rank providers
	scored := e.scoreProviders(eligible, req)
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	best := scored[0]
	return &best, nil
}

// RouteRequest is the input for routing
type RouteRequest struct {
	CorridorID  string  `json:"corridor_id"`
	AmountUSD   float64 `json:"amount_usd"`
	SenderTier  string  `json:"sender_tier"`
	Urgency     string  `json:"urgency"` // "standard", "express", "instant"
	PayoutType  string  `json:"payout_type"` // "bank_account", "mobile_wallet", "cash_pickup"
}

// getEligibleProviders filters providers by corridor and health
func (e *CorridorRoutingEngine) getEligibleProviders(corridor *Corridor, req *RouteRequest) []*Provider {
	var eligible []*Provider
	for _, pid := range corridor.Providers {
		p, ok := e.providers[pid]
		if !ok {
			continue
		}
		if p.Status == "down" || p.Status == "suspended" {
			continue
		}
		if p.CurrentTPS >= p.MaxTPS {
			continue
		}
		eligible = append(eligible, p)
	}
	return eligible
}

// scoreProviders calculates a composite score for each provider
func (e *CorridorRoutingEngine) scoreProviders(providers []*Provider, req *RouteRequest) []RouteResult {
	results := make([]RouteResult, 0, len(providers))
	for _, p := range providers {
		score := 0.0
		// Success rate (weight: 40%)
		score += p.SuccessRate * 0.40
		// Cost efficiency (weight: 25%) - lower cost = higher score
		costScore := 1.0 - (p.CostPerTxnUSD / 10.0)
		if costScore < 0 {
			costScore = 0
		}
		score += costScore * 25.0
		// Latency (weight: 20%) - lower latency = higher score
		latencyScore := 1.0 - (float64(p.AvgLatencyMs) / 5000.0)
		if latencyScore < 0 {
			latencyScore = 0
		}
		score += latencyScore * 20.0
		// Capacity headroom (weight: 15%)
		headroom := 1.0 - (float64(p.CurrentTPS) / float64(p.MaxTPS))
		score += headroom * 15.0

		results = append(results, RouteResult{
			ProviderID:    p.ID,
			CorridorID:    req.CorridorID,
			EstimatedTime: time.Duration(p.AvgLatencyMs) * time.Millisecond,
			CostUSD:       p.CostPerTxnUSD,
			Score:         score,
			Reason:        fmt.Sprintf("success=%.1f%% latency=%dms cost=$%.2f", p.SuccessRate, p.AvgLatencyMs, p.CostPerTxnUSD),
		})
	}
	return results
}

// seedNigerianCorridors initializes corridors per the architecture document
func (e *CorridorRoutingEngine) seedNigerianCorridors() {
	corridors := []*Corridor{
		// West African labor corridors (high volume, lower value)
		{ID: "NG-GH", SourceCountry: "NG", DestCountry: "GH", DestCurrency: "GHS", Category: CorridorWestAfricaLabor, Status: "active", MaxAmountUSD: 5000, MinAmountUSD: 10, DailyLimitUSD: 50000, SpreadCapBPS: 150, ComplianceLevel: "standard", CBNApproval: "CBN/2024/OBR/001"},
		{ID: "NG-SN", SourceCountry: "NG", DestCountry: "SN", DestCurrency: "XOF", Category: CorridorWestAfricaLabor, Status: "active", MaxAmountUSD: 5000, MinAmountUSD: 10, DailyLimitUSD: 50000, SpreadCapBPS: 200, ComplianceLevel: "standard", CBNApproval: "CBN/2024/OBR/002"},
		{ID: "NG-CI", SourceCountry: "NG", DestCountry: "CI", DestCurrency: "XOF", Category: CorridorWestAfricaLabor, Status: "active", MaxAmountUSD: 5000, MinAmountUSD: 10, DailyLimitUSD: 50000, SpreadCapBPS: 200, ComplianceLevel: "standard", CBNApproval: "CBN/2024/OBR/003"},
		{ID: "NG-CM", SourceCountry: "NG", DestCountry: "CM", DestCurrency: "XAF", Category: CorridorWestAfricaLabor, Status: "active", MaxAmountUSD: 5000, MinAmountUSD: 10, DailyLimitUSD: 50000, SpreadCapBPS: 200, ComplianceLevel: "standard", CBNApproval: "CBN/2024/OBR/004"},
		// Education corridors (medium volume, higher value)
		{ID: "NG-GB", SourceCountry: "NG", DestCountry: "GB", DestCurrency: "GBP", Category: CorridorEducation, Status: "active", MaxAmountUSD: 50000, MinAmountUSD: 100, DailyLimitUSD: 200000, SpreadCapBPS: 100, ComplianceLevel: "enhanced", CBNApproval: "CBN/2024/OBR/010"},
		{ID: "NG-US", SourceCountry: "NG", DestCountry: "US", DestCurrency: "USD", Category: CorridorEducation, Status: "active", MaxAmountUSD: 50000, MinAmountUSD: 100, DailyLimitUSD: 200000, SpreadCapBPS: 100, ComplianceLevel: "enhanced", CBNApproval: "CBN/2024/OBR/011"},
		{ID: "NG-CA", SourceCountry: "NG", DestCountry: "CA", DestCurrency: "CAD", Category: CorridorEducation, Status: "active", MaxAmountUSD: 50000, MinAmountUSD: 100, DailyLimitUSD: 200000, SpreadCapBPS: 120, ComplianceLevel: "enhanced", CBNApproval: "CBN/2024/OBR/012"},
		// Medical corridors
		{ID: "NG-IN", SourceCountry: "NG", DestCountry: "IN", DestCurrency: "INR", Category: CorridorMedical, Status: "active", MaxAmountUSD: 30000, MinAmountUSD: 50, DailyLimitUSD: 100000, SpreadCapBPS: 150, ComplianceLevel: "enhanced", CBNApproval: "CBN/2024/OBR/020"},
		{ID: "NG-TR", SourceCountry: "NG", DestCountry: "TR", DestCurrency: "TRY", Category: CorridorMedical, Status: "pilot", MaxAmountUSD: 30000, MinAmountUSD: 50, DailyLimitUSD: 100000, SpreadCapBPS: 175, ComplianceLevel: "enhanced", CBNApproval: "CBN/2024/OBR/021"},
		// Premium business corridors
		{ID: "NG-CN", SourceCountry: "NG", DestCountry: "CN", DestCurrency: "CNY", Category: CorridorPremiumBusiness, Status: "active", MaxAmountUSD: 100000, MinAmountUSD: 500, DailyLimitUSD: 500000, SpreadCapBPS: 80, ComplianceLevel: "manual_review", CBNApproval: "CBN/2024/OBR/030"},
		{ID: "NG-AE", SourceCountry: "NG", DestCountry: "AE", DestCurrency: "AED", Category: CorridorPremiumBusiness, Status: "active", MaxAmountUSD: 100000, MinAmountUSD: 500, DailyLimitUSD: 500000, SpreadCapBPS: 90, ComplianceLevel: "manual_review", CBNApproval: "CBN/2024/OBR/031"},
		// East Africa
		{ID: "NG-KE", SourceCountry: "NG", DestCountry: "KE", DestCurrency: "KES", Category: CorridorGeneralPersonal, Status: "active", MaxAmountUSD: 10000, MinAmountUSD: 20, DailyLimitUSD: 75000, SpreadCapBPS: 150, ComplianceLevel: "standard", CBNApproval: "CBN/2024/OBR/040"},
		{ID: "NG-ZA", SourceCountry: "NG", DestCountry: "ZA", DestCurrency: "ZAR", Category: CorridorGeneralPersonal, Status: "active", MaxAmountUSD: 10000, MinAmountUSD: 20, DailyLimitUSD: 75000, SpreadCapBPS: 130, ComplianceLevel: "standard", CBNApproval: "CBN/2024/OBR/041"},
	}

	for _, c := range corridors {
		c.Providers = []string{"worldremit", "flutterwave", "chipper", "lemfi", "mojaloop_hub"}
		c.CreatedAt = time.Now()
		c.UpdatedAt = time.Now()
		e.corridors[c.ID] = c
	}
}

// seedProviders initializes provider/rail integrations
func (e *CorridorRoutingEngine) seedProviders() {
	providers := []*Provider{
		{ID: "worldremit", Name: "WorldRemit", Type: "mto", Status: "active", AvgLatencyMs: 1200, SuccessRate: 99.2, CostPerTxnUSD: 2.50, MaxTPS: 500, CurrentTPS: 120, SLAGuaranteeMs: 3000, SettlementTime: "T+1", SanctionsRisk: "low"},
		{ID: "flutterwave", Name: "Flutterwave", Type: "bank", Status: "active", AvgLatencyMs: 800, SuccessRate: 98.8, CostPerTxnUSD: 1.80, MaxTPS: 1000, CurrentTPS: 340, SLAGuaranteeMs: 2000, SettlementTime: "T+0", SanctionsRisk: "low"},
		{ID: "chipper", Name: "Chipper Cash", Type: "mobile_money", Status: "active", AvgLatencyMs: 600, SuccessRate: 97.5, CostPerTxnUSD: 1.20, MaxTPS: 800, CurrentTPS: 200, SLAGuaranteeMs: 1500, SettlementTime: "T+0", SanctionsRisk: "low"},
		{ID: "lemfi", Name: "LemFi", Type: "bank", Status: "active", AvgLatencyMs: 1500, SuccessRate: 99.5, CostPerTxnUSD: 3.00, MaxTPS: 300, CurrentTPS: 80, SLAGuaranteeMs: 4000, SettlementTime: "T+1", SanctionsRisk: "low"},
		{ID: "mojaloop_hub", Name: "Mojaloop Hub", Type: "bank", Status: "active", AvgLatencyMs: 400, SuccessRate: 99.8, CostPerTxnUSD: 0.50, MaxTPS: 5000, CurrentTPS: 800, SLAGuaranteeMs: 1000, SettlementTime: "T+0", SanctionsRisk: "low"},
		{ID: "wise", Name: "Wise (TransferWise)", Type: "bank", Status: "active", AvgLatencyMs: 2000, SuccessRate: 99.6, CostPerTxnUSD: 4.00, MaxTPS: 200, CurrentTPS: 50, SLAGuaranteeMs: 5000, SettlementTime: "T+1", SanctionsRisk: "low"},
		{ID: "mtn_momo", Name: "MTN MoMo", Type: "mobile_money", Status: "active", AvgLatencyMs: 500, SuccessRate: 96.5, CostPerTxnUSD: 0.80, MaxTPS: 2000, CurrentTPS: 600, SLAGuaranteeMs: 1000, SettlementTime: "T+0", SanctionsRisk: "low"},
	}

	for _, p := range providers {
		p.LastHealthCheck = time.Now()
		e.providers[p.ID] = p
	}
}

// seedRoutingRules adds business rules for corridor-based routing
func (e *CorridorRoutingEngine) seedRoutingRules() {
	e.rules = []RoutingRule{
		{Priority: 1, Condition: RoutingCondition{Categories: []string{"premium_business"}, MinAmountUSD: 10000}, Action: RoutingAction{PreferProviders: []string{"wise", "lemfi"}, RequireSLA: 5000}},
		{Priority: 2, Condition: RoutingCondition{Categories: []string{"west_africa_labor"}}, Action: RoutingAction{PreferProviders: []string{"chipper", "mtn_momo", "mojaloop_hub"}}},
		{Priority: 3, Condition: RoutingCondition{Categories: []string{"education", "medical"}, MinAmountUSD: 5000}, Action: RoutingAction{PreferProviders: []string{"flutterwave", "wise"}}},
	}
}

// GetCorridors returns all configured corridors
func (e *CorridorRoutingEngine) GetCorridors() []*Corridor {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]*Corridor, 0, len(e.corridors))
	for _, c := range e.corridors {
		result = append(result, c)
	}
	return result
}

// GetProviders returns all configured providers
func (e *CorridorRoutingEngine) GetProviders() []*Provider {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]*Provider, 0, len(e.providers))
	for _, p := range e.providers {
		result = append(result, p)
	}
	return result
}

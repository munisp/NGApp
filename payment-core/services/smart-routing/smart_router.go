package smartrouting

import (
	"sort"
	"sync"
	"time"
)

type PaymentRail string

const (
	RailNIP  PaymentRail = "NIP"
	RailNEFT PaymentRail = "NEFT"
	RailNDD  PaymentRail = "NDD"
	RailRTGS PaymentRail = "RTGS"
)

type RoutingCriteria string

const (
	CriteriaSpeed   RoutingCriteria = "SPEED"
	CriteriaCost    RoutingCriteria = "COST"
	CriteriaBalance RoutingCriteria = "BALANCED"
)

type BankAvailability struct {
	BankCode      string
	BankName      string
	Available     bool
	SuccessRate   float64
	AvgLatencyMs  int64
	LastCheckedAt time.Time
}

type RailConfig struct {
	Rail             PaymentRail
	MaxAmount        int64
	CostPerTxn       int64
	AvgSettlementMin int
	Available        bool
	SuccessRate      float64
	AvgLatencyMs     int64
	CutoffTime       string
	BatchEnabled     bool
	MaxDailyVolume   int64
}

type RoutingDecision struct {
	SelectedRail     PaymentRail
	Reason           string
	AlternativeRails []PaymentRail
	EstimatedCost    int64
	EstimatedTimeMin int
	SuccessRate      float64
}

type SmartRouter struct {
	mu               sync.RWMutex
	rails            map[PaymentRail]RailConfig
	bankAvailability map[string]BankAvailability
}

func NewSmartRouter() *SmartRouter {
	return &SmartRouter{
		rails: map[PaymentRail]RailConfig{
			RailNIP: {
				Rail: RailNIP, MaxAmount: 10000000,
				CostPerTxn: 25, AvgSettlementMin: 0, Available: true,
				SuccessRate: 0.997, AvgLatencyMs: 45, CutoffTime: "",
				BatchEnabled: false, MaxDailyVolume: 100000000000,
			},
			RailNEFT: {
				Rail: RailNEFT, MaxAmount: 999999999999,
				CostPerTxn: 50, AvgSettlementMin: 240, Available: true,
				SuccessRate: 0.999, AvgLatencyMs: 200, CutoffTime: "14:00",
				BatchEnabled: true, MaxDailyVolume: 500000000000,
			},
			RailNDD: {
				Rail: RailNDD, MaxAmount: 999999999999,
				CostPerTxn: 30, AvgSettlementMin: 1440, Available: true,
				SuccessRate: 0.998, AvgLatencyMs: 150, CutoffTime: "10:00",
				BatchEnabled: true, MaxDailyVolume: 200000000000,
			},
			RailRTGS: {
				Rail: RailRTGS, MaxAmount: 999999999999,
				CostPerTxn: 1000, AvgSettlementMin: 30, Available: true,
				SuccessRate: 0.9999, AvgLatencyMs: 500, CutoffTime: "15:00",
				BatchEnabled: false, MaxDailyVolume: 1000000000000,
			},
		},
		bankAvailability: make(map[string]BankAvailability),
	}
}

func (r *SmartRouter) Route(amount int64, destBankCode string, urgent bool, criteria RoutingCriteria) RoutingDecision {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var eligible []RailConfig
	for _, rail := range r.rails {
		if !rail.Available || amount > rail.MaxAmount {
			continue
		}
		eligible = append(eligible, rail)
	}

	if len(eligible) == 0 {
		return RoutingDecision{
			SelectedRail: RailNEFT,
			Reason:       "No eligible rails — fallback to NEFT",
		}
	}

	if urgent {
		// Urgent: prefer NIP for ≤₦10M, RTGS for higher
		if amount <= 10000000 {
			if rail, ok := r.rails[RailNIP]; ok && rail.Available {
				return RoutingDecision{
					SelectedRail: RailNIP, Reason: "Urgent: instant NIP",
					AlternativeRails: []PaymentRail{RailRTGS, RailNEFT},
					EstimatedCost: rail.CostPerTxn, EstimatedTimeMin: 0,
					SuccessRate: rail.SuccessRate,
				}
			}
		}
		if rail, ok := r.rails[RailRTGS]; ok && rail.Available {
			return RoutingDecision{
				SelectedRail: RailRTGS, Reason: "Urgent high-value: RTGS",
				AlternativeRails: []PaymentRail{RailNEFT},
				EstimatedCost: rail.CostPerTxn, EstimatedTimeMin: 30,
				SuccessRate: rail.SuccessRate,
			}
		}
	}

	switch criteria {
	case CriteriaSpeed:
		sort.Slice(eligible, func(i, j int) bool {
			return eligible[i].AvgSettlementMin < eligible[j].AvgSettlementMin
		})
	case CriteriaCost:
		sort.Slice(eligible, func(i, j int) bool {
			return eligible[i].CostPerTxn < eligible[j].CostPerTxn
		})
	default: // BALANCED
		sort.Slice(eligible, func(i, j int) bool {
			scoreI := eligible[i].SuccessRate*100 - float64(eligible[i].CostPerTxn)/100
			scoreJ := eligible[j].SuccessRate*100 - float64(eligible[j].CostPerTxn)/100
			return scoreI > scoreJ
		})
	}

	selected := eligible[0]
	var alternatives []PaymentRail
	for i := 1; i < len(eligible) && i <= 3; i++ {
		alternatives = append(alternatives, eligible[i].Rail)
	}

	return RoutingDecision{
		SelectedRail:     selected.Rail,
		Reason:           string("Optimal by " + string(criteria)),
		AlternativeRails: alternatives,
		EstimatedCost:    selected.CostPerTxn,
		EstimatedTimeMin: selected.AvgSettlementMin,
		SuccessRate:      selected.SuccessRate,
	}
}

func (r *SmartRouter) UpdateBankAvailability(bank BankAvailability) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.bankAvailability[bank.BankCode] = bank
}

func (r *SmartRouter) UpdateRailStatus(rail PaymentRail, available bool, successRate float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if cfg, ok := r.rails[rail]; ok {
		cfg.Available = available
		cfg.SuccessRate = successRate
		r.rails[rail] = cfg
	}
}

func (r *SmartRouter) GetRailConfigs() map[PaymentRail]RailConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[PaymentRail]RailConfig, len(r.rails))
	for k, v := range r.rails {
		result[k] = v
	}
	return result
}

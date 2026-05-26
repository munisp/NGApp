package smartrouting

import (
	"fmt"
	"math"
	"sort"
	"sync"
	"time"
)

type PaymentRail string

const (
	RailNIP       PaymentRail = "NIP"
	RailNEFT      PaymentRail = "NEFT"
	RailRTGS      PaymentRail = "RTGS"
	RailMojaloop  PaymentRail = "MOJALOOP"
	RailSWIFT     PaymentRail = "SWIFT"
	RailMobileMon PaymentRail = "MOBILE_MONEY"
)

type RoutingCriteria struct {
	Amount         float64
	Currency       string
	Urgency        string // "instant", "same_day", "next_day", "scheduled"
	SenderBank     string
	ReceiverBank   string
	Corridor       string
	PaymentPurpose string
}

type RailOption struct {
	Rail            PaymentRail
	EstimatedCost   float64
	EstimatedTimeMs int64
	Availability    float64
	SuccessRate     float64
	Score           float64
}

type RailHealth struct {
	Rail              PaymentRail
	Available         bool
	CurrentTPS        float64
	MaxTPS            float64
	AvgLatencyMs      float64
	SuccessRate24h    float64
	LastFailure       time.Time
	CircuitBreakerOpen bool
}

type SmartRouter struct {
	mu         sync.RWMutex
	railHealth map[PaymentRail]*RailHealth
	costMatrix map[PaymentRail]map[string]float64
	weights    RoutingWeights
}

type RoutingWeights struct {
	CostWeight         float64
	SpeedWeight        float64
	ReliabilityWeight  float64
	AvailabilityWeight float64
}

func NewSmartRouter() *SmartRouter {
	r := &SmartRouter{
		railHealth: make(map[PaymentRail]*RailHealth),
		costMatrix: make(map[PaymentRail]map[string]float64),
		weights: RoutingWeights{
			CostWeight:         0.25,
			SpeedWeight:        0.30,
			ReliabilityWeight:  0.30,
			AvailabilityWeight: 0.15,
		},
	}
	r.initHealth()
	r.initCosts()
	return r
}

func (r *SmartRouter) initHealth() {
	r.railHealth[RailNIP] = &RailHealth{
		Rail: RailNIP, Available: true, CurrentTPS: 4523, MaxTPS: 15000,
		AvgLatencyMs: 1.8, SuccessRate24h: 99.2,
	}
	r.railHealth[RailNEFT] = &RailHealth{
		Rail: RailNEFT, Available: true, CurrentTPS: 250, MaxTPS: 5000,
		AvgLatencyMs: 3600000, SuccessRate24h: 99.8,
	}
	r.railHealth[RailRTGS] = &RailHealth{
		Rail: RailRTGS, Available: true, CurrentTPS: 50, MaxTPS: 1000,
		AvgLatencyMs: 60000, SuccessRate24h: 99.95,
	}
	r.railHealth[RailMojaloop] = &RailHealth{
		Rail: RailMojaloop, Available: true, CurrentTPS: 100, MaxTPS: 3000,
		AvgLatencyMs: 500, SuccessRate24h: 98.5,
	}
	r.railHealth[RailSWIFT] = &RailHealth{
		Rail: RailSWIFT, Available: true, CurrentTPS: 20, MaxTPS: 500,
		AvgLatencyMs: 7200000, SuccessRate24h: 99.9,
	}
}

func (r *SmartRouter) initCosts() {
	// Cost per transaction in NGN by rail and amount tier
	r.costMatrix[RailNIP] = map[string]float64{"<50K": 10, "50K-500K": 25, "500K-5M": 50, ">5M": 50}
	r.costMatrix[RailNEFT] = map[string]float64{"<50K": 5, "50K-500K": 10, "500K-5M": 20, ">5M": 30}
	r.costMatrix[RailRTGS] = map[string]float64{"<50K": 500, "50K-500K": 500, "500K-5M": 500, ">5M": 1000}
	r.costMatrix[RailMojaloop] = map[string]float64{"<50K": 15, "50K-500K": 30, "500K-5M": 60, ">5M": 100}
	r.costMatrix[RailSWIFT] = map[string]float64{"<50K": 2000, "50K-500K": 3000, "500K-5M": 5000, ">5M": 10000}
}

func (r *SmartRouter) Route(criteria *RoutingCriteria) ([]RailOption, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	candidates := r.getCandidateRails(criteria)
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no available rails for criteria: %+v", criteria)
	}

	options := make([]RailOption, 0, len(candidates))
	for _, rail := range candidates {
		health := r.railHealth[rail]
		if !health.Available || health.CircuitBreakerOpen {
			continue
		}

		cost := r.getCost(rail, criteria.Amount)
		option := RailOption{
			Rail:            rail,
			EstimatedCost:   cost,
			EstimatedTimeMs: int64(health.AvgLatencyMs),
			Availability:    1.0 - (health.CurrentTPS / health.MaxTPS),
			SuccessRate:     health.SuccessRate24h,
		}
		option.Score = r.scoreOption(&option, criteria)
		options = append(options, option)
	}

	sort.Slice(options, func(i, j int) bool { return options[i].Score > options[j].Score })
	return options, nil
}

func (r *SmartRouter) getCandidateRails(c *RoutingCriteria) []PaymentRail {
	var rails []PaymentRail

	isDomestic := c.Corridor == "" || c.Corridor == "NG-NG"

	if isDomestic {
		switch c.Urgency {
		case "instant":
			rails = append(rails, RailNIP)
			if c.Amount > 5_000_000 {
				rails = append(rails, RailRTGS)
			}
		case "same_day":
			rails = append(rails, RailNIP, RailNEFT)
			if c.Amount > 5_000_000 {
				rails = append(rails, RailRTGS)
			}
		case "next_day", "scheduled":
			rails = append(rails, RailNEFT)
			if c.Amount > 10_000_000 {
				rails = append(rails, RailRTGS)
			}
		default:
			rails = append(rails, RailNIP, RailNEFT)
		}
	} else {
		rails = append(rails, RailMojaloop, RailSWIFT)
		if c.Urgency == "instant" {
			rails = append(rails, RailNIP)
		}
	}

	return rails
}

func (r *SmartRouter) getCost(rail PaymentRail, amount float64) float64 {
	costs, ok := r.costMatrix[rail]
	if !ok {
		return 0
	}
	tier := r.getAmountTier(amount)
	if c, ok := costs[tier]; ok {
		return c
	}
	return 0
}

func (r *SmartRouter) getAmountTier(amount float64) string {
	switch {
	case amount < 50_000:
		return "<50K"
	case amount < 500_000:
		return "50K-500K"
	case amount < 5_000_000:
		return "500K-5M"
	default:
		return ">5M"
	}
}

func (r *SmartRouter) scoreOption(opt *RailOption, criteria *RoutingCriteria) float64 {
	costScore := 1.0 - math.Min(opt.EstimatedCost/10000.0, 1.0)
	speedScore := 1.0 - math.Min(float64(opt.EstimatedTimeMs)/86400000.0, 1.0)
	reliabilityScore := opt.SuccessRate / 100.0
	availScore := opt.Availability

	return costScore*r.weights.CostWeight +
		speedScore*r.weights.SpeedWeight +
		reliabilityScore*r.weights.ReliabilityWeight +
		availScore*r.weights.AvailabilityWeight
}

func (r *SmartRouter) GetRailHealth() map[PaymentRail]*RailHealth {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[PaymentRail]*RailHealth)
	for k, v := range r.railHealth {
		copied := *v
		result[k] = &copied
	}
	return result
}

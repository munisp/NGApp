// Package main implements the NDSEP Digital Twin of Nigeria's Data Ecosystem.
//
// Provides simulation capabilities for:
// - Data flow modeling across sectors (banking, telecom, healthcare, energy)
// - Regulatory impact analysis (what-if scenarios for policy changes)
// - Breach probability prediction using historical patterns
// - Cross-border transfer visualization
// - Compliance score forecasting
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
)

// ── Types ───────────────────────────────────────────────────────────────────

type Sector struct {
	Name              string   `json:"name"`
	Organizations     int      `json:"organizations"`
	AvgComplianceScore float64 `json:"avg_compliance_score"`
	DataFlowsInternal int      `json:"data_flows_internal"`
	DataFlowsCross    int      `json:"data_flows_cross_border"`
	BreachRate         float64 `json:"breach_rate_annual"`
	AvgPenaltyNGN     float64 `json:"avg_penalty_ngn"`
	RiskFactors       []string `json:"risk_factors"`
}

type DataFlow struct {
	Source      string  `json:"source"`
	Destination string  `json:"destination"`
	Volume      float64 `json:"volume_gb_per_month"`
	Encrypted   bool    `json:"encrypted"`
	CrossBorder bool    `json:"cross_border"`
	Compliant   bool    `json:"compliant"`
	Sector      string  `json:"sector"`
}

type SimulationRequest struct {
	Scenario   string            `json:"scenario"`
	Parameters map[string]float64 `json:"parameters"`
	Duration   int               `json:"duration_months"`
}

type SimulationResult struct {
	ScenarioID        string                  `json:"scenario_id"`
	Scenario          string                  `json:"scenario"`
	Duration          int                     `json:"duration_months"`
	Timeline          []TimelinePoint         `json:"timeline"`
	SectorImpacts     map[string]SectorImpact `json:"sector_impacts"`
	OverallCompliance float64                 `json:"overall_compliance_change"`
	PenaltyDelta      float64                 `json:"penalty_delta_ngn"`
	BreachDelta       float64                 `json:"breach_delta_percent"`
	Recommendations   []string                `json:"recommendations"`
	SimulatedAt       string                  `json:"simulated_at"`
}

type TimelinePoint struct {
	Month             int     `json:"month"`
	AvgCompliance     float64 `json:"avg_compliance"`
	TotalPenalties    float64 `json:"total_penalties_ngn"`
	BreachCount       int     `json:"breach_count"`
	CrossBorderFlows  int     `json:"cross_border_flows"`
}

type SectorImpact struct {
	Sector          string  `json:"sector"`
	ComplianceDelta float64 `json:"compliance_delta"`
	PenaltyDelta    float64 `json:"penalty_delta_ngn"`
	BreachDelta     float64 `json:"breach_delta_percent"`
	RiskLevel       string  `json:"risk_level"`
}

type BreachPrediction struct {
	OrgID            int     `json:"org_id"`
	OrgName          string  `json:"org_name"`
	Sector           string  `json:"sector"`
	Probability30d   float64 `json:"probability_30d"`
	Probability90d   float64 `json:"probability_90d"`
	TopRiskFactors   []string `json:"top_risk_factors"`
	RecommendedAction string  `json:"recommended_action"`
}

type EcosystemState struct {
	Sectors     []Sector    `json:"sectors"`
	DataFlows   []DataFlow  `json:"data_flows"`
	TotalOrgs   int         `json:"total_organizations"`
	AvgScore    float64     `json:"avg_compliance_score"`
	TotalFlows  int         `json:"total_data_flows"`
	CrossBorder int         `json:"cross_border_flows"`
	UpdatedAt   string      `json:"updated_at"`
}

// ── Digital Twin Engine ─────────────────────────────────────────────────────

type DigitalTwin struct {
	mu        sync.RWMutex
	sectors   []Sector
	dataFlows []DataFlow
	history   []SimulationResult
}

func NewDigitalTwin() *DigitalTwin {
	return &DigitalTwin{
		sectors: []Sector{
			{Name: "Banking", Organizations: 45, AvgComplianceScore: 78.5, DataFlowsInternal: 12000, DataFlowsCross: 890, BreachRate: 0.12, AvgPenaltyNGN: 5_200_000, RiskFactors: []string{"high-value transactions", "cross-border transfers", "mobile banking growth"}},
			{Name: "Telecom", Organizations: 12, AvgComplianceScore: 72.3, DataFlowsInternal: 45000, DataFlowsCross: 2300, BreachRate: 0.08, AvgPenaltyNGN: 3_800_000, RiskFactors: []string{"massive subscriber data", "location tracking", "USSD data"}},
			{Name: "Healthcare", Organizations: 28, AvgComplianceScore: 65.1, DataFlowsInternal: 8000, DataFlowsCross: 340, BreachRate: 0.15, AvgPenaltyNGN: 4_500_000, RiskFactors: []string{"sensitive health data", "legacy systems", "interoperability gaps"}},
			{Name: "Insurance", Organizations: 35, AvgComplianceScore: 70.8, DataFlowsInternal: 5000, DataFlowsCross: 280, BreachRate: 0.09, AvgPenaltyNGN: 2_900_000, RiskFactors: []string{"health data processing", "third-party underwriters", "claims fraud detection"}},
			{Name: "Energy", Organizations: 18, AvgComplianceScore: 68.9, DataFlowsInternal: 3000, DataFlowsCross: 120, BreachRate: 0.06, AvgPenaltyNGN: 1_500_000, RiskFactors: []string{"smart meter data", "SCADA systems", "rural access gaps"}},
			{Name: "Education", Organizations: 60, AvgComplianceScore: 55.2, DataFlowsInternal: 6000, DataFlowsCross: 450, BreachRate: 0.18, AvgPenaltyNGN: 800_000, RiskFactors: []string{"student records", "edtech platforms", "low security budgets"}},
		},
		dataFlows: generateDataFlows(),
	}
}

func generateDataFlows() []DataFlow {
	flows := []DataFlow{
		{Source: "Lagos", Destination: "Abuja", Volume: 450.0, Encrypted: true, CrossBorder: false, Compliant: true, Sector: "Banking"},
		{Source: "Lagos", Destination: "London", Volume: 120.0, Encrypted: true, CrossBorder: true, Compliant: true, Sector: "Banking"},
		{Source: "Kano", Destination: "Lagos", Volume: 280.0, Encrypted: true, CrossBorder: false, Compliant: true, Sector: "Telecom"},
		{Source: "Lagos", Destination: "Dublin", Volume: 85.0, Encrypted: true, CrossBorder: true, Compliant: false, Sector: "Telecom"},
		{Source: "Abuja", Destination: "Geneva", Volume: 30.0, Encrypted: true, CrossBorder: true, Compliant: true, Sector: "Healthcare"},
		{Source: "Port Harcourt", Destination: "Lagos", Volume: 65.0, Encrypted: false, CrossBorder: false, Compliant: false, Sector: "Energy"},
		{Source: "Lagos", Destination: "Accra", Volume: 40.0, Encrypted: true, CrossBorder: true, Compliant: true, Sector: "Insurance"},
		{Source: "Ibadan", Destination: "Lagos", Volume: 180.0, Encrypted: true, CrossBorder: false, Compliant: true, Sector: "Education"},
	}
	return flows
}

func (dt *DigitalTwin) Simulate(req SimulationRequest) SimulationResult {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	result := SimulationResult{
		ScenarioID:    fmt.Sprintf("sim_%d", time.Now().UnixNano()),
		Scenario:      req.Scenario,
		Duration:      req.Duration,
		SectorImpacts: make(map[string]SectorImpact),
		SimulatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	// Base parameters
	slaChange := req.Parameters["breach_sla_hours"]
	penaltyMultiplier := req.Parameters["penalty_multiplier"]
	complianceThreshold := req.Parameters["compliance_threshold"]

	if slaChange == 0 {
		slaChange = 72 // current NDPA requirement
	}
	if penaltyMultiplier == 0 {
		penaltyMultiplier = 1.0
	}
	if complianceThreshold == 0 {
		complianceThreshold = 70.0
	}

	// Simulate timeline
	for month := 1; month <= req.Duration; month++ {
		point := TimelinePoint{Month: month}
		totalScore := 0.0
		for _, sector := range dt.sectors {
			// Compliance improves ~0.5-2% per month with enforcement
			improvement := (100 - sector.AvgComplianceScore) * 0.02 * penaltyMultiplier
			noise := r.NormFloat64() * 1.5
			newScore := math.Min(100, sector.AvgComplianceScore+improvement*float64(month)+noise)
			totalScore += newScore

			// Stricter SLA reduces breach rate
			slaFactor := 72.0 / slaChange // tighter SLA = more pressure
			breachReduction := (1 - sector.BreachRate) * 0.01 * slaFactor * float64(month)
			point.BreachCount += int(math.Max(0, float64(sector.Organizations)*sector.BreachRate*(1-breachReduction)))
			point.TotalPenalties += sector.AvgPenaltyNGN * penaltyMultiplier * float64(point.BreachCount)
		}
		point.AvgCompliance = totalScore / float64(len(dt.sectors))
		point.CrossBorderFlows = 4380 + month*50 // growing
		result.Timeline = append(result.Timeline, point)
	}

	// Sector-specific impacts
	for _, sector := range dt.sectors {
		compDelta := (100 - sector.AvgComplianceScore) * 0.02 * float64(req.Duration) * penaltyMultiplier
		penDelta := sector.AvgPenaltyNGN * (penaltyMultiplier - 1) * float64(sector.Organizations) * sector.BreachRate
		breachDelta := -sector.BreachRate * 0.1 * float64(req.Duration) * (72.0 / slaChange)

		riskLevel := "low"
		if sector.AvgComplianceScore+compDelta < complianceThreshold {
			riskLevel = "critical"
		} else if compDelta < 5 {
			riskLevel = "high"
		} else if compDelta < 10 {
			riskLevel = "medium"
		}

		result.SectorImpacts[sector.Name] = SectorImpact{
			Sector:          sector.Name,
			ComplianceDelta: math.Round(compDelta*100) / 100,
			PenaltyDelta:    math.Round(penDelta),
			BreachDelta:     math.Round(breachDelta*10000) / 100,
			RiskLevel:       riskLevel,
		}
	}

	// Overall metrics
	if len(result.Timeline) > 0 {
		last := result.Timeline[len(result.Timeline)-1]
		first := result.Timeline[0]
		result.OverallCompliance = math.Round((last.AvgCompliance-first.AvgCompliance)*100) / 100
		result.PenaltyDelta = last.TotalPenalties - first.TotalPenalties
		if first.BreachCount > 0 {
			result.BreachDelta = math.Round(float64(last.BreachCount-first.BreachCount)/float64(first.BreachCount)*10000) / 100
		}
	}

	// Recommendations
	for name, impact := range result.SectorImpacts {
		if impact.RiskLevel == "critical" {
			result.Recommendations = append(result.Recommendations, fmt.Sprintf("URGENT: %s sector needs immediate intervention — compliance below threshold", name))
		}
		if impact.BreachDelta > 0 {
			result.Recommendations = append(result.Recommendations, fmt.Sprintf("%s: Breach rate increasing — recommend mandatory security audit", name))
		}
	}
	if slaChange < 72 {
		result.Recommendations = append(result.Recommendations, "Tighter breach SLA will require additional notification infrastructure investment")
	}

	dt.history = append(dt.history, result)
	return result
}

func (dt *DigitalTwin) PredictBreaches(orgCount int) []BreachPrediction {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	predictions := make([]BreachPrediction, 0, orgCount)

	for i := 0; i < orgCount; i++ {
		sector := dt.sectors[i%len(dt.sectors)]
		base30d := sector.BreachRate / 12.0
		base90d := sector.BreachRate / 4.0

		// Add variance based on compliance score
		compFactor := (100 - sector.AvgComplianceScore) / 100.0
		noise := r.Float64() * 0.05

		p30 := math.Min(1.0, base30d*(1+compFactor)+noise)
		p90 := math.Min(1.0, base90d*(1+compFactor)+noise*2)

		action := "Continue monitoring"
		if p30 > 0.05 {
			action = "Schedule compliance audit"
		}
		if p30 > 0.1 {
			action = "Immediate security assessment required"
		}

		predictions = append(predictions, BreachPrediction{
			OrgID:             1000 + i,
			OrgName:           fmt.Sprintf("Org-%s-%d", sector.Name[:3], i),
			Sector:            sector.Name,
			Probability30d:    math.Round(p30*10000) / 100,
			Probability90d:    math.Round(p90*10000) / 100,
			TopRiskFactors:    sector.RiskFactors,
			RecommendedAction: action,
		})
	}

	return predictions
}

func (dt *DigitalTwin) GetState() EcosystemState {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	totalOrgs := 0
	totalScore := 0.0
	crossBorder := 0
	for _, s := range dt.sectors {
		totalOrgs += s.Organizations
		totalScore += s.AvgComplianceScore * float64(s.Organizations)
		crossBorder += s.DataFlowsCross
	}

	return EcosystemState{
		Sectors:     dt.sectors,
		DataFlows:   dt.dataFlows,
		TotalOrgs:   totalOrgs,
		AvgScore:    math.Round(totalScore/float64(totalOrgs)*100) / 100,
		TotalFlows:  len(dt.dataFlows),
		CrossBorder: crossBorder,
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
}

// ── HTTP Handlers ───────────────────────────────────────────────────────────

func main() {
	dt := NewDigitalTwin()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "digital-twin"})
	})

	mux.HandleFunc("/api/v1/twin/state", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(dt.GetState())
	})

	mux.HandleFunc("/api/v1/twin/simulate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "POST only", http.StatusMethodNotAllowed)
			return
		}
		var req SimulationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.Duration == 0 {
			req.Duration = 12
		}
		result := dt.Simulate(req)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	mux.HandleFunc("/api/v1/twin/predict-breaches", func(w http.ResponseWriter, _ *http.Request) {
		predictions := dt.PredictBreaches(30)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"predictions": predictions,
			"total":       len(predictions),
		})
	})

	mux.HandleFunc("/api/v1/twin/history", func(w http.ResponseWriter, _ *http.Request) {
		dt.mu.RLock()
		defer dt.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"simulations": dt.history,
			"total":       len(dt.history),
		})
	})

	port := os.Getenv("DIGITAL_TWIN_PORT")
	if port == "" {
		port = "8175"
	}
	addr := ":" + port
	log.Printf("Digital Twin service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

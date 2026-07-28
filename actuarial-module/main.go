package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"time"
)

// ActuarialService provides actuarial calculations and reserving
type ActuarialService struct{}

// MortalityTable represents a mortality table
type MortalityTable struct {
	Name        string             `json:"name"`
	Type        string             `json:"type"`
	BaseYear    int                `json:"base_year"`
	Rates       map[int]float64    `json:"rates"` // age -> mortality rate
}

// ReserveCalculation represents reserve calculation result
type ReserveCalculation struct {
	PolicyID           string    `json:"policy_id"`
	ValuationDate      time.Time `json:"valuation_date"`
	GrossReserve       float64   `json:"gross_reserve"`
	NetReserve         float64   `json:"net_reserve"`
	UnearnedPremium    float64   `json:"unearned_premium"`
	IBNR               float64   `json:"ibnr"`
	ClaimsReserve      float64   `json:"claims_reserve"`
	Method             string    `json:"method"`
	Assumptions        map[string]float64 `json:"assumptions"`
}

// PremiumCalculation represents premium calculation
type PremiumCalculation struct {
	ProductType        string    `json:"product_type"`
	SumAssured         float64   `json:"sum_assured"`
	Term               int       `json:"term_years"`
	Age                int       `json:"age"`
	Gender             string    `json:"gender"`
	GrossPremium       float64   `json:"gross_premium"`
	NetPremium         float64   `json:"net_premium"`
	LoadingFactor      float64   `json:"loading_factor"`
	ExpenseLoading     float64   `json:"expense_loading"`
	ProfitMargin       float64   `json:"profit_margin"`
	DiscountRate       float64   `json:"discount_rate"`
	MortalityTable     string    `json:"mortality_table"`
}

// LossRatioAnalysis represents loss ratio analysis
type LossRatioAnalysis struct {
	Period             string    `json:"period"`
	ProductLine        string    `json:"product_line"`
	EarnedPremium      float64   `json:"earned_premium"`
	IncurredClaims     float64   `json:"incurred_claims"`
	LossRatio          float64   `json:"loss_ratio"`
	ExpenseRatio       float64   `json:"expense_ratio"`
	CombinedRatio      float64   `json:"combined_ratio"`
	Trend              string    `json:"trend"`
}

// TriangleData represents claims development triangle
type TriangleData struct {
	AccidentYear       int       `json:"accident_year"`
	DevelopmentMonths  []int     `json:"development_months"`
	CumulativeClaims   []float64 `json:"cumulative_claims"`
	DevelopmentFactors []float64 `json:"development_factors"`
}

// IBNRCalculation represents IBNR calculation
type IBNRCalculation struct {
	Method             string           `json:"method"`
	ValuationDate      time.Time        `json:"valuation_date"`
	Triangle           []TriangleData   `json:"triangle"`
	TotalIBNR          float64          `json:"total_ibnr"`
	ByAccidentYear     map[int]float64  `json:"by_accident_year"`
	ConfidenceInterval []float64        `json:"confidence_interval"`
}

// RiskBasedCapital represents RBC calculation
type RiskBasedCapital struct {
	InsuranceRisk      float64   `json:"insurance_risk"`
	AssetRisk          float64   `json:"asset_risk"`
	InterestRateRisk   float64   `json:"interest_rate_risk"`
	OperationalRisk    float64   `json:"operational_risk"`
	TotalRBC           float64   `json:"total_rbc"`
	AvailableCapital   float64   `json:"available_capital"`
	RBCRatio           float64   `json:"rbc_ratio"`
	Status             string    `json:"status"`
}

// SolvencyAnalysis represents solvency analysis
type SolvencyAnalysis struct {
	TotalAssets        float64   `json:"total_assets"`
	TotalLiabilities   float64   `json:"total_liabilities"`
	NetAssets          float64   `json:"net_assets"`
	RequiredCapital    float64   `json:"required_capital"`
	SolvencyRatio      float64   `json:"solvency_ratio"`
	NAICOMMinimum      float64   `json:"naicom_minimum"`
	Compliant          bool      `json:"compliant"`
}

// Nigerian mortality table (simplified)
var nigerianMortalityTable = MortalityTable{
	Name:     "Nigerian Life Table 2019",
	Type:     "aggregate",
	BaseYear: 2019,
	Rates: map[int]float64{
		20: 0.00150, 25: 0.00180, 30: 0.00220, 35: 0.00280,
		40: 0.00380, 45: 0.00520, 50: 0.00750, 55: 0.01100,
		60: 0.01650, 65: 0.02500, 70: 0.03800, 75: 0.05800,
		80: 0.08900, 85: 0.13500, 90: 0.20000,
	},
}

func NewActuarialService() *ActuarialService {
	return &ActuarialService{}
}

// CalculateLifePremium calculates life insurance premium
func (s *ActuarialService) CalculateLifePremium(productType string, sumAssured float64, term, age int, gender string) *PremiumCalculation {
	// Get mortality rate
	qx := s.getMortalityRate(age)
	if gender == "female" {
		qx *= 0.85 // Female mortality adjustment
	}
	
	// Discount rate (Nigerian risk-free rate + spread)
	discountRate := 0.14 // 14% for Nigeria
	
	// Calculate net premium using actuarial present value
	var netPremium float64
	
	switch productType {
	case "term_life":
		// Term life: sum of discounted death benefits
		pvBenefits := 0.0
		pvAnnuity := 0.0
		lx := 100000.0 // Starting lives
		
		for t := 0; t < term; t++ {
			currentAge := age + t
			qxT := s.getMortalityRate(currentAge)
			dx := lx * qxT
			
			// PV of death benefit
			pvBenefits += dx * sumAssured * math.Pow(1+discountRate, -float64(t+1))
			
			// PV of annuity
			pvAnnuity += lx * math.Pow(1+discountRate, -float64(t))
			
			lx -= dx
		}
		
		netPremium = pvBenefits / pvAnnuity
		
	case "whole_life":
		// Whole life: benefits to age 100
		netPremium = sumAssured * qx * (1 + discountRate) / discountRate
		
	case "endowment":
		// Endowment: death benefit + maturity benefit
		pvDeathBenefit := sumAssured * qx * float64(term) / (1 + discountRate)
		pvMaturity := sumAssured * math.Pow(1+discountRate, -float64(term))
		netPremium = (pvDeathBenefit + pvMaturity) / float64(term)
	}
	
	// Apply loadings
	expenseLoading := 0.25  // 25% expense loading
	profitMargin := 0.10    // 10% profit margin
	loadingFactor := 1 + expenseLoading + profitMargin
	
	grossPremium := netPremium * loadingFactor
	
	return &PremiumCalculation{
		ProductType:    productType,
		SumAssured:     sumAssured,
		Term:           term,
		Age:            age,
		Gender:         gender,
		GrossPremium:   math.Round(grossPremium*100) / 100,
		NetPremium:     math.Round(netPremium*100) / 100,
		LoadingFactor:  loadingFactor,
		ExpenseLoading: expenseLoading,
		ProfitMargin:   profitMargin,
		DiscountRate:   discountRate,
		MortalityTable: nigerianMortalityTable.Name,
	}
}

// CalculateMotorPremium calculates motor insurance premium
func (s *ActuarialService) CalculateMotorPremium(vehicleValue float64, vehicleType, coverType string, driverAge int, claimsHistory int) float64 {
	// Base rates by cover type
	baseRates := map[string]float64{
		"third_party":           0.0075,  // 0.75%
		"third_party_fire_theft": 0.015,  // 1.5%
		"comprehensive":         0.03,    // 3%
	}
	
	baseRate := baseRates[coverType]
	if baseRate == 0 {
		baseRate = 0.03
	}
	
	// Vehicle type factor
	vehicleFactors := map[string]float64{
		"saloon":     1.0,
		"suv":        1.15,
		"pickup":     1.10,
		"bus":        1.25,
		"truck":      1.40,
		"motorcycle": 0.80,
		"tricycle":   0.85,
	}
	
	vehicleFactor := vehicleFactors[vehicleType]
	if vehicleFactor == 0 {
		vehicleFactor = 1.0
	}
	
	// Age factor
	ageFactor := 1.0
	if driverAge < 25 {
		ageFactor = 1.30
	} else if driverAge > 65 {
		ageFactor = 1.20
	}
	
	// Claims history factor (no claims discount)
	claimsFactor := 1.0
	if claimsHistory == 0 {
		claimsFactor = 0.85 // 15% NCD
	} else if claimsHistory > 2 {
		claimsFactor = 1.25 // 25% loading
	}
	
	// Calculate premium
	premium := vehicleValue * baseRate * vehicleFactor * ageFactor * claimsFactor
	
	// Minimum premium
	minPremiums := map[string]float64{
		"third_party":           15000,
		"third_party_fire_theft": 25000,
		"comprehensive":         45000,
	}
	
	if premium < minPremiums[coverType] {
		premium = minPremiums[coverType]
	}
	
	return math.Round(premium*100) / 100
}

// CalculateReserves calculates policy reserves
func (s *ActuarialService) CalculateReserves(policyID string, productType string, sumAssured, premiumPaid float64, policyAge int) *ReserveCalculation {
	// Unearned premium reserve (pro-rata)
	unearnedPremium := premiumPaid * float64(12-policyAge%12) / 12
	
	// Claims reserve (based on expected claims)
	expectedClaimsRatio := 0.65
	claimsReserve := premiumPaid * expectedClaimsRatio
	
	// IBNR (Incurred But Not Reported)
	ibnrFactor := 0.10
	ibnr := claimsReserve * ibnrFactor
	
	// Gross reserve
	grossReserve := unearnedPremium + claimsReserve + ibnr
	
	// Net reserve (after reinsurance)
	reinsuranceRecovery := 0.25
	netReserve := grossReserve * (1 - reinsuranceRecovery)
	
	return &ReserveCalculation{
		PolicyID:        policyID,
		ValuationDate:   time.Now(),
		GrossReserve:    math.Round(grossReserve*100) / 100,
		NetReserve:      math.Round(netReserve*100) / 100,
		UnearnedPremium: math.Round(unearnedPremium*100) / 100,
		IBNR:            math.Round(ibnr*100) / 100,
		ClaimsReserve:   math.Round(claimsReserve*100) / 100,
		Method:          "Chain Ladder",
		Assumptions: map[string]float64{
			"expected_claims_ratio":  expectedClaimsRatio,
			"ibnr_factor":            ibnrFactor,
			"reinsurance_recovery":   reinsuranceRecovery,
		},
	}
}

// CalculateIBNR calculates IBNR using Chain Ladder method
func (s *ActuarialService) CalculateIBNR(triangleData []TriangleData) *IBNRCalculation {
	// Calculate development factors
	totalIBNR := 0.0
	byAccidentYear := make(map[int]float64)
	
	for _, row := range triangleData {
		if len(row.CumulativeClaims) > 0 {
			// Ultimate claims estimate
			lastClaim := row.CumulativeClaims[len(row.CumulativeClaims)-1]
			ultimateFactor := 1.05 // Simplified tail factor
			ultimateClaims := lastClaim * ultimateFactor
			
			ibnr := ultimateClaims - lastClaim
			byAccidentYear[row.AccidentYear] = ibnr
			totalIBNR += ibnr
		}
	}
	
	return &IBNRCalculation{
		Method:             "Chain Ladder",
		ValuationDate:      time.Now(),
		Triangle:           triangleData,
		TotalIBNR:          math.Round(totalIBNR*100) / 100,
		ByAccidentYear:     byAccidentYear,
		ConfidenceInterval: []float64{totalIBNR * 0.85, totalIBNR * 1.15},
	}
}

// CalculateLossRatio calculates loss ratio analysis
func (s *ActuarialService) CalculateLossRatio(earnedPremium, incurredClaims, expenses float64) *LossRatioAnalysis {
	lossRatio := incurredClaims / earnedPremium
	expenseRatio := expenses / earnedPremium
	combinedRatio := lossRatio + expenseRatio
	
	trend := "stable"
	if combinedRatio > 1.0 {
		trend = "deteriorating"
	} else if combinedRatio < 0.85 {
		trend = "improving"
	}
	
	return &LossRatioAnalysis{
		Period:         time.Now().Format("2006-Q1"),
		EarnedPremium:  earnedPremium,
		IncurredClaims: incurredClaims,
		LossRatio:      math.Round(lossRatio*10000) / 100,
		ExpenseRatio:   math.Round(expenseRatio*10000) / 100,
		CombinedRatio:  math.Round(combinedRatio*10000) / 100,
		Trend:          trend,
	}
}

// CalculateRBC calculates Risk-Based Capital
func (s *ActuarialService) CalculateRBC(insuranceRisk, assetRisk, interestRateRisk, operationalRisk, availableCapital float64) *RiskBasedCapital {
	// RBC formula (simplified NAICOM approach)
	totalRBC := math.Sqrt(
		math.Pow(insuranceRisk, 2) +
		math.Pow(assetRisk, 2) +
		math.Pow(interestRateRisk, 2) +
		math.Pow(operationalRisk, 2),
	)
	
	rbcRatio := availableCapital / totalRBC * 100
	
	status := "Adequate"
	if rbcRatio < 100 {
		status = "Company Action Level"
	} else if rbcRatio < 150 {
		status = "Regulatory Action Level"
	} else if rbcRatio < 200 {
		status = "Authorized Control Level"
	}
	
	return &RiskBasedCapital{
		InsuranceRisk:    insuranceRisk,
		AssetRisk:        assetRisk,
		InterestRateRisk: interestRateRisk,
		OperationalRisk:  operationalRisk,
		TotalRBC:         math.Round(totalRBC*100) / 100,
		AvailableCapital: availableCapital,
		RBCRatio:         math.Round(rbcRatio*100) / 100,
		Status:           status,
	}
}

// CalculateSolvency calculates solvency position
func (s *ActuarialService) CalculateSolvency(totalAssets, totalLiabilities float64) *SolvencyAnalysis {
	netAssets := totalAssets - totalLiabilities
	
	// NAICOM minimum capital requirement
	naicomMinimum := 3000000000.0 // N3 billion for life insurance
	
	// Required capital (simplified)
	requiredCapital := totalLiabilities * 0.15 // 15% of liabilities
	if requiredCapital < naicomMinimum {
		requiredCapital = naicomMinimum
	}
	
	solvencyRatio := netAssets / requiredCapital * 100
	
	return &SolvencyAnalysis{
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		NetAssets:        netAssets,
		RequiredCapital:  requiredCapital,
		SolvencyRatio:    math.Round(solvencyRatio*100) / 100,
		NAICOMMinimum:    naicomMinimum,
		Compliant:        netAssets >= requiredCapital,
	}
}

func (s *ActuarialService) getMortalityRate(age int) float64 {
	// Interpolate mortality rate
	if rate, ok := nigerianMortalityTable.Rates[age]; ok {
		return rate
	}
	
	// Find nearest ages
	lowerAge := (age / 5) * 5
	upperAge := lowerAge + 5
	
	lowerRate := nigerianMortalityTable.Rates[lowerAge]
	upperRate := nigerianMortalityTable.Rates[upperAge]
	
	if lowerRate == 0 || upperRate == 0 {
		return 0.01 // Default rate
	}
	
	// Linear interpolation
	return lowerRate + (upperRate-lowerRate)*float64(age-lowerAge)/5
}

// HTTP Handlers
func (s *ActuarialService) HandleLifePremium(w http.ResponseWriter, r *http.Request) {
	type Request struct {
		ProductType string  `json:"product_type"`
		SumAssured  float64 `json:"sum_assured"`
		Term        int     `json:"term"`
		Age         int     `json:"age"`
		Gender      string  `json:"gender"`
	}
	
	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	result := s.CalculateLifePremium(req.ProductType, req.SumAssured, req.Term, req.Age, req.Gender)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *ActuarialService) HandleMotorPremium(w http.ResponseWriter, r *http.Request) {
	type Request struct {
		VehicleValue  float64 `json:"vehicle_value"`
		VehicleType   string  `json:"vehicle_type"`
		CoverType     string  `json:"cover_type"`
		DriverAge     int     `json:"driver_age"`
		ClaimsHistory int     `json:"claims_history"`
	}
	
	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	premium := s.CalculateMotorPremium(req.VehicleValue, req.VehicleType, req.CoverType, req.DriverAge, req.ClaimsHistory)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"premium":       premium,
		"vehicle_value": req.VehicleValue,
		"cover_type":    req.CoverType,
	})
}

func (s *ActuarialService) HandleReserves(w http.ResponseWriter, r *http.Request) {
	type Request struct {
		PolicyID    string  `json:"policy_id"`
		ProductType string  `json:"product_type"`
		SumAssured  float64 `json:"sum_assured"`
		PremiumPaid float64 `json:"premium_paid"`
		PolicyAge   int     `json:"policy_age_months"`
	}
	
	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	result := s.CalculateReserves(req.PolicyID, req.ProductType, req.SumAssured, req.PremiumPaid, req.PolicyAge)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *ActuarialService) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "actuarial-module",
		"timestamp": time.Now(),
		"features": []string{
			"life_premium_calculation",
			"motor_premium_calculation",
			"reserve_calculation",
			"ibnr_calculation",
			"loss_ratio_analysis",
			"rbc_calculation",
			"solvency_analysis",
		},
	})
}

func main() {
	service := NewActuarialService()
	
	http.HandleFunc("/api/actuarial/life-premium", service.HandleLifePremium)
	http.HandleFunc("/api/actuarial/motor-premium", service.HandleMotorPremium)
	http.HandleFunc("/api/actuarial/reserves", service.HandleReserves)
	http.HandleFunc("/health", service.HandleHealth)
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	log.Printf("Actuarial Module starting on port %s", port)
	fmt.Println("Features: Life Premium, Motor Premium, Reserves, IBNR, Loss Ratio, RBC, Solvency")
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

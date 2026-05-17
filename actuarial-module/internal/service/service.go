package service

import (
	"actuarial-module/internal/models"
	"actuarial-module/internal/repository"
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// Nigerian mortality rates by age (A67/70 modified for Nigerian population)
var nigerianMortalityRates = map[int]float64{
	0: 0.07200, 1: 0.01200, 2: 0.00800, 3: 0.00600, 4: 0.00500,
	5: 0.00400, 10: 0.00300, 15: 0.00350, 20: 0.00400, 25: 0.00450,
	30: 0.00550, 35: 0.00700, 40: 0.00950, 45: 0.01350, 50: 0.01900,
	55: 0.02700, 60: 0.03800, 65: 0.05400, 70: 0.07700, 75: 0.11000,
	80: 0.15500, 85: 0.22000, 90: 0.30000, 95: 0.42000, 100: 1.00000,
}

// Motor vehicle loss factors by vehicle type
var motorLossFactors = map[string]float64{
	"private_car":      0.065,
	"commercial":       0.085,
	"motorcycle":       0.120,
	"truck":            0.095,
	"bus":              0.110,
	"taxi":             0.130,
	"government":       0.050,
	"diplomatic":       0.040,
}

// Nigerian region risk factors
var regionRiskFactors = map[string]float64{
	"lagos":       1.30,
	"abuja":      1.15,
	"rivers":     1.20,
	"kano":       1.10,
	"oyo":        1.05,
	"anambra":    1.08,
	"delta":      1.12,
	"other":      1.00,
}

type ActuarialService struct {
	repo *repository.ActuarialRepository
}

func NewActuarialService(repo *repository.ActuarialRepository) *ActuarialService {
	return &ActuarialService{repo: repo}
}

// CalculateLifePremium calculates life insurance premium using actuarial principles
func (s *ActuarialService) CalculateLifePremium(ctx context.Context, req LifePremiumRequest) (*models.PremiumCalculation, error) {
	if req.Age < 18 || req.Age > 70 {
		return nil, fmt.Errorf("age must be between 18 and 70, got %d", req.Age)
	}
	if req.SumAssured <= 0 {
		return nil, fmt.Errorf("sum assured must be positive")
	}
	if req.TermYears <= 0 || req.TermYears > 40 {
		return nil, fmt.Errorf("term must be between 1 and 40 years")
	}

	// Get mortality rate for age (interpolate if needed)
	qx := s.getMortalityRate(req.Age)

	// Apply gender adjustment
	genderFactor := 1.0
	if req.Gender == "female" {
		genderFactor = 0.85 // females have lower mortality
	}
	qx *= genderFactor

	// Apply smoker loading
	if req.IsSmoker {
		qx *= 1.50
	}

	// Apply occupation hazard loading
	occFactor := s.getOccupationFactor(req.OccupationClass)
	qx *= occFactor

	// Calculate net single premium (NSP) using commutation functions
	discountRate := 0.10 // Nigerian risk-free rate approximation
	if req.DiscountRate > 0 {
		discountRate = req.DiscountRate
	}

	nsp := s.calculateNSP(req.Age, req.TermYears, req.SumAssured, qx, discountRate, req.ProductType)

	// Convert to annual premium using annuity factor
	annuityFactor := s.calculateAnnuityDue(req.Age, req.TermYears, qx, discountRate)
	netPremium := nsp / annuityFactor

	// Apply loadings
	expenseLoading := 0.25 // 25% expense loading
	profitMargin := 0.10   // 10% profit margin
	commissionLoading := 0.15 // 15% commission

	grossPremium := netPremium / (1.0 - expenseLoading - profitMargin - commissionLoading)

	// Apply minimum premium
	if grossPremium < 5000.0 { // NGN 5,000 minimum
		grossPremium = 5000.0
	}

	calc := &models.PremiumCalculation{
		QuoteID:        req.QuoteID,
		ProductCode:    req.ProductCode,
		ProductType:    req.ProductType,
		SumAssured:     req.SumAssured,
		Term:           req.TermYears,
		Age:            req.Age,
		Gender:         req.Gender,
		GrossPremium:   math.Round(grossPremium*100) / 100,
		NetPremium:     math.Round(netPremium*100) / 100,
		LoadingFactor:  occFactor * genderFactor,
		ExpenseLoading: expenseLoading,
		ProfitMargin:   profitMargin,
		DiscountRate:   discountRate,
		MortalityTable: "NG_A67_70_Modified",
		RiskClass:      req.OccupationClass,
	}

	if err := s.repo.SavePremiumCalculation(ctx, calc); err != nil {
		return nil, fmt.Errorf("failed to save premium calculation: %w", err)
	}

	return calc, nil
}

// CalculateMotorPremium calculates motor insurance premium
func (s *ActuarialService) CalculateMotorPremium(ctx context.Context, req MotorPremiumRequest) (*models.PremiumCalculation, error) {
	if req.VehicleValue <= 0 {
		return nil, fmt.Errorf("vehicle value must be positive")
	}

	// Base rate from vehicle type
	baseFactor, ok := motorLossFactors[req.VehicleType]
	if !ok {
		baseFactor = motorLossFactors["private_car"]
	}

	// Age of vehicle factor
	vehicleAgeFactor := 1.0
	if req.VehicleAge > 10 {
		vehicleAgeFactor = 1.30
	} else if req.VehicleAge > 5 {
		vehicleAgeFactor = 1.15
	} else if req.VehicleAge > 2 {
		vehicleAgeFactor = 1.05
	}

	// Region factor
	regionFactor, ok := regionRiskFactors[req.Region]
	if !ok {
		regionFactor = regionRiskFactors["other"]
	}

	// Driver age factor
	driverAgeFactor := 1.0
	if req.DriverAge < 25 {
		driverAgeFactor = 1.40
	} else if req.DriverAge < 30 {
		driverAgeFactor = 1.15
	} else if req.DriverAge > 65 {
		driverAgeFactor = 1.25
	}

	// No-claims discount
	ncdFactor := 1.0
	switch {
	case req.NCDYears >= 5:
		ncdFactor = 0.60
	case req.NCDYears >= 4:
		ncdFactor = 0.65
	case req.NCDYears >= 3:
		ncdFactor = 0.70
	case req.NCDYears >= 2:
		ncdFactor = 0.80
	case req.NCDYears >= 1:
		ncdFactor = 0.90
	}

	// Calculate base premium
	basePremium := req.VehicleValue * baseFactor * vehicleAgeFactor * regionFactor * driverAgeFactor * ncdFactor

	// Cover type adjustments
	switch req.CoverType {
	case "comprehensive":
		// Already calculated as comprehensive
	case "third_party_fire_theft":
		basePremium *= 0.60
	case "third_party_only":
		basePremium = math.Max(basePremium*0.30, 5000) // NAICOM minimum TP premium
	}

	// Add statutory third-party liability
	tpLiability := 5000.0 // NAICOM minimum
	basePremium += tpLiability

	// Expense and profit loading
	grossPremium := basePremium * 1.35 // 35% loading

	// Apply NAICOM minimum premium
	if grossPremium < 10000 {
		grossPremium = 10000
	}

	calc := &models.PremiumCalculation{
		QuoteID:        req.QuoteID,
		ProductCode:    "MOTOR",
		ProductType:    "motor_" + req.CoverType,
		SumAssured:     req.VehicleValue,
		Age:            req.DriverAge,
		GrossPremium:   math.Round(grossPremium*100) / 100,
		NetPremium:     math.Round(basePremium*100) / 100,
		LoadingFactor:  vehicleAgeFactor * regionFactor * driverAgeFactor * ncdFactor,
		ExpenseLoading: 0.25,
		ProfitMargin:   0.10,
		RiskClass:      req.VehicleType,
	}

	if err := s.repo.SavePremiumCalculation(ctx, calc); err != nil {
		return nil, fmt.Errorf("failed to save motor premium calculation: %w", err)
	}

	return calc, nil
}

// CalculateReserves calculates policy reserves
func (s *ActuarialService) CalculateReserves(ctx context.Context, req ReserveRequest) (*models.ReserveCalculation, error) {
	// Unearned Premium Reserve (UPR) - pro-rata temporis
	daysElapsed := time.Since(req.PolicyStartDate).Hours() / 24
	totalDays := req.PolicyEndDate.Sub(req.PolicyStartDate).Hours() / 24
	if totalDays <= 0 {
		return nil, fmt.Errorf("invalid policy dates")
	}
	unexpiredRatio := math.Max(0, (totalDays-daysElapsed)/totalDays)
	upr := req.AnnualPremium * unexpiredRatio

	// Claims Reserve - case-based + IBNR
	claimsReserve := req.OutstandingClaims * 1.10 // 10% case reserve strengthening

	// IBNR estimate using percentage of earned premium
	earnedPremium := req.AnnualPremium * (1 - unexpiredRatio)
	ibnrFactor := s.getIBNRFactor(req.ProductType)
	ibnr := earnedPremium * ibnrFactor

	// Gross reserve
	grossReserve := upr + claimsReserve + ibnr

	// Net reserve (after reinsurance)
	retentionRatio := 1.0 - req.ReinsuranceCession
	netReserve := grossReserve * retentionRatio

	calc := &models.ReserveCalculation{
		PolicyID:        req.PolicyID,
		ProductType:     req.ProductType,
		ValuationDate:   time.Now(),
		GrossReserve:    math.Round(grossReserve*100) / 100,
		NetReserve:      math.Round(netReserve*100) / 100,
		UnearnedPremium: math.Round(upr*100) / 100,
		IBNR:            math.Round(ibnr*100) / 100,
		ClaimsReserve:   math.Round(claimsReserve*100) / 100,
		Method:          "pro_rata_temporis",
		Assumptions: map[string]float64{
			"ibnr_factor":          ibnrFactor,
			"case_strengthening":   0.10,
			"reinsurance_cession":  req.ReinsuranceCession,
			"unexpired_ratio":      unexpiredRatio,
		},
		Status: "calculated",
	}

	if err := s.repo.SaveReserveCalculation(ctx, calc); err != nil {
		return nil, fmt.Errorf("failed to save reserve calculation: %w", err)
	}

	return calc, nil
}

// CalculateIBNR performs IBNR calculation using Chain Ladder method
func (s *ActuarialService) CalculateIBNR(ctx context.Context, req IBNRRequest) (*models.IBNRCalculation, error) {
	if len(req.ClaimsTriangle) == 0 {
		return nil, fmt.Errorf("claims triangle data required")
	}

	n := len(req.ClaimsTriangle)
	developmentFactors := make([]float64, n-1)

	// Calculate age-to-age development factors
	for j := 0; j < n-1; j++ {
		numerator := 0.0
		denominator := 0.0
		for i := 0; i <= n-2-j; i++ {
			if j < len(req.ClaimsTriangle[i]) && j+1 < len(req.ClaimsTriangle[i]) {
				numerator += req.ClaimsTriangle[i][j+1]
				denominator += req.ClaimsTriangle[i][j]
			}
		}
		if denominator > 0 {
			developmentFactors[j] = numerator / denominator
		} else {
			developmentFactors[j] = 1.0
		}
	}

	// Calculate cumulative development factors
	cdf := make([]float64, n)
	cdf[n-1] = 1.0
	for j := n - 2; j >= 0; j-- {
		cdf[j] = cdf[j+1] * developmentFactors[j]
	}

	// Calculate IBNR by accident year
	byAccidentYear := make(map[int]float64)
	totalIBNR := 0.0
	for i := 0; i < n; i++ {
		lastCol := len(req.ClaimsTriangle[i]) - 1
		if lastCol >= 0 {
			currentCumulative := req.ClaimsTriangle[i][lastCol]
			ultimateClaims := currentCumulative * cdf[lastCol]
			ibnr := ultimateClaims - currentCumulative
			if ibnr > 0 {
				byAccidentYear[req.StartYear+i] = math.Round(ibnr*100) / 100
				totalIBNR += ibnr
			}
		}
	}

	// Confidence interval (simple approximation)
	confidenceLow := totalIBNR * 0.75
	confidenceHigh := totalIBNR * 1.35

	calc := &models.IBNRCalculation{
		ValuationDate:      time.Now(),
		Method:             req.Method,
		LineOfBusiness:     req.LineOfBusiness,
		TotalIBNR:          math.Round(totalIBNR*100) / 100,
		ByAccidentYear:     byAccidentYear,
		DevelopmentFactors: developmentFactors,
		ConfidenceLow:      math.Round(confidenceLow*100) / 100,
		ConfidenceHigh:     math.Round(confidenceHigh*100) / 100,
		Status:             "calculated",
	}

	if err := s.repo.SaveIBNRCalculation(ctx, calc); err != nil {
		return nil, fmt.Errorf("failed to save IBNR calculation: %w", err)
	}

	return calc, nil
}

// CalculateRBC calculates Risk-Based Capital requirements per NAICOM guidelines
func (s *ActuarialService) CalculateRBC(ctx context.Context, req RBCRequest) (*models.RiskBasedCapital, error) {
	// C0: Asset risk - affiliated investments
	assetRisk := req.TotalInvestments * 0.04

	// C1: Asset risk - other investments
	assetRisk += req.FixedIncomeAssets * 0.01
	assetRisk += req.EquityAssets * 0.15
	assetRisk += req.RealEstateAssets * 0.10
	assetRisk += req.OtherAssets * 0.20

	// C2: Insurance risk
	insuranceRisk := req.NetPremiumWritten * 0.10
	insuranceRisk += req.NetClaimsReserves * 0.05

	// C3: Interest rate risk
	interestRateRisk := req.FixedIncomeAssets * 0.02

	// C4: Operational risk
	operationalRisk := (req.NetPremiumWritten + req.NetClaimsReserves) * 0.03

	// C5: Credit risk
	creditRisk := req.ReinsuranceReceivables * 0.05
	creditRisk += req.PremiumReceivables * 0.03

	// C6: Market risk
	marketRisk := req.EquityAssets * 0.08

	// Total RBC using square root rule (covariance adjustment)
	totalRBC := math.Sqrt(
		math.Pow(assetRisk, 2) +
			math.Pow(insuranceRisk, 2) +
			math.Pow(interestRateRisk, 2) +
			math.Pow(operationalRisk, 2) +
			math.Pow(creditRisk, 2) +
			math.Pow(marketRisk, 2))

	// NAICOM minimum capital requirements
	naicomMinimum := 3000000000.0 // NGN 3 billion for life, NGN 3 billion for non-life
	if req.IsLifeInsurer {
		naicomMinimum = 8000000000.0 // NGN 8 billion (updated NAICOM requirement)
	}

	if totalRBC < naicomMinimum {
		totalRBC = naicomMinimum
	}

	rbcRatio := 0.0
	if totalRBC > 0 {
		rbcRatio = req.AvailableCapital / totalRBC
	}

	// Determine status
	status := "adequate"
	switch {
	case rbcRatio < 0.70:
		status = "authorized_control"
	case rbcRatio < 1.00:
		status = "regulatory_action"
	case rbcRatio < 1.50:
		status = "company_action"
	}

	rbc := &models.RiskBasedCapital{
		ValuationDate:    time.Now(),
		InsuranceRisk:    math.Round(insuranceRisk*100) / 100,
		AssetRisk:        math.Round(assetRisk*100) / 100,
		InterestRateRisk: math.Round(interestRateRisk*100) / 100,
		OperationalRisk:  math.Round(operationalRisk*100) / 100,
		CreditRisk:       math.Round(creditRisk*100) / 100,
		MarketRisk:       math.Round(marketRisk*100) / 100,
		TotalRBC:         math.Round(totalRBC*100) / 100,
		AvailableCapital: req.AvailableCapital,
		RBCRatio:         math.Round(rbcRatio*10000) / 10000,
		Status:           status,
	}

	if err := s.repo.SaveRBC(ctx, rbc); err != nil {
		return nil, fmt.Errorf("failed to save RBC calculation: %w", err)
	}

	return rbc, nil
}

// CalculateSolvency performs solvency margin analysis
func (s *ActuarialService) CalculateSolvency(ctx context.Context, req SolvencyRequest) (*models.SolvencyAnalysis, error) {
	netAssets := req.TotalAssets - req.TotalLiabilities

	// NAICOM solvency margin requirement
	premiumBasis := req.NetPremiumWritten * 0.20
	claimsBasis := req.NetIncurredClaims * 0.25
	requiredCapital := math.Max(premiumBasis, claimsBasis)

	// Statutory minimum
	naicomMinimum := 3000000000.0 // NGN 3 billion minimum capital
	if req.IsLifeInsurer {
		naicomMinimum = 8000000000.0
	}
	requiredCapital = math.Max(requiredCapital, naicomMinimum)

	solvencyRatio := 0.0
	if requiredCapital > 0 {
		solvencyRatio = netAssets / requiredCapital
	}

	sa := &models.SolvencyAnalysis{
		ValuationDate:    time.Now(),
		TotalAssets:      req.TotalAssets,
		TotalLiabilities: req.TotalLiabilities,
		NetAssets:        netAssets,
		RequiredCapital:  math.Round(requiredCapital*100) / 100,
		SolvencyRatio:    math.Round(solvencyRatio*10000) / 10000,
		NAICOMMinimum:    naicomMinimum,
		Compliant:        solvencyRatio >= 1.0,
	}

	if err := s.repo.SaveSolvency(ctx, sa); err != nil {
		return nil, fmt.Errorf("failed to save solvency analysis: %w", err)
	}

	return sa, nil
}

// CalculateLossRatio performs loss ratio analysis for a product line
func (s *ActuarialService) CalculateLossRatio(ctx context.Context, req LossRatioRequest) (*models.LossRatioAnalysis, error) {
	if req.EarnedPremium <= 0 {
		return nil, fmt.Errorf("earned premium must be positive")
	}

	lossRatio := req.IncurredClaims / req.EarnedPremium
	expenseRatio := req.Expenses / req.EarnedPremium
	combinedRatio := lossRatio + expenseRatio

	trend := "stable"
	switch {
	case combinedRatio > 1.10:
		trend = "deteriorating_severely"
	case combinedRatio > 1.00:
		trend = "deteriorating"
	case combinedRatio < 0.85:
		trend = "improving"
	case combinedRatio < 0.95:
		trend = "favorable"
	}

	lr := &models.LossRatioAnalysis{
		Period:         req.Period,
		ProductLine:    req.ProductLine,
		EarnedPremium:  req.EarnedPremium,
		IncurredClaims: req.IncurredClaims,
		Expenses:       req.Expenses,
		LossRatio:      math.Round(lossRatio*10000) / 10000,
		ExpenseRatio:   math.Round(expenseRatio*10000) / 10000,
		CombinedRatio:  math.Round(combinedRatio*10000) / 10000,
		Trend:          trend,
	}

	if err := s.repo.SaveLossRatio(ctx, lr); err != nil {
		return nil, fmt.Errorf("failed to save loss ratio: %w", err)
	}

	return lr, nil
}

// RunExperienceStudy performs an experience study analysis
func (s *ActuarialService) RunExperienceStudy(ctx context.Context, req ExperienceStudyRequest) (*models.ExperienceStudy, error) {
	if req.ExposureCount <= 0 {
		return nil, fmt.Errorf("exposure count must be positive")
	}

	actualRate := float64(req.ClaimCount) / float64(req.ExposureCount)
	aeRatio := 0.0
	if req.ExpectedRate > 0 {
		aeRatio = actualRate / req.ExpectedRate
	}

	results := map[string]float64{
		"actual_rate":           actualRate,
		"expected_rate":         req.ExpectedRate,
		"ae_ratio":              aeRatio,
		"confidence_interval_l": actualRate - 1.96*math.Sqrt(actualRate*(1-actualRate)/float64(req.ExposureCount)),
		"confidence_interval_u": actualRate + 1.96*math.Sqrt(actualRate*(1-actualRate)/float64(req.ExposureCount)),
		"z_score":               (actualRate - req.ExpectedRate) / math.Sqrt(req.ExpectedRate*(1-req.ExpectedRate)/float64(req.ExposureCount)),
	}

	study := &models.ExperienceStudy{
		StudyName:     req.StudyName,
		StudyType:     req.StudyType,
		StartDate:     req.StartDate,
		EndDate:       req.EndDate,
		ProductLines:  req.ProductLines,
		ExposureCount: req.ExposureCount,
		ClaimCount:    req.ClaimCount,
		ActualRate:    actualRate,
		ExpectedRate:  req.ExpectedRate,
		AERatio:       math.Round(aeRatio*10000) / 10000,
		Results:       results,
		Status:        "completed",
	}

	if err := s.repo.CreateExperienceStudy(ctx, study); err != nil {
		return nil, fmt.Errorf("failed to save experience study: %w", err)
	}

	return study, nil
}

// GenerateNAICOMReport generates regulatory report for NAICOM
func (s *ActuarialService) GenerateNAICOMReport(ctx context.Context, req NAICOMReportRequest) (*models.NAICOMReport, error) {
	reportData := map[string]interface{}{
		"company_name":          req.CompanyName,
		"registration_number":   req.RegistrationNumber,
		"reporting_period":      req.Period,
		"gross_premium_written": req.GrossPremiumWritten,
		"net_premium_written":   req.NetPremiumWritten,
		"claims_paid":           req.ClaimsPaid,
		"outstanding_claims":    req.OutstandingClaims,
		"management_expenses":   req.ManagementExpenses,
		"total_assets":          req.TotalAssets,
		"total_liabilities":     req.TotalLiabilities,
		"shareholders_fund":     req.TotalAssets - req.TotalLiabilities,
		"solvency_margin":       (req.TotalAssets - req.TotalLiabilities) / math.Max(req.NetPremiumWritten*0.20, 1),
		"loss_ratio":            req.ClaimsPaid / math.Max(req.NetPremiumWritten, 1),
		"expense_ratio":         req.ManagementExpenses / math.Max(req.NetPremiumWritten, 1),
		"investment_income":     req.InvestmentIncome,
		"underwriting_profit":   req.NetPremiumWritten - req.ClaimsPaid - req.ManagementExpenses,
	}

	report := &models.NAICOMReport{
		ReportType: req.ReportType,
		Period:     req.Period,
		ReportData: reportData,
		Status:     "draft",
	}

	if err := s.repo.CreateNAICOMReport(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create NAICOM report: %w", err)
	}

	return report, nil
}

// Helper functions

func (s *ActuarialService) getMortalityRate(age int) float64 {
	if rate, ok := nigerianMortalityRates[age]; ok {
		return rate
	}
	// Interpolate
	lowerAge, upperAge := 0, 100
	for a := range nigerianMortalityRates {
		if a <= age && a > lowerAge {
			lowerAge = a
		}
		if a >= age && a < upperAge {
			upperAge = a
		}
	}
	if lowerAge == upperAge {
		return nigerianMortalityRates[lowerAge]
	}
	lowerRate := nigerianMortalityRates[lowerAge]
	upperRate := nigerianMortalityRates[upperAge]
	t := float64(age-lowerAge) / float64(upperAge-lowerAge)
	return lowerRate + t*(upperRate-lowerRate)
}

func (s *ActuarialService) getOccupationFactor(class string) float64 {
	switch class {
	case "1": // office/sedentary
		return 1.00
	case "2": // light manual
		return 1.15
	case "3": // heavy manual
		return 1.40
	case "4": // hazardous
		return 1.75
	default:
		return 1.00
	}
}

func (s *ActuarialService) calculateNSP(age, term int, sumAssured, qx, discountRate float64, productType string) float64 {
	v := 1.0 / (1.0 + discountRate)
	nsp := 0.0

	switch productType {
	case "term_life":
		// A = sum of v^(t+1) * tpx * qx+t
		tpx := 1.0
		for t := 0; t < term; t++ {
			currentAge := age + t
			currentQx := s.getMortalityRate(currentAge) * (qx / s.getMortalityRate(age))
			nsp += math.Pow(v, float64(t+1)) * tpx * currentQx * sumAssured
			tpx *= (1 - currentQx)
		}
	case "whole_life":
		// Whole life = term life to age 100
		effectiveTerm := 100 - age
		tpx := 1.0
		for t := 0; t < effectiveTerm; t++ {
			currentAge := age + t
			currentQx := s.getMortalityRate(currentAge) * (qx / s.getMortalityRate(age))
			nsp += math.Pow(v, float64(t+1)) * tpx * currentQx * sumAssured
			tpx *= (1 - currentQx)
		}
	case "endowment":
		// Endowment = term life + pure endowment
		tpx := 1.0
		for t := 0; t < term; t++ {
			currentAge := age + t
			currentQx := s.getMortalityRate(currentAge) * (qx / s.getMortalityRate(age))
			nsp += math.Pow(v, float64(t+1)) * tpx * currentQx * sumAssured
			tpx *= (1 - currentQx)
		}
		// Pure endowment: survival benefit
		nsp += math.Pow(v, float64(term)) * tpx * sumAssured
	default:
		nsp = sumAssured * qx * float64(term)
	}

	return nsp
}

func (s *ActuarialService) calculateAnnuityDue(age, term int, qx, discountRate float64) float64 {
	v := 1.0 / (1.0 + discountRate)
	annuity := 1.0 // First payment at time 0
	tpx := 1.0

	for t := 1; t < term; t++ {
		currentAge := age + t - 1
		currentQx := s.getMortalityRate(currentAge) * (qx / s.getMortalityRate(age))
		tpx *= (1 - currentQx)
		annuity += math.Pow(v, float64(t)) * tpx
	}

	return annuity
}

func (s *ActuarialService) getIBNRFactor(productType string) float64 {
	switch productType {
	case "motor":
		return 0.08
	case "fire":
		return 0.05
	case "marine":
		return 0.10
	case "life":
		return 0.03
	case "health":
		return 0.12
	case "engineering":
		return 0.15
	default:
		return 0.07
	}
}

// GetMortalityTables returns all active mortality tables
func (s *ActuarialService) GetMortalityTables(ctx context.Context) ([]models.MortalityTable, error) {
	return s.repo.ListMortalityTables(ctx)
}

// GetPricingConfigs returns all active pricing configurations
func (s *ActuarialService) GetPricingConfigs(ctx context.Context) ([]models.ProductPricingConfig, error) {
	return s.repo.ListPricingConfigs(ctx)
}

// GetReservesByPolicy returns reserves for a specific policy
func (s *ActuarialService) GetReservesByPolicy(ctx context.Context, policyID string) ([]models.ReserveCalculation, error) {
	return s.repo.GetReservesByPolicy(ctx, policyID)
}

// GetLatestRBC returns the most recent RBC calculation
func (s *ActuarialService) GetLatestRBC(ctx context.Context) (*models.RiskBasedCapital, error) {
	return s.repo.GetLatestRBC(ctx)
}

// GetNAICOMReport returns a specific NAICOM report
func (s *ActuarialService) GetNAICOMReport(ctx context.Context, id uuid.UUID) (*models.NAICOMReport, error) {
	return s.repo.GetNAICOMReport(ctx, id)
}

// ListNAICOMReports returns NAICOM reports by type and period
func (s *ActuarialService) ListNAICOMReports(ctx context.Context, reportType, period string) ([]models.NAICOMReport, error) {
	return s.repo.ListNAICOMReports(ctx, reportType, period)
}

// SubmitNAICOMReport marks a report as submitted
func (s *ActuarialService) SubmitNAICOMReport(ctx context.Context, reportID, submitterID uuid.UUID) error {
	return s.repo.SubmitNAICOMReport(ctx, reportID, submitterID)
}

// GetExperienceStudies lists experience studies
func (s *ActuarialService) GetExperienceStudies(ctx context.Context, studyType string) ([]models.ExperienceStudy, error) {
	return s.repo.ListExperienceStudies(ctx, studyType)
}

// GetLossRatioTrend returns loss ratio trend for a product line
func (s *ActuarialService) GetLossRatioTrend(ctx context.Context, productLine string, periods int) ([]models.LossRatioAnalysis, error) {
	return s.repo.GetLossRatioTrend(ctx, productLine, periods)
}

package service

import (
	"digital-consumer-products/internal/models"
	"digital-consumer-products/internal/repository"
	"fmt"
	"math"
	"time"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetProducts() []models.ConsumerProduct  { return s.repo.GetProducts() }
func (s *Service) GetProduct(id string) *models.ConsumerProduct { return s.repo.GetProduct(id) }
func (s *Service) GetPolicies() []models.ConsumerPolicy    { return s.repo.GetPolicies() }
func (s *Service) GetClaims() []models.HospiCashClaim      { return s.repo.GetClaims() }

func (s *Service) ActivatePolicy(productID, customerID, customerName string, days int) (*models.ConsumerPolicy, error) {
	product := s.repo.GetProduct(productID)
	if product == nil {
		return nil, fmt.Errorf("product not found: %s", productID)
	}
	if !product.IsActive {
		return nil, fmt.Errorf("product %s is inactive", productID)
	}
	premium := product.MinPremiumNGN * float64(days)
	if product.BillingCycle == "hourly" {
		premium = product.MinPremiumNGN * float64(days) * 8
	}
	p := &models.ConsumerPolicy{
		ID:           fmt.Sprintf("CPOL-%d", time.Now().UnixNano()%1000000000),
		ProductID:    productID,
		CustomerID:   customerID,
		CustomerName: customerName,
		PremiumPaid:  premium,
		Coverage:     product.MaxCoverageNGN,
		Status:       "active",
		ActivatedAt:  time.Now(),
		ExpiresAt:    time.Now().Add(time.Duration(days) * 24 * time.Hour),
	}
	s.repo.CreatePolicy(p)
	return p, nil
}

func (s *Service) AssessCyberRisk(bizName, industry string, empCount int) *models.CyberRiskAssessment {
	score := 50.0
	var vulns []string
	if empCount < 10 {
		score += 20
		vulns = append(vulns, "no_dedicated_it_staff")
	} else if empCount < 50 {
		score += 10
		vulns = append(vulns, "limited_security_budget")
	}
	switch industry {
	case "fintech", "healthcare":
		score += 15
		vulns = append(vulns, "high_value_data_target")
	case "ecommerce":
		score += 10
		vulns = append(vulns, "payment_data_exposure")
	}
	vulns = append(vulns, "phishing_risk", "ransomware_exposure")
	level := "low"
	plan := "basic"
	premium := 15000.0
	if score >= 70 {
		level = "high"
		plan = "comprehensive"
		premium = 75000
	} else if score >= 50 {
		level = "medium"
		plan = "standard"
		premium = 35000
	}
	premium = premium * math.Max(1, float64(empCount)/10)
	a := &models.CyberRiskAssessment{
		BusinessName: bizName, Industry: industry, EmployeeCount: empCount,
		RiskScore: score, RiskLevel: level, Vulnerabilities: vulns,
		RecommendedPlan: plan, PremiumNGN: premium,
	}
	s.repo.StoreCyberAssessment(a)
	return a
}

func (s *Service) ProcessHospiCashClaim(policyID, hospital, admDate, disDate string, days int) (*models.HospiCashClaim, error) {
	if days <= 0 {
		return nil, fmt.Errorf("days admitted must be positive")
	}
	dailyBenefit := 5000.0
	claim := &models.HospiCashClaim{
		ID:            fmt.Sprintf("HCC-%d", time.Now().UnixNano()%1000000000),
		PolicyID:      policyID,
		HospitalName:  hospital,
		AdmissionDate: admDate,
		DischargeDate: disDate,
		DaysAdmitted:  days,
		DailyBenefit:  dailyBenefit,
		TotalPayout:   dailyBenefit * float64(days),
		Status:        "approved",
		ProcessedAt:   time.Now(),
	}
	s.repo.CreateClaim(claim)
	return claim, nil
}

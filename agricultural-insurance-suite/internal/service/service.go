package service

import (
	"agricultural-insurance-suite/internal/models"
	"agricultural-insurance-suite/internal/repository"
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

func (s *Service) GetAllProducts() []models.Product {
	return s.repo.GetProducts()
}

func (s *Service) GetProduct(id string) *models.Product {
	return s.repo.GetProduct(id)
}

func (s *Service) GetProductsByCategory(category string) []models.Product {
	all := s.repo.GetProducts()
	var result []models.Product
	for _, p := range all {
		if matchCategory(p.Type, category) {
			result = append(result, p)
		}
	}
	return result
}

func matchCategory(pt models.ProductType, cat string) bool {
	m := map[string][]models.ProductType{
		"climacash": {models.ProductClimaCashRain, models.ProductClimaCashDrought, models.ProductClimaCashFlood, models.ProductClimaCashHeat},
		"crop":      {models.ProductWeatherIndexCrop, models.ProductAreaYieldIndex, models.ProductMultiPerilCrop, models.ProductFertiliserBundled},
		"livestock": {models.ProductLivestockIndex, models.ProductLivestockTakaful, models.ProductPastoralRoute},
		"marine":    {models.ProductAquaculture},
		"carbon":    {models.ProductCarbonCredit},
	}
	for _, t := range m[cat] {
		if pt == t {
			return true
		}
	}
	return false
}

func (s *Service) EnrollPolicy(req models.EnrollRequest) (*models.Policy, error) {
	product := s.repo.GetProduct(req.ProductID)
	if product == nil {
		return nil, fmt.Errorf("product not found: %s", req.ProductID)
	}
	if !product.IsActive {
		return nil, fmt.Errorf("product %s is not currently active", req.ProductID)
	}
	totalVal := 0.0
	for _, a := range req.Assets {
		totalVal += a.Value * float64(a.Quantity)
	}
	premium := calculatePremium(product, totalVal, req.Region)
	policy := &models.Policy{
		ID:            fmt.Sprintf("POL-%d", time.Now().UnixNano()%1000000000),
		ProductID:     req.ProductID,
		CustomerID:    req.CustomerID,
		CustomerName:  req.CustomerName,
		Region:        req.Region,
		State:         req.State,
		LGA:           req.LGA,
		Assets:        req.Assets,
		PremiumPaid:   premium,
		CoverageStart: time.Now(),
		CoverageEnd:   time.Now().Add(365 * 24 * time.Hour),
		Status:        "active",
		CreatedAt:     time.Now(),
	}
	s.repo.CreatePolicy(policy)
	return policy, nil
}

func calculatePremium(product *models.Product, assetValue float64, region string) float64 {
	base := product.PremiumAmount
	mult := 1.0
	switch region {
	case "North-East", "North-West":
		mult = 1.3
	case "South-South":
		mult = 1.2
	case "North-Central":
		mult = 1.1
	}
	af := math.Min(assetValue/1000000.0, 3.0)
	return base * mult * (1 + af*0.1)
}

func (s *Service) EvaluateTrigger(req models.TriggerRequest) (*models.TriggerEvent, error) {
	products := s.repo.GetProducts()
	var matched *models.Product
	for i, p := range products {
		if string(p.Type) == req.ProductType {
			matched = &products[i]
			break
		}
	}
	if matched == nil {
		return nil, fmt.Errorf("no product for type: %s", req.ProductType)
	}
	triggered := false
	switch models.TriggerType(req.TriggerType) {
	case models.TriggerRainfall:
		if matched.Type == models.ProductClimaCashDrought {
			triggered = req.MeasuredValue < matched.ThresholdValue
		} else {
			triggered = req.MeasuredValue > matched.ThresholdValue
		}
	case models.TriggerTemperature:
		triggered = req.MeasuredValue > matched.ThresholdValue
	case models.TriggerNDVI:
		triggered = req.MeasuredValue < matched.ThresholdValue
	case models.TriggerWindSpeed:
		triggered = req.MeasuredValue > matched.ThresholdValue
	case models.TriggerAreaYield:
		triggered = req.MeasuredValue < matched.ThresholdValue
	case models.TriggerCarbonFlux:
		triggered = req.MeasuredValue > matched.ThresholdValue
	}
	event := &models.TriggerEvent{
		ID:            fmt.Sprintf("TRG-%d", time.Now().UnixNano()%1000000000),
		ProductType:   req.ProductType,
		TriggerType:   req.TriggerType,
		Region:        req.Region,
		MeasuredValue: req.MeasuredValue,
		Threshold:     matched.ThresholdValue,
		Triggered:     triggered,
		DataSource:    req.DataSource,
		Timestamp:     time.Now(),
	}
	s.repo.RecordTrigger(event)
	if triggered {
		policies := s.repo.GetPoliciesByProduct(matched.ID)
		for _, pol := range policies {
			if pol.Region == req.Region && pol.Status == "active" {
				payout := &models.ClaimPayout{
					ID:           fmt.Sprintf("PAY-%d", time.Now().UnixNano()%1000000000),
					PolicyID:     pol.ID,
					TriggerID:    event.ID,
					Amount:       matched.PayoutAmount,
					Status:       "pending_disbursement",
					PayoutMethod: "mobile_money",
					ProcessedAt:  time.Now(),
				}
				s.repo.RecordPayout(payout)
			}
		}
	}
	return event, nil
}

func (s *Service) GetNDVIAssessment(region string, ndviValue float64) *models.NDVIReading {
	pct := ndviToPercentile(ndviValue)
	cond := "normal"
	if pct < 20 {
		cond = "severe_drought"
	} else if pct < 35 {
		cond = "drought_stress"
	} else if pct < 50 {
		cond = "below_normal"
	} else if pct >= 70 {
		cond = "above_normal"
	}
	return &models.NDVIReading{Region: region, Value: ndviValue, Percentile: pct, Condition: cond, Timestamp: time.Now()}
}

func ndviToPercentile(v float64) float64 {
	if v <= 0.1 {
		return 5
	} else if v <= 0.2 {
		return 15
	} else if v <= 0.3 {
		return 30
	} else if v <= 0.4 {
		return 50
	} else if v <= 0.5 {
		return 65
	} else if v <= 0.6 {
		return 78
	}
	return 90
}

func (s *Service) GetAllPolicies() []models.Policy    { return s.repo.GetPolicies() }
func (s *Service) GetAllTriggers() []models.TriggerEvent { return s.repo.GetTriggers() }
func (s *Service) GetAllPayouts() []models.ClaimPayout { return s.repo.GetPayouts() }

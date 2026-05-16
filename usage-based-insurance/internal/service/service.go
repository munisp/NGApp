package service

import (
	"fmt"
	"math"
	"time"
	"usage-based-insurance/internal/models"
	"usage-based-insurance/internal/repository"
)

type UBIService struct {
	repo *repository.UBIRepository
}

func NewUBIService(repo *repository.UBIRepository) *UBIService {
	return &UBIService{repo: repo}
}

type RegisterRequest struct {
	CustomerID   string  `json:"customer_id"`
	VehicleReg   string  `json:"vehicle_reg"`
	VehicleMake  string  `json:"vehicle_make"`
	VehicleModel string  `json:"vehicle_model"`
	VehicleYear  int     `json:"vehicle_year"`
	BasePremium  float64 `json:"base_premium"`
}

func (s *UBIService) RegisterPolicy(req RegisterRequest) (*models.UBIPolicy, error) {
	if req.VehicleReg == "" {
		return nil, fmt.Errorf("vehicle registration is required")
	}
	if req.BasePremium <= 0 {
		return nil, fmt.Errorf("base premium must be positive")
	}

	policy := &models.UBIPolicy{
		ID:              fmt.Sprintf("UBI-%d", time.Now().UnixNano()%10000000),
		CustomerID:      req.CustomerID,
		VehicleReg:      req.VehicleReg,
		VehicleMake:     req.VehicleMake,
		VehicleModel:    req.VehicleModel,
		VehicleYear:     req.VehicleYear,
		DeviceID:        fmt.Sprintf("OBD-%d", time.Now().UnixNano()%1000000),
		BasePremium:     req.BasePremium,
		AdjustedPremium: req.BasePremium,
		CurrentDiscount: 0,
		Status:          "active",
		CreatedAt:       time.Now(),
	}

	if err := s.repo.CreatePolicy(policy); err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *UBIService) IngestTelemetry(policyID string, data models.TelematicsData) error {
	_, err := s.repo.GetPolicy(policyID)
	if err != nil {
		return err
	}
	data.ID = fmt.Sprintf("TEL-%d", time.Now().UnixNano()%10000000)
	data.PolicyID = policyID
	if data.Timestamp.IsZero() {
		data.Timestamp = time.Now()
	}

	hour := data.Timestamp.Hour()
	data.IsNightDriving = hour < 5 || hour >= 22

	s.repo.AddTelemetry(policyID, data)
	return nil
}

func (s *UBIService) CalculateScore(policyID string) (*models.DrivingScore, error) {
	policy, err := s.repo.GetPolicy(policyID)
	if err != nil {
		return nil, err
	}

	telemetry := s.repo.GetTelemetry(policyID, 0)
	if len(telemetry) == 0 {
		return nil, fmt.Errorf("no telemetry data for policy %s", policyID)
	}

	speedScore := 100.0
	brakingScore := 100.0
	accelScore := 100.0
	corneringScore := 100.0
	hardBrakes := 0
	speedingEvents := 0
	nightPoints := 0
	totalDist := 0.0

	for _, t := range telemetry {
		if t.Speed > 120 {
			speedScore -= 5
			speedingEvents++
		} else if t.Speed > 100 {
			speedScore -= 2
		}
		if t.Braking > 8.0 {
			brakingScore -= 10
			hardBrakes++
		} else if t.Braking > 5.0 {
			brakingScore -= 3
		}
		if t.Acceleration > 5.0 {
			accelScore -= 5
		}
		if t.Cornering > 4.0 {
			corneringScore -= 5
		}
		if t.IsNightDriving {
			nightPoints++
		}
		totalDist += t.DistanceKm
	}

	clamp := func(v float64) float64 {
		if v < 0 { return 0 }
		if v > 100 { return 100 }
		return v
	}
	speedScore = clamp(speedScore)
	brakingScore = clamp(brakingScore)
	accelScore = clamp(accelScore)
	corneringScore = clamp(corneringScore)

	overall := speedScore*0.3 + brakingScore*0.3 + accelScore*0.2 + corneringScore*0.2
	nightPct := float64(nightPoints) / float64(len(telemetry)) * 100

	discount := 0.0
	riskCat := "standard"
	switch {
	case overall >= 90:
		discount = 25.0
		riskCat = "excellent"
	case overall >= 75:
		discount = 15.0
		riskCat = "good"
	case overall >= 60:
		discount = 5.0
		riskCat = "average"
	case overall >= 40:
		discount = 0
		riskCat = "poor"
	default:
		discount = -15.0
		riskCat = "high_risk"
	}

	if nightPct > 30 {
		discount -= 5
	}

	now := time.Now()
	score := models.DrivingScore{
		ID:              fmt.Sprintf("SCR-%d", time.Now().UnixNano()%10000000),
		PolicyID:        policyID,
		Period:          now.Format("2006-01"),
		OverallScore:    math.Round(overall*10) / 10,
		SpeedScore:      math.Round(speedScore*10) / 10,
		BrakingScore:    math.Round(brakingScore*10) / 10,
		AccelScore:      math.Round(accelScore*10) / 10,
		CorneringScore:  math.Round(corneringScore*10) / 10,
		NightDrivingPct: math.Round(nightPct*10) / 10,
		TotalDistanceKm: math.Round(totalDist*10) / 10,
		TotalTrips:      len(s.repo.GetTrips(policyID)),
		HardBrakeEvents: hardBrakes,
		SpeedingEvents:  speedingEvents,
		PremiumDiscount: discount,
		RiskCategory:    riskCat,
		CalculatedAt:    now,
	}

	s.repo.SaveScore(score)

	policy.AdjustedPremium = policy.BasePremium * (1 - discount/100)
	policy.CurrentDiscount = discount
	policy.LastScoreDate = &now
	s.repo.UpdatePolicy(policy)

	return &score, nil
}

func (s *UBIService) GetPolicy(id string) (*models.UBIPolicy, error) {
	return s.repo.GetPolicy(id)
}

func (s *UBIService) ListPolicies() []models.UBIPolicy {
	return s.repo.ListPolicies()
}

func (s *UBIService) GetScores(policyID string) []models.DrivingScore {
	return s.repo.GetScores(policyID)
}

func (s *UBIService) GetTelemetry(policyID string, limit int) []models.TelematicsData {
	return s.repo.GetTelemetry(policyID, limit)
}

func (s *UBIService) GetTrips(policyID string) []models.Trip {
	return s.repo.GetTrips(policyID)
}

func (s *UBIService) GetStats() map[string]interface{} {
	return s.repo.GetStats()
}

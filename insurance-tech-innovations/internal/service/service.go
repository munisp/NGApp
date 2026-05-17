package service

import (
	"fmt"
	"insurance-tech-innovations/internal/models"
	"math"
	"time"
)

type Service struct{}

func NewService() *Service { return &Service{} }

func (s *Service) CalculateDynamicPrice(req models.DynamicPriceRequest) *models.DynamicPriceResult {
	var factors []models.PricingFactor
	totalAdj := 0.0

	if req.DrivingScore >= 90 {
		d := -25.0
		totalAdj += d
		factors = append(factors, models.PricingFactor{Name: "safe_driver", Impact: d, Reason: "Excellent driving score (90+) — 25% discount"})
	} else if req.DrivingScore >= 70 {
		d := -15.0
		totalAdj += d
		factors = append(factors, models.PricingFactor{Name: "good_driver", Impact: d, Reason: "Good driving score (70-89) — 15% discount"})
	} else if req.DrivingScore < 50 {
		s := 20.0
		totalAdj += s
		factors = append(factors, models.PricingFactor{Name: "risky_driver", Impact: s, Reason: "Poor driving score (<50) — 20% surcharge"})
	}

	if req.ClaimsCount == 0 {
		d := -10.0
		totalAdj += d
		factors = append(factors, models.PricingFactor{Name: "no_claims", Impact: d, Reason: "Zero claims in 3 years — 10% NCD"})
	} else if req.ClaimsCount >= 3 {
		s := 30.0
		totalAdj += s
		factors = append(factors, models.PricingFactor{Name: "frequent_claims", Impact: s, Reason: "3+ claims in 3 years — 30% loading"})
	}

	if req.MileageKM < 500 {
		d := -15.0
		totalAdj += d
		factors = append(factors, models.PricingFactor{Name: "low_mileage", Impact: d, Reason: "Low monthly mileage (<500km) — 15% discount"})
	} else if req.MileageKM > 3000 {
		s := 10.0
		totalAdj += s
		factors = append(factors, models.PricingFactor{Name: "high_mileage", Impact: s, Reason: "High monthly mileage (>3000km) — 10% loading"})
	}

	if req.VehicleAge > 10 {
		s := 15.0
		totalAdj += s
		factors = append(factors, models.PricingFactor{Name: "old_vehicle", Impact: s, Reason: "Vehicle >10 years — 15% loading"})
	}

	adjusted := req.BasePremium * (1 + totalAdj/100)
	adjusted = math.Max(adjusted, req.BasePremium*0.5)

	discount := 0.0
	surcharge := 0.0
	if totalAdj < 0 {
		discount = -totalAdj
	} else {
		surcharge = totalAdj
	}

	return &models.DynamicPriceResult{
		PolicyID:        req.PolicyID,
		BasePremium:     req.BasePremium,
		AdjustedPremium: adjusted,
		Discount:        discount,
		Surcharge:       surcharge,
		Factors:         factors,
		NextReviewAt:    time.Now().Add(24 * time.Hour),
	}
}

func (s *Service) ProcessInstantClaim(req models.InstantClaimRequest) *models.InstantClaimResult {
	confidence := 50.0
	decision := "manual_review"
	method := "manual"

	if req.SatelliteData {
		confidence += 30
		method = "satellite_verified"
	}
	if req.DamageScore > 0.8 {
		confidence += 15
	} else if req.DamageScore > 0.5 {
		confidence += 10
	}
	if req.Amount < 100000 {
		confidence += 10
	}
	if confidence >= 85 {
		decision = "auto_approved"
	} else if confidence >= 70 {
		decision = "fast_track"
	}

	return &models.InstantClaimResult{
		ClaimID:      fmt.Sprintf("ICL-%d", time.Now().UnixNano()%1000000000),
		PolicyID:     req.PolicyID,
		Decision:     decision,
		Amount:       req.Amount,
		Confidence:   confidence,
		ProcessingMS: 250,
		Method:       method,
		ProcessedAt:  time.Now(),
	}
}

func (s *Service) GetGamificationProfile(customerID string, steps, safeDays int) *models.GamificationProfile {
	points := steps/1000 + safeDays*10
	level := "bronze"
	discount := 0.0
	if points >= 500 {
		level = "gold"
		discount = 15
	} else if points >= 200 {
		level = "silver"
		discount = 8
	} else if points >= 50 {
		level = "bronze"
		discount = 3
	}
	rewards := []models.Reward{
		{Name: "Free fuel voucher", Points: 100, Status: rewardStatus(points, 100)},
		{Name: "5% premium discount", Points: 200, Status: rewardStatus(points, 200)},
		{Name: "Free vehicle inspection", Points: 350, Status: rewardStatus(points, 350)},
		{Name: "20% premium discount", Points: 500, Status: rewardStatus(points, 500)},
	}
	return &models.GamificationProfile{
		CustomerID: customerID, Points: points, Level: level,
		StepsToday: steps, SafeDrivingDays: safeDays,
		PremiumDiscount: discount, Rewards: rewards,
		LossRatioImpact: discount * 0.8,
	}
}

func rewardStatus(points, required int) string {
	if points >= required {
		return "unlocked"
	}
	return "locked"
}

func (s *Service) GetP2PPools() []models.P2PPool {
	return []models.P2PPool{
		{ID: "P2P-001", Name: "Lagos Drivers Mutual", Members: 150, PoolBalance: 2250000, ClaimsPaid: 450000, Giveback: 35, CreatedAt: time.Now().Add(-180 * 24 * time.Hour)},
		{ID: "P2P-002", Name: "Ikoyi Neighbours Group", Members: 45, PoolBalance: 675000, ClaimsPaid: 120000, Giveback: 42, CreatedAt: time.Now().Add(-120 * 24 * time.Hour)},
		{ID: "P2P-003", Name: "Tech Workers Guild", Members: 200, PoolBalance: 4000000, ClaimsPaid: 800000, Giveback: 28, CreatedAt: time.Now().Add(-90 * 24 * time.Hour)},
	}
}

func (s *Service) BuildProduct(name string, perils []string, trigger, payout, dist, premium string) *models.ProductBuilderSpec {
	return &models.ProductBuilderSpec{
		ID:              fmt.Sprintf("PB-%d", time.Now().UnixNano()%1000000000),
		Name:            name,
		Perils:          perils,
		TriggerType:     trigger,
		PayoutMechanism: payout,
		Distribution:    dist,
		PremiumModel:    premium,
		Status:          "draft",
		CreatedInDays:   3,
	}
}

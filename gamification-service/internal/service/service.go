package service

import (
	"fmt"
	"gamification-service/internal/models"
	"gamification-service/internal/repository"
	"time"
)

type GamificationService struct {
	repo *repository.GamificationRepository
}

func NewGamificationService(repo *repository.GamificationRepository) *GamificationService {
	return &GamificationService{repo: repo}
}

type EarnRequest struct {
	CustomerID string `json:"customer_id"`
	Name       string `json:"name"`
	Action     string `json:"action"`
	Reference  string `json:"reference,omitempty"`
}

var actionPoints = map[string]int{
	"premium_payment":     100,
	"on_time_payment":     150,
	"referral":            300,
	"profile_complete":    200,
	"claim_documentation": 50,
	"feedback_submitted":  75,
	"kyc_verified":        250,
	"policy_renewal":      200,
	"app_login":           10,
	"survey_completed":    100,
}

func (s *GamificationService) EarnPoints(req EarnRequest) (*models.Profile, int, error) {
	points, ok := actionPoints[req.Action]
	if !ok {
		return nil, 0, fmt.Errorf("unknown action: %s", req.Action)
	}

	profile := s.repo.GetOrCreateProfile(req.CustomerID, req.Name)
	profile.Points += points
	profile.LifetimePoints += points
	profile.LastActivityAt = time.Now()

	newTier := s.calculateTier(profile.LifetimePoints)
	if newTier != profile.Tier {
		profile.Tier = newTier
	}

	if req.Action == "referral" {
		profile.ReferralCount++
	}

	s.repo.UpdateProfile(profile)

	s.repo.AddPointsTx(models.PointsTransaction{
		ID:        fmt.Sprintf("PTX-%d", time.Now().UnixNano()%10000000),
		ProfileID: profile.ID,
		Points:    points,
		Action:    req.Action,
		Reason:    fmt.Sprintf("Earned %d points for %s", points, req.Action),
		Reference: req.Reference,
		CreatedAt: time.Now(),
	})

	return profile, points, nil
}

func (s *GamificationService) calculateTier(lifetime int) models.TierLevel {
	switch {
	case lifetime >= 10000:
		return models.TierPlatinum
	case lifetime >= 5000:
		return models.TierGold
	case lifetime >= 2000:
		return models.TierSilver
	default:
		return models.TierBronze
	}
}

type RedeemRequest struct {
	CustomerID string `json:"customer_id"`
	RewardID   string `json:"reward_id"`
}

func (s *GamificationService) RedeemReward(req RedeemRequest) (*models.Redemption, error) {
	profile, err := s.repo.GetProfile(req.CustomerID)
	if err != nil {
		return nil, err
	}
	reward, err := s.repo.GetReward(req.RewardID)
	if err != nil {
		return nil, err
	}
	if profile.Points < reward.PointsCost {
		return nil, fmt.Errorf("insufficient points: have %d, need %d", profile.Points, reward.PointsCost)
	}
	if !reward.IsAvailable {
		return nil, fmt.Errorf("reward %s is not available", req.RewardID)
	}

	profile.Points -= reward.PointsCost
	profile.RedeemedPoints += reward.PointsCost
	s.repo.UpdateProfile(profile)

	redemption := models.Redemption{
		ID:        fmt.Sprintf("RDM-%d", time.Now().UnixNano()%10000000),
		ProfileID: profile.ID,
		RewardID:  req.RewardID,
		Points:    reward.PointsCost,
		Status:    "fulfilled",
		CreatedAt: time.Now(),
	}
	s.repo.AddRedemption(redemption)

	s.repo.AddPointsTx(models.PointsTransaction{
		ID:        fmt.Sprintf("PTX-%d", time.Now().UnixNano()%10000000),
		ProfileID: profile.ID,
		Points:    -reward.PointsCost,
		Action:    "redemption",
		Reason:    fmt.Sprintf("Redeemed %s for %d points", reward.Name, reward.PointsCost),
		Reference: redemption.ID,
		CreatedAt: time.Now(),
	})

	return &redemption, nil
}

func (s *GamificationService) GetProfile(customerID string) (*models.Profile, error) {
	return s.repo.GetProfile(customerID)
}

func (s *GamificationService) GetBadges() []models.Badge { return s.repo.GetBadges() }
func (s *GamificationService) GetEarnedBadges(profileID string) []models.EarnedBadge { return s.repo.GetEarnedBadges(profileID) }
func (s *GamificationService) GetChallenges() []models.Challenge { return s.repo.GetChallenges() }
func (s *GamificationService) GetRewards() []models.Reward { return s.repo.GetRewards() }
func (s *GamificationService) GetLeaderboard(limit int) []models.Profile { return s.repo.GetLeaderboard(limit) }
func (s *GamificationService) GetTiers() []models.TierConfig { return s.repo.GetTiers() }
func (s *GamificationService) GetPointsHistory(profileID string) []models.PointsTransaction { return s.repo.GetPointsHistory(profileID) }

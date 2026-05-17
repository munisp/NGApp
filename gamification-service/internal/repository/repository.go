package repository

import (
	"fmt"
	"gamification-service/internal/models"
	"strings"
	"sync"
	"time"
)

type GamificationRepository struct {
	mu          sync.RWMutex
	profiles    map[string]*models.Profile
	pointsTx    []models.PointsTransaction
	badges      map[string]models.Badge
	earnedBadges map[string][]models.EarnedBadge
	challenges  map[string]models.Challenge
	progress    map[string]map[string]*models.ChallengeProgress
	rewards     map[string]models.Reward
	redemptions []models.Redemption
	tiers       []models.TierConfig
}

func NewGamificationRepository() *GamificationRepository {
	repo := &GamificationRepository{
		profiles:     make(map[string]*models.Profile),
		badges:       make(map[string]models.Badge),
		earnedBadges: make(map[string][]models.EarnedBadge),
		challenges:   make(map[string]models.Challenge),
		progress:     make(map[string]map[string]*models.ChallengeProgress),
		rewards:      make(map[string]models.Reward),
		tiers: []models.TierConfig{
			{Tier: models.TierBronze, MinPoints: 0, Benefits: []string{"Basic rewards", "SMS notifications"}},
			{Tier: models.TierSilver, MinPoints: 2000, Benefits: []string{"5% premium discount", "Priority claims", "WhatsApp support"}},
			{Tier: models.TierGold, MinPoints: 5000, Benefits: []string{"10% premium discount", "Fast-track claims", "Dedicated agent", "Free device cover"}},
			{Tier: models.TierPlatinum, MinPoints: 10000, Benefits: []string{"15% premium discount", "VIP claims", "Concierge service", "Free family cover add-on"}},
		},
	}
	repo.seedBadges()
	repo.seedChallenges()
	repo.seedRewards()
	return repo
}

func (r *GamificationRepository) seedBadges() {
	badges := []models.Badge{
		{ID: "B-001", Name: "Early Bird", Description: "Paid premium before due date 3 times", Icon: "bird", Category: "payment", Criteria: "on_time_payments >= 3", PointsValue: 200},
		{ID: "B-002", Name: "Safe Driver", Description: "No claims for 12 months", Icon: "shield", Category: "safety", Criteria: "claim_free_months >= 12", PointsValue: 500},
		{ID: "B-003", Name: "Referral Star", Description: "Referred 5 friends", Icon: "star", Category: "referral", Criteria: "referrals >= 5", PointsValue: 300},
		{ID: "B-004", Name: "Profile Complete", Description: "Completed all profile fields", Icon: "user-check", Category: "engagement", Criteria: "profile_complete = true", PointsValue: 100},
		{ID: "B-005", Name: "Claim Champion", Description: "Submitted documentation within 24 hours", Icon: "trophy", Category: "claims", Criteria: "fast_claim_docs = true", PointsValue: 150},
		{ID: "B-006", Name: "Loyalty Legend", Description: "Active customer for 2+ years", Icon: "crown", Category: "loyalty", Criteria: "tenure_months >= 24", PointsValue: 1000},
	}
	for _, b := range badges {
		r.badges[b.ID] = b
	}
}

func (r *GamificationRepository) seedChallenges() {
	challenges := []models.Challenge{
		{ID: "CH-001", Name: "Pay On Time", Description: "Pay 3 premiums before due date", RewardPts: 500, Target: 3, Category: "payment", ExpiresAt: time.Now().AddDate(0, 3, 0), IsActive: true},
		{ID: "CH-002", Name: "Refer a Friend", Description: "Get 1 friend to buy a policy", RewardPts: 300, Target: 1, Category: "referral", ExpiresAt: time.Now().AddDate(0, 2, 0), IsActive: true},
		{ID: "CH-003", Name: "Complete Profile", Description: "Add emergency contact and next of kin", RewardPts: 200, Target: 2, Category: "engagement", ExpiresAt: time.Now().AddDate(0, 6, 0), IsActive: true},
		{ID: "CH-004", Name: "Health Hero", Description: "Log 10,000 steps for 7 days", RewardPts: 150, Target: 7, Category: "wellness", ExpiresAt: time.Now().AddDate(0, 1, 0), IsActive: true},
		{ID: "CH-005", Name: "Document Upload", Description: "Upload all required KYC documents", RewardPts: 250, Target: 4, Category: "compliance", ExpiresAt: time.Now().AddDate(0, 1, 0), IsActive: true},
	}
	for _, c := range challenges {
		r.challenges[c.ID] = c
	}
}

func (r *GamificationRepository) seedRewards() {
	rewards := []models.Reward{
		{ID: "RWD-001", Name: "Premium Discount 5%", Description: "5% off next premium", PointsCost: 1000, Category: "discount", IsAvailable: true, Quantity: -1},
		{ID: "RWD-002", Name: "Free Device Insurance (1 month)", Description: "Free phone cover", PointsCost: 500, Category: "free_cover", IsAvailable: true, Quantity: 100},
		{ID: "RWD-003", Name: "₦500 Airtime", Description: "MTN/Glo/Airtel/9mobile", PointsCost: 250, Category: "airtime", IsAvailable: true, Quantity: 500},
		{ID: "RWD-004", Name: "₦1000 Data Bundle", Description: "1GB data bundle", PointsCost: 400, Category: "data", IsAvailable: true, Quantity: 200},
		{ID: "RWD-005", Name: "Movie Ticket", Description: "Filmhouse/Genesis cinema", PointsCost: 750, Category: "entertainment", IsAvailable: true, Quantity: 50},
	}
	for _, rw := range rewards {
		r.rewards[rw.ID] = rw
	}
}

func (r *GamificationRepository) GetOrCreateProfile(customerID, name string) *models.Profile {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.profiles[customerID]; ok {
		return p
	}
	p := &models.Profile{
		ID:             fmt.Sprintf("GP-%d", time.Now().UnixNano()%10000000),
		CustomerID:     customerID,
		Name:           name,
		Tier:           models.TierBronze,
		ReferralCode:   strings.ToUpper(name[:min(4, len(name))]) + fmt.Sprintf("%d", time.Now().UnixNano()%10000),
		LastActivityAt: time.Now(),
		CreatedAt:      time.Now(),
	}
	r.profiles[customerID] = p
	return p
}

func min(a, b int) int { if a < b { return a }; return b }

func (r *GamificationRepository) GetProfile(customerID string) (*models.Profile, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.profiles[customerID]
	if !ok {
		return nil, fmt.Errorf("profile not found for customer %s", customerID)
	}
	return p, nil
}

func (r *GamificationRepository) UpdateProfile(p *models.Profile) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles[p.CustomerID] = p
}

func (r *GamificationRepository) AddPointsTx(tx models.PointsTransaction) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pointsTx = append(r.pointsTx, tx)
}

func (r *GamificationRepository) GetPointsHistory(profileID string) []models.PointsTransaction {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.PointsTransaction
	for _, tx := range r.pointsTx {
		if tx.ProfileID == profileID {
			result = append(result, tx)
		}
	}
	return result
}

func (r *GamificationRepository) AwardBadge(profileID string, badge models.Badge) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.earnedBadges[profileID] = append(r.earnedBadges[profileID], models.EarnedBadge{
		ProfileID: profileID,
		BadgeID:   badge.ID,
		Badge:     badge,
		EarnedAt:  time.Now(),
	})
}

func (r *GamificationRepository) GetEarnedBadges(profileID string) []models.EarnedBadge {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.earnedBadges[profileID]
}

func (r *GamificationRepository) GetBadges() []models.Badge {
	var result []models.Badge
	for _, b := range r.badges {
		result = append(result, b)
	}
	return result
}

func (r *GamificationRepository) GetChallenges() []models.Challenge {
	var result []models.Challenge
	for _, c := range r.challenges {
		if c.IsActive {
			result = append(result, c)
		}
	}
	return result
}

func (r *GamificationRepository) GetRewards() []models.Reward {
	var result []models.Reward
	for _, rw := range r.rewards {
		if rw.IsAvailable {
			result = append(result, rw)
		}
	}
	return result
}

func (r *GamificationRepository) GetReward(id string) (*models.Reward, error) {
	rw, ok := r.rewards[id]
	if !ok { return nil, fmt.Errorf("reward %s not found", id) }
	return &rw, nil
}

func (r *GamificationRepository) AddRedemption(red models.Redemption) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.redemptions = append(r.redemptions, red)
}

func (r *GamificationRepository) GetTiers() []models.TierConfig { return r.tiers }

func (r *GamificationRepository) GetLeaderboard(limit int) []models.Profile {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var all []models.Profile
	for _, p := range r.profiles {
		all = append(all, *p)
	}
	for i := 0; i < len(all); i++ {
		for j := i + 1; j < len(all); j++ {
			if all[j].Points > all[i].Points {
				all[i], all[j] = all[j], all[i]
			}
		}
	}
	if limit > 0 && len(all) > limit {
		return all[:limit]
	}
	return all
}

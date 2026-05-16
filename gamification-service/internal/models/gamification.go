package models

import "time"

type TierLevel string

const (
	TierBronze   TierLevel = "Bronze"
	TierSilver   TierLevel = "Silver"
	TierGold     TierLevel = "Gold"
	TierPlatinum TierLevel = "Platinum"
)

type Profile struct {
	ID              string    `json:"id"`
	CustomerID      string    `json:"customer_id"`
	Name            string    `json:"name"`
	Points          int       `json:"points"`
	LifetimePoints  int       `json:"lifetime_points"`
	RedeemedPoints  int       `json:"redeemed_points"`
	Tier            TierLevel `json:"tier"`
	StreakDays       int       `json:"streak_days"`
	ReferralCode    string    `json:"referral_code"`
	ReferralCount   int       `json:"referral_count"`
	LastActivityAt  time.Time `json:"last_activity_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type PointsTransaction struct {
	ID         string    `json:"id"`
	ProfileID  string    `json:"profile_id"`
	Points     int       `json:"points"`
	Action     string    `json:"action"`
	Reason     string    `json:"reason"`
	Reference  string    `json:"reference,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type Badge struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Category    string    `json:"category"`
	Criteria    string    `json:"criteria"`
	PointsValue int       `json:"points_value"`
}

type EarnedBadge struct {
	ProfileID string    `json:"profile_id"`
	BadgeID   string    `json:"badge_id"`
	Badge     Badge     `json:"badge"`
	EarnedAt  time.Time `json:"earned_at"`
}

type Challenge struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	RewardPts   int       `json:"reward_points"`
	Target      int       `json:"target"`
	Category    string    `json:"category"`
	ExpiresAt   time.Time `json:"expires_at"`
	IsActive    bool      `json:"is_active"`
}

type ChallengeProgress struct {
	ProfileID   string `json:"profile_id"`
	ChallengeID string `json:"challenge_id"`
	Progress    int    `json:"progress"`
	Completed   bool   `json:"completed"`
}

type Reward struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	PointsCost    int     `json:"points_cost"`
	Category      string  `json:"category"`
	IsAvailable   bool    `json:"is_available"`
	Quantity      int     `json:"quantity"`
}

type Redemption struct {
	ID        string    `json:"id"`
	ProfileID string    `json:"profile_id"`
	RewardID  string    `json:"reward_id"`
	Points    int       `json:"points_spent"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type TierConfig struct {
	Tier      TierLevel `json:"tier"`
	MinPoints int       `json:"min_points"`
	Benefits  []string  `json:"benefits"`
}

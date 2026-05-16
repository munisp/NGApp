package models

import (
	"time"
	"github.com/google/uuid"
)

type RenewalPolicy struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	PolicyNumber    string    `json:"policy_number" gorm:"uniqueIndex;not null"`
	PolicyType      string    `json:"policy_type" gorm:"index"` // life, motor, health, property, marine
	CustomerID      string    `json:"customer_id" gorm:"index"`
	CustomerName    string    `json:"customer_name"`
	CurrentPremium  float64   `json:"current_premium"`
	SumAssured      float64   `json:"sum_assured"`
	InceptionDate   time.Time `json:"inception_date"`
	ExpiryDate      time.Time `json:"expiry_date" gorm:"index"`
	RenewalDate     time.Time `json:"renewal_date"`
	ClaimsCount     int       `json:"claims_count"`
	ClaimsAmount    float64   `json:"claims_amount"`
	RiskScore       float64   `json:"risk_score"`
	RenewalStatus   string    `json:"renewal_status" gorm:"default:'pending'"` // pending, notified, quoted, accepted, declined, lapsed
	AutoRenew       bool      `json:"auto_renew" gorm:"default:false"`
	AgentID         string    `json:"agent_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type RenewalQuote struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	PolicyID        uuid.UUID `json:"policy_id" gorm:"type:uuid;index"`
	PolicyNumber    string    `json:"policy_number"`
	PreviousPremium float64   `json:"previous_premium"`
	NewPremium      float64   `json:"new_premium"`
	PremiumChange   float64   `json:"premium_change"`
	ChangePercent   float64   `json:"change_percent"`
	RatingFactors   map[string]interface{} `json:"rating_factors" gorm:"serializer:json"`
	DiscountApplied float64   `json:"discount_applied"`
	LoadingApplied  float64   `json:"loading_applied"`
	ValidUntil      time.Time `json:"valid_until"`
	Status          string    `json:"status" gorm:"default:'draft'"` // draft, sent, accepted, expired
	CreatedAt       time.Time `json:"created_at"`
}

type RenewalNotification struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	PolicyID      uuid.UUID `json:"policy_id" gorm:"type:uuid;index"`
	PolicyNumber  string    `json:"policy_number"`
	CustomerID    string    `json:"customer_id"`
	NotificationType string `json:"notification_type"` // 90_day, 60_day, 30_day, 14_day, 7_day, final
	Channel       string    `json:"channel"` // email, sms, whatsapp, push
	TemplateName  string    `json:"template_name"`
	SentAt        *time.Time `json:"sent_at"`
	DeliveredAt   *time.Time `json:"delivered_at"`
	OpenedAt      *time.Time `json:"opened_at"`
	Status        string    `json:"status" gorm:"default:'pending'"` // pending, sent, delivered, opened, failed
	CreatedAt     time.Time `json:"created_at"`
}

type RenewalCampaign struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Name           string    `json:"name"`
	PolicyType     string    `json:"policy_type"`
	TargetDaysBeforeExpiry int `json:"target_days_before_expiry"`
	DiscountPercent float64  `json:"discount_percent"`
	MaxDiscount    float64   `json:"max_discount"`
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"end_date"`
	IsActive       bool      `json:"is_active" gorm:"default:true"`
	TotalPolicies  int       `json:"total_policies"`
	RenewedCount   int       `json:"renewed_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type RenewalMetrics struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Period          string    `json:"period"`
	PolicyType      string    `json:"policy_type"`
	TotalDue        int       `json:"total_due"`
	Renewed         int       `json:"renewed"`
	Lapsed          int       `json:"lapsed"`
	RenewalRate     float64   `json:"renewal_rate"`
	PremiumRetained float64   `json:"premium_retained"`
	PremiumLost     float64   `json:"premium_lost"`
	AvgPremiumChange float64  `json:"avg_premium_change"`
	CreatedAt       time.Time `json:"created_at"`
}

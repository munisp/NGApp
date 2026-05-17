package models

import (
	"time"
	"github.com/google/uuid"
)

type AgentProfile struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	AgentCode       string                 `json:"agent_code" gorm:"uniqueIndex;not null"`
	FirstName       string                 `json:"first_name"`
	LastName        string                 `json:"last_name"`
	Email           string                 `json:"email" gorm:"index"`
	Phone           string                 `json:"phone" gorm:"index"`
	LicenseNumber   string                 `json:"license_number"`
	AgentType       string                 `json:"agent_type"` // individual, corporate, bancassurance
	Region          string                 `json:"region"`
	State           string                 `json:"state"`
	Branch          string                 `json:"branch"`
	Tier            string                 `json:"tier" gorm:"default:'bronze'"` // bronze, silver, gold, platinum
	Status          string                 `json:"status" gorm:"default:'active'"` // active, suspended, terminated
	TotalPolicies   int                    `json:"total_policies"`
	TotalPremium    float64                `json:"total_premium"`
	CommissionRate  float64                `json:"commission_rate"`
	Rating          float64                `json:"rating"`
	DeviceID        string                 `json:"device_id"`
	PushToken       string                 `json:"push_token"`
	LastLoginAt     *time.Time             `json:"last_login_at"`
	Preferences     map[string]interface{} `json:"preferences" gorm:"serializer:json"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type AgentLead struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	AgentCode     string                 `json:"agent_code" gorm:"index;not null"`
	CustomerName  string                 `json:"customer_name"`
	CustomerPhone string                 `json:"customer_phone"`
	CustomerEmail string                 `json:"customer_email"`
	ProductType   string                 `json:"product_type"`
	EstimatedPremium float64             `json:"estimated_premium"`
	Status        string                 `json:"status" gorm:"default:'new'"` // new, contacted, quoted, converted, lost
	Priority      string                 `json:"priority" gorm:"default:'medium'"` // low, medium, high
	Notes         string                 `json:"notes"`
	FollowUpDate  *time.Time             `json:"follow_up_date"`
	ConvertedAt   *time.Time             `json:"converted_at"`
	Location      map[string]interface{} `json:"location" gorm:"serializer:json"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

type AgentQuote struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	QuoteRef      string                 `json:"quote_ref" gorm:"uniqueIndex;not null"`
	AgentCode     string                 `json:"agent_code" gorm:"index"`
	LeadID        *uuid.UUID             `json:"lead_id" gorm:"type:uuid"`
	CustomerName  string                 `json:"customer_name"`
	ProductType   string                 `json:"product_type"`
	ProductName   string                 `json:"product_name"`
	SumAssured    float64                `json:"sum_assured"`
	Premium       float64                `json:"premium"`
	Commission    float64                `json:"commission"`
	Duration      int                    `json:"duration_months"`
	Status        string                 `json:"status" gorm:"default:'draft'"` // draft, sent, accepted, rejected, expired
	ValidUntil    time.Time              `json:"valid_until"`
	Details       map[string]interface{} `json:"details" gorm:"serializer:json"`
	CreatedAt     time.Time              `json:"created_at"`
}

type AgentActivity struct {
	ID          uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	AgentCode   string                 `json:"agent_code" gorm:"index;not null"`
	ActivityType string                `json:"activity_type"` // login, quote_created, policy_sold, lead_added, commission_earned, claim_filed
	Description string                 `json:"description"`
	ReferenceID string                 `json:"reference_id"`
	Amount      float64                `json:"amount"`
	Metadata    map[string]interface{} `json:"metadata" gorm:"serializer:json"`
	CreatedAt   time.Time              `json:"created_at"`
}

type AgentDashboardStats struct {
	AgentCode         string  `json:"agent_code"`
	TotalLeads        int     `json:"total_leads"`
	ActiveLeads       int     `json:"active_leads"`
	ConvertedLeads    int     `json:"converted_leads"`
	ConversionRate    float64 `json:"conversion_rate"`
	TotalQuotes       int     `json:"total_quotes"`
	PendingQuotes     int     `json:"pending_quotes"`
	MonthlyPremium    float64 `json:"monthly_premium"`
	MonthlyCommission float64 `json:"monthly_commission"`
	PoliciesSold      int     `json:"policies_sold_this_month"`
	Tier              string  `json:"tier"`
	Rating            float64 `json:"rating"`
}

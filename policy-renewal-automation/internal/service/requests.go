package service

import (
	"time"
)

type RegisterPolicyRequest struct {
	PolicyNumber  string    `json:"policy_number"`
	PolicyType    string    `json:"policy_type"`
	CustomerID    string    `json:"customer_id"`
	CustomerName  string    `json:"customer_name"`
	CurrentPremium float64  `json:"current_premium"`
	SumAssured    float64   `json:"sum_assured"`
	InceptionDate time.Time `json:"inception_date"`
	ExpiryDate    time.Time `json:"expiry_date"`
	ClaimsCount   int       `json:"claims_count"`
	ClaimsAmount  float64   `json:"claims_amount"`
	AutoRenew     bool      `json:"auto_renew"`
	AgentID       string    `json:"agent_id"`
}

type CreateCampaignRequest struct {
	Name                   string    `json:"name"`
	PolicyType             string    `json:"policy_type"`
	TargetDaysBeforeExpiry int       `json:"target_days_before_expiry"`
	DiscountPercent        float64   `json:"discount_percent"`
	MaxDiscount            float64   `json:"max_discount"`
	StartDate              time.Time `json:"start_date"`
	EndDate                time.Time `json:"end_date"`
}

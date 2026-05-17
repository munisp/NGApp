package service

import (
	"time"

	"github.com/google/uuid"
)

type RegisterAgentRequest struct {
	AgentCode     string `json:"agent_code"`
	FullName      string `json:"full_name"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	AgentType     string `json:"agent_type"`
	LicenseNumber string `json:"license_number"`
	Region        string `json:"region"`
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	TaxID         string `json:"tax_id"`
}

type CreateStructureRequest struct {
	Name           string    `json:"name"`
	ProductType    string    `json:"product_type"`
	AgentType      string    `json:"agent_type"`
	TierLevel      string    `json:"tier_level"`
	BaseRate       float64   `json:"base_rate"`
	RenewalRate    float64   `json:"renewal_rate"`
	OverrideRate   float64   `json:"override_rate"`
	BonusThreshold float64   `json:"bonus_threshold"`
	BonusRate      float64   `json:"bonus_rate"`
	ClawbackPeriod int       `json:"clawback_period"`
	ClawbackRate   float64   `json:"clawback_rate"`
	EffectiveFrom  time.Time `json:"effective_from"`
}

type CalculateCommissionRequest struct {
	AgentID      uuid.UUID `json:"agent_id"`
	PolicyID     string    `json:"policy_id"`
	PolicyNumber string    `json:"policy_number"`
	ProductType  string    `json:"product_type"`
	GrossPremium float64   `json:"gross_premium"`
	IsRenewal    bool      `json:"is_renewal"`
}

type ClawbackRequest struct {
	OriginalTxnID      uuid.UUID `json:"original_txn_id"`
	AgentID            uuid.UUID `json:"agent_id"`
	PolicyID           string    `json:"policy_id"`
	OriginalCommission float64   `json:"original_commission"`
	ClawbackRate       float64   `json:"clawback_rate"`
	Reason             string    `json:"reason"`
	PolicyCancelDate   time.Time `json:"policy_cancel_date"`
}

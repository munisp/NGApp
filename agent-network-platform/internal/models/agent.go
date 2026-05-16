package models

import "time"

type AgentStatus string

const (
	AgentActive     AgentStatus = "active"
	AgentInactive   AgentStatus = "inactive"
	AgentSuspended  AgentStatus = "suspended"
	AgentPending    AgentStatus = "pending_verification"
)

type AgentTier string

const (
	TierBronze   AgentTier = "bronze"
	TierSilver   AgentTier = "silver"
	TierGold     AgentTier = "gold"
	TierPlatinum AgentTier = "platinum"
)

type Agent struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Email           string      `json:"email"`
	Phone           string      `json:"phone"`
	NIN             string      `json:"nin"`
	Region          string      `json:"region"`
	State           string      `json:"state"`
	LGA             string      `json:"lga"`
	Address         string      `json:"address"`
	Tier            AgentTier   `json:"tier"`
	Status          AgentStatus `json:"status"`
	CommissionRate  float64     `json:"commission_rate"`
	TotalSales      float64     `json:"total_sales"`
	TotalCommission float64     `json:"total_commission"`
	PoliciesSold    int         `json:"policies_sold"`
	ActivePolicies  int         `json:"active_policies"`
	ClaimsAssisted  int         `json:"claims_assisted"`
	Rating          float64     `json:"rating"`
	LastActiveAt    *time.Time  `json:"last_active_at,omitempty"`
	VerifiedAt      *time.Time  `json:"verified_at,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
}

type AgentSale struct {
	ID         string    `json:"id"`
	AgentID    string    `json:"agent_id"`
	PolicyID   string    `json:"policy_id"`
	CustomerID string    `json:"customer_id"`
	Product    string    `json:"product"`
	Premium    float64   `json:"premium"`
	Commission float64   `json:"commission"`
	Status     string    `json:"status"`
	Channel    string    `json:"channel"`
	CreatedAt  time.Time `json:"created_at"`
}

type AgentTarget struct {
	ID           string  `json:"id"`
	AgentID      string  `json:"agent_id"`
	Period       string  `json:"period"`
	SalesTarget  float64 `json:"sales_target"`
	SalesActual  float64 `json:"sales_actual"`
	PolicyTarget int     `json:"policy_target"`
	PolicyActual int     `json:"policy_actual"`
	Achievement  float64 `json:"achievement_pct"`
}

type AgentTerritory struct {
	ID        string   `json:"id"`
	AgentID   string   `json:"agent_id"`
	Region    string   `json:"region"`
	States    []string `json:"states"`
	LGAs      []string `json:"lgas"`
	Exclusive bool     `json:"exclusive"`
}

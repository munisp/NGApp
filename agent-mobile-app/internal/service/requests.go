package service

import (
	"time"
	"github.com/google/uuid"
)

type CreateLeadRequest struct {
	AgentCode     string                 `json:"agent_code"`
	CustomerName  string                 `json:"customer_name"`
	CustomerPhone string                 `json:"customer_phone"`
	CustomerEmail string                 `json:"customer_email"`
	ProductType   string                 `json:"product_type"`
	EstimatedPremium float64             `json:"estimated_premium"`
	Priority      string                 `json:"priority"`
	Notes         string                 `json:"notes"`
	FollowUpDate  *time.Time             `json:"follow_up_date"`
	Location      map[string]interface{} `json:"location"`
}

type CreateQuoteRequest struct {
	AgentCode    string                 `json:"agent_code"`
	LeadID       *uuid.UUID             `json:"lead_id"`
	CustomerName string                 `json:"customer_name"`
	ProductType  string                 `json:"product_type"`
	ProductName  string                 `json:"product_name"`
	SumAssured   float64                `json:"sum_assured"`
	Duration     int                    `json:"duration_months"`
	Details      map[string]interface{} `json:"details"`
}

type UpdateLeadRequest struct {
	Status       string     `json:"status"`
	Notes        string     `json:"notes"`
	FollowUpDate *time.Time `json:"follow_up_date"`
}

type RegisterDeviceRequest struct {
	AgentCode string `json:"agent_code"`
	DeviceID  string `json:"device_id"`
	PushToken string `json:"push_token"`
}

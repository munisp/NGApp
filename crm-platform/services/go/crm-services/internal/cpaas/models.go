package cpaas

import (
	"time"

	"github.com/google/uuid"
)

type APIConsumer struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	OrganizationName string     `json:"organization_name"`
	ContactEmail     string     `json:"contact_email"`
	APITier          string     `json:"api_tier"`
	MonthlyQuota     int        `json:"monthly_quota"`
	MessagesSent     int64      `json:"messages_sent"`
	APICallsTotal    int64      `json:"api_calls_total"`
	Status           string     `json:"status"`
	OnboardedAt      time.Time  `json:"onboarded_at"`
	LastAPICall      *time.Time `json:"last_api_call"`
	WebhookURL       string     `json:"webhook_url"`
}

type MessageLog struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	ConsumerID  *uuid.UUID `json:"consumer_id"`
	Channel     string     `json:"channel"`
	Direction   string     `json:"direction"`
	SenderID    string     `json:"sender_id"`
	Recipient   string     `json:"recipient"`
	Status      string     `json:"status"`
	DLRStatus   string     `json:"dlr_status"`
	MessageCost float64    `json:"message_cost"`
	SentAt      *time.Time `json:"sent_at"`
	DeliveredAt *time.Time `json:"delivered_at"`
}

type ChannelMetric struct {
	Channel           string  `json:"channel"`
	MessagesSent      int64   `json:"messages_sent"`
	MessagesDelivered int64   `json:"messages_delivered"`
	DeliveryRate      float64 `json:"delivery_rate"`
	AvgLatencyMs      int     `json:"avg_latency_ms"`
	Revenue           float64 `json:"revenue"`
}

type APIEndpoint struct {
	Path        string `json:"path"`
	Method      string `json:"method"`
	Description string `json:"description"`
}

type SenderID struct {
	ID               uuid.UUID  `json:"id"`
	SenderID         string     `json:"sender_id"`
	Channel          string     `json:"channel"`
	Status           string     `json:"status"`
	RegistrationType string     `json:"registration_type"`
	ApprovedAt       *time.Time `json:"approved_at"`
}

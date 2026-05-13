package models

import "time"

type MessageStatus string

const (
	MessageStatusPending   MessageStatus = "pending"
	MessageStatusSent      MessageStatus = "sent"
	MessageStatusDelivered MessageStatus = "delivered"
	MessageStatusRead      MessageStatus = "read"
	MessageStatusFailed    MessageStatus = "failed"
	MessageStatusReceived  MessageStatus = "received"
	MessageStatusUnknown   MessageStatus = "unknown"
)

type MessageDirection string

const (
	MessageDirectionInbound  MessageDirection = "inbound"
	MessageDirectionOutbound MessageDirection = "outbound"
)

type ConversationStatus string

const (
	ConversationStatusActive ConversationStatus = "active"
	ConversationStatusClosed ConversationStatus = "closed"
)

type Message struct {
	ID           string           `json:"id"`
	TenantID     string           `json:"tenant_id"`
	CustomerID   string           `json:"customer_id"`
	Channel      string           `json:"channel"`
	Direction    MessageDirection `json:"direction"`
	Content      string           `json:"content"`
	Status       MessageStatus    `json:"status"`
	Metadata     map[string]any   `json:"metadata"`
	SentAt       time.Time        `json:"sent_at"`
	DeliveredAt  *time.Time       `json:"delivered_at,omitempty"`
	ReadAt       *time.Time       `json:"read_at,omitempty"`
}

type Conversation struct {
	ID         string             `json:"id"`
	TenantID   string             `json:"tenant_id"`
	CustomerID string             `json:"customer_id"`
	Channel    string             `json:"channel"`
	Status     ConversationStatus `json:"status"`
	Messages   []Message          `json:"messages"`
	CreatedAt  time.Time          `json:"created_at"`
	UpdatedAt  time.Time          `json:"updated_at"`
}

type Customer struct {
	ID          string         `json:"id"`
	TenantID    string         `json:"tenant_id"`
	FullName    string         `json:"full_name"`
	Email       string         `json:"email"`
	Phone       string         `json:"phone"`
	Segment     string         `json:"segment"`
	HealthScore int            `json:"health_score"`
	Metadata    map[string]any `json:"metadata"`
}

type Transaction struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	AccountID string    `json:"account_id"`
	Type      string    `json:"type"`
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type FraudAlert struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	CustomerID  string    `json:"customer_id"`
	RuleID      string    `json:"rule_id"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	Score       float64   `json:"score"`
	CreatedAt   time.Time `json:"created_at"`
}

type FraudDetectionRule struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"`
	Threshold   float64 `json:"threshold"`
	Enabled     bool    `json:"enabled"`
}

type MLPrediction struct {
	ModelName   string         `json:"model_name"`
	Score       float64        `json:"score"`
	Confidence  float64        `json:"confidence"`
	Features    map[string]any `json:"features"`
	Prediction  string         `json:"prediction"`
}

type MessageTemplate struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Channel  string         `json:"channel"`
	Content  string         `json:"content"`
	Params   map[string]any `json:"params"`
}

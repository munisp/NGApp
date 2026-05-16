package models

import "time"

// Channel represents a communication channel
type Channel string

const (
	ChannelWhatsApp Channel = "whatsapp"
	ChannelSMS      Channel = "sms"
	ChannelTelegram Channel = "telegram"
	ChannelUSSD     Channel = "ussd"
)

// MessageType represents the type of message
type MessageType string

const (
	MessageTypeText        MessageType = "text"
	MessageTypeImage       MessageType = "image"
	MessageTypeDocument    MessageType = "document"
	MessageTypeTemplate    MessageType = "template"
	MessageTypeInteractive MessageType = "interactive"
)

// MessageStatus represents the delivery status
type MessageStatus string

const (
	MessageStatusPending   MessageStatus = "pending"
	MessageStatusSent      MessageStatus = "sent"
	MessageStatusDelivered MessageStatus = "delivered"
	MessageStatusRead      MessageStatus = "read"
	MessageStatusFailed    MessageStatus = "failed"
)

// Message represents a message to be sent
type Message struct {
	ID          string                 `json:"id"`
	Channel     Channel                `json:"channel"`
	Type        MessageType            `json:"type"`
	Recipient   string                 `json:"recipient"` // Phone number or user ID
	Content     string                 `json:"content"`
	TemplateID  string                 `json:"template_id,omitempty"`
	Variables   map[string]string      `json:"variables,omitempty"`
	MediaURL    string                 `json:"media_url,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Status      MessageStatus          `json:"status"`
	SentAt      *time.Time             `json:"sent_at,omitempty"`
	DeliveredAt *time.Time             `json:"delivered_at,omitempty"`
	FailedAt    *time.Time             `json:"failed_at,omitempty"`
	ErrorMsg    string                 `json:"error_msg,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// InboundMessage represents a received message
type InboundMessage struct {
	ID        string                 `json:"id"`
	Channel   Channel                `json:"channel"`
	Sender    string                 `json:"sender"` // Phone number or user ID
	Content   string                 `json:"content"`
	MediaURL  string                 `json:"media_url,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

// Template represents a message template
type Template struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Channel     Channel           `json:"channel"`
	Language    string            `json:"language"`
	Content     string            `json:"content"`
	Variables   []string          `json:"variables"`
	Category    string            `json:"category"` // e.g., "policy", "claim", "payment"
	Description string            `json:"description"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// SendMessageRequest represents a request to send a message
type SendMessageRequest struct {
	Channel    Channel           `json:"channel"`
	Recipient  string            `json:"recipient"`
	TemplateID string            `json:"template_id,omitempty"`
	Content    string            `json:"content,omitempty"`
	Variables  map[string]string `json:"variables,omitempty"`
	MediaURL   string            `json:"media_url,omitempty"`
}

// SendMessageResponse represents the response after sending a message
type SendMessageResponse struct {
	MessageID string        `json:"message_id"`
	Status    MessageStatus `json:"status"`
	Error     string        `json:"error,omitempty"`
}

// KafkaEvent represents events from the insurance platform
type KafkaEvent struct {
	EventType string                 `json:"event_type"`
	EventID   string                 `json:"event_id"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// NotificationEvent represents a notification to be sent
type NotificationEvent struct {
	EventType  string            `json:"event_type"` // e.g., "policy.created", "claim.approved"
	CustomerID string            `json:"customer_id"`
	Phone      string            `json:"phone"`
	Email      string            `json:"email,omitempty"`
	Data       map[string]string `json:"data"`
}

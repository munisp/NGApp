package models

import "time"

type NotificationType string
const (
	TypeSMS      NotificationType = "sms"
	TypeEmail    NotificationType = "email"
	TypePush     NotificationType = "push"
	TypeWhatsApp NotificationType = "whatsapp"
	TypeInApp    NotificationType = "in_app"
)

type Notification struct {
	ID          string           `json:"id"`
	RecipientID string           `json:"recipient_id"`
	Type        NotificationType `json:"type"`
	Channel     string           `json:"channel"`
	Subject     string           `json:"subject,omitempty"`
	Body        string           `json:"body"`
	Status      string           `json:"status"`
	Priority    string           `json:"priority"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	ProviderRef string           `json:"provider_ref,omitempty"`
	RetryCount  int              `json:"retry_count"`
	SentAt      *time.Time       `json:"sent_at,omitempty"`
	ReadAt      *time.Time       `json:"read_at,omitempty"`
	CreatedAt   time.Time        `json:"created_at"`
}

type NotificationTemplate struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Subject  string `json:"subject"`
	Body     string `json:"body"`
	Language string `json:"language"`
	Category string `json:"category"`
}

type NotificationPreference struct {
	RecipientID string `json:"recipient_id"`
	SMS         bool   `json:"sms"`
	Email       bool   `json:"email"`
	Push        bool   `json:"push"`
	WhatsApp    bool   `json:"whatsapp"`
	InApp       bool   `json:"in_app"`
	QuietStart  string `json:"quiet_hours_start"`
	QuietEnd    string `json:"quiet_hours_end"`
}

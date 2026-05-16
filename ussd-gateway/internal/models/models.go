package models

import (
	"time"

	"gorm.io/gorm"
)

// USSD gateway with Dapr pub/sub and Redis session management

type Session struct {
	gorm.Model
	SessionID   string    `json:"session_id" gorm:"uniqueIndex;not null"`
	TenantID    string    `json:"tenant_id" gorm:"index"`
	PhoneNumber string    `json:"phone_number" gorm:"index;not null"`
	ServiceCode string    `json:"service_code"`
	MenuPath    string    `json:"menu_path"`
	Input       string    `json:"input"`
	Status      string    `json:"status" gorm:"default:'active'"` // active, completed, timeout, error
	Language    string    `json:"language" gorm:"default:'en'"`
	DurationSec int       `json:"duration_sec"`
	Steps       int       `json:"steps"`
	LastActivity time.Time `json:"last_activity"`
	Metadata    string    `json:"metadata" gorm:"type:jsonb"`
}

type MenuConfig struct {
	gorm.Model
	ServiceCode string `json:"service_code" gorm:"uniqueIndex;not null"`
	TenantID    string `json:"tenant_id" gorm:"index"`
	MenuTree    string `json:"menu_tree" gorm:"type:jsonb"` // full menu structure
	Language    string `json:"language" gorm:"default:'en'"`
	IsActive    bool   `json:"is_active" gorm:"default:true"`
	Version     int    `json:"version" gorm:"default:1"`
}


package models

import (
	"time"

	"github.com/google/uuid"
)

type AuditEvent struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	EventType     string                 `json:"event_type" gorm:"index;not null"` // create, update, delete, read, login, logout, export, approve, reject
	EntityType    string                 `json:"entity_type" gorm:"index"`         // policy, claim, user, payment, etc.
	EntityID      string                 `json:"entity_id" gorm:"index"`
	Module        string                 `json:"module" gorm:"index"`
	ActorID       string                 `json:"actor_id" gorm:"index;not null"`
	ActorName     string                 `json:"actor_name"`
	ActorRole     string                 `json:"actor_role"`
	ActorIP       string                 `json:"actor_ip"`
	UserAgent     string                 `json:"user_agent"`
	Description   string                 `json:"description"`
	OldValue      map[string]interface{} `json:"old_value" gorm:"serializer:json"`
	NewValue      map[string]interface{} `json:"new_value" gorm:"serializer:json"`
	Changes       map[string]interface{} `json:"changes" gorm:"serializer:json"`
	Metadata      map[string]interface{} `json:"metadata" gorm:"serializer:json"`
	RiskLevel     string                 `json:"risk_level" gorm:"default:'low'"` // low, medium, high, critical
	Outcome       string                 `json:"outcome" gorm:"default:'success'"` // success, failure, error
	ErrorMessage  string                 `json:"error_message"`
	CorrelationID string                 `json:"correlation_id" gorm:"index"`
	SessionID     string                 `json:"session_id"`
	CreatedAt     time.Time              `json:"created_at" gorm:"index"`
}

type AuditPolicy struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Name            string    `json:"name" gorm:"uniqueIndex;not null"`
	EntityType      string    `json:"entity_type"`
	EventTypes      string    `json:"event_types"` // comma-separated
	RetentionDays   int       `json:"retention_days" gorm:"default:2555"` // 7 years default for NAICOM
	RequiresApproval bool    `json:"requires_approval"`
	AlertOnEvent    bool      `json:"alert_on_event"`
	RiskLevel       string    `json:"risk_level"`
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at"`
}

type ComplianceReport struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ReportType    string                 `json:"report_type"` // naicom_quarterly, access_review, change_log, suspicious_activity
	Period        string                 `json:"period"`
	GeneratedBy   string                 `json:"generated_by"`
	TotalEvents   int                    `json:"total_events"`
	HighRiskCount int                    `json:"high_risk_count"`
	Summary       map[string]interface{} `json:"summary" gorm:"serializer:json"`
	Status        string                 `json:"status" gorm:"default:'generated'"` // generated, reviewed, submitted
	CreatedAt     time.Time              `json:"created_at"`
}

type AlertRule struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Name          string    `json:"name" gorm:"uniqueIndex;not null"`
	Description   string    `json:"description"`
	Condition     string    `json:"condition"` // e.g., "event_count > 100 in 1h", "failed_login > 5 in 10m"
	EntityType    string    `json:"entity_type"`
	EventType     string    `json:"event_type"`
	Threshold     int       `json:"threshold"`
	WindowMinutes int       `json:"window_minutes"`
	Severity      string    `json:"severity"` // info, warning, critical
	NotifyChannel string    `json:"notify_channel"` // email, slack, webhook
	IsActive      bool      `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time `json:"created_at"`
}

type Alert struct {
	ID          uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	RuleID      uuid.UUID              `json:"rule_id" gorm:"type:uuid;index"`
	RuleName    string                 `json:"rule_name"`
	Severity    string                 `json:"severity"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details" gorm:"serializer:json"`
	Status      string                 `json:"status" gorm:"default:'open'"` // open, acknowledged, resolved, false_positive
	AcknowledgedBy string              `json:"acknowledged_by"`
	ResolvedAt  *time.Time             `json:"resolved_at"`
	CreatedAt   time.Time              `json:"created_at"`
}

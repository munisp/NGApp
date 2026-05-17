package models

import (
	"time"

	"github.com/google/uuid"
)

type AuditAction string
type AuditSeverity string

const (
	AuditActionCreate AuditAction = "CREATE"
	AuditActionRead   AuditAction = "READ"
	AuditActionUpdate AuditAction = "UPDATE"
	AuditActionDelete AuditAction = "DELETE"
	AuditActionLogin  AuditAction = "LOGIN"
	AuditActionLogout AuditAction = "LOGOUT"
	AuditActionExport AuditAction = "EXPORT"
	AuditActionApprove AuditAction = "APPROVE"
	AuditActionReject AuditAction = "REJECT"

	AuditSeverityLow      AuditSeverity = "LOW"
	AuditSeverityMedium   AuditSeverity = "MEDIUM"
	AuditSeverityHigh     AuditSeverity = "HIGH"
	AuditSeverityCritical AuditSeverity = "CRITICAL"
)

type AuditLog struct {
	ID            uuid.UUID     `json:"id" gorm:"type:uuid;primary_key"`
	Timestamp     time.Time     `json:"timestamp" gorm:"not null;index"`
	UserID        uuid.UUID     `json:"user_id" gorm:"type:uuid;index"`
	UserEmail     string        `json:"user_email" gorm:"type:varchar(255)"`
	UserRole      string        `json:"user_role" gorm:"type:varchar(50)"`
	Action        AuditAction   `json:"action" gorm:"type:varchar(50);not null;index"`
	ResourceType  string        `json:"resource_type" gorm:"type:varchar(100);not null;index"`
	ResourceID    string        `json:"resource_id" gorm:"type:varchar(100);index"`
	Severity      AuditSeverity `json:"severity" gorm:"type:varchar(20);not null"`
	Description   string        `json:"description" gorm:"type:text"`
	OldValue      string        `json:"old_value" gorm:"type:jsonb"`
	NewValue      string        `json:"new_value" gorm:"type:jsonb"`
	IPAddress     string        `json:"ip_address" gorm:"type:varchar(45)"`
	UserAgent     string        `json:"user_agent" gorm:"type:varchar(500)"`
	SessionID     string        `json:"session_id" gorm:"type:varchar(100)"`
	RequestID     string        `json:"request_id" gorm:"type:varchar(100)"`
	ServiceName   string        `json:"service_name" gorm:"type:varchar(100)"`
	Checksum      string        `json:"checksum" gorm:"type:varchar(64)"`
	IsSuccessful  bool          `json:"is_successful" gorm:"default:true"`
	ErrorMessage  string        `json:"error_message" gorm:"type:text"`
	Metadata      string        `json:"metadata" gorm:"type:jsonb"`
	CreatedAt     time.Time     `json:"created_at" gorm:"autoCreateTime"`
}

type AuditRetentionPolicy struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ResourceType    string    `json:"resource_type" gorm:"type:varchar(100);unique"`
	RetentionDays   int       `json:"retention_days" gorm:"not null"`
	ArchiveEnabled  bool      `json:"archive_enabled" gorm:"default:true"`
	ArchivePath     string    `json:"archive_path" gorm:"type:varchar(500)"`
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type AuditReport struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ReportType   string    `json:"report_type" gorm:"type:varchar(50)"`
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	GeneratedBy  uuid.UUID `json:"generated_by" gorm:"type:uuid"`
	FilePath     string    `json:"file_path" gorm:"type:varchar(500)"`
	RecordCount  int       `json:"record_count"`
	Status       string    `json:"status" gorm:"type:varchar(20)"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
}

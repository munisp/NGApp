package models

import (
	"time"

	"github.com/google/uuid"
)

type HealthStatus string
type AlertSeverity string

const (
	HealthStatusHealthy   HealthStatus = "HEALTHY"
	HealthStatusDegraded  HealthStatus = "DEGRADED"
	HealthStatusUnhealthy HealthStatus = "UNHEALTHY"
	HealthStatusUnknown   HealthStatus = "UNKNOWN"

	AlertSeverityInfo     AlertSeverity = "INFO"
	AlertSeverityWarning  AlertSeverity = "WARNING"
	AlertSeverityCritical AlertSeverity = "CRITICAL"
)

type ServiceHealth struct {
	ID              uuid.UUID    `json:"id" gorm:"type:uuid;primary_key"`
	ServiceName     string       `json:"service_name" gorm:"type:varchar(100);not null;index"`
	ServiceType     string       `json:"service_type" gorm:"type:varchar(50)"`
	Status          HealthStatus `json:"status" gorm:"type:varchar(20)"`
	Endpoint        string       `json:"endpoint" gorm:"type:varchar(255)"`
	ResponseTimeMs  int          `json:"response_time_ms"`
	LastCheckAt     time.Time    `json:"last_check_at"`
	UptimePercent   float64      `json:"uptime_percent" gorm:"type:decimal(5,2)"`
	ErrorCount      int          `json:"error_count" gorm:"default:0"`
	Metadata        string       `json:"metadata" gorm:"type:jsonb"`
	CreatedAt       time.Time    `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time    `json:"updated_at" gorm:"autoUpdateTime"`
}

type PerformanceMetric struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ServiceName   string    `json:"service_name" gorm:"type:varchar(100);not null;index"`
	MetricName    string    `json:"metric_name" gorm:"type:varchar(100);not null"`
	MetricValue   float64   `json:"metric_value" gorm:"type:decimal(20,4)"`
	MetricUnit    string    `json:"metric_unit" gorm:"type:varchar(20)"`
	Tags          string    `json:"tags" gorm:"type:jsonb"`
	RecordedAt    time.Time `json:"recorded_at" gorm:"autoCreateTime;index"`
}

type SLADefinition struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ServiceName     string    `json:"service_name" gorm:"type:varchar(100);not null"`
	MetricName      string    `json:"metric_name" gorm:"type:varchar(100)"`
	TargetValue     float64   `json:"target_value" gorm:"type:decimal(20,4)"`
	WarningThreshold float64  `json:"warning_threshold" gorm:"type:decimal(20,4)"`
	CriticalThreshold float64 `json:"critical_threshold" gorm:"type:decimal(20,4)"`
	ComparisonType  string    `json:"comparison_type" gorm:"type:varchar(10)"`
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type SLAReport struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	SLAID           uuid.UUID `json:"sla_id" gorm:"type:uuid;not null;index"`
	ServiceName     string    `json:"service_name" gorm:"type:varchar(100)"`
	PeriodStart     time.Time `json:"period_start"`
	PeriodEnd       time.Time `json:"period_end"`
	TargetValue     float64   `json:"target_value" gorm:"type:decimal(20,4)"`
	ActualValue     float64   `json:"actual_value" gorm:"type:decimal(20,4)"`
	CompliancePercent float64 `json:"compliance_percent" gorm:"type:decimal(5,2)"`
	IsMet           bool      `json:"is_met" gorm:"default:false"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type Alert struct {
	ID            uuid.UUID     `json:"id" gorm:"type:uuid;primary_key"`
	ServiceName   string        `json:"service_name" gorm:"type:varchar(100);not null;index"`
	AlertType     string        `json:"alert_type" gorm:"type:varchar(50)"`
	Severity      AlertSeverity `json:"severity" gorm:"type:varchar(20)"`
	Title         string        `json:"title" gorm:"type:varchar(255)"`
	Description   string        `json:"description" gorm:"type:text"`
	MetricName    string        `json:"metric_name" gorm:"type:varchar(100)"`
	MetricValue   float64       `json:"metric_value" gorm:"type:decimal(20,4)"`
	ThresholdValue float64      `json:"threshold_value" gorm:"type:decimal(20,4)"`
	IsAcknowledged bool         `json:"is_acknowledged" gorm:"default:false"`
	AcknowledgedBy *uuid.UUID   `json:"acknowledged_by" gorm:"type:uuid"`
	AcknowledgedAt *time.Time   `json:"acknowledged_at"`
	IsResolved    bool          `json:"is_resolved" gorm:"default:false"`
	ResolvedAt    *time.Time    `json:"resolved_at"`
	CreatedAt     time.Time     `json:"created_at" gorm:"autoCreateTime"`
}

type DashboardWidget struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	DashboardID   uuid.UUID `json:"dashboard_id" gorm:"type:uuid;not null;index"`
	WidgetType    string    `json:"widget_type" gorm:"type:varchar(50)"`
	Title         string    `json:"title" gorm:"type:varchar(100)"`
	Configuration string    `json:"configuration" gorm:"type:jsonb"`
	Position      string    `json:"position" gorm:"type:jsonb"`
	RefreshInterval int     `json:"refresh_interval" gorm:"default:30"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

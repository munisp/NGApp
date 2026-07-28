package models

import (
	"time"
	"github.com/google/uuid"
)

type ServiceHealth struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ServiceName   string    `json:"service_name" gorm:"index;not null"`
	ServiceType   string    `json:"service_type"` // microservice, database, queue, cache, external
	Status        string    `json:"status"` // healthy, degraded, down, unknown
	Uptime        float64   `json:"uptime"` // percentage
	ResponseTimeMs float64  `json:"response_time_ms"`
	ErrorRate     float64   `json:"error_rate"`
	CPU           float64   `json:"cpu_percent"`
	Memory        float64   `json:"memory_percent"`
	DiskUsage     float64   `json:"disk_usage_percent"`
	ActiveConns   int       `json:"active_connections"`
	Version       string    `json:"version"`
	Endpoint      string    `json:"endpoint"`
	LastChecked   time.Time `json:"last_checked"`
	CreatedAt     time.Time `json:"created_at"`
}

type PerformanceMetric struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ServiceName  string    `json:"service_name" gorm:"index"`
	MetricName   string    `json:"metric_name" gorm:"index"` // request_count, latency_p50, latency_p95, latency_p99, error_count, throughput
	MetricValue  float64   `json:"metric_value"`
	Unit         string    `json:"unit"` // ms, count, percent, bytes
	Tags         map[string]interface{} `json:"tags" gorm:"serializer:json"`
	Period       string    `json:"period"`
	RecordedAt   time.Time `json:"recorded_at" gorm:"index"`
	CreatedAt    time.Time `json:"created_at"`
}

type AlertConfig struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Name          string    `json:"name" gorm:"uniqueIndex"`
	ServiceName   string    `json:"service_name"`
	MetricName    string    `json:"metric_name"`
	Operator      string    `json:"operator"` // gt, lt, gte, lte, eq
	Threshold     float64   `json:"threshold"`
	Duration      int       `json:"duration_minutes"`
	Severity      string    `json:"severity"` // info, warning, critical
	NotifyChannel string    `json:"notify_channel"`
	IsActive      bool      `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time `json:"created_at"`
}

type PerformanceAlert struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ConfigID     uuid.UUID              `json:"config_id" gorm:"type:uuid"`
	ServiceName  string                 `json:"service_name"`
	AlertName    string                 `json:"alert_name"`
	Severity     string                 `json:"severity"`
	Message      string                 `json:"message"`
	CurrentValue float64                `json:"current_value"`
	Threshold    float64                `json:"threshold"`
	Status       string                 `json:"status" gorm:"default:'open'"` // open, acknowledged, resolved
	Details      map[string]interface{} `json:"details" gorm:"serializer:json"`
	CreatedAt    time.Time              `json:"created_at"`
}

type SLAConfig struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ServiceName     string    `json:"service_name" gorm:"uniqueIndex"`
	TargetUptime    float64   `json:"target_uptime"` // e.g., 99.9
	MaxResponseMs   float64   `json:"max_response_ms"`
	MaxErrorRate    float64   `json:"max_error_rate"`
	MeasurePeriod   string    `json:"measure_period"` // monthly, quarterly
	CreatedAt       time.Time `json:"created_at"`
}

type SLAReport struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ServiceName     string                 `json:"service_name"`
	Period          string                 `json:"period"`
	ActualUptime    float64                `json:"actual_uptime"`
	TargetUptime    float64                `json:"target_uptime"`
	SLAMet          bool                   `json:"sla_met"`
	AvgResponseMs   float64                `json:"avg_response_ms"`
	P95ResponseMs   float64                `json:"p95_response_ms"`
	ErrorRate       float64                `json:"error_rate"`
	TotalRequests   int64                  `json:"total_requests"`
	FailedRequests  int64                  `json:"failed_requests"`
	Details         map[string]interface{} `json:"details" gorm:"serializer:json"`
	CreatedAt       time.Time              `json:"created_at"`
}

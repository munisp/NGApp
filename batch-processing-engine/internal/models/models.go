package models

import (
	"time"

	"github.com/google/uuid"
)

type BatchJob struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	JobName       string                 `json:"job_name" gorm:"not null"`
	JobType       string                 `json:"job_type" gorm:"index"` // premium_collection, policy_renewal, claims_batch, report_generation, data_migration, reconciliation
	Description   string                 `json:"description"`
	Schedule      string                 `json:"schedule"` // cron expression
	Priority      int                    `json:"priority" gorm:"default:5"` // 1-10
	MaxRetries    int                    `json:"max_retries" gorm:"default:3"`
	TimeoutMins   int                    `json:"timeout_mins" gorm:"default:60"`
	Config        map[string]interface{} `json:"config" gorm:"serializer:json"`
	Status        string                 `json:"status" gorm:"default:'pending'"` // pending, running, completed, failed, cancelled, paused
	Progress      float64                `json:"progress" gorm:"default:0"`
	TotalItems    int                    `json:"total_items" gorm:"default:0"`
	ProcessedItems int                   `json:"processed_items" gorm:"default:0"`
	FailedItems   int                    `json:"failed_items" gorm:"default:0"`
	SkippedItems  int                    `json:"skipped_items" gorm:"default:0"`
	ErrorMessage  string                 `json:"error_message"`
	StartedAt     *time.Time             `json:"started_at"`
	CompletedAt   *time.Time             `json:"completed_at"`
	CreatedBy     string                 `json:"created_by"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

type BatchItem struct {
	ID          uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	JobID       uuid.UUID              `json:"job_id" gorm:"type:uuid;index;not null"`
	ItemRef     string                 `json:"item_ref" gorm:"index"`
	ItemType    string                 `json:"item_type"`
	InputData   map[string]interface{} `json:"input_data" gorm:"serializer:json"`
	OutputData  map[string]interface{} `json:"output_data" gorm:"serializer:json"`
	Status      string                 `json:"status" gorm:"default:'pending'"` // pending, processing, completed, failed, skipped
	RetryCount  int                    `json:"retry_count" gorm:"default:0"`
	ErrorMessage string                `json:"error_message"`
	ProcessedAt *time.Time             `json:"processed_at"`
	CreatedAt   time.Time              `json:"created_at"`
}

type BatchSchedule struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Name          string    `json:"name" gorm:"uniqueIndex;not null"`
	JobType       string    `json:"job_type"`
	CronExpr      string    `json:"cron_expr" gorm:"not null"`
	Description   string    `json:"description"`
	IsActive      bool      `json:"is_active" gorm:"default:true"`
	LastRunAt     *time.Time `json:"last_run_at"`
	NextRunAt     *time.Time `json:"next_run_at"`
	Config        map[string]interface{} `json:"config" gorm:"serializer:json"`
	CreatedAt     time.Time `json:"created_at"`
}

type BatchMetrics struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	JobID           uuid.UUID `json:"job_id" gorm:"type:uuid;index"`
	JobType         string    `json:"job_type"`
	DurationSeconds int64     `json:"duration_seconds"`
	ThroughputPerSec float64  `json:"throughput_per_sec"`
	SuccessRate     float64   `json:"success_rate"`
	MemoryUsageMB   float64   `json:"memory_usage_mb"`
	Period          string    `json:"period"`
	CreatedAt       time.Time `json:"created_at"`
}

package models

import (
	"time"

	"github.com/google/uuid"
)

type BackupStatus string
type BackupType string
type FailoverStatus string

const (
	BackupStatusPending    BackupStatus = "PENDING"
	BackupStatusRunning    BackupStatus = "RUNNING"
	BackupStatusCompleted  BackupStatus = "COMPLETED"
	BackupStatusFailed     BackupStatus = "FAILED"

	BackupTypeFull        BackupType = "FULL"
	BackupTypeIncremental BackupType = "INCREMENTAL"
	BackupTypeDifferential BackupType = "DIFFERENTIAL"

	FailoverStatusStandby   FailoverStatus = "STANDBY"
	FailoverStatusActive    FailoverStatus = "ACTIVE"
	FailoverStatusFailed    FailoverStatus = "FAILED"
	FailoverStatusRecovering FailoverStatus = "RECOVERING"
)

type Backup struct {
	ID            uuid.UUID    `json:"id" gorm:"type:uuid;primary_key"`
	BackupName    string       `json:"backup_name" gorm:"type:varchar(100)"`
	BackupType    BackupType   `json:"backup_type" gorm:"type:varchar(20)"`
	Status        BackupStatus `json:"status" gorm:"type:varchar(20)"`
	SourceSystem  string       `json:"source_system" gorm:"type:varchar(50)"`
	TargetLocation string      `json:"target_location" gorm:"type:varchar(500)"`
	SizeBytes     int64        `json:"size_bytes"`
	Checksum      string       `json:"checksum" gorm:"type:varchar(64)"`
	RetentionDays int          `json:"retention_days" gorm:"default:30"`
	ExpiresAt     *time.Time   `json:"expires_at"`
	StartedAt     *time.Time   `json:"started_at"`
	CompletedAt   *time.Time   `json:"completed_at"`
	ErrorMessage  string       `json:"error_message" gorm:"type:text"`
	CreatedBy     uuid.UUID    `json:"created_by" gorm:"type:uuid"`
	CreatedAt     time.Time    `json:"created_at" gorm:"autoCreateTime"`
}

type BackupSchedule struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;primary_key"`
	ScheduleName   string     `json:"schedule_name" gorm:"type:varchar(100)"`
	SourceSystem   string     `json:"source_system" gorm:"type:varchar(50)"`
	BackupType     BackupType `json:"backup_type" gorm:"type:varchar(20)"`
	CronExpression string     `json:"cron_expression" gorm:"type:varchar(50)"`
	RetentionDays  int        `json:"retention_days" gorm:"default:30"`
	IsActive       bool       `json:"is_active" gorm:"default:true"`
	LastRunAt      *time.Time `json:"last_run_at"`
	NextRunAt      *time.Time `json:"next_run_at"`
	CreatedAt      time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

type FailoverConfig struct {
	ID              uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	ServiceName     string         `json:"service_name" gorm:"type:varchar(100)"`
	PrimaryEndpoint string         `json:"primary_endpoint" gorm:"type:varchar(255)"`
	SecondaryEndpoint string       `json:"secondary_endpoint" gorm:"type:varchar(255)"`
	Status          FailoverStatus `json:"status" gorm:"type:varchar(20)"`
	HealthCheckURL  string         `json:"health_check_url" gorm:"type:varchar(255)"`
	HealthCheckInterval int        `json:"health_check_interval" gorm:"default:30"`
	FailoverThreshold int          `json:"failover_threshold" gorm:"default:3"`
	AutoFailover    bool           `json:"auto_failover" gorm:"default:true"`
	LastHealthCheck *time.Time     `json:"last_health_check"`
	LastFailover    *time.Time     `json:"last_failover"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecoveryPoint struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	BackupID      uuid.UUID `json:"backup_id" gorm:"type:uuid;not null;index"`
	PointInTime   time.Time `json:"point_in_time"`
	Description   string    `json:"description" gorm:"type:text"`
	IsVerified    bool      `json:"is_verified" gorm:"default:false"`
	VerifiedAt    *time.Time `json:"verified_at"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type DRMetrics struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	MetricDate      time.Time `json:"metric_date"`
	RTOTarget       int       `json:"rto_target"`
	RTOActual       int       `json:"rto_actual"`
	RPOTarget       int       `json:"rpo_target"`
	RPOActual       int       `json:"rpo_actual"`
	BackupSuccessRate float64 `json:"backup_success_rate" gorm:"type:decimal(5,2)"`
	FailoverTests   int       `json:"failover_tests"`
	SuccessfulTests int       `json:"successful_tests"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

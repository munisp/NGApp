package models

import (
	"time"

	"github.com/google/uuid"
)

type BatchStatus string
type BatchType string

const (
	BatchStatusPending    BatchStatus = "PENDING"
	BatchStatusRunning    BatchStatus = "RUNNING"
	BatchStatusCompleted  BatchStatus = "COMPLETED"
	BatchStatusFailed     BatchStatus = "FAILED"
	BatchStatusCancelled  BatchStatus = "CANCELLED"

	BatchTypePolicyIssuance  BatchType = "POLICY_ISSUANCE"
	BatchTypePaymentProcess  BatchType = "PAYMENT_PROCESS"
	BatchTypeMassRenewal     BatchType = "MASS_RENEWAL"
	BatchTypeClaimsProcess   BatchType = "CLAIMS_PROCESS"
	BatchTypeDataExport      BatchType = "DATA_EXPORT"
	BatchTypeNotification    BatchType = "NOTIFICATION"
)

type BatchJob struct {
	ID             uuid.UUID   `json:"id" gorm:"type:uuid;primary_key"`
	JobName        string      `json:"job_name" gorm:"type:varchar(100);not null"`
	BatchType      BatchType   `json:"batch_type" gorm:"type:varchar(50);not null"`
	Status         BatchStatus `json:"status" gorm:"type:varchar(20);not null"`
	TotalRecords   int         `json:"total_records" gorm:"default:0"`
	ProcessedRecords int       `json:"processed_records" gorm:"default:0"`
	SuccessCount   int         `json:"success_count" gorm:"default:0"`
	FailureCount   int         `json:"failure_count" gorm:"default:0"`
	InputFile      string      `json:"input_file" gorm:"type:varchar(500)"`
	OutputFile     string      `json:"output_file" gorm:"type:varchar(500)"`
	Parameters     string      `json:"parameters" gorm:"type:jsonb"`
	ErrorLog       string      `json:"error_log" gorm:"type:text"`
	ScheduledAt    *time.Time  `json:"scheduled_at"`
	StartedAt      *time.Time  `json:"started_at"`
	CompletedAt    *time.Time  `json:"completed_at"`
	CreatedBy      uuid.UUID   `json:"created_by" gorm:"type:uuid"`
	CreatedAt      time.Time   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time   `json:"updated_at" gorm:"autoUpdateTime"`
}

type BatchItem struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	BatchJobID  uuid.UUID `json:"batch_job_id" gorm:"type:uuid;not null;index"`
	ItemIndex   int       `json:"item_index" gorm:"not null"`
	InputData   string    `json:"input_data" gorm:"type:jsonb"`
	OutputData  string    `json:"output_data" gorm:"type:jsonb"`
	Status      string    `json:"status" gorm:"type:varchar(20)"`
	ErrorMessage string   `json:"error_message" gorm:"type:text"`
	ProcessedAt *time.Time `json:"processed_at"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type BatchSchedule struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ScheduleName string    `json:"schedule_name" gorm:"type:varchar(100)"`
	BatchType    BatchType `json:"batch_type" gorm:"type:varchar(50)"`
	CronExpr     string    `json:"cron_expr" gorm:"type:varchar(50)"`
	Parameters   string    `json:"parameters" gorm:"type:jsonb"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
	LastRunAt    *time.Time `json:"last_run_at"`
	NextRunAt    *time.Time `json:"next_run_at"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type BulkPolicyRequest struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	BatchJobID    uuid.UUID `json:"batch_job_id" gorm:"type:uuid;not null"`
	ProductType   string    `json:"product_type" gorm:"type:varchar(50)"`
	CustomerName  string    `json:"customer_name" gorm:"type:varchar(200)"`
	CustomerEmail string    `json:"customer_email" gorm:"type:varchar(255)"`
	CustomerPhone string    `json:"customer_phone" gorm:"type:varchar(20)"`
	SumInsured    float64   `json:"sum_insured" gorm:"type:decimal(20,2)"`
	Premium       float64   `json:"premium" gorm:"type:decimal(20,2)"`
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	PolicyNumber  string    `json:"policy_number" gorm:"type:varchar(50)"`
	Status        string    `json:"status" gorm:"type:varchar(20)"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}

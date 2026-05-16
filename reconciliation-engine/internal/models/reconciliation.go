package models

import (
	"time"

	"github.com/google/uuid"
)

type ReconciliationStatus string
type MatchStatus string

const (
	ReconciliationStatusPending    ReconciliationStatus = "PENDING"
	ReconciliationStatusInProgress ReconciliationStatus = "IN_PROGRESS"
	ReconciliationStatusCompleted  ReconciliationStatus = "COMPLETED"
	ReconciliationStatusFailed     ReconciliationStatus = "FAILED"

	MatchStatusMatched    MatchStatus = "MATCHED"
	MatchStatusUnmatched  MatchStatus = "UNMATCHED"
	MatchStatusPartial    MatchStatus = "PARTIAL"
	MatchStatusDisputed   MatchStatus = "DISPUTED"
	MatchStatusResolved   MatchStatus = "RESOLVED"
)

type ReconciliationJob struct {
	ID              uuid.UUID            `json:"id" gorm:"type:uuid;primary_key"`
	JobName         string               `json:"job_name" gorm:"type:varchar(100)"`
	ReconciliationType string            `json:"reconciliation_type" gorm:"type:varchar(50)"`
	Status          ReconciliationStatus `json:"status" gorm:"type:varchar(20)"`
	SourceSystem    string               `json:"source_system" gorm:"type:varchar(50)"`
	TargetSystem    string               `json:"target_system" gorm:"type:varchar(50)"`
	PeriodStart     time.Time            `json:"period_start"`
	PeriodEnd       time.Time            `json:"period_end"`
	TotalRecords    int                  `json:"total_records" gorm:"default:0"`
	MatchedRecords  int                  `json:"matched_records" gorm:"default:0"`
	UnmatchedRecords int                 `json:"unmatched_records" gorm:"default:0"`
	TotalAmount     float64              `json:"total_amount" gorm:"type:decimal(20,2)"`
	MatchedAmount   float64              `json:"matched_amount" gorm:"type:decimal(20,2)"`
	Variance        float64              `json:"variance" gorm:"type:decimal(20,2)"`
	StartedAt       *time.Time           `json:"started_at"`
	CompletedAt     *time.Time           `json:"completed_at"`
	CreatedBy       uuid.UUID            `json:"created_by" gorm:"type:uuid"`
	CreatedAt       time.Time            `json:"created_at" gorm:"autoCreateTime"`
}

type ReconciliationItem struct {
	ID              uuid.UUID   `json:"id" gorm:"type:uuid;primary_key"`
	JobID           uuid.UUID   `json:"job_id" gorm:"type:uuid;not null;index"`
	SourceRef       string      `json:"source_ref" gorm:"type:varchar(100)"`
	TargetRef       string      `json:"target_ref" gorm:"type:varchar(100)"`
	SourceAmount    float64     `json:"source_amount" gorm:"type:decimal(20,2)"`
	TargetAmount    float64     `json:"target_amount" gorm:"type:decimal(20,2)"`
	Variance        float64     `json:"variance" gorm:"type:decimal(20,2)"`
	MatchStatus     MatchStatus `json:"match_status" gorm:"type:varchar(20)"`
	MatchConfidence float64     `json:"match_confidence" gorm:"type:decimal(5,2)"`
	SourceData      string      `json:"source_data" gorm:"type:jsonb"`
	TargetData      string      `json:"target_data" gorm:"type:jsonb"`
	Notes           string      `json:"notes" gorm:"type:text"`
	ResolvedBy      *uuid.UUID  `json:"resolved_by" gorm:"type:uuid"`
	ResolvedAt      *time.Time  `json:"resolved_at"`
	CreatedAt       time.Time   `json:"created_at" gorm:"autoCreateTime"`
}

type BankStatement struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	StatementRef    string    `json:"statement_ref" gorm:"type:varchar(100);unique"`
	BankCode        string    `json:"bank_code" gorm:"type:varchar(10)"`
	AccountNumber   string    `json:"account_number" gorm:"type:varchar(20)"`
	StatementDate   time.Time `json:"statement_date"`
	OpeningBalance  float64   `json:"opening_balance" gorm:"type:decimal(20,2)"`
	ClosingBalance  float64   `json:"closing_balance" gorm:"type:decimal(20,2)"`
	TotalCredits    float64   `json:"total_credits" gorm:"type:decimal(20,2)"`
	TotalDebits     float64   `json:"total_debits" gorm:"type:decimal(20,2)"`
	TransactionCount int      `json:"transaction_count"`
	IsReconciled    bool      `json:"is_reconciled" gorm:"default:false"`
	UploadedAt      time.Time `json:"uploaded_at" gorm:"autoCreateTime"`
}

type StatementTransaction struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	StatementID     uuid.UUID `json:"statement_id" gorm:"type:uuid;not null;index"`
	TransactionDate time.Time `json:"transaction_date"`
	ValueDate       time.Time `json:"value_date"`
	Reference       string    `json:"reference" gorm:"type:varchar(100)"`
	Description     string    `json:"description" gorm:"type:varchar(500)"`
	DebitAmount     float64   `json:"debit_amount" gorm:"type:decimal(20,2)"`
	CreditAmount    float64   `json:"credit_amount" gorm:"type:decimal(20,2)"`
	Balance         float64   `json:"balance" gorm:"type:decimal(20,2)"`
	IsMatched       bool      `json:"is_matched" gorm:"default:false"`
	MatchedWith     string    `json:"matched_with" gorm:"type:varchar(100)"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

package models

import (
	"time"

	"github.com/google/uuid"
)

type TransactionStatus string
type TransactionType string

const (
	TransactionStatusPending   TransactionStatus = "PENDING"
	TransactionStatusProcessing TransactionStatus = "PROCESSING"
	TransactionStatusCompleted TransactionStatus = "COMPLETED"
	TransactionStatusFailed    TransactionStatus = "FAILED"
	TransactionStatusReversed  TransactionStatus = "REVERSED"

	TransactionTypeDebit    TransactionType = "DEBIT"
	TransactionTypeCredit   TransactionType = "CREDIT"
	TransactionTypeTransfer TransactionType = "TRANSFER"
)

type Bank struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	BankCode      string    `json:"bank_code" gorm:"type:varchar(10);unique"`
	BankName      string    `json:"bank_name" gorm:"type:varchar(100)"`
	ShortName     string    `json:"short_name" gorm:"type:varchar(20)"`
	NIPCode       string    `json:"nip_code" gorm:"type:varchar(10)"`
	SortCode      string    `json:"sort_code" gorm:"type:varchar(10)"`
	SwiftCode     string    `json:"swift_code" gorm:"type:varchar(20)"`
	APIEndpoint   string    `json:"api_endpoint" gorm:"type:varchar(255)"`
	IsActive      bool      `json:"is_active" gorm:"default:true"`
	SupportsNIP   bool      `json:"supports_nip" gorm:"default:true"`
	SupportsUSSD  bool      `json:"supports_ussd" gorm:"default:false"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type BankAccount struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	AccountNumber string    `json:"account_number" gorm:"type:varchar(20);not null"`
	AccountName   string    `json:"account_name" gorm:"type:varchar(200)"`
	BankCode      string    `json:"bank_code" gorm:"type:varchar(10);not null"`
	BankName      string    `json:"bank_name" gorm:"type:varchar(100)"`
	AccountType   string    `json:"account_type" gorm:"type:varchar(20)"`
	Currency      string    `json:"currency" gorm:"type:varchar(3);default:'NGN'"`
	CustomerID    uuid.UUID `json:"customer_id" gorm:"type:uuid;index"`
	IsVerified    bool      `json:"is_verified" gorm:"default:false"`
	VerifiedAt    *time.Time `json:"verified_at"`
	IsPrimary     bool      `json:"is_primary" gorm:"default:false"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type BankTransaction struct {
	ID              uuid.UUID         `json:"id" gorm:"type:uuid;primary_key"`
	TransactionRef  string            `json:"transaction_ref" gorm:"type:varchar(100);unique"`
	SessionID       string            `json:"session_id" gorm:"type:varchar(100)"`
	TransactionType TransactionType   `json:"transaction_type" gorm:"type:varchar(20)"`
	Status          TransactionStatus `json:"status" gorm:"type:varchar(20)"`
	Amount          float64           `json:"amount" gorm:"type:decimal(20,2)"`
	Fee             float64           `json:"fee" gorm:"type:decimal(20,2);default:0"`
	Currency        string            `json:"currency" gorm:"type:varchar(3);default:'NGN'"`
	SourceAccount   string            `json:"source_account" gorm:"type:varchar(20)"`
	SourceBank      string            `json:"source_bank" gorm:"type:varchar(10)"`
	DestAccount     string            `json:"dest_account" gorm:"type:varchar(20)"`
	DestBank        string            `json:"dest_bank" gorm:"type:varchar(10)"`
	DestAccountName string            `json:"dest_account_name" gorm:"type:varchar(200)"`
	Narration       string            `json:"narration" gorm:"type:varchar(255)"`
	EntityType      string            `json:"entity_type" gorm:"type:varchar(50)"`
	EntityID        uuid.UUID         `json:"entity_id" gorm:"type:uuid;index"`
	ResponseCode    string            `json:"response_code" gorm:"type:varchar(10)"`
	ResponseMessage string            `json:"response_message" gorm:"type:text"`
	ProcessedAt     *time.Time        `json:"processed_at"`
	CreatedAt       time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
}

type AccountVerification struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	AccountNumber string    `json:"account_number" gorm:"type:varchar(20)"`
	BankCode      string    `json:"bank_code" gorm:"type:varchar(10)"`
	AccountName   string    `json:"account_name" gorm:"type:varchar(200)"`
	BVN           string    `json:"bvn" gorm:"type:varchar(20)"`
	IsVerified    bool      `json:"is_verified" gorm:"default:false"`
	VerifiedAt    *time.Time `json:"verified_at"`
	RequestedBy   uuid.UUID `json:"requested_by" gorm:"type:uuid"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type DirectDebitMandate struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	MandateRef    string    `json:"mandate_ref" gorm:"type:varchar(100);unique"`
	CustomerID    uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;index"`
	AccountNumber string    `json:"account_number" gorm:"type:varchar(20)"`
	BankCode      string    `json:"bank_code" gorm:"type:varchar(10)"`
	MaxAmount     float64   `json:"max_amount" gorm:"type:decimal(20,2)"`
	Frequency     string    `json:"frequency" gorm:"type:varchar(20)"`
	StartDate     time.Time `json:"start_date"`
	EndDate       *time.Time `json:"end_date"`
	Status        string    `json:"status" gorm:"type:varchar(20)"`
	IsActive      bool      `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

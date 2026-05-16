package models

import (
	"time"
	"github.com/google/uuid"
)

type MobileUser struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	UserRef         string                 `json:"user_ref" gorm:"uniqueIndex;not null"`
	FirstName       string                 `json:"first_name"`
	LastName        string                 `json:"last_name"`
	Email           string                 `json:"email" gorm:"index"`
	Phone           string                 `json:"phone" gorm:"index"`
	BVN             string                 `json:"bvn"`
	ProfileImage    string                 `json:"profile_image"`
	DeviceType      string                 `json:"device_type"` // ios
	DeviceModel     string                 `json:"device_model"`
	OSVersion       string                 `json:"os_version"`
	AppVersion      string                 `json:"app_version"`
	PushToken       string                 `json:"push_token"`
	BiometricEnabled bool                  `json:"biometric_enabled"`
	NotificationPrefs map[string]interface{} `json:"notification_prefs" gorm:"serializer:json"`
	LastActiveAt    *time.Time             `json:"last_active_at"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type MobilePolicy struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	UserRef       string    `json:"user_ref" gorm:"index;not null"`
	PolicyNumber  string    `json:"policy_number" gorm:"index"`
	PolicyType    string    `json:"policy_type"`
	ProductName   string    `json:"product_name"`
	Status        string    `json:"status"`
	Premium       float64   `json:"premium"`
	SumAssured    float64   `json:"sum_assured"`
	NextPaymentDate *time.Time `json:"next_payment_date"`
	ExpiryDate    time.Time `json:"expiry_date"`
	CreatedAt     time.Time `json:"created_at"`
}

type MobileClaim struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ClaimRef      string                 `json:"claim_ref" gorm:"uniqueIndex;not null"`
	UserRef       string                 `json:"user_ref" gorm:"index;not null"`
	PolicyNumber  string                 `json:"policy_number"`
	ClaimType     string                 `json:"claim_type"`
	Description   string                 `json:"description"`
	AmountClaimed float64                `json:"amount_claimed"`
	AmountApproved float64               `json:"amount_approved"`
	Status        string                 `json:"status" gorm:"default:'submitted'"` // submitted, under_review, approved, rejected, paid
	Documents     map[string]interface{} `json:"documents" gorm:"serializer:json"`
	SubmittedAt   time.Time              `json:"submitted_at"`
	ResolvedAt    *time.Time             `json:"resolved_at"`
	CreatedAt     time.Time              `json:"created_at"`
}

type MobilePayment struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	UserRef        string    `json:"user_ref" gorm:"index;not null"`
	PolicyNumber   string    `json:"policy_number"`
	Amount         float64   `json:"amount"`
	PaymentMethod  string    `json:"payment_method"` // card, bank_transfer, ussd, wallet
	TransactionRef string    `json:"transaction_ref" gorm:"uniqueIndex"`
	Status         string    `json:"status"` // pending, successful, failed
	PaidAt         *time.Time `json:"paid_at"`
	CreatedAt      time.Time `json:"created_at"`
}

type PushNotification struct {
	ID          uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	UserRef     string                 `json:"user_ref" gorm:"index;not null"`
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	Type        string                 `json:"type"` // policy_reminder, claim_update, payment_due, promotion, general
	Data        map[string]interface{} `json:"data" gorm:"serializer:json"`
	IsRead      bool                   `json:"is_read" gorm:"default:false"`
	SentAt      time.Time              `json:"sent_at"`
	ReadAt      *time.Time             `json:"read_at"`
	CreatedAt   time.Time              `json:"created_at"`
}

package models

import (
	"time"

	"github.com/google/uuid"
)

type RenewalStatus string

const (
	RenewalStatusPending   RenewalStatus = "PENDING"
	RenewalStatusNotified  RenewalStatus = "NOTIFIED"
	RenewalStatusRenewed   RenewalStatus = "RENEWED"
	RenewalStatusLapsed    RenewalStatus = "LAPSED"
	RenewalStatusCancelled RenewalStatus = "CANCELLED"
	RenewalStatusGracePeriod RenewalStatus = "GRACE_PERIOD"
)

type PolicyRenewal struct {
	ID                uuid.UUID     `json:"id" gorm:"type:uuid;primary_key"`
	PolicyID          uuid.UUID     `json:"policy_id" gorm:"type:uuid;not null;index"`
	PolicyNumber      string        `json:"policy_number" gorm:"type:varchar(50)"`
	CustomerID        uuid.UUID     `json:"customer_id" gorm:"type:uuid;not null"`
	CurrentExpiryDate time.Time     `json:"current_expiry_date" gorm:"not null"`
	NewExpiryDate     *time.Time    `json:"new_expiry_date"`
	Status            RenewalStatus `json:"status" gorm:"type:varchar(20);not null"`
	CurrentPremium    float64       `json:"current_premium" gorm:"type:decimal(20,2)"`
	RenewalPremium    float64       `json:"renewal_premium" gorm:"type:decimal(20,2)"`
	PremiumChange     float64       `json:"premium_change" gorm:"type:decimal(10,2)"`
	GracePeriodDays   int           `json:"grace_period_days" gorm:"default:30"`
	GracePeriodEnd    *time.Time    `json:"grace_period_end"`
	RenewalAttempts   int           `json:"renewal_attempts" gorm:"default:0"`
	LastNotifiedAt    *time.Time    `json:"last_notified_at"`
	RenewedAt         *time.Time    `json:"renewed_at"`
	LapsedAt          *time.Time    `json:"lapsed_at"`
	AutoRenewal       bool          `json:"auto_renewal" gorm:"default:false"`
	CreatedAt         time.Time     `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time     `json:"updated_at" gorm:"autoUpdateTime"`
}

type RenewalNotification struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	RenewalID      uuid.UUID `json:"renewal_id" gorm:"type:uuid;not null;index"`
	NotificationType string  `json:"notification_type" gorm:"type:varchar(50)"`
	Channel        string    `json:"channel" gorm:"type:varchar(20)"`
	Recipient      string    `json:"recipient" gorm:"type:varchar(255)"`
	Subject        string    `json:"subject" gorm:"type:varchar(255)"`
	Content        string    `json:"content" gorm:"type:text"`
	Status         string    `json:"status" gorm:"type:varchar(20)"`
	SentAt         *time.Time `json:"sent_at"`
	DeliveredAt    *time.Time `json:"delivered_at"`
	FailureReason  string    `json:"failure_reason" gorm:"type:text"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type RenewalSchedule struct {
	ID                 uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ProductType        string    `json:"product_type" gorm:"type:varchar(50)"`
	FirstReminderDays  int       `json:"first_reminder_days" gorm:"default:30"`
	SecondReminderDays int       `json:"second_reminder_days" gorm:"default:14"`
	FinalReminderDays  int       `json:"final_reminder_days" gorm:"default:7"`
	GracePeriodDays    int       `json:"grace_period_days" gorm:"default:30"`
	AutoRenewalEnabled bool      `json:"auto_renewal_enabled" gorm:"default:true"`
	IsActive           bool      `json:"is_active" gorm:"default:true"`
	CreatedAt          time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type LapsePreventionAction struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	RenewalID   uuid.UUID `json:"renewal_id" gorm:"type:uuid;not null"`
	ActionType  string    `json:"action_type" gorm:"type:varchar(50)"`
	Description string    `json:"description" gorm:"type:text"`
	Outcome     string    `json:"outcome" gorm:"type:varchar(50)"`
	PerformedBy string    `json:"performed_by" gorm:"type:varchar(100)"`
	PerformedAt time.Time `json:"performed_at" gorm:"autoCreateTime"`
}

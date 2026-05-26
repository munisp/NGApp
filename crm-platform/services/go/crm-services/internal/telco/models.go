package telco

import (
	"time"

	"github.com/google/uuid"
)

type Subscriber struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	TenantID        uuid.UUID `json:"tenant_id" gorm:"type:uuid;not null"`
	MSISDN          string    `json:"msisdn" gorm:"size:20;not null"`
	IMSI            string    `json:"imsi" gorm:"size:20"`
	Status          string    `json:"status" gorm:"size:20;default:active"`
	PlanID          *uuid.UUID `json:"plan_id" gorm:"type:uuid"`
	ActivationDate  time.Time `json:"activation_date"`
	DeviceType      string    `json:"device_type" gorm:"size:100"`
	DataUsageMB     int64     `json:"data_usage_mb" gorm:"default:0"`
	VoiceMinutes    int       `json:"voice_minutes_used" gorm:"default:0"`
	LastActivity    *time.Time `json:"last_activity"`
	ChurnRiskScore  float64   `json:"churn_risk_score"`
	ARPU            float64   `json:"arpu"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CellSite struct {
	ID                  uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	TenantID            uuid.UUID `json:"tenant_id"`
	SiteID              string    `json:"site_id"`
	Name                string    `json:"name"`
	Latitude            float64   `json:"latitude"`
	Longitude           float64   `json:"longitude"`
	Technology          string    `json:"technology"`
	Status              string    `json:"status"`
	CapacityUtilization float64   `json:"capacity_utilization"`
	LastMaintenance     *time.Time `json:"last_maintenance"`
}

type SIMEvent struct {
	ID          uuid.UUID `json:"id"`
	ICCID       string    `json:"iccid"`
	MSISDN      string    `json:"msisdn"`
	Status      string    `json:"status"`
	Action      string    `json:"action"`
	PerformedAt time.Time `json:"performed_at"`
	Reason      string    `json:"reason"`
}

type InterconnectAgreement struct {
	ID              uuid.UUID `json:"id"`
	TenantID        uuid.UUID `json:"tenant_id"`
	PartnerName     string    `json:"partner_name"`
	AgreementType   string    `json:"agreement_type"`
	RatePerMinute   float64   `json:"rate_per_minute"`
	RatePerMB       float64   `json:"rate_per_mb"`
	SettlementPeriod string   `json:"settlement_period"`
	Status          string    `json:"status"`
	StartDate       time.Time `json:"start_date"`
}

type SubscriberListResponse struct {
	Data  []Subscriber `json:"data"`
	Total int64        `json:"total"`
	Page  int          `json:"page"`
}

package models

import (
	"time"

	"github.com/google/uuid"
)

type FeedbackStatus string
type ComplaintPriority string

const (
	FeedbackStatusOpen       FeedbackStatus = "OPEN"
	FeedbackStatusInProgress FeedbackStatus = "IN_PROGRESS"
	FeedbackStatusResolved   FeedbackStatus = "RESOLVED"
	FeedbackStatusClosed     FeedbackStatus = "CLOSED"

	ComplaintPriorityLow      ComplaintPriority = "LOW"
	ComplaintPriorityMedium   ComplaintPriority = "MEDIUM"
	ComplaintPriorityHigh     ComplaintPriority = "HIGH"
	ComplaintPriorityCritical ComplaintPriority = "CRITICAL"
)

type NPSSurvey struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID   uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;index"`
	Score        int       `json:"score" gorm:"not null"`
	Category     string    `json:"category" gorm:"type:varchar(50)"`
	TouchPoint   string    `json:"touch_point" gorm:"type:varchar(100)"`
	Comment      string    `json:"comment" gorm:"type:text"`
	TransactionID *uuid.UUID `json:"transaction_id" gorm:"type:uuid"`
	Channel      string    `json:"channel" gorm:"type:varchar(20)"`
	SurveyDate   time.Time `json:"survey_date" gorm:"autoCreateTime"`
}

type SatisfactionSurvey struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID      uuid.UUID `json:"customer_id" gorm:"type:uuid;not null;index"`
	SurveyType      string    `json:"survey_type" gorm:"type:varchar(50)"`
	OverallRating   int       `json:"overall_rating" gorm:"not null"`
	ServiceRating   int       `json:"service_rating"`
	ProductRating   int       `json:"product_rating"`
	ProcessRating   int       `json:"process_rating"`
	ValueRating     int       `json:"value_rating"`
	Responses       string    `json:"responses" gorm:"type:jsonb"`
	Comments        string    `json:"comments" gorm:"type:text"`
	WouldRecommend  bool      `json:"would_recommend"`
	TransactionID   *uuid.UUID `json:"transaction_id" gorm:"type:uuid"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type Complaint struct {
	ID              uuid.UUID         `json:"id" gorm:"type:uuid;primary_key"`
	ComplaintNumber string            `json:"complaint_number" gorm:"type:varchar(50);unique"`
	CustomerID      uuid.UUID         `json:"customer_id" gorm:"type:uuid;not null;index"`
	Category        string            `json:"category" gorm:"type:varchar(50)"`
	SubCategory     string            `json:"sub_category" gorm:"type:varchar(50)"`
	Subject         string            `json:"subject" gorm:"type:varchar(255)"`
	Description     string            `json:"description" gorm:"type:text"`
	Priority        ComplaintPriority `json:"priority" gorm:"type:varchar(20)"`
	Status          FeedbackStatus    `json:"status" gorm:"type:varchar(20)"`
	Channel         string            `json:"channel" gorm:"type:varchar(20)"`
	AssignedTo      *uuid.UUID        `json:"assigned_to" gorm:"type:uuid"`
	PolicyID        *uuid.UUID        `json:"policy_id" gorm:"type:uuid"`
	ClaimID         *uuid.UUID        `json:"claim_id" gorm:"type:uuid"`
	Resolution      string            `json:"resolution" gorm:"type:text"`
	ResolutionDate  *time.Time        `json:"resolution_date"`
	EscalationLevel int               `json:"escalation_level" gorm:"default:0"`
	SLADeadline     *time.Time        `json:"sla_deadline"`
	SLABreached     bool              `json:"sla_breached" gorm:"default:false"`
	CreatedAt       time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
}

type ComplaintNote struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ComplaintID uuid.UUID `json:"complaint_id" gorm:"type:uuid;not null;index"`
	Note        string    `json:"note" gorm:"type:text"`
	NoteType    string    `json:"note_type" gorm:"type:varchar(20)"`
	CreatedBy   uuid.UUID `json:"created_by" gorm:"type:uuid"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type FeedbackAnalytics struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Period        string    `json:"period" gorm:"type:varchar(20)"`
	PeriodStart   time.Time `json:"period_start"`
	PeriodEnd     time.Time `json:"period_end"`
	NPSScore      float64   `json:"nps_score" gorm:"type:decimal(5,2)"`
	CSATScore     float64   `json:"csat_score" gorm:"type:decimal(5,2)"`
	TotalSurveys  int       `json:"total_surveys"`
	TotalComplaints int     `json:"total_complaints"`
	ResolvedComplaints int  `json:"resolved_complaints"`
	AvgResolutionHours float64 `json:"avg_resolution_hours" gorm:"type:decimal(10,2)"`
	SLACompliance float64   `json:"sla_compliance" gorm:"type:decimal(5,2)"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}

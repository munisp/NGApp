package models

import (
	"time"

	"github.com/google/uuid"
)

type NPSSurvey struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerID     uuid.UUID `json:"customer_id" gorm:"type:uuid;index"`
	Score          int       `json:"score"`
	Comment        string    `json:"comment"`
	SentimentScore float64   `json:"sentiment_score"`
	SentimentLabel string    `json:"sentiment_label"`
	Channel        string    `json:"channel"`
	SurveyDate     time.Time `json:"survey_date" gorm:"index"`
	CreatedAt      time.Time `json:"created_at"`
}

type SatisfactionSurvey struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	CustomerID     uuid.UUID `json:"customer_id" gorm:"type:uuid;index"`
	TransactionID  uuid.UUID `json:"transaction_id" gorm:"type:uuid"`
	Category       string    `json:"category"`
	Rating         int       `json:"rating"`
	Comment        string    `json:"comment"`
	SentimentScore float64   `json:"sentiment_score"`
	SentimentLabel string    `json:"sentiment_label"`
	SurveyDate     time.Time `json:"survey_date"`
	CreatedAt      time.Time `json:"created_at"`
}

type Complaint struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ComplaintNumber string    `json:"complaint_number" gorm:"uniqueIndex"`
	CustomerID      uuid.UUID `json:"customer_id" gorm:"type:uuid;index"`
	CustomerName    string    `json:"customer_name"`
	Subject         string    `json:"subject"`
	Description     string    `json:"description"`
	Category        string    `json:"category"`
	Priority        string    `json:"priority" gorm:"index"`
	Status          string    `json:"status" gorm:"index"`
	AssignedTo      uuid.UUID `json:"assigned_to" gorm:"type:uuid"`
	EscalationLevel int       `json:"escalation_level"`
	SLADeadline     time.Time `json:"sla_deadline"`
	Resolution      string    `json:"resolution"`
	ResolvedAt      time.Time `json:"resolved_at"`
	SentimentScore  float64   `json:"sentiment_score"`
	SentimentLabel  string    `json:"sentiment_label"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ComplaintNote struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ComplaintID uuid.UUID `json:"complaint_id" gorm:"type:uuid;index"`
	AuthorID    uuid.UUID `json:"author_id" gorm:"type:uuid"`
	AuthorName  string    `json:"author_name"`
	Content     string    `json:"content"`
	IsInternal  bool      `json:"is_internal"`
	CreatedAt   time.Time `json:"created_at"`
}

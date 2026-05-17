package models

import (
	"time"

	"github.com/google/uuid"
)

type ScreeningType string

const (
	ScreeningTypeSanctions     ScreeningType = "sanctions"
	ScreeningTypePEP           ScreeningType = "pep"
	ScreeningTypeAdverseMedia  ScreeningType = "adverse_media"
	ScreeningTypeComprehensive ScreeningType = "comprehensive"
)

type ScreeningStatus string

const (
	ScreeningStatusPending    ScreeningStatus = "pending"
	ScreeningStatusProcessing ScreeningStatus = "processing"
	ScreeningStatusClear      ScreeningStatus = "clear"
	ScreeningStatusHit        ScreeningStatus = "hit"
	ScreeningStatusFailed     ScreeningStatus = "failed"
)

type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

type AMLScreening struct {
	ID            uuid.UUID       `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID    uuid.UUID       `json:"customer_id" gorm:"type:uuid;not null;index"`
	ScreeningType ScreeningType   `json:"screening_type" gorm:"type:varchar(50);not null"`
	FullName      string          `json:"full_name" gorm:"type:varchar(200);not null"`
	DateOfBirth   *time.Time      `json:"date_of_birth,omitempty"`
	Nationality   string          `json:"nationality,omitempty" gorm:"type:varchar(100)"`
	Status        ScreeningStatus `json:"status" gorm:"type:varchar(50);default:'pending'"`
	RiskLevel     RiskLevel       `json:"risk_level,omitempty" gorm:"type:varchar(50)"`
	MatchScore    float64         `json:"match_score" gorm:"type:decimal(5,2)"`
	Hits          []Hit           `json:"hits,omitempty" gorm:"foreignKey:ScreeningID"`
	Metadata      map[string]interface{} `json:"metadata,omitempty" gorm:"type:jsonb"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type Hit struct {
	ID           uuid.UUID       `json:"id" gorm:"type:uuid;primary_key"`
	ScreeningID  uuid.UUID       `json:"screening_id" gorm:"type:uuid;not null;index"`
	ListName     string          `json:"list_name" gorm:"type:varchar(200);not null"`
	MatchedName  string          `json:"matched_name" gorm:"type:varchar(200);not null"`
	MatchScore   float64         `json:"match_score" gorm:"type:decimal(5,2)"`
	Category     string          `json:"category,omitempty" gorm:"type:varchar(100)"`
	Description  string          `json:"description,omitempty" gorm:"type:text"`
	Source       string          `json:"source,omitempty" gorm:"type:varchar(200)"`
	DateAdded    *time.Time      `json:"date_added,omitempty"`
	RiskLevel    RiskLevel       `json:"risk_level" gorm:"type:varchar(50)"`
	Details      map[string]interface{} `json:"details,omitempty" gorm:"type:jsonb"`
	CreatedAt    time.Time       `json:"created_at"`
}

type ScreeningRequest struct {
	CustomerID    string     `json:"customer_id" binding:"required"`
	ScreeningType ScreeningType `json:"screening_type" binding:"required"`
	FullName      string     `json:"full_name" binding:"required"`
	DateOfBirth   *time.Time `json:"date_of_birth,omitempty"`
	Nationality   string     `json:"nationality,omitempty"`
}

type ScreeningResponse struct {
	ID            string          `json:"id"`
	CustomerID    string          `json:"customer_id"`
	ScreeningType ScreeningType   `json:"screening_type"`
	FullName      string          `json:"full_name"`
	Status        ScreeningStatus `json:"status"`
	RiskLevel     RiskLevel       `json:"risk_level,omitempty"`
	MatchScore    float64         `json:"match_score"`
	HitCount      int             `json:"hit_count"`
	Hits          []Hit           `json:"hits,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

func (AMLScreening) TableName() string {
	return "aml_screenings"
}

func (Hit) TableName() string {
	return "aml_hits"
}

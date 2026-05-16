package models

import (
	"time"

	"github.com/google/uuid"
)

type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

type DDLevel string

const (
	DDLevelSDD DDLevel = "sdd" // Simplified Due Diligence
	DDLevelCDD DDLevel = "cdd" // Customer Due Diligence
	DDLevelEDD DDLevel = "edd" // Enhanced Due Diligence
)

type RiskScore struct {
	ID                    uuid.UUID              `json:"id" gorm:"type:uuid;primary_key"`
	CustomerID            uuid.UUID              `json:"customer_id" gorm:"type:uuid;not null;index"`
	OverallScore          float64                `json:"overall_score" gorm:"type:decimal(5,2)"`
	RiskLevel             RiskLevel              `json:"risk_level" gorm:"type:varchar(50)"`
	DDLevel               DDLevel                `json:"dd_level" gorm:"type:varchar(50)"`
	IdentityScore         float64                `json:"identity_score" gorm:"type:decimal(5,2)"`
	DocumentScore         float64                `json:"document_score" gorm:"type:decimal(5,2)"`
	AMLScore              float64                `json:"aml_score" gorm:"type:decimal(5,2)"`
	BehaviorScore         float64                `json:"behavior_score" gorm:"type:decimal(5,2)"`
	GeographicScore       float64                `json:"geographic_score" gorm:"type:decimal(5,2)"`
	TransactionScore      float64                `json:"transaction_score" gorm:"type:decimal(5,2)"`
	RiskFactors           []RiskFactor           `json:"risk_factors,omitempty" gorm:"foreignKey:RiskScoreID"`
	Recommendations       map[string]interface{} `json:"recommendations,omitempty" gorm:"type:jsonb"`
	ModelVersion          string                 `json:"model_version" gorm:"type:varchar(50)"`
	CalculatedAt          time.Time              `json:"calculated_at"`
	ExpiresAt             time.Time              `json:"expires_at"`
	CreatedAt             time.Time              `json:"created_at"`
	UpdatedAt             time.Time              `json:"updated_at"`
}

type RiskFactor struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primary_key"`
	RiskScoreID  uuid.UUID              `json:"risk_score_id" gorm:"type:uuid;not null;index"`
	Category     string                 `json:"category" gorm:"type:varchar(100);not null"`
	Factor       string                 `json:"factor" gorm:"type:varchar(200);not null"`
	Impact       float64                `json:"impact" gorm:"type:decimal(5,2)"`
	Severity     RiskLevel              `json:"severity" gorm:"type:varchar(50)"`
	Description  string                 `json:"description,omitempty" gorm:"type:text"`
	Details      map[string]interface{} `json:"details,omitempty" gorm:"type:jsonb"`
	CreatedAt    time.Time              `json:"created_at"`
}

type RiskScoreRequest struct {
	CustomerID       string                 `json:"customer_id" binding:"required"`
	DocumentVerified bool                   `json:"document_verified"`
	LivenessVerified bool                   `json:"liveness_verified"`
	AMLClear         bool                   `json:"aml_clear"`
	AMLHitCount      int                    `json:"aml_hit_count"`
	Country          string                 `json:"country"`
	Occupation       string                 `json:"occupation"`
	TransactionData  map[string]interface{} `json:"transaction_data,omitempty"`
}

type RiskScoreResponse struct {
	ID               string       `json:"id"`
	CustomerID       string       `json:"customer_id"`
	OverallScore     float64      `json:"overall_score"`
	RiskLevel        RiskLevel    `json:"risk_level"`
	DDLevel          DDLevel      `json:"dd_level"`
	IdentityScore    float64      `json:"identity_score"`
	DocumentScore    float64      `json:"document_score"`
	AMLScore         float64      `json:"aml_score"`
	BehaviorScore    float64      `json:"behavior_score"`
	GeographicScore  float64      `json:"geographic_score"`
	TransactionScore float64      `json:"transaction_score"`
	RiskFactors      []RiskFactor `json:"risk_factors"`
	DDLevel          DDLevel      `json:"dd_level"`
	CalculatedAt     time.Time    `json:"calculated_at"`
	ExpiresAt        time.Time    `json:"expires_at"`
}

func (RiskScore) TableName() string {
	return "risk_scores"
}

func (RiskFactor) TableName() string {
	return "risk_factors"
}

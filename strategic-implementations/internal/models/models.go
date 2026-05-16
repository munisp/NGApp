package models

import (
	"time"
	"github.com/google/uuid"
)

type StrategicInitiative struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	InitiativeRef string                 `json:"initiative_ref" gorm:"uniqueIndex;not null"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	Category      string                 `json:"category"` // market_expansion, product_innovation, digital_transformation, operational_excellence, regulatory_compliance
	Priority      string                 `json:"priority"` // critical, high, medium, low
	Status        string                 `json:"status" gorm:"default:'planning'"` // planning, in_progress, on_hold, completed, cancelled
	OwnerID       string                 `json:"owner_id"`
	OwnerName     string                 `json:"owner_name"`
	StartDate     *time.Time             `json:"start_date"`
	TargetDate    *time.Time             `json:"target_date"`
	CompletedDate *time.Time             `json:"completed_date"`
	Budget        float64                `json:"budget"`
	SpentAmount   float64                `json:"spent_amount"`
	Progress      float64                `json:"progress"` // 0-100
	RiskLevel     string                 `json:"risk_level"`
	Tags          map[string]interface{} `json:"tags" gorm:"serializer:json"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

type Milestone struct {
	ID            uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey"`
	InitiativeRef string     `json:"initiative_ref" gorm:"index;not null"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	DueDate       time.Time  `json:"due_date"`
	Status        string     `json:"status" gorm:"default:'pending'"` // pending, in_progress, completed, overdue
	CompletedAt   *time.Time `json:"completed_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

type KPI struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	InitiativeRef string    `json:"initiative_ref" gorm:"index"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	TargetValue   float64   `json:"target_value"`
	CurrentValue  float64   `json:"current_value"`
	Unit          string    `json:"unit"`
	Frequency     string    `json:"frequency"` // daily, weekly, monthly, quarterly
	Status        string    `json:"status"` // on_track, at_risk, behind, exceeded
	LastUpdated   time.Time `json:"last_updated"`
	CreatedAt     time.Time `json:"created_at"`
}

type RiskRegister struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	InitiativeRef string                 `json:"initiative_ref" gorm:"index"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	Probability   string                 `json:"probability"` // low, medium, high
	Impact        string                 `json:"impact"` // low, medium, high, critical
	RiskScore     float64                `json:"risk_score"`
	Mitigation    string                 `json:"mitigation"`
	Owner         string                 `json:"owner"`
	Status        string                 `json:"status" gorm:"default:'identified'"` // identified, mitigating, resolved, accepted
	Details       map[string]interface{} `json:"details" gorm:"serializer:json"`
	CreatedAt     time.Time              `json:"created_at"`
}

type StrategicReport struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ReportType    string                 `json:"report_type"` // quarterly_review, annual_plan, board_summary, progress_update
	Period        string                 `json:"period"`
	Title         string                 `json:"title"`
	Summary       string                 `json:"summary"`
	Metrics       map[string]interface{} `json:"metrics" gorm:"serializer:json"`
	GeneratedBy   string                 `json:"generated_by"`
	CreatedAt     time.Time              `json:"created_at"`
}

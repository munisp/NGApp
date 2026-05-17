package models

import (
	"time"

	"github.com/google/uuid"
)

type ExperimentStatus string
type VariantType string

const (
	ExperimentStatusDraft     ExperimentStatus = "DRAFT"
	ExperimentStatusRunning   ExperimentStatus = "RUNNING"
	ExperimentStatusPaused    ExperimentStatus = "PAUSED"
	ExperimentStatusCompleted ExperimentStatus = "COMPLETED"
	ExperimentStatusArchived  ExperimentStatus = "ARCHIVED"

	VariantTypeControl   VariantType = "CONTROL"
	VariantTypeTreatment VariantType = "TREATMENT"
)

type Experiment struct {
	ID              uuid.UUID        `json:"id" gorm:"type:uuid;primary_key"`
	Name            string           `json:"name" gorm:"type:varchar(100);not null"`
	Description     string           `json:"description" gorm:"type:text"`
	Hypothesis      string           `json:"hypothesis" gorm:"type:text"`
	Status          ExperimentStatus `json:"status" gorm:"type:varchar(20)"`
	TargetMetric    string           `json:"target_metric" gorm:"type:varchar(100)"`
	SecondaryMetrics string          `json:"secondary_metrics" gorm:"type:jsonb"`
	TrafficPercent  float64          `json:"traffic_percent" gorm:"type:decimal(5,2);default:100"`
	TargetAudience  string           `json:"target_audience" gorm:"type:jsonb"`
	MinSampleSize   int              `json:"min_sample_size" gorm:"default:1000"`
	ConfidenceLevel float64          `json:"confidence_level" gorm:"type:decimal(5,2);default:95"`
	StartDate       *time.Time       `json:"start_date"`
	EndDate         *time.Time       `json:"end_date"`
	CreatedBy       uuid.UUID        `json:"created_by" gorm:"type:uuid"`
	CreatedAt       time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
}

type Variant struct {
	ID            uuid.UUID   `json:"id" gorm:"type:uuid;primary_key"`
	ExperimentID  uuid.UUID   `json:"experiment_id" gorm:"type:uuid;not null;index"`
	Name          string      `json:"name" gorm:"type:varchar(100)"`
	Description   string      `json:"description" gorm:"type:text"`
	VariantType   VariantType `json:"variant_type" gorm:"type:varchar(20)"`
	TrafficWeight float64     `json:"traffic_weight" gorm:"type:decimal(5,2);default:50"`
	Configuration string      `json:"configuration" gorm:"type:jsonb"`
	IsActive      bool        `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time   `json:"created_at" gorm:"autoCreateTime"`
}

type ExperimentAssignment struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ExperimentID uuid.UUID `json:"experiment_id" gorm:"type:uuid;not null;index"`
	VariantID    uuid.UUID `json:"variant_id" gorm:"type:uuid;not null;index"`
	UserID       uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	SessionID    string    `json:"session_id" gorm:"type:varchar(100)"`
	AssignedAt   time.Time `json:"assigned_at" gorm:"autoCreateTime"`
}

type ExperimentEvent struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ExperimentID uuid.UUID `json:"experiment_id" gorm:"type:uuid;not null;index"`
	VariantID    uuid.UUID `json:"variant_id" gorm:"type:uuid;not null;index"`
	UserID       uuid.UUID `json:"user_id" gorm:"type:uuid;index"`
	EventType    string    `json:"event_type" gorm:"type:varchar(50)"`
	EventValue   float64   `json:"event_value" gorm:"type:decimal(20,4)"`
	Metadata     string    `json:"metadata" gorm:"type:jsonb"`
	OccurredAt   time.Time `json:"occurred_at" gorm:"autoCreateTime"`
}

type ExperimentResult struct {
	ID                uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ExperimentID      uuid.UUID `json:"experiment_id" gorm:"type:uuid;not null;index"`
	VariantID         uuid.UUID `json:"variant_id" gorm:"type:uuid;not null"`
	SampleSize        int       `json:"sample_size"`
	ConversionRate    float64   `json:"conversion_rate" gorm:"type:decimal(10,4)"`
	MeanValue         float64   `json:"mean_value" gorm:"type:decimal(20,4)"`
	StandardDeviation float64   `json:"standard_deviation" gorm:"type:decimal(20,4)"`
	ConfidenceInterval string   `json:"confidence_interval" gorm:"type:varchar(50)"`
	PValue            float64   `json:"p_value" gorm:"type:decimal(10,6)"`
	IsSignificant     bool      `json:"is_significant" gorm:"default:false"`
	Uplift            float64   `json:"uplift" gorm:"type:decimal(10,4)"`
	CalculatedAt      time.Time `json:"calculated_at" gorm:"autoCreateTime"`
}

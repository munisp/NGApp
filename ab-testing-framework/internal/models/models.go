package models

import (
	"time"

	"github.com/google/uuid"
)

type Experiment struct {
	ID              uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	Name            string                 `json:"name" gorm:"uniqueIndex;not null"`
	Description     string                 `json:"description"`
	Hypothesis      string                 `json:"hypothesis"`
	Module          string                 `json:"module" gorm:"index"`
	FeatureFlag     string                 `json:"feature_flag"`
	TrafficPercent  float64                `json:"traffic_percent"`
	TargetMetric    string                 `json:"target_metric"`
	MinSampleSize   int                    `json:"min_sample_size"`
	ConfidenceLevel float64                `json:"confidence_level" gorm:"default:0.95"`
	SegmentCriteria map[string]interface{} `json:"segment_criteria" gorm:"serializer:json"`
	Status          string                 `json:"status" gorm:"default:'draft'"` 
	StartedAt       *time.Time             `json:"started_at"`
	EndedAt         *time.Time             `json:"ended_at"`
	WinnerVariant   string                 `json:"winner_variant"`
	CreatedBy       string                 `json:"created_by"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type Variant struct {
	ID            uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ExperimentID  uuid.UUID              `json:"experiment_id" gorm:"type:uuid;index;not null"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	IsControl     bool                   `json:"is_control" gorm:"default:false"`
	TrafficWeight float64                `json:"traffic_weight"`
	Config        map[string]interface{} `json:"config" gorm:"serializer:json"`
	CreatedAt     time.Time              `json:"created_at"`
}

type ExperimentAssignment struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ExperimentID uuid.UUID `json:"experiment_id" gorm:"type:uuid;index;not null"`
	VariantID    uuid.UUID `json:"variant_id" gorm:"type:uuid;index"`
	UserID       string    `json:"user_id" gorm:"index;not null"`
	SessionID    string    `json:"session_id"`
	AssignedAt   time.Time `json:"assigned_at"`
}

type MetricEvent struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey"`
	ExperimentID uuid.UUID              `json:"experiment_id" gorm:"type:uuid;index;not null"`
	VariantID    uuid.UUID              `json:"variant_id" gorm:"type:uuid;index"`
	UserID       string                 `json:"user_id" gorm:"index"`
	MetricName   string                 `json:"metric_name" gorm:"index"`
	MetricValue  float64                `json:"metric_value"`
	Metadata     map[string]interface{} `json:"metadata" gorm:"serializer:json"`
	RecordedAt   time.Time              `json:"recorded_at"`
}

type ExperimentResult struct {
	ID                 uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ExperimentID       uuid.UUID `json:"experiment_id" gorm:"type:uuid;index"`
	VariantID          uuid.UUID `json:"variant_id" gorm:"type:uuid"`
	VariantName        string    `json:"variant_name"`
	SampleSize         int       `json:"sample_size"`
	ConversionRate     float64   `json:"conversion_rate"`
	MeanValue          float64   `json:"mean_value"`
	StandardDeviation  float64   `json:"standard_deviation"`
	ConfidenceInterval string    `json:"confidence_interval"`
	PValue             float64   `json:"p_value"`
	IsSignificant      bool      `json:"is_significant"`
	Uplift             float64   `json:"uplift"`
	CalculatedAt       time.Time `json:"calculated_at"`
}

package sla

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SLATrackerConfig holds configuration for SLA tracking
type SLATrackerConfig struct {
	DefaultSLAHours     int
	WarningThreshold    float64 // Percentage of SLA time remaining to trigger warning
	CriticalThreshold   float64 // Percentage of SLA time remaining to trigger critical alert
}

// SLATracker handles SLA tracking and alerts
type SLATracker struct {
	db     *gorm.DB
	config SLATrackerConfig
}

// NewSLATracker creates a new SLA tracker
func NewSLATracker(db *gorm.DB, config SLATrackerConfig) *SLATracker {
	if config.DefaultSLAHours == 0 {
		config.DefaultSLAHours = 48
	}
	if config.WarningThreshold == 0 {
		config.WarningThreshold = 0.25 // 25% time remaining
	}
	if config.CriticalThreshold == 0 {
		config.CriticalThreshold = 0.10 // 10% time remaining
	}
	return &SLATracker{
		db:     db,
		config: config,
	}
}

// SLADefinition represents an SLA definition
type SLADefinition struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Name            string    `json:"name" gorm:"type:varchar(100);not null"`
	Description     string    `json:"description" gorm:"type:text"`
	ProductType     string    `json:"product_type" gorm:"type:varchar(50)"`
	ClaimType       string    `json:"claim_type" gorm:"type:varchar(50)"`
	Priority        string    `json:"priority" gorm:"type:varchar(20)"`
	TargetHours     int       `json:"target_hours" gorm:"not null"`
	WarningHours    int       `json:"warning_hours"`
	CriticalHours   int       `json:"critical_hours"`
	EscalationPath  string    `json:"escalation_path" gorm:"type:text"` // JSON array of escalation contacts
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// SLARecord represents an SLA record for a claim
type SLARecord struct {
	ID              uuid.UUID   `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID         uuid.UUID   `json:"claim_id" gorm:"type:uuid;not null;uniqueIndex"`
	DefinitionID    uuid.UUID   `json:"definition_id" gorm:"type:uuid"`
	StartTime       time.Time   `json:"start_time" gorm:"not null"`
	TargetTime      time.Time   `json:"target_time" gorm:"not null"`
	WarningTime     time.Time   `json:"warning_time"`
	CriticalTime    time.Time   `json:"critical_time"`
	CompletedTime   *time.Time  `json:"completed_time"`
	Status          SLAStatus   `json:"status" gorm:"type:varchar(20);not null"`
	PausedAt        *time.Time  `json:"paused_at"`
	PausedDuration  int64       `json:"paused_duration"` // in seconds
	PauseReason     string      `json:"pause_reason" gorm:"type:text"`
	BreachReason    string      `json:"breach_reason" gorm:"type:text"`
	CurrentStage    string      `json:"current_stage" gorm:"type:varchar(50)"`
	Alerts          []SLAAlert  `json:"alerts" gorm:"foreignKey:RecordID"`
	CreatedAt       time.Time   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time   `json:"updated_at" gorm:"autoUpdateTime"`
}

// SLAStatus represents the status of an SLA
type SLAStatus string

const (
	SLAStatusOnTrack   SLAStatus = "ON_TRACK"
	SLAStatusWarning   SLAStatus = "WARNING"
	SLAStatusCritical  SLAStatus = "CRITICAL"
	SLAStatusBreached  SLAStatus = "BREACHED"
	SLAStatusCompleted SLAStatus = "COMPLETED"
	SLAStatusPaused    SLAStatus = "PAUSED"
)

// SLAAlert represents an SLA alert
type SLAAlert struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	RecordID    uuid.UUID `json:"record_id" gorm:"type:uuid;not null;index"`
	AlertType   string    `json:"alert_type" gorm:"type:varchar(20);not null"`
	Message     string    `json:"message" gorm:"type:text"`
	Recipients  string    `json:"recipients" gorm:"type:text"` // JSON array
	SentAt      time.Time `json:"sent_at" gorm:"autoCreateTime"`
	Acknowledged bool     `json:"acknowledged" gorm:"default:false"`
	AcknowledgedBy *uuid.UUID `json:"acknowledged_by" gorm:"type:uuid"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
}

// StartSLATracking starts SLA tracking for a claim
func (t *SLATracker) StartSLATracking(ctx context.Context, claimID uuid.UUID, productType, claimType, priority string) (*SLARecord, error) {
	// Get SLA definition
	definition, err := t.GetSLADefinition(ctx, productType, claimType, priority)
	if err != nil {
		// Use default SLA
		definition = t.getDefaultDefinition(priority)
	}

	now := time.Now()
	record := &SLARecord{
		ID:           uuid.New(),
		ClaimID:      claimID,
		DefinitionID: definition.ID,
		StartTime:    now,
		TargetTime:   now.Add(time.Duration(definition.TargetHours) * time.Hour),
		WarningTime:  now.Add(time.Duration(definition.WarningHours) * time.Hour),
		CriticalTime: now.Add(time.Duration(definition.CriticalHours) * time.Hour),
		Status:       SLAStatusOnTrack,
		CurrentStage: "submitted",
	}

	if err := t.db.WithContext(ctx).Create(record).Error; err != nil {
		return nil, err
	}

	return record, nil
}

// GetSLADefinition gets the SLA definition for a claim type
func (t *SLATracker) GetSLADefinition(ctx context.Context, productType, claimType, priority string) (*SLADefinition, error) {
	var definition SLADefinition
	err := t.db.WithContext(ctx).
		Where("product_type = ? AND claim_type = ? AND priority = ? AND is_active = ?", productType, claimType, priority, true).
		First(&definition).Error
	if err != nil {
		return nil, err
	}
	return &definition, nil
}

// getDefaultDefinition returns a default SLA definition
func (t *SLATracker) getDefaultDefinition(priority string) *SLADefinition {
	targetHours := t.config.DefaultSLAHours
	switch priority {
	case "high":
		targetHours = 24
	case "medium":
		targetHours = 48
	case "low":
		targetHours = 72
	}

	return &SLADefinition{
		ID:            uuid.New(),
		Name:          fmt.Sprintf("Default %s Priority SLA", priority),
		Priority:      priority,
		TargetHours:   targetHours,
		WarningHours:  int(float64(targetHours) * (1 - t.config.WarningThreshold)),
		CriticalHours: int(float64(targetHours) * (1 - t.config.CriticalThreshold)),
	}
}

// UpdateSLAStatus updates the SLA status for a claim
func (t *SLATracker) UpdateSLAStatus(ctx context.Context, claimID uuid.UUID, stage string) error {
	var record SLARecord
	if err := t.db.WithContext(ctx).Where("claim_id = ?", claimID).First(&record).Error; err != nil {
		return err
	}

	record.CurrentStage = stage
	now := time.Now()

	// Check SLA status
	if record.Status != SLAStatusPaused && record.Status != SLAStatusCompleted {
		if now.After(record.TargetTime) {
			record.Status = SLAStatusBreached
			record.BreachReason = fmt.Sprintf("SLA breached at stage: %s", stage)
		} else if now.After(record.CriticalTime) {
			record.Status = SLAStatusCritical
		} else if now.After(record.WarningTime) {
			record.Status = SLAStatusWarning
		} else {
			record.Status = SLAStatusOnTrack
		}
	}

	return t.db.WithContext(ctx).Save(&record).Error
}

// CompleteSLA marks the SLA as completed
func (t *SLATracker) CompleteSLA(ctx context.Context, claimID uuid.UUID) error {
	var record SLARecord
	if err := t.db.WithContext(ctx).Where("claim_id = ?", claimID).First(&record).Error; err != nil {
		return err
	}

	now := time.Now()
	record.CompletedTime = &now
	record.Status = SLAStatusCompleted

	return t.db.WithContext(ctx).Save(&record).Error
}

// PauseSLA pauses the SLA timer
func (t *SLATracker) PauseSLA(ctx context.Context, claimID uuid.UUID, reason string) error {
	var record SLARecord
	if err := t.db.WithContext(ctx).Where("claim_id = ?", claimID).First(&record).Error; err != nil {
		return err
	}

	now := time.Now()
	record.PausedAt = &now
	record.PauseReason = reason
	record.Status = SLAStatusPaused

	return t.db.WithContext(ctx).Save(&record).Error
}

// ResumeSLA resumes the SLA timer
func (t *SLATracker) ResumeSLA(ctx context.Context, claimID uuid.UUID) error {
	var record SLARecord
	if err := t.db.WithContext(ctx).Where("claim_id = ?", claimID).First(&record).Error; err != nil {
		return err
	}

	if record.PausedAt == nil {
		return fmt.Errorf("SLA is not paused")
	}

	pausedDuration := time.Since(*record.PausedAt)
	record.PausedDuration += int64(pausedDuration.Seconds())
	record.PausedAt = nil

	// Extend target times by paused duration
	record.TargetTime = record.TargetTime.Add(pausedDuration)
	record.WarningTime = record.WarningTime.Add(pausedDuration)
	record.CriticalTime = record.CriticalTime.Add(pausedDuration)

	// Recalculate status
	now := time.Now()
	if now.After(record.TargetTime) {
		record.Status = SLAStatusBreached
	} else if now.After(record.CriticalTime) {
		record.Status = SLAStatusCritical
	} else if now.After(record.WarningTime) {
		record.Status = SLAStatusWarning
	} else {
		record.Status = SLAStatusOnTrack
	}

	return t.db.WithContext(ctx).Save(&record).Error
}

// GetSLARecord gets the SLA record for a claim
func (t *SLATracker) GetSLARecord(ctx context.Context, claimID uuid.UUID) (*SLARecord, error) {
	var record SLARecord
	err := t.db.WithContext(ctx).
		Where("claim_id = ?", claimID).
		Preload("Alerts").
		First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

// GetSLAStatus gets the current SLA status with time remaining
func (t *SLATracker) GetSLAStatus(ctx context.Context, claimID uuid.UUID) (*SLAStatusInfo, error) {
	record, err := t.GetSLARecord(ctx, claimID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	timeRemaining := record.TargetTime.Sub(now)
	if record.PausedAt != nil {
		// Adjust for paused time
		timeRemaining = record.TargetTime.Sub(*record.PausedAt)
	}

	percentageRemaining := float64(timeRemaining) / float64(record.TargetTime.Sub(record.StartTime)) * 100
	if percentageRemaining < 0 {
		percentageRemaining = 0
	}

	return &SLAStatusInfo{
		ClaimID:             claimID,
		Status:              record.Status,
		StartTime:           record.StartTime,
		TargetTime:          record.TargetTime,
		TimeRemaining:       timeRemaining,
		PercentageRemaining: percentageRemaining,
		CurrentStage:        record.CurrentStage,
		IsPaused:            record.PausedAt != nil,
		IsBreached:          record.Status == SLAStatusBreached,
		IsCompleted:         record.Status == SLAStatusCompleted,
	}, nil
}

// SLAStatusInfo represents detailed SLA status information
type SLAStatusInfo struct {
	ClaimID             uuid.UUID     `json:"claim_id"`
	Status              SLAStatus     `json:"status"`
	StartTime           time.Time     `json:"start_time"`
	TargetTime          time.Time     `json:"target_time"`
	TimeRemaining       time.Duration `json:"time_remaining"`
	PercentageRemaining float64       `json:"percentage_remaining"`
	CurrentStage        string        `json:"current_stage"`
	IsPaused            bool          `json:"is_paused"`
	IsBreached          bool          `json:"is_breached"`
	IsCompleted         bool          `json:"is_completed"`
}

// CheckAndSendAlerts checks all SLA records and sends alerts as needed
func (t *SLATracker) CheckAndSendAlerts(ctx context.Context) ([]SLAAlert, error) {
	var records []SLARecord
	now := time.Now()

	// Get records that need alerts
	err := t.db.WithContext(ctx).
		Where("status NOT IN ? AND completed_time IS NULL AND paused_at IS NULL", []SLAStatus{SLAStatusCompleted, SLAStatusBreached}).
		Find(&records).Error
	if err != nil {
		return nil, err
	}

	var alerts []SLAAlert

	for _, record := range records {
		var alertType string
		var message string

		if now.After(record.TargetTime) {
			alertType = "BREACH"
			message = fmt.Sprintf("SLA BREACHED for claim %s. Target time was %s", record.ClaimID, record.TargetTime.Format(time.RFC3339))
			record.Status = SLAStatusBreached
		} else if now.After(record.CriticalTime) && record.Status != SLAStatusCritical {
			alertType = "CRITICAL"
			message = fmt.Sprintf("CRITICAL: SLA for claim %s will breach in %s", record.ClaimID, record.TargetTime.Sub(now).Round(time.Minute))
			record.Status = SLAStatusCritical
		} else if now.After(record.WarningTime) && record.Status != SLAStatusWarning && record.Status != SLAStatusCritical {
			alertType = "WARNING"
			message = fmt.Sprintf("WARNING: SLA for claim %s is at risk. Time remaining: %s", record.ClaimID, record.TargetTime.Sub(now).Round(time.Minute))
			record.Status = SLAStatusWarning
		}

		if alertType != "" {
			alert := SLAAlert{
				ID:        uuid.New(),
				RecordID:  record.ID,
				AlertType: alertType,
				Message:   message,
				SentAt:    now,
			}

			if err := t.db.WithContext(ctx).Create(&alert).Error; err == nil {
				alerts = append(alerts, alert)
			}

			t.db.WithContext(ctx).Save(&record)
		}
	}

	return alerts, nil
}

// GetSLAMetrics gets SLA metrics for a time period
func (t *SLATracker) GetSLAMetrics(ctx context.Context, startDate, endDate time.Time) (*SLAMetrics, error) {
	var metrics SLAMetrics

	// Total claims
	t.db.WithContext(ctx).Model(&SLARecord{}).
		Where("start_time BETWEEN ? AND ?", startDate, endDate).
		Count(&metrics.TotalClaims)

	// Completed within SLA
	t.db.WithContext(ctx).Model(&SLARecord{}).
		Where("start_time BETWEEN ? AND ? AND status = ? AND completed_time <= target_time", startDate, endDate, SLAStatusCompleted).
		Count(&metrics.CompletedWithinSLA)

	// Breached
	t.db.WithContext(ctx).Model(&SLARecord{}).
		Where("start_time BETWEEN ? AND ? AND status = ?", startDate, endDate, SLAStatusBreached).
		Count(&metrics.Breached)

	// Currently at risk
	t.db.WithContext(ctx).Model(&SLARecord{}).
		Where("start_time BETWEEN ? AND ? AND status IN ?", startDate, endDate, []SLAStatus{SLAStatusWarning, SLAStatusCritical}).
		Count(&metrics.AtRisk)

	// Calculate compliance rate
	if metrics.TotalClaims > 0 {
		metrics.ComplianceRate = float64(metrics.CompletedWithinSLA) / float64(metrics.TotalClaims) * 100
	}

	// Average processing time
	var avgTime float64
	t.db.WithContext(ctx).Model(&SLARecord{}).
		Where("start_time BETWEEN ? AND ? AND completed_time IS NOT NULL", startDate, endDate).
		Select("AVG(EXTRACT(EPOCH FROM (completed_time - start_time)) / 3600)").
		Scan(&avgTime)
	metrics.AvgProcessingHours = avgTime

	return &metrics, nil
}

// SLAMetrics represents SLA metrics
type SLAMetrics struct {
	TotalClaims        int64   `json:"total_claims"`
	CompletedWithinSLA int64   `json:"completed_within_sla"`
	Breached           int64   `json:"breached"`
	AtRisk             int64   `json:"at_risk"`
	ComplianceRate     float64 `json:"compliance_rate"`
	AvgProcessingHours float64 `json:"avg_processing_hours"`
}

// GetBreachedClaims gets all breached claims
func (t *SLATracker) GetBreachedClaims(ctx context.Context) ([]SLARecord, error) {
	var records []SLARecord
	err := t.db.WithContext(ctx).
		Where("status = ?", SLAStatusBreached).
		Order("target_time ASC").
		Find(&records).Error
	return records, err
}

// GetAtRiskClaims gets all claims at risk of breaching SLA
func (t *SLATracker) GetAtRiskClaims(ctx context.Context) ([]SLARecord, error) {
	var records []SLARecord
	err := t.db.WithContext(ctx).
		Where("status IN ?", []SLAStatus{SLAStatusWarning, SLAStatusCritical}).
		Order("target_time ASC").
		Find(&records).Error
	return records, err
}

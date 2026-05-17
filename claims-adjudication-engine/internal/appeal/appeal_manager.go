package appeal

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AppealManagerConfig holds configuration for appeal management
type AppealManagerConfig struct {
	MaxAppealsPerClaim int
	AppealWindowDays   int
	DefaultSLADays     int
}

// AppealManager handles appeal and dispute management
type AppealManager struct {
	db     *gorm.DB
	config AppealManagerConfig
}

// NewAppealManager creates a new appeal manager
func NewAppealManager(db *gorm.DB, config AppealManagerConfig) *AppealManager {
	if config.MaxAppealsPerClaim == 0 {
		config.MaxAppealsPerClaim = 3
	}
	if config.AppealWindowDays == 0 {
		config.AppealWindowDays = 30
	}
	if config.DefaultSLADays == 0 {
		config.DefaultSLADays = 14
	}
	return &AppealManager{
		db:     db,
		config: config,
	}
}

// Appeal represents a claim appeal
type Appeal struct {
	ID              uuid.UUID     `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID         uuid.UUID     `json:"claim_id" gorm:"type:uuid;not null;index"`
	AppealNumber    string        `json:"appeal_number" gorm:"type:varchar(50);uniqueIndex"`
	AppealType      AppealType    `json:"appeal_type" gorm:"type:varchar(30);not null"`
	Status          AppealStatus  `json:"status" gorm:"type:varchar(20);not null"`
	OriginalDecision string       `json:"original_decision" gorm:"type:varchar(20)"`
	OriginalAmount  float64       `json:"original_amount" gorm:"type:decimal(20,2)"`
	RequestedAmount float64       `json:"requested_amount" gorm:"type:decimal(20,2)"`
	Reason          string        `json:"reason" gorm:"type:text;not null"`
	SupportingDocs  string        `json:"supporting_docs" gorm:"type:text"` // JSON array of document IDs
	SubmittedBy     uuid.UUID     `json:"submitted_by" gorm:"type:uuid;not null"`
	SubmittedAt     time.Time     `json:"submitted_at" gorm:"autoCreateTime"`
	AssignedTo      *uuid.UUID    `json:"assigned_to" gorm:"type:uuid"`
	AssignedAt      *time.Time    `json:"assigned_at"`
	ReviewedBy      *uuid.UUID    `json:"reviewed_by" gorm:"type:uuid"`
	ReviewedAt      *time.Time    `json:"reviewed_at"`
	Decision        string        `json:"decision" gorm:"type:varchar(20)"`
	DecisionReason  string        `json:"decision_reason" gorm:"type:text"`
	NewAmount       *float64      `json:"new_amount" gorm:"type:decimal(20,2)"`
	SLADeadline     time.Time     `json:"sla_deadline"`
	EscalationLevel int           `json:"escalation_level" gorm:"default:0"`
	Notes           []AppealNote  `json:"notes" gorm:"foreignKey:AppealID"`
	Timeline        []AppealEvent `json:"timeline" gorm:"foreignKey:AppealID"`
	CreatedAt       time.Time     `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time     `json:"updated_at" gorm:"autoUpdateTime"`
}

// AppealType represents the type of appeal
type AppealType string

const (
	AppealTypeDecision     AppealType = "DECISION"      // Appeal against decision (approve/reject)
	AppealTypeAmount       AppealType = "AMOUNT"        // Appeal against approved amount
	AppealTypeProcessing   AppealType = "PROCESSING"    // Appeal against processing time
	AppealTypeDocumentation AppealType = "DOCUMENTATION" // Appeal for document reconsideration
	AppealTypeOther        AppealType = "OTHER"
)

// AppealStatus represents the status of an appeal
type AppealStatus string

const (
	AppealStatusSubmitted   AppealStatus = "SUBMITTED"
	AppealStatusUnderReview AppealStatus = "UNDER_REVIEW"
	AppealStatusPending     AppealStatus = "PENDING_INFO"
	AppealStatusEscalated   AppealStatus = "ESCALATED"
	AppealStatusResolved    AppealStatus = "RESOLVED"
	AppealStatusRejected    AppealStatus = "REJECTED"
	AppealStatusWithdrawn   AppealStatus = "WITHDRAWN"
)

// AppealNote represents a note on an appeal
type AppealNote struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	AppealID  uuid.UUID `json:"appeal_id" gorm:"type:uuid;not null;index"`
	AuthorID  uuid.UUID `json:"author_id" gorm:"type:uuid;not null"`
	AuthorName string   `json:"author_name" gorm:"type:varchar(100)"`
	Content   string    `json:"content" gorm:"type:text;not null"`
	IsInternal bool     `json:"is_internal" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// AppealEvent represents an event in the appeal timeline
type AppealEvent struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	AppealID    uuid.UUID `json:"appeal_id" gorm:"type:uuid;not null;index"`
	EventType   string    `json:"event_type" gorm:"type:varchar(50);not null"`
	Description string    `json:"description" gorm:"type:text"`
	ActorID     uuid.UUID `json:"actor_id" gorm:"type:uuid"`
	ActorName   string    `json:"actor_name" gorm:"type:varchar(100)"`
	OldValue    string    `json:"old_value" gorm:"type:text"`
	NewValue    string    `json:"new_value" gorm:"type:text"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// SubmitAppeal submits a new appeal
func (m *AppealManager) SubmitAppeal(ctx context.Context, appeal *Appeal) error {
	// Check if appeal window is still open
	// In production, check the original decision date

	// Check max appeals per claim
	var count int64
	m.db.WithContext(ctx).Model(&Appeal{}).Where("claim_id = ?", appeal.ClaimID).Count(&count)
	if int(count) >= m.config.MaxAppealsPerClaim {
		return fmt.Errorf("maximum number of appeals (%d) reached for this claim", m.config.MaxAppealsPerClaim)
	}

	appeal.ID = uuid.New()
	appeal.AppealNumber = fmt.Sprintf("APL-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)
	appeal.Status = AppealStatusSubmitted
	appeal.SLADeadline = time.Now().AddDate(0, 0, m.config.DefaultSLADays)

	if err := m.db.WithContext(ctx).Create(appeal).Error; err != nil {
		return err
	}

	// Create initial timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appeal.ID,
		EventType:   "SUBMITTED",
		Description: fmt.Sprintf("Appeal submitted: %s", appeal.Reason[:min(100, len(appeal.Reason))]),
		ActorID:     appeal.SubmittedBy,
		CreatedAt:   time.Now(),
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// AssignAppeal assigns an appeal to a reviewer
func (m *AppealManager) AssignAppeal(ctx context.Context, appealID uuid.UUID, reviewerID uuid.UUID, reviewerName string) error {
	var appeal Appeal
	if err := m.db.WithContext(ctx).First(&appeal, "id = ?", appealID).Error; err != nil {
		return err
	}

	now := time.Now()
	appeal.AssignedTo = &reviewerID
	appeal.AssignedAt = &now
	appeal.Status = AppealStatusUnderReview

	if err := m.db.WithContext(ctx).Save(&appeal).Error; err != nil {
		return err
	}

	// Create timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appealID,
		EventType:   "ASSIGNED",
		Description: fmt.Sprintf("Appeal assigned to %s", reviewerName),
		ActorID:     reviewerID,
		ActorName:   reviewerName,
		NewValue:    reviewerID.String(),
		CreatedAt:   now,
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// RequestAdditionalInfo requests additional information from the appellant
func (m *AppealManager) RequestAdditionalInfo(ctx context.Context, appealID uuid.UUID, reviewerID uuid.UUID, request string) error {
	var appeal Appeal
	if err := m.db.WithContext(ctx).First(&appeal, "id = ?", appealID).Error; err != nil {
		return err
	}

	appeal.Status = AppealStatusPending

	if err := m.db.WithContext(ctx).Save(&appeal).Error; err != nil {
		return err
	}

	// Add note
	note := AppealNote{
		ID:        uuid.New(),
		AppealID:  appealID,
		AuthorID:  reviewerID,
		Content:   fmt.Sprintf("Additional information requested: %s", request),
		IsInternal: false,
		CreatedAt: time.Now(),
	}
	m.db.WithContext(ctx).Create(&note)

	// Create timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appealID,
		EventType:   "INFO_REQUESTED",
		Description: "Additional information requested from appellant",
		ActorID:     reviewerID,
		CreatedAt:   time.Now(),
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// SubmitAdditionalInfo submits additional information for an appeal
func (m *AppealManager) SubmitAdditionalInfo(ctx context.Context, appealID uuid.UUID, submitterID uuid.UUID, info string, documents []uuid.UUID) error {
	var appeal Appeal
	if err := m.db.WithContext(ctx).First(&appeal, "id = ?", appealID).Error; err != nil {
		return err
	}

	if appeal.Status != AppealStatusPending {
		return fmt.Errorf("appeal is not pending additional information")
	}

	appeal.Status = AppealStatusUnderReview

	if err := m.db.WithContext(ctx).Save(&appeal).Error; err != nil {
		return err
	}

	// Add note
	note := AppealNote{
		ID:        uuid.New(),
		AppealID:  appealID,
		AuthorID:  submitterID,
		Content:   info,
		IsInternal: false,
		CreatedAt: time.Now(),
	}
	m.db.WithContext(ctx).Create(&note)

	// Create timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appealID,
		EventType:   "INFO_SUBMITTED",
		Description: "Additional information submitted",
		ActorID:     submitterID,
		CreatedAt:   time.Now(),
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// EscalateAppeal escalates an appeal to a higher level
func (m *AppealManager) EscalateAppeal(ctx context.Context, appealID uuid.UUID, escalatorID uuid.UUID, reason string) error {
	var appeal Appeal
	if err := m.db.WithContext(ctx).First(&appeal, "id = ?", appealID).Error; err != nil {
		return err
	}

	appeal.EscalationLevel++
	appeal.Status = AppealStatusEscalated
	appeal.AssignedTo = nil
	appeal.AssignedAt = nil

	if err := m.db.WithContext(ctx).Save(&appeal).Error; err != nil {
		return err
	}

	// Add note
	note := AppealNote{
		ID:        uuid.New(),
		AppealID:  appealID,
		AuthorID:  escalatorID,
		Content:   fmt.Sprintf("Escalated to level %d: %s", appeal.EscalationLevel, reason),
		IsInternal: true,
		CreatedAt: time.Now(),
	}
	m.db.WithContext(ctx).Create(&note)

	// Create timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appealID,
		EventType:   "ESCALATED",
		Description: fmt.Sprintf("Appeal escalated to level %d", appeal.EscalationLevel),
		ActorID:     escalatorID,
		OldValue:    fmt.Sprintf("%d", appeal.EscalationLevel-1),
		NewValue:    fmt.Sprintf("%d", appeal.EscalationLevel),
		CreatedAt:   time.Now(),
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// ResolveAppeal resolves an appeal with a decision
func (m *AppealManager) ResolveAppeal(ctx context.Context, appealID uuid.UUID, reviewerID uuid.UUID, reviewerName string, decision string, reason string, newAmount *float64) error {
	var appeal Appeal
	if err := m.db.WithContext(ctx).First(&appeal, "id = ?", appealID).Error; err != nil {
		return err
	}

	now := time.Now()
	appeal.ReviewedBy = &reviewerID
	appeal.ReviewedAt = &now
	appeal.Decision = decision
	appeal.DecisionReason = reason
	appeal.NewAmount = newAmount

	if decision == "UPHELD" || decision == "PARTIALLY_UPHELD" {
		appeal.Status = AppealStatusResolved
	} else {
		appeal.Status = AppealStatusRejected
	}

	if err := m.db.WithContext(ctx).Save(&appeal).Error; err != nil {
		return err
	}

	// Create timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appealID,
		EventType:   "RESOLVED",
		Description: fmt.Sprintf("Appeal %s: %s", decision, reason[:min(100, len(reason))]),
		ActorID:     reviewerID,
		ActorName:   reviewerName,
		NewValue:    decision,
		CreatedAt:   now,
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// WithdrawAppeal withdraws an appeal
func (m *AppealManager) WithdrawAppeal(ctx context.Context, appealID uuid.UUID, withdrawerID uuid.UUID, reason string) error {
	var appeal Appeal
	if err := m.db.WithContext(ctx).First(&appeal, "id = ?", appealID).Error; err != nil {
		return err
	}

	if appeal.Status == AppealStatusResolved || appeal.Status == AppealStatusRejected {
		return fmt.Errorf("cannot withdraw a resolved or rejected appeal")
	}

	appeal.Status = AppealStatusWithdrawn

	if err := m.db.WithContext(ctx).Save(&appeal).Error; err != nil {
		return err
	}

	// Create timeline event
	event := AppealEvent{
		ID:          uuid.New(),
		AppealID:    appealID,
		EventType:   "WITHDRAWN",
		Description: fmt.Sprintf("Appeal withdrawn: %s", reason),
		ActorID:     withdrawerID,
		CreatedAt:   time.Now(),
	}
	m.db.WithContext(ctx).Create(&event)

	return nil
}

// GetAppeal gets an appeal by ID
func (m *AppealManager) GetAppeal(ctx context.Context, appealID uuid.UUID) (*Appeal, error) {
	var appeal Appeal
	err := m.db.WithContext(ctx).
		Preload("Notes").
		Preload("Timeline").
		First(&appeal, "id = ?", appealID).Error
	if err != nil {
		return nil, err
	}
	return &appeal, nil
}

// GetAppealsByClaimID gets all appeals for a claim
func (m *AppealManager) GetAppealsByClaimID(ctx context.Context, claimID uuid.UUID) ([]Appeal, error) {
	var appeals []Appeal
	err := m.db.WithContext(ctx).
		Where("claim_id = ?", claimID).
		Preload("Notes").
		Preload("Timeline").
		Order("created_at DESC").
		Find(&appeals).Error
	return appeals, err
}

// GetPendingAppeals gets all pending appeals for a reviewer
func (m *AppealManager) GetPendingAppeals(ctx context.Context, reviewerID *uuid.UUID, escalationLevel int) ([]Appeal, error) {
	query := m.db.WithContext(ctx).
		Where("status IN ?", []AppealStatus{AppealStatusSubmitted, AppealStatusUnderReview, AppealStatusPending, AppealStatusEscalated})

	if reviewerID != nil {
		query = query.Where("assigned_to = ?", *reviewerID)
	}

	if escalationLevel >= 0 {
		query = query.Where("escalation_level = ?", escalationLevel)
	}

	var appeals []Appeal
	err := query.Order("sla_deadline ASC").Find(&appeals).Error
	return appeals, err
}

// AddNote adds a note to an appeal
func (m *AppealManager) AddNote(ctx context.Context, appealID uuid.UUID, authorID uuid.UUID, authorName string, content string, isInternal bool) error {
	note := AppealNote{
		ID:         uuid.New(),
		AppealID:   appealID,
		AuthorID:   authorID,
		AuthorName: authorName,
		Content:    content,
		IsInternal: isInternal,
		CreatedAt:  time.Now(),
	}
	return m.db.WithContext(ctx).Create(&note).Error
}

// GetAppealStats gets appeal statistics
func (m *AppealManager) GetAppealStats(ctx context.Context, startDate, endDate time.Time) (*AppealStats, error) {
	var stats AppealStats

	// Total appeals
	m.db.WithContext(ctx).Model(&Appeal{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Count(&stats.TotalAppeals)

	// By status
	m.db.WithContext(ctx).Model(&Appeal{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", startDate, endDate, AppealStatusResolved).
		Count(&stats.Resolved)

	m.db.WithContext(ctx).Model(&Appeal{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", startDate, endDate, AppealStatusRejected).
		Count(&stats.Rejected)

	m.db.WithContext(ctx).Model(&Appeal{}).
		Where("created_at BETWEEN ? AND ? AND status IN ?", startDate, endDate, []AppealStatus{AppealStatusSubmitted, AppealStatusUnderReview, AppealStatusPending}).
		Count(&stats.Pending)

	// Upheld rate
	var upheld int64
	m.db.WithContext(ctx).Model(&Appeal{}).
		Where("created_at BETWEEN ? AND ? AND decision IN ?", startDate, endDate, []string{"UPHELD", "PARTIALLY_UPHELD"}).
		Count(&upheld)

	if stats.Resolved+stats.Rejected > 0 {
		stats.UpheldRate = float64(upheld) / float64(stats.Resolved+stats.Rejected) * 100
	}

	// Average resolution time
	var avgTime float64
	m.db.WithContext(ctx).Model(&Appeal{}).
		Where("created_at BETWEEN ? AND ? AND reviewed_at IS NOT NULL", startDate, endDate).
		Select("AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 86400)").
		Scan(&avgTime)
	stats.AvgResolutionDays = avgTime

	return &stats, nil
}

// AppealStats represents appeal statistics
type AppealStats struct {
	TotalAppeals      int64   `json:"total_appeals"`
	Resolved          int64   `json:"resolved"`
	Rejected          int64   `json:"rejected"`
	Pending           int64   `json:"pending"`
	UpheldRate        float64 `json:"upheld_rate"`
	AvgResolutionDays float64 `json:"avg_resolution_days"`
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

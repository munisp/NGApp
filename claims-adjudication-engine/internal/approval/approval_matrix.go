package approval

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ApprovalMatrixConfig holds configuration for the approval matrix
type ApprovalMatrixConfig struct {
	DefaultCurrency string
}

// ApprovalMatrix handles multi-level approval workflows
type ApprovalMatrix struct {
	db     *gorm.DB
	config ApprovalMatrixConfig
}

// NewApprovalMatrix creates a new approval matrix
func NewApprovalMatrix(db *gorm.DB, config ApprovalMatrixConfig) *ApprovalMatrix {
	if config.DefaultCurrency == "" {
		config.DefaultCurrency = "NGN"
	}
	return &ApprovalMatrix{
		db:     db,
		config: config,
	}
}

// ApprovalLevel represents an approval level in the matrix
type ApprovalLevel struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Name            string    `json:"name" gorm:"type:varchar(100);not null"`
	Level           int       `json:"level" gorm:"not null"`
	MinAmount       float64   `json:"min_amount" gorm:"type:decimal(20,2)"`
	MaxAmount       float64   `json:"max_amount" gorm:"type:decimal(20,2)"`
	RequiredRole    string    `json:"required_role" gorm:"type:varchar(50)"`
	RequiredApprovers int     `json:"required_approvers" gorm:"default:1"`
	SLAHours        int       `json:"sla_hours" gorm:"default:24"`
	CanEscalate     bool      `json:"can_escalate" gorm:"default:true"`
	EscalateToLevel int       `json:"escalate_to_level"`
	ProductTypes    string    `json:"product_types" gorm:"type:text"` // JSON array
	ClaimTypes      string    `json:"claim_types" gorm:"type:text"`   // JSON array
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// ApprovalRequest represents a request for approval
type ApprovalRequest struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID         uuid.UUID       `json:"claim_id" gorm:"type:uuid;not null;index"`
	CurrentLevel    int             `json:"current_level" gorm:"not null"`
	Status          ApprovalStatus  `json:"status" gorm:"type:varchar(20);not null"`
	RequestedBy     uuid.UUID       `json:"requested_by" gorm:"type:uuid"`
	RequestedAt     time.Time       `json:"requested_at" gorm:"autoCreateTime"`
	ClaimAmount     float64         `json:"claim_amount" gorm:"type:decimal(20,2)"`
	ProductType     string          `json:"product_type" gorm:"type:varchar(50)"`
	ClaimType       string          `json:"claim_type" gorm:"type:varchar(50)"`
	FraudScore      float64         `json:"fraud_score" gorm:"type:decimal(5,2)"`
	Urgency         string          `json:"urgency" gorm:"type:varchar(20)"`
	Notes           string          `json:"notes" gorm:"type:text"`
	Approvals       []Approval      `json:"approvals" gorm:"foreignKey:RequestID"`
	SLADeadline     time.Time       `json:"sla_deadline"`
	CompletedAt     *time.Time      `json:"completed_at"`
	FinalDecision   string          `json:"final_decision" gorm:"type:varchar(20)"`
	FinalDecisionBy *uuid.UUID      `json:"final_decision_by" gorm:"type:uuid"`
}

// ApprovalStatus represents the status of an approval request
type ApprovalStatus string

const (
	ApprovalStatusPending   ApprovalStatus = "PENDING"
	ApprovalStatusApproved  ApprovalStatus = "APPROVED"
	ApprovalStatusRejected  ApprovalStatus = "REJECTED"
	ApprovalStatusEscalated ApprovalStatus = "ESCALATED"
	ApprovalStatusExpired   ApprovalStatus = "EXPIRED"
	ApprovalStatusCancelled ApprovalStatus = "CANCELLED"
)

// Approval represents an individual approval decision
type Approval struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	RequestID   uuid.UUID      `json:"request_id" gorm:"type:uuid;not null;index"`
	Level       int            `json:"level" gorm:"not null"`
	ApproverID  uuid.UUID      `json:"approver_id" gorm:"type:uuid;not null"`
	ApproverName string        `json:"approver_name" gorm:"type:varchar(100)"`
	Decision    string         `json:"decision" gorm:"type:varchar(20);not null"`
	Comments    string         `json:"comments" gorm:"type:text"`
	DecidedAt   time.Time      `json:"decided_at" gorm:"autoCreateTime"`
	Conditions  string         `json:"conditions" gorm:"type:text"` // JSON for conditional approvals
}

// GetApprovalLevels returns all active approval levels
func (m *ApprovalMatrix) GetApprovalLevels(ctx context.Context) ([]ApprovalLevel, error) {
	var levels []ApprovalLevel
	err := m.db.WithContext(ctx).Where("is_active = ?", true).Order("level ASC").Find(&levels).Error
	return levels, err
}

// GetRequiredLevel determines the required approval level for a claim
func (m *ApprovalMatrix) GetRequiredLevel(ctx context.Context, claimAmount float64, productType, claimType string, fraudScore float64) (*ApprovalLevel, error) {
	var levels []ApprovalLevel
	if err := m.db.WithContext(ctx).Where("is_active = ?", true).Order("level ASC").Find(&levels).Error; err != nil {
		return nil, err
	}

	// If no levels configured, use default levels
	if len(levels) == 0 {
		levels = m.getDefaultLevels()
	}

	// Find the appropriate level based on amount and other factors
	for _, level := range levels {
		if claimAmount >= level.MinAmount && claimAmount <= level.MaxAmount {
			// Check if fraud score requires escalation
			if fraudScore > 0.7 && level.Level < 3 {
				// Escalate to higher level for high fraud scores
				for _, l := range levels {
					if l.Level >= 3 {
						return &l, nil
					}
				}
			}
			return &level, nil
		}
	}

	// Return highest level if amount exceeds all levels
	if len(levels) > 0 {
		return &levels[len(levels)-1], nil
	}

	return nil, fmt.Errorf("no approval level found for amount %.2f", claimAmount)
}

// getDefaultLevels returns default approval levels
func (m *ApprovalMatrix) getDefaultLevels() []ApprovalLevel {
	return []ApprovalLevel{
		{
			ID:              uuid.New(),
			Name:            "Auto-Approval",
			Level:           0,
			MinAmount:       0,
			MaxAmount:       50000,
			RequiredRole:    "system",
			RequiredApprovers: 0,
			SLAHours:        1,
			CanEscalate:     true,
			EscalateToLevel: 1,
		},
		{
			ID:              uuid.New(),
			Name:            "Claims Adjudicator",
			Level:           1,
			MinAmount:       50001,
			MaxAmount:       500000,
			RequiredRole:    "claims_adjudicator",
			RequiredApprovers: 1,
			SLAHours:        24,
			CanEscalate:     true,
			EscalateToLevel: 2,
		},
		{
			ID:              uuid.New(),
			Name:            "Senior Adjudicator",
			Level:           2,
			MinAmount:       500001,
			MaxAmount:       2000000,
			RequiredRole:    "senior_adjudicator",
			RequiredApprovers: 1,
			SLAHours:        48,
			CanEscalate:     true,
			EscalateToLevel: 3,
		},
		{
			ID:              uuid.New(),
			Name:            "Claims Manager",
			Level:           3,
			MinAmount:       2000001,
			MaxAmount:       10000000,
			RequiredRole:    "claims_manager",
			RequiredApprovers: 1,
			SLAHours:        72,
			CanEscalate:     true,
			EscalateToLevel: 4,
		},
		{
			ID:              uuid.New(),
			Name:            "Claims Director",
			Level:           4,
			MinAmount:       10000001,
			MaxAmount:       50000000,
			RequiredRole:    "claims_director",
			RequiredApprovers: 2,
			SLAHours:        120,
			CanEscalate:     true,
			EscalateToLevel: 5,
		},
		{
			ID:              uuid.New(),
			Name:            "Executive Committee",
			Level:           5,
			MinAmount:       50000001,
			MaxAmount:       1000000000,
			RequiredRole:    "executive",
			RequiredApprovers: 3,
			SLAHours:        168,
			CanEscalate:     false,
			EscalateToLevel: 5,
		},
	}
}

// CreateApprovalRequest creates a new approval request
func (m *ApprovalMatrix) CreateApprovalRequest(ctx context.Context, req *ApprovalRequest) error {
	// Determine required level
	level, err := m.GetRequiredLevel(ctx, req.ClaimAmount, req.ProductType, req.ClaimType, req.FraudScore)
	if err != nil {
		return err
	}

	req.ID = uuid.New()
	req.CurrentLevel = level.Level
	req.Status = ApprovalStatusPending
	req.RequestedAt = time.Now()
	req.SLADeadline = time.Now().Add(time.Duration(level.SLAHours) * time.Hour)

	return m.db.WithContext(ctx).Create(req).Error
}

// SubmitApproval submits an approval decision
func (m *ApprovalMatrix) SubmitApproval(ctx context.Context, requestID uuid.UUID, approverID uuid.UUID, approverName string, decision string, comments string) error {
	var request ApprovalRequest
	if err := m.db.WithContext(ctx).Preload("Approvals").First(&request, "id = ?", requestID).Error; err != nil {
		return err
	}

	if request.Status != ApprovalStatusPending {
		return fmt.Errorf("approval request is not pending")
	}

	// Get current level requirements
	level, err := m.getLevelByNumber(ctx, request.CurrentLevel)
	if err != nil {
		return err
	}

	// Create approval record
	approval := Approval{
		ID:          uuid.New(),
		RequestID:   requestID,
		Level:       request.CurrentLevel,
		ApproverID:  approverID,
		ApproverName: approverName,
		Decision:    decision,
		Comments:    comments,
		DecidedAt:   time.Now(),
	}

	if err := m.db.WithContext(ctx).Create(&approval).Error; err != nil {
		return err
	}

	// Check if we have enough approvals at this level
	approvalCount := 0
	rejectionCount := 0
	for _, a := range request.Approvals {
		if a.Level == request.CurrentLevel {
			if a.Decision == "APPROVE" {
				approvalCount++
			} else if a.Decision == "REJECT" {
				rejectionCount++
			}
		}
	}

	// Include current approval
	if decision == "APPROVE" {
		approvalCount++
	} else if decision == "REJECT" {
		rejectionCount++
	}

	// Determine next action
	if rejectionCount > 0 {
		// Any rejection at any level rejects the request
		request.Status = ApprovalStatusRejected
		request.FinalDecision = "REJECTED"
		request.FinalDecisionBy = &approverID
		now := time.Now()
		request.CompletedAt = &now
	} else if approvalCount >= level.RequiredApprovers {
		// Check if this is the final level
		if request.CurrentLevel >= 5 || !level.CanEscalate {
			request.Status = ApprovalStatusApproved
			request.FinalDecision = "APPROVED"
			request.FinalDecisionBy = &approverID
			now := time.Now()
			request.CompletedAt = &now
		} else {
			// Move to next level if amount requires it
			nextLevel, _ := m.getLevelByNumber(ctx, request.CurrentLevel+1)
			if nextLevel != nil && request.ClaimAmount > level.MaxAmount {
				request.CurrentLevel = nextLevel.Level
				request.SLADeadline = time.Now().Add(time.Duration(nextLevel.SLAHours) * time.Hour)
			} else {
				// Approved at current level
				request.Status = ApprovalStatusApproved
				request.FinalDecision = "APPROVED"
				request.FinalDecisionBy = &approverID
				now := time.Now()
				request.CompletedAt = &now
			}
		}
	}

	return m.db.WithContext(ctx).Save(&request).Error
}

// EscalateRequest escalates an approval request to the next level
func (m *ApprovalMatrix) EscalateRequest(ctx context.Context, requestID uuid.UUID, reason string) error {
	var request ApprovalRequest
	if err := m.db.WithContext(ctx).First(&request, "id = ?", requestID).Error; err != nil {
		return err
	}

	currentLevel, err := m.getLevelByNumber(ctx, request.CurrentLevel)
	if err != nil {
		return err
	}

	if !currentLevel.CanEscalate {
		return fmt.Errorf("cannot escalate from level %d", request.CurrentLevel)
	}

	nextLevel, err := m.getLevelByNumber(ctx, currentLevel.EscalateToLevel)
	if err != nil {
		return err
	}

	request.CurrentLevel = nextLevel.Level
	request.Status = ApprovalStatusEscalated
	request.SLADeadline = time.Now().Add(time.Duration(nextLevel.SLAHours) * time.Hour)
	request.Notes = fmt.Sprintf("%s\nEscalated: %s", request.Notes, reason)

	return m.db.WithContext(ctx).Save(&request).Error
}

// getLevelByNumber gets an approval level by its number
func (m *ApprovalMatrix) getLevelByNumber(ctx context.Context, levelNum int) (*ApprovalLevel, error) {
	var level ApprovalLevel
	err := m.db.WithContext(ctx).Where("level = ? AND is_active = ?", levelNum, true).First(&level).Error
	if err != nil {
		// Return default level
		defaults := m.getDefaultLevels()
		for _, l := range defaults {
			if l.Level == levelNum {
				return &l, nil
			}
		}
		return nil, fmt.Errorf("level %d not found", levelNum)
	}
	return &level, nil
}

// GetPendingApprovals gets pending approvals for a user based on their role
func (m *ApprovalMatrix) GetPendingApprovals(ctx context.Context, userRole string) ([]ApprovalRequest, error) {
	// Get levels that match the user's role
	var levels []ApprovalLevel
	if err := m.db.WithContext(ctx).Where("required_role = ? AND is_active = ?", userRole, true).Find(&levels).Error; err != nil {
		return nil, err
	}

	levelNums := make([]int, len(levels))
	for i, l := range levels {
		levelNums[i] = l.Level
	}

	var requests []ApprovalRequest
	err := m.db.WithContext(ctx).
		Where("status = ? AND current_level IN ?", ApprovalStatusPending, levelNums).
		Preload("Approvals").
		Order("sla_deadline ASC").
		Find(&requests).Error

	return requests, err
}

// GetApprovalHistory gets approval history for a claim
func (m *ApprovalMatrix) GetApprovalHistory(ctx context.Context, claimID uuid.UUID) ([]ApprovalRequest, error) {
	var requests []ApprovalRequest
	err := m.db.WithContext(ctx).
		Where("claim_id = ?", claimID).
		Preload("Approvals").
		Order("requested_at DESC").
		Find(&requests).Error
	return requests, err
}

// CheckSLABreaches checks for SLA breaches and returns expired requests
func (m *ApprovalMatrix) CheckSLABreaches(ctx context.Context) ([]ApprovalRequest, error) {
	var requests []ApprovalRequest
	err := m.db.WithContext(ctx).
		Where("status = ? AND sla_deadline < ?", ApprovalStatusPending, time.Now()).
		Find(&requests).Error
	return requests, err
}

// GetApprovalStats gets approval statistics
func (m *ApprovalMatrix) GetApprovalStats(ctx context.Context, startDate, endDate time.Time) (*ApprovalStats, error) {
	var stats ApprovalStats

	// Total requests
	m.db.WithContext(ctx).Model(&ApprovalRequest{}).
		Where("requested_at BETWEEN ? AND ?", startDate, endDate).
		Count(&stats.TotalRequests)

	// Approved
	m.db.WithContext(ctx).Model(&ApprovalRequest{}).
		Where("requested_at BETWEEN ? AND ? AND status = ?", startDate, endDate, ApprovalStatusApproved).
		Count(&stats.ApprovedRequests)

	// Rejected
	m.db.WithContext(ctx).Model(&ApprovalRequest{}).
		Where("requested_at BETWEEN ? AND ? AND status = ?", startDate, endDate, ApprovalStatusRejected).
		Count(&stats.RejectedRequests)

	// Pending
	m.db.WithContext(ctx).Model(&ApprovalRequest{}).
		Where("requested_at BETWEEN ? AND ? AND status = ?", startDate, endDate, ApprovalStatusPending).
		Count(&stats.PendingRequests)

	// SLA breaches
	m.db.WithContext(ctx).Model(&ApprovalRequest{}).
		Where("requested_at BETWEEN ? AND ? AND sla_deadline < ? AND status = ?", startDate, endDate, time.Now(), ApprovalStatusPending).
		Count(&stats.SLABreaches)

	// Calculate rates
	if stats.TotalRequests > 0 {
		stats.ApprovalRate = float64(stats.ApprovedRequests) / float64(stats.TotalRequests) * 100
		stats.RejectionRate = float64(stats.RejectedRequests) / float64(stats.TotalRequests) * 100
	}

	return &stats, nil
}

// ApprovalStats represents approval statistics
type ApprovalStats struct {
	TotalRequests    int64   `json:"total_requests"`
	ApprovedRequests int64   `json:"approved_requests"`
	RejectedRequests int64   `json:"rejected_requests"`
	PendingRequests  int64   `json:"pending_requests"`
	SLABreaches      int64   `json:"sla_breaches"`
	ApprovalRate     float64 `json:"approval_rate"`
	RejectionRate    float64 `json:"rejection_rate"`
}

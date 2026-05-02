// Package disputes provides refunds and disputes workflow functionality
// Recommendation #17: Refunds & Disputes Workflow
package disputes

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DisputeStatus represents the status of a dispute
type DisputeStatus string

const (
	DisputeStatusOpen           DisputeStatus = "open"
	DisputeStatusUnderReview    DisputeStatus = "under_review"
	DisputeStatusPendingInfo    DisputeStatus = "pending_info"
	DisputeStatusResolved       DisputeStatus = "resolved"
	DisputeStatusRejected       DisputeStatus = "rejected"
	DisputeStatusEscalated      DisputeStatus = "escalated"
	DisputeStatusClosed         DisputeStatus = "closed"
)

// DisputeReason represents the reason for a dispute
type DisputeReason string

const (
	ReasonUnauthorized       DisputeReason = "unauthorized"
	ReasonNotReceived        DisputeReason = "not_received"
	ReasonIncorrectAmount    DisputeReason = "incorrect_amount"
	ReasonDuplicateCharge    DisputeReason = "duplicate"
	ReasonProductNotAsDesc   DisputeReason = "product_not_as_described"
	ReasonServiceNotProvided DisputeReason = "service_not_provided"
	ReasonFraud              DisputeReason = "fraud"
	ReasonOther              DisputeReason = "other"
)

// DisputeResolution represents how a dispute was resolved
type DisputeResolution string

const (
	ResolutionRefundFull    DisputeResolution = "refund_full"
	ResolutionRefundPartial DisputeResolution = "refund_partial"
	ResolutionNoRefund      DisputeResolution = "no_refund"
	ResolutionChargeback    DisputeResolution = "chargeback"
	ResolutionMerchantWon   DisputeResolution = "merchant_won"
	ResolutionCustomerWon   DisputeResolution = "customer_won"
)

// Dispute represents a payment dispute
type Dispute struct {
	ID              string            `json:"id"`
	TransactionID   string            `json:"transaction_id"`
	ParticipantID   string            `json:"participant_id"`
	CustomerID      string            `json:"customer_id"`
	Amount          int64             `json:"amount"`
	Currency        string            `json:"currency"`
	Reason          DisputeReason     `json:"reason"`
	Description     string            `json:"description"`
	Status          DisputeStatus     `json:"status"`
	Resolution      DisputeResolution `json:"resolution,omitempty"`
	ResolutionNotes string            `json:"resolution_notes,omitempty"`
	RefundID        string            `json:"refund_id,omitempty"`
	Evidence        []Evidence        `json:"evidence,omitempty"`
	Timeline        []TimelineEvent   `json:"timeline,omitempty"`
	AssignedTo      string            `json:"assigned_to,omitempty"`
	DueDate         *time.Time        `json:"due_date,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	ResolvedAt      *time.Time        `json:"resolved_at,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// Evidence represents evidence submitted for a dispute
type Evidence struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // document, image, text, receipt
	Description string    `json:"description"`
	URL         string    `json:"url,omitempty"`
	Content     string    `json:"content,omitempty"`
	SubmittedBy string    `json:"submitted_by"`
	SubmittedAt time.Time `json:"submitted_at"`
}

// TimelineEvent represents an event in the dispute timeline
type TimelineEvent struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	Actor       string    `json:"actor"`
	Timestamp   time.Time `json:"timestamp"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// RefundStatus represents the status of a refund
type RefundStatus string

const (
	RefundStatusPending   RefundStatus = "pending"
	RefundStatusApproved  RefundStatus = "approved"
	RefundStatusProcessing RefundStatus = "processing"
	RefundStatusCompleted RefundStatus = "completed"
	RefundStatusFailed    RefundStatus = "failed"
	RefundStatusCancelled RefundStatus = "cancelled"
)

// RefundType represents the type of refund
type RefundType string

const (
	RefundTypeFull    RefundType = "full"
	RefundTypePartial RefundType = "partial"
)

// Refund represents a payment refund
type Refund struct {
	ID              string       `json:"id"`
	TransactionID   string       `json:"transaction_id"`
	DisputeID       string       `json:"dispute_id,omitempty"`
	ParticipantID   string       `json:"participant_id"`
	CustomerID      string       `json:"customer_id"`
	OriginalAmount  int64        `json:"original_amount"`
	RefundAmount    int64        `json:"refund_amount"`
	Currency        string       `json:"currency"`
	Type            RefundType   `json:"type"`
	Status          RefundStatus `json:"status"`
	Reason          string       `json:"reason"`
	Notes           string       `json:"notes,omitempty"`
	RequestedBy     string       `json:"requested_by"`
	ApprovedBy      string       `json:"approved_by,omitempty"`
	ProcessedAt     *time.Time   `json:"processed_at,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// DisputeStore defines the interface for dispute storage
type DisputeStore interface {
	CreateDispute(ctx context.Context, dispute *Dispute) error
	GetDispute(ctx context.Context, id string) (*Dispute, error)
	UpdateDispute(ctx context.Context, dispute *Dispute) error
	ListDisputes(ctx context.Context, filter *DisputeFilter) ([]*Dispute, int64, error)
	AddEvidence(ctx context.Context, disputeID string, evidence *Evidence) error
	AddTimelineEvent(ctx context.Context, disputeID string, event *TimelineEvent) error
}

// RefundStore defines the interface for refund storage
type RefundStore interface {
	CreateRefund(ctx context.Context, refund *Refund) error
	GetRefund(ctx context.Context, id string) (*Refund, error)
	UpdateRefund(ctx context.Context, refund *Refund) error
	ListRefunds(ctx context.Context, filter *RefundFilter) ([]*Refund, int64, error)
	GetRefundsByTransaction(ctx context.Context, transactionID string) ([]*Refund, error)
}

// DisputeFilter defines filters for listing disputes
type DisputeFilter struct {
	Status        []DisputeStatus
	Reason        []DisputeReason
	ParticipantID string
	CustomerID    string
	AssignedTo    string
	DateFrom      *time.Time
	DateTo        *time.Time
	Page          int
	PageSize      int
}

// RefundFilter defines filters for listing refunds
type RefundFilter struct {
	Status        []RefundStatus
	Type          []RefundType
	ParticipantID string
	CustomerID    string
	DateFrom      *time.Time
	DateTo        *time.Time
	Page          int
	PageSize      int
}

// DisputeService handles dispute operations
type DisputeService struct {
	disputeStore DisputeStore
	refundStore  RefundStore
}

// NewDisputeService creates a new dispute service
func NewDisputeService(disputeStore DisputeStore, refundStore RefundStore) *DisputeService {
	return &DisputeService{
		disputeStore: disputeStore,
		refundStore:  refundStore,
	}
}

// CreateDisputeRequest represents a request to create a dispute
type CreateDisputeRequest struct {
	TransactionID string            `json:"transaction_id"`
	ParticipantID string            `json:"participant_id"`
	CustomerID    string            `json:"customer_id"`
	Amount        int64             `json:"amount"`
	Currency      string            `json:"currency"`
	Reason        DisputeReason     `json:"reason"`
	Description   string            `json:"description"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// CreateDispute creates a new dispute
func (s *DisputeService) CreateDispute(ctx context.Context, req *CreateDisputeRequest) (*Dispute, error) {
	if req.TransactionID == "" {
		return nil, errors.New("transaction_id is required")
	}
	if req.Reason == "" {
		return nil, errors.New("reason is required")
	}

	now := time.Now()
	dueDate := now.AddDate(0, 0, 30) // 30 days to resolve

	dispute := &Dispute{
		ID:            uuid.New().String(),
		TransactionID: req.TransactionID,
		ParticipantID: req.ParticipantID,
		CustomerID:    req.CustomerID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Reason:        req.Reason,
		Description:   req.Description,
		Status:        DisputeStatusOpen,
		DueDate:       &dueDate,
		CreatedAt:     now,
		UpdatedAt:     now,
		Metadata:      req.Metadata,
		Timeline: []TimelineEvent{
			{
				ID:          uuid.New().String(),
				Type:        "created",
				Description: "Dispute created",
				Actor:       req.CustomerID,
				Timestamp:   now,
			},
		},
	}

	if err := s.disputeStore.CreateDispute(ctx, dispute); err != nil {
		return nil, fmt.Errorf("failed to create dispute: %w", err)
	}

	return dispute, nil
}

// GetDispute retrieves a dispute by ID
func (s *DisputeService) GetDispute(ctx context.Context, id string) (*Dispute, error) {
	return s.disputeStore.GetDispute(ctx, id)
}

// UpdateDisputeStatus updates the status of a dispute
func (s *DisputeService) UpdateDisputeStatus(ctx context.Context, id string, status DisputeStatus, actor string, notes string) (*Dispute, error) {
	dispute, err := s.disputeStore.GetDispute(ctx, id)
	if err != nil {
		return nil, err
	}

	// Validate status transition
	if !isValidStatusTransition(dispute.Status, status) {
		return nil, fmt.Errorf("invalid status transition from %s to %s", dispute.Status, status)
	}

	dispute.Status = status
	dispute.UpdatedAt = time.Now()

	// Add timeline event
	event := &TimelineEvent{
		ID:          uuid.New().String(),
		Type:        "status_change",
		Description: fmt.Sprintf("Status changed to %s", status),
		Actor:       actor,
		Timestamp:   time.Now(),
		Details: map[string]interface{}{
			"previous_status": dispute.Status,
			"new_status":      status,
			"notes":           notes,
		},
	}

	if err := s.disputeStore.AddTimelineEvent(ctx, id, event); err != nil {
		return nil, fmt.Errorf("failed to add timeline event: %w", err)
	}

	if err := s.disputeStore.UpdateDispute(ctx, dispute); err != nil {
		return nil, fmt.Errorf("failed to update dispute: %w", err)
	}

	return dispute, nil
}

// ResolveDispute resolves a dispute
func (s *DisputeService) ResolveDispute(ctx context.Context, id string, resolution DisputeResolution, notes string, actor string) (*Dispute, error) {
	dispute, err := s.disputeStore.GetDispute(ctx, id)
	if err != nil {
		return nil, err
	}

	if dispute.Status == DisputeStatusResolved || dispute.Status == DisputeStatusClosed {
		return nil, errors.New("dispute is already resolved or closed")
	}

	now := time.Now()
	dispute.Status = DisputeStatusResolved
	dispute.Resolution = resolution
	dispute.ResolutionNotes = notes
	dispute.ResolvedAt = &now
	dispute.UpdatedAt = now

	// Add timeline event
	event := &TimelineEvent{
		ID:          uuid.New().String(),
		Type:        "resolved",
		Description: fmt.Sprintf("Dispute resolved: %s", resolution),
		Actor:       actor,
		Timestamp:   now,
		Details: map[string]interface{}{
			"resolution": resolution,
			"notes":      notes,
		},
	}

	if err := s.disputeStore.AddTimelineEvent(ctx, id, event); err != nil {
		return nil, fmt.Errorf("failed to add timeline event: %w", err)
	}

	if err := s.disputeStore.UpdateDispute(ctx, dispute); err != nil {
		return nil, fmt.Errorf("failed to update dispute: %w", err)
	}

	return dispute, nil
}

// AddEvidence adds evidence to a dispute
func (s *DisputeService) AddEvidence(ctx context.Context, disputeID string, evidence *Evidence) error {
	dispute, err := s.disputeStore.GetDispute(ctx, disputeID)
	if err != nil {
		return err
	}

	if dispute.Status == DisputeStatusResolved || dispute.Status == DisputeStatusClosed {
		return errors.New("cannot add evidence to resolved or closed dispute")
	}

	evidence.ID = uuid.New().String()
	evidence.SubmittedAt = time.Now()

	if err := s.disputeStore.AddEvidence(ctx, disputeID, evidence); err != nil {
		return fmt.Errorf("failed to add evidence: %w", err)
	}

	// Add timeline event
	event := &TimelineEvent{
		ID:          uuid.New().String(),
		Type:        "evidence_added",
		Description: fmt.Sprintf("Evidence added: %s", evidence.Type),
		Actor:       evidence.SubmittedBy,
		Timestamp:   time.Now(),
		Details: map[string]interface{}{
			"evidence_id":   evidence.ID,
			"evidence_type": evidence.Type,
		},
	}

	return s.disputeStore.AddTimelineEvent(ctx, disputeID, event)
}

// ListDisputes lists disputes with filters
func (s *DisputeService) ListDisputes(ctx context.Context, filter *DisputeFilter) ([]*Dispute, int64, error) {
	return s.disputeStore.ListDisputes(ctx, filter)
}

// CreateRefundRequest represents a request to create a refund
type CreateRefundRequest struct {
	TransactionID  string            `json:"transaction_id"`
	DisputeID      string            `json:"dispute_id,omitempty"`
	ParticipantID  string            `json:"participant_id"`
	CustomerID     string            `json:"customer_id"`
	OriginalAmount int64             `json:"original_amount"`
	RefundAmount   int64             `json:"refund_amount"`
	Currency       string            `json:"currency"`
	Reason         string            `json:"reason"`
	Notes          string            `json:"notes,omitempty"`
	RequestedBy    string            `json:"requested_by"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// CreateRefund creates a new refund request
func (s *DisputeService) CreateRefund(ctx context.Context, req *CreateRefundRequest) (*Refund, error) {
	if req.TransactionID == "" {
		return nil, errors.New("transaction_id is required")
	}
	if req.RefundAmount <= 0 {
		return nil, errors.New("refund_amount must be positive")
	}
	if req.RefundAmount > req.OriginalAmount {
		return nil, errors.New("refund_amount cannot exceed original_amount")
	}

	// Check for existing refunds
	existingRefunds, err := s.refundStore.GetRefundsByTransaction(ctx, req.TransactionID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing refunds: %w", err)
	}

	var totalRefunded int64
	for _, r := range existingRefunds {
		if r.Status == RefundStatusCompleted || r.Status == RefundStatusProcessing || r.Status == RefundStatusApproved {
			totalRefunded += r.RefundAmount
		}
	}

	if totalRefunded+req.RefundAmount > req.OriginalAmount {
		return nil, fmt.Errorf("total refund amount would exceed original amount (already refunded: %d)", totalRefunded)
	}

	refundType := RefundTypeFull
	if req.RefundAmount < req.OriginalAmount {
		refundType = RefundTypePartial
	}

	now := time.Now()
	refund := &Refund{
		ID:             uuid.New().String(),
		TransactionID:  req.TransactionID,
		DisputeID:      req.DisputeID,
		ParticipantID:  req.ParticipantID,
		CustomerID:     req.CustomerID,
		OriginalAmount: req.OriginalAmount,
		RefundAmount:   req.RefundAmount,
		Currency:       req.Currency,
		Type:           refundType,
		Status:         RefundStatusPending,
		Reason:         req.Reason,
		Notes:          req.Notes,
		RequestedBy:    req.RequestedBy,
		CreatedAt:      now,
		UpdatedAt:      now,
		Metadata:       req.Metadata,
	}

	if err := s.refundStore.CreateRefund(ctx, refund); err != nil {
		return nil, fmt.Errorf("failed to create refund: %w", err)
	}

	return refund, nil
}

// ApproveRefund approves a refund request
func (s *DisputeService) ApproveRefund(ctx context.Context, id string, approvedBy string) (*Refund, error) {
	refund, err := s.refundStore.GetRefund(ctx, id)
	if err != nil {
		return nil, err
	}

	if refund.Status != RefundStatusPending {
		return nil, fmt.Errorf("refund is not pending (current status: %s)", refund.Status)
	}

	refund.Status = RefundStatusApproved
	refund.ApprovedBy = approvedBy
	refund.UpdatedAt = time.Now()

	if err := s.refundStore.UpdateRefund(ctx, refund); err != nil {
		return nil, fmt.Errorf("failed to update refund: %w", err)
	}

	return refund, nil
}

// ProcessRefund processes an approved refund
func (s *DisputeService) ProcessRefund(ctx context.Context, id string) (*Refund, error) {
	refund, err := s.refundStore.GetRefund(ctx, id)
	if err != nil {
		return nil, err
	}

	if refund.Status != RefundStatusApproved {
		return nil, fmt.Errorf("refund is not approved (current status: %s)", refund.Status)
	}

	refund.Status = RefundStatusProcessing
	refund.UpdatedAt = time.Now()

	if err := s.refundStore.UpdateRefund(ctx, refund); err != nil {
		return nil, fmt.Errorf("failed to update refund: %w", err)
	}

	return refund, nil
}

// CompleteRefund marks a refund as completed
func (s *DisputeService) CompleteRefund(ctx context.Context, id string) (*Refund, error) {
	refund, err := s.refundStore.GetRefund(ctx, id)
	if err != nil {
		return nil, err
	}

	if refund.Status != RefundStatusProcessing {
		return nil, fmt.Errorf("refund is not processing (current status: %s)", refund.Status)
	}

	now := time.Now()
	refund.Status = RefundStatusCompleted
	refund.ProcessedAt = &now
	refund.UpdatedAt = now

	if err := s.refundStore.UpdateRefund(ctx, refund); err != nil {
		return nil, fmt.Errorf("failed to update refund: %w", err)
	}

	// If this refund is associated with a dispute, update the dispute
	if refund.DisputeID != "" {
		dispute, err := s.disputeStore.GetDispute(ctx, refund.DisputeID)
		if err == nil {
			dispute.RefundID = refund.ID
			s.disputeStore.UpdateDispute(ctx, dispute)
		}
	}

	return refund, nil
}

// GetRefund retrieves a refund by ID
func (s *DisputeService) GetRefund(ctx context.Context, id string) (*Refund, error) {
	return s.refundStore.GetRefund(ctx, id)
}

// ListRefunds lists refunds with filters
func (s *DisputeService) ListRefunds(ctx context.Context, filter *RefundFilter) ([]*Refund, int64, error) {
	return s.refundStore.ListRefunds(ctx, filter)
}

// Helper functions

func isValidStatusTransition(from, to DisputeStatus) bool {
	validTransitions := map[DisputeStatus][]DisputeStatus{
		DisputeStatusOpen:        {DisputeStatusUnderReview, DisputeStatusPendingInfo, DisputeStatusResolved, DisputeStatusRejected, DisputeStatusClosed},
		DisputeStatusUnderReview: {DisputeStatusPendingInfo, DisputeStatusResolved, DisputeStatusRejected, DisputeStatusEscalated, DisputeStatusClosed},
		DisputeStatusPendingInfo: {DisputeStatusUnderReview, DisputeStatusResolved, DisputeStatusRejected, DisputeStatusClosed},
		DisputeStatusEscalated:   {DisputeStatusResolved, DisputeStatusRejected, DisputeStatusClosed},
		DisputeStatusResolved:    {DisputeStatusClosed},
		DisputeStatusRejected:    {DisputeStatusClosed},
	}

	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}

	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

// DisputeMetrics holds metrics about disputes
type DisputeMetrics struct {
	TotalDisputes     int64   `json:"total_disputes"`
	OpenDisputes      int64   `json:"open_disputes"`
	ResolvedDisputes  int64   `json:"resolved_disputes"`
	AverageResolution float64 `json:"average_resolution_days"`
	RefundRate        float64 `json:"refund_rate"`
	TotalRefunded     int64   `json:"total_refunded"`
}

// GetDisputeMetrics calculates dispute metrics
func (s *DisputeService) GetDisputeMetrics(ctx context.Context, participantID string, dateFrom, dateTo time.Time) (*DisputeMetrics, error) {
	// This would query the database for metrics
	// For now, return placeholder
	return &DisputeMetrics{}, nil
}

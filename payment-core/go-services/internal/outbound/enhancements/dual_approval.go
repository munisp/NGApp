package enhancements

import (
	"fmt"
	"sync"
	"time"
)

// ApprovalStatus represents the state of an approval request
type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
	ApprovalExpired  ApprovalStatus = "expired"
)

// ApprovalType categorizes what requires approval
type ApprovalType string

const (
	ApprovalTransferHighValue ApprovalType = "high_value_transfer"
	ApprovalTierUpgrade       ApprovalType = "tier_upgrade"
	ApprovalCorridorChange    ApprovalType = "corridor_change"
	ApprovalRailConfig        ApprovalType = "rail_config_change"
	ApprovalParticipantOnboard ApprovalType = "participant_onboard"
	ApprovalRateOverride      ApprovalType = "rate_override"
	ApprovalComplianceEscalation ApprovalType = "compliance_escalation"
)

// ApprovalDecision represents a single approver's decision
type ApprovalDecision struct {
	ApproverID   string         `json:"approverId"`
	ApproverRole string         `json:"approverRole"`
	Decision     ApprovalStatus `json:"decision"`
	Comment      string         `json:"comment"`
	DecidedAt    time.Time      `json:"decidedAt"`
}

// ApprovalRequest represents a pending approval workflow
type ApprovalRequest struct {
	RequestID       string             `json:"requestId"`
	Type            ApprovalType       `json:"type"`
	RequestedBy     string             `json:"requestedBy"`
	RequestedAt     time.Time          `json:"requestedAt"`
	ExpiresAt       time.Time          `json:"expiresAt"`
	Status          ApprovalStatus     `json:"status"`
	RequiredApprovals int              `json:"requiredApprovals"`
	CurrentApprovals  int              `json:"currentApprovals"`
	Subject         string             `json:"subject"`
	Details         map[string]string  `json:"details"`
	Decisions       []ApprovalDecision `json:"decisions"`
	AmountNGN       float64            `json:"amountNGN,omitempty"`
	ParticipantID   string             `json:"participantId,omitempty"`
	CorridorID      string             `json:"corridorId,omitempty"`
}

// ApprovalThreshold defines when dual-approval is required
type ApprovalThreshold struct {
	Type              ApprovalType `json:"type"`
	MinAmountNGN      float64      `json:"minAmountNGN"`
	RequiredApprovals int          `json:"requiredApprovals"`
	AllowedRoles      []string     `json:"allowedRoles"`
	ExpiryHours       int          `json:"expiryHours"`
}

// DualApprovalEngine manages approval workflows
type DualApprovalEngine struct {
	mu         sync.RWMutex
	requests   map[string]*ApprovalRequest
	thresholds []ApprovalThreshold
}

// NewDualApprovalEngine creates an engine with default thresholds
func NewDualApprovalEngine() *DualApprovalEngine {
	return &DualApprovalEngine{
		requests: make(map[string]*ApprovalRequest),
		thresholds: []ApprovalThreshold{
			{Type: ApprovalTransferHighValue, MinAmountNGN: 100_000_000, RequiredApprovals: 2, AllowedRoles: []string{"admin", "cbn"}, ExpiryHours: 4},
			{Type: ApprovalTierUpgrade, MinAmountNGN: 0, RequiredApprovals: 2, AllowedRoles: []string{"admin"}, ExpiryHours: 48},
			{Type: ApprovalCorridorChange, MinAmountNGN: 0, RequiredApprovals: 1, AllowedRoles: []string{"admin"}, ExpiryHours: 24},
			{Type: ApprovalRailConfig, MinAmountNGN: 0, RequiredApprovals: 2, AllowedRoles: []string{"admin"}, ExpiryHours: 24},
			{Type: ApprovalParticipantOnboard, MinAmountNGN: 0, RequiredApprovals: 2, AllowedRoles: []string{"admin", "cbn"}, ExpiryHours: 72},
			{Type: ApprovalRateOverride, MinAmountNGN: 0, RequiredApprovals: 1, AllowedRoles: []string{"admin"}, ExpiryHours: 1},
			{Type: ApprovalComplianceEscalation, MinAmountNGN: 0, RequiredApprovals: 2, AllowedRoles: []string{"admin", "cbn"}, ExpiryHours: 12},
		},
	}
}

// RequiresApproval checks if an action needs dual-approval
func (e *DualApprovalEngine) RequiresApproval(approvalType ApprovalType, amountNGN float64) (bool, int) {
	for _, t := range e.thresholds {
		if t.Type == approvalType && amountNGN >= t.MinAmountNGN {
			return true, t.RequiredApprovals
		}
	}
	return false, 0
}

// CreateRequest initiates a new approval request
func (e *DualApprovalEngine) CreateRequest(approvalType ApprovalType, requestedBy string, subject string, details map[string]string, amountNGN float64) (*ApprovalRequest, error) {
	var threshold *ApprovalThreshold
	for _, t := range e.thresholds {
		if t.Type == approvalType {
			threshold = &t
			break
		}
	}
	if threshold == nil {
		return nil, fmt.Errorf("unknown approval type: %s", approvalType)
	}

	req := &ApprovalRequest{
		RequestID:         fmt.Sprintf("APR-%d", time.Now().UnixMilli()),
		Type:              approvalType,
		RequestedBy:       requestedBy,
		RequestedAt:       time.Now(),
		ExpiresAt:         time.Now().Add(time.Duration(threshold.ExpiryHours) * time.Hour),
		Status:            ApprovalPending,
		RequiredApprovals: threshold.RequiredApprovals,
		Subject:           subject,
		Details:           details,
		AmountNGN:         amountNGN,
	}

	e.mu.Lock()
	e.requests[req.RequestID] = req
	e.mu.Unlock()

	return req, nil
}

// SubmitDecision records an approver's decision
func (e *DualApprovalEngine) SubmitDecision(requestID, approverID, approverRole string, approved bool, comment string) (*ApprovalRequest, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	req, ok := e.requests[requestID]
	if !ok {
		return nil, fmt.Errorf("approval request %s not found", requestID)
	}
	if req.Status != ApprovalPending {
		return nil, fmt.Errorf("request %s is already %s", requestID, req.Status)
	}
	if time.Now().After(req.ExpiresAt) {
		req.Status = ApprovalExpired
		return nil, fmt.Errorf("request %s has expired", requestID)
	}
	// Cannot approve own request
	if approverID == req.RequestedBy {
		return nil, fmt.Errorf("cannot approve own request")
	}
	// Cannot approve twice
	for _, d := range req.Decisions {
		if d.ApproverID == approverID {
			return nil, fmt.Errorf("approver %s has already decided", approverID)
		}
	}

	decision := ApprovalDecision{
		ApproverID:   approverID,
		ApproverRole: approverRole,
		DecidedAt:    time.Now(),
		Comment:      comment,
	}

	if approved {
		decision.Decision = ApprovalApproved
		req.CurrentApprovals++
	} else {
		decision.Decision = ApprovalRejected
		req.Status = ApprovalRejected
	}
	req.Decisions = append(req.Decisions, decision)

	if req.CurrentApprovals >= req.RequiredApprovals {
		req.Status = ApprovalApproved
	}

	return req, nil
}

// GetPendingRequests returns all pending approvals, optionally filtered by type
func (e *DualApprovalEngine) GetPendingRequests(filterType ApprovalType) []*ApprovalRequest {
	e.mu.RLock()
	defer e.mu.RUnlock()
	var result []*ApprovalRequest
	for _, r := range e.requests {
		if r.Status == ApprovalPending {
			if filterType == "" || r.Type == filterType {
				result = append(result, r)
			}
		}
	}
	return result
}

// GetAllRequests returns all approval requests
func (e *DualApprovalEngine) GetAllRequests() []*ApprovalRequest {
	e.mu.RLock()
	defer e.mu.RUnlock()
	var result []*ApprovalRequest
	for _, r := range e.requests {
		result = append(result, r)
	}
	return result
}

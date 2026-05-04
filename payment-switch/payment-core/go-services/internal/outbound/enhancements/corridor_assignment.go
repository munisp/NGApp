package enhancements

import (
	"fmt"
	"sync"
	"time"
)

// CorridorRiskLevel categorizes corridor risk
type CorridorRiskLevel string

const (
	RiskLow    CorridorRiskLevel = "low"
	RiskMedium CorridorRiskLevel = "medium"
	RiskHigh   CorridorRiskLevel = "high"
)

// CorridorDefinition represents a sendable corridor with metadata
type CorridorDefinition struct {
	Code            string            `json:"code"`            // e.g. "NG-GH"
	Name            string            `json:"name"`
	DestCountry     string            `json:"destCountry"`
	DestCurrency    string            `json:"destCurrency"`
	Category        string            `json:"category"`        // west_africa_labor, education, premium_business, etc.
	RiskLevel       CorridorRiskLevel `json:"riskLevel"`
	MinTier         TierLevel         `json:"minTier"`         // minimum tier required
	RequiresLicense bool              `json:"requiresLicense"` // whether participant needs destination country license
	CBNSpreadCapBps int               `json:"cbnSpreadCapBps"`
	Active          bool              `json:"active"`
}

// ParticipantCorridorAssignment tracks which corridors a participant can use
type ParticipantCorridorAssignment struct {
	ParticipantID   int       `json:"participantId"`
	CorridorCode    string    `json:"corridorCode"`
	Status          string    `json:"status"` // active, suspended, pending_review, revoked
	GrantedAt       time.Time `json:"grantedAt"`
	GrantedBy       string    `json:"grantedBy"`
	SuspendedAt     *time.Time `json:"suspendedAt,omitempty"`
	SuspendReason   string    `json:"suspendReason,omitempty"`
	LicenseVerified bool      `json:"licenseVerified"`
	DailyLimitNGN   float64   `json:"dailyLimitNgn"`
	MonthlyLimitNGN float64   `json:"monthlyLimitNgn"`
}

// CorridorAssignmentRequest represents a request to access a new corridor
type CorridorAssignmentRequest struct {
	ID              string    `json:"id"`
	ParticipantID   int       `json:"participantId"`
	CorridorCode    string    `json:"corridorCode"`
	Justification   string    `json:"justification"`
	LicenseDocRef   string    `json:"licenseDocRef,omitempty"`
	Status          string    `json:"status"` // pending, approved, rejected
	CreatedAt       time.Time `json:"createdAt"`
	ReviewedAt      *time.Time `json:"reviewedAt,omitempty"`
	ReviewedBy      string    `json:"reviewedBy,omitempty"`
	RejectionReason string    `json:"rejectionReason,omitempty"`
}

// CorridorAssignmentService manages per-participant corridor access
type CorridorAssignmentService struct {
	mu           sync.RWMutex
	corridors    map[string]CorridorDefinition                     // code → definition
	assignments  map[int]map[string]*ParticipantCorridorAssignment // participantID → corridorCode → assignment
	requests     []CorridorAssignmentRequest
	tierService  *TierDeterminationService
}

// NewCorridorAssignmentService creates a service with Nigeria's 13 outbound corridors
func NewCorridorAssignmentService(tierService *TierDeterminationService) *CorridorAssignmentService {
	corridors := map[string]CorridorDefinition{
		"NG-GH": {Code: "NG-GH", Name: "Nigeria → Ghana", DestCountry: "GH", DestCurrency: "GHS", Category: "west_africa_labor", RiskLevel: RiskLow, MinTier: TierStarter, RequiresLicense: false, CBNSpreadCapBps: 80, Active: true},
		"NG-SN": {Code: "NG-SN", Name: "Nigeria → Senegal", DestCountry: "SN", DestCurrency: "XOF", Category: "west_africa_labor", RiskLevel: RiskLow, MinTier: TierStarter, RequiresLicense: false, CBNSpreadCapBps: 100, Active: true},
		"NG-CI": {Code: "NG-CI", Name: "Nigeria → Côte d'Ivoire", DestCountry: "CI", DestCurrency: "XOF", Category: "west_africa_labor", RiskLevel: RiskLow, MinTier: TierStarter, RequiresLicense: false, CBNSpreadCapBps: 100, Active: true},
		"NG-CM": {Code: "NG-CM", Name: "Nigeria → Cameroon", DestCountry: "CM", DestCurrency: "XAF", Category: "west_africa_labor", RiskLevel: RiskMedium, MinTier: TierGrowth, RequiresLicense: false, CBNSpreadCapBps: 120, Active: true},
		"NG-KE": {Code: "NG-KE", Name: "Nigeria → Kenya", DestCountry: "KE", DestCurrency: "KES", Category: "east_africa", RiskLevel: RiskMedium, MinTier: TierGrowth, RequiresLicense: false, CBNSpreadCapBps: 100, Active: true},
		"NG-ZA": {Code: "NG-ZA", Name: "Nigeria → South Africa", DestCountry: "ZA", DestCurrency: "ZAR", Category: "southern_africa", RiskLevel: RiskMedium, MinTier: TierGrowth, RequiresLicense: false, CBNSpreadCapBps: 90, Active: true},
		"NG-GB": {Code: "NG-GB", Name: "Nigeria → United Kingdom", DestCountry: "GB", DestCurrency: "GBP", Category: "education", RiskLevel: RiskLow, MinTier: TierGrowth, RequiresLicense: true, CBNSpreadCapBps: 80, Active: true},
		"NG-US": {Code: "NG-US", Name: "Nigeria → United States", DestCountry: "US", DestCurrency: "USD", Category: "education", RiskLevel: RiskMedium, MinTier: TierGrowth, RequiresLicense: true, CBNSpreadCapBps: 80, Active: true},
		"NG-CA": {Code: "NG-CA", Name: "Nigeria → Canada", DestCountry: "CA", DestCurrency: "CAD", Category: "education", RiskLevel: RiskLow, MinTier: TierGrowth, RequiresLicense: true, CBNSpreadCapBps: 90, Active: true},
		"NG-IN": {Code: "NG-IN", Name: "Nigeria → India", DestCountry: "IN", DestCurrency: "INR", Category: "medical", RiskLevel: RiskMedium, MinTier: TierEnterprise, RequiresLicense: true, CBNSpreadCapBps: 120, Active: true},
		"NG-CN": {Code: "NG-CN", Name: "Nigeria → China", DestCountry: "CN", DestCurrency: "CNY", Category: "premium_business", RiskLevel: RiskHigh, MinTier: TierEnterprise, RequiresLicense: true, CBNSpreadCapBps: 150, Active: true},
		"NG-AE": {Code: "NG-AE", Name: "Nigeria → UAE", DestCountry: "AE", DestCurrency: "AED", Category: "premium_business", RiskLevel: RiskHigh, MinTier: TierEnterprise, RequiresLicense: true, CBNSpreadCapBps: 120, Active: true},
		"NG-TR": {Code: "NG-TR", Name: "Nigeria → Turkey", DestCountry: "TR", DestCurrency: "TRY", Category: "general_personal", RiskLevel: RiskMedium, MinTier: TierGrowth, RequiresLicense: false, CBNSpreadCapBps: 200, Active: true},
	}

	return &CorridorAssignmentService{
		corridors:   corridors,
		assignments: make(map[int]map[string]*ParticipantCorridorAssignment),
		requests:    make([]CorridorAssignmentRequest, 0),
		tierService: tierService,
	}
}

// GetAvailableCorridors returns corridors a participant is eligible for based on tier
func (cs *CorridorAssignmentService) GetAvailableCorridors(participantID int) []CorridorDefinition {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	tier := cs.tierService.GetParticipantTier(participantID)
	rank := tierRank(tier)

	var available []CorridorDefinition
	for _, c := range cs.corridors {
		if c.Active && tierRank(c.MinTier) <= rank {
			available = append(available, c)
		}
	}
	return available
}

// GetAssignedCorridors returns corridors actively assigned to a participant
func (cs *CorridorAssignmentService) GetAssignedCorridors(participantID int) []ParticipantCorridorAssignment {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	var result []ParticipantCorridorAssignment
	if assignments, ok := cs.assignments[participantID]; ok {
		for _, a := range assignments {
			if a.Status == "active" {
				result = append(result, *a)
			}
		}
	}
	return result
}

// AssignCorridor grants a participant access to a corridor (admin action)
func (cs *CorridorAssignmentService) AssignCorridor(participantID int, corridorCode string, grantedBy string, dailyLimit float64, monthlyLimit float64) (*ParticipantCorridorAssignment, error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	corridor, exists := cs.corridors[corridorCode]
	if !exists {
		return nil, fmt.Errorf("corridor %s not found", corridorCode)
	}
	if !corridor.Active {
		return nil, fmt.Errorf("corridor %s is not active", corridorCode)
	}

	// Verify tier eligibility
	tier := cs.tierService.GetParticipantTier(participantID)
	if tierRank(tier) < tierRank(corridor.MinTier) {
		return nil, fmt.Errorf("participant tier %s does not meet minimum %s for corridor %s", tier, corridor.MinTier, corridorCode)
	}

	// Check corridor count limit
	criteria, hasCriteria := cs.tierService.GetTierCriteria(tier)
	if hasCriteria {
		activeCount := 0
		if assignments, ok := cs.assignments[participantID]; ok {
			for _, a := range assignments {
				if a.Status == "active" {
					activeCount++
				}
			}
		}
		if activeCount >= criteria.MaxCorridors {
			return nil, fmt.Errorf("participant has reached maximum %d corridors for %s tier", criteria.MaxCorridors, tier)
		}
	}

	assignment := &ParticipantCorridorAssignment{
		ParticipantID:   participantID,
		CorridorCode:    corridorCode,
		Status:          "active",
		GrantedAt:       time.Now(),
		GrantedBy:       grantedBy,
		LicenseVerified: !corridor.RequiresLicense,
		DailyLimitNGN:   dailyLimit,
		MonthlyLimitNGN: monthlyLimit,
	}

	if cs.assignments[participantID] == nil {
		cs.assignments[participantID] = make(map[string]*ParticipantCorridorAssignment)
	}
	cs.assignments[participantID][corridorCode] = assignment
	return assignment, nil
}

// SuspendCorridor suspends a participant's access to a corridor
func (cs *CorridorAssignmentService) SuspendCorridor(participantID int, corridorCode string, reason string) bool {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if assignments, ok := cs.assignments[participantID]; ok {
		if a, exists := assignments[corridorCode]; exists && a.Status == "active" {
			now := time.Now()
			a.Status = "suspended"
			a.SuspendedAt = &now
			a.SuspendReason = reason
			return true
		}
	}
	return false
}

// RequestCorridorAccess submits a request for a new corridor (participant action)
func (cs *CorridorAssignmentService) RequestCorridorAccess(participantID int, corridorCode string, justification string, licenseDocRef string) (*CorridorAssignmentRequest, error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	corridor, exists := cs.corridors[corridorCode]
	if !exists {
		return nil, fmt.Errorf("corridor %s not found", corridorCode)
	}

	// Check if already assigned
	if assignments, ok := cs.assignments[participantID]; ok {
		if a, exists := assignments[corridorCode]; exists && a.Status == "active" {
			return nil, fmt.Errorf("corridor %s already assigned to participant", corridorCode)
		}
	}

	// Verify tier eligibility
	tier := cs.tierService.GetParticipantTier(participantID)
	if tierRank(tier) < tierRank(corridor.MinTier) {
		return nil, fmt.Errorf("tier %s does not meet minimum %s for %s — upgrade tier first", tier, corridor.MinTier, corridorCode)
	}

	request := CorridorAssignmentRequest{
		ID:            fmt.Sprintf("cor-req-%d-%s-%d", participantID, corridorCode, time.Now().UnixNano()),
		ParticipantID: participantID,
		CorridorCode:  corridorCode,
		Justification: justification,
		LicenseDocRef: licenseDocRef,
		Status:        "pending",
		CreatedAt:     time.Now(),
	}

	cs.requests = append(cs.requests, request)
	return &request, nil
}

// ApproveCorridorRequest approves a corridor access request (admin action)
func (cs *CorridorAssignmentService) ApproveCorridorRequest(requestID string, reviewedBy string, dailyLimit float64, monthlyLimit float64) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	for i := range cs.requests {
		if cs.requests[i].ID == requestID && cs.requests[i].Status == "pending" {
			now := time.Now()
			cs.requests[i].Status = "approved"
			cs.requests[i].ReviewedAt = &now
			cs.requests[i].ReviewedBy = reviewedBy

			// Create the assignment
			corridor := cs.corridors[cs.requests[i].CorridorCode]
			assignment := &ParticipantCorridorAssignment{
				ParticipantID:   cs.requests[i].ParticipantID,
				CorridorCode:    cs.requests[i].CorridorCode,
				Status:          "active",
				GrantedAt:       now,
				GrantedBy:       reviewedBy,
				LicenseVerified: !corridor.RequiresLicense || cs.requests[i].LicenseDocRef != "",
				DailyLimitNGN:   dailyLimit,
				MonthlyLimitNGN: monthlyLimit,
			}

			if cs.assignments[cs.requests[i].ParticipantID] == nil {
				cs.assignments[cs.requests[i].ParticipantID] = make(map[string]*ParticipantCorridorAssignment)
			}
			cs.assignments[cs.requests[i].ParticipantID][cs.requests[i].CorridorCode] = assignment
			return nil
		}
	}
	return fmt.Errorf("request %s not found or not pending", requestID)
}

// GetPendingRequests returns all pending corridor access requests (admin view)
func (cs *CorridorAssignmentService) GetPendingRequests() []CorridorAssignmentRequest {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	var pending []CorridorAssignmentRequest
	for _, r := range cs.requests {
		if r.Status == "pending" {
			pending = append(pending, r)
		}
	}
	return pending
}

// IsCorridorAllowed checks if a participant can send to a corridor
func (cs *CorridorAssignmentService) IsCorridorAllowed(participantID int, corridorCode string) bool {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	if assignments, ok := cs.assignments[participantID]; ok {
		if a, exists := assignments[corridorCode]; exists {
			return a.Status == "active"
		}
	}
	return false
}

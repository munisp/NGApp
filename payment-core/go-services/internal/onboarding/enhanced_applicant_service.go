// Package onboarding provides enhanced applicant onboarding with key personnel, document validation, and status tracking
package onboarding

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// KeyPerson represents a director, UBO, or signatory for KYC
type KeyPerson struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Role           string    `json:"role"` // DIRECTOR, UBO, SIGNATORY, AUTHORIZED_REPRESENTATIVE
	Email          string    `json:"email"`
	Phone          string    `json:"phone,omitempty"`
	Nationality    string    `json:"nationality"`
	DateOfBirth    string    `json:"date_of_birth,omitempty"`
	IDType         string    `json:"id_type"` // PASSPORT, NATIONAL_ID, DRIVERS_LICENSE
	IDNumber       string    `json:"id_number"`
	IDExpiry       string    `json:"id_expiry,omitempty"`
	OwnershipPct   float64   `json:"ownership_pct,omitempty"` // For UBOs
	IsPEP          bool      `json:"is_pep"`                  // Politically Exposed Person
	KYCStatus      string    `json:"kyc_status"`              // NOT_STARTED, PENDING, APPROVED, REJECTED
	KYCCaseID      string    `json:"kyc_case_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// DocumentWithValidation represents an uploaded document with OCR validation
type DocumentWithValidation struct {
	ID               string                 `json:"id"`
	CaseID           string                 `json:"case_id"`
	RequirementID    string                 `json:"requirement_id"`
	Name             string                 `json:"name"`
	Type             string                 `json:"type"` // CERTIFICATE_OF_INCORPORATION, BANKING_LICENSE, etc.
	FileURL          string                 `json:"file_url"`
	FileHash         string                 `json:"file_hash"`
	MimeType         string                 `json:"mime_type"`
	Size             int64                  `json:"size"`
	Status           string                 `json:"status"` // UPLOADED, PROCESSING, VALIDATED, INVALID, EXPIRED
	UploadedBy       string                 `json:"uploaded_by"`
	UploadedAt       time.Time              `json:"uploaded_at"`
	// OCR Validation Results
	OCRProcessed     bool                   `json:"ocr_processed"`
	OCRConfidence    float64                `json:"ocr_confidence"`
	ExtractedData    map[string]interface{} `json:"extracted_data,omitempty"`
	ValidationErrors []string               `json:"validation_errors,omitempty"`
	ExpiryDate       *time.Time             `json:"expiry_date,omitempty"`
	IsExpired        bool                   `json:"is_expired"`
}

// ApplicationDraft represents a saved draft application
type ApplicationDraft struct {
	ID               string                 `json:"id"`
	SessionID        string                 `json:"session_id"`
	Email            string                 `json:"email"`
	CurrentStep      int                    `json:"current_step"`
	FormData         map[string]interface{} `json:"form_data"`
	KeyPersonnel     []KeyPerson            `json:"key_personnel"`
	Documents        []DocumentWithValidation `json:"documents"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	ExpiresAt        time.Time              `json:"expires_at"` // Drafts expire after 30 days
}

// ApplicationStatus represents real-time status tracking
type ApplicationStatus struct {
	CaseID              string              `json:"case_id"`
	OrganizationName    string              `json:"organization_name"`
	Status              string              `json:"status"`
	StatusDescription   string              `json:"status_description"`
	CurrentPhase        string              `json:"current_phase"`
	PhaseProgress       int                 `json:"phase_progress"` // 0-100
	SubmittedAt         time.Time           `json:"submitted_at"`
	EstimatedCompletion *time.Time          `json:"estimated_completion,omitempty"`
	PendingActions      []PendingAction     `json:"pending_actions"`
	CompletedSteps      []CompletedStep     `json:"completed_steps"`
	Timeline            []TimelineEvent     `json:"timeline"`
	Notifications       []StatusNotification `json:"notifications"`
}

// PendingAction represents an action required from the applicant
type PendingAction struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // DOCUMENT_UPLOAD, DOCUMENT_RESUBMIT, KYC_VERIFICATION, INFORMATION_REQUEST
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	Priority    string    `json:"priority"` // HIGH, MEDIUM, LOW
	ActionURL   string    `json:"action_url,omitempty"`
}

// CompletedStep represents a completed step in the onboarding process
type CompletedStep struct {
	Step        string    `json:"step"`
	Title       string    `json:"title"`
	CompletedAt time.Time `json:"completed_at"`
	CompletedBy string    `json:"completed_by"`
}

// TimelineEvent represents an event in the application timeline
type TimelineEvent struct {
	ID          string    `json:"id"`
	Event       string    `json:"event"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	Actor       string    `json:"actor"`
	ActorType   string    `json:"actor_type"` // APPLICANT, REVIEWER, SYSTEM
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// StatusNotification represents a notification for the applicant
type StatusNotification struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // INFO, WARNING, SUCCESS, ERROR
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
	ActionURL string    `json:"action_url,omitempty"`
}

// RiskScore represents the calculated risk score for an application
type RiskScore struct {
	CaseID              string             `json:"case_id"`
	OverallScore        int                `json:"overall_score"` // 0-100, higher = more risk
	RiskLevel           string             `json:"risk_level"`    // LOW, MEDIUM, HIGH, CRITICAL
	CalculatedAt        time.Time          `json:"calculated_at"`
	Factors             []RiskFactor       `json:"factors"`
	JurisdictionRisk    int                `json:"jurisdiction_risk"`
	StakeholderTypeRisk int                `json:"stakeholder_type_risk"`
	DocumentRisk        int                `json:"document_risk"`
	PEPRisk             int                `json:"pep_risk"`
	SanctionsRisk       int                `json:"sanctions_risk"`
	AdverseMediaRisk    int                `json:"adverse_media_risk"`
	Recommendations     []string           `json:"recommendations"`
}

// RiskFactor represents a factor contributing to the risk score
type RiskFactor struct {
	Category    string `json:"category"`
	Factor      string `json:"factor"`
	Score       int    `json:"score"`
	Weight      float64 `json:"weight"`
	Description string `json:"description"`
}

// ScreeningResult represents results from sanctions/PEP/adverse media screening
type ScreeningResult struct {
	ID              string           `json:"id"`
	CaseID          string           `json:"case_id"`
	EntityType      string           `json:"entity_type"` // ORGANIZATION, PERSON
	EntityName      string           `json:"entity_name"`
	ScreeningType   string           `json:"screening_type"` // SANCTIONS, PEP, ADVERSE_MEDIA
	Status          string           `json:"status"`         // CLEAR, POTENTIAL_MATCH, CONFIRMED_MATCH
	ScreenedAt      time.Time        `json:"screened_at"`
	Matches         []ScreeningMatch `json:"matches,omitempty"`
	ReviewedBy      string           `json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time       `json:"reviewed_at,omitempty"`
	ReviewDecision  string           `json:"review_decision,omitempty"` // FALSE_POSITIVE, TRUE_MATCH
	ReviewNotes     string           `json:"review_notes,omitempty"`
}

// ScreeningMatch represents a potential match from screening
type ScreeningMatch struct {
	Source          string  `json:"source"` // OFAC, UN, EU, WORLDCHECK, etc.
	MatchScore      float64 `json:"match_score"`
	MatchedName     string  `json:"matched_name"`
	MatchedEntity   string  `json:"matched_entity,omitempty"`
	ListType        string  `json:"list_type,omitempty"`
	ListDate        string  `json:"list_date,omitempty"`
	Reason          string  `json:"reason,omitempty"`
	SourceURL       string  `json:"source_url,omitempty"`
}

// SLATracking represents SLA tracking for an onboarding case
type SLATracking struct {
	CaseID              string     `json:"case_id"`
	StakeholderType     string     `json:"stakeholder_type"`
	TargetDays          int        `json:"target_days"`
	ElapsedDays         int        `json:"elapsed_days"`
	RemainingDays       int        `json:"remaining_days"`
	IsOverdue           bool       `json:"is_overdue"`
	OverdueDays         int        `json:"overdue_days"`
	CurrentPhase        string     `json:"current_phase"`
	PhaseStartedAt      time.Time  `json:"phase_started_at"`
	PhaseTargetDays     int        `json:"phase_target_days"`
	PhaseElapsedDays    int        `json:"phase_elapsed_days"`
	PhaseIsOverdue      bool       `json:"phase_is_overdue"`
	Alerts              []SLAAlert `json:"alerts"`
}

// SLAAlert represents an SLA alert
type SLAAlert struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // WARNING, BREACH, ESCALATION
	Message     string    `json:"message"`
	CreatedAt   time.Time `json:"created_at"`
	AcknowledgedBy string `json:"acknowledged_by,omitempty"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
}

// BulkOnboardingRequest represents a bulk onboarding request
type BulkOnboardingRequest struct {
	ID              string                  `json:"id"`
	UploadedBy      string                  `json:"uploaded_by"`
	FileName        string                  `json:"file_name"`
	TotalRecords    int                     `json:"total_records"`
	ProcessedRecords int                    `json:"processed_records"`
	SuccessCount    int                     `json:"success_count"`
	FailureCount    int                     `json:"failure_count"`
	Status          string                  `json:"status"` // PENDING, PROCESSING, COMPLETED, FAILED
	CreatedAt       time.Time               `json:"created_at"`
	CompletedAt     *time.Time              `json:"completed_at,omitempty"`
	Results         []BulkOnboardingResult  `json:"results,omitempty"`
}

// BulkOnboardingResult represents the result of a single bulk onboarding record
type BulkOnboardingResult struct {
	RowNumber        int      `json:"row_number"`
	OrganizationName string   `json:"organization_name"`
	Status           string   `json:"status"` // SUCCESS, FAILED, SKIPPED
	CaseID           string   `json:"case_id,omitempty"`
	Errors           []string `json:"errors,omitempty"`
}

// AuditTrailExport represents an audit trail export request
type AuditTrailExport struct {
	ID           string    `json:"id"`
	CaseID       string    `json:"case_id,omitempty"` // Empty for all cases
	RequestedBy  string    `json:"requested_by"`
	Format       string    `json:"format"` // PDF, CSV, JSON
	DateFrom     time.Time `json:"date_from"`
	DateTo       time.Time `json:"date_to"`
	Status       string    `json:"status"` // PENDING, GENERATING, COMPLETED, FAILED
	FileURL      string    `json:"file_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

// BusinessRegistryData represents data from business registry APIs
type BusinessRegistryData struct {
	RegistrationNumber string                 `json:"registration_number"`
	CompanyName        string                 `json:"company_name"`
	CompanyType        string                 `json:"company_type"`
	Status             string                 `json:"status"`
	IncorporationDate  string                 `json:"incorporation_date"`
	RegisteredAddress  string                 `json:"registered_address"`
	Directors          []DirectorInfo         `json:"directors"`
	Shareholders       []ShareholderInfo      `json:"shareholders"`
	FilingHistory      []FilingInfo           `json:"filing_history"`
	Source             string                 `json:"source"`
	RetrievedAt        time.Time              `json:"retrieved_at"`
	RawData            map[string]interface{} `json:"raw_data,omitempty"`
}

// DirectorInfo represents director information from registry
type DirectorInfo struct {
	Name           string `json:"name"`
	Nationality    string `json:"nationality"`
	DateOfBirth    string `json:"date_of_birth,omitempty"`
	AppointmentDate string `json:"appointment_date"`
	ResignationDate string `json:"resignation_date,omitempty"`
	Occupation     string `json:"occupation,omitempty"`
}

// ShareholderInfo represents shareholder information from registry
type ShareholderInfo struct {
	Name           string  `json:"name"`
	Type           string  `json:"type"` // INDIVIDUAL, CORPORATE
	SharesHeld     int     `json:"shares_held"`
	OwnershipPct   float64 `json:"ownership_pct"`
	ShareClass     string  `json:"share_class"`
}

// FilingInfo represents filing history from registry
type FilingInfo struct {
	Type        string `json:"type"`
	Date        string `json:"date"`
	Description string `json:"description"`
	DocumentURL string `json:"document_url,omitempty"`
}

// EnhancedApplicantService provides enhanced onboarding functionality
type EnhancedApplicantService struct {
	drafts           map[string]*ApplicationDraft
	draftsMu         sync.RWMutex
	statuses         map[string]*ApplicationStatus
	statusesMu       sync.RWMutex
	riskScores       map[string]*RiskScore
	riskScoresMu     sync.RWMutex
	screeningResults map[string][]*ScreeningResult
	screeningMu      sync.RWMutex
	slaTracking      map[string]*SLATracking
	slaMu            sync.RWMutex
	bulkRequests     map[string]*BulkOnboardingRequest
	bulkMu           sync.RWMutex
	auditExports     map[string]*AuditTrailExport
	auditMu          sync.RWMutex
	notificationSvc  NotificationService
}

// NotificationService interface for sending notifications
type NotificationService interface {
	Send(ctx context.Context, req NotificationRequest) error
	SendEmail(ctx context.Context, to, subject, body string) error
	SendSMS(ctx context.Context, to, message string) error
	SendPushNotification(ctx context.Context, userID, title, message string) error
}

// NewEnhancedApplicantService creates a new enhanced applicant service
func NewEnhancedApplicantService(notificationSvc NotificationService) *EnhancedApplicantService {
	return &EnhancedApplicantService{
		drafts:           make(map[string]*ApplicationDraft),
		statuses:         make(map[string]*ApplicationStatus),
		riskScores:       make(map[string]*RiskScore),
		screeningResults: make(map[string][]*ScreeningResult),
		slaTracking:      make(map[string]*SLATracking),
		bulkRequests:     make(map[string]*BulkOnboardingRequest),
		auditExports:     make(map[string]*AuditTrailExport),
		notificationSvc:  notificationSvc,
	}
}

// SaveDraft saves an application draft
func (s *EnhancedApplicantService) SaveDraft(ctx context.Context, draft *ApplicationDraft) (*ApplicationDraft, error) {
	s.draftsMu.Lock()
	defer s.draftsMu.Unlock()

	if draft.ID == "" {
		draft.ID = uuid.New().String()
		draft.CreatedAt = time.Now()
	}
	draft.UpdatedAt = time.Now()
	draft.ExpiresAt = time.Now().AddDate(0, 0, 30) // 30 days expiry

	s.drafts[draft.ID] = draft
	return draft, nil
}

// GetDraft retrieves a draft by ID or email
func (s *EnhancedApplicantService) GetDraft(ctx context.Context, idOrEmail string) (*ApplicationDraft, error) {
	s.draftsMu.RLock()
	defer s.draftsMu.RUnlock()

	// Try by ID first
	if draft, ok := s.drafts[idOrEmail]; ok {
		if time.Now().Before(draft.ExpiresAt) {
			return draft, nil
		}
	}

	// Try by email
	for _, draft := range s.drafts {
		if draft.Email == idOrEmail && time.Now().Before(draft.ExpiresAt) {
			return draft, nil
		}
	}

	return nil, fmt.Errorf("draft not found or expired")
}

// GetApplicationStatus retrieves real-time application status
func (s *EnhancedApplicantService) GetApplicationStatus(ctx context.Context, caseID string) (*ApplicationStatus, error) {
	s.statusesMu.RLock()
	defer s.statusesMu.RUnlock()

	if status, ok := s.statuses[caseID]; ok {
		return status, nil
	}

	return nil, fmt.Errorf("application status not found for case %s", caseID)
}

// UpdateApplicationStatus updates the application status
func (s *EnhancedApplicantService) UpdateApplicationStatus(ctx context.Context, caseID string, newStatus string, description string) error {
	s.statusesMu.Lock()
	defer s.statusesMu.Unlock()

	status, ok := s.statuses[caseID]
	if !ok {
		status = &ApplicationStatus{
			CaseID:         caseID,
			Timeline:       []TimelineEvent{},
			Notifications:  []StatusNotification{},
			PendingActions: []PendingAction{},
			CompletedSteps: []CompletedStep{},
		}
		s.statuses[caseID] = status
	}

	oldStatus := status.Status
	status.Status = newStatus
	status.StatusDescription = description

	// Add timeline event
	status.Timeline = append(status.Timeline, TimelineEvent{
		ID:          uuid.New().String(),
		Event:       fmt.Sprintf("Status changed from %s to %s", oldStatus, newStatus),
		Description: description,
		Timestamp:   time.Now(),
		Actor:       "System",
		ActorType:   "SYSTEM",
	})

	// Add notification
	status.Notifications = append(status.Notifications, StatusNotification{
		ID:        uuid.New().String(),
		Type:      "INFO",
		Title:     "Application Status Updated",
		Message:   description,
		Read:      false,
		CreatedAt: time.Now(),
	})

	return nil
}

// CalculateRiskScore calculates the risk score for an application
func (s *EnhancedApplicantService) CalculateRiskScore(ctx context.Context, caseID string, stakeholderType string, country string, keyPersonnel []KeyPerson, screeningResults []*ScreeningResult) (*RiskScore, error) {
	s.riskScoresMu.Lock()
	defer s.riskScoresMu.Unlock()

	riskScore := &RiskScore{
		CaseID:       caseID,
		CalculatedAt: time.Now(),
		Factors:      []RiskFactor{},
	}

	// Jurisdiction risk
	jurisdictionRisk := s.calculateJurisdictionRisk(country)
	riskScore.JurisdictionRisk = jurisdictionRisk
	riskScore.Factors = append(riskScore.Factors, RiskFactor{
		Category:    "JURISDICTION",
		Factor:      "Country Risk",
		Score:       jurisdictionRisk,
		Weight:      0.25,
		Description: fmt.Sprintf("Risk score for jurisdiction: %s", country),
	})

	// Stakeholder type risk
	stakeholderRisk := s.calculateStakeholderTypeRisk(stakeholderType)
	riskScore.StakeholderTypeRisk = stakeholderRisk
	riskScore.Factors = append(riskScore.Factors, RiskFactor{
		Category:    "STAKEHOLDER_TYPE",
		Factor:      "Entity Type Risk",
		Score:       stakeholderRisk,
		Weight:      0.15,
		Description: fmt.Sprintf("Risk score for stakeholder type: %s", stakeholderType),
	})

	// PEP risk
	pepRisk := 0
	for _, person := range keyPersonnel {
		if person.IsPEP {
			pepRisk = 50
			break
		}
	}
	riskScore.PEPRisk = pepRisk
	if pepRisk > 0 {
		riskScore.Factors = append(riskScore.Factors, RiskFactor{
			Category:    "PEP",
			Factor:      "Politically Exposed Person",
			Score:       pepRisk,
			Weight:      0.20,
			Description: "One or more key personnel are PEPs",
		})
	}

	// Sanctions risk
	sanctionsRisk := 0
	for _, result := range screeningResults {
		if result.ScreeningType == "SANCTIONS" && result.Status == "POTENTIAL_MATCH" {
			sanctionsRisk = 80
			break
		}
	}
	riskScore.SanctionsRisk = sanctionsRisk
	if sanctionsRisk > 0 {
		riskScore.Factors = append(riskScore.Factors, RiskFactor{
			Category:    "SANCTIONS",
			Factor:      "Sanctions Screening",
			Score:       sanctionsRisk,
			Weight:      0.25,
			Description: "Potential sanctions match found",
		})
		riskScore.Recommendations = append(riskScore.Recommendations, "Manual review required for sanctions match")
	}

	// Adverse media risk
	adverseMediaRisk := 0
	for _, result := range screeningResults {
		if result.ScreeningType == "ADVERSE_MEDIA" && result.Status == "POTENTIAL_MATCH" {
			adverseMediaRisk = 40
			break
		}
	}
	riskScore.AdverseMediaRisk = adverseMediaRisk
	if adverseMediaRisk > 0 {
		riskScore.Factors = append(riskScore.Factors, RiskFactor{
			Category:    "ADVERSE_MEDIA",
			Factor:      "Adverse Media",
			Score:       adverseMediaRisk,
			Weight:      0.15,
			Description: "Adverse media coverage found",
		})
	}

	// Calculate overall score
	totalWeight := 0.0
	weightedScore := 0.0
	for _, factor := range riskScore.Factors {
		weightedScore += float64(factor.Score) * factor.Weight
		totalWeight += factor.Weight
	}
	if totalWeight > 0 {
		riskScore.OverallScore = int(weightedScore / totalWeight)
	}

	// Determine risk level
	switch {
	case riskScore.OverallScore >= 70:
		riskScore.RiskLevel = "CRITICAL"
		riskScore.Recommendations = append(riskScore.Recommendations, "Enhanced due diligence required")
	case riskScore.OverallScore >= 50:
		riskScore.RiskLevel = "HIGH"
		riskScore.Recommendations = append(riskScore.Recommendations, "Additional documentation may be required")
	case riskScore.OverallScore >= 30:
		riskScore.RiskLevel = "MEDIUM"
	default:
		riskScore.RiskLevel = "LOW"
	}

	s.riskScores[caseID] = riskScore
	return riskScore, nil
}

func (s *EnhancedApplicantService) calculateJurisdictionRisk(country string) int {
	// High-risk jurisdictions
	highRisk := map[string]bool{
		"Iran": true, "North Korea": true, "Syria": true, "Cuba": true,
		"Venezuela": true, "Myanmar": true, "Russia": true, "Belarus": true,
	}
	// Medium-risk jurisdictions
	mediumRisk := map[string]bool{
		"Pakistan": true, "Afghanistan": true, "Iraq": true, "Libya": true,
		"Somalia": true, "South Sudan": true, "Yemen": true,
	}

	if highRisk[country] {
		return 90
	}
	if mediumRisk[country] {
		return 60
	}
	return 20
}

func (s *EnhancedApplicantService) calculateStakeholderTypeRisk(stakeholderType string) int {
	riskMap := map[string]int{
		"BANK":                    20,
		"REGULATOR":               10,
		"GOVERNMENT_AGENCY":       15,
		"MOBILE_MONEY_OPERATOR":   30,
		"FINTECH":                 40,
		"MICROFINANCE_INSTITUTION": 35,
		"MERCHANT":                45,
		"DEVELOPER":               25,
		"NOC_OPERATOR":            20,
	}
	if risk, ok := riskMap[stakeholderType]; ok {
		return risk
	}
	return 50
}

// PerformScreening performs sanctions, PEP, and adverse media screening
func (s *EnhancedApplicantService) PerformScreening(ctx context.Context, caseID string, entityName string, entityType string, screeningType string) (*ScreeningResult, error) {
	s.screeningMu.Lock()
	defer s.screeningMu.Unlock()

	result := &ScreeningResult{
		ID:            uuid.New().String(),
		CaseID:        caseID,
		EntityType:    entityType,
		EntityName:    entityName,
		ScreeningType: screeningType,
		ScreenedAt:    time.Now(),
		Status:        "CLEAR",
		Matches:       []ScreeningMatch{},
	}

	// In production, this would call external screening APIs
	// For now, simulate screening with mock data
	// Example: OFAC, UN, EU sanctions lists, World-Check for PEP, etc.

	s.screeningResults[caseID] = append(s.screeningResults[caseID], result)
	return result, nil
}

// GetSLATracking retrieves SLA tracking for a case
func (s *EnhancedApplicantService) GetSLATracking(ctx context.Context, caseID string) (*SLATracking, error) {
	s.slaMu.RLock()
	defer s.slaMu.RUnlock()

	if sla, ok := s.slaTracking[caseID]; ok {
		return sla, nil
	}
	return nil, fmt.Errorf("SLA tracking not found for case %s", caseID)
}

// UpdateSLATracking updates SLA tracking for a case
func (s *EnhancedApplicantService) UpdateSLATracking(ctx context.Context, caseID string, stakeholderType string, currentPhase string, submittedAt time.Time) (*SLATracking, error) {
	s.slaMu.Lock()
	defer s.slaMu.Unlock()

	// SLA targets by stakeholder type (in days)
	slaTargets := map[string]int{
		"BANK":                    30,
		"MOBILE_MONEY_OPERATOR":   30,
		"FINTECH":                 21,
		"MICROFINANCE_INSTITUTION": 21,
		"GOVERNMENT_AGENCY":       14,
		"MERCHANT":                14,
		"REGULATOR":               7,
		"NOC_OPERATOR":            14,
		"DEVELOPER":               7,
	}

	targetDays := slaTargets[stakeholderType]
	if targetDays == 0 {
		targetDays = 21
	}

	elapsedDays := int(time.Since(submittedAt).Hours() / 24)
	remainingDays := targetDays - elapsedDays
	isOverdue := remainingDays < 0
	overdueDays := 0
	if isOverdue {
		overdueDays = -remainingDays
	}

	sla := &SLATracking{
		CaseID:          caseID,
		StakeholderType: stakeholderType,
		TargetDays:      targetDays,
		ElapsedDays:     elapsedDays,
		RemainingDays:   remainingDays,
		IsOverdue:       isOverdue,
		OverdueDays:     overdueDays,
		CurrentPhase:    currentPhase,
		PhaseStartedAt:  time.Now(),
		Alerts:          []SLAAlert{},
	}

	// Generate alerts
	if isOverdue {
		sla.Alerts = append(sla.Alerts, SLAAlert{
			ID:        uuid.New().String(),
			Type:      "BREACH",
			Message:   fmt.Sprintf("SLA breached by %d days", overdueDays),
			CreatedAt: time.Now(),
		})
	} else if remainingDays <= 3 {
		sla.Alerts = append(sla.Alerts, SLAAlert{
			ID:        uuid.New().String(),
			Type:      "WARNING",
			Message:   fmt.Sprintf("SLA deadline approaching: %d days remaining", remainingDays),
			CreatedAt: time.Now(),
		})
	}

	s.slaTracking[caseID] = sla
	return sla, nil
}

// ProcessBulkOnboarding processes a bulk onboarding CSV file
func (s *EnhancedApplicantService) ProcessBulkOnboarding(ctx context.Context, request *BulkOnboardingRequest, records []map[string]string) (*BulkOnboardingRequest, error) {
	s.bulkMu.Lock()
	defer s.bulkMu.Unlock()

	request.ID = uuid.New().String()
	request.Status = "PROCESSING"
	request.CreatedAt = time.Now()
	request.TotalRecords = len(records)
	request.Results = []BulkOnboardingResult{}

	for i, record := range records {
		result := BulkOnboardingResult{
			RowNumber:        i + 1,
			OrganizationName: record["organization_name"],
		}

		// Validate required fields
		errors := []string{}
		if record["organization_name"] == "" {
			errors = append(errors, "organization_name is required")
		}
		if record["stakeholder_type"] == "" {
			errors = append(errors, "stakeholder_type is required")
		}
		if record["contact_email"] == "" {
			errors = append(errors, "contact_email is required")
		}

		if len(errors) > 0 {
			result.Status = "FAILED"
			result.Errors = errors
			request.FailureCount++
		} else {
			// Create onboarding case
			caseID := fmt.Sprintf("OB-%d-%d", time.Now().Unix(), i)
			result.Status = "SUCCESS"
			result.CaseID = caseID
			request.SuccessCount++
		}

		request.ProcessedRecords++
		request.Results = append(request.Results, result)
	}

	request.Status = "COMPLETED"
	completedAt := time.Now()
	request.CompletedAt = &completedAt

	s.bulkRequests[request.ID] = request
	return request, nil
}

// GenerateAuditTrailExport generates an audit trail export
func (s *EnhancedApplicantService) GenerateAuditTrailExport(ctx context.Context, export *AuditTrailExport) (*AuditTrailExport, error) {
	s.auditMu.Lock()
	defer s.auditMu.Unlock()

	export.ID = uuid.New().String()
	export.Status = "GENERATING"
	export.CreatedAt = time.Now()

	// In production, this would generate the actual export file
	// For now, simulate the export
	export.Status = "COMPLETED"
	completedAt := time.Now()
	export.CompletedAt = &completedAt
	export.FileURL = fmt.Sprintf("/exports/audit-trail-%s.%s", export.ID, export.Format)

	s.auditExports[export.ID] = export
	return export, nil
}

// FetchBusinessRegistryData fetches data from business registry APIs
func (s *EnhancedApplicantService) FetchBusinessRegistryData(ctx context.Context, country string, registrationNumber string) (*BusinessRegistryData, error) {
	// In production, this would call actual business registry APIs
	// Examples: Companies House (UK), CAC (Nigeria), CIPC (South Africa), etc.

	data := &BusinessRegistryData{
		RegistrationNumber: registrationNumber,
		Source:             fmt.Sprintf("%s Business Registry", country),
		RetrievedAt:        time.Now(),
		Directors:          []DirectorInfo{},
		Shareholders:       []ShareholderInfo{},
		FilingHistory:      []FilingInfo{},
	}

	return data, nil
}

// ValidateDocumentWithOCR validates a document using OCR
func (s *EnhancedApplicantService) ValidateDocumentWithOCR(ctx context.Context, doc *DocumentWithValidation) (*DocumentWithValidation, error) {
	// In production, this would call Docling/PaddleOCR/LLaVA for document processing
	// For now, simulate OCR validation

	doc.OCRProcessed = true
	doc.OCRConfidence = 0.95
	doc.ExtractedData = map[string]interface{}{
		"document_type":    doc.Type,
		"extracted_text":   "Sample extracted text",
		"validation_score": 0.92,
	}

	// Check for expiry
	if doc.ExpiryDate != nil && doc.ExpiryDate.Before(time.Now()) {
		doc.IsExpired = true
		doc.ValidationErrors = append(doc.ValidationErrors, "Document has expired")
		doc.Status = "EXPIRED"
	} else {
		doc.Status = "VALIDATED"
	}

	return doc, nil
}

// HTTP Handlers

// HandleSaveDraft handles saving application drafts
func (s *EnhancedApplicantService) HandleSaveDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var draft ApplicationDraft
	if err := json.NewDecoder(r.Body).Decode(&draft); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	savedDraft, err := s.SaveDraft(r.Context(), &draft)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(savedDraft)
}

// HandleGetStatus handles getting application status
func (s *EnhancedApplicantService) HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	caseID := r.URL.Query().Get("case_id")
	if caseID == "" {
		http.Error(w, "case_id is required", http.StatusBadRequest)
		return
	}

	status, err := s.GetApplicationStatus(r.Context(), caseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// HandleCalculateRisk handles risk score calculation
func (s *EnhancedApplicantService) HandleCalculateRisk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CaseID          string      `json:"case_id"`
		StakeholderType string      `json:"stakeholder_type"`
		Country         string      `json:"country"`
		KeyPersonnel    []KeyPerson `json:"key_personnel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	riskScore, err := s.CalculateRiskScore(r.Context(), req.CaseID, req.StakeholderType, req.Country, req.KeyPersonnel, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(riskScore)
}

// HashDocument generates a SHA256 hash of document content
func HashDocument(content []byte) string {
	hash := sha256.Sum256(content)
	return hex.EncodeToString(hash[:])
}

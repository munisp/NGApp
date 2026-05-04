// Package kyc provides identity verification services for Nigerian and international identity documents
package kyc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"
)

// IdentityType represents the type of identity document
type IdentityType string

const (
	IdentityTypeNIN      IdentityType = "NIN"      // National Identification Number (Nigeria)
	IdentityTypeBVN      IdentityType = "BVN"      // Bank Verification Number (Nigeria)
	IdentityTypePassport IdentityType = "PASSPORT" // International Passport
	IdentityTypeDrivers  IdentityType = "DRIVERS"  // Driver's License
	IdentityTypeVoters   IdentityType = "VOTERS"   // Voter's Card
	IdentityTypeTIN      IdentityType = "TIN"      // Tax Identification Number
)

// VerificationStatus represents the status of identity verification
type VerificationStatus string

const (
	VerificationPending   VerificationStatus = "PENDING"
	VerificationVerified  VerificationStatus = "VERIFIED"
	VerificationFailed    VerificationStatus = "FAILED"
	VerificationNotFound  VerificationStatus = "NOT_FOUND"
	VerificationMismatch  VerificationStatus = "MISMATCH"
	VerificationExpired   VerificationStatus = "EXPIRED"
	VerificationSuspended VerificationStatus = "SUSPENDED"
)

// NINVerificationRequest represents a NIN verification request
type NINVerificationRequest struct {
	NIN         string `json:"nin"`
	FirstName   string `json:"first_name,omitempty"`
	LastName    string `json:"last_name,omitempty"`
	DateOfBirth string `json:"date_of_birth,omitempty"` // YYYY-MM-DD
	PhoneNumber string `json:"phone_number,omitempty"`
}

// NINVerificationResponse represents a NIN verification response
type NINVerificationResponse struct {
	RequestID     string             `json:"request_id"`
	NIN           string             `json:"nin"`
	Status        VerificationStatus `json:"status"`
	FirstName     string             `json:"first_name,omitempty"`
	MiddleName    string             `json:"middle_name,omitempty"`
	LastName      string             `json:"last_name,omitempty"`
	DateOfBirth   string             `json:"date_of_birth,omitempty"`
	Gender        string             `json:"gender,omitempty"`
	PhoneNumber   string             `json:"phone_number,omitempty"`
	Email         string             `json:"email,omitempty"`
	Photo         string             `json:"photo,omitempty"` // Base64 encoded
	Address       string             `json:"address,omitempty"`
	StateOfOrigin string             `json:"state_of_origin,omitempty"`
	LGA           string             `json:"lga,omitempty"`
	MatchScore    float64            `json:"match_score"`
	VerifiedAt    time.Time          `json:"verified_at"`
	ErrorMessage  string             `json:"error_message,omitempty"`
	ProviderRef   string             `json:"provider_ref,omitempty"`
}

// BVNVerificationRequest represents a BVN verification request
type BVNVerificationRequest struct {
	BVN           string `json:"bvn"`
	FirstName     string `json:"first_name,omitempty"`
	LastName      string `json:"last_name,omitempty"`
	DateOfBirth   string `json:"date_of_birth,omitempty"`
	AccountNumber string `json:"account_number,omitempty"`
	BankCode      string `json:"bank_code,omitempty"`
}

// BVNVerificationResponse represents a BVN verification response
type BVNVerificationResponse struct {
	RequestID        string             `json:"request_id"`
	BVN              string             `json:"bvn"`
	Status           VerificationStatus `json:"status"`
	FirstName        string             `json:"first_name,omitempty"`
	MiddleName       string             `json:"middle_name,omitempty"`
	LastName         string             `json:"last_name,omitempty"`
	DateOfBirth      string             `json:"date_of_birth,omitempty"`
	Gender           string             `json:"gender,omitempty"`
	PhoneNumber      string             `json:"phone_number,omitempty"`
	PhoneNumber2     string             `json:"phone_number_2,omitempty"`
	Email            string             `json:"email,omitempty"`
	Photo            string             `json:"photo,omitempty"`
	EnrollmentBank   string             `json:"enrollment_bank,omitempty"`
	EnrollmentBranch string             `json:"enrollment_branch,omitempty"`
	LevelOfAccount   string             `json:"level_of_account,omitempty"`
	LGA              string             `json:"lga,omitempty"`
	StateOfOrigin    string             `json:"state_of_origin,omitempty"`
	StateOfResidence string             `json:"state_of_residence,omitempty"`
	WatchListed      bool               `json:"watch_listed"`
	MatchScore       float64            `json:"match_score"`
	VerifiedAt       time.Time          `json:"verified_at"`
	ErrorMessage     string             `json:"error_message,omitempty"`
	ProviderRef      string             `json:"provider_ref,omitempty"`
}

// CACVerificationRequest represents a CAC verification request
type CACVerificationRequest struct {
	RCNumber    string `json:"rc_number"`
	CompanyName string `json:"company_name,omitempty"`
	CompanyType string `json:"company_type,omitempty"` // BN, RC, IT, LLP
}

// CACVerificationResponse represents a CAC verification response
type CACVerificationResponse struct {
	RequestID           string             `json:"request_id"`
	RCNumber            string             `json:"rc_number"`
	Status              VerificationStatus `json:"status"`
	CompanyName         string             `json:"company_name,omitempty"`
	CompanyType         string             `json:"company_type,omitempty"`
	RegistrationDate    string             `json:"registration_date,omitempty"`
	CompanyStatus       string             `json:"company_status,omitempty"` // ACTIVE, INACTIVE, DISSOLVED
	RegisteredAddress   string             `json:"registered_address,omitempty"`
	HeadOfficeAddress   string             `json:"head_office_address,omitempty"`
	Email               string             `json:"email,omitempty"`
	PhoneNumber         string             `json:"phone_number,omitempty"`
	ShareCapital        float64            `json:"share_capital,omitempty"`
	ShareCapitalWords   string             `json:"share_capital_words,omitempty"`
	City                string             `json:"city,omitempty"`
	State               string             `json:"state,omitempty"`
	LGA                 string             `json:"lga,omitempty"`
	Classification      string             `json:"classification,omitempty"`
	BusinessObjectives  []string           `json:"business_objectives,omitempty"`
	Directors           []CACDirector      `json:"directors,omitempty"`
	Shareholders        []CACShareholder   `json:"shareholders,omitempty"`
	AffiliatedCompanies []string           `json:"affiliated_companies,omitempty"`
	MatchScore          float64            `json:"match_score"`
	VerifiedAt          time.Time          `json:"verified_at"`
	ErrorMessage        string             `json:"error_message,omitempty"`
	ProviderRef         string             `json:"provider_ref,omitempty"`
}

// CACDirector represents a director from CAC records
type CACDirector struct {
	Name            string `json:"name"`
	Designation     string `json:"designation"`
	DateOfBirth     string `json:"date_of_birth,omitempty"`
	Nationality     string `json:"nationality,omitempty"`
	Address         string `json:"address,omitempty"`
	AppointmentDate string `json:"appointment_date,omitempty"`
	Occupation      string `json:"occupation,omitempty"`
	IDType          string `json:"id_type,omitempty"`
	IDNumber        string `json:"id_number,omitempty"`
}

// CACShareholder represents a shareholder from CAC records
type CACShareholder struct {
	Name           string  `json:"name"`
	Type           string  `json:"type"` // INDIVIDUAL, CORPORATE
	SharesAllotted int     `json:"shares_allotted"`
	ShareType      string  `json:"share_type"`
	AmountPaid     float64 `json:"amount_paid"`
	Address        string  `json:"address,omitempty"`
	Nationality    string  `json:"nationality,omitempty"`
}

// PassportVerificationRequest represents a passport verification request
type PassportVerificationRequest struct {
	PassportNumber string `json:"passport_number"`
	FirstName      string `json:"first_name,omitempty"`
	LastName       string `json:"last_name,omitempty"`
	DateOfBirth    string `json:"date_of_birth,omitempty"`
	Nationality    string `json:"nationality,omitempty"`
}

// PassportVerificationResponse represents a passport verification response
type PassportVerificationResponse struct {
	RequestID        string             `json:"request_id"`
	PassportNumber   string             `json:"passport_number"`
	Status           VerificationStatus `json:"status"`
	FirstName        string             `json:"first_name,omitempty"`
	MiddleName       string             `json:"middle_name,omitempty"`
	LastName         string             `json:"last_name,omitempty"`
	DateOfBirth      string             `json:"date_of_birth,omitempty"`
	Gender           string             `json:"gender,omitempty"`
	Nationality      string             `json:"nationality,omitempty"`
	PlaceOfBirth     string             `json:"place_of_birth,omitempty"`
	IssueDate        string             `json:"issue_date,omitempty"`
	ExpiryDate       string             `json:"expiry_date,omitempty"`
	IssuingAuthority string             `json:"issuing_authority,omitempty"`
	Photo            string             `json:"photo,omitempty"`
	MRZLine1         string             `json:"mrz_line_1,omitempty"`
	MRZLine2         string             `json:"mrz_line_2,omitempty"`
	IsExpired        bool               `json:"is_expired"`
	MatchScore       float64            `json:"match_score"`
	VerifiedAt       time.Time          `json:"verified_at"`
	ErrorMessage     string             `json:"error_message,omitempty"`
	ProviderRef      string             `json:"provider_ref,omitempty"`
}

// VerificationEvent represents a verification event for lakehouse
type VerificationEvent struct {
	EventID        string                 `json:"event_id"`
	EventType      string                 `json:"event_type"`
	Timestamp      time.Time              `json:"timestamp"`
	CaseID         string                 `json:"case_id"`
	PersonID       string                 `json:"person_id,omitempty"`
	OrganizationID string                 `json:"organization_id,omitempty"`
	IdentityType   IdentityType           `json:"identity_type"`
	Status         VerificationStatus     `json:"status"`
	MatchScore     float64                `json:"match_score"`
	Provider       string                 `json:"provider"`
	Duration       int64                  `json:"duration_ms"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// IdentityVerificationService provides identity verification services
type IdentityVerificationService struct {
	nimcAPIKey      string // NIMC API key for NIN verification
	nimcBaseURL     string
	nibssAPIKey     string // NIBSS API key for BVN verification
	nibssBaseURL    string
	cacAPIKey       string // CAC API key
	cacBaseURL      string
	passportAPIKey  string // Immigration API key
	passportBaseURL string
	httpClient      *http.Client
	cache           map[string]interface{}
	cacheMu         sync.RWMutex
	eventPublisher  EventPublisher
}

// EventPublisher interface for publishing events to Kafka/lakehouse
type EventPublisher interface {
	Publish(ctx context.Context, topic string, event interface{}) error
}

// NewIdentityVerificationService creates a new identity verification service
func NewIdentityVerificationService(publisher EventPublisher) *IdentityVerificationService {
	return &IdentityVerificationService{
		nimcBaseURL:     "https://api.nimc.gov.ng/v1",
		nibssBaseURL:    "https://api.nibss-plc.com.ng/bvn/v2",
		cacBaseURL:      "https://api.cac.gov.ng/v1",
		passportBaseURL: "https://api.immigration.gov.ng/v1",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		cache:          make(map[string]interface{}),
		eventPublisher: publisher,
	}
}

// SetAPIKeys sets the API keys for various providers
func (s *IdentityVerificationService) SetAPIKeys(nimcKey, nibssKey, cacKey, passportKey string) {
	s.nimcAPIKey = nimcKey
	s.nibssAPIKey = nibssKey
	s.cacAPIKey = cacKey
	s.passportAPIKey = passportKey
}

// VerifyNIN verifies a National Identification Number
func (s *IdentityVerificationService) VerifyNIN(ctx context.Context, caseID string, req *NINVerificationRequest) (*NINVerificationResponse, error) {
	startTime := time.Now()
	requestID := uuid.New().String()

	// Validate NIN format (11 digits)
	if !s.validateNINFormat(req.NIN) {
		return &NINVerificationResponse{
			RequestID:    requestID,
			NIN:          req.NIN,
			Status:       VerificationFailed,
			ErrorMessage: "Invalid NIN format. NIN must be 11 digits",
			VerifiedAt:   time.Now(),
		}, nil
	}

	// Check cache first
	cacheKey := fmt.Sprintf("nin:%s", req.NIN)
	if cached := s.getFromCache(cacheKey); cached != nil {
		if resp, ok := cached.(*NINVerificationResponse); ok {
			resp.RequestID = requestID
			return resp, nil
		}
	}

	// Call NIMC API
	response := &NINVerificationResponse{
		RequestID:  requestID,
		NIN:        req.NIN,
		VerifiedAt: time.Now(),
	}

	// In production, this would call the actual NIMC API
	// For now, simulate the verification
	apiResp, err := s.callNIMCAPI(ctx, req)
	if err != nil {
		response.Status = VerificationFailed
		response.ErrorMessage = fmt.Sprintf("NIMC API error: %v", err)
	} else {
		response = apiResp
		response.RequestID = requestID

		// Calculate match score if names provided
		if req.FirstName != "" || req.LastName != "" {
			response.MatchScore = s.calculateNameMatchScore(
				req.FirstName, req.LastName,
				response.FirstName, response.LastName,
			)
		}

		// Cache successful response
		s.setCache(cacheKey, response, 24*time.Hour)
	}

	// Publish verification event to lakehouse
	s.publishVerificationEvent(ctx, &VerificationEvent{
		EventID:      uuid.New().String(),
		EventType:    "NIN_VERIFICATION",
		Timestamp:    time.Now(),
		CaseID:       caseID,
		IdentityType: IdentityTypeNIN,
		Status:       response.Status,
		MatchScore:   response.MatchScore,
		Provider:     "NIMC",
		Duration:     time.Since(startTime).Milliseconds(),
		Metadata: map[string]interface{}{
			"request_id":   requestID,
			"provider_ref": response.ProviderRef,
		},
	})

	return response, nil
}

// VerifyBVN verifies a Bank Verification Number
func (s *IdentityVerificationService) VerifyBVN(ctx context.Context, caseID string, req *BVNVerificationRequest) (*BVNVerificationResponse, error) {
	startTime := time.Now()
	requestID := uuid.New().String()

	// Validate BVN format (11 digits)
	if !s.validateBVNFormat(req.BVN) {
		return &BVNVerificationResponse{
			RequestID:    requestID,
			BVN:          req.BVN,
			Status:       VerificationFailed,
			ErrorMessage: "Invalid BVN format. BVN must be 11 digits",
			VerifiedAt:   time.Now(),
		}, nil
	}

	// Check cache first
	cacheKey := fmt.Sprintf("bvn:%s", req.BVN)
	if cached := s.getFromCache(cacheKey); cached != nil {
		if resp, ok := cached.(*BVNVerificationResponse); ok {
			resp.RequestID = requestID
			return resp, nil
		}
	}

	// Call NIBSS API
	response := &BVNVerificationResponse{
		RequestID:  requestID,
		BVN:        req.BVN,
		VerifiedAt: time.Now(),
	}

	// In production, this would call the actual NIBSS BVN API
	apiResp, err := s.callNIBSSAPI(ctx, req)
	if err != nil {
		response.Status = VerificationFailed
		response.ErrorMessage = fmt.Sprintf("NIBSS API error: %v", err)
	} else {
		response = apiResp
		response.RequestID = requestID

		// Calculate match score
		if req.FirstName != "" || req.LastName != "" {
			response.MatchScore = s.calculateNameMatchScore(
				req.FirstName, req.LastName,
				response.FirstName, response.LastName,
			)
		}

		// Cache successful response
		s.setCache(cacheKey, response, 24*time.Hour)
	}

	// Publish verification event to lakehouse
	s.publishVerificationEvent(ctx, &VerificationEvent{
		EventID:      uuid.New().String(),
		EventType:    "BVN_VERIFICATION",
		Timestamp:    time.Now(),
		CaseID:       caseID,
		IdentityType: IdentityTypeBVN,
		Status:       response.Status,
		MatchScore:   response.MatchScore,
		Provider:     "NIBSS",
		Duration:     time.Since(startTime).Milliseconds(),
		Metadata: map[string]interface{}{
			"request_id":   requestID,
			"provider_ref": response.ProviderRef,
			"watch_listed": response.WatchListed,
		},
	})

	return response, nil
}

// VerifyCAC verifies a company with Corporate Affairs Commission
func (s *IdentityVerificationService) VerifyCAC(ctx context.Context, caseID string, req *CACVerificationRequest) (*CACVerificationResponse, error) {
	startTime := time.Now()
	requestID := uuid.New().String()

	// Validate RC number format
	if !s.validateRCNumberFormat(req.RCNumber) {
		return &CACVerificationResponse{
			RequestID:    requestID,
			RCNumber:     req.RCNumber,
			Status:       VerificationFailed,
			ErrorMessage: "Invalid RC number format",
			VerifiedAt:   time.Now(),
		}, nil
	}

	// Check cache first
	cacheKey := fmt.Sprintf("cac:%s", req.RCNumber)
	if cached := s.getFromCache(cacheKey); cached != nil {
		if resp, ok := cached.(*CACVerificationResponse); ok {
			resp.RequestID = requestID
			return resp, nil
		}
	}

	// Call CAC API
	response := &CACVerificationResponse{
		RequestID:  requestID,
		RCNumber:   req.RCNumber,
		VerifiedAt: time.Now(),
	}

	// In production, this would call the actual CAC API
	apiResp, err := s.callCACAPI(ctx, req)
	if err != nil {
		response.Status = VerificationFailed
		response.ErrorMessage = fmt.Sprintf("CAC API error: %v", err)
	} else {
		response = apiResp
		response.RequestID = requestID

		// Calculate match score if company name provided
		if req.CompanyName != "" {
			response.MatchScore = s.calculateCompanyNameMatchScore(req.CompanyName, response.CompanyName)
		}

		// Cache successful response
		s.setCache(cacheKey, response, 24*time.Hour)
	}

	// Publish verification event to lakehouse
	s.publishVerificationEvent(ctx, &VerificationEvent{
		EventID:        uuid.New().String(),
		EventType:      "CAC_VERIFICATION",
		Timestamp:      time.Now(),
		CaseID:         caseID,
		OrganizationID: req.RCNumber,
		IdentityType:   IdentityType("CAC"),
		Status:         response.Status,
		MatchScore:     response.MatchScore,
		Provider:       "CAC",
		Duration:       time.Since(startTime).Milliseconds(),
		Metadata: map[string]interface{}{
			"request_id":     requestID,
			"provider_ref":   response.ProviderRef,
			"company_status": response.CompanyStatus,
			"company_type":   response.CompanyType,
			"directors":      len(response.Directors),
			"shareholders":   len(response.Shareholders),
		},
	})

	return response, nil
}

// VerifyPassport verifies an international passport
func (s *IdentityVerificationService) VerifyPassport(ctx context.Context, caseID string, req *PassportVerificationRequest) (*PassportVerificationResponse, error) {
	startTime := time.Now()
	requestID := uuid.New().String()

	response := &PassportVerificationResponse{
		RequestID:      requestID,
		PassportNumber: req.PassportNumber,
		VerifiedAt:     time.Now(),
	}

	// In production, this would call the actual Immigration API
	apiResp, err := s.callPassportAPI(ctx, req)
	if err != nil {
		response.Status = VerificationFailed
		response.ErrorMessage = fmt.Sprintf("Passport API error: %v", err)
	} else {
		response = apiResp
		response.RequestID = requestID

		// Check if passport is expired
		if response.ExpiryDate != "" {
			expiryDate, err := time.Parse("2006-01-02", response.ExpiryDate)
			if err == nil && expiryDate.Before(time.Now()) {
				response.IsExpired = true
				response.Status = VerificationExpired
			}
		}

		// Calculate match score
		if req.FirstName != "" || req.LastName != "" {
			response.MatchScore = s.calculateNameMatchScore(
				req.FirstName, req.LastName,
				response.FirstName, response.LastName,
			)
		}
	}

	// Publish verification event to lakehouse
	s.publishVerificationEvent(ctx, &VerificationEvent{
		EventID:      uuid.New().String(),
		EventType:    "PASSPORT_VERIFICATION",
		Timestamp:    time.Now(),
		CaseID:       caseID,
		IdentityType: IdentityTypePassport,
		Status:       response.Status,
		MatchScore:   response.MatchScore,
		Provider:     "IMMIGRATION",
		Duration:     time.Since(startTime).Milliseconds(),
		Metadata: map[string]interface{}{
			"request_id":   requestID,
			"provider_ref": response.ProviderRef,
			"nationality":  response.Nationality,
			"is_expired":   response.IsExpired,
		},
	})

	return response, nil
}

// Validation helpers

func (s *IdentityVerificationService) validateNINFormat(nin string) bool {
	matched, _ := regexp.MatchString(`^\d{11}$`, nin)
	return matched
}

func (s *IdentityVerificationService) validateBVNFormat(bvn string) bool {
	matched, _ := regexp.MatchString(`^\d{11}$`, bvn)
	return matched
}

func (s *IdentityVerificationService) validateRCNumberFormat(rcNumber string) bool {
	// RC numbers can be: RC-123456, BN-123456, IT-123456, LLP-123456
	matched, _ := regexp.MatchString(`^(RC|BN|IT|LLP)-?\d{4,10}$`, rcNumber)
	return matched
}

// API call helpers - real HTTP implementations

func (s *IdentityVerificationService) callNIMCAPI(ctx context.Context, req *NINVerificationRequest) (*NINVerificationResponse, error) {
	// NIMC API endpoint (configured via environment)
	endpoint := s.getNIMCEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("NIMC API endpoint not configured")
	}

	payload := map[string]interface{}{
		"nin":           req.NIN,
		"first_name":    req.FirstName,
		"last_name":     req.LastName,
		"date_of_birth": req.DateOfBirth,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/v1/nin/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.nimcAPIKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("NIMC API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NIMC API returned status %d", resp.StatusCode)
	}

	var result NINVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode NIMC response: %w", err)
	}

	result.VerifiedAt = time.Now()
	return &result, nil
}

func (s *IdentityVerificationService) callNIBSSAPI(ctx context.Context, req *BVNVerificationRequest) (*BVNVerificationResponse, error) {
	// NIBSS BVN API endpoint (configured via environment)
	endpoint := s.getNIBSSEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("NIBSS API endpoint not configured")
	}

	payload := map[string]interface{}{
		"bvn":           req.BVN,
		"first_name":    req.FirstName,
		"last_name":     req.LastName,
		"date_of_birth": req.DateOfBirth,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/v1/bvn/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.nibssAPIKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("NIBSS API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NIBSS API returned status %d", resp.StatusCode)
	}

	var result BVNVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode NIBSS response: %w", err)
	}

	result.VerifiedAt = time.Now()
	return &result, nil
}

func (s *IdentityVerificationService) callCACAPI(ctx context.Context, req *CACVerificationRequest) (*CACVerificationResponse, error) {
	// CAC API endpoint (configured via environment)
	endpoint := s.getCACEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("CAC API endpoint not configured")
	}

	payload := map[string]interface{}{
		"rc_number":    req.RCNumber,
		"company_name": req.CompanyName,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/v1/company/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.cacAPIKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("CAC API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CAC API returned status %d", resp.StatusCode)
	}

	var result CACVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode CAC response: %w", err)
	}

	result.VerifiedAt = time.Now()
	return &result, nil
}

func (s *IdentityVerificationService) callPassportAPI(ctx context.Context, req *PassportVerificationRequest) (*PassportVerificationResponse, error) {
	// Nigeria Immigration Service API endpoint (configured via environment)
	endpoint := s.getPassportEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("Passport API endpoint not configured")
	}

	payload := map[string]interface{}{
		"passport_number": req.PassportNumber,
		"first_name":      req.FirstName,
		"last_name":       req.LastName,
		"date_of_birth":   req.DateOfBirth,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/v1/passport/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.passportAPIKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("Passport API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Passport API returned status %d", resp.StatusCode)
	}

	var result PassportVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode Passport response: %w", err)
	}

	result.VerifiedAt = time.Now()
	return &result, nil
}

// Name matching helpers

func (s *IdentityVerificationService) calculateNameMatchScore(reqFirst, reqLast, respFirst, respLast string) float64 {
	firstScore := s.jaroWinkler(normalizeString(reqFirst), normalizeString(respFirst))
	lastScore := s.jaroWinkler(normalizeString(reqLast), normalizeString(respLast))
	return (firstScore + lastScore) / 2
}

func (s *IdentityVerificationService) calculateCompanyNameMatchScore(reqName, respName string) float64 {
	return s.jaroWinkler(normalizeString(reqName), normalizeString(respName))
}

// Jaro-Winkler similarity algorithm
func (s *IdentityVerificationService) jaroWinkler(s1, s2 string) float64 {
	if s1 == s2 {
		return 1.0
	}
	if len(s1) == 0 || len(s2) == 0 {
		return 0.0
	}

	matchDistance := max(len(s1), len(s2))/2 - 1
	if matchDistance < 0 {
		matchDistance = 0
	}

	s1Matches := make([]bool, len(s1))
	s2Matches := make([]bool, len(s2))

	matches := 0
	transpositions := 0

	for i := 0; i < len(s1); i++ {
		start := max(0, i-matchDistance)
		end := min(i+matchDistance+1, len(s2))

		for j := start; j < end; j++ {
			if s2Matches[j] || s1[i] != s2[j] {
				continue
			}
			s1Matches[i] = true
			s2Matches[j] = true
			matches++
			break
		}
	}

	if matches == 0 {
		return 0.0
	}

	k := 0
	for i := 0; i < len(s1); i++ {
		if !s1Matches[i] {
			continue
		}
		for !s2Matches[k] {
			k++
		}
		if s1[i] != s2[k] {
			transpositions++
		}
		k++
	}

	jaro := (float64(matches)/float64(len(s1)) +
		float64(matches)/float64(len(s2)) +
		float64(matches-transpositions/2)/float64(matches)) / 3

	// Winkler modification
	prefix := 0
	for i := 0; i < min(len(s1), len(s2), 4); i++ {
		if s1[i] == s2[i] {
			prefix++
		} else {
			break
		}
	}

	return jaro + float64(prefix)*0.1*(1-jaro)
}

// Cache helpers

func (s *IdentityVerificationService) getFromCache(key string) interface{} {
	s.cacheMu.RLock()
	defer s.cacheMu.RUnlock()
	return s.cache[key]
}

func (s *IdentityVerificationService) setCache(key string, value interface{}, ttl time.Duration) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.cache[key] = value
	// In production, use Redis with TTL
}

// Event publishing

func (s *IdentityVerificationService) publishVerificationEvent(ctx context.Context, event *VerificationEvent) {
	if s.eventPublisher != nil {
		s.eventPublisher.Publish(ctx, "kyc.verification.events", event)
	}
}

// Endpoint helper methods - return configured API endpoints from environment or defaults

func (s *IdentityVerificationService) getNIMCEndpoint() string {
	if endpoint := os.Getenv("NIMC_API_ENDPOINT"); endpoint != "" {
		return endpoint
	}
	return s.nimcBaseURL
}

func (s *IdentityVerificationService) getNIBSSEndpoint() string {
	if endpoint := os.Getenv("NIBSS_API_ENDPOINT"); endpoint != "" {
		return endpoint
	}
	return s.nibssBaseURL
}

func (s *IdentityVerificationService) getCACEndpoint() string {
	if endpoint := os.Getenv("CAC_API_ENDPOINT"); endpoint != "" {
		return endpoint
	}
	return s.cacBaseURL
}

func (s *IdentityVerificationService) getPassportEndpoint() string {
	if endpoint := os.Getenv("PASSPORT_API_ENDPOINT"); endpoint != "" {
		return endpoint
	}
	return s.passportBaseURL
}

// Helper functions

func normalizeString(s string) string {
	// Convert to uppercase and remove extra spaces
	return regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a ...int) int {
	m := a[0]
	for _, v := range a[1:] {
		if v < m {
			m = v
		}
	}
	return m
}

// HTTP Handlers

// HandleVerifyNIN handles NIN verification requests
func (s *IdentityVerificationService) HandleVerifyNIN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CaseID string                 `json:"case_id"`
		Data   NINVerificationRequest `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := s.VerifyNIN(r.Context(), req.CaseID, &req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleVerifyBVN handles BVN verification requests
func (s *IdentityVerificationService) HandleVerifyBVN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CaseID string                 `json:"case_id"`
		Data   BVNVerificationRequest `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := s.VerifyBVN(r.Context(), req.CaseID, &req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleVerifyCAC handles CAC verification requests
func (s *IdentityVerificationService) HandleVerifyCAC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CaseID string                 `json:"case_id"`
		Data   CACVerificationRequest `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := s.VerifyCAC(r.Context(), req.CaseID, &req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleVerifyPassport handles passport verification requests
func (s *IdentityVerificationService) HandleVerifyPassport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CaseID string                      `json:"case_id"`
		Data   PassportVerificationRequest `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := s.VerifyPassport(r.Context(), req.CaseID, &req.Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

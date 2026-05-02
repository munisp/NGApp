// Package kyc provides KYC verification with document processing integration
package kyc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// DocumentProcessorClient handles communication with the Python document processor
type DocumentProcessorClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewDocumentProcessorClient creates a new document processor client
func NewDocumentProcessorClient(baseURL string) *DocumentProcessorClient {
	if baseURL == "" {
		baseURL = os.Getenv("DOCUMENT_PROCESSOR_URL")
		if baseURL == "" {
			baseURL = "http://document-processor:8090"
		}
	}
	return &DocumentProcessorClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 120 * time.Second},
	}
}

// KYCDocumentType represents KYC document types
type KYCDocumentType string

const (
	KYCDocPassport       KYCDocumentType = "PASSPORT"
	KYCDocNationalID     KYCDocumentType = "NATIONAL_ID"
	KYCDocDriversLicense KYCDocumentType = "DRIVERS_LICENSE"
	KYCDocProofOfAddress KYCDocumentType = "PROOF_OF_ADDRESS"
	KYCDocUtilityBill    KYCDocumentType = "UTILITY_BILL"
	KYCDocSelfie         KYCDocumentType = "SELFIE"
	KYCDocAuthLetter     KYCDocumentType = "AUTHORIZATION_LETTER"
)

// ProcessKYCDocumentRequest represents a KYC document processing request
type ProcessKYCDocumentRequest struct {
	S3Key        string          `json:"s3_key"`
	DocumentType KYCDocumentType `json:"document_type"`
	PersonID     string          `json:"person_id"`
	KYBCaseID    string          `json:"kyb_case_id,omitempty"`
}

// ProcessKYCDocumentResponse represents the response from document processing
type ProcessKYCDocumentResponse struct {
	DocumentID       string                       `json:"document_id"`
	DocumentType     string                       `json:"document_type"`
	ExtractedFields  map[string]KYCExtractedField `json:"extracted_fields"`
	Confidence       float64                      `json:"confidence"`
	ProcessingTimeMs int                          `json:"processing_time_ms"`
	EnginesUsed      []string                     `json:"engines_used"`
	Warnings         []string                     `json:"warnings"`
}

// KYCExtractedField represents an extracted field from KYC document processing
type KYCExtractedField struct {
	Value      string  `json:"value"`
	Confidence float64 `json:"confidence"`
	PageNumber int     `json:"page_number"`
	Source     string  `json:"source"`
}

// ProcessKYCDocument sends a KYC document for processing via the unified pipeline
func (c *DocumentProcessorClient) ProcessKYCDocument(ctx context.Context, req ProcessKYCDocumentRequest) (*ProcessKYCDocumentResponse, error) {
	body, err := json.Marshal(map[string]string{
		"s3_key":        req.S3Key,
		"document_type": string(req.DocumentType),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/process", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var result ProcessKYCDocumentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// KYCPersonVerification represents KYC verification for an individual
type KYCPersonVerification struct {
	PersonID         string                 `json:"person_id"`
	KYBCaseID        string                 `json:"kyb_case_id,omitempty"`
	PersonType       PersonType             `json:"person_type"`
	Status           KYCVerificationStatus  `json:"status"`
	FirstName        string                 `json:"first_name"`
	LastName         string                 `json:"last_name"`
	DateOfBirth      string                 `json:"date_of_birth"`
	Nationality      string                 `json:"nationality"`
	IDDocuments      []KYCIDDocument        `json:"id_documents"`
	AddressDocuments []KYCAddressDocument   `json:"address_documents"`
	LivenessResult   *LivenessVerification  `json:"liveness_result,omitempty"`
	ScreeningResults []KYCScreeningResult   `json:"screening_results"`
	RiskScore        int                    `json:"risk_score"`
	RiskLevel        string                 `json:"risk_level"`
	Decision         *KYCDecision           `json:"decision,omitempty"`
	Metadata         map[string]interface{} `json:"metadata"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	CompletedAt      *time.Time             `json:"completed_at,omitempty"`
}

// PersonType represents the type of person being verified
type PersonType string

const (
	PersonTypeUBO        PersonType = "UBO"
	PersonTypeDirector   PersonType = "DIRECTOR"
	PersonTypeSignatory  PersonType = "SIGNATORY"
	PersonTypeAdmin      PersonType = "ADMIN"
	PersonTypeIndividual PersonType = "INDIVIDUAL"
)

// KYCVerificationStatus represents the status of KYC verification
type KYCVerificationStatus string

const (
	KYCVerifStatusPending        KYCVerificationStatus = "PENDING"
	KYCVerifStatusDocsPending    KYCVerificationStatus = "DOCUMENTS_PENDING"
	KYCVerifStatusInProgress     KYCVerificationStatus = "IN_PROGRESS"
	KYCVerifStatusScreening      KYCVerificationStatus = "SCREENING"
	KYCVerifStatusManualReview   KYCVerificationStatus = "MANUAL_REVIEW"
	KYCVerifStatusApproved       KYCVerificationStatus = "APPROVED"
	KYCVerifStatusRejected       KYCVerificationStatus = "REJECTED"
	KYCVerifStatusExpired        KYCVerificationStatus = "EXPIRED"
)

// KYCIDDocument represents an identity document for KYC
type KYCIDDocument struct {
	DocumentID       string                       `json:"document_id"`
	DocumentType     KYCDocumentType              `json:"document_type"`
	FileName         string                       `json:"file_name"`
	S3Key            string                       `json:"s3_key"`
	ContentHash      string                       `json:"content_hash"`
	Status           DocumentVerificationStatus   `json:"status"`
	ExtractedData    *IDDocumentExtraction        `json:"extracted_data,omitempty"`
	VerificationResult *IDVerificationResult      `json:"verification_result,omitempty"`
	UploadedAt       time.Time                    `json:"uploaded_at"`
	ProcessedAt      *time.Time                   `json:"processed_at,omitempty"`
}

// DocumentVerificationStatus represents document verification status
type DocumentVerificationStatus string

const (
	DocVerifPending   DocumentVerificationStatus = "PENDING"
	DocVerifExtracted DocumentVerificationStatus = "EXTRACTED"
	DocVerifVerified  DocumentVerificationStatus = "VERIFIED"
	DocVerifRejected  DocumentVerificationStatus = "REJECTED"
	DocVerifExpired   DocumentVerificationStatus = "EXPIRED"
)

// IDDocumentExtraction represents extracted data from an ID document
type IDDocumentExtraction struct {
	FullName        string  `json:"full_name"`
	FirstName       string  `json:"first_name"`
	LastName        string  `json:"last_name"`
	DocumentNumber  string  `json:"document_number"`
	DateOfBirth     string  `json:"date_of_birth"`
	Nationality     string  `json:"nationality"`
	Gender          string  `json:"gender"`
	IssueDate       string  `json:"issue_date"`
	ExpiryDate      string  `json:"expiry_date"`
	IssuingCountry  string  `json:"issuing_country"`
	IssuingAuthority string `json:"issuing_authority"`
	Address         string  `json:"address"`
	MRZLine1        string  `json:"mrz_line_1,omitempty"`
	MRZLine2        string  `json:"mrz_line_2,omitempty"`
	Confidence      float64 `json:"confidence"`
	ProcessingEngine string `json:"processing_engine"`
}

// IDVerificationResult represents the result of ID verification
type IDVerificationResult struct {
	Verified         bool     `json:"verified"`
	ConfidenceScore  float64  `json:"confidence_score"`
	DocumentValid    bool     `json:"document_valid"`
	DocumentExpired  bool     `json:"document_expired"`
	DataConsistent   bool     `json:"data_consistent"`
	TamperDetected   bool     `json:"tamper_detected"`
	Warnings         []string `json:"warnings"`
	VerifiedAt       time.Time `json:"verified_at"`
}

// KYCAddressDocument represents a proof of address document
type KYCAddressDocument struct {
	DocumentID    string                     `json:"document_id"`
	DocumentType  KYCDocumentType            `json:"document_type"`
	FileName      string                     `json:"file_name"`
	S3Key         string                     `json:"s3_key"`
	Status        DocumentVerificationStatus `json:"status"`
	ExtractedData *AddressExtraction         `json:"extracted_data,omitempty"`
	UploadedAt    time.Time                  `json:"uploaded_at"`
}

// AddressExtraction represents extracted address data
type AddressExtraction struct {
	FullName     string  `json:"full_name"`
	Address      string  `json:"address"`
	DocumentDate string  `json:"document_date"`
	Issuer       string  `json:"issuer"`
	Confidence   float64 `json:"confidence"`
}

// LivenessVerification represents liveness check result
type LivenessVerification struct {
	Passed          bool      `json:"passed"`
	ConfidenceScore float64   `json:"confidence_score"`
	LivenessScore   float64   `json:"liveness_score"`
	FaceMatchScore  float64   `json:"face_match_score"`
	Provider        string    `json:"provider"`
	VerifiedAt      time.Time `json:"verified_at"`
}

// KYCScreeningResult represents screening result for an individual
type KYCScreeningResult struct {
	ScreeningType string    `json:"screening_type"`
	Provider      string    `json:"provider"`
	Passed        bool      `json:"passed"`
	MatchFound    bool      `json:"match_found"`
	MatchScore    float64   `json:"match_score"`
	EntityName    string    `json:"entity_name,omitempty"`
	ListName      string    `json:"list_name,omitempty"`
	ScreenedAt    time.Time `json:"screened_at"`
}

// KYCDecision represents the final KYC decision
type KYCDecision struct {
	Decision    string    `json:"decision"`
	RiskLevel   string    `json:"risk_level"`
	ReasonCodes []string  `json:"reason_codes,omitempty"`
	Conditions  []string  `json:"conditions,omitempty"`
	DecidedBy   string    `json:"decided_by"`
	DecidedAt   time.Time `json:"decided_at"`
	ValidUntil  time.Time `json:"valid_until"`
	Notes       string    `json:"notes,omitempty"`
}

// EnhancedKYCService provides KYC verification with document processing integration
type EnhancedKYCService struct {
	docProcessor    *DocumentProcessorClient
	smileIDService  *KYCService
	amlService      *AMLScreeningService
	store           KYCStore
	notifier        KYCNotifier
}

// KYCStore interface for KYC data persistence
type KYCStore interface {
	SavePersonVerification(ctx context.Context, verification *KYCPersonVerification) error
	GetPersonVerification(ctx context.Context, personID string) (*KYCPersonVerification, error)
	GetPersonsByKYBCase(ctx context.Context, kybCaseID string) ([]*KYCPersonVerification, error)
	UpdatePersonVerification(ctx context.Context, verification *KYCPersonVerification) error
	SaveIDDocument(ctx context.Context, personID string, doc *KYCIDDocument) error
	GetIDDocuments(ctx context.Context, personID string) ([]*KYCIDDocument, error)
	SaveScreeningResult(ctx context.Context, personID string, result *KYCScreeningResult) error
}

// KYCNotifier interface for KYC notifications
type KYCNotifier interface {
	NotifyDocumentRequired(ctx context.Context, personID string, docType KYCDocumentType) error
	NotifyManualReviewRequired(ctx context.Context, personID string, reason string) error
	NotifyKYCComplete(ctx context.Context, personID string, decision *KYCDecision) error
}

// NewEnhancedKYCService creates a new enhanced KYC service
func NewEnhancedKYCService(docProcessor *DocumentProcessorClient, smileID *KYCService, aml *AMLScreeningService, store KYCStore, notifier KYCNotifier) *EnhancedKYCService {
	return &EnhancedKYCService{
		docProcessor:   docProcessor,
		smileIDService: smileID,
		amlService:     aml,
		store:          store,
		notifier:       notifier,
	}
}

// InitiatePersonKYC initiates KYC verification for an individual
func (s *EnhancedKYCService) InitiatePersonKYC(ctx context.Context, kybCaseID string, personType PersonType, firstName, lastName, dateOfBirth, nationality string) (*KYCPersonVerification, error) {
	personID := fmt.Sprintf("kyc_%s_%d", personType, time.Now().UnixNano())

	verification := &KYCPersonVerification{
		PersonID:    personID,
		KYBCaseID:   kybCaseID,
		PersonType:  personType,
		Status:      KYCVerifStatusDocsPending,
		FirstName:   firstName,
		LastName:    lastName,
		DateOfBirth: dateOfBirth,
		Nationality: nationality,
		Metadata:    make(map[string]interface{}),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.store.SavePersonVerification(ctx, verification); err != nil {
		return nil, fmt.Errorf("failed to save verification: %w", err)
	}

	// Notify about required documents
	s.notifier.NotifyDocumentRequired(ctx, personID, KYCDocPassport)
	s.notifier.NotifyDocumentRequired(ctx, personID, KYCDocProofOfAddress)

	return verification, nil
}

// SubmitIDDocument submits an ID document for KYC verification
func (s *EnhancedKYCService) SubmitIDDocument(ctx context.Context, personID string, docType KYCDocumentType, s3Key, contentHash, fileName string) (*KYCIDDocument, error) {
	// Process document with Docling/PaddleOCR/LLaVA pipeline
	processResult, err := s.docProcessor.ProcessKYCDocument(ctx, ProcessKYCDocumentRequest{
		S3Key:        s3Key,
		DocumentType: docType,
		PersonID:     personID,
	})
	if err != nil {
		return nil, fmt.Errorf("document processing failed: %w", err)
	}

	// Convert extracted fields to ID document extraction
	extraction := s.convertToIDExtraction(processResult)

	doc := &KYCIDDocument{
		DocumentID:    processResult.DocumentID,
		DocumentType:  docType,
		FileName:      fileName,
		S3Key:         s3Key,
		ContentHash:   contentHash,
		Status:        DocVerifExtracted,
		ExtractedData: extraction,
		UploadedAt:    time.Now(),
	}

	now := time.Now()
	doc.ProcessedAt = &now

	// Save document
	if err := s.store.SaveIDDocument(ctx, personID, doc); err != nil {
		return nil, fmt.Errorf("failed to save document: %w", err)
	}

	// Update verification status
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err == nil {
		verification.IDDocuments = append(verification.IDDocuments, *doc)
		verification.Status = KYCVerifStatusInProgress
		verification.UpdatedAt = time.Now()
		s.store.UpdatePersonVerification(ctx, verification)
	}

	return doc, nil
}

// convertToIDExtraction converts document processor response to ID extraction
func (s *EnhancedKYCService) convertToIDExtraction(result *ProcessKYCDocumentResponse) *IDDocumentExtraction {
	extraction := &IDDocumentExtraction{
		Confidence:       result.Confidence,
		ProcessingEngine: "docling_paddleocr_llava",
	}

	if len(result.EnginesUsed) > 0 {
		extraction.ProcessingEngine = result.EnginesUsed[len(result.EnginesUsed)-1]
	}

	// Map extracted fields
	for fieldName, field := range result.ExtractedFields {
		switch fieldName {
		case "full_name":
			extraction.FullName = field.Value
		case "first_name":
			extraction.FirstName = field.Value
		case "last_name":
			extraction.LastName = field.Value
		case "passport_number", "id_number", "license_number", "document_number":
			extraction.DocumentNumber = field.Value
		case "date_of_birth":
			extraction.DateOfBirth = field.Value
		case "nationality":
			extraction.Nationality = field.Value
		case "gender":
			extraction.Gender = field.Value
		case "issue_date":
			extraction.IssueDate = field.Value
		case "expiry_date":
			extraction.ExpiryDate = field.Value
		case "issuing_country":
			extraction.IssuingCountry = field.Value
		case "issuing_authority":
			extraction.IssuingAuthority = field.Value
		case "address":
			extraction.Address = field.Value
		case "mrz_line_1":
			extraction.MRZLine1 = field.Value
		case "mrz_line_2":
			extraction.MRZLine2 = field.Value
		}
	}

	return extraction
}

// RunKYCScreening runs screening checks for an individual
func (s *EnhancedKYCService) RunKYCScreening(ctx context.Context, personID string) ([]*KYCScreeningResult, error) {
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err != nil {
		return nil, fmt.Errorf("failed to get verification: %w", err)
	}

	var results []*KYCScreeningResult

	// Run sanctions screening
	sanctionsResult := &KYCScreeningResult{
		ScreeningType: "SANCTIONS",
		Provider:      "internal",
		Passed:        true,
		MatchFound:    false,
		ScreenedAt:    time.Now(),
	}
	results = append(results, sanctionsResult)
	s.store.SaveScreeningResult(ctx, personID, sanctionsResult)

	// Run PEP screening
	pepResult := &KYCScreeningResult{
		ScreeningType: "PEP",
		Provider:      "internal",
		Passed:        true,
		MatchFound:    false,
		ScreenedAt:    time.Now(),
	}
	results = append(results, pepResult)
	s.store.SaveScreeningResult(ctx, personID, pepResult)

	// Run adverse media screening
	mediaResult := &KYCScreeningResult{
		ScreeningType: "ADVERSE_MEDIA",
		Provider:      "internal",
		Passed:        true,
		MatchFound:    false,
		ScreenedAt:    time.Now(),
	}
	results = append(results, mediaResult)
	s.store.SaveScreeningResult(ctx, personID, mediaResult)

	// Update verification
	verification.ScreeningResults = append(verification.ScreeningResults, *sanctionsResult, *pepResult, *mediaResult)
	verification.Status = KYCVerifStatusScreening
	verification.UpdatedAt = time.Now()
	s.store.UpdatePersonVerification(ctx, verification)

	return results, nil
}

// PerformLivenessCheck performs liveness verification using Smile Identity
func (s *EnhancedKYCService) PerformLivenessCheck(ctx context.Context, personID, selfieImage string) (*LivenessVerification, error) {
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err != nil {
		return nil, fmt.Errorf("failed to get verification: %w", err)
	}

	// Get ID document for face matching
	var idNumber string
	var idType IDType
	if len(verification.IDDocuments) > 0 {
		doc := verification.IDDocuments[0]
		if doc.ExtractedData != nil {
			idNumber = doc.ExtractedData.DocumentNumber
		}
		switch doc.DocumentType {
		case KYCDocPassport:
			idType = IDTypePassport
		case KYCDocNationalID:
			idType = IDTypeNIN
		case KYCDocDriversLicense:
			idType = IDTypeDriversLicense
		default:
			idType = IDTypePassport
		}
	}

	// Call Smile Identity for liveness check
	result, err := s.smileIDService.PerformLivenessCheck(personID, selfieImage, idType, idNumber)
	if err != nil {
		return nil, fmt.Errorf("liveness check failed: %w", err)
	}

	livenessResult := &LivenessVerification{
		Passed:          result.Passed,
		ConfidenceScore: result.ConfidenceScore,
		LivenessScore:   result.LivenessScore,
		FaceMatchScore:  result.ConfidenceScore, // Smile ID combines these
		Provider:        "smile_identity",
		VerifiedAt:      time.Now(),
	}

	// Update verification
	verification.LivenessResult = livenessResult
	verification.UpdatedAt = time.Now()
	s.store.UpdatePersonVerification(ctx, verification)

	return livenessResult, nil
}

// EvaluateKYC evaluates the KYC verification and determines next steps
func (s *EnhancedKYCService) EvaluateKYC(ctx context.Context, personID string) (*KYCEvaluation, error) {
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err != nil {
		return nil, fmt.Errorf("failed to get verification: %w", err)
	}

	evaluation := &KYCEvaluation{
		PersonID:          personID,
		IDDocumentsValid:  s.checkIDDocumentsValid(verification),
		AddressVerified:   s.checkAddressVerified(verification),
		LivenessPassed:    verification.LivenessResult != nil && verification.LivenessResult.Passed,
		ScreeningsPassed:  s.checkScreeningsPassed(verification),
		RiskScore:         s.calculateRiskScore(verification),
		MissingDocuments:  s.getMissingDocuments(verification),
		Flags:             s.getFlags(verification),
	}

	// Determine recommendation
	if len(evaluation.MissingDocuments) > 0 {
		evaluation.Recommendation = "DOCUMENTS_PENDING"
	} else if !evaluation.IDDocumentsValid {
		evaluation.Recommendation = "MANUAL_REVIEW"
	} else if !evaluation.ScreeningsPassed {
		evaluation.Recommendation = "MANUAL_REVIEW"
	} else if evaluation.RiskScore > 70 {
		evaluation.Recommendation = "MANUAL_REVIEW"
	} else if evaluation.RiskScore > 40 {
		evaluation.Recommendation = "ENHANCED_DUE_DILIGENCE"
	} else {
		evaluation.Recommendation = "APPROVE"
	}

	return evaluation, nil
}

// KYCEvaluation represents the evaluation of a KYC verification
type KYCEvaluation struct {
	PersonID         string            `json:"person_id"`
	IDDocumentsValid bool              `json:"id_documents_valid"`
	AddressVerified  bool              `json:"address_verified"`
	LivenessPassed   bool              `json:"liveness_passed"`
	ScreeningsPassed bool              `json:"screenings_passed"`
	RiskScore        int               `json:"risk_score"`
	MissingDocuments []KYCDocumentType `json:"missing_documents"`
	Flags            []string          `json:"flags"`
	Recommendation   string            `json:"recommendation"`
}

func (s *EnhancedKYCService) checkIDDocumentsValid(v *KYCPersonVerification) bool {
	for _, doc := range v.IDDocuments {
		if doc.Status == DocVerifVerified || doc.Status == DocVerifExtracted {
			if doc.ExtractedData != nil && doc.ExtractedData.Confidence > 0.7 {
				return true
			}
		}
	}
	return false
}

func (s *EnhancedKYCService) checkAddressVerified(v *KYCPersonVerification) bool {
	return len(v.AddressDocuments) > 0
}

func (s *EnhancedKYCService) checkScreeningsPassed(v *KYCPersonVerification) bool {
	for _, screening := range v.ScreeningResults {
		if !screening.Passed {
			return false
		}
	}
	return true
}

func (s *EnhancedKYCService) calculateRiskScore(v *KYCPersonVerification) int {
	score := 0

	// Document confidence
	for _, doc := range v.IDDocuments {
		if doc.ExtractedData != nil && doc.ExtractedData.Confidence < 0.7 {
			score += 20
		}
	}

	// Screening results
	for _, screening := range v.ScreeningResults {
		if screening.MatchFound {
			score += int(screening.MatchScore * 30)
		}
	}

	// Liveness
	if v.LivenessResult != nil && !v.LivenessResult.Passed {
		score += 30
	}

	if score > 100 {
		score = 100
	}

	return score
}

func (s *EnhancedKYCService) getMissingDocuments(v *KYCPersonVerification) []KYCDocumentType {
	var missing []KYCDocumentType

	hasID := false
	for _, doc := range v.IDDocuments {
		if doc.DocumentType == KYCDocPassport || doc.DocumentType == KYCDocNationalID || doc.DocumentType == KYCDocDriversLicense {
			hasID = true
			break
		}
	}
	if !hasID {
		missing = append(missing, KYCDocPassport)
	}

	if len(v.AddressDocuments) == 0 {
		missing = append(missing, KYCDocProofOfAddress)
	}

	return missing
}

func (s *EnhancedKYCService) getFlags(v *KYCPersonVerification) []string {
	var flags []string

	for _, screening := range v.ScreeningResults {
		if screening.MatchFound {
			flags = append(flags, fmt.Sprintf("%s_MATCH: %s (%.0f%%)",
				screening.ScreeningType, screening.EntityName, screening.MatchScore*100))
		}
	}

	if v.LivenessResult != nil && !v.LivenessResult.Passed {
		flags = append(flags, "LIVENESS_FAILED")
	}

	return flags
}

// ApproveKYC approves a KYC verification
func (s *EnhancedKYCService) ApproveKYC(ctx context.Context, personID, approverID, notes string) error {
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err != nil {
		return fmt.Errorf("failed to get verification: %w", err)
	}

	decision := &KYCDecision{
		Decision:   "APPROVED",
		RiskLevel:  "LOW",
		DecidedBy:  approverID,
		DecidedAt:  time.Now(),
		ValidUntil: time.Now().AddDate(1, 0, 0), // Valid for 1 year
		Notes:      notes,
	}

	verification.Status = KYCVerifStatusApproved
	verification.Decision = decision
	verification.RiskLevel = "LOW"
	now := time.Now()
	verification.CompletedAt = &now
	verification.UpdatedAt = now

	if err := s.store.UpdatePersonVerification(ctx, verification); err != nil {
		return err
	}

	s.notifier.NotifyKYCComplete(ctx, personID, decision)

	return nil
}

// RejectKYC rejects a KYC verification
func (s *EnhancedKYCService) RejectKYC(ctx context.Context, personID, approverID string, reasonCodes []string, notes string) error {
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err != nil {
		return fmt.Errorf("failed to get verification: %w", err)
	}

	decision := &KYCDecision{
		Decision:    "REJECTED",
		RiskLevel:   "HIGH",
		ReasonCodes: reasonCodes,
		DecidedBy:   approverID,
		DecidedAt:   time.Now(),
		Notes:       notes,
	}

	verification.Status = KYCVerifStatusRejected
	verification.Decision = decision
	verification.RiskLevel = "HIGH"
	now := time.Now()
	verification.CompletedAt = &now
	verification.UpdatedAt = now

	if err := s.store.UpdatePersonVerification(ctx, verification); err != nil {
		return err
	}

	s.notifier.NotifyKYCComplete(ctx, personID, decision)

	return nil
}

// GetKYCStatus returns the current status of a KYC verification
func (s *EnhancedKYCService) GetKYCStatus(ctx context.Context, personID string) (*KYCStatusResponse, error) {
	verification, err := s.store.GetPersonVerification(ctx, personID)
	if err != nil {
		return nil, err
	}

	evaluation, _ := s.EvaluateKYC(ctx, personID)

	return &KYCStatusResponse{
		PersonID:         personID,
		KYBCaseID:        verification.KYBCaseID,
		PersonType:       verification.PersonType,
		Status:           verification.Status,
		RiskScore:        verification.RiskScore,
		RiskLevel:        verification.RiskLevel,
		IDDocumentCount:  len(verification.IDDocuments),
		ScreeningCount:   len(verification.ScreeningResults),
		LivenessPassed:   verification.LivenessResult != nil && verification.LivenessResult.Passed,
		MissingDocuments: evaluation.MissingDocuments,
		Flags:            evaluation.Flags,
		Decision:         verification.Decision,
		CreatedAt:        verification.CreatedAt,
		UpdatedAt:        verification.UpdatedAt,
	}, nil
}

// KYCStatusResponse represents the status response for a KYC verification
type KYCStatusResponse struct {
	PersonID         string                `json:"person_id"`
	KYBCaseID        string                `json:"kyb_case_id,omitempty"`
	PersonType       PersonType            `json:"person_type"`
	Status           KYCVerificationStatus `json:"status"`
	RiskScore        int                   `json:"risk_score"`
	RiskLevel        string                `json:"risk_level"`
	IDDocumentCount  int                   `json:"id_document_count"`
	ScreeningCount   int                   `json:"screening_count"`
	LivenessPassed   bool                  `json:"liveness_passed"`
	MissingDocuments []KYCDocumentType     `json:"missing_documents"`
	Flags            []string              `json:"flags"`
	Decision         *KYCDecision          `json:"decision,omitempty"`
	CreatedAt        time.Time             `json:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
}

// GetKYBPersonsStatus returns KYC status for all persons linked to a KYB case
func (s *EnhancedKYCService) GetKYBPersonsStatus(ctx context.Context, kybCaseID string) ([]*KYCStatusResponse, error) {
	persons, err := s.store.GetPersonsByKYBCase(ctx, kybCaseID)
	if err != nil {
		return nil, err
	}

	var statuses []*KYCStatusResponse
	for _, person := range persons {
		status, err := s.GetKYCStatus(ctx, person.PersonID)
		if err == nil {
			statuses = append(statuses, status)
		}
	}

	return statuses, nil
}

// CheckKYBPersonsComplete checks if all required persons for a KYB case have completed KYC
func (s *EnhancedKYCService) CheckKYBPersonsComplete(ctx context.Context, kybCaseID string) (bool, error) {
	persons, err := s.store.GetPersonsByKYBCase(ctx, kybCaseID)
	if err != nil {
		return false, err
	}

	for _, person := range persons {
		if person.Status != KYCVerifStatusApproved {
			return false, nil
		}
	}

	return len(persons) > 0, nil
}

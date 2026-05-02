// Package kyb provides KYB verification service for onboarding
package kyb

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// KYBService orchestrates KYB verification for onboarding
type KYBService struct {
	ballerine       *BallerineClient
	docProcessor    *DocumentProcessorClient
	store           KYBStore
	notifier        KYBNotifier
}

// KYBStore interface for KYB data persistence
type KYBStore interface {
	SaveKYBCase(ctx context.Context, kybCase *KYBCase) error
	GetKYBCase(ctx context.Context, caseID string) (*KYBCase, error)
	GetKYBCaseByOnboardingID(ctx context.Context, onboardingCaseID string) (*KYBCase, error)
	UpdateKYBCase(ctx context.Context, kybCase *KYBCase) error
	SaveDocument(ctx context.Context, doc *KYBDocument) error
	GetDocuments(ctx context.Context, caseID string) ([]*KYBDocument, error)
	SaveScreeningResult(ctx context.Context, result *ScreeningResult) error
	GetScreeningResults(ctx context.Context, caseID string) ([]*ScreeningResult, error)
}

// KYBNotifier interface for KYB notifications
type KYBNotifier interface {
	NotifyDocumentRequired(ctx context.Context, caseID string, docType DocumentType) error
	NotifyManualReviewRequired(ctx context.Context, caseID string, reason string) error
	NotifyKYBComplete(ctx context.Context, caseID string, decision *KYBDecision) error
}

// NewKYBService creates a new KYB service
func NewKYBService(ballerine *BallerineClient, docProcessor *DocumentProcessorClient, store KYBStore, notifier KYBNotifier) *KYBService {
	return &KYBService{
		ballerine:    ballerine,
		docProcessor: docProcessor,
		store:        store,
		notifier:     notifier,
	}
}

// DocumentProcessorClient handles communication with the Python document processor
type DocumentProcessorClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewDocumentProcessorClient creates a new document processor client
func NewDocumentProcessorClient(baseURL string) *DocumentProcessorClient {
	if baseURL == "" {
		baseURL = getEnv("DOCUMENT_PROCESSOR_URL", "http://document-processor:8090")
	}
	return &DocumentProcessorClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 120 * time.Second},
	}
}

// ProcessDocumentRequest represents a document processing request
type ProcessDocumentRequest struct {
	S3Key        string `json:"s3_key"`
	DocumentType string `json:"document_type"`
	CaseID       string `json:"case_id"`
}

// ProcessDocumentResponse represents the response from document processing
type ProcessDocumentResponse struct {
	DocumentID       string                     `json:"document_id"`
	DocumentType     string                     `json:"document_type"`
	ExtractedFields  map[string]ExtractedField  `json:"extracted_fields"`
	Confidence       float64                    `json:"confidence"`
	ProcessingTimeMs int                        `json:"processing_time_ms"`
	EnginesUsed      []string                   `json:"engines_used"`
	Warnings         []string                   `json:"warnings"`
}

// ExtractedField represents an extracted field from document processing

// ProcessDocument sends a document for processing
func (c *DocumentProcessorClient) ProcessDocument(ctx context.Context, req ProcessDocumentRequest) (*ProcessDocumentResponse, error) {
	body, err := json.Marshal(req)
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

	var result ProcessDocumentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// InitiateKYB initiates KYB verification for an onboarding case
func (s *KYBService) InitiateKYB(ctx context.Context, onboardingCaseID string, stakeholderType string, businessInfo BusinessInfo) (*KYBCase, error) {
	// Check if KYB case already exists
	existing, _ := s.store.GetKYBCaseByOnboardingID(ctx, onboardingCaseID)
	if existing != nil {
		return existing, nil
	}

	// Determine workflow based on stakeholder type
	workflowID := s.getWorkflowID(stakeholderType)

	// Create KYB case in Ballerine
	ballerineCase, err := s.ballerine.CreateCase(ctx, CreateKYBCaseRequest{
		ExternalID:      onboardingCaseID,
		WorkflowID:      workflowID,
		StakeholderType: stakeholderType,
		BusinessInfo:    businessInfo,
		WebhookURL:      s.ballerine.config.WebhookURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Ballerine case: %w", err)
	}

	// Save to local store
	if err := s.store.SaveKYBCase(ctx, ballerineCase); err != nil {
		return nil, fmt.Errorf("failed to save KYB case: %w", err)
	}

	return ballerineCase, nil
}

// getWorkflowID returns the appropriate workflow ID for a stakeholder type
func (s *KYBService) getWorkflowID(stakeholderType string) string {
	workflows := map[string]string{
		"BANK":                   "kyb-financial-institution-full",
		"MOBILE_MONEY_OPERATOR":  "kyb-financial-institution-full",
		"FINTECH":                "kyb-financial-institution-full",
		"MICROFINANCE":           "kyb-financial-institution-standard",
		"MERCHANT":               "kyb-merchant-standard",
		"DEVELOPER":              "kyb-developer-light",
		"REGULATOR":              "kyb-government-entity",
		"GOVERNMENT_AGENCY":      "kyb-government-entity",
	}

	if workflow, ok := workflows[stakeholderType]; ok {
		return workflow
	}
	return "kyb-standard"
}

// SubmitDocument submits a document for KYB verification
func (s *KYBService) SubmitDocument(ctx context.Context, caseID string, docType DocumentType, s3Key string, contentHash string, fileName string) (*KYBDocument, error) {
	// Process document with Docling/PaddleOCR/VLM
	processResult, err := s.docProcessor.ProcessDocument(ctx, ProcessDocumentRequest{
		S3Key:        s3Key,
		DocumentType: string(docType),
		CaseID:       caseID,
	})
	if err != nil {
		return nil, fmt.Errorf("document processing failed: %w", err)
	}

	// Create document record
	doc := &KYBDocument{
		ID:          processResult.DocumentID,
		Type:        docType,
		FileName:    fileName,
		S3Key:       s3Key,
		ContentHash: contentHash,
		Status:      DocStatusExtracted,
		ExtractionResult: &DocumentExtraction{
			ExtractedFields: s.convertExtractedFields(processResult.ExtractedFields),
			Confidence:      processResult.Confidence,
			ProcessingTime:  time.Duration(processResult.ProcessingTimeMs) * time.Millisecond,
			Engine:          s.getPrimaryEngine(processResult.EnginesUsed),
		},
		UploadedAt: time.Now(),
	}

	// Submit to Ballerine
	ballerineDoc, err := s.ballerine.SubmitDocument(ctx, caseID, SubmitDocumentRequest{
		Type:        docType,
		FileName:    fileName,
		S3Key:       s3Key,
		ContentHash: contentHash,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to submit document to Ballerine: %w", err)
	}

	// Merge Ballerine response
	doc.ID = ballerineDoc.ID
	doc.Status = ballerineDoc.Status

	// Save to local store
	if err := s.store.SaveDocument(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to save document: %w", err)
	}

	return doc, nil
}

// convertExtractedFields converts from internal format to API format
func (s *KYBService) convertExtractedFields(fields map[string]ExtractedField) map[string]ExtractedField {
	// Fields are already in the correct format, just return a copy
	result := make(map[string]ExtractedField)
	for k, v := range fields {
		result[k] = v
	}
	return result
}

// ExtractedFieldInternal is the internal representation of an extracted field
type ExtractedFieldInternal struct {
	Value       string       `json:"value"`
	Confidence  float64      `json:"confidence"`
	BoundingBox *BoundingBox `json:"bounding_box,omitempty"`
	PageNumber  int          `json:"page_number"`
}

// BoundingBox represents coordinates of extracted text

// getPrimaryEngine returns the primary engine used for processing
func (s *KYBService) getPrimaryEngine(engines []string) string {
	if len(engines) > 0 {
		return engines[len(engines)-1] // Last engine is typically the extraction engine
	}
	return "unknown"
}

// RunScreening runs screening checks for a KYB case
func (s *KYBService) RunScreening(ctx context.Context, caseID string) ([]*ScreeningResult, error) {
	var results []*ScreeningResult

	// Run sanctions screening
	sanctionsResult, err := s.ballerine.TriggerScreening(ctx, caseID, "SANCTIONS")
	if err != nil {
		return nil, fmt.Errorf("sanctions screening failed: %w", err)
	}
	results = append(results, sanctionsResult)
	s.store.SaveScreeningResult(ctx, sanctionsResult)

	// Run PEP screening
	pepResult, err := s.ballerine.TriggerScreening(ctx, caseID, "PEP")
	if err != nil {
		return nil, fmt.Errorf("PEP screening failed: %w", err)
	}
	results = append(results, pepResult)
	s.store.SaveScreeningResult(ctx, pepResult)

	// Run adverse media screening
	mediaResult, err := s.ballerine.TriggerScreening(ctx, caseID, "ADVERSE_MEDIA")
	if err != nil {
		return nil, fmt.Errorf("adverse media screening failed: %w", err)
	}
	results = append(results, mediaResult)
	s.store.SaveScreeningResult(ctx, mediaResult)

	return results, nil
}

// EvaluateKYB evaluates the KYB case and determines next steps
func (s *KYBService) EvaluateKYB(ctx context.Context, caseID string) (*KYBEvaluation, error) {
	kybCase, err := s.store.GetKYBCase(ctx, caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get KYB case: %w", err)
	}

	documents, err := s.store.GetDocuments(ctx, caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get documents: %w", err)
	}

	screenings, err := s.store.GetScreeningResults(ctx, caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get screening results: %w", err)
	}

	evaluation := &KYBEvaluation{
		CaseID:           caseID,
		DocumentsComplete: s.checkDocumentsComplete(kybCase, documents),
		ScreeningsPassed:  s.checkScreeningsPassed(screenings),
		RiskScore:         s.calculateRiskScore(kybCase, documents, screenings),
		MissingDocuments:  s.getMissingDocuments(kybCase, documents),
		Flags:             s.getFlags(screenings),
	}

	// Determine recommendation
	if !evaluation.DocumentsComplete {
		evaluation.Recommendation = "DOCUMENTS_PENDING"
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

// KYBEvaluation represents the evaluation of a KYB case
type KYBEvaluation struct {
	CaseID            string         `json:"case_id"`
	DocumentsComplete bool           `json:"documents_complete"`
	ScreeningsPassed  bool           `json:"screenings_passed"`
	RiskScore         int            `json:"risk_score"`
	MissingDocuments  []DocumentType `json:"missing_documents"`
	Flags             []string       `json:"flags"`
	Recommendation    string         `json:"recommendation"`
}

// checkDocumentsComplete checks if all required documents are submitted and verified
func (s *KYBService) checkDocumentsComplete(kybCase *KYBCase, documents []*KYBDocument) bool {
	required := s.getRequiredDocuments(kybCase.Metadata["stakeholder_type"].(string))
	
	submitted := make(map[DocumentType]bool)
	for _, doc := range documents {
		if doc.Status == DocStatusVerified || doc.Status == DocStatusExtracted {
			submitted[doc.Type] = true
		}
	}

	for _, docType := range required {
		if !submitted[docType] {
			return false
		}
	}

	return true
}

// getRequiredDocuments returns required documents for a stakeholder type
func (s *KYBService) getRequiredDocuments(stakeholderType string) []DocumentType {
	base := []DocumentType{
		DocTypeCertificateOfIncorporation,
		DocTypeBoardResolution,
		DocTypeDirectorID,
	}

	switch stakeholderType {
	case "BANK", "MOBILE_MONEY_OPERATOR", "FINTECH":
		return append(base,
			DocTypeBankingLicense,
			DocTypeAMLPolicy,
			DocTypeFinancialStatements,
			DocTypeShareholderRegister,
			DocTypeUBOID,
		)
	case "MICROFINANCE":
		return append(base,
			DocTypeBankingLicense,
			DocTypeAMLPolicy,
			DocTypeFinancialStatements,
		)
	case "MERCHANT":
		return append(base,
			DocTypeTaxCertificate,
			DocTypeBankStatement,
		)
	case "DEVELOPER":
		return []DocumentType{
			DocTypeDirectorID,
		}
	default:
		return base
	}
}

// checkScreeningsPassed checks if all screenings passed
func (s *KYBService) checkScreeningsPassed(screenings []*ScreeningResult) bool {
	for _, screening := range screenings {
		if screening.MatchFound && screening.MatchScore > 0.8 {
			return false
		}
	}
	return true
}

// calculateRiskScore calculates the risk score for a KYB case
func (s *KYBService) calculateRiskScore(kybCase *KYBCase, documents []*KYBDocument, screenings []*ScreeningResult) int {
	score := 0

	// Base score from business info
	if kybCase.BusinessInfo.IncorporationCountry != "" {
		// High-risk jurisdictions
		highRisk := []string{"AF", "KP", "IR", "SY", "YE"}
		for _, country := range highRisk {
			if kybCase.BusinessInfo.IncorporationCountry == country {
				score += 50
				break
			}
		}
	}

	// Document confidence scores
	for _, doc := range documents {
		if doc.ExtractionResult != nil && doc.ExtractionResult.Confidence < 0.7 {
			score += 10
		}
	}

	// Screening results
	for _, screening := range screenings {
		if screening.MatchFound {
			score += int(screening.MatchScore * 30)
		}
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}

	return score
}

// getMissingDocuments returns list of missing required documents
func (s *KYBService) getMissingDocuments(kybCase *KYBCase, documents []*KYBDocument) []DocumentType {
	stakeholderType := ""
	if st, ok := kybCase.Metadata["stakeholder_type"].(string); ok {
		stakeholderType = st
	}
	
	required := s.getRequiredDocuments(stakeholderType)
	
	submitted := make(map[DocumentType]bool)
	for _, doc := range documents {
		submitted[doc.Type] = true
	}

	var missing []DocumentType
	for _, docType := range required {
		if !submitted[docType] {
			missing = append(missing, docType)
		}
	}

	return missing
}

// getFlags returns flags from screening results
func (s *KYBService) getFlags(screenings []*ScreeningResult) []string {
	var flags []string
	for _, screening := range screenings {
		if screening.MatchFound {
			flags = append(flags, fmt.Sprintf("%s_MATCH: %s (%.0f%%)", 
				screening.Type, screening.EntityName, screening.MatchScore*100))
		}
	}
	return flags
}

// ApproveKYB approves a KYB case
func (s *KYBService) ApproveKYB(ctx context.Context, caseID string, approverID string, notes string) error {
	decision := KYBDecision{
		Decision:    "APPROVED",
		RiskLevel:   "LOW",
		DecidedBy:   approverID,
		DecidedAt:   time.Now(),
		ValidUntil:  time.Now().AddDate(1, 0, 0), // Valid for 1 year
		Notes:       notes,
	}

	if err := s.ballerine.SubmitDecision(ctx, caseID, decision); err != nil {
		return fmt.Errorf("failed to submit decision: %w", err)
	}

	// Update local case
	kybCase, err := s.store.GetKYBCase(ctx, caseID)
	if err != nil {
		return err
	}

	kybCase.Status = KYBStatusApproved
	kybCase.Decision = &decision
	now := time.Now()
	kybCase.CompletedAt = &now

	if err := s.store.UpdateKYBCase(ctx, kybCase); err != nil {
		return err
	}

	// Notify
	s.notifier.NotifyKYBComplete(ctx, caseID, &decision)

	return nil
}

// RejectKYB rejects a KYB case
func (s *KYBService) RejectKYB(ctx context.Context, caseID string, approverID string, reasonCodes []string, notes string) error {
	decision := KYBDecision{
		Decision:    "REJECTED",
		RiskLevel:   "HIGH",
		ReasonCodes: reasonCodes,
		DecidedBy:   approverID,
		DecidedAt:   time.Now(),
		Notes:       notes,
	}

	if err := s.ballerine.SubmitDecision(ctx, caseID, decision); err != nil {
		return fmt.Errorf("failed to submit decision: %w", err)
	}

	// Update local case
	kybCase, err := s.store.GetKYBCase(ctx, caseID)
	if err != nil {
		return err
	}

	kybCase.Status = KYBStatusRejected
	kybCase.Decision = &decision
	now := time.Now()
	kybCase.CompletedAt = &now

	if err := s.store.UpdateKYBCase(ctx, kybCase); err != nil {
		return err
	}

	// Notify
	s.notifier.NotifyKYBComplete(ctx, caseID, &decision)

	return nil
}

// GetKYBStatus returns the current status of a KYB case
func (s *KYBService) GetKYBStatus(ctx context.Context, caseID string) (*KYBStatusResponse, error) {
	kybCase, err := s.store.GetKYBCase(ctx, caseID)
	if err != nil {
		return nil, err
	}

	documents, _ := s.store.GetDocuments(ctx, caseID)
	screenings, _ := s.store.GetScreeningResults(ctx, caseID)

	evaluation, _ := s.EvaluateKYB(ctx, caseID)

	return &KYBStatusResponse{
		CaseID:           caseID,
		Status:           kybCase.Status,
		RiskScore:        kybCase.RiskScore,
		RiskLevel:        kybCase.RiskLevel,
		DocumentCount:    len(documents),
		ScreeningCount:   len(screenings),
		MissingDocuments: evaluation.MissingDocuments,
		Flags:            evaluation.Flags,
		Decision:         kybCase.Decision,
		CreatedAt:        kybCase.CreatedAt,
		UpdatedAt:        kybCase.UpdatedAt,
	}, nil
}

// KYBStatusResponse represents the status response for a KYB case
type KYBStatusResponse struct {
	CaseID           string         `json:"case_id"`
	Status           KYBStatus      `json:"status"`
	RiskScore        int            `json:"risk_score"`
	RiskLevel        string         `json:"risk_level"`
	DocumentCount    int            `json:"document_count"`
	ScreeningCount   int            `json:"screening_count"`
	MissingDocuments []DocumentType `json:"missing_documents"`
	Flags            []string       `json:"flags"`
	Decision         *KYBDecision   `json:"decision,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

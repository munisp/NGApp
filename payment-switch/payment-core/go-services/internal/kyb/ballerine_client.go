// Package kyb provides KYB (Know Your Business) verification services
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

// BallerineConfig holds Ballerine API configuration
type BallerineConfig struct {
	BaseURL    string
	APIKey     string
	WebhookURL string
	Timeout    time.Duration
}

// DefaultBallerineConfig returns default configuration
func DefaultBallerineConfig() *BallerineConfig {
	return &BallerineConfig{
		BaseURL:    getEnv("BALLERINE_BASE_URL", "http://ballerine.payment-switch.svc.cluster.local:3000"),
		APIKey:     getEnv("BALLERINE_API_KEY", ""),
		WebhookURL: getEnv("BALLERINE_WEBHOOK_URL", "http://onboarding-service:8082/api/v1/kyb/webhook"),
		Timeout:    30 * time.Second,
	}
}

// BallerineClient handles communication with Ballerine KYB platform
type BallerineClient struct {
	config     *BallerineConfig
	httpClient *http.Client
}

// NewBallerineClient creates a new Ballerine client
func NewBallerineClient(config *BallerineConfig) *BallerineClient {
	if config == nil {
		config = DefaultBallerineConfig()
	}

	return &BallerineClient{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// KYBWorkflow represents a KYB verification workflow
type KYBWorkflow struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Version         string                 `json:"version"`
	StakeholderType string                 `json:"stakeholder_type"`
	Steps           []KYBWorkflowStep      `json:"steps"`
	Config          map[string]interface{} `json:"config"`
}

// KYBWorkflowStep represents a step in the KYB workflow
type KYBWorkflowStep struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"` // document_collection, verification, screening, review
	Required   bool                   `json:"required"`
	Config     map[string]interface{} `json:"config"`
	NextOnPass string                 `json:"next_on_pass"`
	NextOnFail string                 `json:"next_on_fail"`
}

// KYBCase represents a KYB verification case
type KYBCase struct {
	ID               string                 `json:"id"`
	ExternalID       string                 `json:"external_id"` // Onboarding case ID
	WorkflowID       string                 `json:"workflow_id"`
	Status           KYBStatus              `json:"status"`
	RiskScore        int                    `json:"risk_score"`
	RiskLevel        string                 `json:"risk_level"` // LOW, MEDIUM, HIGH, CRITICAL
	BusinessInfo     BusinessInfo           `json:"business_info"`
	Documents        []KYBDocument          `json:"documents"`
	Screenings       []ScreeningResult      `json:"screenings"`
	Verifications    []VerificationResult   `json:"verifications"`
	Decision         *KYBDecision           `json:"decision,omitempty"`
	AssignedReviewer string                 `json:"assigned_reviewer,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	CompletedAt      *time.Time             `json:"completed_at,omitempty"`
	Metadata         map[string]interface{} `json:"metadata"`
}

// KYBStatus represents the status of a KYB case
type KYBStatus string

const (
	KYBStatusPending          KYBStatus = "PENDING"
	KYBStatusDocumentsPending KYBStatus = "DOCUMENTS_PENDING"
	KYBStatusInReview         KYBStatus = "IN_REVIEW"
	KYBStatusScreening        KYBStatus = "SCREENING"
	KYBStatusManualReview     KYBStatus = "MANUAL_REVIEW"
	KYBStatusApproved         KYBStatus = "APPROVED"
	KYBStatusRejected         KYBStatus = "REJECTED"
	KYBStatusEscalated        KYBStatus = "ESCALATED"
)

// BusinessInfo contains business entity information
type BusinessInfo struct {
	LegalName            string     `json:"legal_name"`
	TradingName          string     `json:"trading_name,omitempty"`
	RegistrationNumber   string     `json:"registration_number"`
	TaxID                string     `json:"tax_id,omitempty"`
	IncorporationDate    string     `json:"incorporation_date,omitempty"`
	IncorporationCountry string     `json:"incorporation_country"`
	LegalForm            string     `json:"legal_form"` // LLC, Corporation, Partnership, etc.
	Industry             string     `json:"industry"`
	Website              string     `json:"website,omitempty"`
	RegisteredAddress    Address    `json:"registered_address"`
	OperatingAddress     *Address   `json:"operating_address,omitempty"`
	ContactEmail         string     `json:"contact_email"`
	ContactPhone         string     `json:"contact_phone,omitempty"`
	UBOs                 []UBO      `json:"ubos"` // Ultimate Beneficial Owners
	Directors            []Director `json:"directors"`
}

// Address represents a physical address
type Address struct {
	Street     string `json:"street"`
	City       string `json:"city"`
	State      string `json:"state,omitempty"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
}

// UBO represents an Ultimate Beneficial Owner
type UBO struct {
	ID               string  `json:"id"`
	FullName         string  `json:"full_name"`
	DateOfBirth      string  `json:"date_of_birth"`
	Nationality      string  `json:"nationality"`
	OwnershipPercent float64 `json:"ownership_percent"`
	ControlType      string  `json:"control_type"` // DIRECT, INDIRECT
	IDDocumentType   string  `json:"id_document_type"`
	IDDocumentNumber string  `json:"id_document_number"`
	Address          Address `json:"address"`
	PEPStatus        bool    `json:"pep_status"`
	SanctionsStatus  bool    `json:"sanctions_status"`
}

// Director represents a company director
type Director struct {
	ID               string `json:"id"`
	FullName         string `json:"full_name"`
	Position         string `json:"position"`
	DateOfBirth      string `json:"date_of_birth"`
	Nationality      string `json:"nationality"`
	IDDocumentType   string `json:"id_document_type"`
	IDDocumentNumber string `json:"id_document_number"`
	AppointmentDate  string `json:"appointment_date"`
	PEPStatus        bool   `json:"pep_status"`
	SanctionsStatus  bool   `json:"sanctions_status"`
}

// KYBDocument represents a document in the KYB process
type KYBDocument struct {
	ID                 string                 `json:"id"`
	Type               DocumentType           `json:"type"`
	FileName           string                 `json:"file_name"`
	ContentType        string                 `json:"content_type"`
	S3Key              string                 `json:"s3_key"`
	ContentHash        string                 `json:"content_hash"`
	Status             DocumentStatus         `json:"status"`
	ExtractionResult   *DocumentExtraction    `json:"extraction_result,omitempty"`
	VerificationResult *DocumentVerification  `json:"verification_result,omitempty"`
	UploadedAt         time.Time              `json:"uploaded_at"`
	ProcessedAt        *time.Time             `json:"processed_at,omitempty"`
	Metadata           map[string]interface{} `json:"metadata"`
}

// DocumentType represents types of KYB documents
type DocumentType string

const (
	DocTypeCertificateOfIncorporation DocumentType = "CERTIFICATE_OF_INCORPORATION"
	DocTypeBankingLicense             DocumentType = "BANKING_LICENSE"
	DocTypeMemorandumOfAssociation    DocumentType = "MEMORANDUM_OF_ASSOCIATION"
	DocTypeArticlesOfAssociation      DocumentType = "ARTICLES_OF_ASSOCIATION"
	DocTypeBoardResolution            DocumentType = "BOARD_RESOLUTION"
	DocTypeShareholderRegister        DocumentType = "SHAREHOLDER_REGISTER"
	DocTypeDirectorID                 DocumentType = "DIRECTOR_ID"
	DocTypeUBOID                      DocumentType = "UBO_ID"
	DocTypeProofOfAddress             DocumentType = "PROOF_OF_ADDRESS"
	DocTypeTaxCertificate             DocumentType = "TAX_CERTIFICATE"
	DocTypeAMLPolicy                  DocumentType = "AML_POLICY"
	DocTypeFinancialStatements        DocumentType = "FINANCIAL_STATEMENTS"
	DocTypeBankStatement              DocumentType = "BANK_STATEMENT"
)

// DocumentStatus represents the status of a document
type DocumentStatus string

const (
	DocStatusPending    DocumentStatus = "PENDING"
	DocStatusProcessing DocumentStatus = "PROCESSING"
	DocStatusExtracted  DocumentStatus = "EXTRACTED"
	DocStatusVerified   DocumentStatus = "VERIFIED"
	DocStatusRejected   DocumentStatus = "REJECTED"
	DocStatusExpired    DocumentStatus = "EXPIRED"
)

// DocumentExtraction contains extracted data from a document
type DocumentExtraction struct {
	ExtractedFields map[string]ExtractedField `json:"extracted_fields"`
	RawText         string                    `json:"raw_text,omitempty"`
	Confidence      float64                   `json:"confidence"`
	ProcessingTime  time.Duration             `json:"processing_time"`
	Engine          string                    `json:"engine"` // docling, paddleocr, vlm
}

// ExtractedField represents a single extracted field
type ExtractedField struct {
	Value       string       `json:"value"`
	Confidence  float64      `json:"confidence"`
	BoundingBox *BoundingBox `json:"bounding_box,omitempty"`
	PageNumber  int          `json:"page_number"`
}

// BoundingBox represents coordinates of extracted text
type BoundingBox struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// DocumentVerification contains verification results
type DocumentVerification struct {
	IsAuthentic        bool      `json:"is_authentic"`
	IsExpired          bool      `json:"is_expired"`
	IsTampered         bool      `json:"is_tampered"`
	ExpiryDate         string    `json:"expiry_date,omitempty"`
	VerifiedAt         time.Time `json:"verified_at"`
	VerificationMethod string    `json:"verification_method"`
	Notes              string    `json:"notes,omitempty"`
}

// ScreeningResult contains screening results
type ScreeningResult struct {
	ID         string           `json:"id"`
	Type       string           `json:"type"` // SANCTIONS, PEP, ADVERSE_MEDIA
	EntityName string           `json:"entity_name"`
	EntityType string           `json:"entity_type"` // BUSINESS, INDIVIDUAL
	MatchFound bool             `json:"match_found"`
	MatchScore float64          `json:"match_score"`
	Matches    []ScreeningMatch `json:"matches,omitempty"`
	ScreenedAt time.Time        `json:"screened_at"`
	Provider   string           `json:"provider"`
}

// ScreeningMatch represents a potential match from screening
type ScreeningMatch struct {
	Name      string   `json:"name"`
	Score     float64  `json:"score"`
	ListName  string   `json:"list_name"`
	ListType  string   `json:"list_type"`
	Countries []string `json:"countries,omitempty"`
	Details   string   `json:"details,omitempty"`
}

// VerificationResult contains verification check results
type VerificationResult struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`   // REGISTRY, LICENSE, ADDRESS, BANK_ACCOUNT
	Status     string                 `json:"status"` // VERIFIED, FAILED, PENDING
	Details    map[string]interface{} `json:"details"`
	VerifiedAt time.Time              `json:"verified_at"`
	Provider   string                 `json:"provider"`
}

// KYBDecision represents the final KYB decision
type KYBDecision struct {
	Decision    string    `json:"decision"` // APPROVED, REJECTED, MANUAL_REVIEW
	RiskLevel   string    `json:"risk_level"`
	RiskScore   int       `json:"risk_score"`
	ReasonCodes []string  `json:"reason_codes"`
	Notes       string    `json:"notes,omitempty"`
	DecidedBy   string    `json:"decided_by"` // SYSTEM or reviewer ID
	DecidedAt   time.Time `json:"decided_at"`
	ValidUntil  time.Time `json:"valid_until"`
	Conditions  []string  `json:"conditions,omitempty"`
}

// CreateCase creates a new KYB case in Ballerine
func (c *BallerineClient) CreateCase(ctx context.Context, req CreateKYBCaseRequest) (*KYBCase, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.config.BaseURL+"/api/v1/cases", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(httpReq)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var kybCase KYBCase
	if err := json.NewDecoder(resp.Body).Decode(&kybCase); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &kybCase, nil
}

// CreateKYBCaseRequest represents a request to create a KYB case
type CreateKYBCaseRequest struct {
	ExternalID      string       `json:"external_id"`
	WorkflowID      string       `json:"workflow_id"`
	StakeholderType string       `json:"stakeholder_type"`
	BusinessInfo    BusinessInfo `json:"business_info"`
	WebhookURL      string       `json:"webhook_url,omitempty"`
}

// GetCase retrieves a KYB case by ID
func (c *BallerineClient) GetCase(ctx context.Context, caseID string) (*KYBCase, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", c.config.BaseURL+"/api/v1/cases/"+caseID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(httpReq)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var kybCase KYBCase
	if err := json.NewDecoder(resp.Body).Decode(&kybCase); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &kybCase, nil
}

// SubmitDocument submits a document for processing
func (c *BallerineClient) SubmitDocument(ctx context.Context, caseID string, doc SubmitDocumentRequest) (*KYBDocument, error) {
	body, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.config.BaseURL+"/api/v1/cases/"+caseID+"/documents", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(httpReq)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var kybDoc KYBDocument
	if err := json.NewDecoder(resp.Body).Decode(&kybDoc); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &kybDoc, nil
}

// SubmitDocumentRequest represents a document submission request
type SubmitDocumentRequest struct {
	Type        DocumentType `json:"type"`
	FileName    string       `json:"file_name"`
	ContentType string       `json:"content_type"`
	S3Key       string       `json:"s3_key"`
	ContentHash string       `json:"content_hash"`
}

// TriggerScreening triggers screening for a case
func (c *BallerineClient) TriggerScreening(ctx context.Context, caseID string, screeningType string) (*ScreeningResult, error) {
	req := map[string]string{"type": screeningType}
	body, _ := json.Marshal(req)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.config.BaseURL+"/api/v1/cases/"+caseID+"/screenings", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(httpReq)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var result ScreeningResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// SubmitDecision submits a manual decision for a case
func (c *BallerineClient) SubmitDecision(ctx context.Context, caseID string, decision KYBDecision) error {
	body, err := json.Marshal(decision)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.config.BaseURL+"/api/v1/cases/"+caseID+"/decision", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setHeaders(httpReq)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// setHeaders sets common headers for API requests
func (c *BallerineClient) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}
}

// Helper function to get environment variables
func getEnv(key, defaultValue string) string {
	if value := getEnvValue(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvValue(key string) string {
	// In production, this would use os.Getenv
	return ""
}

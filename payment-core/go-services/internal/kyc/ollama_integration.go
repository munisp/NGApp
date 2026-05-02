// Package kyc provides Ollama/LLaVA integration for document processing and ML scoring
package kyc

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

// Ollama resilience configuration
const (
	ollamaMaxRetries        = 3
	ollamaInitialDelay      = 500 * time.Millisecond
	ollamaMaxDelay          = 30 * time.Second
	ollamaCircuitThreshold  = 3
	ollamaCircuitTimeout    = 60 * time.Second
	ollamaHealthCheckInterval = 30 * time.Second
)

// OllamaCircuitBreaker provides circuit breaker for Ollama operations
type OllamaCircuitBreaker struct {
	state           int32
	failures        int32
	lastFailureTime int64
	threshold       int32
	timeout         time.Duration
}

// NewOllamaCircuitBreaker creates a new circuit breaker for Ollama
func NewOllamaCircuitBreaker() *OllamaCircuitBreaker {
	return &OllamaCircuitBreaker{
		state:     int32(CircuitClosed),
		threshold: ollamaCircuitThreshold,
		timeout:   ollamaCircuitTimeout,
	}
}

// CanExecute checks if the circuit allows execution
func (cb *OllamaCircuitBreaker) CanExecute() bool {
	state := CircuitState(atomic.LoadInt32(&cb.state))
	switch state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Now().UnixNano()-atomic.LoadInt64(&cb.lastFailureTime) > cb.timeout.Nanoseconds() {
			atomic.StoreInt32(&cb.state, int32(CircuitHalfOpen))
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	}
	return false
}

// RecordSuccess records a successful operation
func (cb *OllamaCircuitBreaker) RecordSuccess() {
	atomic.StoreInt32(&cb.failures, 0)
	atomic.StoreInt32(&cb.state, int32(CircuitClosed))
}

// RecordFailure records a failed operation
func (cb *OllamaCircuitBreaker) RecordFailure() {
	atomic.StoreInt64(&cb.lastFailureTime, time.Now().UnixNano())
	failures := atomic.AddInt32(&cb.failures, 1)
	if failures >= cb.threshold {
		atomic.StoreInt32(&cb.state, int32(CircuitOpen))
	}
}

// State returns current circuit state
func (cb *OllamaCircuitBreaker) State() CircuitState {
	return CircuitState(atomic.LoadInt32(&cb.state))
}

// OllamaFallbackResult provides fallback analysis when Ollama is unavailable
type OllamaFallbackResult struct {
	UsedFallback bool   `json:"used_fallback"`
	Reason       string `json:"reason"`
}

// OllamaModel represents available Ollama models
type OllamaModel string

const (
	ModelLLaVA       OllamaModel = "llava"
	ModelLLaVA13B    OllamaModel = "llava:13b"
	ModelLLaVA34B    OllamaModel = "llava:34b"
	ModelLlama3      OllamaModel = "llama3"
	ModelMistral     OllamaModel = "mistral"
	ModelCodeLlama   OllamaModel = "codellama"
)

// OllamaRequest represents a request to Ollama API
type OllamaRequest struct {
	Model    string   `json:"model"`
	Prompt   string   `json:"prompt"`
	Images   []string `json:"images,omitempty"` // Base64 encoded images
	Stream   bool     `json:"stream"`
	Options  *OllamaOptions `json:"options,omitempty"`
}

// OllamaOptions represents Ollama generation options
type OllamaOptions struct {
	Temperature   float64 `json:"temperature,omitempty"`
	TopP          float64 `json:"top_p,omitempty"`
	TopK          int     `json:"top_k,omitempty"`
	NumPredict    int     `json:"num_predict,omitempty"`
	Stop          []string `json:"stop,omitempty"`
	Seed          int     `json:"seed,omitempty"`
}

// OllamaResponse represents a response from Ollama API
type OllamaResponse struct {
	Model              string    `json:"model"`
	CreatedAt          time.Time `json:"created_at"`
	Response           string    `json:"response"`
	Done               bool      `json:"done"`
	Context            []int     `json:"context,omitempty"`
	TotalDuration      int64     `json:"total_duration,omitempty"`
	LoadDuration       int64     `json:"load_duration,omitempty"`
	PromptEvalCount    int       `json:"prompt_eval_count,omitempty"`
	PromptEvalDuration int64     `json:"prompt_eval_duration,omitempty"`
	EvalCount          int       `json:"eval_count,omitempty"`
	EvalDuration       int64     `json:"eval_duration,omitempty"`
}

// DocumentAnalysisResult represents the result of document analysis
type DocumentAnalysisResult struct {
	AnalysisID      string                 `json:"analysis_id"`
	DocumentID      string                 `json:"document_id"`
	CaseID          string                 `json:"case_id"`
	DocumentType    string                 `json:"document_type"`
	Model           string                 `json:"model"`
	Confidence      float64                `json:"confidence"`
	ExtractedFields map[string]interface{} `json:"extracted_fields"`
	ValidationResult *DocumentValidation   `json:"validation_result,omitempty"`
	FraudIndicators []FraudIndicator       `json:"fraud_indicators,omitempty"`
	ProcessingTime  int64                  `json:"processing_time_ms"`
	AnalyzedAt      time.Time              `json:"analyzed_at"`
	RawResponse     string                 `json:"raw_response,omitempty"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
}

// DocumentValidation represents document validation results
type DocumentValidation struct {
	IsValid           bool     `json:"is_valid"`
	ValidationScore   float64  `json:"validation_score"`
	Issues            []string `json:"issues,omitempty"`
	Warnings          []string `json:"warnings,omitempty"`
	DocumentQuality   string   `json:"document_quality"` // HIGH, MEDIUM, LOW
	IsExpired         bool     `json:"is_expired"`
	ExpiryDate        string   `json:"expiry_date,omitempty"`
	IsTampered        bool     `json:"is_tampered"`
	TamperingDetails  string   `json:"tampering_details,omitempty"`
}

// FraudIndicator represents a potential fraud indicator
type FraudIndicator struct {
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
	Confidence  float64 `json:"confidence"`
	Location    string  `json:"location,omitempty"`
}

// FaceMatchResult represents face matching results
type FaceMatchResult struct {
	MatchID         string  `json:"match_id"`
	CaseID          string  `json:"case_id"`
	Document1ID     string  `json:"document1_id"`
	Document2ID     string  `json:"document2_id"`
	IsMatch         bool    `json:"is_match"`
	MatchScore      float64 `json:"match_score"`
	Confidence      float64 `json:"confidence"`
	FaceDetected1   bool    `json:"face_detected_1"`
	FaceDetected2   bool    `json:"face_detected_2"`
	ProcessingTime  int64   `json:"processing_time_ms"`
	MatchedAt       time.Time `json:"matched_at"`
	ErrorMessage    string  `json:"error_message,omitempty"`
}

// OllamaService provides Ollama/LLaVA integration for KYC/KYB with full resilience
type OllamaService struct {
	baseURL            string
	httpClient         *http.Client
	defaultModel       OllamaModel
	lakehousePublisher *KYCLakehousePublisher
	cache              map[string]*DocumentAnalysisResult
	cacheMu            sync.RWMutex
	circuitBreaker     *OllamaCircuitBreaker
	healthy            int32
	metricsSuccess     int64
	metricsFailed      int64
	metricsLatencySum  int64
	metricsCount       int64
	fallbackEnabled    bool
	stopCh             chan struct{}
}

// NewOllamaService creates a new Ollama service with full resilience
func NewOllamaService(baseURL string, publisher *KYCLakehousePublisher) *OllamaService {
	if baseURL == "" {
		baseURL = "http://ollama:11434"
	}
	service := &OllamaService{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		defaultModel:       ModelLLaVA,
		lakehousePublisher: publisher,
		cache:              make(map[string]*DocumentAnalysisResult),
		circuitBreaker:     NewOllamaCircuitBreaker(),
		healthy:            1,
		fallbackEnabled:    true,
		stopCh:             make(chan struct{}),
	}
	
	go service.healthChecker()
	
	return service
}

// Stop gracefully stops the service
func (s *OllamaService) Stop() {
	close(s.stopCh)
}

// IsHealthy returns whether Ollama is healthy
func (s *OllamaService) IsHealthy() bool {
	return atomic.LoadInt32(&s.healthy) == 1
}

// GetMetrics returns service metrics
func (s *OllamaService) GetMetrics() map[string]interface{} {
	count := atomic.LoadInt64(&s.metricsCount)
	avgLatency := int64(0)
	if count > 0 {
		avgLatency = atomic.LoadInt64(&s.metricsLatencySum) / count
	}
	return map[string]interface{}{
		"success":        atomic.LoadInt64(&s.metricsSuccess),
		"failed":         atomic.LoadInt64(&s.metricsFailed),
		"avg_latency_ms": avgLatency,
		"circuit_state":  s.circuitBreaker.State(),
		"healthy":        s.IsHealthy(),
	}
}

// healthChecker periodically checks Ollama connectivity
func (s *OllamaService) healthChecker() {
	ticker := time.NewTicker(ollamaHealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := s.checkOllamaHealth(ctx)
			cancel()
			
			if err != nil {
				atomic.StoreInt32(&s.healthy, 0)
				log.Printf("Ollama health check failed: %v", err)
			} else {
				atomic.StoreInt32(&s.healthy, 1)
			}
		}
	}
}

// checkOllamaHealth checks if Ollama is reachable
func (s *OllamaService) checkOllamaHealth(ctx context.Context) error {
	healthURL := fmt.Sprintf("%s/api/tags", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		return err
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		return fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}
	
	return nil
}

// callOllamaWithRetry calls Ollama with exponential backoff retry
func (s *OllamaService) callOllamaWithRetry(ctx context.Context, req *OllamaRequest) (*OllamaResponse, error) {
	var lastErr error
	delay := ollamaInitialDelay

	for attempt := 1; attempt <= ollamaMaxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		resp, err := s.callOllama(ctx, req)
		if err == nil {
			s.circuitBreaker.RecordSuccess()
			return resp, nil
		}

		lastErr = err
		s.circuitBreaker.RecordFailure()

		if attempt == ollamaMaxRetries {
			break
		}

		log.Printf("Ollama call attempt %d failed: %v, retrying in %v", attempt, err, delay)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}

		delay = time.Duration(float64(delay) * 2)
		if delay > ollamaMaxDelay {
			delay = ollamaMaxDelay
		}
	}

	return nil, fmt.Errorf("max retries (%d) exceeded: %w", ollamaMaxRetries, lastErr)
}

// fallbackAnalysis provides rule-based analysis when Ollama is unavailable
func (s *OllamaService) fallbackAnalysis(caseID, documentID, documentType string) *DocumentAnalysisResult {
	return &DocumentAnalysisResult{
		AnalysisID:      uuid.New().String(),
		DocumentID:      documentID,
		CaseID:          caseID,
		DocumentType:    documentType,
		Model:           "fallback-rule-based",
		Confidence:      0.5,
		ExtractedFields: map[string]interface{}{
			"fallback_mode": true,
			"reason":        "Ollama service unavailable",
		},
		ValidationResult: &DocumentValidation{
			IsValid:         false,
			ValidationScore: 0.0,
			Issues:          []string{"Document requires manual review - AI service unavailable"},
			DocumentQuality: "UNKNOWN",
		},
		ProcessingTime: 0,
		AnalyzedAt:     time.Now(),
		ErrorMessage:   "Fallback mode: Ollama unavailable, manual review required",
	}
}

// AnalyzeDocument analyzes a document image using LLaVA
func (s *OllamaService) AnalyzeDocument(ctx context.Context, caseID, documentID, documentType string, imageData []byte) (*DocumentAnalysisResult, error) {
	startTime := time.Now()
	analysisID := uuid.New().String()

	result := &DocumentAnalysisResult{
		AnalysisID:      analysisID,
		DocumentID:      documentID,
		CaseID:          caseID,
		DocumentType:    documentType,
		Model:           string(s.defaultModel),
		ExtractedFields: make(map[string]interface{}),
		AnalyzedAt:      time.Now(),
	}

	// Check circuit breaker before proceeding
	if !s.circuitBreaker.CanExecute() {
		log.Printf("Ollama circuit breaker is open, using fallback for document %s", documentID)
		if s.fallbackEnabled {
			atomic.AddInt64(&s.metricsFailed, 1)
			return s.fallbackAnalysis(caseID, documentID, documentType), nil
		}
		return nil, fmt.Errorf("ollama circuit breaker is open")
	}

	// Encode image to base64
	imageBase64 := base64.StdEncoding.EncodeToString(imageData)

	// Build prompt based on document type
	prompt := s.buildExtractionPrompt(documentType)

	// Call Ollama API with retry
	ollamaReq := &OllamaRequest{
		Model:  string(s.defaultModel),
		Prompt: prompt,
		Images: []string{imageBase64},
		Stream: false,
		Options: &OllamaOptions{
			Temperature: 0.1,
			NumPredict:  2048,
		},
	}

	ollamaResp, err := s.callOllamaWithRetry(ctx, ollamaReq)
	if err != nil {
		atomic.AddInt64(&s.metricsFailed, 1)
		log.Printf("Ollama API failed after retries: %v", err)
		
		if s.fallbackEnabled {
			log.Printf("Using fallback analysis for document %s", documentID)
			return s.fallbackAnalysis(caseID, documentID, documentType), nil
		}
		
		result.ErrorMessage = fmt.Sprintf("Ollama API error: %v", err)
		result.ProcessingTime = time.Since(startTime).Milliseconds()
		return result, err
	}

	// Record success metrics
	atomic.AddInt64(&s.metricsSuccess, 1)
	processingTime := time.Since(startTime).Milliseconds()
	atomic.AddInt64(&s.metricsLatencySum, processingTime)
	atomic.AddInt64(&s.metricsCount, 1)

	result.RawResponse = ollamaResp.Response
	result.ProcessingTime = processingTime

	// Parse extracted fields from response
	extractedFields, confidence := s.parseExtractionResponse(ollamaResp.Response, documentType)
	result.ExtractedFields = extractedFields
	result.Confidence = confidence

	// Validate document
	result.ValidationResult = s.validateDocument(extractedFields, documentType)

	// Check for fraud indicators
	result.FraudIndicators = s.detectFraudIndicators(ollamaResp.Response, extractedFields, documentType)

	// Publish to lakehouse
	if s.lakehousePublisher != nil {
		s.lakehousePublisher.PublishOllamaAnalysis(ctx, &OllamaAnalysisEvent{
			AnalysisID:     analysisID,
			CaseID:         caseID,
			DocumentID:     documentID,
			Model:          string(s.defaultModel),
			AnalysisType:   "DOCUMENT_EXTRACTION",
			ResponseTokens: ollamaResp.EvalCount,
			Confidence:     confidence,
			ExtractedData:  extractedFields,
			ProcessingTime: result.ProcessingTime,
			AnalyzedAt:     result.AnalyzedAt,
		})
	}

	// Cache result
	s.cacheMu.Lock()
	s.cache[documentID] = result
	s.cacheMu.Unlock()

	return result, nil
}

// AnalyzeNINSlip analyzes a Nigerian NIN slip
func (s *OllamaService) AnalyzeNINSlip(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "NIN_SLIP", imageData)
}

// AnalyzeBVNPrintout analyzes a BVN printout
func (s *OllamaService) AnalyzeBVNPrintout(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "BVN_PRINTOUT", imageData)
}

// AnalyzePassport analyzes an international passport
func (s *OllamaService) AnalyzePassport(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "PASSPORT", imageData)
}

// AnalyzeDriversLicense analyzes a driver's license
func (s *OllamaService) AnalyzeDriversLicense(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "DRIVERS_LICENSE", imageData)
}

// AnalyzeCACCertificate analyzes a CAC certificate
func (s *OllamaService) AnalyzeCACCertificate(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "CAC_CERTIFICATE", imageData)
}

// AnalyzeUtilityBill analyzes a utility bill for proof of address
func (s *OllamaService) AnalyzeUtilityBill(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "UTILITY_BILL", imageData)
}

// AnalyzeBankStatement analyzes a bank statement
func (s *OllamaService) AnalyzeBankStatement(ctx context.Context, caseID, documentID string, imageData []byte) (*DocumentAnalysisResult, error) {
	return s.AnalyzeDocument(ctx, caseID, documentID, "BANK_STATEMENT", imageData)
}

// CompareFaces compares faces between two document images
func (s *OllamaService) CompareFaces(ctx context.Context, caseID, doc1ID, doc2ID string, image1Data, image2Data []byte) (*FaceMatchResult, error) {
	startTime := time.Now()
	matchID := uuid.New().String()

	result := &FaceMatchResult{
		MatchID:     matchID,
		CaseID:      caseID,
		Document1ID: doc1ID,
		Document2ID: doc2ID,
		MatchedAt:   time.Now(),
	}

	// Encode images to base64
	image1Base64 := base64.StdEncoding.EncodeToString(image1Data)
	image2Base64 := base64.StdEncoding.EncodeToString(image2Data)

	prompt := `Analyze these two images and determine if they show the same person.

For each image:
1. Is there a face visible? (yes/no)
2. Describe the face (gender, approximate age, distinguishing features)

Then compare:
3. Are these the same person? (yes/no/uncertain)
4. Confidence level (0-100%)
5. Matching features observed
6. Differences observed

Respond in JSON format:
{
  "face1_detected": true/false,
  "face1_description": "...",
  "face2_detected": true/false,
  "face2_description": "...",
  "same_person": true/false/null,
  "confidence": 0-100,
  "matching_features": ["..."],
  "differences": ["..."]
}`

	ollamaReq := &OllamaRequest{
		Model:  string(s.defaultModel),
		Prompt: prompt,
		Images: []string{image1Base64, image2Base64},
		Stream: false,
		Options: &OllamaOptions{
			Temperature: 0.1,
			NumPredict:  1024,
		},
	}

	ollamaResp, err := s.callOllama(ctx, ollamaReq)
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("Ollama API error: %v", err)
		result.ProcessingTime = time.Since(startTime).Milliseconds()
		return result, err
	}

	result.ProcessingTime = time.Since(startTime).Milliseconds()

	// Parse response
	var faceResult struct {
		Face1Detected    bool     `json:"face1_detected"`
		Face2Detected    bool     `json:"face2_detected"`
		SamePerson       *bool    `json:"same_person"`
		Confidence       float64  `json:"confidence"`
		MatchingFeatures []string `json:"matching_features"`
		Differences      []string `json:"differences"`
	}

	// Try to extract JSON from response
	jsonStr := extractJSON(ollamaResp.Response)
	if jsonStr != "" {
		json.Unmarshal([]byte(jsonStr), &faceResult)
	}

	result.FaceDetected1 = faceResult.Face1Detected
	result.FaceDetected2 = faceResult.Face2Detected
	result.Confidence = faceResult.Confidence / 100.0
	if faceResult.SamePerson != nil {
		result.IsMatch = *faceResult.SamePerson
		result.MatchScore = faceResult.Confidence / 100.0
	}

	// Publish to lakehouse
	if s.lakehousePublisher != nil {
		s.lakehousePublisher.PublishOllamaAnalysis(ctx, &OllamaAnalysisEvent{
			AnalysisID:     matchID,
			CaseID:         caseID,
			DocumentID:     doc1ID,
			Model:          string(s.defaultModel),
			AnalysisType:   "FACE_MATCH",
			ResponseTokens: ollamaResp.EvalCount,
			Confidence:     result.Confidence,
			ExtractedData: map[string]interface{}{
				"is_match":    result.IsMatch,
				"match_score": result.MatchScore,
			},
			ProcessingTime: result.ProcessingTime,
			AnalyzedAt:     result.MatchedAt,
		})
	}

	return result, nil
}

// DetectDocumentFraud analyzes a document for potential fraud
func (s *OllamaService) DetectDocumentFraud(ctx context.Context, caseID, documentID, documentType string, imageData []byte) ([]FraudIndicator, error) {
	startTime := time.Now()

	imageBase64 := base64.StdEncoding.EncodeToString(imageData)

	prompt := fmt.Sprintf(`Analyze this %s document image for potential fraud or tampering.

Check for:
1. Signs of digital manipulation (inconsistent fonts, misaligned text, color inconsistencies)
2. Physical tampering (scratches, erasures, overwriting)
3. Document authenticity (security features, watermarks, holograms)
4. Data consistency (dates, numbers, formatting)
5. Image quality issues that might indicate a copy or scan of a copy

For each issue found, provide:
- Type of issue
- Description
- Severity (LOW, MEDIUM, HIGH, CRITICAL)
- Confidence (0-100%%)
- Location in document

Respond in JSON format:
{
  "fraud_indicators": [
    {
      "type": "...",
      "description": "...",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "confidence": 0-100,
      "location": "..."
    }
  ],
  "overall_assessment": "GENUINE|SUSPICIOUS|LIKELY_FRAUDULENT",
  "confidence": 0-100
}`, documentType)

	ollamaReq := &OllamaRequest{
		Model:  string(s.defaultModel),
		Prompt: prompt,
		Images: []string{imageBase64},
		Stream: false,
		Options: &OllamaOptions{
			Temperature: 0.1,
			NumPredict:  2048,
		},
	}

	ollamaResp, err := s.callOllama(ctx, ollamaReq)
	if err != nil {
		return nil, err
	}

	// Parse response
	var fraudResult struct {
		FraudIndicators []FraudIndicator `json:"fraud_indicators"`
		OverallAssessment string         `json:"overall_assessment"`
		Confidence      float64          `json:"confidence"`
	}

	jsonStr := extractJSON(ollamaResp.Response)
	if jsonStr != "" {
		json.Unmarshal([]byte(jsonStr), &fraudResult)
	}

	// Publish to lakehouse
	if s.lakehousePublisher != nil {
		s.lakehousePublisher.PublishOllamaAnalysis(ctx, &OllamaAnalysisEvent{
			AnalysisID:     uuid.New().String(),
			CaseID:         caseID,
			DocumentID:     documentID,
			Model:          string(s.defaultModel),
			AnalysisType:   "FRAUD_DETECTION",
			ResponseTokens: ollamaResp.EvalCount,
			Confidence:     fraudResult.Confidence / 100.0,
			ExtractedData: map[string]interface{}{
				"overall_assessment": fraudResult.OverallAssessment,
				"indicator_count":    len(fraudResult.FraudIndicators),
			},
			ProcessingTime: time.Since(startTime).Milliseconds(),
			AnalyzedAt:     time.Now(),
		})
	}

	return fraudResult.FraudIndicators, nil
}

// buildExtractionPrompt builds the extraction prompt based on document type
func (s *OllamaService) buildExtractionPrompt(documentType string) string {
	basePrompt := "Analyze this document image and extract all relevant information. "

	switch documentType {
	case "NIN_SLIP":
		return basePrompt + `This is a Nigerian National Identification Number (NIN) slip.

Extract the following fields:
- NIN (11-digit number)
- Full Name (First, Middle, Last)
- Date of Birth
- Gender
- Phone Number
- Address
- State of Origin
- LGA (Local Government Area)
- Photo present (yes/no)
- Document issue date
- Any visible security features

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	case "BVN_PRINTOUT":
		return basePrompt + `This is a Nigerian Bank Verification Number (BVN) printout.

Extract the following fields:
- BVN (11-digit number)
- Full Name
- Date of Birth
- Gender
- Phone Number
- Email
- Enrollment Bank
- Enrollment Branch
- Registration Date
- Photo present (yes/no)

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	case "PASSPORT":
		return basePrompt + `This is an international passport.

Extract the following fields:
- Passport Number
- Full Name (Surname, Given Names)
- Nationality
- Date of Birth
- Gender
- Place of Birth
- Issue Date
- Expiry Date
- Issuing Authority
- MRZ Line 1 (if visible)
- MRZ Line 2 (if visible)
- Photo present (yes/no)

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	case "DRIVERS_LICENSE":
		return basePrompt + `This is a driver's license.

Extract the following fields:
- License Number
- Full Name
- Date of Birth
- Gender
- Address
- Issue Date
- Expiry Date
- License Class/Category
- State/Region of Issue
- Photo present (yes/no)

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	case "CAC_CERTIFICATE":
		return basePrompt + `This is a Nigerian Corporate Affairs Commission (CAC) certificate.

Extract the following fields:
- RC Number (Registration Number)
- Company Name
- Company Type (RC, BN, IT, LLP)
- Registration Date
- Registered Address
- Share Capital
- Business Objectives
- Directors (names if listed)
- Certificate Number
- Any stamps or signatures

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	case "UTILITY_BILL":
		return basePrompt + `This is a utility bill (for proof of address).

Extract the following fields:
- Account Holder Name
- Service Address
- Billing Period
- Bill Date
- Due Date
- Amount Due
- Utility Provider Name
- Account Number
- Meter Number (if applicable)

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	case "BANK_STATEMENT":
		return basePrompt + `This is a bank statement.

Extract the following fields:
- Account Holder Name
- Account Number
- Bank Name
- Branch
- Statement Period (From - To)
- Opening Balance
- Closing Balance
- Address
- Currency

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`

	default:
		return basePrompt + `Extract all visible text and information from this document.

Identify:
- Document type
- Key fields and values
- Dates
- Names
- Numbers
- Any security features

Respond in JSON format with extracted fields and confidence scores (0-100) for each field.`
	}
}

// parseExtractionResponse parses the extraction response from Ollama
func (s *OllamaService) parseExtractionResponse(response string, documentType string) (map[string]interface{}, float64) {
	extractedFields := make(map[string]interface{})
	var overallConfidence float64 = 0.0

	// Try to extract JSON from response
	jsonStr := extractJSON(response)
	if jsonStr == "" {
		// If no JSON found, try to parse as plain text
		extractedFields["raw_text"] = response
		return extractedFields, 0.5
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		extractedFields["raw_text"] = response
		return extractedFields, 0.5
	}

	// Calculate overall confidence from individual field confidences
	confidenceSum := 0.0
	confidenceCount := 0

	for key, value := range parsed {
		if strings.HasSuffix(key, "_confidence") {
			if conf, ok := value.(float64); ok {
				confidenceSum += conf
				confidenceCount++
			}
		} else {
			extractedFields[key] = value
		}
	}

	if confidenceCount > 0 {
		overallConfidence = confidenceSum / float64(confidenceCount) / 100.0
	} else {
		overallConfidence = 0.8 // Default confidence if not provided
	}

	return extractedFields, overallConfidence
}

// validateDocument validates extracted document data
func (s *OllamaService) validateDocument(extractedFields map[string]interface{}, documentType string) *DocumentValidation {
	validation := &DocumentValidation{
		IsValid:         true,
		ValidationScore: 1.0,
		Issues:          []string{},
		Warnings:        []string{},
		DocumentQuality: "HIGH",
	}

	// Check for required fields based on document type
	requiredFields := s.getRequiredFields(documentType)
	missingFields := 0
	for _, field := range requiredFields {
		if _, ok := extractedFields[field]; !ok {
			validation.Issues = append(validation.Issues, fmt.Sprintf("Missing required field: %s", field))
			missingFields++
		}
	}

	// Calculate validation score
	if len(requiredFields) > 0 {
		validation.ValidationScore = float64(len(requiredFields)-missingFields) / float64(len(requiredFields))
	}

	// Check expiry date if present
	if expiryDate, ok := extractedFields["expiry_date"].(string); ok {
		if expiry, err := time.Parse("2006-01-02", expiryDate); err == nil {
			if expiry.Before(time.Now()) {
				validation.IsExpired = true
				validation.ExpiryDate = expiryDate
				validation.Issues = append(validation.Issues, "Document has expired")
			}
		}
	}

	// Determine document quality
	if validation.ValidationScore >= 0.9 {
		validation.DocumentQuality = "HIGH"
	} else if validation.ValidationScore >= 0.7 {
		validation.DocumentQuality = "MEDIUM"
	} else {
		validation.DocumentQuality = "LOW"
	}

	// Set overall validity
	if len(validation.Issues) > 0 || validation.ValidationScore < 0.7 {
		validation.IsValid = false
	}

	return validation
}

// getRequiredFields returns required fields for a document type
func (s *OllamaService) getRequiredFields(documentType string) []string {
	switch documentType {
	case "NIN_SLIP":
		return []string{"nin", "full_name", "date_of_birth"}
	case "BVN_PRINTOUT":
		return []string{"bvn", "full_name", "date_of_birth"}
	case "PASSPORT":
		return []string{"passport_number", "full_name", "nationality", "expiry_date"}
	case "DRIVERS_LICENSE":
		return []string{"license_number", "full_name", "expiry_date"}
	case "CAC_CERTIFICATE":
		return []string{"rc_number", "company_name", "registration_date"}
	case "UTILITY_BILL":
		return []string{"account_holder_name", "service_address", "bill_date"}
	case "BANK_STATEMENT":
		return []string{"account_holder_name", "account_number", "bank_name"}
	default:
		return []string{}
	}
}

// detectFraudIndicators detects potential fraud indicators
func (s *OllamaService) detectFraudIndicators(response string, extractedFields map[string]interface{}, documentType string) []FraudIndicator {
	indicators := []FraudIndicator{}

	// Check for common fraud patterns
	responseUpper := strings.ToUpper(response)

	// Check for tampering mentions
	if strings.Contains(responseUpper, "TAMPER") || strings.Contains(responseUpper, "ALTERED") {
		indicators = append(indicators, FraudIndicator{
			Type:        "TAMPERING",
			Description: "Potential document tampering detected",
			Severity:    "HIGH",
			Confidence:  0.7,
		})
	}

	// Check for quality issues
	if strings.Contains(responseUpper, "BLURRY") || strings.Contains(responseUpper, "UNCLEAR") {
		indicators = append(indicators, FraudIndicator{
			Type:        "QUALITY",
			Description: "Poor document quality may indicate copy of copy",
			Severity:    "MEDIUM",
			Confidence:  0.6,
		})
	}

	// Check for inconsistencies
	if strings.Contains(responseUpper, "INCONSISTENT") || strings.Contains(responseUpper, "MISMATCH") {
		indicators = append(indicators, FraudIndicator{
			Type:        "INCONSISTENCY",
			Description: "Data inconsistencies detected in document",
			Severity:    "HIGH",
			Confidence:  0.75,
		})
	}

	return indicators
}

// callOllama makes a request to the Ollama API
func (s *OllamaService) callOllama(ctx context.Context, req *OllamaRequest) (*OllamaResponse, error) {
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/api/generate", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call Ollama API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ollama API returned status %d: %s", resp.StatusCode, string(body))
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &ollamaResp, nil
}

// extractJSON extracts JSON from a string that may contain other text
func extractJSON(s string) string {
	// Find the first { and last }
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start == -1 || end == -1 || end <= start {
		return ""
	}
	return s[start : end+1]
}

// HTTP Handlers

// HandleAnalyzeDocument handles document analysis requests
func (s *OllamaService) HandleAnalyzeDocument(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB max
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	caseID := r.FormValue("case_id")
	documentID := r.FormValue("document_id")
	documentType := r.FormValue("document_type")

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Failed to get image file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	imageData, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read image", http.StatusInternalServerError)
		return
	}

	result, err := s.AnalyzeDocument(r.Context(), caseID, documentID, documentType, imageData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleCompareFaces handles face comparison requests
func (s *OllamaService) HandleCompareFaces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(64 << 20); err != nil { // 64MB max
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	caseID := r.FormValue("case_id")
	doc1ID := r.FormValue("document1_id")
	doc2ID := r.FormValue("document2_id")

	file1, _, err := r.FormFile("image1")
	if err != nil {
		http.Error(w, "Failed to get image1 file", http.StatusBadRequest)
		return
	}
	defer file1.Close()

	file2, _, err := r.FormFile("image2")
	if err != nil {
		http.Error(w, "Failed to get image2 file", http.StatusBadRequest)
		return
	}
	defer file2.Close()

	image1Data, _ := io.ReadAll(file1)
	image2Data, _ := io.ReadAll(file2)

	result, err := s.CompareFaces(r.Context(), caseID, doc1ID, doc2ID, image1Data, image2Data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleDetectFraud handles fraud detection requests
func (s *OllamaService) HandleDetectFraud(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	caseID := r.FormValue("case_id")
	documentID := r.FormValue("document_id")
	documentType := r.FormValue("document_type")

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Failed to get image file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	imageData, _ := io.ReadAll(file)

	indicators, err := s.DetectDocumentFraud(r.Context(), caseID, documentID, documentType, imageData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"fraud_indicators": indicators,
	})
}

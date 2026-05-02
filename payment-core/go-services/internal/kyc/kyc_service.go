package kyc

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sync"
	"time"
)

type IDType string

const (
	IDTypeBVN            IDType = "BVN"
	IDTypeNIN            IDType = "NIN"
	IDTypePassport       IDType = "PASSPORT"
	IDTypeDriversLicense IDType = "DRIVERS_LICENSE"
)

type KYCStatus string

const (
	KYCStatusPending    KYCStatus = "pending"
	KYCStatusInProgress KYCStatus = "in_progress"
	KYCStatusApproved   KYCStatus = "approved"
	KYCStatusRejected   KYCStatus = "rejected"
	KYCStatusFailed     KYCStatus = "failed"
)

type RiskLevel string

const (
	RiskLevelLow    RiskLevel = "low"
	RiskLevelMedium RiskLevel = "medium"
	RiskLevelHigh   RiskLevel = "high"
)

type KYCRequest struct {
	RemittanceID    string `json:"remittanceId"`
	FirstName       string `json:"firstName"`
	LastName        string `json:"lastName"`
	DateOfBirth     string `json:"dateOfBirth"`
	Address         string `json:"address"`
	IDType          IDType `json:"idType"`
	IDNumber        string `json:"idNumber"`
	PhoneNumber     string `json:"phoneNumber"`
	Email           string `json:"email,omitempty"`
	SelfieImage     string `json:"selfieImage,omitempty"`
	IDDocumentImage string `json:"idDocumentImage,omitempty"`
}

type VerifiedData struct {
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	DateOfBirth string `json:"dateOfBirth"`
	PhoneNumber string `json:"phoneNumber"`
	Address     string `json:"address,omitempty"`
	Gender      string `json:"gender,omitempty"`
	Nationality string `json:"nationality,omitempty"`
}

type KYCResult struct {
	VerificationID  string        `json:"verificationId"`
	Status          KYCStatus     `json:"status"`
	ConfidenceScore float64       `json:"confidenceScore"`
	LivenessCheck   bool          `json:"livenessCheck"`
	DocumentMatch   bool          `json:"documentMatch"`
	AMLScreening    bool          `json:"amlScreening"`
	SanctionsCheck  bool          `json:"sanctionsCheck"`
	RiskScore       float64       `json:"riskScore"`
	RiskLevel       RiskLevel     `json:"riskLevel"`
	VerifiedData    *VerifiedData `json:"verifiedData,omitempty"`
	RejectionReason string        `json:"rejectionReason,omitempty"`
	CompletedAt     *time.Time    `json:"completedAt,omitempty"`
}

type KYCInitiationResult struct {
	VerificationID          string    `json:"verificationId"`
	Status                  KYCStatus `json:"status"`
	EstimatedCompletionTime time.Time `json:"estimatedCompletionTime"`
}

type LivenessCheckResult struct {
	Passed          bool    `json:"passed"`
	ConfidenceScore float64 `json:"confidenceScore"`
	LivenessScore   float64 `json:"livenessScore"`
}

type AMLMatch struct {
	Name  string  `json:"name"`
	Type  string  `json:"type"`
	Score float64 `json:"score"`
}

type AMLScreeningResult struct {
	Passed    bool       `json:"passed"`
	RiskScore float64    `json:"riskScore"`
	RiskLevel RiskLevel  `json:"riskLevel"`
	Matches   []AMLMatch `json:"matches"`
}

type SanctionsMatch struct {
	ListName   string  `json:"listName"`
	MatchScore float64 `json:"matchScore"`
}

type SanctionsCheckResult struct {
	Passed  bool             `json:"passed"`
	Matches []SanctionsMatch `json:"matches"`
}

type RiskFactor struct {
	Factor      string  `json:"factor"`
	Impact      float64 `json:"impact"`
	Description string  `json:"description"`
}

type RiskScoreResult struct {
	OverallRiskScore float64      `json:"overallRiskScore"`
	RiskLevel        RiskLevel    `json:"riskLevel"`
	Factors          []RiskFactor `json:"factors"`
}

type KYCRequirements struct {
	RequiredDocuments []string `json:"requiredDocuments"`
	OptionalDocuments []string `json:"optionalDocuments"`
	RequiresLiveness  bool     `json:"requiresLiveness"`
	RequiresAML       bool     `json:"requiresAML"`
}

type SmileIDJobResponse struct {
	JobID   string `json:"job_id"`
	JobType string `json:"job_type"`
	Result  struct {
		ResultText      string `json:"ResultText"`
		ResultCode      string `json:"ResultCode"`
		ConfidenceValue string `json:"ConfidenceValue"`
		Actions         struct {
			LivenessCheck      string `json:"Liveness_Check"`
			RegisterSelfie     string `json:"Register_Selfie"`
			HumanReviewCompare string `json:"Human_Review_Compare"`
			SelfieProvided     string `json:"Selfie_Provided"`
			VerifyIDNumber     string `json:"Verify_ID_Number"`
		} `json:"Actions"`
	} `json:"result"`
	ImageLinks struct {
		SelfieImage string `json:"selfie_image"`
	} `json:"image_links"`
	Timestamp string `json:"timestamp"`
}

type KYCService struct {
	mu          sync.RWMutex
	apiURL      string
	partnerID   string
	apiKey      string
	callbackURL string
	httpClient  *http.Client
}

func NewKYCService() *KYCService {
	apiURL := os.Getenv("SMILE_API_URL")
	if apiURL == "" {
		apiURL = "https://api.smileidentity.com/v1"
	}

	return &KYCService{
		apiURL:      apiURL,
		partnerID:   os.Getenv("SMILE_PARTNER_ID"),
		apiKey:      os.Getenv("SMILE_API_KEY"),
		callbackURL: os.Getenv("SMILE_CALLBACK_URL"),
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (s *KYCService) InitiateKYCVerification(req *KYCRequest) (*KYCInitiationResult, error) {
	verificationID := fmt.Sprintf("kyc_%s", generateRandomHex(16))
	timestamp := time.Now().UTC().Format(time.RFC3339)

	jobPayload := map[string]interface{}{
		"partner_id":   s.partnerID,
		"job_id":       verificationID,
		"job_type":     s.getJobType(req.IDType),
		"user_id":      req.RemittanceID,
		"callback_url": s.callbackURL,
		"partner_params": map[string]interface{}{
			"user_id":  req.RemittanceID,
			"job_id":   verificationID,
			"job_type": s.getJobType(req.IDType),
		},
		"timestamp": timestamp,
	}

	idInfo := map[string]interface{}{
		"country":      "NG",
		"id_type":      string(req.IDType),
		"id_number":    req.IDNumber,
		"first_name":   req.FirstName,
		"last_name":    req.LastName,
		"dob":          req.DateOfBirth,
		"phone_number": req.PhoneNumber,
	}

	signature := s.generateSignature(jobPayload, timestamp)

	requestBody := map[string]interface{}{
		"partner_id":     s.partnerID,
		"job_id":         verificationID,
		"job_type":       s.getJobType(req.IDType),
		"user_id":        req.RemittanceID,
		"callback_url":   s.callbackURL,
		"partner_params": jobPayload["partner_params"],
		"timestamp":      timestamp,
		"id_info":        idInfo,
	}

	if req.SelfieImage != "" {
		requestBody["images"] = []map[string]interface{}{
			{
				"image_type_id": 2,
				"image":         req.SelfieImage,
			},
		}
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.apiURL+"/async_id_verification", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("SmileIdentity-Partner-Id", s.partnerID)
	httpReq.Header.Set("SmileIdentity-Signature", signature)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("Smile Identity API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("Smile Identity API error: %s", string(body))
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	jobID, _ := response["job_id"].(string)
	if jobID == "" {
		jobID = verificationID
	}

	estimatedCompletionTime := time.Now().Add(30 * time.Minute)

	return &KYCInitiationResult{
		VerificationID:          jobID,
		Status:                  KYCStatusInProgress,
		EstimatedCompletionTime: estimatedCompletionTime,
	}, nil
}

func (s *KYCService) GetKYCVerificationStatus(verificationID string) (*KYCResult, error) {
	timestamp := time.Now().UTC().Format(time.RFC3339)
	payload := map[string]interface{}{"job_id": verificationID}
	signature := s.generateSignature(payload, timestamp)

	requestBody := map[string]interface{}{
		"partner_id": s.partnerID,
		"job_id":     verificationID,
		"timestamp":  timestamp,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/job_status", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("SmileIdentity-Partner-Id", s.partnerID)
	req.Header.Set("SmileIdentity-Signature", signature)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Smile Identity API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get KYC status: %s", string(body))
	}

	var data SmileIDJobResponse
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return s.parseSmileIDResult(verificationID, &data), nil
}

func (s *KYCService) VerifyBVNEnhanced(bvn, firstName, lastName, dateOfBirth, phoneNumber, remittanceID string) (*KYCResult, error) {
	initResult, err := s.InitiateKYCVerification(&KYCRequest{
		RemittanceID: remittanceID,
		FirstName:    firstName,
		LastName:     lastName,
		DateOfBirth:  dateOfBirth,
		Address:      "",
		IDType:       IDTypeBVN,
		IDNumber:     bvn,
		PhoneNumber:  phoneNumber,
	})
	if err != nil {
		return nil, err
	}

	return s.GetKYCVerificationStatus(initResult.VerificationID)
}

func (s *KYCService) VerifyNIN(nin, firstName, lastName, dateOfBirth, phoneNumber, remittanceID string) (*KYCResult, error) {
	initResult, err := s.InitiateKYCVerification(&KYCRequest{
		RemittanceID: remittanceID,
		FirstName:    firstName,
		LastName:     lastName,
		DateOfBirth:  dateOfBirth,
		Address:      "",
		IDType:       IDTypeNIN,
		IDNumber:     nin,
		PhoneNumber:  phoneNumber,
	})
	if err != nil {
		return nil, err
	}

	return s.GetKYCVerificationStatus(initResult.VerificationID)
}

func (s *KYCService) PerformLivenessCheck(remittanceID, selfieImage string, idType IDType, idNumber string) (*LivenessCheckResult, error) {
	verificationID := fmt.Sprintf("liveness_%s", generateRandomHex(16))
	timestamp := time.Now().UTC().Format(time.RFC3339)

	jobPayload := map[string]interface{}{
		"partner_id": s.partnerID,
		"job_id":     verificationID,
		"job_type":   4,
		"user_id":    remittanceID,
		"timestamp":  timestamp,
	}

	signature := s.generateSignature(jobPayload, timestamp)

	requestBody := map[string]interface{}{
		"partner_id": s.partnerID,
		"job_id":     verificationID,
		"job_type":   4,
		"user_id":    remittanceID,
		"timestamp":  timestamp,
		"images": []map[string]interface{}{
			{
				"image_type_id": 2,
				"image":         selfieImage,
			},
		},
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/liveness_check", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("SmileIdentity-Partner-Id", s.partnerID)
	req.Header.Set("SmileIdentity-Signature", signature)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Smile Identity API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("liveness check failed: %s", string(body))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var confidenceValue float64
	if result, ok := data["result"].(map[string]interface{}); ok {
		if cv, ok := result["ConfidenceValue"].(string); ok {
			fmt.Sscanf(cv, "%f", &confidenceValue)
		}
	}

	passed := false
	if result, ok := data["result"].(map[string]interface{}); ok {
		if rc, ok := result["ResultCode"].(string); ok {
			passed = rc == "1"
		}
	}

	return &LivenessCheckResult{
		Passed:          passed,
		ConfidenceScore: confidenceValue,
		LivenessScore:   confidenceValue,
	}, nil
}

// PerformAMLScreening performs real AML screening using the AMLScreeningService
// This replaces the previous stubbed implementation with production-ready screening
func (s *KYCService) PerformAMLScreening(firstName, lastName, dateOfBirth, nationality, idNumber string) (*AMLScreeningResult, error) {
	// Create AML screening service with production configuration
	amlService := NewAMLScreeningService(nil) // Uses default config with ComplyAdvantage

	// Perform comprehensive screening
	screeningReq := &ScreeningRequest{
		ReferenceID:   fmt.Sprintf("kyc_%s", generateRandomHex(8)),
		FirstName:     firstName,
		LastName:      lastName,
		FullName:      firstName + " " + lastName,
		DateOfBirth:   dateOfBirth,
		Nationality:   nationality,
		IDNumber:      idNumber,
		ScreeningType: ScreeningTypeFull,
		Watchlists:    []WatchlistType{WatchlistOFAC, WatchlistUN, WatchlistEU, WatchlistUKHMT, WatchlistPEP, WatchlistAdverseMedia},
	}

	result, err := amlService.ScreenIndividual(screeningReq)
	if err != nil {
		return nil, fmt.Errorf("AML screening failed: %w", err)
	}

	// Convert to KYC AML result format
	matches := make([]AMLMatch, 0, len(result.Matches))
	for _, m := range result.Matches {
		matches = append(matches, AMLMatch{
			Name:  m.MatchedName,
			Type:  string(m.WatchlistType),
			Score: m.MatchScore,
		})
	}

	return &AMLScreeningResult{
		Passed:    result.ConfirmedMatches == 0 && result.RiskLevel != RiskLevelHigh,
		RiskScore: result.RiskScore,
		RiskLevel: result.RiskLevel,
		Matches:   matches,
	}, nil
}

// CheckSanctionsList performs real sanctions screening against OFAC, UN, EU, and UK HMT lists
// This replaces the previous stubbed implementation with production-ready screening
func (s *KYCService) CheckSanctionsList(firstName, lastName, dateOfBirth, nationality string) (*SanctionsCheckResult, error) {
	// Create AML screening service for sanctions-specific check
	amlService := NewAMLScreeningService(nil)

	// Perform sanctions-only screening
	screeningReq := &ScreeningRequest{
		ReferenceID:   fmt.Sprintf("sanctions_%s", generateRandomHex(8)),
		FirstName:     firstName,
		LastName:      lastName,
		FullName:      firstName + " " + lastName,
		DateOfBirth:   dateOfBirth,
		Nationality:   nationality,
		ScreeningType: ScreeningTypeSanctions,
		Watchlists:    []WatchlistType{WatchlistOFAC, WatchlistUN, WatchlistEU, WatchlistUKHMT, WatchlistInterpol, WatchlistFBI},
	}

	result, err := amlService.ScreenIndividual(screeningReq)
	if err != nil {
		return nil, fmt.Errorf("sanctions screening failed: %w", err)
	}

	// Convert to sanctions result format
	matches := make([]SanctionsMatch, 0, len(result.Matches))
	for _, m := range result.Matches {
		matches = append(matches, SanctionsMatch{
			ListName:   string(m.WatchlistType),
			MatchScore: m.MatchScore,
		})
	}

	// Sanctions check fails if any confirmed match or high-confidence potential match
	passed := true
	for _, m := range result.Matches {
		if m.Status == MatchStatusConfirmed || (m.Status == MatchStatusPotential && m.MatchScore > 0.85) {
			passed = false
			break
		}
	}

	return &SanctionsCheckResult{
		Passed:  passed,
		Matches: matches,
	}, nil
}

func (s *KYCService) CalculateRiskScore(kycResult *KYCResult, amlResult *AMLScreeningResult, sanctionsResult *SanctionsCheckResult, transactionAmount float64) *RiskScoreResult {
	factors := []RiskFactor{}
	var totalRisk float64

	kycRisk := 100 - kycResult.ConfidenceScore
	factors = append(factors, RiskFactor{
		Factor:      "KYC Confidence",
		Impact:      kycRisk * 0.3,
		Description: fmt.Sprintf("KYC confidence: %.1f%%", kycResult.ConfidenceScore),
	})
	totalRisk += kycRisk * 0.3

	factors = append(factors, RiskFactor{
		Factor:      "AML Screening",
		Impact:      amlResult.RiskScore * 0.3,
		Description: fmt.Sprintf("AML risk score: %.1f", amlResult.RiskScore),
	})
	totalRisk += amlResult.RiskScore * 0.3

	var sanctionsRisk float64
	if !sanctionsResult.Passed {
		sanctionsRisk = 100
	}
	factors = append(factors, RiskFactor{
		Factor: "Sanctions Check",
		Impact: sanctionsRisk * 0.2,
		Description: func() string {
			if sanctionsResult.Passed {
				return "No sanctions matches"
			}
			return "Sanctions match found"
		}(),
	})
	totalRisk += sanctionsRisk * 0.2

	amountRisk := (transactionAmount / 10000) * 10
	if amountRisk > 100 {
		amountRisk = 100
	}
	factors = append(factors, RiskFactor{
		Factor:      "Transaction Amount",
		Impact:      amountRisk * 0.2,
		Description: fmt.Sprintf("Amount: $%.2f", transactionAmount),
	})
	totalRisk += amountRisk * 0.2

	var riskLevel RiskLevel = RiskLevelLow
	if totalRisk > 70 {
		riskLevel = RiskLevelHigh
	} else if totalRisk > 40 {
		riskLevel = RiskLevelMedium
	}

	return &RiskScoreResult{
		OverallRiskScore: totalRisk,
		RiskLevel:        riskLevel,
		Factors:          factors,
	}
}

func (s *KYCService) getJobType(idType IDType) int {
	jobTypes := map[IDType]int{
		IDTypeBVN:            5,
		IDTypeNIN:            5,
		IDTypePassport:       6,
		IDTypeDriversLicense: 6,
	}
	if jt, ok := jobTypes[idType]; ok {
		return jt
	}
	return 5
}

func (s *KYCService) generateSignature(payload map[string]interface{}, timestamp string) string {
	payloadJSON, _ := json.Marshal(payload)
	signatureString := fmt.Sprintf("%s%s%s", s.partnerID, timestamp, string(payloadJSON))
	mac := hmac.New(sha256.New, []byte(s.apiKey))
	mac.Write([]byte(signatureString))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *KYCService) parseSmileIDResult(verificationID string, data *SmileIDJobResponse) *KYCResult {
	resultCode := data.Result.ResultCode
	var confidenceValue float64
	fmt.Sscanf(data.Result.ConfidenceValue, "%f", &confidenceValue)

	var status KYCStatus
	switch resultCode {
	case "1":
		status = KYCStatusApproved
	case "0":
		status = KYCStatusRejected
	case "-1":
		status = KYCStatusFailed
	default:
		status = KYCStatusInProgress
	}

	livenessCheck := data.Result.Actions.LivenessCheck == "Passed"
	documentMatch := data.Result.Actions.VerifyIDNumber == "Verified"

	riskScore := 100 - confidenceValue
	var riskLevel RiskLevel = RiskLevelLow
	if riskScore > 70 {
		riskLevel = RiskLevelHigh
	} else if riskScore > 40 {
		riskLevel = RiskLevelMedium
	}

	result := &KYCResult{
		VerificationID:  verificationID,
		Status:          status,
		ConfidenceScore: confidenceValue,
		LivenessCheck:   livenessCheck,
		DocumentMatch:   documentMatch,
		AMLScreening:    true,
		SanctionsCheck:  true,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
	}

	if status == KYCStatusRejected {
		result.RejectionReason = data.Result.ResultText
	}

	if status == KYCStatusApproved || status == KYCStatusRejected {
		completedAt, _ := time.Parse(time.RFC3339, data.Timestamp)
		result.CompletedAt = &completedAt
	}

	return result
}

func ValidateIDNumber(idType IDType, idNumber string) (bool, string) {
	patterns := map[IDType]struct {
		pattern *regexp.Regexp
		length  int
		name    string
	}{
		IDTypeBVN:            {regexp.MustCompile(`^\d{11}$`), 11, "Bank Verification Number"},
		IDTypeNIN:            {regexp.MustCompile(`^\d{11}$`), 11, "National ID Number"},
		IDTypePassport:       {regexp.MustCompile(`^[A-Z]\d{8}$`), 9, "Passport"},
		IDTypeDriversLicense: {regexp.MustCompile(`^[A-Z]{3}\d{9}[A-Z]{2}$`), 14, "Driver's License"},
	}

	config, ok := patterns[idType]
	if !ok {
		return false, fmt.Sprintf("Unsupported ID type: %s", idType)
	}

	if !config.pattern.MatchString(idNumber) {
		return false, fmt.Sprintf("Invalid %s format. Expected %d characters.", config.name, config.length)
	}

	return true, ""
}

func GetKYCRequirements(country string) *KYCRequirements {
	requirements := map[string]*KYCRequirements{
		"NG": {
			RequiredDocuments: []string{"BVN", "NIN", "PASSPORT", "DRIVERS_LICENSE"},
			OptionalDocuments: []string{"Utility Bill", "Bank Statement"},
			RequiresLiveness:  true,
			RequiresAML:       true,
		},
	}

	if req, ok := requirements[country]; ok {
		return req
	}

	return &KYCRequirements{
		RequiredDocuments: []string{"PASSPORT"},
		OptionalDocuments: []string{},
		RequiresLiveness:  true,
		RequiresAML:       true,
	}
}

func generateRandomHex(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return hex.EncodeToString(b)
}

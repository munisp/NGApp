package activities

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type KYCActivities struct {
	documentServiceURL  string
	livenessServiceURL  string
	amlServiceURL       string
	riskServiceURL      string
	webhookServiceURL   string
	httpClient          *http.Client
}

func NewKYCActivities() *KYCActivities {
	return &KYCActivities{
		documentServiceURL:  "http://document-verification-service:8001",
		livenessServiceURL:  "http://liveness-service:8002",
		amlServiceURL:       "http://aml-screening-service:8003",
		riskServiceURL:      "http://risk-scoring-service:8004",
		webhookServiceURL:   "http://document-verification-service:8001",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type DocumentVerificationResult struct {
	DocumentID      string                 `json:"document_id"`
	DocumentType    string                 `json:"document_type"`
	Status          string                 `json:"status"`
	ConfidenceScore float64                `json:"confidence_score"`
	ExtractedData   map[string]interface{} `json:"extracted_data"`
	FraudIndicators []string               `json:"fraud_indicators"`
}

func (a *KYCActivities) VerifyDocument(ctx context.Context, customerID string, documentPath string) (*DocumentVerificationResult, error) {
	payload := map[string]interface{}{
		"customer_id":   customerID,
		"document_path": documentPath,
		"ocr_engine":    "paddleocr",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.documentServiceURL+"/api/v1/documents/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("document verification request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("document verification failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result DocumentVerificationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

type LivenessCheckResult struct {
	CheckID        string  `json:"check_id"`
	IsLive         bool    `json:"is_live"`
	LivenessScore  float64 `json:"liveness_score"`
	FaceMatchScore float64 `json:"face_match_score"`
	SpoofingType   string  `json:"spoofing_type"`
}

func (a *KYCActivities) CheckLiveness(ctx context.Context, customerID string, selfiePath string, documentPhotoPath string) (*LivenessCheckResult, error) {
	payload := map[string]interface{}{
		"customer_id":         customerID,
		"selfie_path":         selfiePath,
		"document_photo_path": documentPhotoPath,
		"liveness_type":       "passive",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.livenessServiceURL+"/api/v1/liveness/check", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("liveness check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("liveness check failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result LivenessCheckResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if documentPhotoPath != "" {
		faceMatchPayload := map[string]interface{}{
			"image1_path": selfiePath,
			"image2_path": documentPhotoPath,
		}

		faceMatchBody, _ := json.Marshal(faceMatchPayload)
		faceMatchReq, _ := http.NewRequestWithContext(ctx, "POST", a.livenessServiceURL+"/api/v1/liveness/match-faces", bytes.NewReader(faceMatchBody))
		faceMatchReq.Header.Set("Content-Type", "application/json")

		faceMatchResp, err := a.httpClient.Do(faceMatchReq)
		if err == nil {
			defer faceMatchResp.Body.Close()
			var faceMatchResult map[string]interface{}
			if json.NewDecoder(faceMatchResp.Body).Decode(&faceMatchResult) == nil {
				if confidence, ok := faceMatchResult["confidence"].(float64); ok {
					result.FaceMatchScore = confidence
				}
			}
		}
	}

	return &result, nil
}

type NINVerificationResult struct {
	Status          string                 `json:"status"`
	ConfidenceScore float64                `json:"confidence_score"`
	MatchDetails    map[string]interface{} `json:"match_details"`
	VerifiedData    map[string]interface{} `json:"verified_data"`
}

func (a *KYCActivities) VerifyNIN(ctx context.Context, customerID string, nin string, firstName string, lastName string, dateOfBirth string) (*NINVerificationResult, error) {
	payload := map[string]interface{}{
		"customer_id":   customerID,
		"nin":           nin,
		"first_name":    firstName,
		"last_name":     lastName,
		"date_of_birth": dateOfBirth,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.documentServiceURL+"/api/v1/nin/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("NIN verification request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("NIN verification failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result NINVerificationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

type BVNVerificationResult struct {
	Status          string                 `json:"status"`
	ConfidenceScore float64                `json:"confidence_score"`
	MatchDetails    map[string]interface{} `json:"match_details"`
	VerifiedData    map[string]interface{} `json:"verified_data"`
}

func (a *KYCActivities) VerifyBVN(ctx context.Context, customerID string, bvn string, firstName string, lastName string, dateOfBirth string) (*BVNVerificationResult, error) {
	payload := map[string]interface{}{
		"customer_id":   customerID,
		"bvn":           bvn,
		"first_name":    firstName,
		"last_name":     lastName,
		"date_of_birth": dateOfBirth,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.documentServiceURL+"/api/v1/bvn/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("BVN verification request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("BVN verification failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result BVNVerificationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

type AMLScreeningResult struct {
	ScreeningID string  `json:"screening_id"`
	Status      string  `json:"status"`
	RiskLevel   string  `json:"risk_level"`
	HitCount    int     `json:"hit_count"`
	MatchScore  float64 `json:"match_score"`
}

func (a *KYCActivities) ScreenAML(ctx context.Context, customerID string, fullName string, dateOfBirth string, nationality string) (*AMLScreeningResult, error) {
	payload := map[string]interface{}{
		"customer_id":    customerID,
		"screening_type": "comprehensive",
		"full_name":      fullName,
		"date_of_birth":  dateOfBirth,
		"nationality":    nationality,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.amlServiceURL+"/api/v1/aml/screen", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("AML screening request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("AML screening failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result AMLScreeningResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

type RiskScoringResult struct {
	RiskScoreID     string                 `json:"risk_score_id"`
	OverallScore    float64                `json:"overall_score"`
	RiskLevel       string                 `json:"risk_level"`
	DDLevel         string                 `json:"dd_level"`
	Recommendations map[string]interface{} `json:"recommendations"`
}

func (a *KYCActivities) CalculateRiskScore(ctx context.Context, input map[string]interface{}) (*RiskScoringResult, error) {
	body, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.riskServiceURL+"/api/v1/risk/score", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("risk scoring request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("risk scoring failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result RiskScoringResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (a *KYCActivities) VerifyCAC(ctx context.Context, cacNumber string, companyName string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"cac_number":   cacNumber,
		"company_name": companyName,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.documentServiceURL+"/api/v1/cac/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CAC verification request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CAC verification failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}

func (a *KYCActivities) NotifyKYCStarted(ctx context.Context, customerID string, workflowID string) error {
	payload := map[string]interface{}{
		"event_type":  "kyc.started",
		"customer_id": customerID,
		"workflow_id": workflowID,
		"timestamp":   time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", a.webhookServiceURL+"/api/v1/webhooks/notify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("webhook notification failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (a *KYCActivities) NotifyKYCCompleted(ctx context.Context, customerID string, workflowID string, riskLevel string, riskScore float64, verificationDetails map[string]interface{}) error {
	payload := map[string]interface{}{
		"event_type":           "kyc.completed",
		"customer_id":          customerID,
		"workflow_id":          workflowID,
		"risk_level":           riskLevel,
		"risk_score":           riskScore,
		"verification_details": verificationDetails,
		"timestamp":            time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", a.webhookServiceURL+"/api/v1/webhooks/notify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("webhook notification failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (a *KYCActivities) NotifyKYCFailed(ctx context.Context, customerID string, workflowID string, status string, failedChecks []string) error {
	payload := map[string]interface{}{
		"event_type":    "kyc.failed",
		"customer_id":   customerID,
		"workflow_id":   workflowID,
		"status":        status,
		"failed_checks": failedChecks,
		"timestamp":     time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", a.webhookServiceURL+"/api/v1/webhooks/notify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("webhook notification failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (a *KYCActivities) PublishKYCEvent(ctx context.Context, output interface{}) error {
	return nil
}

func (a *KYCActivities) PublishKYBEvent(ctx context.Context, output interface{}) error {
	return nil
}

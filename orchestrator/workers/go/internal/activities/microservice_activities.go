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

// MicroserviceActivities contains activities that call microservices
type MicroserviceActivities struct {
	httpClient *http.Client
	baseURLs   map[string]string
}

// NewMicroserviceActivities creates a new instance
func NewMicroserviceActivities() *MicroserviceActivities {
	return &MicroserviceActivities{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURLs: map[string]string{
			"qr":           "http://qr-service:8001",
			"export":       "http://export-service:8002",
			"retry":        "http://retry-service:8003",
			"email":        "http://email-service:8004",
			"verification": "http://verification-service:8005",
			"analytics":    "http://analytics-service:8006",
		},
	}
}

// ============================================================================
// QR Code Generation Activities
// ============================================================================

type QRCodeRequest struct {
	SessionID     string
	Amount        int
	Currency      string
	MerchantID    int
	PaymentMethod string
}

type QRCodeResponse struct {
	QRCodeURL    string
	QRCodeBase64 string
	PaymentURL   string
	ExpiresAt    string
}

func (a *MicroserviceActivities) GenerateQRCode(ctx context.Context, req QRCodeRequest) (*QRCodeResponse, error) {
	url := fmt.Sprintf("%s/generate", a.baseURLs["qr"])
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}
	
	var qrResp QRCodeResponse
	if err := json.Unmarshal(resp, &qrResp); err != nil {
		return nil, err
	}
	
	return &qrResp, nil
}

func (a *MicroserviceActivities) VerifyQRCode(ctx context.Context, sessionID, signature string) (bool, error) {
	url := fmt.Sprintf("%s/verify", a.baseURLs["qr"])
	
	req := map[string]string{
		"session_id": sessionID,
		"signature":  signature,
	}
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return false, err
	}
	
	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return false, err
	}
	
	return result["valid"].(bool), nil
}

// ============================================================================
// Export Activities
// ============================================================================

type ExportRequest struct {
	Type       string
	Format     string
	StartDate  string
	EndDate    string
	MerchantID int
	Filters    map[string]interface{}
}

type ExportResponse struct {
	FileURL   string
	FileName  string
	RowCount  int
	ExpiresAt string
}

func (a *MicroserviceActivities) ExportData(ctx context.Context, req ExportRequest) (*ExportResponse, error) {
	url := fmt.Sprintf("%s/export", a.baseURLs["export"])
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}
	
	var exportResp ExportResponse
	if err := json.Unmarshal(resp, &exportResp); err != nil {
		return nil, err
	}
	
	return &exportResp, nil
}

// ============================================================================
// Payment Retry Activities
// ============================================================================

type RetryRequest struct {
	TransactionID     string
	SessionID         string
	RetryStrategy     string
	MaxAttempts       int
	RetryInterval     int
	AlternativeMethod string
	Metadata          map[string]interface{}
}

type RetryResponse struct {
	RetryID       string
	Status        string
	NextRetryAt   time.Time
	AttemptsLeft  int
	ScheduledJobs []string
}

func (a *MicroserviceActivities) SchedulePaymentRetry(ctx context.Context, req RetryRequest) (*RetryResponse, error) {
	url := fmt.Sprintf("%s/retry", a.baseURLs["retry"])
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}
	
	var retryResp RetryResponse
	if err := json.Unmarshal(resp, &retryResp); err != nil {
		return nil, err
	}
	
	return &retryResp, nil
}

func (a *MicroserviceActivities) GetRetryStatus(ctx context.Context, retryID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/status?retry_id=%s", a.baseURLs["retry"], retryID)
	
	resp, err := a.callMicroservice(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	var status map[string]interface{}
	if err := json.Unmarshal(resp, &status); err != nil {
		return nil, err
	}
	
	return status, nil
}

func (a *MicroserviceActivities) CancelRetry(ctx context.Context, retryID string) error {
	url := fmt.Sprintf("%s/cancel", a.baseURLs["retry"])
	
	req := map[string]string{
		"retry_id": retryID,
	}
	
	_, err := a.callMicroservice(ctx, "POST", url, req)
	return err
}

// ============================================================================
// Email Receipt Activities
// ============================================================================

type EmailReceiptRequest struct {
	TransactionID string
	Email         string
}

func (a *MicroserviceActivities) SendEmailReceipt(ctx context.Context, req EmailReceiptRequest) error {
	url := fmt.Sprintf("%s/send-receipt", a.baseURLs["email"])
	
	_, err := a.callMicroservice(ctx, "POST", url, req)
	return err
}

func (a *MicroserviceActivities) SendBulkReceipts(ctx context.Context, transactionIDs []string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/send-bulk-receipts", a.baseURLs["email"])
	
	req := map[string]interface{}{
		"transaction_ids": transactionIDs,
	}
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}
	
	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}
	
	return result, nil
}

// ============================================================================
// Email Verification Activities
// ============================================================================

type VerificationRequest struct {
	Email      string
	UserID     int
	MerchantID int
}

type VerificationResponse struct {
	Success   bool
	Token     string
	ExpiresAt string
}

func (a *MicroserviceActivities) SendVerificationEmail(ctx context.Context, req VerificationRequest) (*VerificationResponse, error) {
	url := fmt.Sprintf("%s/send-verification", a.baseURLs["verification"])
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}
	
	var verifyResp VerificationResponse
	if err := json.Unmarshal(resp, &verifyResp); err != nil {
		return nil, err
	}
	
	return &verifyResp, nil
}

func (a *MicroserviceActivities) VerifyEmail(ctx context.Context, token string) (bool, error) {
	url := fmt.Sprintf("%s/verify", a.baseURLs["verification"])
	
	req := map[string]string{
		"token": token,
	}
	
	resp, err := a.callMicroservice(ctx, "POST", url, req)
	if err != nil {
		return false, err
	}
	
	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return false, err
	}
	
	return result["success"].(bool), nil
}

// ============================================================================
// Analytics Activities
// ============================================================================

func (a *MicroserviceActivities) GetRealtimeMetrics(ctx context.Context) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/metrics/realtime", a.baseURLs["analytics"])
	
	resp, err := a.callMicroservice(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	var metrics map[string]interface{}
	if err := json.Unmarshal(resp, &metrics); err != nil {
		return nil, err
	}
	
	return metrics, nil
}

func (a *MicroserviceActivities) GetDashboardMetrics(ctx context.Context, merchantID int, period string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/metrics/dashboard?merchant_id=%d&period=%s", a.baseURLs["analytics"], merchantID, period)
	
	resp, err := a.callMicroservice(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	var metrics map[string]interface{}
	if err := json.Unmarshal(resp, &metrics); err != nil {
		return nil, err
	}
	
	return metrics, nil
}

// ============================================================================
// Helper Methods
// ============================================================================

func (a *MicroserviceActivities) callMicroservice(ctx context.Context, method, url string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call microservice: %w", err)
	}
	defer resp.Body.Close()
	
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("microservice returned error %d: %s", resp.StatusCode, string(respBody))
	}
	
	return respBody, nil
}

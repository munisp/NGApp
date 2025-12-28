package activities

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"github.com/rs/zerolog/log"
)

// EscrowAPIClient calls the Python escrow-api service
type EscrowAPIClient struct {
	cfg        *config.Config
	httpClient *http.Client
	middleware *middleware.Manager
}

// NewEscrowAPIClient creates a new escrow API client
func NewEscrowAPIClient(cfg *config.Config, mw *middleware.Manager) *EscrowAPIClient {
	return &EscrowAPIClient{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: cfg.HTTPClientTimeout,
		},
		middleware: mw,
	}
}

// CreateEscrowRequest represents escrow creation request
type CreateEscrowRequest struct {
	BuyerID     string  `json:"buyer_id"`
	SellerID    string  `json:"seller_id,omitempty"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Description string  `json:"description"`
	ProductURL  string  `json:"product_url,omitempty"`
	Platform    string  `json:"platform,omitempty"`
}

// CreateEscrowResponse represents escrow creation response
type CreateEscrowResponse struct {
	EscrowID    string    `json:"escrow_id"`
	Status      string    `json:"status"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	EscrowLink  string    `json:"escrow_link"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// EscrowDetails represents full escrow details
type EscrowDetails struct {
	EscrowID    string    `json:"escrow_id"`
	BuyerID     string    `json:"buyer_id"`
	SellerID    string    `json:"seller_id"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	Status      string    `json:"status"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// AcceptEscrowRequest represents escrow acceptance request
type AcceptEscrowRequest struct {
	EscrowID    string `json:"escrow_id"`
	SellerID    string `json:"seller_id"`
	BankCode    string `json:"bank_code"`
	AccountNumber string `json:"account_number"`
}

// ShipEscrowRequest represents shipping update request
type ShipEscrowRequest struct {
	EscrowID       string `json:"escrow_id"`
	TrackingNumber string `json:"tracking_number,omitempty"`
	Carrier        string `json:"carrier,omitempty"`
	ShippingProof  string `json:"shipping_proof,omitempty"`
}

// ConfirmDeliveryRequest represents delivery confirmation request
type ConfirmDeliveryRequest struct {
	EscrowID      string `json:"escrow_id"`
	DeliveryProof string `json:"delivery_proof,omitempty"`
	Rating        int    `json:"rating,omitempty"`
	Feedback      string `json:"feedback,omitempty"`
}

// DisputeRequest represents dispute opening request
type DisputeRequest struct {
	EscrowID string `json:"escrow_id"`
	Reason   string `json:"reason"`
	Evidence string `json:"evidence,omitempty"`
}

// RefundRequest represents refund request
type RefundRequest struct {
	EscrowID string  `json:"escrow_id"`
	Amount   float64 `json:"amount,omitempty"`
	Reason   string  `json:"reason"`
}

// FraudCheckRequest represents fraud assessment request
type FraudCheckRequest struct {
	TransactionID string  `json:"transaction_id"`
	Amount        float64 `json:"amount"`
	BuyerID       string  `json:"buyer_id"`
	SellerID      string  `json:"seller_id"`
	Platform      string  `json:"platform"`
}

// FraudCheckResponse represents fraud assessment response
type FraudCheckResponse struct {
	RiskScore   float64  `json:"risk_score"`
	RiskLevel   string   `json:"risk_level"`
	Flags       []string `json:"flags"`
	Approved    bool     `json:"approved"`
	RequiresKYC bool     `json:"requires_kyc"`
}

// KYCCheckRequest represents KYC check request
type KYCCheckRequest struct {
	UserID string  `json:"user_id"`
	Amount float64 `json:"amount"`
}

// KYCCheckResponse represents KYC check response
type KYCCheckResponse struct {
	Level         string  `json:"level"`
	Limit         float64 `json:"limit"`
	RequiresKYC   bool    `json:"requires_kyc"`
	NextLevel     string  `json:"next_level,omitempty"`
}

// CreateEscrow creates a new escrow via the Python API
func (c *EscrowAPIClient) CreateEscrow(ctx context.Context, req CreateEscrowRequest) (*CreateEscrowResponse, error) {
	url := fmt.Sprintf("%s/api/v1/escrow/create", c.cfg.EscrowAPIURL)
	
	resp, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return nil, fmt.Errorf("create escrow failed: %w", err)
	}

	var result CreateEscrowResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Publish event to Kafka
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEscrowCreated(ctx, result.EscrowID, map[string]interface{}{
			"buyer_id":    req.BuyerID,
			"seller_id":   req.SellerID,
			"amount":      req.Amount,
			"currency":    req.Currency,
			"description": req.Description,
		})
	}

	// Cache workflow mapping in Redis
	if c.middleware != nil && c.middleware.Redis().IsConnected() {
		c.middleware.Redis().CacheEscrowStatus(ctx, result.EscrowID, result.Status)
	}

	return &result, nil
}

// GetEscrow retrieves escrow details
func (c *EscrowAPIClient) GetEscrow(ctx context.Context, escrowID string) (*EscrowDetails, error) {
	url := fmt.Sprintf("%s/api/v1/escrow/%s", c.cfg.EscrowAPIURL, escrowID)
	
	resp, err := c.doRequest(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("get escrow failed: %w", err)
	}

	var result EscrowDetails
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// AcceptEscrow accepts an escrow (seller claims it)
func (c *EscrowAPIClient) AcceptEscrow(ctx context.Context, req AcceptEscrowRequest) error {
	url := fmt.Sprintf("%s/api/v1/escrow/accept", c.cfg.EscrowAPIURL)
	
	_, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return fmt.Errorf("accept escrow failed: %w", err)
	}

	// Publish event
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEvent(ctx, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:   "escrow.accepted",
			AggregateID: req.EscrowID,
			Timestamp:   time.Now(),
			Version:     1,
			Data:        map[string]interface{}{"seller_id": req.SellerID},
		})
	}

	return nil
}

// ShipEscrow marks escrow as shipped
func (c *EscrowAPIClient) ShipEscrow(ctx context.Context, req ShipEscrowRequest) error {
	url := fmt.Sprintf("%s/api/v1/escrow/ship", c.cfg.EscrowAPIURL)
	
	_, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return fmt.Errorf("ship escrow failed: %w", err)
	}

	// Publish event
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEvent(ctx, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:   "escrow.shipped",
			AggregateID: req.EscrowID,
			Timestamp:   time.Now(),
			Version:     1,
			Data:        map[string]interface{}{"tracking_number": req.TrackingNumber, "carrier": req.Carrier},
		})
	}

	return nil
}

// ConfirmDelivery confirms delivery and releases funds
func (c *EscrowAPIClient) ConfirmDelivery(ctx context.Context, req ConfirmDeliveryRequest) error {
	url := fmt.Sprintf("%s/api/v1/escrow/confirm-delivery", c.cfg.EscrowAPIURL)
	
	_, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return fmt.Errorf("confirm delivery failed: %w", err)
	}

	// Publish event
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEvent(ctx, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:   "escrow.delivered",
			AggregateID: req.EscrowID,
			Timestamp:   time.Now(),
			Version:     1,
			Data:        map[string]interface{}{"rating": req.Rating},
		})
	}

	return nil
}

// OpenDispute opens a dispute on an escrow
func (c *EscrowAPIClient) OpenDispute(ctx context.Context, req DisputeRequest) (string, error) {
	url := fmt.Sprintf("%s/api/v1/escrow/dispute", c.cfg.EscrowAPIURL)
	
	resp, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return "", fmt.Errorf("open dispute failed: %w", err)
	}

	var result struct {
		DisputeID string `json:"dispute_id"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	// Publish event
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishDisputeOpened(ctx, req.EscrowID, result.DisputeID, req.Reason)
	}

	return result.DisputeID, nil
}

// RefundEscrow initiates a refund
func (c *EscrowAPIClient) RefundEscrow(ctx context.Context, req RefundRequest) error {
	url := fmt.Sprintf("%s/api/v1/escrow/refund", c.cfg.EscrowAPIURL)
	
	_, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return fmt.Errorf("refund escrow failed: %w", err)
	}

	// Publish event
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEvent(ctx, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:   "escrow.refunded",
			AggregateID: req.EscrowID,
			Timestamp:   time.Now(),
			Version:     1,
			Data:        map[string]interface{}{"amount": req.Amount, "reason": req.Reason},
		})
	}

	return nil
}

// CheckFraud performs fraud assessment
func (c *EscrowAPIClient) CheckFraud(ctx context.Context, req FraudCheckRequest) (*FraudCheckResponse, error) {
	url := fmt.Sprintf("%s/api/v1/fraud/assess-transaction", c.cfg.EscrowAPIURL)
	
	resp, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return nil, fmt.Errorf("fraud check failed: %w", err)
	}

	var result FraudCheckResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Publish event if fraud detected
	if result.RiskLevel == "high" && c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEvent(ctx, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:   "fraud.detected",
			AggregateID: req.TransactionID,
			Timestamp:   time.Now(),
			Version:     1,
			Data:        map[string]interface{}{"risk_score": result.RiskScore, "flags": result.Flags},
		})
	}

	return &result, nil
}

// CheckKYC checks KYC requirements
func (c *EscrowAPIClient) CheckKYC(ctx context.Context, req KYCCheckRequest) (*KYCCheckResponse, error) {
	url := fmt.Sprintf("%s/api/v1/kyc/check-limit", c.cfg.EscrowAPIURL)
	
	resp, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return nil, fmt.Errorf("kyc check failed: %w", err)
	}

	var result KYCCheckResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Publish event if KYC required
	if result.RequiresKYC && c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishEvent(ctx, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
			EventType:   "kyc.required",
			AggregateID: req.UserID,
			Timestamp:   time.Now(),
			Version:     1,
			Data:        map[string]interface{}{"current_level": result.Level, "next_level": result.NextLevel},
		})
	}

	return &result, nil
}

// VerifyBank verifies bank account
func (c *EscrowAPIClient) VerifyBank(ctx context.Context, bankCode, accountNumber string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/v1/bank/verify", c.cfg.EscrowAPIURL)
	
	req := map[string]string{
		"bank_code":      bankCode,
		"account_number": accountNumber,
	}
	
	resp, err := c.doRequest(ctx, http.MethodPost, url, req)
	if err != nil {
		return nil, fmt.Errorf("bank verification failed: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return result, nil
}

// InitiatePayout initiates seller payout
func (c *EscrowAPIClient) InitiatePayout(ctx context.Context, escrowID, sellerID string, amount float64) error {
	// This would call the payment adapter endpoint
	log.Info().
		Str("escrow_id", escrowID).
		Str("seller_id", sellerID).
		Float64("amount", amount).
		Msg("Initiating payout")

	// Publish event
	if c.middleware != nil && c.middleware.Kafka().IsConnected() {
		c.middleware.Kafka().PublishPayoutInitiated(ctx, escrowID, sellerID, amount)
	}

	return nil
}

// doRequest performs HTTP request to the escrow API
func (c *EscrowAPIClient) doRequest(ctx context.Context, method, url string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	log.Debug().
		Str("method", method).
		Str("url", url).
		Msg("Calling escrow API")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

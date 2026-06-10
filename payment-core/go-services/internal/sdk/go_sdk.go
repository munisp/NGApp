// Package sdk provides client SDKs for the payment switch platform
package sdk

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// PaymentSwitchClient is the Go SDK for the payment switch platform
type PaymentSwitchClient struct {
	// Configuration
	baseURL   string
	apiKey    string
	apiSecret string

	// HTTP client
	httpClient *http.Client

	// Services
	Transfers    *TransferService
	Quotes       *QuoteService
	Parties      *PartyService
	Accounts     *AccountService
	Settlements  *SettlementService
	Participants *ParticipantService

	// Rate limiting
	rateLimiter *RateLimiter

	// Retry configuration
	maxRetries   int
	retryBackoff time.Duration

	// Request signing
	signer RequestSigner
}

// ClientConfig configures the SDK client
type ClientConfig struct {
	BaseURL       string
	APIKey        string
	APISecret     string
	Timeout       time.Duration
	MaxRetries    int
	RetryBackoff  time.Duration
	RateLimit     int // requests per second
	EnableSigning bool
}

// DefaultClientConfig returns default configuration
func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		BaseURL:       "https://api.payment-switch.local",
		Timeout:       30 * time.Second,
		MaxRetries:    3,
		RetryBackoff:  1 * time.Second,
		RateLimit:     100,
		EnableSigning: true,
	}
}

// NewPaymentSwitchClient creates a new SDK client
func NewPaymentSwitchClient(config ClientConfig) *PaymentSwitchClient {
	client := &PaymentSwitchClient{
		baseURL:      config.BaseURL,
		apiKey:       config.APIKey,
		apiSecret:    config.APISecret,
		maxRetries:   config.MaxRetries,
		retryBackoff: config.RetryBackoff,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		rateLimiter: NewRateLimiter(config.RateLimit),
	}

	if config.EnableSigning {
		client.signer = NewHMACSigner(config.APISecret)
	}

	// Initialize services
	client.Transfers = &TransferService{client: client}
	client.Quotes = &QuoteService{client: client}
	client.Parties = &PartyService{client: client}
	client.Accounts = &AccountService{client: client}
	client.Settlements = &SettlementService{client: client}
	client.Participants = &ParticipantService{client: client}

	return client
}

// doRequest performs an HTTP request with retry and rate limiting
func (c *PaymentSwitchClient) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	// Wait for rate limiter
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit exceeded: %w", err)
	}

	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		// Set headers
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", c.apiKey)
		req.Header.Set("X-Request-ID", generateRequestID())

		// Sign request
		if c.signer != nil {
			if err := c.signer.Sign(req); err != nil {
				return nil, fmt.Errorf("failed to sign request: %w", err)
			}
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(c.retryBackoff * time.Duration(attempt+1))
			continue
		}

		// Retry on 5xx errors
		if resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("server error: %d", resp.StatusCode)
			time.Sleep(c.retryBackoff * time.Duration(attempt+1))
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("max retries exceeded: %w", lastErr)
}

// TransferService handles transfer operations
type TransferService struct {
	client *PaymentSwitchClient
}

// Transfer represents a transfer
type Transfer struct {
	ID            string                 `json:"id"`
	PayerFSPID    string                 `json:"payer_fsp_id"`
	PayeeFSPID    string                 `json:"payee_fsp_id"`
	PayerPartyID  string                 `json:"payer_party_id"`
	PayeePartyID  string                 `json:"payee_party_id"`
	Amount        Amount                 `json:"amount"`
	TransferState string                 `json:"transfer_state"`
	CompletedAt   *time.Time             `json:"completed_at,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// Amount represents a monetary amount
type Amount struct {
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

// CreateTransferRequest for creating a transfer
type CreateTransferRequest struct {
	PayerFSPID   string                 `json:"payer_fsp_id"`
	PayeeFSPID   string                 `json:"payee_fsp_id"`
	PayerPartyID string                 `json:"payer_party_id"`
	PayeePartyID string                 `json:"payee_party_id"`
	Amount       Amount                 `json:"amount"`
	QuoteID      string                 `json:"quote_id,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// Create creates a new transfer
func (s *TransferService) Create(ctx context.Context, req *CreateTransferRequest) (*Transfer, error) {
	resp, err := s.client.doRequest(ctx, "POST", "/v2/transfers", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var transfer Transfer
	if err := json.NewDecoder(resp.Body).Decode(&transfer); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &transfer, nil
}

// Get retrieves a transfer by ID
func (s *TransferService) Get(ctx context.Context, transferID string) (*Transfer, error) {
	resp, err := s.client.doRequest(ctx, "GET", "/v2/transfers/"+transferID, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var transfer Transfer
	if err := json.NewDecoder(resp.Body).Decode(&transfer); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &transfer, nil
}

// List lists transfers with pagination
func (s *TransferService) List(ctx context.Context, opts *ListOptions) ([]*Transfer, error) {
	path := "/v2/transfers"
	if opts != nil {
		path += opts.ToQueryString()
	}

	resp, err := s.client.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var transfers []*Transfer
	if err := json.NewDecoder(resp.Body).Decode(&transfers); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return transfers, nil
}

// QuoteService handles quote operations
type QuoteService struct {
	client *PaymentSwitchClient
}

// Quote represents a quote
type Quote struct {
	ID             string    `json:"id"`
	PayerFSPID     string    `json:"payer_fsp_id"`
	PayeeFSPID     string    `json:"payee_fsp_id"`
	TransferAmount Amount    `json:"transfer_amount"`
	PayeeReceive   Amount    `json:"payee_receive_amount"`
	PayerFee       Amount    `json:"payer_fee"`
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}

// CreateQuoteRequest for creating a quote
type CreateQuoteRequest struct {
	PayerFSPID   string `json:"payer_fsp_id"`
	PayeeFSPID   string `json:"payee_fsp_id"`
	PayerPartyID string `json:"payer_party_id"`
	PayeePartyID string `json:"payee_party_id"`
	Amount       Amount `json:"amount"`
	AmountType   string `json:"amount_type"` // SEND or RECEIVE
}

// Create creates a new quote
func (s *QuoteService) Create(ctx context.Context, req *CreateQuoteRequest) (*Quote, error) {
	resp, err := s.client.doRequest(ctx, "POST", "/v2/quotes", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var quote Quote
	if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &quote, nil
}

// Get retrieves a quote by ID
func (s *QuoteService) Get(ctx context.Context, quoteID string) (*Quote, error) {
	resp, err := s.client.doRequest(ctx, "GET", "/v2/quotes/"+quoteID, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var quote Quote
	if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &quote, nil
}

// PartyService handles party operations
type PartyService struct {
	client *PaymentSwitchClient
}

// Party represents a party
type Party struct {
	PartyIDType  string                 `json:"party_id_type"`
	PartyID      string                 `json:"party_id"`
	FSPID        string                 `json:"fsp_id"`
	Name         string                 `json:"name"`
	PersonalInfo map[string]interface{} `json:"personal_info,omitempty"`
}

// Lookup looks up a party
func (s *PartyService) Lookup(ctx context.Context, partyIDType, partyID string) (*Party, error) {
	path := fmt.Sprintf("/v2/parties/%s/%s", partyIDType, partyID)
	resp, err := s.client.doRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var party Party
	if err := json.NewDecoder(resp.Body).Decode(&party); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &party, nil
}

// AccountService handles account operations
type AccountService struct {
	client *PaymentSwitchClient
}

// Account represents an account
type Account struct {
	ID       string `json:"id"`
	FSPID    string `json:"fsp_id"`
	Currency string `json:"currency"`
	Balance  string `json:"balance"`
	Status   string `json:"status"`
}

// GetBalance retrieves account balance
func (s *AccountService) GetBalance(ctx context.Context, accountID string) (*Account, error) {
	resp, err := s.client.doRequest(ctx, "GET", "/v2/accounts/"+accountID, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, parseError(resp)
	}

	var account Account
	if err := json.NewDecoder(resp.Body).Decode(&account); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &account, nil
}

// SettlementService handles settlement operations
type SettlementService struct {
	client *PaymentSwitchClient
}

// ParticipantService handles participant operations
type ParticipantService struct {
	client *PaymentSwitchClient
}

// ListOptions for list operations
type ListOptions struct {
	Limit  int
	Offset int
	Status string
	From   time.Time
	To     time.Time
}

// ToQueryString converts options to query string
func (o *ListOptions) ToQueryString() string {
	if o == nil {
		return ""
	}

	params := make([]string, 0)
	if o.Limit > 0 {
		params = append(params, fmt.Sprintf("limit=%d", o.Limit))
	}
	if o.Offset > 0 {
		params = append(params, fmt.Sprintf("offset=%d", o.Offset))
	}
	if o.Status != "" {
		params = append(params, fmt.Sprintf("status=%s", o.Status))
	}

	if len(params) == 0 {
		return ""
	}

	result := "?"
	for i, p := range params {
		if i > 0 {
			result += "&"
		}
		result += p
	}
	return result
}

// RateLimiter provides rate limiting
type RateLimiter struct {
	tokens     int
	maxTokens  int
	refillRate time.Duration
	lastRefill time.Time
	mu         sync.Mutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerSecond int) *RateLimiter {
	return &RateLimiter{
		tokens:     requestsPerSecond,
		maxTokens:  requestsPerSecond,
		refillRate: time.Second / time.Duration(requestsPerSecond),
		lastRefill: time.Now(),
	}
}

// Wait waits for a token
func (r *RateLimiter) Wait(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Refill tokens
	now := time.Now()
	elapsed := now.Sub(r.lastRefill)
	tokensToAdd := int(elapsed / r.refillRate)
	if tokensToAdd > 0 {
		r.tokens = min(r.tokens+tokensToAdd, r.maxTokens)
		r.lastRefill = now
	}

	if r.tokens > 0 {
		r.tokens--
		return nil
	}

	// Wait for next token
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(r.refillRate):
		return nil
	}
}

// RequestSigner signs requests
type RequestSigner interface {
	Sign(req *http.Request) error
}

// HMACSigner signs requests with HMAC
type HMACSigner struct {
	secret string
}

// NewHMACSigner creates a new HMAC signer
func NewHMACSigner(secret string) *HMACSigner {
	return &HMACSigner{secret: secret}
}

// Sign signs a request with HMAC-SHA256 using the timestamp + method + path as the signing payload
func (s *HMACSigner) Sign(req *http.Request) error {
	timestamp := time.Now().Unix()
	timestampStr := fmt.Sprintf("%d", timestamp)

	payload := fmt.Sprintf("%s:%s:%s", timestampStr, req.Method, req.URL.Path)

	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	req.Header.Set("X-Timestamp", timestampStr)
	req.Header.Set("X-Signature", signature)
	return nil
}

// APIError represents an API error
type APIError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func parseError(resp *http.Response) error {
	var apiErr APIError
	if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}
	return &apiErr
}

func generateRequestID() string {
	return fmt.Sprintf("req-%d", time.Now().UnixNano())
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

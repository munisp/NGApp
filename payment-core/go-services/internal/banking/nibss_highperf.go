// Package banking provides high-performance NIBSS integration.
// Replaces TypeScript nibssService.ts with connection pooling and timeout management.
package banking

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
	"sync/atomic"
	"time"
)

// NIBSSConfig configures the NIBSS client
type NIBSSConfig struct {
	APIURL           string
	APIKey           string
	InstitutionCode  string
	ConnectTimeout   time.Duration
	RequestTimeout   time.Duration
	MaxIdleConns     int
	MaxConnsPerHost  int
	IdleConnTimeout  time.Duration
	RetryAttempts    int
	RetryBackoff     time.Duration
}

// DefaultNIBSSConfig returns production defaults
func DefaultNIBSSConfig() NIBSSConfig {
	return NIBSSConfig{
		APIURL:          "https://api.nibss-plc.com.ng",
		ConnectTimeout:  5 * time.Second,
		RequestTimeout:  30 * time.Second,
		MaxIdleConns:    100,
		MaxConnsPerHost: 50,
		IdleConnTimeout: 90 * time.Second,
		RetryAttempts:   3,
		RetryBackoff:    500 * time.Millisecond,
	}
}

// TransferRequest represents a bank-to-bank transfer
type TransferRequest struct {
	Reference     string `json:"reference"`
	FromAccount   string `json:"fromAccount"`
	ToAccount     string `json:"toAccount"`
	ToBankCode    string `json:"toBankCode"`
	Amount        int64  `json:"amount"` // Kobo
	Narration     string `json:"narration"`
	NameEnquiryRef string `json:"nameEnquiryRef,omitempty"`
}

// TransferResponse from NIBSS
type TransferResponse struct {
	SessionID       string `json:"sessionId"`
	Reference       string `json:"reference"`
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	Amount          int64  `json:"amount"`
	TransactionDate string `json:"transactionDate"`
}

// NameEnquiryRequest for account validation
type NameEnquiryRequest struct {
	AccountNumber string `json:"accountNumber"`
	BankCode      string `json:"bankCode"`
}

// NameEnquiryResponse from NIBSS
type NameEnquiryResponse struct {
	AccountName   string `json:"accountName"`
	AccountNumber string `json:"accountNumber"`
	BankCode      string `json:"bankCode"`
	BankName      string `json:"bankName"`
	BVN           string `json:"bvn,omitempty"`
	Currency      string `json:"currency"`
	SessionID     string `json:"sessionId"`
	ResponseCode  string `json:"responseCode"`
}

// TransferStatus for tracking
type TransferStatus struct {
	Reference       string `json:"reference"`
	Status          string `json:"status"` // pending, processing, completed, failed, reversed
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	Amount          int64  `json:"amount,omitempty"`
	CompletedAt     *time.Time `json:"completedAt,omitempty"`
}

// NIBSSClient is a high-performance NIBSS client with connection pooling
type NIBSSClient struct {
	config NIBSSConfig
	client *http.Client

	// Request signing
	signingKey []byte

	// Stats
	totalRequests  uint64
	totalSuccess   uint64
	totalFailed    uint64
	totalRetried   uint64
	totalLatencyNs uint64

	// Circuit breaker state
	failures     uint32
	lastFailure  int64
	circuitOpen  uint32

	mu sync.RWMutex
}

// NewNIBSSClient creates a client with optimized transport
func NewNIBSSClient(config NIBSSConfig) *NIBSSClient {
	transport := &http.Transport{
		MaxIdleConns:        config.MaxIdleConns,
		MaxIdleConnsPerHost: config.MaxConnsPerHost,
		MaxConnsPerHost:     config.MaxConnsPerHost,
		IdleConnTimeout:     config.IdleConnTimeout,
		DisableCompression:  true, // NIBSS sends small payloads
		ForceAttemptHTTP2:   true,
	}

	return &NIBSSClient{
		config:     config,
		client:     &http.Client{Transport: transport, Timeout: config.RequestTimeout},
		signingKey: []byte(config.APIKey),
	}
}

// NameEnquiry validates a bank account (pre-transfer check)
// Performance: Single HTTP call with connection reuse, ~200-500ms
func (c *NIBSSClient) NameEnquiry(ctx context.Context, req *NameEnquiryRequest) (*NameEnquiryResponse, error) {
	if !c.isCircuitClosed() {
		return nil, fmt.Errorf("NIBSS circuit breaker is open")
	}

	start := time.Now()
	atomic.AddUint64(&c.totalRequests, 1)

	body, _ := json.Marshal(req)
	resp, err := c.doRequest(ctx, "POST", "/nip/nameenquiry", body)
	if err != nil {
		c.recordFailure()
		return nil, fmt.Errorf("name enquiry failed: %w", err)
	}
	defer resp.Body.Close()

	var result NameEnquiryResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.recordFailure()
		return nil, fmt.Errorf("decode response: %w", err)
	}

	c.recordSuccess(time.Since(start))
	return &result, nil
}

// Transfer initiates a bank-to-bank transfer via NIP
// Includes retry logic with exponential backoff
func (c *NIBSSClient) Transfer(ctx context.Context, req *TransferRequest) (*TransferResponse, error) {
	if !c.isCircuitClosed() {
		return nil, fmt.Errorf("NIBSS circuit breaker is open")
	}

	start := time.Now()
	atomic.AddUint64(&c.totalRequests, 1)

	body, _ := json.Marshal(req)

	var lastErr error
	for attempt := 0; attempt <= c.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			atomic.AddUint64(&c.totalRetried, 1)
			backoff := c.config.RetryBackoff * time.Duration(1<<uint(attempt-1))
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		resp, err := c.doRequest(ctx, "POST", "/nip/transfer", body)
		if err != nil {
			lastErr = err
			continue
		}

		var result TransferResponse
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if err := json.Unmarshal(respBody, &result); err != nil {
			lastErr = fmt.Errorf("decode response: %w", err)
			continue
		}

		// Check response code
		if result.ResponseCode == "00" { // Success
			c.recordSuccess(time.Since(start))
			return &result, nil
		}

		// Non-retryable errors
		if isNonRetryable(result.ResponseCode) {
			c.recordSuccess(time.Since(start)) // Not a client failure
			return &result, nil
		}

		lastErr = fmt.Errorf("NIBSS error %s: %s", result.ResponseCode, result.ResponseMessage)
	}

	c.recordFailure()
	return nil, fmt.Errorf("transfer failed after %d attempts: %w", c.config.RetryAttempts+1, lastErr)
}

// GetTransferStatus checks the status of a transfer
func (c *NIBSSClient) GetTransferStatus(ctx context.Context, reference string) (*TransferStatus, error) {
	start := time.Now()
	atomic.AddUint64(&c.totalRequests, 1)

	resp, err := c.doRequest(ctx, "GET", fmt.Sprintf("/nip/transfer/%s/status", reference), nil)
	if err != nil {
		c.recordFailure()
		return nil, err
	}
	defer resp.Body.Close()

	var result TransferStatus
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	c.recordSuccess(time.Since(start))
	return &result, nil
}

// doRequest executes an authenticated HTTP request
func (c *NIBSSClient) doRequest(ctx context.Context, method, path string, body []byte) (*http.Response, error) {
	url := c.config.APIURL + path

	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	// Set headers
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Institution-Code", c.config.InstitutionCode)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", c.sign(body, timestamp))

	return c.client.Do(req)
}

// sign generates HMAC-SHA256 signature for request
func (c *NIBSSClient) sign(body []byte, timestamp string) string {
	message := fmt.Sprintf("%s%s%s", c.config.InstitutionCode, timestamp, string(body))
	mac := hmac.New(sha256.New, c.signingKey)
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

// Circuit breaker methods
func (c *NIBSSClient) isCircuitClosed() bool {
	if atomic.LoadUint32(&c.circuitOpen) == 0 {
		return true
	}
	// Check if recovery timeout elapsed (30 seconds)
	lastFail := atomic.LoadInt64(&c.lastFailure)
	if time.Now().Unix()-lastFail > 30 {
		atomic.StoreUint32(&c.circuitOpen, 0)
		atomic.StoreUint32(&c.failures, 0)
		return true
	}
	return false
}

func (c *NIBSSClient) recordFailure() {
	atomic.AddUint64(&c.totalFailed, 1)
	failures := atomic.AddUint32(&c.failures, 1)
	atomic.StoreInt64(&c.lastFailure, time.Now().Unix())
	if failures >= 5 {
		atomic.StoreUint32(&c.circuitOpen, 1)
	}
}

func (c *NIBSSClient) recordSuccess(duration time.Duration) {
	atomic.AddUint64(&c.totalSuccess, 1)
	atomic.AddUint64(&c.totalLatencyNs, uint64(duration.Nanoseconds()))
	atomic.StoreUint32(&c.failures, 0)
}

// Stats returns client statistics
func (c *NIBSSClient) Stats() map[string]interface{} {
	total := atomic.LoadUint64(&c.totalRequests)
	totalNs := atomic.LoadUint64(&c.totalLatencyNs)
	success := atomic.LoadUint64(&c.totalSuccess)
	var avgLatency time.Duration
	if success > 0 {
		avgLatency = time.Duration(totalNs / success)
	}

	return map[string]interface{}{
		"total_requests":   total,
		"total_success":    success,
		"total_failed":     atomic.LoadUint64(&c.totalFailed),
		"total_retried":    atomic.LoadUint64(&c.totalRetried),
		"avg_latency":      avgLatency.String(),
		"circuit_open":     atomic.LoadUint32(&c.circuitOpen) == 1,
	}
}

// isNonRetryable returns true for NIBSS response codes that shouldn't be retried
func isNonRetryable(code string) bool {
	switch code {
	case "03", // Invalid Sender
		"05", // Do not honor
		"07", // Invalid Account
		"13", // Invalid Amount
		"14", // Invalid Account Number
		"51", // Insufficient Funds
		"57", // Transaction Not Permitted
		"63": // Security Violation
		return true
	}
	return false
}

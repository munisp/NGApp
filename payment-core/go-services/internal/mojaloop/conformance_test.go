// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"
)

// ConformanceTestSuite runs Mojaloop conformance tests
type ConformanceTestSuite struct {
	baseURL    string
	httpClient *http.Client
	t          *testing.T
}

// NewConformanceTestSuite creates a new conformance test suite
func NewConformanceTestSuite(t *testing.T, baseURL string) *ConformanceTestSuite {
	return &ConformanceTestSuite{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		t: t,
	}
}

// TestTransferPrepare tests the transfer prepare endpoint
func (s *ConformanceTestSuite) TestTransferPrepare() {
	s.t.Run("PrepareTransfer_Success", func(t *testing.T) {
		req := map[string]interface{}{
			"transferId": "550e8400-e29b-41d4-a716-446655440000",
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}

		resp, err := s.post("/api/v1/mojaloop/transfers/prepare", req)
		if err != nil {
			t.Fatalf("Failed to prepare transfer: %v", err)
		}

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected 200/202, got %d: %s", resp.StatusCode, string(body))
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		if result["transferState"] != "RESERVED" {
			t.Errorf("Expected state RESERVED, got %v", result["transferState"])
		}
	})

	s.t.Run("PrepareTransfer_Idempotent", func(t *testing.T) {
		transferID := "550e8400-e29b-41d4-a716-446655440001"
		req := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "50.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}

		// First request
		resp1, _ := s.post("/api/v1/mojaloop/transfers/prepare", req)
		body1, _ := io.ReadAll(resp1.Body)

		// Second request with same ID (should be idempotent)
		resp2, _ := s.post("/api/v1/mojaloop/transfers/prepare", req)
		body2, _ := io.ReadAll(resp2.Body)

		if resp1.StatusCode != resp2.StatusCode {
			t.Errorf("Idempotency failed: first=%d, second=%d", resp1.StatusCode, resp2.StatusCode)
		}

		if string(body1) != string(body2) {
			t.Errorf("Idempotency failed: responses differ")
		}
	})

	s.t.Run("PrepareTransfer_DifferentParams_SameID", func(t *testing.T) {
		transferID := "550e8400-e29b-41d4-a716-446655440002"
		req1 := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}

		// First request
		s.post("/api/v1/mojaloop/transfers/prepare", req1)

		// Second request with different amount (should fail)
		req2 := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "200.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}

		resp2, _ := s.post("/api/v1/mojaloop/transfers/prepare", req2)
		if resp2.StatusCode != http.StatusConflict && resp2.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 409/400 for different params with same ID, got %d", resp2.StatusCode)
		}
	})
}

// TestTransferFulfill tests the transfer fulfill endpoint
func (s *ConformanceTestSuite) TestTransferFulfill() {
	s.t.Run("FulfillTransfer_Success", func(t *testing.T) {
		// First prepare a transfer
		transferID := "550e8400-e29b-41d4-a716-446655440010"
		prepareReq := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}
		s.post("/api/v1/mojaloop/transfers/prepare", prepareReq)

		// Now fulfill
		fulfillReq := map[string]interface{}{
			"transferId":    transferID,
			"fulfillment":   "UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA",
			"transferState": "COMMITTED",
		}

		resp, err := s.post("/api/v1/mojaloop/transfers/fulfill", fulfillReq)
		if err != nil {
			t.Fatalf("Failed to fulfill transfer: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(body))
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		if result["transferState"] != "COMMITTED" {
			t.Errorf("Expected state COMMITTED, got %v", result["transferState"])
		}
	})

	s.t.Run("FulfillTransfer_WrongFulfillment", func(t *testing.T) {
		// First prepare a transfer
		transferID := "550e8400-e29b-41d4-a716-446655440011"
		prepareReq := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}
		s.post("/api/v1/mojaloop/transfers/prepare", prepareReq)

		// Try to fulfill with wrong fulfillment
		fulfillReq := map[string]interface{}{
			"transferId":    transferID,
			"fulfillment":   "WRONG_FULFILLMENT_VALUE_HERE_AAAAAAAAAAAAAAAA",
			"transferState": "COMMITTED",
		}

		resp, _ := s.post("/api/v1/mojaloop/transfers/fulfill", fulfillReq)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for wrong fulfillment, got %d", resp.StatusCode)
		}
	})

	s.t.Run("FulfillTransfer_AfterAbort", func(t *testing.T) {
		// First prepare a transfer
		transferID := "550e8400-e29b-41d4-a716-446655440012"
		prepareReq := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}
		s.post("/api/v1/mojaloop/transfers/prepare", prepareReq)

		// Abort the transfer
		abortReq := map[string]interface{}{
			"transferId":       transferID,
			"errorCode":        "5100",
			"errorDescription": "Payer rejected",
		}
		s.post("/api/v1/mojaloop/transfers/abort", abortReq)

		// Try to fulfill after abort (should fail)
		fulfillReq := map[string]interface{}{
			"transferId":    transferID,
			"fulfillment":   "UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA",
			"transferState": "COMMITTED",
		}

		resp, _ := s.post("/api/v1/mojaloop/transfers/fulfill", fulfillReq)
		if resp.StatusCode != http.StatusConflict && resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 409/400 for fulfill after abort, got %d", resp.StatusCode)
		}
	})
}

// TestTransferAbort tests the transfer abort endpoint
func (s *ConformanceTestSuite) TestTransferAbort() {
	s.t.Run("AbortTransfer_Success", func(t *testing.T) {
		// First prepare a transfer
		transferID := "550e8400-e29b-41d4-a716-446655440020"
		prepareReq := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}
		s.post("/api/v1/mojaloop/transfers/prepare", prepareReq)

		// Abort the transfer
		abortReq := map[string]interface{}{
			"transferId":       transferID,
			"errorCode":        "5100",
			"errorDescription": "Payer rejected",
		}

		resp, err := s.post("/api/v1/mojaloop/transfers/abort", abortReq)
		if err != nil {
			t.Fatalf("Failed to abort transfer: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(body))
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		if result["transferState"] != "ABORTED" {
			t.Errorf("Expected state ABORTED, got %v", result["transferState"])
		}
	})

	s.t.Run("AbortTransfer_AfterFulfill", func(t *testing.T) {
		// First prepare and fulfill a transfer
		transferID := "550e8400-e29b-41d4-a716-446655440021"
		prepareReq := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}
		s.post("/api/v1/mojaloop/transfers/prepare", prepareReq)

		fulfillReq := map[string]interface{}{
			"transferId":    transferID,
			"fulfillment":   "UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA",
			"transferState": "COMMITTED",
		}
		s.post("/api/v1/mojaloop/transfers/fulfill", fulfillReq)

		// Try to abort after fulfill (should fail)
		abortReq := map[string]interface{}{
			"transferId":       transferID,
			"errorCode":        "5100",
			"errorDescription": "Payer rejected",
		}

		resp, _ := s.post("/api/v1/mojaloop/transfers/abort", abortReq)
		if resp.StatusCode != http.StatusConflict && resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 409/400 for abort after fulfill, got %d", resp.StatusCode)
		}
	})
}

// TestConcurrentTransfers tests concurrent transfer processing
func (s *ConformanceTestSuite) TestConcurrentTransfers() {
	s.t.Run("ConcurrentPrepare_SameID", func(t *testing.T) {
		transferID := "550e8400-e29b-41d4-a716-446655440030"
		req := map[string]interface{}{
			"transferId": transferID,
			"payerFsp":   "dfsp1",
			"payeeFsp":   "dfsp2",
			"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
			"ilpPacket":  "AQAAAAAAAABkEGcuZXhhbXBsZS5wYXllZQ",
			"condition":  "f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA",
			"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
		}

		// Send 10 concurrent requests with same ID
		results := make(chan int, 10)
		for i := 0; i < 10; i++ {
			go func() {
				resp, _ := s.post("/api/v1/mojaloop/transfers/prepare", req)
				results <- resp.StatusCode
			}()
		}

		// Collect results
		successCount := 0
		for i := 0; i < 10; i++ {
			status := <-results
			if status == http.StatusOK || status == http.StatusAccepted {
				successCount++
			}
		}

		// All should succeed due to idempotency
		if successCount != 10 {
			t.Errorf("Expected all 10 concurrent requests to succeed, got %d", successCount)
		}
	})
}

// TestParticipantRegistration tests participant registration
func (s *ConformanceTestSuite) TestParticipantRegistration() {
	s.t.Run("RegisterParticipant_Success", func(t *testing.T) {
		req := map[string]interface{}{
			"fspId":    "dfsp_test_1",
			"name":     "Test DFSP 1",
			"currency": "USD",
		}

		resp, err := s.post("/api/v1/mojaloop/participants/register", req)
		if err != nil {
			t.Fatalf("Failed to register participant: %v", err)
		}

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected 200/201, got %d: %s", resp.StatusCode, string(body))
		}
	})

	s.t.Run("GetParticipantPosition", func(t *testing.T) {
		// First register a participant
		regReq := map[string]interface{}{
			"fspId":    "dfsp_test_2",
			"name":     "Test DFSP 2",
			"currency": "USD",
		}
		s.post("/api/v1/mojaloop/participants/register", regReq)

		// Get position
		resp, err := s.get("/api/v1/mojaloop/participants/position?fspId=dfsp_test_2")
		if err != nil {
			t.Fatalf("Failed to get position: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(body))
		}
	})
}

// Helper methods

func (s *ConformanceTestSuite) post(path string, body interface{}) (*http.Response, error) {
	jsonBody, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", s.baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return s.httpClient.Do(req)
}

func (s *ConformanceTestSuite) get(path string) (*http.Response, error) {
	req, err := http.NewRequest("GET", s.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	return s.httpClient.Do(req)
}

// RunConformanceTests runs all conformance tests
func RunConformanceTests(t *testing.T, baseURL string) {
	suite := NewConformanceTestSuite(t, baseURL)

	t.Run("TransferPrepare", func(t *testing.T) {
		suite.TestTransferPrepare()
	})

	t.Run("TransferFulfill", func(t *testing.T) {
		suite.TestTransferFulfill()
	})

	t.Run("TransferAbort", func(t *testing.T) {
		suite.TestTransferAbort()
	})

	t.Run("ConcurrentTransfers", func(t *testing.T) {
		suite.TestConcurrentTransfers()
	})

	t.Run("ParticipantRegistration", func(t *testing.T) {
		suite.TestParticipantRegistration()
	})
}

// ConformanceTestRunner provides a CLI interface for running conformance tests
type ConformanceTestRunner struct {
	baseURL string
}

// NewConformanceTestRunner creates a new test runner
func NewConformanceTestRunner(baseURL string) *ConformanceTestRunner {
	return &ConformanceTestRunner{baseURL: baseURL}
}

// Run runs all conformance tests and returns results
func (r *ConformanceTestRunner) Run(ctx context.Context) (*ConformanceTestResults, error) {
	results := &ConformanceTestResults{
		StartTime: time.Now(),
		Tests:     make([]TestResult, 0),
	}

	// Run each test category
	categories := []struct {
		name string
		fn   func() error
	}{
		{"TransferPrepare", r.testTransferPrepare},
		{"TransferFulfill", r.testTransferFulfill},
		{"TransferAbort", r.testTransferAbort},
		{"Idempotency", r.testIdempotency},
		{"RaceConditions", r.testRaceConditions},
	}

	for _, cat := range categories {
		result := TestResult{
			Name:      cat.name,
			StartTime: time.Now(),
		}

		err := cat.fn()
		result.EndTime = time.Now()
		result.Duration = result.EndTime.Sub(result.StartTime)

		if err != nil {
			result.Passed = false
			result.Error = err.Error()
		} else {
			result.Passed = true
		}

		results.Tests = append(results.Tests, result)
	}

	results.EndTime = time.Now()
	results.Duration = results.EndTime.Sub(results.StartTime)

	// Calculate summary
	for _, test := range results.Tests {
		if test.Passed {
			results.Passed++
		} else {
			results.Failed++
		}
	}

	return results, nil
}

// ConformanceTestResults holds the results of a conformance test run
type ConformanceTestResults struct {
	StartTime time.Time     `json:"start_time"`
	EndTime   time.Time     `json:"end_time"`
	Duration  time.Duration `json:"duration"`
	Passed    int           `json:"passed"`
	Failed    int           `json:"failed"`
	Tests     []TestResult  `json:"tests"`
}

// TestResult holds the result of a single test
type TestResult struct {
	Name      string        `json:"name"`
	Passed    bool          `json:"passed"`
	Error     string        `json:"error,omitempty"`
	StartTime time.Time     `json:"start_time"`
	EndTime   time.Time     `json:"end_time"`
	Duration  time.Duration `json:"duration"`
}

func (r *ConformanceTestRunner) testTransferPrepare() error {
	req := map[string]interface{}{
		"transferId": fmt.Sprintf("test-%d", time.Now().UnixNano()),
		"payerFsp":   "dfsp1",
		"payeeFsp":   "dfsp2",
		"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
	}

	jsonBody, _ := json.Marshal(req)
	resp, err := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/prepare", "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("expected 200/202, got %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (r *ConformanceTestRunner) testTransferFulfill() error {
	// Prepare first
	transferID := fmt.Sprintf("test-%d", time.Now().UnixNano())
	prepareReq := map[string]interface{}{
		"transferId": transferID,
		"payerFsp":   "dfsp1",
		"payeeFsp":   "dfsp2",
		"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
	}

	jsonBody, _ := json.Marshal(prepareReq)
	http.Post(r.baseURL+"/api/v1/mojaloop/transfers/prepare", "application/json", bytes.NewReader(jsonBody))

	// Fulfill
	fulfillReq := map[string]interface{}{
		"transferId":  transferID,
		"fulfillment": "test-fulfillment",
	}

	jsonBody, _ = json.Marshal(fulfillReq)
	resp, err := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/fulfill", "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (r *ConformanceTestRunner) testTransferAbort() error {
	// Prepare first
	transferID := fmt.Sprintf("test-%d", time.Now().UnixNano())
	prepareReq := map[string]interface{}{
		"transferId": transferID,
		"payerFsp":   "dfsp1",
		"payeeFsp":   "dfsp2",
		"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
	}

	jsonBody, _ := json.Marshal(prepareReq)
	http.Post(r.baseURL+"/api/v1/mojaloop/transfers/prepare", "application/json", bytes.NewReader(jsonBody))

	// Abort
	abortReq := map[string]interface{}{
		"transferId": transferID,
		"errorCode":  "5100",
	}

	jsonBody, _ = json.Marshal(abortReq)
	resp, err := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/abort", "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (r *ConformanceTestRunner) testIdempotency() error {
	transferID := fmt.Sprintf("test-%d", time.Now().UnixNano())
	req := map[string]interface{}{
		"transferId": transferID,
		"payerFsp":   "dfsp1",
		"payeeFsp":   "dfsp2",
		"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
	}

	jsonBody, _ := json.Marshal(req)

	// First request
	resp1, _ := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/prepare", "application/json", bytes.NewReader(jsonBody))
	body1, _ := io.ReadAll(resp1.Body)
	resp1.Body.Close()

	// Second request (should be idempotent)
	resp2, _ := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/prepare", "application/json", bytes.NewReader(jsonBody))
	body2, _ := io.ReadAll(resp2.Body)
	resp2.Body.Close()

	if resp1.StatusCode != resp2.StatusCode {
		return fmt.Errorf("idempotency failed: status codes differ (%d vs %d)", resp1.StatusCode, resp2.StatusCode)
	}

	if string(body1) != string(body2) {
		return fmt.Errorf("idempotency failed: response bodies differ")
	}

	return nil
}

func (r *ConformanceTestRunner) testRaceConditions() error {
	transferID := fmt.Sprintf("test-%d", time.Now().UnixNano())

	// Prepare
	prepareReq := map[string]interface{}{
		"transferId": transferID,
		"payerFsp":   "dfsp1",
		"payeeFsp":   "dfsp2",
		"amount":     map[string]interface{}{"amount": "100.00", "currency": "USD"},
	}
	jsonBody, _ := json.Marshal(prepareReq)
	http.Post(r.baseURL+"/api/v1/mojaloop/transfers/prepare", "application/json", bytes.NewReader(jsonBody))

	// Send fulfill and abort concurrently
	fulfillReq := map[string]interface{}{"transferId": transferID, "fulfillment": "test"}
	abortReq := map[string]interface{}{"transferId": transferID, "errorCode": "5100"}

	fulfillBody, _ := json.Marshal(fulfillReq)
	abortBody, _ := json.Marshal(abortReq)

	results := make(chan string, 2)

	go func() {
		resp, _ := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/fulfill", "application/json", bytes.NewReader(fulfillBody))
		if resp.StatusCode == http.StatusOK {
			results <- "fulfill"
		} else {
			results <- "fulfill-failed"
		}
	}()

	go func() {
		resp, _ := http.Post(r.baseURL+"/api/v1/mojaloop/transfers/abort", "application/json", bytes.NewReader(abortBody))
		if resp.StatusCode == http.StatusOK {
			results <- "abort"
		} else {
			results <- "abort-failed"
		}
	}()

	// Exactly one should succeed
	r1 := <-results
	r2 := <-results

	successCount := 0
	if r1 == "fulfill" || r1 == "abort" {
		successCount++
	}
	if r2 == "fulfill" || r2 == "abort" {
		successCount++
	}

	if successCount != 1 {
		return fmt.Errorf("race condition: expected exactly 1 success, got %d (%s, %s)", successCount, r1, r2)
	}

	return nil
}

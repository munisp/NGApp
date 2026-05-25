package mojaloop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a real Mojaloop central-ledger / ALS / quoting-service client.
type Client struct {
	centralLedgerURL string
	alsURL           string
	quotingURL       string
	transferURL      string
	http             *http.Client
}

// NewClient creates a Mojaloop client from environment.
func NewClient() *Client {
	return &Client{
		centralLedgerURL: envOr("MOJALOOP_CENTRAL_LEDGER_URL", "http://central-ledger:3001"),
		alsURL:           envOr("MOJALOOP_ALS_URL", "http://account-lookup-service:4002"),
		quotingURL:       envOr("MOJALOOP_QUOTING_URL", "http://quoting-service:3002"),
		transferURL:      envOr("MOJALOOP_TRANSFER_URL", "http://ml-api-adapter:3000"),
		http:             &http.Client{Timeout: 15 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies central-ledger is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.centralLedgerURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("mojaloop health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("mojaloop unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// Participant represents a Mojaloop participant (FSP).
type Participant struct {
	Name     string  `json:"name"`
	FSPID    string  `json:"fspId"`
	Currency string  `json:"currency"`
	IsActive int     `json:"isActive"`
	NDC      float64 `json:"netDebitCap"`
}

// ListParticipants returns all registered participants.
func (c *Client) ListParticipants(ctx context.Context) ([]Participant, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.centralLedgerURL+"/participants", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/vnd.interoperability.participants+json;version=1.1")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var participants []Participant
	json.NewDecoder(resp.Body).Decode(&participants)
	return participants, nil
}

// RegisterParticipant registers a new FSP with Mojaloop hub.
func (c *Client) RegisterParticipant(ctx context.Context, name, currency string, ndc float64) error {
	payload := map[string]interface{}{
		"name":     name,
		"currency": currency,
		"limit": map[string]interface{}{
			"type":  "NET_DEBIT_CAP",
			"value": ndc,
		},
		"initialPosition": 0,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", c.centralLedgerURL+"/participants", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("register participant: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("register failed: status %d", resp.StatusCode)
	}
	return nil
}

// PartyLookup resolves a party via the Account Lookup Service.
func (c *Client) PartyLookup(ctx context.Context, idType, idValue, sourceFSP string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/parties/%s/%s", c.alsURL, idType, idValue)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/vnd.interoperability.parties+json;version=1.1")
	req.Header.Set("FSPIOP-Source", sourceFSP)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("party lookup: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// QuoteRequest represents a Mojaloop quote request.
type QuoteRequest struct {
	QuoteID        string  `json:"quoteId"`
	TransactionID  string  `json:"transactionId"`
	PayerFSP       string  `json:"payerFsp"`
	PayeeFSP       string  `json:"payeeFsp"`
	AmountType     string  `json:"amountType"`
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
}

// RequestQuote submits a quote request.
func (c *Client) RequestQuote(ctx context.Context, quote QuoteRequest) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"quoteId":       quote.QuoteID,
		"transactionId": quote.TransactionID,
		"payer": map[string]interface{}{
			"partyIdInfo": map[string]string{"fspId": quote.PayerFSP},
		},
		"payee": map[string]interface{}{
			"partyIdInfo": map[string]string{"fspId": quote.PayeeFSP},
		},
		"amountType": quote.AmountType,
		"amount": map[string]interface{}{
			"amount":   fmt.Sprintf("%.2f", quote.Amount),
			"currency": quote.Currency,
		},
		"transactionType": map[string]interface{}{
			"scenario":  "TRANSFER",
			"initiator": "PAYER",
			"initiatorType": "CONSUMER",
		},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", c.quotingURL+"/quotes", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/vnd.interoperability.quotes+json;version=1.1")
	req.Header.Set("FSPIOP-Source", quote.PayerFSP)
	req.Header.Set("FSPIOP-Destination", quote.PayeeFSP)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request quote: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// PrepareTransfer submits a transfer prepare request.
func (c *Client) PrepareTransfer(ctx context.Context, transferID, payerFSP, payeeFSP string, amount float64, currency, condition string) error {
	payload := map[string]interface{}{
		"transferId": transferID,
		"payerFsp":   payerFSP,
		"payeeFsp":   payeeFSP,
		"amount": map[string]interface{}{
			"amount":   fmt.Sprintf("%.2f", amount),
			"currency": currency,
		},
		"ilpPacket":  "",
		"condition":  condition,
		"expiration": time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", c.transferURL+"/transfers", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/vnd.interoperability.transfers+json;version=1.1")
	req.Header.Set("FSPIOP-Source", payerFSP)
	req.Header.Set("FSPIOP-Destination", payeeFSP)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("prepare transfer: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("prepare transfer failed: status %d", resp.StatusCode)
	}
	return nil
}

// GetParticipantPosition returns the current position for a participant.
func (c *Client) GetParticipantPosition(ctx context.Context, fspName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/participants/%s/positions", c.centralLedgerURL, fspName)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// SettlementWindow represents a settlement window.
type SettlementWindow struct {
	ID        int       `json:"settlementWindowId"`
	State     string    `json:"state"`
	CreatedAt time.Time `json:"createdDate"`
	ClosedAt  *time.Time `json:"changedDate"`
}

// GetSettlementWindows returns recent settlement windows.
func (c *Client) GetSettlementWindows(ctx context.Context) ([]SettlementWindow, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.centralLedgerURL+"/settlementWindows", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var windows []SettlementWindow
	json.NewDecoder(resp.Body).Decode(&windows)
	return windows, nil
}

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

// Client provides Mojaloop payment hub integration.
type Client struct {
	httpClient *http.Client
	baseURL    string
	fspiID     string
}

// NewClient creates a Mojaloop client.
func NewClient() *Client {
	url := os.Getenv("MOJALOOP_URL")
	if url == "" {
		url = "http://mojaloop:4003"
	}
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    url,
		fspiID:     os.Getenv("MOJALOOP_FSPI_ID"),
	}
}

// Transfer represents a Mojaloop transfer request.
type Transfer struct {
	TransferID string  `json:"transferId"`
	PayerFSP   string  `json:"payerFsp"`
	PayeeFSP   string  `json:"payeeFsp"`
	Amount     Amount  `json:"amount"`
	Condition  string  `json:"condition"`
	Expiry     string  `json:"expiration"`
}

type Amount struct {
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

// PartyLookup finds a party (account holder) by identifier.
type PartyLookup struct {
	PartyIDType string `json:"partyIdType"` // MSISDN, ACCOUNT_ID, etc.
	PartyID     string `json:"partyIdentifier"`
}

type PartyResult struct {
	PartyIDInfo struct {
		PartyIDType     string `json:"partyIdType"`
		PartyIdentifier string `json:"partyIdentifier"`
		FSPID           string `json:"fspId"`
	} `json:"partyIdInfo"`
	Name string `json:"name"`
}

// LookupParty resolves an account holder via Mojaloop Account Lookup Service.
func (c *Client) LookupParty(ctx context.Context, idType, id string) (*PartyResult, error) {
	url := fmt.Sprintf("%s/parties/%s/%s", c.baseURL, idType, id)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Accept", "application/vnd.interoperability.parties+json;version=1.1")
	req.Header.Set("FSPIOP-Source", c.fspiID)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mojaloop party lookup: %w", err)
	}
	defer resp.Body.Close()

	var result PartyResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// InitiateTransfer starts a Mojaloop transfer.
func (c *Client) InitiateTransfer(ctx context.Context, transfer Transfer) error {
	body, _ := json.Marshal(transfer)
	url := fmt.Sprintf("%s/transfers", c.baseURL)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/vnd.interoperability.transfers+json;version=1.1")
	req.Header.Set("FSPIOP-Source", c.fspiID)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("mojaloop transfer: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("mojaloop transfer status %d", resp.StatusCode)
	}
	return nil
}

// QuoteRequest requests a quote for a transfer.
type QuoteRequest struct {
	QuoteID       string `json:"quoteId"`
	TransactionID string `json:"transactionId"`
	Payer         Party  `json:"payer"`
	Payee         Party  `json:"payee"`
	AmountType    string `json:"amountType"` // SEND, RECEIVE
	Amount        Amount `json:"amount"`
}

type Party struct {
	PartyIDInfo struct {
		PartyIDType     string `json:"partyIdType"`
		PartyIdentifier string `json:"partyIdentifier"`
		FSPID           string `json:"fspId"`
	} `json:"partyIdInfo"`
}

// RequestQuote sends a quote request to Mojaloop.
func (c *Client) RequestQuote(ctx context.Context, quote QuoteRequest) error {
	body, _ := json.Marshal(quote)
	url := fmt.Sprintf("%s/quotes", c.baseURL)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/vnd.interoperability.quotes+json;version=1.1")
	req.Header.Set("FSPIOP-Source", c.fspiID)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

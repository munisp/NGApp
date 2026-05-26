// Package mojaloop provides a client for the Mojaloop payment switch.
// Mojaloop handles inter-party royalty settlement and bank transfers.
// Spec: FRQ-011 — settlement time < 1 hour.
package mojaloop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// ErrorResponse represents a Mojaloop FSPIOP error.
type ErrorResponse struct {
	ErrorInformation struct {
		ErrorCode        string `json:"errorCode"`
		ErrorDescription string `json:"errorDescription"`
	} `json:"errorInformation"`
}

func (e ErrorResponse) Error() string {
	return fmt.Sprintf("FSPIOP-%s: %s", e.ErrorInformation.ErrorCode, e.ErrorInformation.ErrorDescription)
}

// TransferState tracks the lifecycle of a Mojaloop transfer.
type TransferState struct {
	TransferID  string `json:"transfer_id"`
	QuoteID     string `json:"quote_id"`
	State       string `json:"state"` // RECEIVED, RESERVED, COMMITTED, ABORTED
	CompletedAt string `json:"completed_at,omitempty"`
}

// Client interfaces with the Mojaloop switch for payment routing.
type Client struct {
	baseURL    string
	httpClient *http.Client
	fspID      string
}

// NewClient creates a new Mojaloop client.
func NewClient(baseURL string) *Client {
	fspID := "og-rmm-fsp"
	if envFSP := envGetDefault("MOJALOOP_FSP_ID", ""); envFSP != "" {
		fspID = envFSP
	}
	return &Client{
		baseURL: baseURL,
		fspID:   fspID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func envGetDefault(key, fallback string) string {
	if v, ok := lookupEnv(key); ok {
		return v
	}
	return fallback
}

var lookupEnv = os.LookupEnv

// Party identifies a participant in a Mojaloop transaction.
type Party struct {
	PartyIdInfo PartyIdInfo `json:"partyIdInfo"`
	Name        string      `json:"name,omitempty"`
}

// PartyIdInfo contains the identifier for a Mojaloop party.
type PartyIdInfo struct {
	PartyIdType string `json:"partyIdType"` // MSISDN, IBAN, ACCOUNT_ID
	PartyID     string `json:"partyIdentifier"`
	FSPIOP      string `json:"fspId,omitempty"`
}

// Money represents a monetary amount in Mojaloop format.
type Money struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

// QuoteRequest initiates the quoting process for a royalty payment.
type QuoteRequest struct {
	QuoteID         string `json:"quoteId"`
	TransactionID   string `json:"transactionId"`
	Payer           Party  `json:"payer"`
	Payee           Party  `json:"payee"`
	AmountType      string `json:"amountType"` // SEND or RECEIVE
	Amount          Money  `json:"amount"`
	TransactionType struct {
		Scenario    string `json:"scenario"`
		SubScenario string `json:"subScenario,omitempty"`
		Initiator   string `json:"initiator"`
		InitiatorType string `json:"initiatorType"`
	} `json:"transactionType"`
	Note string `json:"note,omitempty"`
}

// TransferRequest initiates the actual fund transfer after quoting.
type TransferRequest struct {
	TransferID        string    `json:"transferId"`
	PayerFSP          string    `json:"payerFsp"`
	PayeeFSP          string    `json:"payeeFsp"`
	Amount            Money     `json:"amount"`
	ILPPacket         string    `json:"ilpPacket"`
	Condition         string    `json:"condition"`
	Expiration        time.Time `json:"expiration"`
}

// RoyaltyPayment represents a single royalty payment to be settled.
type RoyaltyPayment struct {
	PaymentID      string    `json:"payment_id"`
	WellID         string    `json:"well_id"`
	RecipientMSISDN string   `json:"recipient_msisdn"`
	RecipientFSP   string    `json:"recipient_fsp"`
	AmountUSD      string    `json:"amount_usd"`
	Description    string    `json:"description"`
	ScheduledAt    time.Time `json:"scheduled_at"`
}

// InitiateRoyaltyPayment starts the Mojaloop payment flow for a royalty.
// Step 1: Party lookup, Step 2: Quote, Step 3: Transfer
func (c *Client) InitiateRoyaltyPayment(ctx context.Context, payment RoyaltyPayment) error {
	quoteID := generateUUID()
	txID := generateUUID()

	quote := QuoteRequest{
		QuoteID:       quoteID,
		TransactionID: txID,
		Payer: Party{
			PartyIdInfo: PartyIdInfo{
				PartyIdType: "ACCOUNT_ID",
				PartyID:     "og-rmm-revenue-account",
				FSPIOP:      "og-rmm-fsp",
			},
			Name: "OG RMM Platform",
		},
		Payee: Party{
			PartyIdInfo: PartyIdInfo{
				PartyIdType: "MSISDN",
				PartyID:     payment.RecipientMSISDN,
				FSPIOP:      payment.RecipientFSP,
			},
		},
		AmountType: "SEND",
		Amount: Money{
			Amount:   payment.AmountUSD,
			Currency: "USD",
		},
		Note: payment.Description,
	}
	quote.TransactionType.Scenario = "TRANSFER"
	quote.TransactionType.Initiator = "PAYER"
	quote.TransactionType.InitiatorType = "BUSINESS"

	payload, err := json.Marshal(quote)
	if err != nil {
		return fmt.Errorf("quote marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/quotes", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("quote request creation failed: %w", err)
	}

	c.setFSPIOPHeaders(req, "application/vnd.interoperability.quotes+json;version=1.0", payment.RecipientFSP)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("mojaloop quote request failed: %w", err)
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp, http.StatusAccepted); err != nil {
		return fmt.Errorf("mojaloop quote rejected for payment %s: %w", payment.PaymentID, err)
	}

	slog.Info("Mojaloop royalty payment initiated",
		"payment_id", payment.PaymentID,
		"quote_id", quoteID,
		"tx_id", txID,
		"amount", payment.AmountUSD,
		"recipient", payment.RecipientMSISDN,
	)
	return nil
}

// ExecuteTransfer sends the actual fund transfer after a quote has been accepted.
func (c *Client) ExecuteTransfer(ctx context.Context, transfer TransferRequest) (*TransferState, error) {
	payload, err := json.Marshal(transfer)
	if err != nil {
		return nil, fmt.Errorf("transfer marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/transfers", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("transfer request creation: %w", err)
	}
	c.setFSPIOPHeaders(req, "application/vnd.interoperability.transfers+json;version=1.0", transfer.PayeeFSP)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mojaloop transfer request: %w", err)
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp, http.StatusAccepted); err != nil {
		return nil, fmt.Errorf("mojaloop transfer rejected: %w", err)
	}

	state := &TransferState{
		TransferID: transfer.TransferID,
		State:      "RECEIVED",
	}

	slog.Info("Mojaloop transfer executed",
		"transfer_id", transfer.TransferID,
		"amount", transfer.Amount.Amount,
		"currency", transfer.Amount.Currency,
	)
	return state, nil
}

// GetTransferState checks the current state of a transfer.
func (c *Client) GetTransferState(ctx context.Context, transferID string) (*TransferState, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/transfers/"+transferID, nil)
	if err != nil {
		return nil, err
	}
	c.setFSPIOPHeaders(req, "application/vnd.interoperability.transfers+json;version=1.0", "")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get transfer state: %w", err)
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp, http.StatusOK); err != nil {
		return nil, err
	}

	var state TransferState
	if err := json.NewDecoder(resp.Body).Decode(&state); err != nil {
		return nil, fmt.Errorf("decode transfer state: %w", err)
	}
	return &state, nil
}

// LookupParty resolves a party identifier via Mojaloop's ALS.
func (c *Client) LookupParty(ctx context.Context, partyIdType, partyID string) (*Party, error) {
	url := fmt.Sprintf("%s/parties/%s/%s", c.baseURL, partyIdType, partyID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	c.setFSPIOPHeaders(req, "application/vnd.interoperability.parties+json;version=1.0", "")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("party lookup: %w", err)
	}
	defer resp.Body.Close()

	if err := c.checkResponse(resp, http.StatusOK, http.StatusAccepted); err != nil {
		return nil, fmt.Errorf("party lookup for %s/%s: %w", partyIdType, partyID, err)
	}

	var party Party
	if err := json.NewDecoder(resp.Body).Decode(&party); err != nil {
		return nil, fmt.Errorf("decode party: %w", err)
	}
	return &party, nil
}

func (c *Client) setFSPIOPHeaders(req *http.Request, contentType, destination string) {
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", contentType)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	req.Header.Set("FSPIOP-Source", c.fspID)
	if destination != "" {
		req.Header.Set("FSPIOP-Destination", destination)
	}
}

func (c *Client) checkResponse(resp *http.Response, expectedCodes ...int) error {
	for _, code := range expectedCodes {
		if resp.StatusCode == code {
			return nil
		}
	}
	var errResp ErrorResponse
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil && errResp.ErrorInformation.ErrorCode != "" {
		return &errResp
	}
	return fmt.Errorf("unexpected HTTP status %d", resp.StatusCode)
}

// BatchRoyaltyPayments initiates multiple royalty payments in sequence.
func (c *Client) BatchRoyaltyPayments(ctx context.Context, payments []RoyaltyPayment) (int, error) {
	succeeded := 0
	for _, p := range payments {
		if err := c.InitiateRoyaltyPayment(ctx, p); err != nil {
			slog.Error("royalty payment failed", "payment_id", p.PaymentID, "err", err)
			continue
		}
		succeeded++
	}
	return succeeded, nil
}

var uuidCounter uint64

func generateUUID() string {
	uuidCounter++
	return fmt.Sprintf("og-%d-%d", time.Now().UnixNano(), uuidCounter)
}

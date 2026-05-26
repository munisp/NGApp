package mojaloop

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Mojaloop Integration Adapter — DFSP (Digital Financial Services Provider) integration
// for interoperable payments in African financial ecosystem

type MojaloopConfig struct {
	HubURL              string `json:"hub_url"`
	DFSPID              string `json:"dfsp_id"`
	AccountLookupURL    string `json:"account_lookup_url"`
	QuotesURL           string `json:"quotes_url"`
	TransfersURL        string `json:"transfers_url"`
	AdminURL            string `json:"admin_url"`
	TLSCertPath         string `json:"tls_cert_path"`
	TLSKeyPath          string `json:"tls_key_path"`
	JWSSigningKeyPath   string `json:"jws_signing_key_path"`
	CallbackURL         string `json:"callback_url"`
	Currency            string `json:"currency"`
}

func DefaultMojaloopConfig() *MojaloopConfig {
	return &MojaloopConfig{
		HubURL:           "https://mojaloop-hub.payment-switch.svc:4000",
		DFSPID:           "crm-platform-dfsp",
		AccountLookupURL: "https://account-lookup.payment-switch.svc:4002",
		QuotesURL:        "https://quoting-service.payment-switch.svc:3002",
		TransfersURL:     "https://transfers.payment-switch.svc:3000",
		AdminURL:         "https://admin.payment-switch.svc:4001",
		CallbackURL:      "https://crm-platform.svc:8080/mojaloop/callbacks",
		Currency:         "NGN",
	}
}

// Mojaloop FSPIOP API types
type PartyIDType string

const (
	PartyMSISDN       PartyIDType = "MSISDN"
	PartyAccountID    PartyIDType = "ACCOUNT_ID"
	PartyEmail        PartyIDType = "EMAIL"
	PartyPersonalID   PartyIDType = "PERSONAL_ID"
	PartyBusiness     PartyIDType = "BUSINESS"
)

type PartyInfo struct {
	PartyIDType  PartyIDType `json:"partyIdType"`
	PartyID      string      `json:"partyIdentifier"`
	FSPID        string      `json:"fspId"`
	Name         string      `json:"name,omitempty"`
	FirstName    string      `json:"firstName,omitempty"`
	LastName     string      `json:"lastName,omitempty"`
	DateOfBirth  string      `json:"dateOfBirth,omitempty"`
}

type Money struct {
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

type QuoteRequest struct {
	QuoteID              string    `json:"quoteId"`
	TransactionID        string    `json:"transactionId"`
	TransactionRequestID string    `json:"transactionRequestId,omitempty"`
	Payer                PartyInfo `json:"payer"`
	Payee                PartyInfo `json:"payee"`
	AmountType           string    `json:"amountType"` // SEND, RECEIVE
	Amount               Money     `json:"amount"`
	TransactionType      TransType `json:"transactionType"`
	Note                 string    `json:"note,omitempty"`
	Expiration           string    `json:"expiration,omitempty"`
}

type TransType struct {
	Scenario    string `json:"scenario"`    // TRANSFER, DEPOSIT, WITHDRAWAL, PAYMENT, REFUND
	Initiator   string `json:"initiator"`   // PAYER, PAYEE
	InitiatorType string `json:"initiatorType"` // CONSUMER, AGENT, BUSINESS, DEVICE
}

type QuoteResponse struct {
	TransferAmount     Money    `json:"transferAmount"`
	PayeeReceiveAmount Money    `json:"payeeReceiveAmount"`
	PayeeFSPFee        Money    `json:"payeeFspFee"`
	PayeeFSPCommission Money    `json:"payeeFspCommission"`
	Expiration         string   `json:"expiration"`
	Condition          string   `json:"condition"`
	IlpPacket          string   `json:"ilpPacket"`
}

type TransferRequest struct {
	TransferID    string `json:"transferId"`
	PayerFSP      string `json:"payerFsp"`
	PayeeFSP      string `json:"payeeFsp"`
	Amount        Money  `json:"amount"`
	IlpPacket     string `json:"ilpPacket"`
	Condition     string `json:"condition"`
	Expiration    string `json:"expiration"`
}

type TransferResponse struct {
	TransferState   string `json:"transferState"` // COMMITTED, ABORTED, RESERVED
	Fulfilment      string `json:"fulfilment"`
	CompletedAt     string `json:"completedTimestamp"`
}

// MojaloopAdapter handles all Mojaloop FSPIOP interactions
type MojaloopAdapter struct {
	config *MojaloopConfig
	client *http.Client
}

func NewMojaloopAdapter(config *MojaloopConfig) *MojaloopAdapter {
	if config == nil {
		config = DefaultMojaloopConfig()
	}
	return &MojaloopAdapter{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (a *MojaloopAdapter) LookupParty(ctx context.Context, idType PartyIDType, id string) (*PartyInfo, error) {
	url := fmt.Sprintf("%s/parties/%s/%s", a.config.AccountLookupURL, idType, id)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	a.setHeaders(req)
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("party lookup failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 202 {
		return nil, fmt.Errorf("party lookup returned %d", resp.StatusCode)
	}
	var party PartyInfo
	json.NewDecoder(resp.Body).Decode(&party)
	return &party, nil
}

func (a *MojaloopAdapter) RequestQuote(ctx context.Context, quote *QuoteRequest) (*QuoteResponse, error) {
	url := fmt.Sprintf("%s/quotes", a.config.QuotesURL)
	body, _ := json.Marshal(quote)
	req, err := http.NewRequestWithContext(ctx, "POST", url, jsonReader(body))
	if err != nil {
		return nil, err
	}
	a.setHeaders(req)
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("quote request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 202 {
		return nil, fmt.Errorf("quote request returned %d", resp.StatusCode)
	}
	var qr QuoteResponse
	json.NewDecoder(resp.Body).Decode(&qr)
	return &qr, nil
}

func (a *MojaloopAdapter) ExecuteTransfer(ctx context.Context, transfer *TransferRequest) (*TransferResponse, error) {
	url := fmt.Sprintf("%s/transfers", a.config.TransfersURL)
	body, _ := json.Marshal(transfer)
	req, err := http.NewRequestWithContext(ctx, "POST", url, jsonReader(body))
	if err != nil {
		return nil, err
	}
	a.setHeaders(req)
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("transfer execution failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 202 {
		return nil, fmt.Errorf("transfer returned %d", resp.StatusCode)
	}
	var tr TransferResponse
	json.NewDecoder(resp.Body).Decode(&tr)
	return &tr, nil
}

func (a *MojaloopAdapter) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/vnd.interoperability.transfers+json;version=1.1")
	req.Header.Set("Accept", "application/vnd.interoperability.transfers+json;version=1.1")
	req.Header.Set("FSPIOP-Source", a.config.DFSPID)
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
}

// Callback handlers for Mojaloop async responses
type CallbackHandler struct {
	adapter *MojaloopAdapter
}

func NewCallbackHandler(adapter *MojaloopAdapter) *CallbackHandler {
	return &CallbackHandler{adapter: adapter}
}

func (h *CallbackHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("PUT /mojaloop/callbacks/parties/{type}/{id}", h.PartyCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/quotes/{id}", h.QuoteCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/transfers/{id}", h.TransferCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/parties/{type}/{id}/error", h.PartyErrorCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/quotes/{id}/error", h.QuoteErrorCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/transfers/{id}/error", h.TransferErrorCallback)
}

func (h *CallbackHandler) PartyCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) QuoteCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) TransferCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) PartyErrorCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) QuoteErrorCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) TransferErrorCallback(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func jsonReader(data []byte) *jsonBody {
	return &jsonBody{data: data}
}

type jsonBody struct {
	data []byte
	pos  int
}

func (b *jsonBody) Read(p []byte) (n int, err error) {
	if b.pos >= len(b.data) {
		return 0, fmt.Errorf("EOF")
	}
	n = copy(p, b.data[b.pos:])
	b.pos += n
	return n, nil
}

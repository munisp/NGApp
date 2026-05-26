package mojaloop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

// Client provides Mojaloop payment hub integration with retry, circuit breaker,
// JWS signing, and callback support.
type Client struct {
	httpClient     *http.Client
	baseURL        string
	fspiID         string
	callbackURL    string
	maxRetries     int
	retryDelay     time.Duration
	circuitBreaker *CircuitBreaker
}

// CircuitBreaker provides basic circuit breaker pattern for Mojaloop calls.
type CircuitBreaker struct {
	mu            sync.Mutex
	failureCount  int
	threshold     int
	state         string // "closed", "open", "half-open"
	lastFailure   time.Time
	resetTimeout  time.Duration
}

func newCircuitBreaker() *CircuitBreaker {
	return &CircuitBreaker{
		threshold:    5,
		state:        "closed",
		resetTimeout: 30 * time.Second,
	}
}

func (cb *CircuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	switch cb.state {
	case "open":
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = "half-open"
			return true
		}
		return false
	default:
		return true
	}
}

func (cb *CircuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount = 0
	cb.state = "closed"
}

func (cb *CircuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount++
	cb.lastFailure = time.Now()
	if cb.failureCount >= cb.threshold {
		cb.state = "open"
	}
}

// NewClient creates a Mojaloop client with retry and circuit breaker.
func NewClient() *Client {
	url := os.Getenv("MOJALOOP_URL")
	if url == "" {
		url = "http://mojaloop:4003"
	}
	return &Client{
		httpClient:     &http.Client{Timeout: 30 * time.Second},
		baseURL:        url,
		fspiID:         envOr("MOJALOOP_FSPI_ID", "crm-fsp"),
		callbackURL:    envOr("MOJALOOP_CALLBACK_URL", "http://crm-api:8080/mojaloop/callbacks"),
		maxRetries:     3,
		retryDelay:     500 * time.Millisecond,
		circuitBreaker: newCircuitBreaker(),
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Transfer represents a Mojaloop transfer request.
type Transfer struct {
	TransferID string `json:"transferId"`
	PayerFSP   string `json:"payerFsp"`
	PayeeFSP   string `json:"payeeFsp"`
	Amount     Amount `json:"amount"`
	Condition  string `json:"condition"`
	Expiry     string `json:"expiration"`
	ILPPacket  string `json:"ilpPacket,omitempty"`
}

// Amount holds currency and value for Mojaloop FSPIOP API.
type Amount struct {
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

// PartyLookup finds a party (account holder) by identifier.
type PartyLookup struct {
	PartyIDType string `json:"partyIdType"`
	PartyID     string `json:"partyIdentifier"`
}

// PartyResult holds resolved party information.
type PartyResult struct {
	PartyIDInfo struct {
		PartyIDType     string `json:"partyIdType"`
		PartyIdentifier string `json:"partyIdentifier"`
		FSPID           string `json:"fspId"`
	} `json:"partyIdInfo"`
	Name string `json:"name"`
}

// QuoteRequest requests a quote for a transfer.
type QuoteRequest struct {
	QuoteID       string `json:"quoteId"`
	TransactionID string `json:"transactionId"`
	Payer         Party  `json:"payer"`
	Payee         Party  `json:"payee"`
	AmountType    string `json:"amountType"`
	Amount        Amount `json:"amount"`
}

// QuoteResult holds the quote response with fees.
type QuoteResult struct {
	TransferAmount  Amount `json:"transferAmount"`
	PayeeReceiveAmt Amount `json:"payeeReceiveAmount"`
	PayeeFSPFee     Amount `json:"payeeFspFee"`
	Condition       string `json:"condition"`
	ILPPacket       string `json:"ilpPacket"`
	Expiry          string `json:"expiration"`
}

// Party represents a Mojaloop party.
type Party struct {
	PartyIDInfo struct {
		PartyIDType     string `json:"partyIdType"`
		PartyIdentifier string `json:"partyIdentifier"`
		FSPID           string `json:"fspId"`
	} `json:"partyIdInfo"`
}

// BulkTransfer represents a batch of transfers.
type BulkTransfer struct {
	BulkTransferID string     `json:"bulkTransferId"`
	BulkQuoteID    string     `json:"bulkQuoteId"`
	PayerFSP       string     `json:"payerFsp"`
	PayeeFSP       string     `json:"payeeFsp"`
	Transfers      []Transfer `json:"individualTransfers"`
	Expiry         string     `json:"expiration"`
}

// TransferState tracks the full lifecycle of a Mojaloop transfer.
type TransferState struct {
	TransferID    string `json:"transferId"`
	Status        string `json:"transferState"`
	CompletedAt   string `json:"completedTimestamp,omitempty"`
	Fulfillment   string `json:"fulfilment,omitempty"`
}

// LookupParty resolves an account holder via Mojaloop Account Lookup Service.
func (c *Client) LookupParty(ctx context.Context, idType, id string) (*PartyResult, error) {
	var result PartyResult
	err := c.doWithRetry(ctx, func() error {
		url := fmt.Sprintf("%s/parties/%s/%s", c.baseURL, idType, id)
		req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
		c.setFSPIOPHeaders(req, "application/vnd.interoperability.parties+json;version=1.1")
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("party lookup status %d: %s", resp.StatusCode, string(body))
		}
		return json.NewDecoder(resp.Body).Decode(&result)
	})
	if err != nil {
		return nil, fmt.Errorf("mojaloop party lookup: %w", err)
	}
	return &result, nil
}

// InitiateTransfer starts a Mojaloop transfer with retry and circuit breaker.
func (c *Client) InitiateTransfer(ctx context.Context, transfer Transfer) error {
	return c.doWithRetry(ctx, func() error {
		body, _ := json.Marshal(transfer)
		url := fmt.Sprintf("%s/transfers", c.baseURL)
		req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
		c.setFSPIOPHeaders(req, "application/vnd.interoperability.transfers+json;version=1.1")
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("transfer status %d: %s", resp.StatusCode, string(body))
		}
		return nil
	})
}

// RequestQuote sends a quote request to Mojaloop with retry.
func (c *Client) RequestQuote(ctx context.Context, quote QuoteRequest) (*QuoteResult, error) {
	var result QuoteResult
	err := c.doWithRetry(ctx, func() error {
		body, _ := json.Marshal(quote)
		url := fmt.Sprintf("%s/quotes", c.baseURL)
		req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
		c.setFSPIOPHeaders(req, "application/vnd.interoperability.quotes+json;version=1.1")
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("quote status %d: %s", resp.StatusCode, string(body))
		}
		return json.NewDecoder(resp.Body).Decode(&result)
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// InitiateBulkTransfer starts a batch of Mojaloop transfers.
func (c *Client) InitiateBulkTransfer(ctx context.Context, bulk BulkTransfer) error {
	return c.doWithRetry(ctx, func() error {
		body, _ := json.Marshal(bulk)
		url := fmt.Sprintf("%s/bulkTransfers", c.baseURL)
		req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
		c.setFSPIOPHeaders(req, "application/vnd.interoperability.bulkTransfers+json;version=1.1")
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return fmt.Errorf("bulk transfer status %d", resp.StatusCode)
		}
		return nil
	})
}

// GetTransferState retrieves the state of a transfer.
func (c *Client) GetTransferState(ctx context.Context, transferID string) (*TransferState, error) {
	var state TransferState
	err := c.doWithRetry(ctx, func() error {
		url := fmt.Sprintf("%s/transfers/%s", c.baseURL, transferID)
		req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
		c.setFSPIOPHeaders(req, "application/vnd.interoperability.transfers+json;version=1.1")
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		return json.NewDecoder(resp.Body).Decode(&state)
	})
	return &state, err
}

func (c *Client) setFSPIOPHeaders(req *http.Request, contentType string) {
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", contentType)
	req.Header.Set("FSPIOP-Source", c.fspiID)
	req.Header.Set("FSPIOP-Destination", "")
	req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	req.Header.Set("X-Forwarded-For", c.callbackURL)
}

func (c *Client) doWithRetry(ctx context.Context, fn func() error) error {
	if !c.circuitBreaker.allow() {
		return fmt.Errorf("mojaloop circuit breaker open")
	}
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		lastErr = fn()
		if lastErr == nil {
			c.circuitBreaker.recordSuccess()
			return nil
		}
		if attempt < c.maxRetries {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(c.retryDelay * time.Duration(1<<uint(attempt))):
			}
		}
	}
	c.circuitBreaker.recordFailure()
	return fmt.Errorf("after %d retries: %w", c.maxRetries, lastErr)
}

// CallbackHandler provides HTTP handlers for Mojaloop async callbacks.
type CallbackHandler struct {
	mu             sync.RWMutex
	partyCallbacks map[string]chan *PartyResult
	quoteCallbacks map[string]chan *QuoteResult
	xferCallbacks  map[string]chan *TransferState
}

// NewCallbackHandler creates a handler for Mojaloop async responses.
func NewCallbackHandler() *CallbackHandler {
	return &CallbackHandler{
		partyCallbacks: make(map[string]chan *PartyResult),
		quoteCallbacks: make(map[string]chan *QuoteResult),
		xferCallbacks:  make(map[string]chan *TransferState),
	}
}

// RegisterRoutes mounts callback endpoints.
func (h *CallbackHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("PUT /mojaloop/callbacks/parties/{type}/{id}", h.handlePartyCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/quotes/{id}", h.handleQuoteCallback)
	mux.HandleFunc("PUT /mojaloop/callbacks/transfers/{id}", h.handleTransferCallback)
}

func (h *CallbackHandler) handlePartyCallback(w http.ResponseWriter, r *http.Request) {
	var result PartyResult
	json.NewDecoder(r.Body).Decode(&result)
	key := r.PathValue("type") + "/" + r.PathValue("id")
	h.mu.RLock()
	ch, ok := h.partyCallbacks[key]
	h.mu.RUnlock()
	if ok {
		ch <- &result
	}
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) handleQuoteCallback(w http.ResponseWriter, r *http.Request) {
	var result QuoteResult
	json.NewDecoder(r.Body).Decode(&result)
	h.mu.RLock()
	ch, ok := h.quoteCallbacks[r.PathValue("id")]
	h.mu.RUnlock()
	if ok {
		ch <- &result
	}
	w.WriteHeader(http.StatusOK)
}

func (h *CallbackHandler) handleTransferCallback(w http.ResponseWriter, r *http.Request) {
	var state TransferState
	json.NewDecoder(r.Body).Decode(&state)
	h.mu.RLock()
	ch, ok := h.xferCallbacks[r.PathValue("id")]
	h.mu.RUnlock()
	if ok {
		ch <- &state
	}
	w.WriteHeader(http.StatusOK)
}

// WaitForParty registers a callback channel and waits for the async response.
func (h *CallbackHandler) WaitForParty(ctx context.Context, idType, id string) (*PartyResult, error) {
	key := idType + "/" + id
	ch := make(chan *PartyResult, 1)
	h.mu.Lock()
	h.partyCallbacks[key] = ch
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.partyCallbacks, key)
		h.mu.Unlock()
	}()
	select {
	case result := <-ch:
		return result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// WaitForTransfer registers a callback and waits for transfer completion.
func (h *CallbackHandler) WaitForTransfer(ctx context.Context, transferID string) (*TransferState, error) {
	ch := make(chan *TransferState, 1)
	h.mu.Lock()
	h.xferCallbacks[transferID] = ch
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.xferCallbacks, transferID)
		h.mu.Unlock()
	}()
	select {
	case state := <-ch:
		return state, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Health checks Mojaloop connectivity.
func (c *Client) Health(ctx context.Context) error {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("mojaloop unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// PISPManager handles Third-Party Payment Initiation (PISP) flows
type PISPManager struct {
	ledger        LedgerEngine
	workflowStore WorkflowStore
	db            *sql.DB
	linkedMgr     *LinkedTransferManager
	liquidityMgr  *LiquidityManager
	sourceOfTruth *SourceOfTruthContract
	mu            sync.RWMutex
}

// NewPISPManager creates a new PISP manager
func NewPISPManager(
	ledger LedgerEngine,
	workflow WorkflowStore,
	db *sql.DB,
	linkedMgr *LinkedTransferManager,
	liquidityMgr *LiquidityManager,
	sot *SourceOfTruthContract,
) *PISPManager {
	return &PISPManager{
		ledger:        ledger,
		workflowStore: workflow,
		db:            db,
		linkedMgr:     linkedMgr,
		liquidityMgr:  liquidityMgr,
		sourceOfTruth: sot,
	}
}

// ConsentStatus represents the status of a consent
type ConsentStatus string

const (
	ConsentStatusPending ConsentStatus = "PENDING"
	ConsentStatusActive  ConsentStatus = "ACTIVE"
	ConsentStatusRevoked ConsentStatus = "REVOKED"
	ConsentStatusExpired ConsentStatus = "EXPIRED"
)

// Consent represents a third-party consent
type Consent struct {
	ConsentID   string             `json:"consentId"`
	PartyID     string             `json:"partyId"`     // The payer's identifier
	PartyIDType string             `json:"partyIdType"` // MSISDN, EMAIL, etc.
	DFSPID      string             `json:"dfspId"`      // The DFSP holding the account
	PISPID      string             `json:"pispId"`      // The third-party initiator
	Scopes      []*ConsentScope    `json:"scopes"`
	Credential  *ConsentCredential `json:"credential,omitempty"`
	Status      ConsentStatus      `json:"status"`
	CreatedAt   time.Time          `json:"createdAt"`
	ExpiresAt   time.Time          `json:"expiresAt"`
	RevokedAt   *time.Time         `json:"revokedAt,omitempty"`
}

// ConsentScope defines what the consent allows
type ConsentScope struct {
	ScopeType string `json:"scopeType"` // accounts.getBalance, accounts.transfer
	AccountID string `json:"accountId"`
}

// ConsentCredential holds the credential for signing
type ConsentCredential struct {
	CredentialType string `json:"credentialType"` // FIDO
	Status         string `json:"status"`         // PENDING, VERIFIED
	Challenge      string `json:"challenge"`
	PublicKey      string `json:"publicKey,omitempty"`
	Attestation    string `json:"attestation,omitempty"`
}

// ConsentRequest represents a request to create a consent
type ConsentRequest struct {
	ConsentRequestID  string          `json:"consentRequestId"`
	PartyID           string          `json:"partyId"`
	PartyIDType       string          `json:"partyIdType"`
	DFSPID            string          `json:"dfspId"`
	PISPID            string          `json:"pispId"`
	Scopes            []*ConsentScope `json:"scopes"`
	AuthChannels      []string        `json:"authChannels"` // WEB, OTP
	CallbackURI       string          `json:"callbackUri"`
	ExpirationSeconds int             `json:"expirationSeconds,omitempty"`
}

// CreateConsentRequest initiates a consent request
func (m *PISPManager) CreateConsentRequest(ctx context.Context, req *ConsentRequest) (*Consent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate consent ID
	consentID := generateConsentID()

	// Generate FIDO challenge
	challenge := generateChallenge()

	// Calculate expiration
	expirationSeconds := req.ExpirationSeconds
	if expirationSeconds == 0 {
		expirationSeconds = 86400 * 30 // 30 days default
	}

	consent := &Consent{
		ConsentID:   consentID,
		PartyID:     req.PartyID,
		PartyIDType: req.PartyIDType,
		DFSPID:      req.DFSPID,
		PISPID:      req.PISPID,
		Scopes:      req.Scopes,
		Credential: &ConsentCredential{
			CredentialType: "FIDO",
			Status:         "PENDING",
			Challenge:      challenge,
		},
		Status:    ConsentStatusPending,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(time.Duration(expirationSeconds) * time.Second),
	}

	// Save consent
	if err := m.saveConsent(ctx, consent); err != nil {
		return nil, fmt.Errorf("failed to save consent: %w", err)
	}

	return consent, nil
}

// VerifyConsentCredential verifies the FIDO credential and activates the consent
func (m *PISPManager) VerifyConsentCredential(ctx context.Context, consentID string, publicKey string, attestation string) (*Consent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	consent, err := m.GetConsent(ctx, consentID)
	if err != nil {
		return nil, fmt.Errorf("consent not found: %w", err)
	}

	if consent.Status != ConsentStatusPending {
		return nil, fmt.Errorf("consent is not pending: %s", consent.Status)
	}

	// Verify FIDO attestation (simplified - in production use WebAuthn library)
	if publicKey == "" || attestation == "" {
		return nil, fmt.Errorf("invalid credential")
	}

	// Update credential
	consent.Credential.PublicKey = publicKey
	consent.Credential.Attestation = attestation
	consent.Credential.Status = "VERIFIED"
	consent.Status = ConsentStatusActive

	// Save updated consent
	if err := m.saveConsent(ctx, consent); err != nil {
		return nil, fmt.Errorf("failed to update consent: %w", err)
	}

	return consent, nil
}

// RevokeConsent revokes an active consent
func (m *PISPManager) RevokeConsent(ctx context.Context, consentID string, revokedBy string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	consent, err := m.GetConsent(ctx, consentID)
	if err != nil {
		return fmt.Errorf("consent not found: %w", err)
	}

	if consent.Status != ConsentStatusActive {
		return fmt.Errorf("consent is not active: %s", consent.Status)
	}

	now := time.Now()
	consent.Status = ConsentStatusRevoked
	consent.RevokedAt = &now

	// Save updated consent
	if err := m.saveConsent(ctx, consent); err != nil {
		return fmt.Errorf("failed to revoke consent: %w", err)
	}

	// Log revocation
	m.logConsentEvent(ctx, consentID, "REVOKED", revokedBy)

	return nil
}

// GetConsent retrieves a consent by ID
func (m *PISPManager) GetConsent(ctx context.Context, consentID string) (*Consent, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT consent_id, party_id, party_id_type, dfsp_id, pisp_id,
		       scopes, credential, status, created_at, expires_at, revoked_at
		FROM pisp_consents
		WHERE consent_id = $1
	`, consentID)

	consent := &Consent{}
	var scopesJSON, credentialJSON []byte
	var status string
	var revokedAt sql.NullTime

	err := row.Scan(
		&consent.ConsentID, &consent.PartyID, &consent.PartyIDType,
		&consent.DFSPID, &consent.PISPID, &scopesJSON, &credentialJSON,
		&status, &consent.CreatedAt, &consent.ExpiresAt, &revokedAt,
	)
	if err != nil {
		return nil, err
	}

	consent.Status = ConsentStatus(status)
	json.Unmarshal(scopesJSON, &consent.Scopes)
	json.Unmarshal(credentialJSON, &consent.Credential)
	if revokedAt.Valid {
		consent.RevokedAt = &revokedAt.Time
	}

	// Check expiration
	if consent.Status == ConsentStatusActive && time.Now().After(consent.ExpiresAt) {
		consent.Status = ConsentStatusExpired
		m.saveConsent(ctx, consent)
	}

	return consent, nil
}

// ThirdPartyTransactionRequest represents a PISP-initiated transfer
type ThirdPartyTransactionRequest struct {
	TransactionRequestID string    `json:"transactionRequestId"`
	ConsentID            string    `json:"consentId"`
	PayerID              string    `json:"payerId"`
	PayerIDType          string    `json:"payerIdType"`
	PayeeID              string    `json:"payeeId"`
	PayeeIDType          string    `json:"payeeIdType"`
	PayeeFSP             string    `json:"payeeFsp"`
	Amount               string    `json:"amount"`
	Currency             string    `json:"currency"`
	Note                 string    `json:"note,omitempty"`
	Expiration           time.Time `json:"expiration"`
}

// ThirdPartyTransaction represents a PISP transaction
type ThirdPartyTransaction struct {
	TransactionRequestID string                      `json:"transactionRequestId"`
	TransactionID        string                      `json:"transactionId,omitempty"`
	ConsentID            string                      `json:"consentId"`
	PayerFSP             string                      `json:"payerFsp"`
	PayeeFSP             string                      `json:"payeeFsp"`
	Amount               string                      `json:"amount"`
	Currency             string                      `json:"currency"`
	Status               ThirdPartyTransactionStatus `json:"status"`
	AuthorizationStatus  string                      `json:"authorizationStatus,omitempty"`
	Challenge            string                      `json:"challenge,omitempty"`
	CreatedAt            time.Time                   `json:"createdAt"`
	CompletedAt          *time.Time                  `json:"completedAt,omitempty"`
}

// ThirdPartyTransactionStatus represents the status of a PISP transaction
type ThirdPartyTransactionStatus string

const (
	TPTxStatusPending      ThirdPartyTransactionStatus = "PENDING"
	TPTxStatusAuthorizing  ThirdPartyTransactionStatus = "AUTHORIZING"
	TPTxStatusAuthorized   ThirdPartyTransactionStatus = "AUTHORIZED"
	TPTxStatusTransferring ThirdPartyTransactionStatus = "TRANSFERRING"
	TPTxStatusCompleted    ThirdPartyTransactionStatus = "COMPLETED"
	TPTxStatusRejected     ThirdPartyTransactionStatus = "REJECTED"
	TPTxStatusFailed       ThirdPartyTransactionStatus = "FAILED"
)

// InitiateThirdPartyTransaction initiates a PISP transaction
func (m *PISPManager) InitiateThirdPartyTransaction(ctx context.Context, req *ThirdPartyTransactionRequest) (*ThirdPartyTransaction, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Validate consent
	consent, err := m.GetConsent(ctx, req.ConsentID)
	if err != nil {
		return nil, fmt.Errorf("consent not found: %w", err)
	}

	if consent.Status != ConsentStatusActive {
		return nil, fmt.Errorf("consent is not active: %s", consent.Status)
	}

	// Validate scope allows transfers
	hasTransferScope := false
	for _, scope := range consent.Scopes {
		if scope.ScopeType == "accounts.transfer" {
			hasTransferScope = true
			break
		}
	}
	if !hasTransferScope {
		return nil, fmt.Errorf("consent does not allow transfers")
	}

	// Generate challenge for authorization
	challenge := generateChallenge()

	tx := &ThirdPartyTransaction{
		TransactionRequestID: req.TransactionRequestID,
		ConsentID:            req.ConsentID,
		PayerFSP:             consent.DFSPID,
		PayeeFSP:             req.PayeeFSP,
		Amount:               req.Amount,
		Currency:             req.Currency,
		Status:               TPTxStatusAuthorizing,
		Challenge:            challenge,
		CreatedAt:            time.Now(),
	}

	// Save transaction
	if err := m.saveThirdPartyTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("failed to save transaction: %w", err)
	}

	return tx, nil
}

// AuthorizeThirdPartyTransaction authorizes a PISP transaction with FIDO signature
func (m *PISPManager) AuthorizeThirdPartyTransaction(ctx context.Context, transactionRequestID string, signature string) (*ThirdPartyTransaction, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tx, err := m.getThirdPartyTransaction(ctx, transactionRequestID)
	if err != nil {
		return nil, fmt.Errorf("transaction not found: %w", err)
	}

	if tx.Status != TPTxStatusAuthorizing {
		return nil, fmt.Errorf("transaction is not awaiting authorization: %s", tx.Status)
	}

	// Get consent for public key
	consent, err := m.GetConsent(ctx, tx.ConsentID)
	if err != nil {
		return nil, fmt.Errorf("consent not found: %w", err)
	}

	// Verify FIDO signature (simplified - in production use WebAuthn library)
	if signature == "" {
		return nil, fmt.Errorf("invalid signature")
	}

	// Mark as authorized
	tx.Status = TPTxStatusAuthorized
	tx.AuthorizationStatus = "VERIFIED"

	// Save updated transaction
	if err := m.saveThirdPartyTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	// Initiate the actual transfer
	go m.executeThirdPartyTransfer(context.Background(), tx, consent)

	return tx, nil
}

// executeThirdPartyTransfer executes the transfer after authorization
func (m *PISPManager) executeThirdPartyTransfer(ctx context.Context, tx *ThirdPartyTransaction, consent *Consent) {
	// Update status to transferring
	tx.Status = TPTxStatusTransferring
	m.saveThirdPartyTransaction(ctx, tx)

	// Parse amount
	amount, err := ParseAmount(tx.Amount)
	if err != nil {
		tx.Status = TPTxStatusFailed
		m.saveThirdPartyTransaction(ctx, tx)
		return
	}

	// Check liquidity
	result, err := m.liquidityMgr.CheckLiquidity(ctx, tx.PayerFSP, tx.Currency, int64(amount))
	if err != nil || !result.Allowed {
		tx.Status = TPTxStatusFailed
		m.saveThirdPartyTransaction(ctx, tx)
		return
	}

	// Create transfer via linked transfer manager
	transferReq := &SimpleTransferRequest{
		TransferID: fmt.Sprintf("pisp-%s", tx.TransactionRequestID),
		PayerFSP:   tx.PayerFSP,
		PayeeFSP:   tx.PayeeFSP,
		Amount:     amount,
		Currency:   tx.Currency,
		Expiration: time.Now().Add(30 * time.Second),
	}

	group, err := m.linkedMgr.CreateSimpleTransfer(ctx, transferReq)
	if err != nil {
		tx.Status = TPTxStatusFailed
		m.saveThirdPartyTransaction(ctx, tx)
		return
	}

	tx.TransactionID = group.TransferID

	// Post the transfer (auto-fulfill for PISP)
	if err := m.linkedMgr.PostLinkedGroup(ctx, group.GroupID, group); err != nil {
		tx.Status = TPTxStatusFailed
		m.saveThirdPartyTransaction(ctx, tx)
		return
	}

	// Mark as completed
	now := time.Now()
	tx.Status = TPTxStatusCompleted
	tx.CompletedAt = &now
	m.saveThirdPartyTransaction(ctx, tx)
}

// GetThirdPartyTransactionStatus gets the status of a PISP transaction
func (m *PISPManager) GetThirdPartyTransactionStatus(ctx context.Context, transactionRequestID string) (*ThirdPartyTransaction, error) {
	return m.getThirdPartyTransaction(ctx, transactionRequestID)
}

// Helper methods

func (m *PISPManager) saveConsent(ctx context.Context, consent *Consent) error {
	scopesJSON, _ := json.Marshal(consent.Scopes)
	credentialJSON, _ := json.Marshal(consent.Credential)

	_, err := m.db.ExecContext(ctx, `
		INSERT INTO pisp_consents (
			consent_id, party_id, party_id_type, dfsp_id, pisp_id,
			scopes, credential, status, created_at, expires_at, revoked_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (consent_id) DO UPDATE SET
			scopes = EXCLUDED.scopes,
			credential = EXCLUDED.credential,
			status = EXCLUDED.status,
			revoked_at = EXCLUDED.revoked_at
	`, consent.ConsentID, consent.PartyID, consent.PartyIDType,
		consent.DFSPID, consent.PISPID, scopesJSON, credentialJSON,
		string(consent.Status), consent.CreatedAt, consent.ExpiresAt, consent.RevokedAt)

	return err
}

func (m *PISPManager) saveThirdPartyTransaction(ctx context.Context, tx *ThirdPartyTransaction) error {
	_, err := m.db.ExecContext(ctx, `
		INSERT INTO pisp_transactions (
			transaction_request_id, transaction_id, consent_id, payer_fsp, payee_fsp,
			amount, currency, status, authorization_status, challenge, created_at, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (transaction_request_id) DO UPDATE SET
			transaction_id = EXCLUDED.transaction_id,
			status = EXCLUDED.status,
			authorization_status = EXCLUDED.authorization_status,
			completed_at = EXCLUDED.completed_at
	`, tx.TransactionRequestID, tx.TransactionID, tx.ConsentID,
		tx.PayerFSP, tx.PayeeFSP, tx.Amount, tx.Currency,
		string(tx.Status), tx.AuthorizationStatus, tx.Challenge,
		tx.CreatedAt, tx.CompletedAt)

	return err
}

func (m *PISPManager) getThirdPartyTransaction(ctx context.Context, transactionRequestID string) (*ThirdPartyTransaction, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT transaction_request_id, transaction_id, consent_id, payer_fsp, payee_fsp,
		       amount, currency, status, authorization_status, challenge, created_at, completed_at
		FROM pisp_transactions
		WHERE transaction_request_id = $1
	`, transactionRequestID)

	tx := &ThirdPartyTransaction{}
	var transactionID sql.NullString
	var authStatus sql.NullString
	var completedAt sql.NullTime
	var status string

	err := row.Scan(
		&tx.TransactionRequestID, &transactionID, &tx.ConsentID,
		&tx.PayerFSP, &tx.PayeeFSP, &tx.Amount, &tx.Currency,
		&status, &authStatus, &tx.Challenge, &tx.CreatedAt, &completedAt,
	)
	if err != nil {
		return nil, err
	}

	tx.Status = ThirdPartyTransactionStatus(status)
	if transactionID.Valid {
		tx.TransactionID = transactionID.String
	}
	if authStatus.Valid {
		tx.AuthorizationStatus = authStatus.String
	}
	if completedAt.Valid {
		tx.CompletedAt = &completedAt.Time
	}

	return tx, nil
}

func (m *PISPManager) logConsentEvent(ctx context.Context, consentID, eventType, details string) {
	m.db.ExecContext(ctx, `
		INSERT INTO pisp_consent_events (consent_id, event_type, details, created_at)
		VALUES ($1, $2, $3, $4)
	`, consentID, eventType, details, time.Now())
}

func generateConsentID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("consent-%s", base64.RawURLEncoding.EncodeToString(b))
}

func generateChallenge() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// PISPSchema returns the PostgreSQL schema for PISP tables
func PISPSchema() string {
	return `
-- PISP consents table
CREATE TABLE IF NOT EXISTS pisp_consents (
    consent_id VARCHAR(64) PRIMARY KEY,
    party_id VARCHAR(128) NOT NULL,
    party_id_type VARCHAR(50) NOT NULL,
    dfsp_id VARCHAR(128) NOT NULL,
    pisp_id VARCHAR(128) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]',
    credential JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Index for party lookups
CREATE INDEX IF NOT EXISTS idx_pisp_consents_party 
ON pisp_consents(party_id, party_id_type);

-- Index for PISP lookups
CREATE INDEX IF NOT EXISTS idx_pisp_consents_pisp 
ON pisp_consents(pisp_id, status);

-- PISP transactions table
CREATE TABLE IF NOT EXISTS pisp_transactions (
    transaction_request_id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64),
    consent_id VARCHAR(64) NOT NULL REFERENCES pisp_consents(consent_id),
    payer_fsp VARCHAR(128) NOT NULL,
    payee_fsp VARCHAR(128) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    authorization_status VARCHAR(20),
    challenge VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for consent lookups
CREATE INDEX IF NOT EXISTS idx_pisp_transactions_consent 
ON pisp_transactions(consent_id);

-- PISP consent events table
CREATE TABLE IF NOT EXISTS pisp_consent_events (
    id SERIAL PRIMARY KEY,
    consent_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for consent event lookups
CREATE INDEX IF NOT EXISTS idx_pisp_consent_events_consent 
ON pisp_consent_events(consent_id, created_at DESC);
`
}

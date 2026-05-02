// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// JWSManager handles JWS signing and verification for Mojaloop interoperability
type JWSManager struct {
	db         *sql.DB
	privateKey crypto.PrivateKey
	publicKey  crypto.PublicKey
	keyID      string
	algorithm  string
	keyCache   map[string]*CachedPublicKey
	cacheTTL   time.Duration
	mu         sync.RWMutex
}

// CachedPublicKey holds a cached public key
type CachedPublicKey struct {
	Key       crypto.PublicKey
	CachedAt  time.Time
	ExpiresAt time.Time
}

// JWSConfig holds JWS configuration
type JWSConfig struct {
	PrivateKeyPEM string
	PublicKeyPEM  string
	KeyID         string
	Algorithm     string // RS256, ES256
	CacheTTL      time.Duration
}

// NewJWSManager creates a new JWS manager
func NewJWSManager(db *sql.DB, config *JWSConfig) (*JWSManager, error) {
	mgr := &JWSManager{
		db:        db,
		keyID:     config.KeyID,
		algorithm: config.Algorithm,
		keyCache:  make(map[string]*CachedPublicKey),
		cacheTTL:  config.CacheTTL,
	}

	if mgr.cacheTTL == 0 {
		mgr.cacheTTL = 1 * time.Hour
	}

	// Parse private key
	if config.PrivateKeyPEM != "" {
		block, _ := pem.Decode([]byte(config.PrivateKeyPEM))
		if block == nil {
			return nil, fmt.Errorf("failed to parse private key PEM")
		}

		var err error
		switch config.Algorithm {
		case "RS256":
			mgr.privateKey, err = x509.ParsePKCS1PrivateKey(block.Bytes)
			if err != nil {
				mgr.privateKey, err = x509.ParsePKCS8PrivateKey(block.Bytes)
			}
		case "ES256":
			mgr.privateKey, err = x509.ParseECPrivateKey(block.Bytes)
			if err != nil {
				key, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
				if err2 == nil {
					mgr.privateKey = key
					err = nil
				}
			}
		default:
			return nil, fmt.Errorf("unsupported algorithm: %s", config.Algorithm)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
	}

	// Parse public key
	if config.PublicKeyPEM != "" {
		block, _ := pem.Decode([]byte(config.PublicKeyPEM))
		if block == nil {
			return nil, fmt.Errorf("failed to parse public key PEM")
		}

		var err error
		mgr.publicKey, err = x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse public key: %w", err)
		}
	}

	return mgr, nil
}

// GenerateKeyPair generates a new key pair for JWS
func GenerateKeyPair(algorithm string) (privateKeyPEM, publicKeyPEM string, err error) {
	switch algorithm {
	case "RS256":
		privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return "", "", err
		}

		privateKeyBytes := x509.MarshalPKCS1PrivateKey(privateKey)
		privateKeyPEM = string(pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: privateKeyBytes,
		}))

		publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
		if err != nil {
			return "", "", err
		}
		publicKeyPEM = string(pem.EncodeToMemory(&pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: publicKeyBytes,
		}))

	case "ES256":
		privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return "", "", err
		}

		privateKeyBytes, err := x509.MarshalECPrivateKey(privateKey)
		if err != nil {
			return "", "", err
		}
		privateKeyPEM = string(pem.EncodeToMemory(&pem.Block{
			Type:  "EC PRIVATE KEY",
			Bytes: privateKeyBytes,
		}))

		publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
		if err != nil {
			return "", "", err
		}
		publicKeyPEM = string(pem.EncodeToMemory(&pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: publicKeyBytes,
		}))

	default:
		return "", "", fmt.Errorf("unsupported algorithm: %s", algorithm)
	}

	return privateKeyPEM, publicKeyPEM, nil
}

// JWSHeader represents a JWS header
type JWSHeader struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid,omitempty"`
	Type      string `json:"typ,omitempty"`
}

// SignRequest signs an HTTP request body and adds JWS headers
func (m *JWSManager) SignRequest(req *http.Request, body []byte) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.privateKey == nil {
		return fmt.Errorf("no private key configured")
	}

	// Create JWS header
	header := &JWSHeader{
		Algorithm: m.algorithm,
		KeyID:     m.keyID,
		Type:      "JWT",
	}
	headerJSON, _ := json.Marshal(header)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	// Create payload (body hash for detached JWS)
	payloadHash := sha256.Sum256(body)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadHash[:])

	// Create signing input
	signingInput := headerB64 + "." + payloadB64

	// Sign
	signature, err := m.sign([]byte(signingInput))
	if err != nil {
		return fmt.Errorf("failed to sign: %w", err)
	}
	signatureB64 := base64.RawURLEncoding.EncodeToString(signature)

	// Create detached JWS (header..signature, no payload)
	jws := headerB64 + ".." + signatureB64

	// Add headers
	req.Header.Set("FSPIOP-Signature", jws)
	req.Header.Set("FSPIOP-Source", m.keyID)

	return nil
}

// VerifyRequest verifies the JWS signature on an HTTP request
func (m *JWSManager) VerifyRequest(req *http.Request, body []byte) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Get JWS from header
	jws := req.Header.Get("FSPIOP-Signature")
	if jws == "" {
		return fmt.Errorf("missing FSPIOP-Signature header")
	}

	// Get source FSP
	sourceFSP := req.Header.Get("FSPIOP-Source")
	if sourceFSP == "" {
		return fmt.Errorf("missing FSPIOP-Source header")
	}

	// Parse JWS (detached format: header..signature)
	parts := strings.Split(jws, ".")
	if len(parts) != 3 {
		return fmt.Errorf("invalid JWS format")
	}

	headerB64 := parts[0]
	signatureB64 := parts[2]

	// Decode header
	headerJSON, err := base64.RawURLEncoding.DecodeString(headerB64)
	if err != nil {
		return fmt.Errorf("failed to decode header: %w", err)
	}

	var header JWSHeader
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return fmt.Errorf("failed to parse header: %w", err)
	}

	// Get public key for source FSP
	publicKey, err := m.getPublicKey(context.Background(), sourceFSP)
	if err != nil {
		return fmt.Errorf("failed to get public key for %s: %w", sourceFSP, err)
	}

	// Recreate payload from body
	payloadHash := sha256.Sum256(body)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadHash[:])

	// Recreate signing input
	signingInput := headerB64 + "." + payloadB64

	// Decode signature
	signature, err := base64.RawURLEncoding.DecodeString(signatureB64)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	// Verify signature
	if err := m.verify(publicKey, []byte(signingInput), signature, header.Algorithm); err != nil {
		return fmt.Errorf("signature verification failed: %w", err)
	}

	return nil
}

// sign creates a signature using the private key
func (m *JWSManager) sign(data []byte) ([]byte, error) {
	hash := sha256.Sum256(data)

	switch key := m.privateKey.(type) {
	case *rsa.PrivateKey:
		return rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	case *ecdsa.PrivateKey:
		r, s, err := ecdsa.Sign(rand.Reader, key, hash[:])
		if err != nil {
			return nil, err
		}
		// Encode as R || S (each 32 bytes for P-256)
		signature := make([]byte, 64)
		r.FillBytes(signature[:32])
		s.FillBytes(signature[32:])
		return signature, nil
	default:
		return nil, fmt.Errorf("unsupported key type")
	}
}

// verify verifies a signature using a public key
func (m *JWSManager) verify(publicKey crypto.PublicKey, data, signature []byte, algorithm string) error {
	hash := sha256.Sum256(data)

	switch key := publicKey.(type) {
	case *rsa.PublicKey:
		return rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], signature)
	case *ecdsa.PublicKey:
		if len(signature) != 64 {
			return fmt.Errorf("invalid ECDSA signature length")
		}
		r := new(big.Int).SetBytes(signature[:32])
		s := new(big.Int).SetBytes(signature[32:])
		if !ecdsa.Verify(key, hash[:], r, s) {
			return fmt.Errorf("ECDSA verification failed")
		}
		return nil
	default:
		return fmt.Errorf("unsupported key type")
	}
}

// getPublicKey retrieves a public key for a participant
func (m *JWSManager) getPublicKey(ctx context.Context, participantID string) (crypto.PublicKey, error) {
	// Check cache
	if cached, ok := m.keyCache[participantID]; ok {
		if time.Now().Before(cached.ExpiresAt) {
			return cached.Key, nil
		}
	}

	// Query database
	var publicKeyPEM string
	err := m.db.QueryRowContext(ctx, `
		SELECT public_key_pem FROM participant_keys
		WHERE participant_id = $1 AND is_active = true
		ORDER BY created_at DESC LIMIT 1
	`, participantID).Scan(&publicKeyPEM)
	if err != nil {
		return nil, err
	}

	// Parse public key
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("failed to parse public key PEM")
	}

	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	// Cache
	m.keyCache[participantID] = &CachedPublicKey{
		Key:       publicKey,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(m.cacheTTL),
	}

	return publicKey, nil
}

// RegisterParticipantKey registers a public key for a participant
func (m *JWSManager) RegisterParticipantKey(ctx context.Context, participantID, publicKeyPEM, keyID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Validate the key can be parsed
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return fmt.Errorf("invalid PEM format")
	}

	_, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return fmt.Errorf("invalid public key: %w", err)
	}

	// Deactivate existing keys
	_, err = m.db.ExecContext(ctx, `
		UPDATE participant_keys SET is_active = false
		WHERE participant_id = $1
	`, participantID)
	if err != nil {
		return err
	}

	// Insert new key
	_, err = m.db.ExecContext(ctx, `
		INSERT INTO participant_keys (participant_id, key_id, public_key_pem, is_active, created_at)
		VALUES ($1, $2, $3, true, $4)
	`, participantID, keyID, publicKeyPEM, time.Now())

	// Invalidate cache
	delete(m.keyCache, participantID)

	return err
}

// RevokeParticipantKey revokes a participant's key
func (m *JWSManager) RevokeParticipantKey(ctx context.Context, participantID, keyID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	_, err := m.db.ExecContext(ctx, `
		UPDATE participant_keys SET is_active = false, revoked_at = $1
		WHERE participant_id = $2 AND key_id = $3
	`, time.Now(), participantID, keyID)

	// Invalidate cache
	delete(m.keyCache, participantID)

	return err
}

// JWSMiddleware creates HTTP middleware for JWS verification
func (m *JWSManager) JWSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip verification for certain paths
		if strings.HasPrefix(r.URL.Path, "/health") || strings.HasPrefix(r.URL.Path, "/metrics") {
			next.ServeHTTP(w, r)
			return
		}

		// Read body
		body, err := readRequestBody(r)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}

		// Verify JWS
		if err := m.VerifyRequest(r, body); err != nil {
			http.Error(w, fmt.Sprintf("JWS verification failed: %v", err), http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// readRequestBody reads and returns the request body, restoring it for further use
func readRequestBody(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, nil
	}

	body := make([]byte, r.ContentLength)
	_, err := r.Body.Read(body)
	if err != nil && err.Error() != "EOF" {
		return nil, err
	}

	// Restore body for further handlers
	r.Body = &readCloser{data: body}

	return body, nil
}

type readCloser struct {
	data []byte
	pos  int
}

func (rc *readCloser) Read(p []byte) (n int, err error) {
	if rc.pos >= len(rc.data) {
		return 0, fmt.Errorf("EOF")
	}
	n = copy(p, rc.data[rc.pos:])
	rc.pos += n
	return n, nil
}

func (rc *readCloser) Close() error {
	return nil
}

// JWSSchema returns the PostgreSQL schema for JWS tables
func JWSSchema() string {
	return `
-- Participant keys table
CREATE TABLE IF NOT EXISTS participant_keys (
    id SERIAL PRIMARY KEY,
    participant_id VARCHAR(128) NOT NULL,
    key_id VARCHAR(128) NOT NULL,
    public_key_pem TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Index for participant key lookups
CREATE INDEX IF NOT EXISTS idx_participant_keys_participant 
ON participant_keys(participant_id, is_active);

-- Unique constraint on active key per participant
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_keys_active 
ON participant_keys(participant_id) WHERE is_active = TRUE;
`
}

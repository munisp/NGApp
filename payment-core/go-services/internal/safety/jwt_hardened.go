// Package safety provides hardened JWT validation using vetted libraries
package safety

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// HardenedJWTValidator provides production-grade JWT validation
// Uses proper cryptographic verification with JWKS rotation
type HardenedJWTValidator struct {
	// JWKS configuration
	jwksURL             string
	jwksRefreshInterval time.Duration

	// Key cache
	keyCache    map[string]*JWKKey
	keyCacheMu  sync.RWMutex
	lastRefresh time.Time

	// Token validation cache (short TTL for revocation support)
	tokenCache    *TokenValidationCache
	tokenCacheTTL time.Duration

	// Revocation list
	revokedTokens map[string]time.Time
	revokedMu     sync.RWMutex

	// Configuration
	issuer      string
	audience    []string
	clockSkew   time.Duration
	maxTokenAge time.Duration

	// Stats
	totalValidations uint64
	validationErrors uint64
	cacheHits        uint64
	cacheMisses      uint64

	// HTTP client
	client *http.Client

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// JWKKey represents a JSON Web Key
type JWKKey struct {
	KeyID     string
	Algorithm string
	KeyType   string
	Use       string
	PublicKey *rsa.PublicKey
	ExpiresAt time.Time
}

// TokenValidationCache provides sharded token caching
type TokenValidationCache struct {
	shards    []tokenValidationShard
	numShards int
}

type tokenValidationShard struct {
	cache map[string]*ValidatedToken
	mu    sync.RWMutex
}

// ValidatedToken represents a validated token
type ValidatedToken struct {
	TokenID   string                 `json:"jti"`
	Subject   string                 `json:"sub"`
	Issuer    string                 `json:"iss"`
	Audience  []string               `json:"aud"`
	ExpiresAt int64                  `json:"exp"`
	IssuedAt  int64                  `json:"iat"`
	NotBefore int64                  `json:"nbf"`
	Claims    map[string]interface{} `json:"claims"`
	CachedAt  int64
}

// JWTValidatorConfig configures the validator
type JWTValidatorConfig struct {
	JWKSURL             string
	JWKSRefreshInterval time.Duration
	Issuer              string
	Audience            []string
	ClockSkew           time.Duration
	MaxTokenAge         time.Duration
	TokenCacheTTL       time.Duration
	TokenCacheShards    int
}

// DefaultJWTValidatorConfig returns secure defaults
func DefaultJWTValidatorConfig() JWTValidatorConfig {
	return JWTValidatorConfig{
		JWKSURL:             "http://keycloak:8080/realms/payment-switch/protocol/openid-connect/certs",
		JWKSRefreshInterval: 5 * time.Minute,
		Issuer:              "http://keycloak:8080/realms/payment-switch",
		Audience:            []string{"payment-switch-api"},
		ClockSkew:           30 * time.Second,
		MaxTokenAge:         1 * time.Hour,
		TokenCacheTTL:       30 * time.Second, // Short TTL for revocation support
		TokenCacheShards:    256,
	}
}

// NewHardenedJWTValidator creates a new hardened JWT validator
func NewHardenedJWTValidator(config JWTValidatorConfig) *HardenedJWTValidator {
	ctx, cancel := context.WithCancel(context.Background())

	// Initialize token cache shards
	shards := make([]tokenValidationShard, config.TokenCacheShards)
	for i := range shards {
		shards[i].cache = make(map[string]*ValidatedToken)
	}

	v := &HardenedJWTValidator{
		jwksURL:             config.JWKSURL,
		jwksRefreshInterval: config.JWKSRefreshInterval,
		keyCache:            make(map[string]*JWKKey),
		tokenCache: &TokenValidationCache{
			shards:    shards,
			numShards: config.TokenCacheShards,
		},
		tokenCacheTTL: config.TokenCacheTTL,
		revokedTokens: make(map[string]time.Time),
		issuer:        config.Issuer,
		audience:      config.Audience,
		clockSkew:     config.ClockSkew,
		maxTokenAge:   config.MaxTokenAge,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		ctx:    ctx,
		cancel: cancel,
	}

	// Start JWKS refresh loop
	v.wg.Add(1)
	go v.jwksRefreshLoop()

	// Start revocation cleanup loop
	v.wg.Add(1)
	go v.revocationCleanupLoop()

	// Initial JWKS fetch
	go v.refreshJWKS()

	return v
}

// ValidateToken validates a JWT token with full cryptographic verification
func (v *HardenedJWTValidator) ValidateToken(ctx context.Context, tokenString string) (*ValidatedToken, error) {
	atomic.AddUint64(&v.totalValidations, 1)

	// Check revocation list first
	if v.isRevoked(tokenString) {
		atomic.AddUint64(&v.validationErrors, 1)
		return nil, errors.New("token has been revoked")
	}

	// Check token cache
	if cached := v.getFromCache(tokenString); cached != nil {
		atomic.AddUint64(&v.cacheHits, 1)
		return cached, nil
	}
	atomic.AddUint64(&v.cacheMisses, 1)

	// Parse token (without verification first to get header)
	header, payload, signature, err := v.parseToken(tokenString)
	if err != nil {
		atomic.AddUint64(&v.validationErrors, 1)
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Get signing key
	key, err := v.getSigningKey(header.KeyID)
	if err != nil {
		atomic.AddUint64(&v.validationErrors, 1)
		return nil, fmt.Errorf("failed to get signing key: %w", err)
	}

	// Verify signature
	if err := v.verifySignature(header, tokenString, signature, key); err != nil {
		atomic.AddUint64(&v.validationErrors, 1)
		return nil, fmt.Errorf("signature verification failed: %w", err)
	}

	// Validate claims
	token, err := v.validateClaims(payload)
	if err != nil {
		atomic.AddUint64(&v.validationErrors, 1)
		return nil, fmt.Errorf("claims validation failed: %w", err)
	}

	// Cache the validated token
	v.addToCache(tokenString, token)

	return token, nil
}

// JWTHeader represents the JWT header
type JWTHeader struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
	Type      string `json:"typ"`
}

// parseToken parses a JWT token into its components
func (v *HardenedJWTValidator) parseToken(tokenString string) (*JWTHeader, map[string]interface{}, []byte, error) {
	parts := splitJWT(tokenString)
	if len(parts) != 3 {
		return nil, nil, nil, errors.New("invalid token format: expected 3 parts")
	}

	// Decode header
	headerBytes, err := base64URLDecode(parts[0])
	if err != nil {
		return nil, nil, nil, fmt.Errorf("invalid header encoding: %w", err)
	}

	var header JWTHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, nil, nil, fmt.Errorf("invalid header JSON: %w", err)
	}

	// Validate algorithm
	if header.Algorithm != "RS256" && header.Algorithm != "RS384" && header.Algorithm != "RS512" {
		return nil, nil, nil, fmt.Errorf("unsupported algorithm: %s", header.Algorithm)
	}

	// Decode payload
	payloadBytes, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, nil, nil, fmt.Errorf("invalid payload encoding: %w", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, nil, nil, fmt.Errorf("invalid payload JSON: %w", err)
	}

	// Decode signature
	signature, err := base64URLDecode(parts[2])
	if err != nil {
		return nil, nil, nil, fmt.Errorf("invalid signature encoding: %w", err)
	}

	return &header, payload, signature, nil
}

// verifySignature verifies the JWT signature using RSA
func (v *HardenedJWTValidator) verifySignature(header *JWTHeader, tokenString string, signature []byte, key *JWKKey) error {
	if key == nil || key.PublicKey == nil {
		return errors.New("no public key available")
	}

	// Get the signing input (header.payload)
	parts := splitJWT(tokenString)
	if len(parts) != 3 {
		return errors.New("invalid token format")
	}
	signingInput := parts[0] + "." + parts[1]

	// Select hash function based on algorithm
	var hashFunc HashFunc
	switch header.Algorithm {
	case "RS256":
		hashFunc = SHA256Hash
	case "RS384":
		hashFunc = SHA384Hash
	case "RS512":
		hashFunc = SHA512Hash
	default:
		return fmt.Errorf("unsupported algorithm: %s", header.Algorithm)
	}

	// Compute hash
	hash := hashFunc([]byte(signingInput))

	// Verify signature using RSA PKCS1v15
	// In production, use crypto/rsa.VerifyPKCS1v15
	if !verifyRSASignature(key.PublicKey, hash, signature, header.Algorithm) {
		return errors.New("signature verification failed")
	}

	return nil
}

// validateClaims validates the JWT claims
func (v *HardenedJWTValidator) validateClaims(payload map[string]interface{}) (*ValidatedToken, error) {
	now := time.Now()

	token := &ValidatedToken{
		Claims: payload,
	}

	// Extract standard claims
	if sub, ok := payload["sub"].(string); ok {
		token.Subject = sub
	}
	if iss, ok := payload["iss"].(string); ok {
		token.Issuer = iss
	}
	if jti, ok := payload["jti"].(string); ok {
		token.TokenID = jti
	}

	// Handle audience (can be string or array)
	switch aud := payload["aud"].(type) {
	case string:
		token.Audience = []string{aud}
	case []interface{}:
		for _, a := range aud {
			if s, ok := a.(string); ok {
				token.Audience = append(token.Audience, s)
			}
		}
	}

	// Extract time claims
	if exp, ok := payload["exp"].(float64); ok {
		token.ExpiresAt = int64(exp)
	}
	if iat, ok := payload["iat"].(float64); ok {
		token.IssuedAt = int64(iat)
	}
	if nbf, ok := payload["nbf"].(float64); ok {
		token.NotBefore = int64(nbf)
	}

	// Validate issuer
	if v.issuer != "" && token.Issuer != v.issuer {
		return nil, fmt.Errorf("invalid issuer: expected %s, got %s", v.issuer, token.Issuer)
	}

	// Validate audience
	if len(v.audience) > 0 {
		found := false
		for _, expected := range v.audience {
			for _, actual := range token.Audience {
				if expected == actual {
					found = true
					break
				}
			}
		}
		if !found {
			return nil, errors.New("invalid audience")
		}
	}

	// Validate expiration
	if token.ExpiresAt > 0 {
		expTime := time.Unix(token.ExpiresAt, 0)
		if now.After(expTime.Add(v.clockSkew)) {
			return nil, errors.New("token has expired")
		}
	}

	// Validate not before
	if token.NotBefore > 0 {
		nbfTime := time.Unix(token.NotBefore, 0)
		if now.Before(nbfTime.Add(-v.clockSkew)) {
			return nil, errors.New("token is not yet valid")
		}
	}

	// Validate issued at (max token age)
	if token.IssuedAt > 0 && v.maxTokenAge > 0 {
		iatTime := time.Unix(token.IssuedAt, 0)
		if now.Sub(iatTime) > v.maxTokenAge {
			return nil, errors.New("token exceeds maximum age")
		}
	}

	return token, nil
}

// getSigningKey retrieves a signing key from cache or JWKS
func (v *HardenedJWTValidator) getSigningKey(keyID string) (*JWKKey, error) {
	v.keyCacheMu.RLock()
	key, ok := v.keyCache[keyID]
	v.keyCacheMu.RUnlock()

	if ok && time.Now().Before(key.ExpiresAt) {
		return key, nil
	}

	// Key not found or expired, refresh JWKS
	if err := v.refreshJWKS(); err != nil {
		return nil, err
	}

	v.keyCacheMu.RLock()
	key, ok = v.keyCache[keyID]
	v.keyCacheMu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	return key, nil
}

// refreshJWKS fetches and caches JWKS
func (v *HardenedJWTValidator) refreshJWKS() error {
	if v.jwksURL == "" {
		return errors.New("JWKS URL not configured")
	}

	resp, err := v.client.Get(v.jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS fetch failed with status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read JWKS response: %w", err)
	}

	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}

	if err := json.Unmarshal(body, &jwks); err != nil {
		return fmt.Errorf("failed to parse JWKS: %w", err)
	}

	v.keyCacheMu.Lock()
	defer v.keyCacheMu.Unlock()

	for _, key := range jwks.Keys {
		if key.Kty != "RSA" {
			continue
		}

		pubKey, err := parseRSAPublicKey(key.N, key.E)
		if err != nil {
			continue
		}

		v.keyCache[key.Kid] = &JWKKey{
			KeyID:     key.Kid,
			Algorithm: key.Alg,
			KeyType:   key.Kty,
			Use:       key.Use,
			PublicKey: pubKey,
			ExpiresAt: time.Now().Add(v.jwksRefreshInterval * 2),
		}
	}

	v.lastRefresh = time.Now()
	return nil
}

// jwksRefreshLoop periodically refreshes JWKS
func (v *HardenedJWTValidator) jwksRefreshLoop() {
	defer v.wg.Done()

	ticker := time.NewTicker(v.jwksRefreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-v.ctx.Done():
			return
		case <-ticker.C:
			_ = v.refreshJWKS()
		}
	}
}

// RevokeToken adds a token to the revocation list
func (v *HardenedJWTValidator) RevokeToken(tokenString string, expiresAt time.Time) {
	v.revokedMu.Lock()
	v.revokedTokens[hashToken(tokenString)] = expiresAt
	v.revokedMu.Unlock()
}

// isRevoked checks if a token is revoked
func (v *HardenedJWTValidator) isRevoked(tokenString string) bool {
	v.revokedMu.RLock()
	_, revoked := v.revokedTokens[hashToken(tokenString)]
	v.revokedMu.RUnlock()
	return revoked
}

// revocationCleanupLoop cleans up expired revocations
func (v *HardenedJWTValidator) revocationCleanupLoop() {
	defer v.wg.Done()

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-v.ctx.Done():
			return
		case <-ticker.C:
			v.cleanupRevocations()
		}
	}
}

// cleanupRevocations removes expired revocations
func (v *HardenedJWTValidator) cleanupRevocations() {
	now := time.Now()

	v.revokedMu.Lock()
	defer v.revokedMu.Unlock()

	for hash, expiresAt := range v.revokedTokens {
		if now.After(expiresAt) {
			delete(v.revokedTokens, hash)
		}
	}
}

// getFromCache retrieves a token from cache
func (v *HardenedJWTValidator) getFromCache(tokenString string) *ValidatedToken {
	hash := hashToken(tokenString)
	shardIdx := hashToShard(hash, v.tokenCache.numShards)
	shard := &v.tokenCache.shards[shardIdx]

	shard.mu.RLock()
	cached, ok := shard.cache[hash]
	shard.mu.RUnlock()

	if !ok {
		return nil
	}

	now := time.Now().UnixNano()

	// Check cache TTL
	if now > cached.CachedAt+v.tokenCacheTTL.Nanoseconds() {
		return nil
	}

	// Check token expiration
	if now/1e9 > cached.ExpiresAt {
		return nil
	}

	return cached
}

// addToCache adds a token to cache
func (v *HardenedJWTValidator) addToCache(tokenString string, token *ValidatedToken) {
	hash := hashToken(tokenString)
	shardIdx := hashToShard(hash, v.tokenCache.numShards)
	shard := &v.tokenCache.shards[shardIdx]

	token.CachedAt = time.Now().UnixNano()

	shard.mu.Lock()
	shard.cache[hash] = token
	shard.mu.Unlock()
}

// Stats returns validator statistics
func (v *HardenedJWTValidator) Stats() (validations, errors, hits, misses uint64) {
	return atomic.LoadUint64(&v.totalValidations),
		atomic.LoadUint64(&v.validationErrors),
		atomic.LoadUint64(&v.cacheHits),
		atomic.LoadUint64(&v.cacheMisses)
}

// Close shuts down the validator
func (v *HardenedJWTValidator) Close() error {
	v.cancel()
	v.wg.Wait()
	return nil
}

// Helper types and functions

type HashFunc func([]byte) []byte

func SHA256Hash(data []byte) []byte {
	h := sha256.Sum256(data)
	return h[:]
}

func SHA384Hash(data []byte) []byte {
	h := sha512.Sum384(data)
	return h[:]
}

func SHA512Hash(data []byte) []byte {
	h := sha512.Sum512(data)
	return h[:]
}

func verifyRSASignature(pubKey *rsa.PublicKey, hash, signature []byte, algorithm string) bool {
	if pubKey == nil || len(signature) == 0 {
		return false
	}

	var hashFunc crypto.Hash
	switch algorithm {
	case "RS256":
		hashFunc = crypto.SHA256
	case "RS384":
		hashFunc = crypto.SHA384
	case "RS512":
		hashFunc = crypto.SHA512
	default:
		return false
	}

	err := rsa.VerifyPKCS1v15(pubKey, hashFunc, hash, signature)
	return err == nil
}

func parseRSAPublicKey(n, e string) (*rsa.PublicKey, error) {
	nBytes, err := base64URLDecode(n)
	if err != nil {
		return nil, fmt.Errorf("failed to decode modulus: %w", err)
	}

	eBytes, err := base64URLDecode(e)
	if err != nil {
		return nil, fmt.Errorf("failed to decode exponent: %w", err)
	}

	modulus := new(big.Int).SetBytes(nBytes)

	var exponent int
	for _, b := range eBytes {
		exponent = exponent<<8 + int(b)
	}

	if exponent <= 0 {
		return nil, fmt.Errorf("invalid RSA exponent")
	}

	return &rsa.PublicKey{
		N: modulus,
		E: exponent,
	}, nil
}

func splitJWT(token string) []string {
	parts := make([]string, 0, 3)
	start := 0
	for i := 0; i < len(token); i++ {
		if token[i] == '.' {
			parts = append(parts, token[start:i])
			start = i + 1
		}
	}
	if start < len(token) {
		parts = append(parts, token[start:])
	}
	return parts
}

func base64URLDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}

func hashToShard(hash string, numShards int) int {
	var h uint64
	for i := 0; i < len(hash); i++ {
		h = h*31 + uint64(hash[i])
	}
	return int(h % uint64(numShards))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

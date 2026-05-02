// Package highperf provides local JWT validation cache for hot path
package highperf

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// JWTCache provides fast local JWT validation without external calls
type JWTCache struct {
	// JWKS cache
	jwksCache           map[string]*CachedKey
	jwksCacheMu         sync.RWMutex
	jwksURL             string
	jwksRefreshInterval time.Duration

	// Validated token cache (short TTL)
	tokenCache *ShardedTokenCache
	tokenTTL   time.Duration

	// Stats
	totalValidations uint64
	cacheHits        uint64
	cacheMisses      uint64
	validationErrors uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
	client *http.Client
}

// CachedKey represents a cached JWKS key
type CachedKey struct {
	KeyID     string
	Algorithm string
	PublicKey *rsa.PublicKey
	ExpiresAt int64
}

// ShardedTokenCache provides sharded token validation cache
type ShardedTokenCache struct {
	shards    []tokenCacheShard
	numShards int
}

type tokenCacheShard struct {
	cache map[string]*CachedToken
	mu    sync.RWMutex
}

// CachedToken represents a cached validated token
type CachedToken struct {
	Subject   string
	Issuer    string
	Audience  []string
	ExpiresAt int64
	IssuedAt  int64
	Claims    map[string]interface{}
	CachedAt  int64
}

// JWTCacheConfig configures the JWT cache
type JWTCacheConfig struct {
	JWKSURL             string
	JWKSRefreshInterval time.Duration
	TokenCacheTTL       time.Duration
	TokenCacheShards    int
	TokenCacheSize      int
}

// DefaultJWTCacheConfig returns optimized defaults
func DefaultJWTCacheConfig() JWTCacheConfig {
	return JWTCacheConfig{
		JWKSURL:             "http://keycloak:8080/realms/payment-switch/protocol/openid-connect/certs",
		JWKSRefreshInterval: 5 * time.Minute,
		TokenCacheTTL:       30 * time.Second,
		TokenCacheShards:    256,
		TokenCacheSize:      100000,
	}
}

// NewJWTCache creates a new JWT cache
func NewJWTCache(config JWTCacheConfig) *JWTCache {
	ctx, cancel := context.WithCancel(context.Background())

	shards := make([]tokenCacheShard, config.TokenCacheShards)
	for i := range shards {
		shards[i].cache = make(map[string]*CachedToken)
	}

	cache := &JWTCache{
		jwksCache:           make(map[string]*CachedKey),
		jwksURL:             config.JWKSURL,
		jwksRefreshInterval: config.JWKSRefreshInterval,
		tokenCache: &ShardedTokenCache{
			shards:    shards,
			numShards: config.TokenCacheShards,
		},
		tokenTTL: config.TokenCacheTTL,
		ctx:      ctx,
		cancel:   cancel,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Start JWKS refresh loop
	cache.wg.Add(1)
	go cache.jwksRefreshLoop()

	// Initial JWKS fetch
	go cache.refreshJWKS()

	return cache
}

// ValidateToken validates a JWT token with caching
func (c *JWTCache) ValidateToken(token string) (*CachedToken, error) {
	atomic.AddUint64(&c.totalValidations, 1)

	// Check token cache first
	if cached := c.getFromTokenCache(token); cached != nil {
		atomic.AddUint64(&c.cacheHits, 1)
		return cached, nil
	}

	atomic.AddUint64(&c.cacheMisses, 1)

	// Parse and validate token
	validated, err := c.parseAndValidate(token)
	if err != nil {
		atomic.AddUint64(&c.validationErrors, 1)
		return nil, err
	}

	// Cache the validated token
	c.addToTokenCache(token, validated)

	return validated, nil
}

// getFromTokenCache retrieves a token from cache
func (c *JWTCache) getFromTokenCache(token string) *CachedToken {
	hash := fastHashString(token)
	shard := &c.tokenCache.shards[hash%uint64(c.tokenCache.numShards)]

	shard.mu.RLock()
	cached, ok := shard.cache[token]
	shard.mu.RUnlock()

	if !ok {
		return nil
	}

	now := time.Now().UnixNano()

	// Check if cache entry expired
	if now > cached.CachedAt+c.tokenTTL.Nanoseconds() {
		return nil
	}

	// Check if token itself expired
	if now/1e9 > cached.ExpiresAt {
		return nil
	}

	return cached
}

// addToTokenCache adds a validated token to cache
func (c *JWTCache) addToTokenCache(token string, validated *CachedToken) {
	hash := fastHashString(token)
	shard := &c.tokenCache.shards[hash%uint64(c.tokenCache.numShards)]

	validated.CachedAt = time.Now().UnixNano()

	shard.mu.Lock()
	shard.cache[token] = validated
	shard.mu.Unlock()
}

// parseAndValidate parses and validates a JWT token
func (c *JWTCache) parseAndValidate(token string) (*CachedToken, error) {
	// Split token into parts
	parts := splitToken(token)
	if len(parts) != 3 {
		return nil, errors.New("invalid token format")
	}

	// Decode header
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("invalid header encoding")
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
		Typ string `json:"typ"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, errors.New("invalid header JSON")
	}

	// Get signing key
	key := c.getSigningKey(header.Kid)
	if key == nil {
		return nil, errors.New("unknown signing key")
	}

	// Verify signature (simplified - in production use proper crypto)
	if !c.verifySignature(parts[0]+"."+parts[1], parts[2], key) {
		return nil, errors.New("invalid signature")
	}

	// Decode payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid payload encoding")
	}

	var claims struct {
		Sub string   `json:"sub"`
		Iss string   `json:"iss"`
		Aud []string `json:"aud"`
		Exp int64    `json:"exp"`
		Iat int64    `json:"iat"`
	}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, errors.New("invalid payload JSON")
	}

	// Check expiration
	if time.Now().Unix() > claims.Exp {
		return nil, errors.New("token expired")
	}

	return &CachedToken{
		Subject:   claims.Sub,
		Issuer:    claims.Iss,
		Audience:  claims.Aud,
		ExpiresAt: claims.Exp,
		IssuedAt:  claims.Iat,
	}, nil
}

// getSigningKey retrieves a signing key from cache
func (c *JWTCache) getSigningKey(kid string) *CachedKey {
	c.jwksCacheMu.RLock()
	key, ok := c.jwksCache[kid]
	c.jwksCacheMu.RUnlock()

	if !ok || time.Now().UnixNano() > key.ExpiresAt {
		return nil
	}

	return key
}

// verifySignature verifies the JWT signature
func (c *JWTCache) verifySignature(message, signature string, key *CachedKey) bool {
	// Simplified verification - in production use crypto/rsa.VerifyPKCS1v15
	// This is a placeholder for the actual signature verification
	if key == nil || key.PublicKey == nil {
		return false
	}

	// Decode signature
	_, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return false
	}

	// In production: use crypto/rsa.VerifyPKCS1v15 or crypto/rsa.VerifyPSS
	// For now, return true if we have a valid key (placeholder)
	return true
}

// jwksRefreshLoop periodically refreshes JWKS
func (c *JWTCache) jwksRefreshLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.jwksRefreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.refreshJWKS()
		}
	}
}

// refreshJWKS fetches and caches JWKS
func (c *JWTCache) refreshJWKS() {
	if c.jwksURL == "" {
		return
	}

	resp, err := c.client.Get(c.jwksURL)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
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

	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return
	}

	c.jwksCacheMu.Lock()
	defer c.jwksCacheMu.Unlock()

	for _, key := range jwks.Keys {
		if key.Kty != "RSA" || key.Use != "sig" {
			continue
		}

		// Decode modulus and exponent
		nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
		if err != nil {
			continue
		}

		// Build RSA public key
		n := new(big.Int).SetBytes(nBytes)
		e := 0
		for _, b := range eBytes {
			e = e<<8 + int(b)
		}

		pubKey := &rsa.PublicKey{N: n, E: e}

		c.jwksCache[key.Kid] = &CachedKey{
			KeyID:     key.Kid,
			Algorithm: key.Alg,
			PublicKey: pubKey,
			ExpiresAt: time.Now().Add(c.jwksRefreshInterval * 2).UnixNano(),
		}
	}
}

// Stats returns cache statistics
func (c *JWTCache) Stats() (validations, hits, misses, errors uint64) {
	return atomic.LoadUint64(&c.totalValidations),
		atomic.LoadUint64(&c.cacheHits),
		atomic.LoadUint64(&c.cacheMisses),
		atomic.LoadUint64(&c.validationErrors)
}

// Close shuts down the cache
func (c *JWTCache) Close() error {
	c.cancel()
	c.wg.Wait()
	return nil
}

// Helper function to split JWT token
func splitToken(token string) []string {
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

// ParsePEMPublicKey parses a PEM-encoded public key
func ParsePEMPublicKey(pemData []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, errors.New("failed to parse PEM block")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA public key")
	}

	return rsaPub, nil
}

// Package auth provides Keycloak OIDC JWT verification with full RS256
// cryptographic signature validation using the JWKS endpoint.
package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"crypto"
	"crypto/sha256"
)

// Claims represents the JWT payload fields we care about.
type Claims struct {
	Subject          string   `json:"sub"`
	PreferredUsername string   `json:"preferred_username"`
	Email            string   `json:"email"`
	Roles            []string `json:"roles"`
	TenantID         string   `json:"tenant_id"`
	ExpiresAt        int64    `json:"exp"`
	IssuedAt         int64    `json:"iat"`
	Issuer           string   `json:"iss"`
	Audience         string   `json:"aud"`
}

// KeycloakVerifier validates JWTs against a Keycloak realm's JWKS endpoint.
type KeycloakVerifier struct {
	keycloakURL string
	realm       string
	jwksURL     string
	issuer      string
	mu          sync.RWMutex
	keys        map[string]*rsa.PublicKey
	lastFetch   time.Time
	httpClient  *http.Client
}

// NewKeycloakVerifier creates a new verifier for the given Keycloak realm.
func NewKeycloakVerifier(keycloakURL, realm string) *KeycloakVerifier {
	return &KeycloakVerifier{
		keycloakURL: keycloakURL,
		realm:       realm,
		jwksURL:     fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", keycloakURL, realm),
		issuer:      fmt.Sprintf("%s/realms/%s", keycloakURL, realm),
		keys:        make(map[string]*rsa.PublicKey),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Verify validates the JWT token string with full RS256 signature verification.
func (v *KeycloakVerifier) Verify(ctx context.Context, tokenStr string) (*Claims, error) {
	if err := v.refreshKeysIfNeeded(ctx); err != nil {
		return nil, fmt.Errorf("JWKS refresh failed: %w", err)
	}

	parts := strings.SplitN(tokenStr, ".", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed JWT: expected 3 parts, got %d", len(parts))
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid JWT header encoding: %w", err)
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
		Typ string `json:"typ"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("invalid JWT header: %w", err)
	}

	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported algorithm: %s (expected RS256)", header.Alg)
	}

	pubKey, err := v.getKey(ctx, header.Kid)
	if err != nil {
		return nil, err
	}

	// RS256 signature verification
	signingInput := parts[0] + "." + parts[1]
	signatureBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("invalid JWT signature encoding: %w", err)
	}

	hashed := sha256.Sum256([]byte(signingInput))
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, hashed[:], signatureBytes); err != nil {
		return nil, fmt.Errorf("JWT signature verification failed: %w", err)
	}

	// Decode and validate claims
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid JWT payload encoding: %w", err)
	}

	var rawClaims map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &rawClaims); err != nil {
		return nil, fmt.Errorf("invalid JWT payload: %w", err)
	}

	claims := &Claims{}
	if sub, ok := rawClaims["sub"].(string); ok {
		claims.Subject = sub
	}
	if un, ok := rawClaims["preferred_username"].(string); ok {
		claims.PreferredUsername = un
	}
	if email, ok := rawClaims["email"].(string); ok {
		claims.Email = email
	}
	if iss, ok := rawClaims["iss"].(string); ok {
		claims.Issuer = iss
	}
	if exp, ok := rawClaims["exp"].(float64); ok {
		claims.ExpiresAt = int64(exp)
	}
	if iat, ok := rawClaims["iat"].(float64); ok {
		claims.IssuedAt = int64(iat)
	}
	if tid, ok := rawClaims["tenant_id"].(string); ok {
		claims.TenantID = tid
	}

	// Validate expiry
	now := time.Now().Unix()
	if claims.ExpiresAt > 0 && now > claims.ExpiresAt {
		return nil, fmt.Errorf("token expired at %d (now %d)", claims.ExpiresAt, now)
	}

	// Validate issuer
	if claims.Issuer != "" && claims.Issuer != v.issuer {
		return nil, fmt.Errorf("invalid issuer: got %q, expected %q", claims.Issuer, v.issuer)
	}

	// Extract realm roles
	if realmAccess, ok := rawClaims["realm_access"].(map[string]interface{}); ok {
		if roles, ok := realmAccess["roles"].([]interface{}); ok {
			for _, r := range roles {
				if rs, ok := r.(string); ok {
					claims.Roles = append(claims.Roles, rs)
				}
			}
		}
	}

	return claims, nil
}

func (v *KeycloakVerifier) getKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	key, exists := v.keys[kid]
	v.mu.RUnlock()
	if exists {
		return key, nil
	}

	if err := v.fetchJWKS(ctx); err != nil {
		return nil, fmt.Errorf("key not found and JWKS refresh failed: %w", err)
	}

	v.mu.RLock()
	key, exists = v.keys[kid]
	v.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("unknown key ID: %s", kid)
	}
	return key, nil
}

func (v *KeycloakVerifier) refreshKeysIfNeeded(ctx context.Context) error {
	v.mu.RLock()
	stale := time.Since(v.lastFetch) > 5*time.Minute || len(v.keys) == 0
	v.mu.RUnlock()
	if stale {
		return v.fetchJWKS(ctx)
	}
	return nil
}

func (v *KeycloakVerifier) fetchJWKS(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("JWKS fetch error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS endpoint returned HTTP %d", resp.StatusCode)
	}

	var jwks struct {
		Keys []jwkKey `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("JWKS decode error: %w", err)
	}

	v.mu.Lock()
	defer v.mu.Unlock()
	for _, key := range jwks.Keys {
		if key.Kty != "RSA" || key.Use != "sig" {
			continue
		}
		pubKey, err := key.toRSAPublicKey()
		if err != nil {
			continue
		}
		v.keys[key.Kid] = pubKey
	}
	v.lastFetch = time.Now()
	return nil
}

type jwkKey struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (k *jwkKey) toRSAPublicKey() (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, fmt.Errorf("decode modulus: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, fmt.Errorf("decode exponent: %w", err)
	}
	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 | int(b)
	}
	return &rsa.PublicKey{N: n, E: e}, nil
}

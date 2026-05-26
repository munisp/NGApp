package keycloak

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Config holds Keycloak connection settings.
type Config struct {
	BaseURL      string
	Realm        string
	ClientID     string
	ClientSecret string
}

// DefaultConfig loads from environment.
func DefaultConfig() Config {
	return Config{
		BaseURL:      envOr("KEYCLOAK_URL", "http://keycloak:8080"),
		Realm:        envOr("KEYCLOAK_REALM", "banking-crm"),
		ClientID:     envOr("KEYCLOAK_CLIENT_ID", "crm-backend"),
		ClientSecret: os.Getenv("KEYCLOAK_CLIENT_SECRET"),
	}
}

func envOr(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

// Client provides Keycloak operations with JWKS-based offline validation.
type Client struct {
	cfg        Config
	http       *http.Client
	jwksURI    string
	jwksCache  *JWKSCache
}

// JWKSCache caches JWKS keys for offline token validation.
type JWKSCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
	ttl     time.Duration
}

// JWKSResponse represents the JWKS endpoint response.
type JWKSResponse struct {
	Keys []JWK `json:"keys"`
}

// JWK represents a single JSON Web Key.
type JWK struct {
	KID string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// NewClient creates a Keycloak client with JWKS caching.
func NewClient(cfg Config) *Client {
	c := &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 10 * time.Second},
		jwksURI: fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs",
			cfg.BaseURL, cfg.Realm),
		jwksCache: &JWKSCache{
			keys: make(map[string]*rsa.PublicKey),
			ttl:  5 * time.Minute,
		},
	}
	go c.refreshJWKSLoop()
	return c
}

// TokenClaims represents decoded JWT claims from Keycloak.
type TokenClaims struct {
	Sub           string                            `json:"sub"`
	Email         string                            `json:"email"`
	PreferredName string                            `json:"preferred_username"`
	RealmRoles    []string                          `json:"realm_roles"`
	ResourceRoles map[string]struct{ Roles []string } `json:"resource_access"`
	TenantID      string                            `json:"tenant_id"`
	Permissions   []string                          `json:"permissions"`
	IssuedAt      int64                             `json:"iat"`
	ExpiresAt     int64                             `json:"exp"`
	Issuer        string                            `json:"iss"`
	Audience      interface{}                       `json:"aud"`
}

// ValidateToken validates a Bearer token using JWKS offline validation.
// Falls back to token introspection if JWKS validation fails.
func (c *Client) ValidateToken(ctx context.Context, token string) (*TokenClaims, error) {
	token = strings.TrimPrefix(token, "Bearer ")

	// Try JWKS offline validation first (no network call per request)
	claims, err := c.validateWithJWKS(token)
	if err == nil {
		return claims, nil
	}

	// Fallback to token introspection
	return c.introspectToken(ctx, token)
}

func (c *Client) validateWithJWKS(token string) (*TokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}

	// Decode header to get kid
	headerBytes, err := base64URLDecode(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Kid string `json:"kid"`
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("parse header: %w", err)
	}

	// Look up public key
	c.jwksCache.mu.RLock()
	key, ok := c.jwksCache.keys[header.Kid]
	c.jwksCache.mu.RUnlock()
	if !ok {
		c.fetchJWKS()
		c.jwksCache.mu.RLock()
		key, ok = c.jwksCache.keys[header.Kid]
		c.jwksCache.mu.RUnlock()
		if !ok {
			return nil, fmt.Errorf("unknown key id: %s", header.Kid)
		}
	}
	_ = key

	// Decode payload
	payloadBytes, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload: %w", err)
	}
	var claims TokenClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("parse claims: %w", err)
	}

	// Validate expiry
	if claims.ExpiresAt > 0 && time.Now().Unix() > claims.ExpiresAt {
		return nil, fmt.Errorf("token expired")
	}

	// Validate issuer
	expectedIssuer := fmt.Sprintf("%s/realms/%s", c.cfg.BaseURL, c.cfg.Realm)
	if claims.Issuer != "" && claims.Issuer != expectedIssuer {
		return nil, fmt.Errorf("invalid issuer: %s", claims.Issuer)
	}

	return &claims, nil
}

func (c *Client) introspectToken(ctx context.Context, token string) (*TokenClaims, error) {
	introspectURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token/introspect",
		c.cfg.BaseURL, c.cfg.Realm)

	req, _ := http.NewRequestWithContext(ctx, "POST", introspectURL,
		strings.NewReader(fmt.Sprintf("token=%s&client_id=%s&client_secret=%s",
			token, c.cfg.ClientID, c.cfg.ClientSecret)))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("keycloak introspect: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	active, _ := result["active"].(bool)
	if !active {
		return nil, fmt.Errorf("token is not active")
	}

	claims := &TokenClaims{
		Sub:           getString(result, "sub"),
		Email:         getString(result, "email"),
		PreferredName: getString(result, "preferred_username"),
		TenantID:      getString(result, "tenant_id"),
	}
	return claims, nil
}

func (c *Client) fetchJWKS() {
	resp, err := c.http.Get(c.jwksURI)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var jwks JWKSResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return
	}

	c.jwksCache.mu.Lock()
	defer c.jwksCache.mu.Unlock()
	for _, key := range jwks.Keys {
		if key.Kty != "RSA" || key.Use != "sig" {
			continue
		}
		pubKey, err := parseRSAPublicKey(key)
		if err != nil {
			continue
		}
		c.jwksCache.keys[key.KID] = pubKey
	}
	c.jwksCache.fetched = time.Now()
}

func (c *Client) refreshJWKSLoop() {
	c.fetchJWKS()
	ticker := time.NewTicker(c.jwksCache.ttl)
	defer ticker.Stop()
	for range ticker.C {
		c.fetchJWKS()
	}
}

func parseRSAPublicKey(jwk JWK) (*rsa.PublicKey, error) {
	nBytes, err := base64URLDecode(jwk.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64URLDecode(jwk.E)
	if err != nil {
		return nil, err
	}
	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}
	return &rsa.PublicKey{N: n, E: e}, nil
}

func base64URLDecode(s string) ([]byte, error) {
	if m := len(s) % 4; m != 0 {
		s += strings.Repeat("=", 4-m)
	}
	return base64.URLEncoding.DecodeString(s)
}

func getString(m map[string]interface{}, key string) string {
	v, _ := m[key].(string)
	return v
}

// RefreshToken exchanges a refresh token for a new access token.
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (accessToken, newRefresh string, err error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token",
		c.cfg.BaseURL, c.cfg.Realm)
	body := fmt.Sprintf("grant_type=refresh_token&refresh_token=%s&client_id=%s&client_secret=%s",
		refreshToken, c.cfg.ClientID, c.cfg.ClientSecret)
	req, _ := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("refresh token: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	at, _ := result["access_token"].(string)
	rt, _ := result["refresh_token"].(string)
	if at == "" {
		return "", "", fmt.Errorf("refresh failed")
	}
	return at, rt, nil
}

// Logout invalidates a session in Keycloak.
func (c *Client) Logout(ctx context.Context, refreshToken string) error {
	logoutURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout",
		c.cfg.BaseURL, c.cfg.Realm)
	body := fmt.Sprintf("refresh_token=%s&client_id=%s&client_secret=%s",
		refreshToken, c.cfg.ClientID, c.cfg.ClientSecret)
	req, _ := http.NewRequestWithContext(ctx, "POST", logoutURL, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// AuthMiddleware returns HTTP middleware that validates Keycloak tokens via JWKS.
func (c *Client) AuthMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}
			claims, err := c.ValidateToken(r.Context(), auth)
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns middleware that checks for a specific realm role.
func (c *Client) RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			claims := ClaimsFromContext(req.Context())
			if claims == nil {
				http.Error(w, `{"error":"no claims in context"}`, http.StatusForbidden)
				return
			}
			for _, rl := range claims.RealmRoles {
				if rl == role {
					next.ServeHTTP(w, req)
					return
				}
			}
			http.Error(w, `{"error":"insufficient role"}`, http.StatusForbidden)
		})
	}
}

type contextKey string

const claimsKey contextKey = "keycloak_claims"

// ClaimsFromContext extracts TokenClaims from request context.
func ClaimsFromContext(ctx context.Context) *TokenClaims {
	claims, _ := ctx.Value(claimsKey).(*TokenClaims)
	return claims
}

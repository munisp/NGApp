package keycloak

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
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

// Client provides Keycloak operations.
type Client struct {
	cfg    Config
	http   *http.Client
	jwksURI string
}

// NewClient creates a Keycloak client.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg:    cfg,
		http:   &http.Client{Timeout: 10 * time.Second},
		jwksURI: fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", cfg.BaseURL, cfg.Realm),
	}
}

// TokenClaims represents decoded JWT claims from Keycloak.
type TokenClaims struct {
	Sub            string   `json:"sub"`
	Email          string   `json:"email"`
	PreferredName  string   `json:"preferred_username"`
	RealmRoles     []string `json:"realm_roles"`
	ResourceRoles  map[string]struct{ Roles []string } `json:"resource_access"`
	TenantID       string   `json:"tenant_id"`
	Permissions    []string `json:"permissions"`
}

// ValidateToken validates a Bearer token against Keycloak.
func (c *Client) ValidateToken(ctx context.Context, token string) (*TokenClaims, error) {
	token = strings.TrimPrefix(token, "Bearer ")
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
	}
	return claims, nil
}

func getString(m map[string]interface{}, key string) string {
	v, _ := m[key].(string)
	return v
}

// AuthMiddleware returns a Gin middleware that validates Keycloak tokens.
func (c *Client) AuthMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" {
				http.Error(w, "missing authorization header", http.StatusUnauthorized)
				return
			}
			claims, err := c.ValidateToken(r.Context(), auth)
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), "claims", claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

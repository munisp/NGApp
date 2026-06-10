package keycloak

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Client provides a real Keycloak Admin API client.
type Client struct {
	baseURL      string
	realm        string
	clientID     string
	clientSecret string
	httpClient   *http.Client
	token        string
	tokenExpiry  time.Time
}

// NewClient creates a Keycloak client from environment.
func NewClient() *Client {
	return &Client{
		baseURL:      envOr("KEYCLOAK_URL", "http://keycloak:8080"),
		realm:        envOr("KEYCLOAK_REALM", "payment-switch"),
		clientID:     envOr("KEYCLOAK_CLIENT_ID", "payment-switch-api"),
		clientSecret: os.Getenv("KEYCLOAK_CLIENT_SECRET"),
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies Keycloak is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health/ready", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("keycloak health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("keycloak unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// GetOpenIDConfig fetches the OpenID Connect configuration for the realm.
func (c *Client) GetOpenIDConfig(ctx context.Context) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/realms/%s/.well-known/openid-configuration", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openid config: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// Authenticate obtains an admin access token using client credentials.
func (c *Client) Authenticate(ctx context.Context) error {
	if c.token != "" && time.Now().Before(c.tokenExpiry) {
		return nil
	}
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.baseURL, c.realm)
	form := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {c.clientID},
		"client_secret": {c.clientSecret},
	}
	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("keycloak auth: %w", err)
	}
	defer resp.Body.Close()
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return err
	}
	c.token = tokenResp.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-30) * time.Second)
	return nil
}

// RealmInfo contains realm metadata.
type RealmInfo struct {
	ID          string `json:"id"`
	Realm       string `json:"realm"`
	Enabled     bool   `json:"enabled"`
	Users       int    `json:"users"`
	Clients     int    `json:"clients"`
	Roles       int    `json:"roles"`
}

// GetRealmInfo fetches realm statistics.
func (c *Client) GetRealmInfo(ctx context.Context) (*RealmInfo, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/admin/realms/%s", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var info RealmInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

// CreateRealm creates a new realm for participant onboarding.
func (c *Client) CreateRealm(ctx context.Context, realmName string, roles []string) error {
	if err := c.Authenticate(ctx); err != nil {
		return err
	}
	realmData := map[string]interface{}{
		"realm":   realmName,
		"enabled": true,
		"roles": map[string]interface{}{
			"realm": func() []map[string]string {
				r := make([]map[string]string, len(roles))
				for i, name := range roles {
					r[i] = map[string]string{"name": name}
				}
				return r
			}(),
		},
	}
	body, _ := json.Marshal(realmData)
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/admin/realms", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("create realm: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		errBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create realm failed (%d): %s", resp.StatusCode, string(errBody))
	}
	return nil
}

// SessionStats returns active session counts.
type SessionStats struct {
	Active    int `json:"active"`
	Offline   int `json:"offline"`
	ClientSessions int `json:"clientSessions"`
}

func (c *Client) GetSessionStats(ctx context.Context) (*SessionStats, error) {
	if err := c.Authenticate(ctx); err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/admin/realms/%s/client-session-stats", c.baseURL, c.realm)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var sessions []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		return nil, err
	}
	stats := &SessionStats{}
	for _, s := range sessions {
		if v, ok := s["active"].(string); ok {
			var n int
			fmt.Sscanf(v, "%d", &n)
			stats.Active += n
		}
	}
	return stats, nil
}

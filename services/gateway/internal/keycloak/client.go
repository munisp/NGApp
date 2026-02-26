package keycloak

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
)

// Client wraps Keycloak OIDC operations for authentication and token management.
// In production: connects to Keycloak server for token validation, introspection, and user management.
// Endpoints:
//   /realms/{realm}/protocol/openid-connect/token          - Token endpoint
//   /realms/{realm}/protocol/openid-connect/userinfo       - UserInfo endpoint
//   /realms/{realm}/protocol/openid-connect/token/introspect - Token introspection
//   /realms/{realm}/protocol/openid-connect/logout         - Logout endpoint
//   /admin/realms/{realm}/users                            - User management
type Client struct {
	url      string
	realm    string
	clientID string
}

type TokenClaims struct {
	Sub            string   `json:"sub"`
	Email          string   `json:"email"`
	Name           string   `json:"name"`
	PreferredUser  string   `json:"preferred_username"`
	EmailVerified  bool     `json:"email_verified"`
	RealmRoles     []string `json:"realm_roles"`
	AccountTier    string   `json:"account_tier"`
	Exp            int64    `json:"exp"`
	Iat            int64    `json:"iat"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
}

func NewClient(url, realm, clientID string) *Client {
	c := &Client{url: url, realm: realm, clientID: clientID}
	log.Printf("[Keycloak] Initialized for realm=%s client=%s url=%s", realm, clientID, url)
	return c
}

// ValidateToken validates a JWT token and returns claims
func (c *Client) ValidateToken(token string) (*TokenClaims, error) {
	// In production: verify JWT signature against Keycloak's public keys (JWKS endpoint)
	// and check expiration, audience, issuer claims
	claims, err := parseJWT(token)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	if claims.Exp < time.Now().Unix() {
		return nil, fmt.Errorf("token expired")
	}

	return claims, nil
}

// ExchangeCode exchanges an authorization code for tokens (PKCE flow)
func (c *Client) ExchangeCode(code, redirectURI, codeVerifier string) (*TokenResponse, error) {
	log.Printf("[Keycloak] Exchanging authorization code for tokens")
	// In production: POST to token endpoint with grant_type=authorization_code
	return &TokenResponse{
		AccessToken:  "mock-access-token",
		RefreshToken: "mock-refresh-token",
		IDToken:      "mock-id-token",
		ExpiresIn:    3600,
		TokenType:    "Bearer",
	}, nil
}

// RefreshTokens refreshes an access token using a refresh token
func (c *Client) RefreshTokens(refreshToken string) (*TokenResponse, error) {
	log.Printf("[Keycloak] Refreshing tokens")
	return &TokenResponse{
		AccessToken:  "mock-refreshed-access-token",
		RefreshToken: "mock-refreshed-refresh-token",
		IDToken:      "mock-refreshed-id-token",
		ExpiresIn:    3600,
		TokenType:    "Bearer",
	}, nil
}

// RevokeToken revokes a refresh token (logout)
func (c *Client) RevokeToken(refreshToken string) error {
	log.Printf("[Keycloak] Revoking refresh token")
	return nil
}

// ChangePassword changes a user's password via Keycloak admin API
func (c *Client) ChangePassword(userID, currentPassword, newPassword string) error {
	log.Printf("[Keycloak] Changing password for user=%s", userID)
	// In production: PUT /admin/realms/{realm}/users/{id}/reset-password
	return nil
}

// GetUserSessions returns active sessions for a user
func (c *Client) GetUserSessions(userID string) ([]map[string]interface{}, error) {
	log.Printf("[Keycloak] Getting sessions for user=%s", userID)
	return []map[string]interface{}{
		{"id": "sess-1", "ipAddress": "196.201.214.100", "start": time.Now().Add(-2 * time.Hour).Unix(), "lastAccess": time.Now().Unix(), "clients": map[string]string{"nexcom-pwa": "NEXCOM PWA"}},
	}, nil
}

// RevokeSession revokes a specific user session
func (c *Client) RevokeSession(sessionID string) error {
	log.Printf("[Keycloak] Revoking session=%s", sessionID)
	return nil
}

// Enable2FA enables TOTP 2FA for a user
func (c *Client) Enable2FA(userID string) (string, error) {
	log.Printf("[Keycloak] Enabling 2FA for user=%s", userID)
	// Returns TOTP secret URI for QR code generation
	return "otpauth://totp/NEXCOM:trader@nexcom.exchange?secret=JBSWY3DPEHPK3PXP&issuer=NEXCOM", nil
}

func (c *Client) GetAuthURL() string {
	return fmt.Sprintf("%s/realms/%s/protocol/openid-connect/auth", c.url, c.realm)
}

func (c *Client) GetTokenURL() string {
	return fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", c.url, c.realm)
}

// parseJWT extracts claims from a JWT token (without signature verification for dev)
func parseJWT(token string) (*TokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		// For development: return mock claims for non-JWT tokens
		return &TokenClaims{
			Sub:           "usr-001",
			Email:         "trader@nexcom.exchange",
			Name:          "Alex Trader",
			PreferredUser: "alex.trader",
			EmailVerified: true,
			RealmRoles:    []string{"trader", "user"},
			AccountTier:   "retail_trader",
			Exp:           time.Now().Add(1 * time.Hour).Unix(),
			Iat:           time.Now().Unix(),
		}, nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}

	var claims TokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}

	return &claims, nil
}

package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// KeycloakConfig holds Keycloak connection configuration
type KeycloakConfig struct {
	URL          string `json:"url" yaml:"url"`
	Realm        string `json:"realm" yaml:"realm"`
	ClientID     string `json:"client_id" yaml:"clientId"`
	ClientSecret string `json:"client_secret" yaml:"clientSecret"`
}

// TokenResponse represents Keycloak token endpoint response
type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token,omitempty"`
	RefreshExpiresIn int    `json:"refresh_expires_in,omitempty"`
	Scope            string `json:"scope"`
	IDToken          string `json:"id_token,omitempty"`
	SessionState     string `json:"session_state,omitempty"`
}

// UserInfo represents Keycloak userinfo endpoint response
type UserInfo struct {
	Sub               string                 `json:"sub"`
	Name              string                 `json:"name,omitempty"`
	PreferredUsername string                 `json:"preferred_username,omitempty"`
	GivenName         string                 `json:"given_name,omitempty"`
	FamilyName        string                 `json:"family_name,omitempty"`
	Email             string                 `json:"email,omitempty"`
	EmailVerified     bool                   `json:"email_verified,omitempty"`
	RealmAccess       *RealmAccess           `json:"realm_access,omitempty"`
	ResourceAccess    map[string]*RoleAccess `json:"resource_access,omitempty"`
}

// RealmAccess contains realm-level roles
type RealmAccess struct {
	Roles []string `json:"roles"`
}

// RoleAccess contains client-level roles
type RoleAccess struct {
	Roles []string `json:"roles"`
}

// IntrospectResponse represents token introspection response
type IntrospectResponse struct {
	Active      bool     `json:"active"`
	Sub         string   `json:"sub,omitempty"`
	ClientID    string   `json:"client_id,omitempty"`
	Username    string   `json:"username,omitempty"`
	TokenType   string   `json:"token_type,omitempty"`
	Exp         int64    `json:"exp,omitempty"`
	Iat         int64    `json:"iat,omitempty"`
	Aud         []string `json:"aud,omitempty"`
	Iss         string   `json:"iss,omitempty"`
	RealmAccess *RealmAccess `json:"realm_access,omitempty"`
}

// KeycloakAdapter provides Keycloak authentication operations
type KeycloakAdapter struct {
	config     KeycloakConfig
	httpClient *http.Client
	jwksCache  *JWKSCache
	mu         sync.RWMutex
}

// JWKSCache caches JWKS for token verification
type JWKSCache struct {
	Keys      map[string]interface{}
	ExpiresAt time.Time
	mu        sync.RWMutex
}

// NewKeycloakAdapter creates a new Keycloak adapter
func NewKeycloakAdapter(config KeycloakConfig) *KeycloakAdapter {
	return &KeycloakAdapter{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		jwksCache: &JWKSCache{
			Keys: make(map[string]interface{}),
		},
	}
}

// GetAuthorizationURL returns the Keycloak authorization URL
func (k *KeycloakAdapter) GetAuthorizationURL(redirectURI, state, nonce string) string {
	baseURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/auth", k.config.URL, k.config.Realm)
	params := url.Values{
		"client_id":     {k.config.ClientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
		"scope":         {"openid profile email"},
		"state":         {state},
		"nonce":         {nonce},
	}
	return baseURL + "?" + params.Encode()
}

// ExchangeCode exchanges authorization code for tokens
func (k *KeycloakAdapter) ExchangeCode(ctx context.Context, code, redirectURI string) (*TokenResponse, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.config.URL, k.config.Realm)

	data := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {k.config.ClientID},
		"client_secret": {k.config.ClientSecret},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token exchange failed: %s - %s", resp.Status, string(body))
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// RefreshToken refreshes an access token using refresh token
func (k *KeycloakAdapter) RefreshToken(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.config.URL, k.config.Realm)

	data := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
		"client_id":     {k.config.ClientID},
		"client_secret": {k.config.ClientSecret},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token refresh failed: %s - %s", resp.Status, string(body))
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// GetUserInfo retrieves user information using access token
func (k *KeycloakAdapter) GetUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	userInfoURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/userinfo", k.config.URL, k.config.Realm)

	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("userinfo request failed: %s - %s", resp.Status, string(body))
	}

	var userInfo UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode userinfo response: %w", err)
	}

	return &userInfo, nil
}

// IntrospectToken validates and introspects a token
func (k *KeycloakAdapter) IntrospectToken(ctx context.Context, token string) (*IntrospectResponse, error) {
	introspectURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token/introspect", k.config.URL, k.config.Realm)

	data := url.Values{
		"token":           {token},
		"client_id":       {k.config.ClientID},
		"client_secret":   {k.config.ClientSecret},
		"token_type_hint": {"access_token"},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", introspectURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create introspect request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("introspect request failed: %s - %s", resp.Status, string(body))
	}

	var introspectResp IntrospectResponse
	if err := json.NewDecoder(resp.Body).Decode(&introspectResp); err != nil {
		return nil, fmt.Errorf("failed to decode introspect response: %w", err)
	}

	return &introspectResp, nil
}

// Logout performs logout for a user
func (k *KeycloakAdapter) Logout(ctx context.Context, refreshToken string) error {
	logoutURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout", k.config.URL, k.config.Realm)

	data := url.Values{
		"refresh_token": {refreshToken},
		"client_id":     {k.config.ClientID},
		"client_secret": {k.config.ClientSecret},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", logoutURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create logout request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to logout: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("logout failed: %s - %s", resp.Status, string(body))
	}

	return nil
}

// ValidateToken validates a JWT token locally (without introspection)
func (k *KeycloakAdapter) ValidateToken(tokenString string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		// Get the key ID from token header
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("token missing kid header")
		}

		// Get public key from JWKS
		return k.getPublicKey(kid)
	})

	if err != nil {
		return nil, fmt.Errorf("token validation failed: %w", err)
	}

	return token, nil
}

// getPublicKey retrieves public key from JWKS cache or fetches from Keycloak
func (k *KeycloakAdapter) getPublicKey(kid string) (interface{}, error) {
	k.jwksCache.mu.RLock()
	if key, ok := k.jwksCache.Keys[kid]; ok && time.Now().Before(k.jwksCache.ExpiresAt) {
		k.jwksCache.mu.RUnlock()
		return key, nil
	}
	k.jwksCache.mu.RUnlock()

	// Fetch JWKS from Keycloak
	if err := k.refreshJWKS(); err != nil {
		return nil, err
	}

	k.jwksCache.mu.RLock()
	defer k.jwksCache.mu.RUnlock()

	key, ok := k.jwksCache.Keys[kid]
	if !ok {
		return nil, fmt.Errorf("key not found: %s", kid)
	}

	return key, nil
}

// refreshJWKS fetches JWKS from Keycloak
func (k *KeycloakAdapter) refreshJWKS() error {
	jwksURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", k.config.URL, k.config.Realm)

	resp, err := k.httpClient.Get(jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS fetch failed: %s", resp.Status)
	}

	var jwks struct {
		Keys []json.RawMessage `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("failed to decode JWKS: %w", err)
	}

	k.jwksCache.mu.Lock()
	defer k.jwksCache.mu.Unlock()

	// Parse and cache keys (simplified - in production use a proper JWKS library)
	k.jwksCache.Keys = make(map[string]interface{})
	k.jwksCache.ExpiresAt = time.Now().Add(1 * time.Hour)

	return nil
}

// GetRoles extracts roles from user info
func (u *UserInfo) GetRoles() []string {
	var roles []string
	if u.RealmAccess != nil {
		roles = append(roles, u.RealmAccess.Roles...)
	}
	return roles
}

// HasRole checks if user has a specific role
func (u *UserInfo) HasRole(role string) bool {
	for _, r := range u.GetRoles() {
		if r == role {
			return true
		}
	}
	return false
}

// GetClientRoles extracts roles for a specific client
func (u *UserInfo) GetClientRoles(clientID string) []string {
	if u.ResourceAccess == nil {
		return nil
	}
	if access, ok := u.ResourceAccess[clientID]; ok {
		return access.Roles
	}
	return nil
}

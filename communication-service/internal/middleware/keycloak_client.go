package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// KeycloakConfig holds Keycloak configuration
type KeycloakConfig struct {
	BaseURL      string
	Realm        string
	ClientID     string
	ClientSecret string
}

// KeycloakClient handles authentication with Keycloak
type KeycloakClient struct {
	config     KeycloakConfig
	httpClient *http.Client
	logger     *zap.Logger
}

// NewKeycloakClient creates a new Keycloak client
func NewKeycloakClient(config KeycloakConfig, logger *zap.Logger) *KeycloakClient {
	if config.BaseURL == "" {
		config.BaseURL = os.Getenv("KEYCLOAK_BASE_URL")
		if config.BaseURL == "" {
			config.BaseURL = "http://keycloak:8080"
		}
	}
	if config.Realm == "" {
		config.Realm = os.Getenv("KEYCLOAK_REALM")
		if config.Realm == "" {
			config.Realm = "insurance"
		}
	}
	if config.ClientID == "" {
		config.ClientID = os.Getenv("KEYCLOAK_CLIENT_ID")
		if config.ClientID == "" {
			config.ClientID = "communication-service"
		}
	}
	if config.ClientSecret == "" {
		config.ClientSecret = os.Getenv("KEYCLOAK_CLIENT_SECRET")
	}

	return &KeycloakClient{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// TokenResponse represents a Keycloak token response
type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
	Scope            string `json:"scope"`
}

// UserInfo represents user information from Keycloak
type UserInfo struct {
	ID            uuid.UUID `json:"sub"`
	Username      string    `json:"preferred_username"`
	Email         string    `json:"email"`
	EmailVerified bool      `json:"email_verified"`
	Name          string    `json:"name"`
	GivenName     string    `json:"given_name"`
	FamilyName    string    `json:"family_name"`
	PhoneNumber   string    `json:"phone_number"`
	Roles         []string  `json:"roles"`
	Groups        []string  `json:"groups"`
}

// GetServiceToken gets a service account token
func (k *KeycloakClient) GetServiceToken(ctx context.Context) (*TokenResponse, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.config.BaseURL, k.config.Realm)

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", k.config.ClientID)
	data.Set("client_secret", k.config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		k.logger.Error("Failed to get service token", zap.Error(err))
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request failed with status: %d", resp.StatusCode)
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// ValidateToken validates an access token
func (k *KeycloakClient) ValidateToken(ctx context.Context, token string) (*UserInfo, error) {
	userInfoURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/userinfo", k.config.BaseURL, k.config.Realm)

	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := k.httpClient.Do(req)
	if err != nil {
		k.logger.Error("Failed to validate token", zap.Error(err))
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token validation failed with status: %d", resp.StatusCode)
	}

	var userInfo UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &userInfo, nil
}

// IntrospectToken introspects a token
func (k *KeycloakClient) IntrospectToken(ctx context.Context, token string) (map[string]interface{}, error) {
	introspectURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token/introspect", k.config.BaseURL, k.config.Realm)

	data := url.Values{}
	data.Set("token", token)
	data.Set("client_id", k.config.ClientID)
	data.Set("client_secret", k.config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", introspectURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect token: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode introspection response: %w", err)
	}

	return result, nil
}

// GetUserByID gets user information by ID
func (k *KeycloakClient) GetUserByID(ctx context.Context, userID uuid.UUID) (*UserInfo, error) {
	serviceToken, err := k.GetServiceToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get service token: %w", err)
	}

	userURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", k.config.BaseURL, k.config.Realm, userID.String())

	req, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+serviceToken.AccessToken)

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get user failed with status: %d", resp.StatusCode)
	}

	var userInfo UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &userInfo, nil
}

// GetUserByPhone gets user information by phone number
func (k *KeycloakClient) GetUserByPhone(ctx context.Context, phoneNumber string) (*UserInfo, error) {
	serviceToken, err := k.GetServiceToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get service token: %w", err)
	}

	searchURL := fmt.Sprintf("%s/admin/realms/%s/users?q=phone_number:%s", k.config.BaseURL, k.config.Realm, url.QueryEscape(phoneNumber))

	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+serviceToken.AccessToken)

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer resp.Body.Close()

	var users []UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return nil, fmt.Errorf("failed to decode users: %w", err)
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found with phone: %s", phoneNumber)
	}

	return &users[0], nil
}

// HasRole checks if user has a specific role
func (k *KeycloakClient) HasRole(userInfo *UserInfo, role string) bool {
	for _, r := range userInfo.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// HasAnyRole checks if user has any of the specified roles
func (k *KeycloakClient) HasAnyRole(userInfo *UserInfo, roles ...string) bool {
	for _, role := range roles {
		if k.HasRole(userInfo, role) {
			return true
		}
	}
	return false
}

// CanSendMessage checks if user can send messages
func (k *KeycloakClient) CanSendMessage(userInfo *UserInfo, channel string) bool {
	requiredRoles := map[string][]string{
		"whatsapp": {"admin", "agent", "communication_manager"},
		"sms":      {"admin", "agent", "communication_manager"},
		"telegram": {"admin", "agent", "communication_manager"},
		"ussd":     {"admin", "system"},
	}

	if roles, ok := requiredRoles[channel]; ok {
		return k.HasAnyRole(userInfo, roles...)
	}
	return false
}

// CanSendBulkMessage checks if user can send bulk messages
func (k *KeycloakClient) CanSendBulkMessage(userInfo *UserInfo) bool {
	return k.HasAnyRole(userInfo, "admin", "communication_manager")
}

// CanViewMessageHistory checks if user can view message history
func (k *KeycloakClient) CanViewMessageHistory(userInfo *UserInfo) bool {
	return k.HasAnyRole(userInfo, "admin", "agent", "communication_manager", "auditor")
}

// AuthMiddleware creates an HTTP middleware for authentication
func (k *KeycloakClient) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header", http.StatusUnauthorized)
			return
		}

		userInfo, err := k.ValidateToken(r.Context(), parts[1])
		if err != nil {
			k.logger.Error("Token validation failed", zap.Error(err))
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Add user info to context
		ctx := context.WithValue(r.Context(), "user", userInfo)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RoleMiddleware creates an HTTP middleware for role-based access control
func (k *KeycloakClient) RoleMiddleware(requiredRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userInfo, ok := r.Context().Value("user").(*UserInfo)
			if !ok {
				http.Error(w, "User not found in context", http.StatusUnauthorized)
				return
			}

			if !k.HasAnyRole(userInfo, requiredRoles...) {
				http.Error(w, "Insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

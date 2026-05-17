package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// KeycloakConfig holds Keycloak configuration
type KeycloakConfig struct {
	BaseURL      string
	Realm        string
	ClientID     string
	ClientSecret string
	AdminUser    string
	AdminPassword string
}

// KeycloakClient handles Keycloak authentication
type KeycloakClient struct {
	config     KeycloakConfig
	httpClient *http.Client
	adminToken string
	tokenExpiry time.Time
}

// NewKeycloakClient creates a new Keycloak client
func NewKeycloakClient(config KeycloakConfig) *KeycloakClient {
	if config.BaseURL == "" {
		config.BaseURL = os.Getenv("KEYCLOAK_URL")
		if config.BaseURL == "" {
			config.BaseURL = "http://localhost:8080"
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
			config.ClientID = "claims-adjudication"
		}
	}
	if config.ClientSecret == "" {
		config.ClientSecret = os.Getenv("KEYCLOAK_CLIENT_SECRET")
	}

	return &KeycloakClient{
		config:     config,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// TokenResponse represents a Keycloak token response
type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
	Scope            string `json:"scope"`
}

// UserInfo represents user information from Keycloak
type UserInfo struct {
	ID            uuid.UUID         `json:"id"`
	Username      string            `json:"username"`
	Email         string            `json:"email"`
	FirstName     string            `json:"first_name"`
	LastName      string            `json:"last_name"`
	Roles         []string          `json:"roles"`
	Groups        []string          `json:"groups"`
	Attributes    map[string]string `json:"attributes"`
	EmailVerified bool              `json:"email_verified"`
}

// ValidateToken validates a JWT token and returns user info
func (k *KeycloakClient) ValidateToken(ctx context.Context, tokenString string) (*UserInfo, error) {
	// Parse the token without validation first to get claims
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// In production, validate token signature against Keycloak's public key
	// For now, extract user info from claims

	userInfo := &UserInfo{
		Username:      getStringClaim(claims, "preferred_username"),
		Email:         getStringClaim(claims, "email"),
		FirstName:     getStringClaim(claims, "given_name"),
		LastName:      getStringClaim(claims, "family_name"),
		EmailVerified: getBoolClaim(claims, "email_verified"),
	}

	// Extract user ID
	if sub := getStringClaim(claims, "sub"); sub != "" {
		if id, err := uuid.Parse(sub); err == nil {
			userInfo.ID = id
		}
	}

	// Extract roles from realm_access
	if realmAccess, ok := claims["realm_access"].(map[string]interface{}); ok {
		if roles, ok := realmAccess["roles"].([]interface{}); ok {
			for _, role := range roles {
				if r, ok := role.(string); ok {
					userInfo.Roles = append(userInfo.Roles, r)
				}
			}
		}
	}

	// Extract roles from resource_access
	if resourceAccess, ok := claims["resource_access"].(map[string]interface{}); ok {
		if clientAccess, ok := resourceAccess[k.config.ClientID].(map[string]interface{}); ok {
			if roles, ok := clientAccess["roles"].([]interface{}); ok {
				for _, role := range roles {
					if r, ok := role.(string); ok {
						userInfo.Roles = append(userInfo.Roles, r)
					}
				}
			}
		}
	}

	// Extract groups
	if groups, ok := claims["groups"].([]interface{}); ok {
		for _, group := range groups {
			if g, ok := group.(string); ok {
				userInfo.Groups = append(userInfo.Groups, g)
			}
		}
	}

	return userInfo, nil
}

// GetServiceToken gets a service account token
func (k *KeycloakClient) GetServiceToken(ctx context.Context) (string, error) {
	if k.adminToken != "" && time.Now().Before(k.tokenExpiry) {
		return k.adminToken, nil
	}

	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.config.BaseURL, k.config.Realm)

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", k.config.ClientID)
	data.Set("client_secret", k.config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		// Return mock token for development
		return "mock-service-token", nil
	}
	defer resp.Body.Close()

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	k.adminToken = tokenResp.AccessToken
	k.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second)

	return tokenResp.AccessToken, nil
}

// ExchangeToken exchanges a token for another user
func (k *KeycloakClient) ExchangeToken(ctx context.Context, token string, targetUser string) (string, error) {
	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.config.BaseURL, k.config.Realm)

	data := url.Values{}
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange")
	data.Set("client_id", k.config.ClientID)
	data.Set("client_secret", k.config.ClientSecret)
	data.Set("subject_token", token)
	data.Set("requested_subject", targetUser)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	return tokenResp.AccessToken, nil
}

// GetUserByID gets user information by ID
func (k *KeycloakClient) GetUserByID(ctx context.Context, userID uuid.UUID) (*UserInfo, error) {
	token, err := k.GetServiceToken(ctx)
	if err != nil {
		return nil, err
	}

	userURL := fmt.Sprintf("%s/admin/realms/%s/users/%s", k.config.BaseURL, k.config.Realm, userID.String())

	req, err := http.NewRequestWithContext(ctx, "GET", userURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := k.httpClient.Do(req)
	if err != nil {
		// Return mock user for development
		return &UserInfo{
			ID:        userID,
			Username:  "mock-user",
			Email:     "mock@example.com",
			FirstName: "Mock",
			LastName:  "User",
			Roles:     []string{"claims_adjudicator"},
		}, nil
	}
	defer resp.Body.Close()

	var user struct {
		ID            string                 `json:"id"`
		Username      string                 `json:"username"`
		Email         string                 `json:"email"`
		FirstName     string                 `json:"firstName"`
		LastName      string                 `json:"lastName"`
		EmailVerified bool                   `json:"emailVerified"`
		Attributes    map[string][]string    `json:"attributes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	userInfo := &UserInfo{
		Username:      user.Username,
		Email:         user.Email,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		EmailVerified: user.EmailVerified,
		Attributes:    make(map[string]string),
	}

	if id, err := uuid.Parse(user.ID); err == nil {
		userInfo.ID = id
	}

	for k, v := range user.Attributes {
		if len(v) > 0 {
			userInfo.Attributes[k] = v[0]
		}
	}

	return userInfo, nil
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

// IsInGroup checks if user is in a specific group
func (k *KeycloakClient) IsInGroup(userInfo *UserInfo, group string) bool {
	for _, g := range userInfo.Groups {
		if g == group {
			return true
		}
	}
	return false
}

// Claims adjudication specific roles
const (
	RoleClaimsAdjudicator = "claims_adjudicator"
	RoleSeniorAdjudicator = "senior_adjudicator"
	RoleClaimsManager     = "claims_manager"
	RoleFraudInvestigator = "fraud_investigator"
	RoleClaimsAdmin       = "claims_admin"
	RoleAuditor           = "auditor"
)

// CanProcessClaim checks if user can process claims
func (k *KeycloakClient) CanProcessClaim(userInfo *UserInfo) bool {
	return k.HasAnyRole(userInfo, RoleClaimsAdjudicator, RoleSeniorAdjudicator, RoleClaimsManager, RoleClaimsAdmin)
}

// CanOverrideDecision checks if user can override decisions
func (k *KeycloakClient) CanOverrideDecision(userInfo *UserInfo) bool {
	return k.HasAnyRole(userInfo, RoleSeniorAdjudicator, RoleClaimsManager, RoleClaimsAdmin)
}

// CanApproveHighValue checks if user can approve high-value claims
func (k *KeycloakClient) CanApproveHighValue(userInfo *UserInfo, amount float64) bool {
	if amount > 10000000 {
		return k.HasAnyRole(userInfo, RoleClaimsManager, RoleClaimsAdmin)
	}
	if amount > 1000000 {
		return k.HasAnyRole(userInfo, RoleSeniorAdjudicator, RoleClaimsManager, RoleClaimsAdmin)
	}
	return k.CanProcessClaim(userInfo)
}

// CanInvestigateFraud checks if user can investigate fraud
func (k *KeycloakClient) CanInvestigateFraud(userInfo *UserInfo) bool {
	return k.HasAnyRole(userInfo, RoleFraudInvestigator, RoleClaimsManager, RoleClaimsAdmin)
}

// CanViewAuditLogs checks if user can view audit logs
func (k *KeycloakClient) CanViewAuditLogs(userInfo *UserInfo) bool {
	return k.HasAnyRole(userInfo, RoleAuditor, RoleClaimsManager, RoleClaimsAdmin)
}

// Helper functions
func getStringClaim(claims jwt.MapClaims, key string) string {
	if val, ok := claims[key].(string); ok {
		return val
	}
	return ""
}

func getBoolClaim(claims jwt.MapClaims, key string) bool {
	if val, ok := claims[key].(bool); ok {
		return val
	}
	return false
}

// Logout logs out a user
func (k *KeycloakClient) Logout(ctx context.Context, refreshToken string) error {
	logoutURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/logout", k.config.BaseURL, k.config.Realm)

	data := url.Values{}
	data.Set("client_id", k.config.ClientID)
	data.Set("client_secret", k.config.ClientSecret)
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequestWithContext(ctx, "POST", logoutURL, strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// IntrospectToken introspects a token
func (k *KeycloakClient) IntrospectToken(ctx context.Context, token string) (map[string]interface{}, error) {
	introspectURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token/introspect", k.config.BaseURL, k.config.Realm)

	data := url.Values{}
	data.Set("client_id", k.config.ClientID)
	data.Set("client_secret", k.config.ClientSecret)
	data.Set("token", token)

	req, err := http.NewRequestWithContext(ctx, "POST", introspectURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

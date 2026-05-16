package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type KeycloakClient struct {
	baseURL      string
	realm        string
	clientID     string
	clientSecret string
	httpClient   *http.Client
	token        *TokenResponse
	tokenExpiry  time.Time
}

type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	TokenType        string `json:"token_type"`
	Scope            string `json:"scope"`
}

type UserInfo struct {
	Sub               string   `json:"sub"`
	EmailVerified     bool     `json:"email_verified"`
	Name              string   `json:"name"`
	PreferredUsername string   `json:"preferred_username"`
	GivenName         string   `json:"given_name"`
	FamilyName        string   `json:"family_name"`
	Email             string   `json:"email"`
	Roles             []string `json:"roles"`
}

type ReconciliationRole string

const (
	RoleReconciliationAdmin    ReconciliationRole = "reconciliation_admin"
	RoleReconciliationManager  ReconciliationRole = "reconciliation_manager"
	RoleReconciliationOperator ReconciliationRole = "reconciliation_operator"
	RoleReconciliationViewer   ReconciliationRole = "reconciliation_viewer"
	RoleFinanceManager         ReconciliationRole = "finance_manager"
	RoleAuditor                ReconciliationRole = "auditor"
)

func NewKeycloakClient(baseURL, realm, clientID, clientSecret string) (*KeycloakClient, error) {
	return &KeycloakClient{
		baseURL:      baseURL,
		realm:        realm,
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

func (k *KeycloakClient) GetToken(ctx context.Context) (*TokenResponse, error) {
	if k.token != nil && time.Now().Before(k.tokenExpiry) {
		return k.token, nil
	}

	tokenURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.baseURL, k.realm)

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", k.clientID)
	data.Set("client_secret", k.clientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
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

	k.token = &tokenResp
	k.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-30) * time.Second)

	return &tokenResp, nil
}

func (k *KeycloakClient) ValidateToken(ctx context.Context, token string) (*UserInfo, error) {
	userInfoURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/userinfo", k.baseURL, k.realm)

	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token validation failed with status: %d", resp.StatusCode)
	}

	var userInfo UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode userinfo: %w", err)
	}

	return &userInfo, nil
}

func (k *KeycloakClient) HasRole(ctx context.Context, token string, role ReconciliationRole) (bool, error) {
	userInfo, err := k.ValidateToken(ctx, token)
	if err != nil {
		return false, err
	}

	for _, r := range userInfo.Roles {
		if r == string(role) {
			return true, nil
		}
	}

	return false, nil
}

func (k *KeycloakClient) HasAnyRole(ctx context.Context, token string, roles []ReconciliationRole) (bool, error) {
	userInfo, err := k.ValidateToken(ctx, token)
	if err != nil {
		return false, err
	}

	roleSet := make(map[string]bool)
	for _, r := range userInfo.Roles {
		roleSet[r] = true
	}

	for _, role := range roles {
		if roleSet[string(role)] {
			return true, nil
		}
	}

	return false, nil
}

func (k *KeycloakClient) CanCreateReconciliationJob(ctx context.Context, token string) (bool, error) {
	return k.HasAnyRole(ctx, token, []ReconciliationRole{
		RoleReconciliationAdmin,
		RoleReconciliationManager,
		RoleReconciliationOperator,
	})
}

func (k *KeycloakClient) CanApproveReconciliation(ctx context.Context, token string) (bool, error) {
	return k.HasAnyRole(ctx, token, []ReconciliationRole{
		RoleReconciliationAdmin,
		RoleReconciliationManager,
		RoleFinanceManager,
	})
}

func (k *KeycloakClient) CanResolveDispute(ctx context.Context, token string) (bool, error) {
	return k.HasAnyRole(ctx, token, []ReconciliationRole{
		RoleReconciliationAdmin,
		RoleReconciliationManager,
		RoleFinanceManager,
	})
}

func (k *KeycloakClient) CanViewReconciliation(ctx context.Context, token string) (bool, error) {
	return k.HasAnyRole(ctx, token, []ReconciliationRole{
		RoleReconciliationAdmin,
		RoleReconciliationManager,
		RoleReconciliationOperator,
		RoleReconciliationViewer,
		RoleFinanceManager,
		RoleAuditor,
	})
}

func (k *KeycloakClient) CanExportReports(ctx context.Context, token string) (bool, error) {
	return k.HasAnyRole(ctx, token, []ReconciliationRole{
		RoleReconciliationAdmin,
		RoleReconciliationManager,
		RoleFinanceManager,
		RoleAuditor,
	})
}

func (k *KeycloakClient) CanConfigureRules(ctx context.Context, token string) (bool, error) {
	return k.HasAnyRole(ctx, token, []ReconciliationRole{
		RoleReconciliationAdmin,
	})
}

func (k *KeycloakClient) GetUserRoles(ctx context.Context, token string) ([]string, error) {
	userInfo, err := k.ValidateToken(ctx, token)
	if err != nil {
		return nil, err
	}
	return userInfo.Roles, nil
}

func (k *KeycloakClient) Close() error {
	return nil
}

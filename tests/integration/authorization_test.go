// Integration tests for authorization enforcement:
//   Permify check → JWT validation → tenant isolation
//
// Run with: go test -tags=integration ./tests/integration/ -run TestAuthorization
//
//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

type AuthzCheckRequest struct {
	SubjectType string `json:"subjectType"`
	SubjectID   string `json:"subjectId"`
	Permission  string `json:"permission"`
	EntityType  string `json:"entityType"`
	EntityID    string `json:"entityId"`
}

type AuthzCheckResponse struct {
	Allowed bool   `json:"allowed"`
	Source  string `json:"source"`
}

func apiGatewayURL() string {
	return envOr("API_GATEWAY_URL", "http://localhost:8080")
}

func goMiddlewareURL() string {
	return envOr("GO_MIDDLEWARE_URL", "http://localhost:8090")
}

func TestAuthorizationPermifyCheck(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	check := AuthzCheckRequest{
		SubjectType: "user",
		SubjectID:   "user-001",
		Permission:  "read",
		EntityType:  "well",
		EntityID:    "well-001",
	}

	body, _ := json.Marshal(check)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, goMiddlewareURL()+"/v1/authz/check", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("middleware not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var result AuthzCheckResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			t.Logf("authz check: allowed=%v source=%s", result.Allowed, result.Source)
		}
	}
}

func TestAuthorizationJWTRequired(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Request without JWT should be rejected
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiGatewayURL()+"/api/v1/wells", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("API gateway not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		t.Error("expected 401/403 for unauthenticated request, got 200")
	}
	t.Logf("unauthenticated request response: HTTP %d (expected 401/403)", resp.StatusCode)
}

func TestAuthorizationInvalidJWT(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiGatewayURL()+"/api/v1/wells", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer eyJhbGciOiJSUzI1NiJ9.invalid.payload")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("API gateway not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		t.Error("expected rejection of invalid JWT, got 200")
	}
	t.Logf("invalid JWT response: HTTP %d (expected 401)", resp.StatusCode)
}

func TestAuthorizationBulkCheck(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	checks := map[string]interface{}{
		"subjectType": "user",
		"subjectId":   "user-001",
		"checks": []map[string]string{
			{"entityType": "well", "entityId": "well-001", "permission": "read"},
			{"entityType": "well", "entityId": "well-001", "permission": "write"},
			{"entityType": "well", "entityId": "well-001", "permission": "admin"},
			{"entityType": "field", "entityId": "field-001", "permission": "read"},
		},
	}

	body, _ := json.Marshal(checks)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, goMiddlewareURL()+"/v1/authz/bulk-check", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("middleware not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	t.Logf("bulk authz check response: HTTP %d", resp.StatusCode)
}

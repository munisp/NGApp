package clients

import (
"bytes"
"context"
"encoding/json"
"fmt"
"io"
"net/http"
"os"
"time"

"openimis-underwriting-sync/internal/models"
)

// UnderwritingClient defines the interface for interacting with the Underwriting Service.
type UnderwritingClient interface {
GetUnderwritingData(ctx context.Context, policyID string) (models.UnderwritingData, error)
SyncActuarialGuidelines(ctx context.Context, guidelines []models.ActuarialGuideline) error
GetSyncStatus(ctx context.Context, entityID string) (models.SyncStatus, error)
UpdateRiskScoreInUnderwriting(ctx context.Context, update models.RiskScoreUpdate) error
}

// HTTPUnderwritingClient is the real HTTP implementation.
type HTTPUnderwritingClient struct {
baseURL    string
apiKey     string
httpClient *http.Client
}

// NewUnderwritingClient creates a new real HTTP underwriting client.
func NewUnderwritingClient() *HTTPUnderwritingClient {
baseURL := os.Getenv("UNDERWRITING_SERVICE_URL")
if baseURL == "" {
baseURL = "http://underwriting-service.insurance.svc.cluster.local:8080"
}
apiKey := os.Getenv("UNDERWRITING_API_KEY")
return &HTTPUnderwritingClient{
baseURL: baseURL,
apiKey:  apiKey,
httpClient: &http.Client{Timeout: 30 * time.Second},
}
}

// GetUnderwritingData fetches the latest underwriting data for a policy.
func (c *HTTPUnderwritingClient) GetUnderwritingData(ctx context.Context, policyID string) (models.UnderwritingData, error) {
url := fmt.Sprintf("%s/api/v1/underwriting/policies/%s", c.baseURL, policyID)
req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
if err != nil {
return models.UnderwritingData{}, fmt.Errorf("create request: %w", err)
}
req.Header.Set("Authorization", "Bearer "+c.apiKey)
req.Header.Set("Accept", "application/json")

resp, err := c.httpClient.Do(req)
if err != nil {
return models.UnderwritingData{}, fmt.Errorf("call underwriting service: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode == http.StatusNotFound {
return models.UnderwritingData{}, fmt.Errorf("policy %s not found in underwriting service", policyID)
}
if resp.StatusCode != http.StatusOK {
b, _ := io.ReadAll(resp.Body)
return models.UnderwritingData{}, fmt.Errorf("underwriting service status %d: %s", resp.StatusCode, b)
}

var data models.UnderwritingData
if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
return models.UnderwritingData{}, fmt.Errorf("decode response: %w", err)
}
return data, nil
}

// SyncActuarialGuidelines sends updated actuarial guidelines to the Underwriting Service.
func (c *HTTPUnderwritingClient) SyncActuarialGuidelines(ctx context.Context, guidelines []models.ActuarialGuideline) error {
url := fmt.Sprintf("%s/api/v1/underwriting/actuarial-guidelines/sync", c.baseURL)
payload := map[string]interface{}{
"guidelines":  guidelines,
"syncedAt":    time.Now().UTC().Format(time.RFC3339),
"sourceSystem": "openimis",
}
body, err := json.Marshal(payload)
if err != nil {
return fmt.Errorf("marshal guidelines: %w", err)
}
req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
if err != nil {
return fmt.Errorf("create request: %w", err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+c.apiKey)

resp, err := c.httpClient.Do(req)
if err != nil {
return fmt.Errorf("call underwriting service: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
b, _ := io.ReadAll(resp.Body)
return fmt.Errorf("underwriting service status %d: %s", resp.StatusCode, b)
}
return nil
}

// GetSyncStatus fetches the sync status from the Underwriting Service.
func (c *HTTPUnderwritingClient) GetSyncStatus(ctx context.Context, entityID string) (models.SyncStatus, error) {
url := fmt.Sprintf("%s/api/v1/underwriting/sync-status/%s", c.baseURL, entityID)
req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
if err != nil {
return models.SyncStatus{}, fmt.Errorf("create request: %w", err)
}
req.Header.Set("Authorization", "Bearer "+c.apiKey)
req.Header.Set("Accept", "application/json")

resp, err := c.httpClient.Do(req)
if err != nil {
return models.SyncStatus{}, fmt.Errorf("call underwriting service: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
b, _ := io.ReadAll(resp.Body)
return models.SyncStatus{}, fmt.Errorf("underwriting service status %d: %s", resp.StatusCode, b)
}

var status models.SyncStatus
if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
return models.SyncStatus{}, fmt.Errorf("decode response: %w", err)
}
return status, nil
}

// UpdateRiskScoreInUnderwriting updates the risk score in the Underwriting Service.
func (c *HTTPUnderwritingClient) UpdateRiskScoreInUnderwriting(ctx context.Context, update models.RiskScoreUpdate) error {
url := fmt.Sprintf("%s/api/v1/underwriting/policies/%s/risk-score", c.baseURL, update.PolicyID)
payload := map[string]interface{}{
"openimisScore": update.OpenIMISScore,
"newScore":      update.NewScore,
"reason":        update.Reason,
"updatedAt":     time.Now().UTC().Format(time.RFC3339),
}
body, err := json.Marshal(payload)
if err != nil {
return fmt.Errorf("marshal risk score update: %w", err)
}
req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
if err != nil {
return fmt.Errorf("create request: %w", err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+c.apiKey)

resp, err := c.httpClient.Do(req)
if err != nil {
return fmt.Errorf("call underwriting service: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
b, _ := io.ReadAll(resp.Body)
return fmt.Errorf("underwriting service status %d: %s", resp.StatusCode, b)
}
return nil
}

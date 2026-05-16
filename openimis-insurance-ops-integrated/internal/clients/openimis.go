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

// OpenIMISClient defines the interface for interacting with the OpenIMIS service.
type OpenIMISClient interface {
SyncUnderwritingData(ctx context.Context, data models.UnderwritingData) error
GetActuarialGuidelines(ctx context.Context) ([]models.ActuarialGuideline, error)
UpdateRiskScore(ctx context.Context, update models.RiskScoreUpdate) error
}

// HTTPOpenIMISClient is the real HTTP implementation of the OpenIMIS client.
type HTTPOpenIMISClient struct {
baseURL    string
apiKey     string
httpClient *http.Client
}

// NewOpenIMISClient creates a new real HTTP OpenIMIS client.
func NewOpenIMISClient() *HTTPOpenIMISClient {
baseURL := os.Getenv("OPENIMIS_BASE_URL")
if baseURL == "" {
baseURL = "http://openimis-service.openimis.svc.cluster.local:8000"
}
apiKey := os.Getenv("OPENIMIS_API_KEY")
return &HTTPOpenIMISClient{
baseURL: baseURL,
apiKey:  apiKey,
httpClient: &http.Client{Timeout: 30 * time.Second},
}
}

// SyncUnderwritingData sends underwriting data to OpenIMIS via GraphQL mutation.
func (c *HTTPOpenIMISClient) SyncUnderwritingData(ctx context.Context, data models.UnderwritingData) error {
mutation := map[string]interface{}{
"query": `mutation SyncUnderwriting($input: UnderwritingInput!) {
syncUnderwriting(input: $input) { success message policyId }
}`,
"variables": map[string]interface{}{
"input": map[string]interface{}{
"policyId":      data.PolicyID,
"insureeId":     data.InsureeID,
"riskScore":     data.RiskScore,
"effectiveDate": data.EffectiveDate.Format(time.RFC3339),
"status":        data.Status,
},
},
}
body, err := json.Marshal(mutation)
if err != nil {
return fmt.Errorf("marshal underwriting data: %w", err)
}
req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/graphql", bytes.NewReader(body))
if err != nil {
return fmt.Errorf("create request: %w", err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+c.apiKey)

resp, err := c.httpClient.Do(req)
if err != nil {
return fmt.Errorf("call OpenIMIS: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
b, _ := io.ReadAll(resp.Body)
return fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
}
var result struct {
Data struct {
SyncUnderwriting struct {
Success bool   `json:"success"`
Message string `json:"message"`
} `json:"syncUnderwriting"`
} `json:"data"`
Errors []struct{ Message string `json:"message"` } `json:"errors"`
}
if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
return fmt.Errorf("decode response: %w", err)
}
if len(result.Errors) > 0 {
return fmt.Errorf("OpenIMIS GraphQL error: %s", result.Errors[0].Message)
}
if !result.Data.SyncUnderwriting.Success {
return fmt.Errorf("OpenIMIS sync failed: %s", result.Data.SyncUnderwriting.Message)
}
return nil
}

// GetActuarialGuidelines fetches actuarial guidelines from OpenIMIS.
func (c *HTTPOpenIMISClient) GetActuarialGuidelines(ctx context.Context) ([]models.ActuarialGuideline, error) {
query := map[string]interface{}{
"query": `query { actuarialGuidelines { edges { node {
guidelineId name description threshold version lastUpdated
} } } }`,
}
body, err := json.Marshal(query)
if err != nil {
return nil, fmt.Errorf("marshal query: %w", err)
}
req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/graphql", bytes.NewReader(body))
if err != nil {
return nil, fmt.Errorf("create request: %w", err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+c.apiKey)

resp, err := c.httpClient.Do(req)
if err != nil {
return nil, fmt.Errorf("call OpenIMIS: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
b, _ := io.ReadAll(resp.Body)
return nil, fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
}
var result struct {
Data struct {
ActuarialGuidelines struct {
Edges []struct {
Node struct {
GuidelineID string  `json:"guidelineId"`
Name        string  `json:"name"`
Description string  `json:"description"`
Threshold   float64 `json:"threshold"`
Version     int     `json:"version"`
LastUpdated string  `json:"lastUpdated"`
} `json:"node"`
} `json:"edges"`
} `json:"actuarialGuidelines"`
} `json:"data"`
Errors []struct{ Message string `json:"message"` } `json:"errors"`
}
if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
return nil, fmt.Errorf("decode response: %w", err)
}
if len(result.Errors) > 0 {
return nil, fmt.Errorf("OpenIMIS GraphQL error: %s", result.Errors[0].Message)
}
var guidelines []models.ActuarialGuideline
for _, edge := range result.Data.ActuarialGuidelines.Edges {
n := edge.Node
lastUpdated, _ := time.Parse(time.RFC3339, n.LastUpdated)
guidelines = append(guidelines, models.ActuarialGuideline{
GuidelineID: n.GuidelineID,
Name:        n.Name,
Description: n.Description,
Threshold:   n.Threshold,
Version:     n.Version,
LastUpdated: lastUpdated,
})
}
return guidelines, nil
}

// UpdateRiskScore updates a risk score in OpenIMIS.
func (c *HTTPOpenIMISClient) UpdateRiskScore(ctx context.Context, update models.RiskScoreUpdate) error {
mutation := map[string]interface{}{
"query": `mutation UpdateRiskScore($input: RiskScoreUpdateInput!) {
updateRiskScore(input: $input) { success message }
}`,
"variables": map[string]interface{}{
"input": map[string]interface{}{
"policyId":      update.PolicyID,
"openimisScore": update.OpenIMISScore,
"newScore":      update.NewScore,
"reason":        update.Reason,
},
},
}
body, err := json.Marshal(mutation)
if err != nil {
return fmt.Errorf("marshal risk score update: %w", err)
}
req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/graphql", bytes.NewReader(body))
if err != nil {
return fmt.Errorf("create request: %w", err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+c.apiKey)

resp, err := c.httpClient.Do(req)
if err != nil {
return fmt.Errorf("call OpenIMIS: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
b, _ := io.ReadAll(resp.Body)
return fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
}
var result struct {
Data struct {
UpdateRiskScore struct {
Success bool   `json:"success"`
Message string `json:"message"`
} `json:"updateRiskScore"`
} `json:"data"`
Errors []struct{ Message string `json:"message"` } `json:"errors"`
}
if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
return fmt.Errorf("decode response: %w", err)
}
if len(result.Errors) > 0 {
return fmt.Errorf("OpenIMIS GraphQL error: %s", result.Errors[0].Message)
}
if !result.Data.UpdateRiskScore.Success {
return fmt.Errorf("OpenIMIS risk score update failed: %s", result.Data.UpdateRiskScore.Message)
}
return nil
}

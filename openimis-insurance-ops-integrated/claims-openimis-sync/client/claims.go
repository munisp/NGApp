package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"claims-openimis-sync/model"
)

type ClaimsServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewClaimsServiceClient(baseURL string) *ClaimsServiceClient {
	return &ClaimsServiceClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *ClaimsServiceClient) GetPendingSyncClaims(ctx context.Context) ([]model.Claim, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/claims?sync_status=pending", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claims service error: %s", resp.Status)
	}

	var claims []model.Claim
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return claims, nil
}

func (c *ClaimsServiceClient) UpdateSyncStatus(ctx context.Context, claimID, openIMISID, status string) error {
	url := fmt.Sprintf("%s/api/v1/claims/%s/sync", c.baseURL, claimID)
	
	req, err := http.NewRequestWithContext(ctx, "PATCH", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("openimis_id", openIMISID)
	q.Add("status", status)
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("claims service error: %s", resp.Status)
	}

	return nil
}

func (c *ClaimsServiceClient) GetClaimByID(ctx context.Context, claimID string) (*model.Claim, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/claims/"+claimID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claims service error: %s", resp.Status)
	}

	var claim model.Claim
	if err := json.NewDecoder(resp.Body).Decode(&claim); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &claim, nil
}

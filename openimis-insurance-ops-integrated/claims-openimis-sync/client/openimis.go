package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"claims-openimis-sync/model"
)

type OpenIMISClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewOpenIMISClient(baseURL, apiKey string) *OpenIMISClient {
	return &OpenIMISClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *OpenIMISClient) CreateClaim(ctx context.Context, claim *model.Claim) (*model.OpenIMISClaim, error) {
	openIMISClaim := map[string]interface{}{
		"code":            claim.ID,
		"date_claimed":    claim.SubmissionDate.Format("2006-01-02"),
		"date_from":       claim.IncidentDate.Format("2006-01-02"),
		"date_to":         claim.IncidentDate.Format("2006-01-02"),
		"claimed":         claim.Amount,
		"insuree_uuid":    claim.ClaimantID,
		"explanation":     claim.Description,
	}

	body, err := json.Marshal(openIMISClaim)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal claim: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/claim/", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenIMIS API error: %s - %s", resp.Status, string(respBody))
	}

	var result model.OpenIMISClaim
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (c *OpenIMISClient) GetClaim(ctx context.Context, claimUUID string) (*model.OpenIMISClaim, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/claim/"+claimUUID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenIMIS API error: %s", resp.Status)
	}

	var result model.OpenIMISClaim
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (c *OpenIMISClient) UpdateClaimStatus(ctx context.Context, claimUUID string, status int) error {
	body, _ := json.Marshal(map[string]int{"status": status})
	
	req, err := http.NewRequestWithContext(ctx, "PATCH", c.baseURL+"/api/claim/"+claimUUID, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("OpenIMIS API error: %s", resp.Status)
	}

	return nil
}

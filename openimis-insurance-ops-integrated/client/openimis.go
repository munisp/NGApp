package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"claims-openimis-sync/config"
	"claims-openimis-sync/model"
)

// OpenIMISClient defines the interface for interacting with the OpenIMIS service.
type OpenIMISClient interface {
	SyncClaim(ctx context.Context, claim model.OpenIMISClaim) error
	GetReserveAdjustments(ctx context.Context) ([]model.ReserveAdjustment, error)
	GetPolicyDataForLossRatio(ctx context.Context, policyID string) (float64, float64, error)
}

// HTTPOpenIMISClient implements the OpenIMISClient interface via real HTTP calls.
type HTTPOpenIMISClient struct {
	cfg        *config.Config
	httpClient *http.Client
}

// NewOpenIMISClient creates a new HTTPOpenIMISClient.
func NewOpenIMISClient(cfg *config.Config) OpenIMISClient {
	return &HTTPOpenIMISClient{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SyncClaim sends a claim to OpenIMIS via HTTP POST.
func (c *HTTPOpenIMISClient) SyncClaim(ctx context.Context, claim model.OpenIMISClaim) error {
	url := fmt.Sprintf("%s/api/claim/", c.cfg.OpenIMISServiceURL)
	body, err := json.Marshal(map[string]interface{}{
		"code":            claim.ExternalRefID,
		"health_facility": claim.HealthFacilityCode,
		"insuree":         claim.InsureeChfID,
		"date_claimed":    claim.DateClaimed.Format("2006-01-02"),
		"date_from":       claim.DateFrom.Format("2006-01-02"),
		"date_to":         claim.DateTo.Format("2006-01-02"),
		"icd":             claim.ICDCode,
		"claimed":         claim.ClaimedAmount,
		"status":          2, // Entered
	})
	if err != nil {
		return fmt.Errorf("marshal claim: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.OpenIMISAPIKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call OpenIMIS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
	}
	return nil
}

// GetReserveAdjustments fetches reserve adjustments from OpenIMIS via HTTP GET.
func (c *HTTPOpenIMISClient) GetReserveAdjustments(ctx context.Context) ([]model.ReserveAdjustment, error) {
	url := fmt.Sprintf("%s/api/claim/?status=RESERVE_ADJUSTED&page_size=100", c.cfg.OpenIMISServiceURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.OpenIMISAPIKey)
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
		Results []struct {
			UUID           string  `json:"uuid"`
			AdjustmentID   string  `json:"adjustment_id"`
			ReserveAmount  float64 `json:"reserve_amount"`
			AdjustmentDate string  `json:"adjustment_date"`
			Reason         string  `json:"reason"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	adjustments := make([]model.ReserveAdjustment, 0, len(result.Results))
	for _, r := range result.Results {
		adjDate, _ := time.Parse("2006-01-02", r.AdjustmentDate)
		adjustments = append(adjustments, model.ReserveAdjustment{
			ClaimUUID:      r.UUID,
			AdjustmentID:   r.AdjustmentID,
			NewReserve:     r.ReserveAmount,
			AdjustmentDate: adjDate,
			Reason:         r.Reason,
		})
	}
	return adjustments, nil
}

// GetPolicyDataForLossRatio fetches policy data required for loss ratio calculation.
func (c *HTTPOpenIMISClient) GetPolicyDataForLossRatio(ctx context.Context, policyID string) (float64, float64, error) {
	url := fmt.Sprintf("%s/api/policy/%s/loss-ratio/", c.cfg.OpenIMISServiceURL, policyID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, 0, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.OpenIMISAPIKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("call OpenIMIS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return 0, 0, fmt.Errorf("policy %s not found in OpenIMIS", policyID)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return 0, 0, fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
	}
	var result struct {
		TotalClaims  float64 `json:"total_claims"`
		TotalPremium float64 `json:"total_premium"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, fmt.Errorf("decode response: %w", err)
	}
	return result.TotalClaims, result.TotalPremium, nil
}

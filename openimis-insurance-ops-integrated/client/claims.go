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

// ClaimsClient defines the interface for interacting with the Claims service.
type ClaimsClient interface {
	GetClaimsForSync(ctx context.Context) ([]model.Claim, error)
	AdjustReserve(ctx context.Context, adjustment model.ReserveAdjustment) error
	UpdateLossRatio(ctx context.Context, update model.LossRatioUpdate) error
}

// HTTPClaimsClient implements the ClaimsClient interface via real HTTP calls.
type HTTPClaimsClient struct {
	cfg        *config.Config
	httpClient *http.Client
}

// NewClaimsClient creates a new HTTPClaimsClient.
func NewClaimsClient(cfg *config.Config) ClaimsClient {
	return &HTTPClaimsClient{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// GetClaimsForSync fetches claims that need to be synced to OpenIMIS via HTTP GET.
func (c *HTTPClaimsClient) GetClaimsForSync(ctx context.Context) ([]model.Claim, error) {
	url := fmt.Sprintf("%s/api/v1/claims?status=PENDING_OPENIMIS_SYNC", c.cfg.ClaimsServiceURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Service-Token", c.cfg.ServiceToken)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call claims service: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claims service status %d: %s", resp.StatusCode, b)
	}
	var result struct {
		Claims []model.Claim `json:"claims"`
		Total  int           `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return result.Claims, nil
}

// AdjustReserve sends a reserve adjustment back to the Claims service via HTTP PUT.
func (c *HTTPClaimsClient) AdjustReserve(ctx context.Context, adjustment model.ReserveAdjustment) error {
	url := fmt.Sprintf("%s/api/v1/claims/%s/reserve", c.cfg.ClaimsServiceURL, adjustment.ClaimUUID)
	body, err := json.Marshal(map[string]interface{}{
		"new_reserve":     adjustment.NewReserve,
		"adjustment_id":   adjustment.AdjustmentID,
		"adjustment_date": adjustment.AdjustmentDate.Format(time.RFC3339),
		"reason":          adjustment.Reason,
	})
	if err != nil {
		return fmt.Errorf("marshal adjustment: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Token", c.cfg.ServiceToken)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call claims service: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("claims service status %d: %s", resp.StatusCode, b)
	}
	return nil
}

// UpdateLossRatio updates the loss ratio in the Claims service via HTTP PUT.
func (c *HTTPClaimsClient) UpdateLossRatio(ctx context.Context, update model.LossRatioUpdate) error {
	url := fmt.Sprintf("%s/api/v1/policies/%s/loss-ratio", c.cfg.ClaimsServiceURL, update.PolicyID)
	body, err := json.Marshal(map[string]interface{}{
		"loss_ratio":    update.LossRatio,
		"total_claims":  update.TotalClaims,
		"total_premium": update.TotalPremium,
		"updated_at":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return fmt.Errorf("marshal loss ratio update: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Token", c.cfg.ServiceToken)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call claims service: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("claims service status %d: %s", resp.StatusCode, b)
	}
	return nil
}

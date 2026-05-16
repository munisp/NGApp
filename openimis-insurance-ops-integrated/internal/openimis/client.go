package openimis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"claims-reserve-service/config"
	"claims-reserve-service/internal/model"
	"claims-reserve-service/pkg/log"

	"go.uber.org/zap"
)

// Client is the real HTTP client for OpenIMIS services
type Client struct {
	cfg        config.OpenIMISConfig
	httpClient *http.Client
}

// NewClient creates a new OpenIMIS client
func NewClient(cfg config.OpenIMISConfig) *Client {
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// GetClaim fetches a claim from the OpenIMIS Claims Service via REST API
func (c *Client) GetClaim(ctx context.Context, claimID string) (model.Claim, error) {
	log.L().Info("Fetching claim from OpenIMIS", zap.String("claimID", claimID))
	claimUUID, err := uuid.Parse(claimID)
	if err != nil {
		return model.Claim{}, fmt.Errorf("invalid claim ID format: %w", err)
	}
	url := fmt.Sprintf("%s/api/claim/%s/", c.cfg.ClaimsServiceUrl, claimID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return model.Claim{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return model.Claim{}, fmt.Errorf("call OpenIMIS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return model.Claim{}, fmt.Errorf("claim %s not found in OpenIMIS", claimID)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return model.Claim{}, fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
	}
	var apiResp struct {
		UUID      string  `json:"uuid"`
		Code      string  `json:"code"`
		PolicyID  string  `json:"policy_uuid"`
		Status    string  `json:"status"`
		Amount    float64 `json:"claimed"`
		IsLarge   bool    `json:"is_large_claim"`
		CreatedAt string  `json:"date_claimed"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return model.Claim{}, fmt.Errorf("decode response: %w", err)
	}
	policyUUID, _ := uuid.Parse(apiResp.PolicyID)
	createdAt, _ := time.Parse("2006-01-02", apiResp.CreatedAt)
	return model.Claim{
		ID:        claimUUID,
		ClaimCode: apiResp.Code,
		PolicyID:  policyUUID,
		Status:    apiResp.Status,
		Amount:    apiResp.Amount,
		IsLarge:   apiResp.IsLarge,
		CreatedAt: createdAt,
	}, nil
}

// SendReserveAdjustment sends the new reserve to the OpenIMIS Claims Service
func (c *Client) SendReserveAdjustment(ctx context.Context, reserve model.Reserve) error {
	log.L().Info("Sending reserve adjustment to OpenIMIS",
		zap.String("claimID", reserve.ClaimID.String()),
		zap.Float64("amount", reserve.Amount),
	)
	url := fmt.Sprintf("%s/api/claim/%s/reserve/", c.cfg.ClaimsServiceUrl, reserve.ClaimID.String())
	payload := map[string]interface{}{
		"reserve_amount": reserve.Amount,
		"adjusted_at":    time.Now().UTC().Format(time.RFC3339),
		"reason":         reserve.Reason,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal reserve adjustment: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call OpenIMIS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("OpenIMIS status %d: %s", resp.StatusCode, b)
	}
	log.L().Info("Reserve adjustment sent", zap.String("claimID", reserve.ClaimID.String()))
	return nil
}

// RequestActuarialReview sends a request for large claim actuarial review
func (c *Client) RequestActuarialReview(ctx context.Context, reviewReq model.ActuarialReviewRequest) (model.ActuarialReviewResponse, error) {
	log.L().Info("Requesting actuarial review for large claim",
		zap.String("claimID", reviewReq.ClaimID.String()),
		zap.Float64("amount", reviewReq.ClaimAmount),
	)
	url := fmt.Sprintf("%s/api/actuarial/review/", c.cfg.ClaimsServiceUrl)
	body, err := json.Marshal(reviewReq)
	if err != nil {
		return model.ActuarialReviewResponse{}, fmt.Errorf("marshal actuarial review request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return model.ActuarialReviewResponse{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return model.ActuarialReviewResponse{}, fmt.Errorf("call OpenIMIS actuarial: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return model.ActuarialReviewResponse{}, fmt.Errorf("OpenIMIS actuarial status %d: %s", resp.StatusCode, b)
	}
	var reviewResp model.ActuarialReviewResponse
	if err := json.NewDecoder(resp.Body).Decode(&reviewResp); err != nil {
		return model.ActuarialReviewResponse{}, fmt.Errorf("decode actuarial response: %w", err)
	}
	log.L().Info("Actuarial review completed",
		zap.String("claimID", reviewReq.ClaimID.String()),
		zap.Float64("recommendedReserve", reviewResp.RecommendedReserve),
	)
	return reviewResp, nil
}

// TriggerIBNRCalculation triggers IBNR calculation in the actuarial service
func (c *Client) TriggerIBNRCalculation(ctx context.Context) (model.IBNRCalculationResult, error) {
	log.L().Info("Triggering IBNR calculation")
	url := fmt.Sprintf("%s/api/actuarial/ibnr/calculate/", c.cfg.ClaimsServiceUrl)
	payload := map[string]interface{}{
		"triggered_at": time.Now().UTC().Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return model.IBNRCalculationResult{}, fmt.Errorf("marshal IBNR request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return model.IBNRCalculationResult{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return model.IBNRCalculationResult{}, fmt.Errorf("call OpenIMIS actuarial: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		b, _ := io.ReadAll(resp.Body)
		return model.IBNRCalculationResult{}, fmt.Errorf("OpenIMIS actuarial status %d: %s", resp.StatusCode, b)
	}
	var result model.IBNRCalculationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return model.IBNRCalculationResult{}, fmt.Errorf("decode IBNR result: %w", err)
	}
	log.L().Info("IBNR calculation triggered", zap.Float64("totalIBNR", result.TotalIBNR))
	return result, nil
}

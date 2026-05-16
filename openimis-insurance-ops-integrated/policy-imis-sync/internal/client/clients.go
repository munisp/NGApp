package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"policy-imis-sync/internal/model"
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
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *OpenIMISClient) CreatePolicy(ctx context.Context, policy *model.Policy) (*model.OpenIMISPolicy, error) {
	data := map[string]interface{}{
		"enroll_date": policy.EffectiveDate.Format("2006-01-02"),
		"start_date":  policy.EffectiveDate.Format("2006-01-02"),
		"expiry_date": policy.ExpirationDate.Format("2006-01-02"),
		"value":       policy.PremiumAmount,
		"product_uuid": policy.ProductID,
		"family_uuid":  policy.HolderID,
	}
	body, _ := json.Marshal(data)
	
	req, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/policy/", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result model.OpenIMISPolicy
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func (c *OpenIMISClient) GetPolicy(ctx context.Context, uuid string) (*model.OpenIMISPolicy, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/policy/"+uuid, nil)
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result model.OpenIMISPolicy
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

type PolicyServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewPolicyServiceClient(baseURL string) *PolicyServiceClient {
	return &PolicyServiceClient{
		baseURL: baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *PolicyServiceClient) GetPendingPolicies(ctx context.Context) ([]model.Policy, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/policies?sync_status=pending", nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var policies []model.Policy
	json.NewDecoder(resp.Body).Decode(&policies)
	return policies, nil
}

func (c *PolicyServiceClient) UpdateSyncStatus(ctx context.Context, policyID, openIMISID, status string) error {
	url := fmt.Sprintf("%s/api/v1/policies/%s/sync?openimis_id=%s&status=%s", c.baseURL, policyID, openIMISID, status)
	req, _ := http.NewRequestWithContext(ctx, "PATCH", url, nil)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

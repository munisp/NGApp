package rbac

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// PermifyConfig holds Permify connection configuration
type PermifyConfig struct {
	URL       string `json:"url" yaml:"url"`
	TenantID  string `json:"tenant_id" yaml:"tenantId"`
	APIKey    string `json:"api_key" yaml:"apiKey"`
}

// Entity represents a Permify entity
type Entity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// Subject represents a Permify subject
type Subject struct {
	Type     string `json:"type"`
	ID       string `json:"id"`
	Relation string `json:"relation,omitempty"`
}

// Tuple represents a relationship tuple
type Tuple struct {
	Entity   Entity  `json:"entity"`
	Relation string  `json:"relation"`
	Subject  Subject `json:"subject"`
}

// CheckRequest represents a permission check request
type CheckRequest struct {
	TenantID   string            `json:"tenant_id"`
	Entity     Entity            `json:"entity"`
	Permission string            `json:"permission"`
	Subject    Subject           `json:"subject"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// CheckResponse represents a permission check response
type CheckResponse struct {
	Can            bool   `json:"can"`
	RemainingDepth int    `json:"remaining_depth,omitempty"`
}

// WriteRequest represents a relationship write request
type WriteRequest struct {
	TenantID string  `json:"tenant_id"`
	Tuples   []Tuple `json:"tuples"`
}

// WriteResponse represents a relationship write response
type WriteResponse struct {
	SnapToken string `json:"snap_token"`
}

// DeleteRequest represents a relationship delete request
type DeleteRequest struct {
	TenantID string  `json:"tenant_id"`
	Tuples   []Tuple `json:"tuples"`
}

// LookupEntityRequest represents an entity lookup request
type LookupEntityRequest struct {
	TenantID   string            `json:"tenant_id"`
	EntityType string            `json:"entity_type"`
	Permission string            `json:"permission"`
	Subject    Subject           `json:"subject"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// LookupEntityResponse represents an entity lookup response
type LookupEntityResponse struct {
	EntityIDs []string `json:"entity_ids"`
}

// PermifyAdapter provides Permify authorization operations
type PermifyAdapter struct {
	config     PermifyConfig
	httpClient *http.Client
}

// NewPermifyAdapter creates a new Permify adapter
func NewPermifyAdapter(config PermifyConfig) *PermifyAdapter {
	return &PermifyAdapter{
		config: config,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Check performs a permission check
func (p *PermifyAdapter) Check(ctx context.Context, req CheckRequest) (*CheckResponse, error) {
	if req.TenantID == "" {
		req.TenantID = p.config.TenantID
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", p.config.URL, req.TenantID)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal check request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create check request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to perform check: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("check failed: %s - %s", resp.Status, string(respBody))
	}

	var checkResp CheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&checkResp); err != nil {
		return nil, fmt.Errorf("failed to decode check response: %w", err)
	}

	return &checkResp, nil
}

// WriteRelationships writes relationship tuples
func (p *PermifyAdapter) WriteRelationships(ctx context.Context, tuples []Tuple) (*WriteResponse, error) {
	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/write", p.config.URL, p.config.TenantID)

	req := WriteRequest{
		TenantID: p.config.TenantID,
		Tuples:   tuples,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal write request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create write request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to write relationships: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("write failed: %s - %s", resp.Status, string(respBody))
	}

	var writeResp WriteResponse
	if err := json.NewDecoder(resp.Body).Decode(&writeResp); err != nil {
		return nil, fmt.Errorf("failed to decode write response: %w", err)
	}

	return &writeResp, nil
}

// DeleteRelationships deletes relationship tuples
func (p *PermifyAdapter) DeleteRelationships(ctx context.Context, tuples []Tuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/delete", p.config.URL, p.config.TenantID)

	req := DeleteRequest{
		TenantID: p.config.TenantID,
		Tuples:   tuples,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal delete request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to delete relationships: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed: %s - %s", resp.Status, string(respBody))
	}

	return nil
}

// LookupEntities looks up entities a subject has permission on
func (p *PermifyAdapter) LookupEntities(ctx context.Context, req LookupEntityRequest) (*LookupEntityResponse, error) {
	if req.TenantID == "" {
		req.TenantID = p.config.TenantID
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/lookup-entity", p.config.URL, req.TenantID)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal lookup request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create lookup request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup entities: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("lookup failed: %s - %s", resp.Status, string(respBody))
	}

	var lookupResp LookupEntityResponse
	if err := json.NewDecoder(resp.Body).Decode(&lookupResp); err != nil {
		return nil, fmt.Errorf("failed to decode lookup response: %w", err)
	}

	return &lookupResp, nil
}

// Payment Switch specific helper methods

// CanAccessMerchant checks if a user can access a merchant
func (p *PermifyAdapter) CanAccessMerchant(ctx context.Context, userID, merchantID, permission string) (bool, error) {
	resp, err := p.Check(ctx, CheckRequest{
		Entity:     Entity{Type: "merchant", ID: merchantID},
		Permission: permission,
		Subject:    Subject{Type: "user", ID: userID},
	})
	if err != nil {
		return false, err
	}
	return resp.Can, nil
}

// CanAccessTransaction checks if a user can access a transaction
func (p *PermifyAdapter) CanAccessTransaction(ctx context.Context, userID, transactionID, permission string) (bool, error) {
	resp, err := p.Check(ctx, CheckRequest{
		Entity:     Entity{Type: "transaction", ID: transactionID},
		Permission: permission,
		Subject:    Subject{Type: "user", ID: userID},
	})
	if err != nil {
		return false, err
	}
	return resp.Can, nil
}

// AssignUserToMerchant assigns a user to a merchant with a role
func (p *PermifyAdapter) AssignUserToMerchant(ctx context.Context, userID, merchantID, role string) error {
	_, err := p.WriteRelationships(ctx, []Tuple{
		{
			Entity:   Entity{Type: "merchant", ID: merchantID},
			Relation: role,
			Subject:  Subject{Type: "user", ID: userID},
		},
	})
	return err
}

// RemoveUserFromMerchant removes a user from a merchant
func (p *PermifyAdapter) RemoveUserFromMerchant(ctx context.Context, userID, merchantID, role string) error {
	return p.DeleteRelationships(ctx, []Tuple{
		{
			Entity:   Entity{Type: "merchant", ID: merchantID},
			Relation: role,
			Subject:  Subject{Type: "user", ID: userID},
		},
	})
}

// GetUserMerchants gets all merchants a user has access to
func (p *PermifyAdapter) GetUserMerchants(ctx context.Context, userID, permission string) ([]string, error) {
	resp, err := p.LookupEntities(ctx, LookupEntityRequest{
		EntityType: "merchant",
		Permission: permission,
		Subject:    Subject{Type: "user", ID: userID},
	})
	if err != nil {
		return nil, err
	}
	return resp.EntityIDs, nil
}

package permify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client provides a real Permify API client.
type Client struct {
	baseURL  string
	tenantID string
	apiKey   string
	http     *http.Client
}

// NewClient creates a Permify client from environment.
func NewClient() *Client {
	return &Client{
		baseURL:  envOr("PERMIFY_URL", "http://permify:3476"),
		tenantID: envOr("PERMIFY_TENANT", "payment-switch"),
		apiKey:   os.Getenv("PERMIFY_API_KEY"),
		http:     &http.Client{Timeout: 5 * time.Second},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthCheck verifies Permify is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/healthz", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("permify health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("permify unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) setAuth(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
}

// CheckPermission checks if a subject has permission on a resource.
type PermissionCheckRequest struct {
	Entity   Entity  `json:"entity"`
	Subject  Subject `json:"subject"`
	Permission string `json:"permission"`
}

type Entity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type Subject struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type PermissionCheckResponse struct {
	Can        string `json:"can"`
	Metadata   map[string]interface{} `json:"metadata"`
}

func (c *Client) CheckPermission(ctx context.Context, req PermissionCheckRequest) (bool, error) {
	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"schema_version": "",
			"snap_token":     "",
			"depth":          20,
		},
		"entity": map[string]interface{}{
			"type": req.Entity.Type,
			"id":   req.Entity.ID,
		},
		"permission": req.Permission,
		"subject": map[string]interface{}{
			"type": req.Subject.Type,
			"id":   req.Subject.ID,
		},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", c.baseURL, c.tenantID)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return false, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	c.setAuth(httpReq)
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return false, fmt.Errorf("check permission: %w", err)
	}
	defer resp.Body.Close()
	var result PermissionCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}
	return result.Can == "RESULT_ALLOWED", nil
}

// WriteRelationship writes a relationship tuple to Permify.
type RelationshipTuple struct {
	EntityType   string `json:"entity_type"`
	EntityID     string `json:"entity_id"`
	Relation     string `json:"relation"`
	SubjectType  string `json:"subject_type"`
	SubjectID    string `json:"subject_id"`
}

func (c *Client) WriteRelationship(ctx context.Context, tuple RelationshipTuple) error {
	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"schema_version": "",
		},
		"tuples": []map[string]interface{}{
			{
				"entity": map[string]interface{}{
					"type": tuple.EntityType,
					"id":   tuple.EntityID,
				},
				"relation": tuple.Relation,
				"subject": map[string]interface{}{
					"type": tuple.SubjectType,
					"id":   tuple.SubjectID,
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/write", c.baseURL, c.tenantID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("write relationship: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("write relationship failed: status %d", resp.StatusCode)
	}
	return nil
}

// WriteSchema writes the authorization schema to Permify.
func (c *Client) WriteSchema(ctx context.Context, schema string) error {
	payload := map[string]interface{}{
		"schema": schema,
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v1/tenants/%s/schemas/write", c.baseURL, c.tenantID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("write schema: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("write schema failed: status %d", resp.StatusCode)
	}
	return nil
}

// BulkCheck performs bulk permission checks.
func (c *Client) BulkCheck(ctx context.Context, checks []PermissionCheckRequest) ([]bool, error) {
	results := make([]bool, len(checks))
	for i, check := range checks {
		allowed, err := c.CheckPermission(ctx, check)
		if err != nil {
			results[i] = false
			continue
		}
		results[i] = allowed
	}
	return results, nil
}

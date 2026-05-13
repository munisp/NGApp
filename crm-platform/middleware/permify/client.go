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

// Client provides Permify fine-grained authorization.
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiToken   string
}

// NewClient creates a Permify client.
func NewClient() *Client {
	url := os.Getenv("PERMIFY_URL")
	if url == "" {
		url = "http://permify:3476"
	}
	return &Client{
		httpClient: &http.Client{Timeout: 5 * time.Second},
		baseURL:    url,
		apiToken:   os.Getenv("PERMIFY_API_TOKEN"),
	}
}

// CheckPermission checks if subject has permission on entity.
type CheckRequest struct {
	TenantID   string `json:"tenant_id"`
	Entity     Entity `json:"entity"`
	Permission string `json:"permission"`
	Subject    Entity `json:"subject"`
}

type Entity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type CheckResponse struct {
	Can             bool   `json:"can"`
	RemainingCredit int    `json:"remaining_credit"`
}

// Check evaluates an authorization check.
func (c *Client) Check(ctx context.Context, req CheckRequest) (bool, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"metadata": map[string]string{"tenant_id": req.TenantID},
		"entity":   req.Entity,
		"permission": req.Permission,
		"subject":    req.Subject,
	})
	httpReq, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/permissions/check", c.baseURL, req.TenantID),
		bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.apiToken)
	}
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	var result CheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}
	return result.Can, nil
}

// WriteRelationship creates an authorization relationship (tuple).
func (c *Client) WriteRelationship(ctx context.Context, tenantID string, entityType, entityID, relation, subjectType, subjectID string) error {
	body, _ := json.Marshal(map[string]interface{}{
		"metadata": map[string]string{"tenant_id": tenantID},
		"tuples": []map[string]interface{}{
			{
				"entity":   map[string]string{"type": entityType, "id": entityID},
				"relation": relation,
				"subject":  map[string]string{"type": subjectType, "id": subjectID},
			},
		},
	})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/relationships/write", c.baseURL, tenantID),
		bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if c.apiToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiToken)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("permify write relationship: status %d", resp.StatusCode)
	}
	return nil
}

// CRM Permission Schema (written to Permify on startup)
const CRMSchema = `
entity user {}

entity tenant {
    relation admin @user
    relation member @user
    relation viewer @user

    permission manage = admin
    permission write = admin or member
    permission read = admin or member or viewer
}

entity customer {
    relation owner @user
    relation tenant @tenant

    permission view = owner or tenant.read
    permission edit = owner or tenant.write
    permission delete = tenant.manage
}

entity campaign {
    relation creator @user
    relation tenant @tenant

    permission view = creator or tenant.read
    permission edit = creator or tenant.write
    permission execute = tenant.manage
}

entity report {
    relation tenant @tenant

    permission view = tenant.read
    permission export = tenant.write
    permission configure = tenant.manage
}
`

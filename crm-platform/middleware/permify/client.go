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

// Client provides Permify fine-grained authorization with full CRUD.
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

// Entity represents a Permify entity reference.
type Entity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// CheckRequest for permission evaluation.
type CheckRequest struct {
	TenantID   string `json:"tenant_id"`
	Entity     Entity `json:"entity"`
	Permission string `json:"permission"`
	Subject    Entity `json:"subject"`
}

// CheckResponse from permission evaluation.
type CheckResponse struct {
	Can             bool `json:"can"`
	RemainingCredit int  `json:"remaining_credit"`
}

// Check evaluates an authorization check.
func (c *Client) Check(ctx context.Context, req CheckRequest) (bool, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"metadata":   map[string]string{"tenant_id": req.TenantID, "snap_token": ""},
		"entity":     req.Entity,
		"permission": req.Permission,
		"subject":    req.Subject,
	})
	httpReq, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/permissions/check", c.baseURL, req.TenantID),
		bytes.NewReader(body))
	c.setHeaders(httpReq)
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

// BulkCheck evaluates multiple permission checks in a single request.
func (c *Client) BulkCheck(ctx context.Context, tenantID string, checks []CheckRequest) ([]bool, error) {
	results := make([]bool, len(checks))
	for i, check := range checks {
		check.TenantID = tenantID
		allowed, err := c.Check(ctx, check)
		if err != nil {
			return nil, fmt.Errorf("check %d: %w", i, err)
		}
		results[i] = allowed
	}
	return results, nil
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
	c.setHeaders(req)
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

// DeleteRelationship removes an authorization relationship.
func (c *Client) DeleteRelationship(ctx context.Context, tenantID string, entityType, entityID, relation, subjectType, subjectID string) error {
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
		fmt.Sprintf("%s/v1/tenants/%s/relationships/delete", c.baseURL, tenantID),
		bytes.NewReader(body))
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("permify delete relationship: status %d", resp.StatusCode)
	}
	return nil
}

// LookupEntity finds all entities a subject has a specific permission on.
func (c *Client) LookupEntity(ctx context.Context, tenantID string, entityType, permission, subjectType, subjectID string) ([]string, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"metadata":    map[string]string{"tenant_id": tenantID, "snap_token": ""},
		"entity_type": entityType,
		"permission":  permission,
		"subject":     map[string]string{"type": subjectType, "id": subjectID},
	})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/permissions/lookup-entity", c.baseURL, tenantID),
		bytes.NewReader(body))
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		EntityIDs []string `json:"entity_ids"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.EntityIDs, nil
}

// LookupSubject finds all subjects that have a specific permission on an entity.
func (c *Client) LookupSubject(ctx context.Context, tenantID string, entityType, entityID, permission, subjectType string) ([]string, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"metadata":     map[string]string{"tenant_id": tenantID, "snap_token": ""},
		"entity":       map[string]string{"type": entityType, "id": entityID},
		"permission":   permission,
		"subject_type": subjectType,
	})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/permissions/lookup-subject", c.baseURL, tenantID),
		bytes.NewReader(body))
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		SubjectIDs []string `json:"subject_ids"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.SubjectIDs, nil
}

// WriteSchema writes or updates the authorization schema.
func (c *Client) WriteSchema(ctx context.Context, tenantID, schema string) (string, error) {
	body, _ := json.Marshal(map[string]string{"schema": schema})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/schemas/write", c.baseURL, tenantID),
		bytes.NewReader(body))
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		SchemaVersion string `json:"schema_version"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.SchemaVersion, nil
}

// ReadSchema reads the current authorization schema.
func (c *Client) ReadSchema(ctx context.Context, tenantID string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/v1/tenants/%s/schemas/read", c.baseURL, tenantID),
		bytes.NewReader([]byte("{}")))
	c.setHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		Schema struct {
			Definition string `json:"definition"`
		} `json:"schema"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Schema.Definition, nil
}

func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if c.apiToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiToken)
	}
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

entity lead {
    relation owner @user
    relation tenant @tenant

    permission view = owner or tenant.read
    permission edit = owner or tenant.write
    permission convert = owner or tenant.manage
    permission delete = tenant.manage
}

entity transaction {
    relation tenant @tenant

    permission view = tenant.read
    permission approve = tenant.write
    permission reverse = tenant.manage
}
`

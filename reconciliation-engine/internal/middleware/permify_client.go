package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type PermifyClient struct {
	baseURL    string
	tenantID   string
	httpClient *http.Client
}

type PermissionCheckRequest struct {
	TenantID string            `json:"tenant_id"`
	Metadata map[string]string `json:"metadata,omitempty"`
	Entity   Entity            `json:"entity"`
	Subject  Subject           `json:"subject"`
	Permission string          `json:"permission"`
}

type Entity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type Subject struct {
	Type     string `json:"type"`
	ID       string `json:"id"`
	Relation string `json:"relation,omitempty"`
}

type PermissionCheckResponse struct {
	Can            bool   `json:"can"`
	RemainingDepth int    `json:"remaining_depth"`
}

type RelationshipTuple struct {
	Entity   Entity  `json:"entity"`
	Relation string  `json:"relation"`
	Subject  Subject `json:"subject"`
}

type WriteRelationshipsRequest struct {
	TenantID string              `json:"tenant_id"`
	Metadata map[string]string   `json:"metadata,omitempty"`
	Tuples   []RelationshipTuple `json:"tuples"`
}

const (
	EntityTypeReconciliationJob  = "reconciliation_job"
	EntityTypeReconciliationItem = "reconciliation_item"
	EntityTypeBankStatement      = "bank_statement"
	EntityTypeReport             = "reconciliation_report"
	EntityTypeOrganization       = "organization"
	EntityTypeDepartment         = "department"

	RelationOwner    = "owner"
	RelationManager  = "manager"
	RelationOperator = "operator"
	RelationViewer   = "viewer"
	RelationAuditor  = "auditor"

	PermissionCreate   = "create"
	PermissionRead     = "read"
	PermissionUpdate   = "update"
	PermissionDelete   = "delete"
	PermissionApprove  = "approve"
	PermissionResolve  = "resolve"
	PermissionExport   = "export"
	PermissionDispute  = "dispute"
)

func NewPermifyClient(baseURL, tenantID string) (*PermifyClient, error) {
	return &PermifyClient{
		baseURL:  baseURL,
		tenantID: tenantID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

func (p *PermifyClient) CheckPermission(ctx context.Context, req *PermissionCheckRequest) (bool, error) {
	if req.TenantID == "" {
		req.TenantID = p.tenantID
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", p.baseURL, req.TenantID)

	jsonData, err := json.Marshal(req)
	if err != nil {
		return false, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return false, fmt.Errorf("failed to check permission: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("permission check failed: %s", string(body))
	}

	var result PermissionCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Can, nil
}

func (p *PermifyClient) WriteRelationships(ctx context.Context, tuples []RelationshipTuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/write", p.baseURL, p.tenantID)

	req := WriteRelationshipsRequest{
		TenantID: p.tenantID,
		Tuples:   tuples,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to write relationships: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("write relationships failed: %s", string(body))
	}

	return nil
}

func (p *PermifyClient) DeleteRelationships(ctx context.Context, tuples []RelationshipTuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/delete", p.baseURL, p.tenantID)

	req := WriteRelationshipsRequest{
		TenantID: p.tenantID,
		Tuples:   tuples,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to delete relationships: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (p *PermifyClient) CanCreateReconciliationJob(ctx context.Context, userID string, orgID string) (bool, error) {
	return p.CheckPermission(ctx, &PermissionCheckRequest{
		Entity: Entity{
			Type: EntityTypeOrganization,
			ID:   orgID,
		},
		Subject: Subject{
			Type: "user",
			ID:   userID,
		},
		Permission: PermissionCreate,
	})
}

func (p *PermifyClient) CanReadReconciliationJob(ctx context.Context, userID string, jobID string) (bool, error) {
	return p.CheckPermission(ctx, &PermissionCheckRequest{
		Entity: Entity{
			Type: EntityTypeReconciliationJob,
			ID:   jobID,
		},
		Subject: Subject{
			Type: "user",
			ID:   userID,
		},
		Permission: PermissionRead,
	})
}

func (p *PermifyClient) CanApproveReconciliation(ctx context.Context, userID string, jobID string) (bool, error) {
	return p.CheckPermission(ctx, &PermissionCheckRequest{
		Entity: Entity{
			Type: EntityTypeReconciliationJob,
			ID:   jobID,
		},
		Subject: Subject{
			Type: "user",
			ID:   userID,
		},
		Permission: PermissionApprove,
	})
}

func (p *PermifyClient) CanResolveItem(ctx context.Context, userID string, itemID string) (bool, error) {
	return p.CheckPermission(ctx, &PermissionCheckRequest{
		Entity: Entity{
			Type: EntityTypeReconciliationItem,
			ID:   itemID,
		},
		Subject: Subject{
			Type: "user",
			ID:   userID,
		},
		Permission: PermissionResolve,
	})
}

func (p *PermifyClient) CanDisputeItem(ctx context.Context, userID string, itemID string) (bool, error) {
	return p.CheckPermission(ctx, &PermissionCheckRequest{
		Entity: Entity{
			Type: EntityTypeReconciliationItem,
			ID:   itemID,
		},
		Subject: Subject{
			Type: "user",
			ID:   userID,
		},
		Permission: PermissionDispute,
	})
}

func (p *PermifyClient) CanExportReport(ctx context.Context, userID string, reportID string) (bool, error) {
	return p.CheckPermission(ctx, &PermissionCheckRequest{
		Entity: Entity{
			Type: EntityTypeReport,
			ID:   reportID,
		},
		Subject: Subject{
			Type: "user",
			ID:   userID,
		},
		Permission: PermissionExport,
	})
}

func (p *PermifyClient) AssignJobOwner(ctx context.Context, jobID string, userID string) error {
	return p.WriteRelationships(ctx, []RelationshipTuple{
		{
			Entity:   Entity{Type: EntityTypeReconciliationJob, ID: jobID},
			Relation: RelationOwner,
			Subject:  Subject{Type: "user", ID: userID},
		},
	})
}

func (p *PermifyClient) AssignJobViewer(ctx context.Context, jobID string, userID string) error {
	return p.WriteRelationships(ctx, []RelationshipTuple{
		{
			Entity:   Entity{Type: EntityTypeReconciliationJob, ID: jobID},
			Relation: RelationViewer,
			Subject:  Subject{Type: "user", ID: userID},
		},
	})
}

func (p *PermifyClient) AssignDepartmentAccess(ctx context.Context, jobID string, departmentID string, relation string) error {
	return p.WriteRelationships(ctx, []RelationshipTuple{
		{
			Entity:   Entity{Type: EntityTypeReconciliationJob, ID: jobID},
			Relation: relation,
			Subject:  Subject{Type: EntityTypeDepartment, ID: departmentID, Relation: "member"},
		},
	})
}

func (p *PermifyClient) Close() error {
	return nil
}

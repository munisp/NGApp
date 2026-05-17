package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

// PermifyConfig holds Permify configuration
type PermifyConfig struct {
	BaseURL   string
	TenantID  string
	APIKey    string
}

// PermifyClient handles fine-grained authorization with Permify
type PermifyClient struct {
	config     PermifyConfig
	httpClient *http.Client
}

// NewPermifyClient creates a new Permify client
func NewPermifyClient(config PermifyConfig) *PermifyClient {
	if config.BaseURL == "" {
		config.BaseURL = os.Getenv("PERMIFY_URL")
		if config.BaseURL == "" {
			config.BaseURL = "http://localhost:3476"
		}
	}
	if config.TenantID == "" {
		config.TenantID = os.Getenv("PERMIFY_TENANT_ID")
		if config.TenantID == "" {
			config.TenantID = "insurance-platform"
		}
	}
	if config.APIKey == "" {
		config.APIKey = os.Getenv("PERMIFY_API_KEY")
	}

	return &PermifyClient{
		config:     config,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Permission represents a permission check
type Permission struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entity_id"`
	Permission string `json:"permission"`
	Subject    string `json:"subject"`
	SubjectID  string `json:"subject_id"`
}

// RelationTuple represents a relationship tuple
type RelationTuple struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entity_id"`
	Relation   string `json:"relation"`
	Subject    string `json:"subject"`
	SubjectID  string `json:"subject_id"`
}

// CheckPermission checks if a subject has permission on an entity
func (p *PermifyClient) CheckPermission(ctx context.Context, perm Permission) (bool, error) {
	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", p.config.BaseURL, p.config.TenantID)

	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"snap_token":     "",
			"schema_version": "",
			"depth":          20,
		},
		"entity": map[string]string{
			"type": perm.Entity,
			"id":   perm.EntityID,
		},
		"permission": perm.Permission,
		"subject": map[string]interface{}{
			"type": perm.Subject,
			"id":   perm.SubjectID,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		// Return true for development (permissive mode)
		return true, nil
	}
	defer resp.Body.Close()

	var result struct {
		Can string `json:"can"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	return result.Can == "CHECK_RESULT_ALLOWED", nil
}

// WriteRelation writes a relationship tuple
func (p *PermifyClient) WriteRelation(ctx context.Context, tuple RelationTuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/data/write", p.config.BaseURL, p.config.TenantID)

	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"schema_version": "",
		},
		"tuples": []map[string]interface{}{
			{
				"entity": map[string]string{
					"type": tuple.Entity,
					"id":   tuple.EntityID,
				},
				"relation": tuple.Relation,
				"subject": map[string]interface{}{
					"type": tuple.Subject,
					"id":   tuple.SubjectID,
				},
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil // Ignore errors in development
	}
	defer resp.Body.Close()

	return nil
}

// DeleteRelation deletes a relationship tuple
func (p *PermifyClient) DeleteRelation(ctx context.Context, tuple RelationTuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/data/delete", p.config.BaseURL, p.config.TenantID)

	payload := map[string]interface{}{
		"tuple_filter": map[string]interface{}{
			"entity": map[string]string{
				"type": tuple.Entity,
				"id":   tuple.EntityID,
			},
			"relation": tuple.Relation,
			"subject": map[string]interface{}{
				"type": tuple.Subject,
				"id":   tuple.SubjectID,
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// Claims Adjudication specific permission checks

// CanViewClaim checks if user can view a claim
func (p *PermifyClient) CanViewClaim(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "claim",
		EntityID:   claimID.String(),
		Permission: "view",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanProcessClaim checks if user can process a claim
func (p *PermifyClient) CanProcessClaim(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "claim",
		EntityID:   claimID.String(),
		Permission: "process",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanApproveClaim checks if user can approve a claim
func (p *PermifyClient) CanApproveClaim(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "claim",
		EntityID:   claimID.String(),
		Permission: "approve",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanRejectClaim checks if user can reject a claim
func (p *PermifyClient) CanRejectClaim(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "claim",
		EntityID:   claimID.String(),
		Permission: "reject",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanEscalateClaim checks if user can escalate a claim
func (p *PermifyClient) CanEscalateClaim(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "claim",
		EntityID:   claimID.String(),
		Permission: "escalate",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanOverrideDecision checks if user can override a decision
func (p *PermifyClient) CanOverrideDecision(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "claim",
		EntityID:   claimID.String(),
		Permission: "override",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanManageRules checks if user can manage adjudication rules
func (p *PermifyClient) CanManageRules(ctx context.Context, userID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "adjudication_rules",
		EntityID:   "global",
		Permission: "manage",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanViewAuditLogs checks if user can view audit logs
func (p *PermifyClient) CanViewAuditLogs(ctx context.Context, userID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "audit_logs",
		EntityID:   "global",
		Permission: "view",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// AssignClaimToUser assigns a claim to a user
func (p *PermifyClient) AssignClaimToUser(ctx context.Context, claimID uuid.UUID, userID uuid.UUID) error {
	return p.WriteRelation(ctx, RelationTuple{
		Entity:    "claim",
		EntityID:  claimID.String(),
		Relation:  "assignee",
		Subject:   "user",
		SubjectID: userID.String(),
	})
}

// UnassignClaimFromUser removes claim assignment from a user
func (p *PermifyClient) UnassignClaimFromUser(ctx context.Context, claimID uuid.UUID, userID uuid.UUID) error {
	return p.DeleteRelation(ctx, RelationTuple{
		Entity:    "claim",
		EntityID:  claimID.String(),
		Relation:  "assignee",
		Subject:   "user",
		SubjectID: userID.String(),
	})
}

// AddUserToTeam adds a user to a team
func (p *PermifyClient) AddUserToTeam(ctx context.Context, userID uuid.UUID, teamID string) error {
	return p.WriteRelation(ctx, RelationTuple{
		Entity:    "team",
		EntityID:  teamID,
		Relation:  "member",
		Subject:   "user",
		SubjectID: userID.String(),
	})
}

// SetClaimOwner sets the owner of a claim (usually the policy holder)
func (p *PermifyClient) SetClaimOwner(ctx context.Context, claimID uuid.UUID, customerID uuid.UUID) error {
	return p.WriteRelation(ctx, RelationTuple{
		Entity:    "claim",
		EntityID:  claimID.String(),
		Relation:  "owner",
		Subject:   "user",
		SubjectID: customerID.String(),
	})
}

// LookupSubjects finds all subjects with a permission on an entity
func (p *PermifyClient) LookupSubjects(ctx context.Context, entity, entityID, permission, subjectType string) ([]string, error) {
	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/lookup-subject", p.config.BaseURL, p.config.TenantID)

	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"snap_token":     "",
			"schema_version": "",
			"depth":          20,
		},
		"entity": map[string]string{
			"type": entity,
			"id":   entityID,
		},
		"permission":   permission,
		"subject_reference": map[string]string{
			"type": subjectType,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return []string{}, nil
	}
	defer resp.Body.Close()

	var result struct {
		SubjectIDs []string `json:"subject_ids"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.SubjectIDs, nil
}

// GetClaimAssignees gets all users assigned to a claim
func (p *PermifyClient) GetClaimAssignees(ctx context.Context, claimID uuid.UUID) ([]string, error) {
	return p.LookupSubjects(ctx, "claim", claimID.String(), "process", "user")
}

// Permify schema for claims adjudication (to be loaded into Permify)
const ClaimsAdjudicationSchema = `
entity user {}

entity team {
    relation member @user
    relation manager @user
    
    permission view = member or manager
    permission manage = manager
}

entity claim {
    relation owner @user
    relation assignee @user
    relation team @team
    
    permission view = owner or assignee or team.member
    permission process = assignee or team.manager
    permission approve = team.manager
    permission reject = assignee or team.manager
    permission escalate = assignee or team.manager
    permission override = team.manager
}

entity adjudication_rules {
    relation admin @user
    relation editor @user
    relation viewer @user
    
    permission view = viewer or editor or admin
    permission edit = editor or admin
    permission manage = admin
}

entity audit_logs {
    relation admin @user
    relation auditor @user
    
    permission view = auditor or admin
    permission export = admin
}

entity document {
    relation claim @claim
    relation uploader @user
    
    permission view = uploader or claim.view
    permission delete = claim.team.manager
}
`

// WriteSchema writes the authorization schema to Permify
func (p *PermifyClient) WriteSchema(ctx context.Context, schema string) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/schemas/write", p.config.BaseURL, p.config.TenantID)

	payload := map[string]interface{}{
		"schema": schema,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to write schema: %s", string(body))
	}

	return nil
}

package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// PermifyConfig holds Permify configuration
type PermifyConfig struct {
	BaseURL  string
	TenantID string
}

// PermifyClient handles fine-grained authorization with Permify
type PermifyClient struct {
	config     PermifyConfig
	httpClient *http.Client
	logger     *zap.Logger
}

// NewPermifyClient creates a new Permify client
func NewPermifyClient(config PermifyConfig, logger *zap.Logger) *PermifyClient {
	if config.BaseURL == "" {
		config.BaseURL = os.Getenv("PERMIFY_BASE_URL")
		if config.BaseURL == "" {
			config.BaseURL = "http://permify:3476"
		}
	}
	if config.TenantID == "" {
		config.TenantID = os.Getenv("PERMIFY_TENANT_ID")
		if config.TenantID == "" {
			config.TenantID = "t1"
		}
	}

	return &PermifyClient{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// Permission represents a permission check request
type Permission struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entity_id"`
	Permission string `json:"permission"`
	Subject    string `json:"subject"`
	SubjectID  string `json:"subject_id"`
}

// RelationTuple represents a relation tuple
type RelationTuple struct {
	Entity    string `json:"entity"`
	EntityID  string `json:"entity_id"`
	Relation  string `json:"relation"`
	Subject   string `json:"subject"`
	SubjectID string `json:"subject_id"`
}

// CheckPermission checks if a subject has permission on an entity
func (p *PermifyClient) CheckPermission(ctx context.Context, perm Permission) (bool, error) {
	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", p.config.BaseURL, p.config.TenantID)

	reqBody := map[string]interface{}{
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

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return false, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.logger.Error("Failed to check permission", zap.Error(err))
		return false, fmt.Errorf("failed to check permission: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode response: %w", err)
	}

	if can, ok := result["can"].(string); ok {
		return can == "CHECK_RESULT_ALLOWED", nil
	}

	return false, nil
}

// WriteRelation writes a relation tuple
func (p *PermifyClient) WriteRelation(ctx context.Context, tuple RelationTuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/data/write", p.config.BaseURL, p.config.TenantID)

	reqBody := map[string]interface{}{
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

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to write relation: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("write relation failed with status: %d", resp.StatusCode)
	}

	return nil
}

// DeleteRelation deletes a relation tuple
func (p *PermifyClient) DeleteRelation(ctx context.Context, tuple RelationTuple) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/data/delete", p.config.BaseURL, p.config.TenantID)

	reqBody := map[string]interface{}{
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

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete relation: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// Communication-specific permission checks

// CanSendToChannel checks if user can send messages to a specific channel
func (p *PermifyClient) CanSendToChannel(ctx context.Context, userID uuid.UUID, channel string) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "channel",
		EntityID:   channel,
		Permission: "send",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanSendBulkMessages checks if user can send bulk messages
func (p *PermifyClient) CanSendBulkMessages(ctx context.Context, userID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "communication",
		EntityID:   "bulk_messaging",
		Permission: "execute",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanViewMessageHistory checks if user can view message history
func (p *PermifyClient) CanViewMessageHistory(ctx context.Context, userID uuid.UUID, customerID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "customer",
		EntityID:   customerID.String(),
		Permission: "view_messages",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanManageTemplates checks if user can manage message templates
func (p *PermifyClient) CanManageTemplates(ctx context.Context, userID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "communication",
		EntityID:   "templates",
		Permission: "manage",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanAccessUSSD checks if user can access USSD service
func (p *PermifyClient) CanAccessUSSD(ctx context.Context, userID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "channel",
		EntityID:   "ussd",
		Permission: "access",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// CanViewAnalytics checks if user can view communication analytics
func (p *PermifyClient) CanViewAnalytics(ctx context.Context, userID uuid.UUID) (bool, error) {
	return p.CheckPermission(ctx, Permission{
		Entity:     "communication",
		EntityID:   "analytics",
		Permission: "view",
		Subject:    "user",
		SubjectID:  userID.String(),
	})
}

// AssignChannelAccess assigns channel access to a user
func (p *PermifyClient) AssignChannelAccess(ctx context.Context, userID uuid.UUID, channel string, permission string) error {
	return p.WriteRelation(ctx, RelationTuple{
		Entity:    "channel",
		EntityID:  channel,
		Relation:  permission,
		Subject:   "user",
		SubjectID: userID.String(),
	})
}

// RevokeChannelAccess revokes channel access from a user
func (p *PermifyClient) RevokeChannelAccess(ctx context.Context, userID uuid.UUID, channel string, permission string) error {
	return p.DeleteRelation(ctx, RelationTuple{
		Entity:    "channel",
		EntityID:  channel,
		Relation:  permission,
		Subject:   "user",
		SubjectID: userID.String(),
	})
}

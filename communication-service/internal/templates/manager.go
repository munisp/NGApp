package templates

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/insurance-platform/communication-service/internal/models"
	"go.uber.org/zap"
)

// Manager handles message template operations
type Manager struct {
	db     *sql.DB
	logger *zap.Logger
}

// NewManager creates a new template manager
func NewManager(db *sql.DB, logger *zap.Logger) *Manager {
	return &Manager{
		db:     db,
		logger: logger,
	}
}

// GetTemplate retrieves a template by ID
func (m *Manager) GetTemplate(ctx context.Context, templateID string) (*models.Template, error) {
	query := `
		SELECT id, name, channel, language, content, variables, category, description, created_at, updated_at
		FROM templates
		WHERE id = $1
	`

	var template models.Template
	var variablesJSON string

	err := m.db.QueryRowContext(ctx, query, templateID).Scan(
		&template.ID,
		&template.Name,
		&template.Channel,
		&template.Language,
		&template.Content,
		&variablesJSON,
		&template.Category,
		&template.Description,
		&template.CreatedAt,
		&template.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("template not found: %s", templateID)
		}
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	// Parse variables JSON array
	template.Variables = parseVariablesJSON(variablesJSON)

	return &template, nil
}

// GetTemplateByName retrieves a template by name and channel
func (m *Manager) GetTemplateByName(ctx context.Context, name string, channel models.Channel) (*models.Template, error) {
	query := `
		SELECT id, name, channel, language, content, variables, category, description, created_at, updated_at
		FROM templates
		WHERE name = $1 AND channel = $2
	`

	var template models.Template
	var variablesJSON string

	err := m.db.QueryRowContext(ctx, query, name, channel).Scan(
		&template.ID,
		&template.Name,
		&template.Channel,
		&template.Language,
		&template.Content,
		&variablesJSON,
		&template.Category,
		&template.Description,
		&template.CreatedAt,
		&template.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("template not found: %s/%s", name, channel)
		}
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	template.Variables = parseVariablesJSON(variablesJSON)

	return &template, nil
}

// RenderTemplate replaces variables in template content
func (m *Manager) RenderTemplate(ctx context.Context, template *models.Template, variables map[string]string) (string, error) {
	content := template.Content

	// Replace all variables
	for key, value := range variables {
		placeholder := fmt.Sprintf("{{%s}}", key)
		content = strings.ReplaceAll(content, placeholder, value)
	}

	// Check for unreplaced variables
	if strings.Contains(content, "{{") && strings.Contains(content, "}}") {
		m.logger.Warn("Template has unreplaced variables",
			zap.String("template_id", template.ID),
			zap.String("content", content))
	}

	return content, nil
}

// CreateTemplate creates a new template
func (m *Manager) CreateTemplate(ctx context.Context, template *models.Template) error {
	query := `
		INSERT INTO templates (id, name, channel, language, content, variables, category, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	now := time.Now()
	template.CreatedAt = now
	template.UpdatedAt = now

	variablesJSON := formatVariablesJSON(template.Variables)

	_, err := m.db.ExecContext(ctx, query,
		template.ID,
		template.Name,
		template.Channel,
		template.Language,
		template.Content,
		variablesJSON,
		template.Category,
		template.Description,
		template.CreatedAt,
		template.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create template: %w", err)
	}

	m.logger.Info("Template created",
		zap.String("template_id", template.ID),
		zap.String("name", template.Name))

	return nil
}

// UpdateTemplate updates an existing template
func (m *Manager) UpdateTemplate(ctx context.Context, template *models.Template) error {
	query := `
		UPDATE templates
		SET name = $2, channel = $3, language = $4, content = $5, variables = $6, 
		    category = $7, description = $8, updated_at = $9
		WHERE id = $1
	`

	template.UpdatedAt = time.Now()
	variablesJSON := formatVariablesJSON(template.Variables)

	result, err := m.db.ExecContext(ctx, query,
		template.ID,
		template.Name,
		template.Channel,
		template.Language,
		template.Content,
		variablesJSON,
		template.Category,
		template.Description,
		template.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update template: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("template not found: %s", template.ID)
	}

	m.logger.Info("Template updated",
		zap.String("template_id", template.ID))

	return nil
}

// DeleteTemplate deletes a template
func (m *Manager) DeleteTemplate(ctx context.Context, templateID string) error {
	query := `DELETE FROM templates WHERE id = $1`

	result, err := m.db.ExecContext(ctx, query, templateID)
	if err != nil {
		return fmt.Errorf("failed to delete template: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("template not found: %s", templateID)
	}

	m.logger.Info("Template deleted",
		zap.String("template_id", templateID))

	return nil
}

// ListTemplates lists all templates with optional filters
func (m *Manager) ListTemplates(ctx context.Context, channel models.Channel, category string) ([]*models.Template, error) {
	query := `
		SELECT id, name, channel, language, content, variables, category, description, created_at, updated_at
		FROM templates
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if channel != "" {
		query += fmt.Sprintf(" AND channel = $%d", argCount)
		args = append(args, channel)
		argCount++
	}

	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argCount)
		args = append(args, category)
		argCount++
	}

	query += " ORDER BY created_at DESC"

	rows, err := m.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}
	defer rows.Close()

	templates := []*models.Template{}

	for rows.Next() {
		var template models.Template
		var variablesJSON string

		err := rows.Scan(
			&template.ID,
			&template.Name,
			&template.Channel,
			&template.Language,
			&template.Content,
			&variablesJSON,
			&template.Category,
			&template.Description,
			&template.CreatedAt,
			&template.UpdatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to scan template: %w", err)
		}

		template.Variables = parseVariablesJSON(variablesJSON)
		templates = append(templates, &template)
	}

	return templates, nil
}

// InitializeDefaultTemplates creates default templates for common scenarios
func (m *Manager) InitializeDefaultTemplates(ctx context.Context) error {
	defaultTemplates := []models.Template{
		{
			ID:          "policy-created-sms",
			Name:        "policy_created",
			Channel:     models.ChannelSMS,
			Language:    "en",
			Content:     "Dear {{customer_name}}, your {{policy_type}} policy ({{policy_number}}) has been created successfully. Premium: ₦{{premium_amount}}. Thank you for choosing us!",
			Variables:   []string{"customer_name", "policy_type", "policy_number", "premium_amount"},
			Category:    "policy",
			Description: "Notification sent when a new policy is created",
		},
		{
			ID:          "claim-approved-whatsapp",
			Name:        "claim_approved",
			Channel:     models.ChannelWhatsApp,
			Language:    "en",
			Content:     "🎉 Great news, {{customer_name}}! Your claim ({{claim_number}}) has been approved. Amount: ₦{{claim_amount}}. Payment will be processed within 3-5 business days.",
			Variables:   []string{"customer_name", "claim_number", "claim_amount"},
			Category:    "claim",
			Description: "Notification sent when a claim is approved",
		},
		{
			ID:          "payment-reminder-sms",
			Name:        "payment_reminder",
			Channel:     models.ChannelSMS,
			Language:    "en",
			Content:     "Reminder: Your premium payment of ₦{{premium_amount}} for policy {{policy_number}} is due on {{due_date}}. Please pay to avoid lapse.",
			Variables:   []string{"premium_amount", "policy_number", "due_date"},
			Category:    "payment",
			Description: "Reminder for upcoming premium payment",
		},
		{
			ID:          "claim-rejected-telegram",
			Name:        "claim_rejected",
			Channel:     models.ChannelTelegram,
			Language:    "en",
			Content:     "Dear {{customer_name}}, we regret to inform you that your claim ({{claim_number}}) has been rejected. Reason: {{rejection_reason}}. For more information, please contact us.",
			Variables:   []string{"customer_name", "claim_number", "rejection_reason"},
			Category:    "claim",
			Description: "Notification sent when a claim is rejected",
		},
		{
			ID:          "policy-renewal-whatsapp",
			Name:        "policy_renewal",
			Channel:     models.ChannelWhatsApp,
			Language:    "en",
			Content:     "Hello {{customer_name}}! Your policy {{policy_number}} expires on {{expiry_date}}. Renew now to continue your coverage. Premium: ₦{{renewal_amount}}.",
			Variables:   []string{"customer_name", "policy_number", "expiry_date", "renewal_amount"},
			Category:    "policy",
			Description: "Notification for policy renewal",
		},
	}

	for _, template := range defaultTemplates {
		// Check if template already exists
		existing, _ := m.GetTemplate(ctx, template.ID)
		if existing != nil {
			m.logger.Info("Template already exists, skipping",
				zap.String("template_id", template.ID))
			continue
		}

		if err := m.CreateTemplate(ctx, &template); err != nil {
			m.logger.Error("Failed to create default template",
				zap.String("template_id", template.ID),
				zap.Error(err))
			return err
		}
	}

	m.logger.Info("Default templates initialized")
	return nil
}

// Helper functions

func parseVariablesJSON(jsonStr string) []string {
	// Simple JSON array parser for ["var1", "var2", "var3"]
	jsonStr = strings.TrimSpace(jsonStr)
	jsonStr = strings.Trim(jsonStr, "[]")
	
	if jsonStr == "" {
		return []string{}
	}

	parts := strings.Split(jsonStr, ",")
	variables := []string{}
	
	for _, part := range parts {
		part = strings.TrimSpace(part)
		part = strings.Trim(part, "\"")
		if part != "" {
			variables = append(variables, part)
		}
	}

	return variables
}

func formatVariablesJSON(variables []string) string {
	if len(variables) == 0 {
		return "[]"
	}

	quoted := []string{}
	for _, v := range variables {
		quoted = append(quoted, fmt.Sprintf("\"%s\"", v))
	}

	return "[" + strings.Join(quoted, ",") + "]"
}

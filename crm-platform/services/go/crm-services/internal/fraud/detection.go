package fraud

import (
	"context"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// Engine evaluates transactions against fraud detection rules.
type Engine struct {
	rules []models.FraudDetectionRule
}

// NewEngine creates a new fraud detection engine.
func NewEngine(rules []models.FraudDetectionRule) *Engine {
	return &Engine{rules: rules}
}

// Evaluate checks a transaction against all configured rules.
func (e *Engine) Evaluate(ctx context.Context, tx *models.Transaction) ([]models.FraudAlert, error) {
	var alerts []models.FraudAlert
	for _, rule := range e.rules {
		if !rule.Enabled {
			continue
		}
		if tx.Amount > rule.Threshold {
			alerts = append(alerts, models.FraudAlert{
				RuleID:      rule.ID,
				Severity:    rule.Severity,
				Description: rule.Description,
				Score:       tx.Amount / rule.Threshold,
			})
		}
	}
	return alerts, nil
}

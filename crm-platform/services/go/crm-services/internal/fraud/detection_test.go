package fraud

import (
	"context"
	"testing"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEngine(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Name: "High Amount", Threshold: 10000, Enabled: true, Severity: "high"},
	}
	engine := NewEngine(rules)
	assert.NotNil(t, engine)
	assert.Len(t, engine.rules, 1)
}

func TestEvaluate_NoRules(t *testing.T) {
	engine := NewEngine(nil)
	tx := &models.Transaction{Amount: 50000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Empty(t, alerts)
}

func TestEvaluate_BelowThreshold(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 10000, Enabled: true, Severity: "high"},
	}
	engine := NewEngine(rules)
	tx := &models.Transaction{Amount: 5000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Empty(t, alerts)
}

func TestEvaluate_AboveThreshold(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 10000, Enabled: true, Severity: "critical", Description: "Large transaction"},
	}
	engine := NewEngine(rules)
	tx := &models.Transaction{Amount: 25000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Len(t, alerts, 1)
	assert.Equal(t, "r1", alerts[0].RuleID)
	assert.Equal(t, "critical", alerts[0].Severity)
	assert.Equal(t, "Large transaction", alerts[0].Description)
	assert.Equal(t, 2.5, alerts[0].Score) // 25000/10000
}

func TestEvaluate_DisabledRule(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 1000, Enabled: false, Severity: "high"},
	}
	engine := NewEngine(rules)
	tx := &models.Transaction{Amount: 50000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Empty(t, alerts) // disabled rule should not trigger
}

func TestEvaluate_MultipleRules(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 10000, Enabled: true, Severity: "medium"},
		{ID: "r2", Threshold: 50000, Enabled: true, Severity: "critical"},
		{ID: "r3", Threshold: 100000, Enabled: true, Severity: "critical"},
	}
	engine := NewEngine(rules)

	tx := &models.Transaction{Amount: 75000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Len(t, alerts, 2) // triggers r1 and r2, not r3
}

func TestEvaluate_ExactThreshold(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 10000, Enabled: true, Severity: "medium"},
	}
	engine := NewEngine(rules)

	tx := &models.Transaction{Amount: 10000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Empty(t, alerts) // exact threshold should not trigger (> not >=)
}

func TestEvaluate_ScoreCalculation(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 5000, Enabled: true, Severity: "high"},
	}
	engine := NewEngine(rules)

	tx := &models.Transaction{Amount: 20000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	require.Len(t, alerts, 1)
	assert.Equal(t, 4.0, alerts[0].Score) // 20000/5000
}

func TestEvaluate_MixedEnabledDisabled(t *testing.T) {
	rules := []models.FraudDetectionRule{
		{ID: "r1", Threshold: 1000, Enabled: true, Severity: "low"},
		{ID: "r2", Threshold: 2000, Enabled: false, Severity: "medium"},
		{ID: "r3", Threshold: 3000, Enabled: true, Severity: "high"},
	}
	engine := NewEngine(rules)

	tx := &models.Transaction{Amount: 5000}
	alerts, err := engine.Evaluate(context.Background(), tx)
	require.NoError(t, err)
	assert.Len(t, alerts, 2) // r1 and r3 trigger, r2 disabled
	assert.Equal(t, "r1", alerts[0].RuleID)
	assert.Equal(t, "r3", alerts[1].RuleID)
}

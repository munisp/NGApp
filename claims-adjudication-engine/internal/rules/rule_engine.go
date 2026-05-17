package rules

import (
	"claims-adjudication-engine/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RuleCondition represents a single condition in a rule
type RuleCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
	Logic    string      `json:"logic,omitempty"` // AND, OR
}

// RuleAction represents the action to take when a rule matches
type RuleAction struct {
	Type       string                 `json:"type"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

// CompiledRule represents a rule ready for evaluation
type CompiledRule struct {
	ID          uuid.UUID
	Name        string
	Priority    int
	Conditions  []RuleCondition
	Action      RuleAction
	ProductType string
}

// RuleEngine handles dynamic rule evaluation
type RuleEngine struct {
	db    *gorm.DB
	rules []CompiledRule
}

// NewRuleEngine creates a new rule engine instance
func NewRuleEngine(db *gorm.DB) *RuleEngine {
	return &RuleEngine{db: db}
}

// LoadRules loads and compiles all active rules from the database
func (e *RuleEngine) LoadRules(ctx context.Context) error {
	var dbRules []models.AdjudicationRule
	if err := e.db.WithContext(ctx).Where("is_active = ?", true).Order("priority ASC").Find(&dbRules).Error; err != nil {
		return fmt.Errorf("failed to load rules: %w", err)
	}

	e.rules = make([]CompiledRule, 0, len(dbRules))
	for _, r := range dbRules {
		compiled, err := e.compileRule(r)
		if err != nil {
			continue // Skip invalid rules
		}
		e.rules = append(e.rules, compiled)
	}

	// Add default rules if none exist
	if len(e.rules) == 0 {
		e.rules = e.getDefaultRules()
	}

	return nil
}

// compileRule converts a database rule to a compiled rule
func (e *RuleEngine) compileRule(r models.AdjudicationRule) (CompiledRule, error) {
	var conditions []RuleCondition
	if err := json.Unmarshal([]byte(r.Condition), &conditions); err != nil {
		return CompiledRule{}, err
	}

	var action RuleAction
	if err := json.Unmarshal([]byte(r.Action), &action); err != nil {
		return CompiledRule{}, err
	}

	return CompiledRule{
		ID:          r.ID,
		Name:        r.Name,
		Priority:    r.Priority,
		Conditions:  conditions,
		Action:      action,
		ProductType: r.ProductType,
	}, nil
}

// getDefaultRules returns default adjudication rules
func (e *RuleEngine) getDefaultRules() []CompiledRule {
	return []CompiledRule{
		{
			ID:       uuid.New(),
			Name:     "High Fraud Score Escalation",
			Priority: 1,
			Conditions: []RuleCondition{
				{Field: "fraud_score", Operator: ">=", Value: 0.7},
			},
			Action: RuleAction{Type: "ESCALATE", Parameters: map[string]interface{}{"reason": "High fraud score detected"}},
		},
		{
			ID:       uuid.New(),
			Name:     "Very High Value Claim Escalation",
			Priority: 2,
			Conditions: []RuleCondition{
				{Field: "claim_amount", Operator: ">=", Value: 10000000.0},
			},
			Action: RuleAction{Type: "ESCALATE", Parameters: map[string]interface{}{"reason": "Very high value claim requires senior review"}},
		},
		{
			ID:       uuid.New(),
			Name:     "Auto-Approve Low Value Low Risk",
			Priority: 10,
			Conditions: []RuleCondition{
				{Field: "claim_amount", Operator: "<=", Value: 50000.0, Logic: "AND"},
				{Field: "fraud_score", Operator: "<", Value: 0.3, Logic: "AND"},
				{Field: "documents_verified", Operator: "==", Value: true},
			},
			Action: RuleAction{Type: "AUTO_APPROVE", Parameters: map[string]interface{}{"reason": "Low value claim with verified documents"}},
		},
		{
			ID:       uuid.New(),
			Name:     "Auto-Approve Medium Value Low Risk",
			Priority: 15,
			Conditions: []RuleCondition{
				{Field: "claim_amount", Operator: "<=", Value: 200000.0, Logic: "AND"},
				{Field: "fraud_score", Operator: "<", Value: 0.2, Logic: "AND"},
				{Field: "customer_tenure_years", Operator: ">=", Value: 2},
			},
			Action: RuleAction{Type: "AUTO_APPROVE", Parameters: map[string]interface{}{"reason": "Medium value claim from trusted customer"}},
		},
		{
			ID:       uuid.New(),
			Name:     "Reject Duplicate Claim",
			Priority: 5,
			Conditions: []RuleCondition{
				{Field: "is_duplicate", Operator: "==", Value: true},
			},
			Action: RuleAction{Type: "AUTO_REJECT", Parameters: map[string]interface{}{"reason": "Duplicate claim detected"}},
		},
		{
			ID:       uuid.New(),
			Name:     "Reject Expired Policy",
			Priority: 3,
			Conditions: []RuleCondition{
				{Field: "policy_expired", Operator: "==", Value: true},
			},
			Action: RuleAction{Type: "AUTO_REJECT", Parameters: map[string]interface{}{"reason": "Policy was not active at time of incident"}},
		},
		{
			ID:       uuid.New(),
			Name:     "Manual Review Default",
			Priority: 100,
			Conditions: []RuleCondition{
				{Field: "always", Operator: "==", Value: true},
			},
			Action: RuleAction{Type: "MANUAL_REVIEW", Parameters: map[string]interface{}{"reason": "Requires manual review"}},
		},
	}
}

// ClaimContext contains all data needed for rule evaluation
type ClaimContext struct {
	ClaimID             uuid.UUID
	ClaimAmount         float64
	FraudScore          float64
	DocumentsVerified   bool
	CustomerTenureYears int
	IsDuplicate         bool
	PolicyExpired       bool
	ClaimType           string
	ProductType         string
	IncidentDate        time.Time
	ReportedDate        time.Time
	DaysSinceIncident   int
	PreviousClaimsCount int
	CustomerRiskScore   float64
	DocumentCount       int
	HasPoliceReport     bool
	HasMedicalReport    bool
	HasPhotos           bool
	GeoRiskScore        float64
	NetworkRiskScore    float64
	MLPrediction        float64
}

// EvaluationResult contains the result of rule evaluation
type EvaluationResult struct {
	Decision     models.DecisionType
	RulesApplied []string
	Reasoning    string
	Confidence   float64
	RuleID       uuid.UUID
	RuleName     string
}

// Evaluate evaluates all rules against the claim context
func (e *RuleEngine) Evaluate(ctx ClaimContext) EvaluationResult {
	appliedRules := []string{}

	for _, rule := range e.rules {
		// Check product type match if specified
		if rule.ProductType != "" && rule.ProductType != ctx.ProductType {
			continue
		}

		if e.evaluateConditions(rule.Conditions, ctx) {
			appliedRules = append(appliedRules, rule.Name)

			decision := e.actionToDecision(rule.Action.Type)
			reason := ""
			if r, ok := rule.Action.Parameters["reason"].(string); ok {
				reason = r
			}

			return EvaluationResult{
				Decision:     decision,
				RulesApplied: appliedRules,
				Reasoning:    reason,
				Confidence:   e.calculateConfidence(ctx, rule),
				RuleID:       rule.ID,
				RuleName:     rule.Name,
			}
		}
	}

	// Default to manual review if no rules match
	return EvaluationResult{
		Decision:     models.DecisionTypeManualReview,
		RulesApplied: []string{"DEFAULT_MANUAL_REVIEW"},
		Reasoning:    "No matching rules found, requires manual review",
		Confidence:   0.5,
	}
}

// evaluateConditions evaluates all conditions in a rule
func (e *RuleEngine) evaluateConditions(conditions []RuleCondition, ctx ClaimContext) bool {
	if len(conditions) == 0 {
		return false
	}

	result := true
	for i, cond := range conditions {
		condResult := e.evaluateCondition(cond, ctx)

		if i == 0 {
			result = condResult
		} else {
			logic := strings.ToUpper(cond.Logic)
			if logic == "OR" {
				result = result || condResult
			} else {
				result = result && condResult
			}
		}
	}

	return result
}

// evaluateCondition evaluates a single condition
func (e *RuleEngine) evaluateCondition(cond RuleCondition, ctx ClaimContext) bool {
	fieldValue := e.getFieldValue(cond.Field, ctx)
	return e.compare(fieldValue, cond.Operator, cond.Value)
}

// getFieldValue gets the value of a field from the claim context
func (e *RuleEngine) getFieldValue(field string, ctx ClaimContext) interface{} {
	switch field {
	case "claim_amount":
		return ctx.ClaimAmount
	case "fraud_score":
		return ctx.FraudScore
	case "documents_verified":
		return ctx.DocumentsVerified
	case "customer_tenure_years":
		return ctx.CustomerTenureYears
	case "is_duplicate":
		return ctx.IsDuplicate
	case "policy_expired":
		return ctx.PolicyExpired
	case "claim_type":
		return ctx.ClaimType
	case "product_type":
		return ctx.ProductType
	case "days_since_incident":
		return ctx.DaysSinceIncident
	case "previous_claims_count":
		return ctx.PreviousClaimsCount
	case "customer_risk_score":
		return ctx.CustomerRiskScore
	case "document_count":
		return ctx.DocumentCount
	case "has_police_report":
		return ctx.HasPoliceReport
	case "has_medical_report":
		return ctx.HasMedicalReport
	case "has_photos":
		return ctx.HasPhotos
	case "geo_risk_score":
		return ctx.GeoRiskScore
	case "network_risk_score":
		return ctx.NetworkRiskScore
	case "ml_prediction":
		return ctx.MLPrediction
	case "always":
		return true
	default:
		return nil
	}
}

// compare compares two values using the specified operator
func (e *RuleEngine) compare(fieldValue interface{}, operator string, condValue interface{}) bool {
	switch operator {
	case "==", "=":
		return e.equals(fieldValue, condValue)
	case "!=", "<>":
		return !e.equals(fieldValue, condValue)
	case ">":
		return e.greaterThan(fieldValue, condValue)
	case ">=":
		return e.greaterThanOrEqual(fieldValue, condValue)
	case "<":
		return e.lessThan(fieldValue, condValue)
	case "<=":
		return e.lessThanOrEqual(fieldValue, condValue)
	case "contains":
		return e.contains(fieldValue, condValue)
	case "matches":
		return e.matches(fieldValue, condValue)
	case "in":
		return e.in(fieldValue, condValue)
	default:
		return false
	}
}

func (e *RuleEngine) equals(a, b interface{}) bool {
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

func (e *RuleEngine) greaterThan(a, b interface{}) bool {
	aFloat := e.toFloat(a)
	bFloat := e.toFloat(b)
	return aFloat > bFloat
}

func (e *RuleEngine) greaterThanOrEqual(a, b interface{}) bool {
	aFloat := e.toFloat(a)
	bFloat := e.toFloat(b)
	return aFloat >= bFloat
}

func (e *RuleEngine) lessThan(a, b interface{}) bool {
	aFloat := e.toFloat(a)
	bFloat := e.toFloat(b)
	return aFloat < bFloat
}

func (e *RuleEngine) lessThanOrEqual(a, b interface{}) bool {
	aFloat := e.toFloat(a)
	bFloat := e.toFloat(b)
	return aFloat <= bFloat
}

func (e *RuleEngine) contains(a, b interface{}) bool {
	aStr := fmt.Sprintf("%v", a)
	bStr := fmt.Sprintf("%v", b)
	return strings.Contains(aStr, bStr)
}

func (e *RuleEngine) matches(a, b interface{}) bool {
	aStr := fmt.Sprintf("%v", a)
	pattern := fmt.Sprintf("%v", b)
	matched, _ := regexp.MatchString(pattern, aStr)
	return matched
}

func (e *RuleEngine) in(a, b interface{}) bool {
	aStr := fmt.Sprintf("%v", a)
	if bSlice, ok := b.([]interface{}); ok {
		for _, item := range bSlice {
			if fmt.Sprintf("%v", item) == aStr {
				return true
			}
		}
	}
	return false
}

func (e *RuleEngine) toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	default:
		return 0
	}
}

func (e *RuleEngine) actionToDecision(actionType string) models.DecisionType {
	switch actionType {
	case "AUTO_APPROVE":
		return models.DecisionTypeAutoApprove
	case "AUTO_REJECT":
		return models.DecisionTypeAutoReject
	case "ESCALATE":
		return models.DecisionTypeEscalate
	default:
		return models.DecisionTypeManualReview
	}
}

func (e *RuleEngine) calculateConfidence(ctx ClaimContext, rule CompiledRule) float64 {
	// Base confidence from rule priority (higher priority = higher confidence)
	baseConfidence := 1.0 - (float64(rule.Priority) / 200.0)
	if baseConfidence < 0.5 {
		baseConfidence = 0.5
	}

	// Adjust based on data quality
	dataQuality := 0.0
	if ctx.DocumentsVerified {
		dataQuality += 0.2
	}
	if ctx.HasPoliceReport {
		dataQuality += 0.1
	}
	if ctx.HasMedicalReport {
		dataQuality += 0.1
	}
	if ctx.HasPhotos {
		dataQuality += 0.1
	}

	// Combine factors
	confidence := baseConfidence*0.6 + dataQuality*0.4
	if confidence > 1.0 {
		confidence = 1.0
	}

	return confidence
}

// CreateRule creates a new adjudication rule
func (e *RuleEngine) CreateRule(ctx context.Context, rule *models.AdjudicationRule) error {
	rule.ID = uuid.New()
	if err := e.db.WithContext(ctx).Create(rule).Error; err != nil {
		return err
	}
	// Reload rules after creation
	return e.LoadRules(ctx)
}

// UpdateRule updates an existing rule
func (e *RuleEngine) UpdateRule(ctx context.Context, rule *models.AdjudicationRule) error {
	if err := e.db.WithContext(ctx).Save(rule).Error; err != nil {
		return err
	}
	return e.LoadRules(ctx)
}

// DeleteRule soft-deletes a rule by deactivating it
func (e *RuleEngine) DeleteRule(ctx context.Context, ruleID uuid.UUID) error {
	if err := e.db.WithContext(ctx).Model(&models.AdjudicationRule{}).Where("id = ?", ruleID).Update("is_active", false).Error; err != nil {
		return err
	}
	return e.LoadRules(ctx)
}

// GetRules returns all active rules
func (e *RuleEngine) GetRules(ctx context.Context) ([]models.AdjudicationRule, error) {
	var rules []models.AdjudicationRule
	err := e.db.WithContext(ctx).Where("is_active = ?", true).Order("priority ASC").Find(&rules).Error
	return rules, err
}

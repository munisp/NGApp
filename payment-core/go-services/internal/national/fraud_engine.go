// Package national implements national payment switch components
package national

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"
)

// FraudRiskEngine provides real-time fraud detection and risk scoring
type FraudRiskEngine struct {
	db              *sql.DB
	auditLogger     *ImmutableAuditLogger
	rules           []*FraudRule
	mlScorer        MLScorer
	config          *FraudEngineConfig
	alertChan       chan *FraudAlert
	mu              sync.RWMutex
}

// FraudEngineConfig holds fraud engine configuration
type FraudEngineConfig struct {
	HighRiskThreshold    float64
	MediumRiskThreshold  float64
	AutoBlockThreshold   float64
	VelocityWindowMinutes int
	MaxTransactionsPerWindow int
	MaxAmountPerWindow   int64
	EnableMLScoring      bool
	AlertWebhookURL      string
}

// MLScorer interface for ML-based fraud scoring
type MLScorer interface {
	Score(ctx context.Context, features *TransactionFeatures) (float64, error)
}

// NewFraudRiskEngine creates a new fraud risk engine
func NewFraudRiskEngine(db *sql.DB, audit *ImmutableAuditLogger, config *FraudEngineConfig) *FraudRiskEngine {
	if config.HighRiskThreshold == 0 {
		config.HighRiskThreshold = 0.8
	}
	if config.MediumRiskThreshold == 0 {
		config.MediumRiskThreshold = 0.5
	}
	if config.AutoBlockThreshold == 0 {
		config.AutoBlockThreshold = 0.95
	}
	if config.VelocityWindowMinutes == 0 {
		config.VelocityWindowMinutes = 60
	}
	if config.MaxTransactionsPerWindow == 0 {
		config.MaxTransactionsPerWindow = 100
	}
	if config.MaxAmountPerWindow == 0 {
		config.MaxAmountPerWindow = 10000000 // 100,000 in minor units
	}

	engine := &FraudRiskEngine{
		db:          db,
		auditLogger: audit,
		config:      config,
		rules:       make([]*FraudRule, 0),
		alertChan:   make(chan *FraudAlert, 1000),
	}

	// Load default rules
	engine.loadDefaultRules()

	// Start alert processor
	go engine.processAlerts()

	return engine
}

// FraudRule represents a fraud detection rule
type FraudRule struct {
	RuleID      string          `json:"rule_id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Category    FraudCategory   `json:"category"`
	Severity    RuleSeverity    `json:"severity"`
	Enabled     bool            `json:"enabled"`
	Condition   RuleCondition   `json:"condition"`
	Action      RuleAction      `json:"action"`
	Score       float64         `json:"score"` // Score contribution if triggered
}

// FraudCategory defines the category of fraud
type FraudCategory string

const (
	FraudCategoryVelocity       FraudCategory = "VELOCITY"
	FraudCategoryAmount         FraudCategory = "AMOUNT"
	FraudCategoryPattern        FraudCategory = "PATTERN"
	FraudCategoryGeolocation    FraudCategory = "GEOLOCATION"
	FraudCategoryBehavior       FraudCategory = "BEHAVIOR"
	FraudCategoryIdentity       FraudCategory = "IDENTITY"
	FraudCategorySanctions      FraudCategory = "SANCTIONS"
	FraudCategoryStructuring    FraudCategory = "STRUCTURING"
)

// RuleSeverity defines the severity of a rule
type RuleSeverity string

const (
	RuleSeverityLow      RuleSeverity = "LOW"
	RuleSeverityMedium   RuleSeverity = "MEDIUM"
	RuleSeverityHigh     RuleSeverity = "HIGH"
	RuleSeverityCritical RuleSeverity = "CRITICAL"
)

// RuleCondition defines the condition for a rule
type RuleCondition struct {
	Type       string                 `json:"type"`
	Parameters map[string]interface{} `json:"parameters"`
}

// RuleAction defines the action to take when a rule triggers
type RuleAction string

const (
	RuleActionAllow     RuleAction = "ALLOW"
	RuleActionFlag      RuleAction = "FLAG"
	RuleActionHold      RuleAction = "HOLD"
	RuleActionBlock     RuleAction = "BLOCK"
	RuleActionStepUp    RuleAction = "STEP_UP"
	RuleActionReview    RuleAction = "REVIEW"
)

// TransactionFeatures holds features for fraud scoring
type TransactionFeatures struct {
	TransferID        string    `json:"transfer_id"`
	PayerFSP          string    `json:"payer_fsp"`
	PayeeFSP          string    `json:"payee_fsp"`
	PayerAccount      string    `json:"payer_account"`
	PayeeAccount      string    `json:"payee_account"`
	Amount            int64     `json:"amount"`
	Currency          string    `json:"currency"`
	Timestamp         time.Time `json:"timestamp"`
	
	// Derived features
	HourOfDay         int       `json:"hour_of_day"`
	DayOfWeek         int       `json:"day_of_week"`
	IsWeekend         bool      `json:"is_weekend"`
	IsBusinessHours   bool      `json:"is_business_hours"`
	
	// Historical features
	PayerTxCount24h   int       `json:"payer_tx_count_24h"`
	PayerTxAmount24h  int64     `json:"payer_tx_amount_24h"`
	PayerAvgAmount    float64   `json:"payer_avg_amount"`
	PayerStdAmount    float64   `json:"payer_std_amount"`
	PayeeTxCount24h   int       `json:"payee_tx_count_24h"`
	PayeeNewAccount   bool      `json:"payee_new_account"`
	
	// Relationship features
	FirstTimePair     bool      `json:"first_time_pair"`
	PairTxCount       int       `json:"pair_tx_count"`
	
	// Risk indicators
	HighRiskCountry   bool      `json:"high_risk_country"`
	SanctionsMatch    bool      `json:"sanctions_match"`
	PEPMatch          bool      `json:"pep_match"`
}

// FraudCheckResult holds the result of a fraud check
type FraudCheckResult struct {
	TransferID      string          `json:"transfer_id"`
	RiskScore       float64         `json:"risk_score"`
	RiskLevel       RiskLevel       `json:"risk_level"`
	Decision        FraudDecision   `json:"decision"`
	TriggeredRules  []*TriggeredRule `json:"triggered_rules"`
	MLScore         *float64        `json:"ml_score,omitempty"`
	Reasons         []string        `json:"reasons"`
	RequiresReview  bool            `json:"requires_review"`
	CheckedAt       time.Time       `json:"checked_at"`
}

// RiskLevel defines the risk level
type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "LOW"
	RiskLevelMedium   RiskLevel = "MEDIUM"
	RiskLevelHigh     RiskLevel = "HIGH"
	RiskLevelCritical RiskLevel = "CRITICAL"
)

// FraudDecision defines the fraud decision
type FraudDecision string

const (
	FraudDecisionApprove FraudDecision = "APPROVE"
	FraudDecisionHold    FraudDecision = "HOLD"
	FraudDecisionBlock   FraudDecision = "BLOCK"
	FraudDecisionReview  FraudDecision = "REVIEW"
)

// TriggeredRule represents a rule that was triggered
type TriggeredRule struct {
	RuleID      string       `json:"rule_id"`
	RuleName    string       `json:"rule_name"`
	Category    FraudCategory `json:"category"`
	Severity    RuleSeverity `json:"severity"`
	Score       float64      `json:"score"`
	Details     string       `json:"details"`
}

// FraudAlert represents a fraud alert
type FraudAlert struct {
	AlertID         string          `json:"alert_id"`
	TransferID      string          `json:"transfer_id"`
	ParticipantID   string          `json:"participant_id"`
	AlertType       string          `json:"alert_type"`
	RiskScore       float64         `json:"risk_score"`
	RiskLevel       RiskLevel       `json:"risk_level"`
	TriggeredRules  []*TriggeredRule `json:"triggered_rules"`
	Status          AlertStatus     `json:"status"`
	CreatedAt       time.Time       `json:"created_at"`
	AssignedTo      string          `json:"assigned_to,omitempty"`
	ResolvedAt      *time.Time      `json:"resolved_at,omitempty"`
	Resolution      string          `json:"resolution,omitempty"`
}

// AlertStatus defines the status of an alert
type AlertStatus string

const (
	AlertStatusOpen       AlertStatus = "OPEN"
	AlertStatusAssigned   AlertStatus = "ASSIGNED"
	AlertStatusInProgress AlertStatus = "IN_PROGRESS"
	AlertStatusResolved   AlertStatus = "RESOLVED"
	AlertStatusFalsePositive AlertStatus = "FALSE_POSITIVE"
	AlertStatusEscalated  AlertStatus = "ESCALATED"
)

// CheckTransaction performs fraud check on a transaction
func (e *FraudRiskEngine) CheckTransaction(ctx context.Context, features *TransactionFeatures) (*FraudCheckResult, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := &FraudCheckResult{
		TransferID:     features.TransferID,
		TriggeredRules: make([]*TriggeredRule, 0),
		Reasons:        make([]string, 0),
		CheckedAt:      time.Now().UTC(),
	}

	// Enrich features with historical data
	if err := e.enrichFeatures(ctx, features); err != nil {
		// Log but continue with available features
		fmt.Printf("WARNING: Failed to enrich features: %v\n", err)
	}

	// Apply rules
	var totalScore float64
	for _, rule := range e.rules {
		if !rule.Enabled {
			continue
		}

		triggered, details := e.evaluateRule(ctx, rule, features)
		if triggered {
			totalScore += rule.Score
			result.TriggeredRules = append(result.TriggeredRules, &TriggeredRule{
				RuleID:   rule.RuleID,
				RuleName: rule.Name,
				Category: rule.Category,
				Severity: rule.Severity,
				Score:    rule.Score,
				Details:  details,
			})
			result.Reasons = append(result.Reasons, details)
		}
	}

	// Apply ML scoring if enabled
	if e.config.EnableMLScoring && e.mlScorer != nil {
		mlScore, err := e.mlScorer.Score(ctx, features)
		if err == nil {
			result.MLScore = &mlScore
			// Combine rule score with ML score (weighted average)
			totalScore = (totalScore * 0.6) + (mlScore * 0.4)
		}
	}

	// Normalize score to 0-1
	result.RiskScore = math.Min(totalScore, 1.0)

	// Determine risk level
	if result.RiskScore >= e.config.HighRiskThreshold {
		result.RiskLevel = RiskLevelHigh
	} else if result.RiskScore >= e.config.MediumRiskThreshold {
		result.RiskLevel = RiskLevelMedium
	} else {
		result.RiskLevel = RiskLevelLow
	}

	// Check for critical rules
	for _, tr := range result.TriggeredRules {
		if tr.Severity == RuleSeverityCritical {
			result.RiskLevel = RiskLevelCritical
			break
		}
	}

	// Determine decision
	if result.RiskScore >= e.config.AutoBlockThreshold {
		result.Decision = FraudDecisionBlock
	} else if result.RiskLevel == RiskLevelCritical {
		result.Decision = FraudDecisionBlock
	} else if result.RiskLevel == RiskLevelHigh {
		result.Decision = FraudDecisionHold
		result.RequiresReview = true
	} else if result.RiskLevel == RiskLevelMedium {
		result.Decision = FraudDecisionReview
		result.RequiresReview = true
	} else {
		result.Decision = FraudDecisionApprove
	}

	// Save result
	if err := e.saveCheckResult(ctx, result); err != nil {
		fmt.Printf("WARNING: Failed to save fraud check result: %v\n", err)
	}

	// Create alert if needed
	if result.RequiresReview || result.Decision == FraudDecisionBlock {
		alert := &FraudAlert{
			AlertID:        generateEventID(),
			TransferID:     features.TransferID,
			ParticipantID:  features.PayerFSP,
			AlertType:      string(result.RiskLevel),
			RiskScore:      result.RiskScore,
			RiskLevel:      result.RiskLevel,
			TriggeredRules: result.TriggeredRules,
			Status:         AlertStatusOpen,
			CreatedAt:      time.Now().UTC(),
		}
		e.alertChan <- alert
	}

	return result, nil
}

// enrichFeatures enriches transaction features with historical data
func (e *FraudRiskEngine) enrichFeatures(ctx context.Context, features *TransactionFeatures) error {
	// Set time-based features
	features.HourOfDay = features.Timestamp.Hour()
	features.DayOfWeek = int(features.Timestamp.Weekday())
	features.IsWeekend = features.DayOfWeek == 0 || features.DayOfWeek == 6
	features.IsBusinessHours = features.HourOfDay >= 9 && features.HourOfDay <= 17

	// Get payer transaction history (last 24 hours)
	windowStart := features.Timestamp.Add(-24 * time.Hour)
	row := e.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(amount), 0), COALESCE(AVG(amount), 0), COALESCE(STDDEV(amount), 0)
		FROM mojaloop_transfers
		WHERE payer_fsp = $1 AND created_at >= $2 AND created_at < $3
	`, features.PayerFSP, windowStart, features.Timestamp)

	err := row.Scan(&features.PayerTxCount24h, &features.PayerTxAmount24h, &features.PayerAvgAmount, &features.PayerStdAmount)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Get payee transaction history
	row = e.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM mojaloop_transfers
		WHERE payee_fsp = $1 AND created_at >= $2 AND created_at < $3
	`, features.PayeeFSP, windowStart, features.Timestamp)
	row.Scan(&features.PayeeTxCount24h)

	// Check if payee is new (first transaction in last 30 days)
	row = e.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM mojaloop_transfers
		WHERE payee_fsp = $1 AND created_at >= $2
	`, features.PayeeFSP, features.Timestamp.Add(-30*24*time.Hour))
	var payeeHistoryCount int
	row.Scan(&payeeHistoryCount)
	features.PayeeNewAccount = payeeHistoryCount == 0

	// Check if first time pair
	row = e.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM mojaloop_transfers
		WHERE payer_fsp = $1 AND payee_fsp = $2 AND created_at < $3
	`, features.PayerFSP, features.PayeeFSP, features.Timestamp)
	row.Scan(&features.PairTxCount)
	features.FirstTimePair = features.PairTxCount == 0

	return nil
}

// evaluateRule evaluates a single rule against transaction features
func (e *FraudRiskEngine) evaluateRule(ctx context.Context, rule *FraudRule, features *TransactionFeatures) (bool, string) {
	switch rule.Condition.Type {
	case "velocity_count":
		threshold := int(rule.Condition.Parameters["threshold"].(float64))
		if features.PayerTxCount24h > threshold {
			return true, fmt.Sprintf("Transaction count %d exceeds threshold %d", features.PayerTxCount24h, threshold)
		}

	case "velocity_amount":
		threshold := int64(rule.Condition.Parameters["threshold"].(float64))
		if features.PayerTxAmount24h > threshold {
			return true, fmt.Sprintf("Transaction amount %d exceeds threshold %d", features.PayerTxAmount24h, threshold)
		}

	case "large_amount":
		threshold := int64(rule.Condition.Parameters["threshold"].(float64))
		if features.Amount > threshold {
			return true, fmt.Sprintf("Amount %d exceeds large transaction threshold %d", features.Amount, threshold)
		}

	case "unusual_amount":
		if features.PayerStdAmount > 0 {
			zScore := math.Abs(float64(features.Amount)-features.PayerAvgAmount) / features.PayerStdAmount
			threshold := rule.Condition.Parameters["z_score_threshold"].(float64)
			if zScore > threshold {
				return true, fmt.Sprintf("Amount deviates %.2f standard deviations from average", zScore)
			}
		}

	case "new_payee":
		if features.PayeeNewAccount {
			return true, "Payee is a new account"
		}

	case "first_time_pair":
		if features.FirstTimePair {
			return true, "First transaction between this payer and payee"
		}

	case "off_hours":
		if !features.IsBusinessHours {
			return true, fmt.Sprintf("Transaction at unusual hour: %d", features.HourOfDay)
		}

	case "weekend":
		if features.IsWeekend {
			return true, "Transaction on weekend"
		}

	case "structuring":
		// Check for structuring (multiple transactions just below threshold)
		threshold := int64(rule.Condition.Parameters["threshold"].(float64))
		margin := int64(rule.Condition.Parameters["margin"].(float64))
		if features.Amount >= threshold-margin && features.Amount < threshold {
			return true, fmt.Sprintf("Amount %d is just below reporting threshold %d", features.Amount, threshold)
		}

	case "rapid_succession":
		// Check for rapid succession of transactions
		windowMinutes := int(rule.Condition.Parameters["window_minutes"].(float64))
		maxCount := int(rule.Condition.Parameters["max_count"].(float64))
		
		var recentCount int
		windowStart := features.Timestamp.Add(-time.Duration(windowMinutes) * time.Minute)
		e.db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM mojaloop_transfers
			WHERE payer_fsp = $1 AND created_at >= $2 AND created_at < $3
		`, features.PayerFSP, windowStart, features.Timestamp).Scan(&recentCount)
		
		if recentCount >= maxCount {
			return true, fmt.Sprintf("%d transactions in last %d minutes", recentCount, windowMinutes)
		}

	case "sanctions_match":
		if features.SanctionsMatch {
			return true, "Sanctions list match detected"
		}

	case "pep_match":
		if features.PEPMatch {
			return true, "Politically Exposed Person match detected"
		}

	case "high_risk_country":
		if features.HighRiskCountry {
			return true, "Transaction involves high-risk country"
		}
	}

	return false, ""
}

// loadDefaultRules loads default fraud detection rules
func (e *FraudRiskEngine) loadDefaultRules() {
	e.rules = []*FraudRule{
		{
			RuleID:      "VEL001",
			Name:        "High Transaction Velocity",
			Description: "Flags accounts with unusually high transaction count",
			Category:    FraudCategoryVelocity,
			Severity:    RuleSeverityMedium,
			Enabled:     true,
			Condition:   RuleCondition{Type: "velocity_count", Parameters: map[string]interface{}{"threshold": 50.0}},
			Action:      RuleActionFlag,
			Score:       0.3,
		},
		{
			RuleID:      "VEL002",
			Name:        "High Amount Velocity",
			Description: "Flags accounts with unusually high transaction volume",
			Category:    FraudCategoryVelocity,
			Severity:    RuleSeverityHigh,
			Enabled:     true,
			Condition:   RuleCondition{Type: "velocity_amount", Parameters: map[string]interface{}{"threshold": 5000000.0}},
			Action:      RuleActionHold,
			Score:       0.4,
		},
		{
			RuleID:      "AMT001",
			Name:        "Large Transaction",
			Description: "Flags large transactions for review",
			Category:    FraudCategoryAmount,
			Severity:    RuleSeverityMedium,
			Enabled:     true,
			Condition:   RuleCondition{Type: "large_amount", Parameters: map[string]interface{}{"threshold": 1000000.0}},
			Action:      RuleActionReview,
			Score:       0.2,
		},
		{
			RuleID:      "AMT002",
			Name:        "Unusual Amount",
			Description: "Flags transactions with unusual amounts for the account",
			Category:    FraudCategoryAmount,
			Severity:    RuleSeverityMedium,
			Enabled:     true,
			Condition:   RuleCondition{Type: "unusual_amount", Parameters: map[string]interface{}{"z_score_threshold": 3.0}},
			Action:      RuleActionFlag,
			Score:       0.25,
		},
		{
			RuleID:      "PAT001",
			Name:        "New Payee",
			Description: "Flags transactions to new payees",
			Category:    FraudCategoryPattern,
			Severity:    RuleSeverityLow,
			Enabled:     true,
			Condition:   RuleCondition{Type: "new_payee", Parameters: map[string]interface{}{}},
			Action:      RuleActionFlag,
			Score:       0.1,
		},
		{
			RuleID:      "PAT002",
			Name:        "First Time Pair",
			Description: "Flags first-time transactions between parties",
			Category:    FraudCategoryPattern,
			Severity:    RuleSeverityLow,
			Enabled:     true,
			Condition:   RuleCondition{Type: "first_time_pair", Parameters: map[string]interface{}{}},
			Action:      RuleActionFlag,
			Score:       0.1,
		},
		{
			RuleID:      "BEH001",
			Name:        "Off-Hours Transaction",
			Description: "Flags transactions outside business hours",
			Category:    FraudCategoryBehavior,
			Severity:    RuleSeverityLow,
			Enabled:     true,
			Condition:   RuleCondition{Type: "off_hours", Parameters: map[string]interface{}{}},
			Action:      RuleActionFlag,
			Score:       0.05,
		},
		{
			RuleID:      "STR001",
			Name:        "Structuring Detection",
			Description: "Detects potential structuring to avoid reporting thresholds",
			Category:    FraudCategoryStructuring,
			Severity:    RuleSeverityHigh,
			Enabled:     true,
			Condition:   RuleCondition{Type: "structuring", Parameters: map[string]interface{}{"threshold": 1000000.0, "margin": 100000.0}},
			Action:      RuleActionHold,
			Score:       0.5,
		},
		{
			RuleID:      "RAP001",
			Name:        "Rapid Succession",
			Description: "Detects rapid succession of transactions",
			Category:    FraudCategoryVelocity,
			Severity:    RuleSeverityHigh,
			Enabled:     true,
			Condition:   RuleCondition{Type: "rapid_succession", Parameters: map[string]interface{}{"window_minutes": 5.0, "max_count": 10.0}},
			Action:      RuleActionHold,
			Score:       0.4,
		},
		{
			RuleID:      "SAN001",
			Name:        "Sanctions Match",
			Description: "Blocks transactions with sanctions list matches",
			Category:    FraudCategorySanctions,
			Severity:    RuleSeverityCritical,
			Enabled:     true,
			Condition:   RuleCondition{Type: "sanctions_match", Parameters: map[string]interface{}{}},
			Action:      RuleActionBlock,
			Score:       1.0,
		},
		{
			RuleID:      "PEP001",
			Name:        "PEP Match",
			Description: "Flags transactions involving Politically Exposed Persons",
			Category:    FraudCategoryIdentity,
			Severity:    RuleSeverityHigh,
			Enabled:     true,
			Condition:   RuleCondition{Type: "pep_match", Parameters: map[string]interface{}{}},
			Action:      RuleActionReview,
			Score:       0.4,
		},
	}
}

// AddRule adds a custom fraud rule
func (e *FraudRiskEngine) AddRule(rule *FraudRule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Check for duplicate
	for _, r := range e.rules {
		if r.RuleID == rule.RuleID {
			return fmt.Errorf("rule %s already exists", rule.RuleID)
		}
	}

	e.rules = append(e.rules, rule)

	// Audit log
	if e.auditLogger != nil {
		e.auditLogger.Log(context.Background(), &AuditEvent{
			EventType: AuditEventRuleCreated,
			Severity:  AuditSeverityInfo,
			Actor:     &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Fraud Engine"},
			Subject:   &AuditSubject{SubjectID: rule.RuleID, SubjectType: "FRAUD_RULE", SubjectName: rule.Name},
			Action:    "Created fraud detection rule",
			Details:   map[string]interface{}{"category": rule.Category, "severity": rule.Severity},
		})
	}

	return nil
}

// UpdateRule updates an existing fraud rule
func (e *FraudRiskEngine) UpdateRule(rule *FraudRule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for i, r := range e.rules {
		if r.RuleID == rule.RuleID {
			oldRule := e.rules[i]
			e.rules[i] = rule

			// Audit log
			if e.auditLogger != nil {
				e.auditLogger.Log(context.Background(), &AuditEvent{
					EventType:     AuditEventRuleUpdated,
					Severity:      AuditSeverityInfo,
					Actor:         &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Fraud Engine"},
					Subject:       &AuditSubject{SubjectID: rule.RuleID, SubjectType: "FRAUD_RULE", SubjectName: rule.Name},
					Action:        "Updated fraud detection rule",
					PreviousState: map[string]interface{}{"enabled": oldRule.Enabled, "score": oldRule.Score},
					NewState:      map[string]interface{}{"enabled": rule.Enabled, "score": rule.Score},
				})
			}

			return nil
		}
	}

	return fmt.Errorf("rule %s not found", rule.RuleID)
}

// DisableRule disables a fraud rule
func (e *FraudRiskEngine) DisableRule(ruleID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, r := range e.rules {
		if r.RuleID == ruleID {
			r.Enabled = false

			// Audit log
			if e.auditLogger != nil {
				e.auditLogger.Log(context.Background(), &AuditEvent{
					EventType: AuditEventRuleUpdated,
					Severity:  AuditSeverityWarning,
					Actor:     &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Fraud Engine"},
					Subject:   &AuditSubject{SubjectID: ruleID, SubjectType: "FRAUD_RULE", SubjectName: r.Name},
					Action:    "Disabled fraud detection rule",
				})
			}

			return nil
		}
	}

	return fmt.Errorf("rule %s not found", ruleID)
}

// GetAlerts retrieves fraud alerts with filtering
func (e *FraudRiskEngine) GetAlerts(ctx context.Context, filter *AlertFilter) ([]*FraudAlert, error) {
	query := `
		SELECT alert_id, transfer_id, participant_id, alert_type, risk_score,
		       risk_level, triggered_rules, status, created_at, assigned_to,
		       resolved_at, resolution
		FROM fraud_alerts WHERE 1=1
	`
	var args []interface{}
	argIndex := 1

	if filter.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, string(filter.Status))
		argIndex++
	}

	if filter.ParticipantID != "" {
		query += fmt.Sprintf(" AND participant_id = $%d", argIndex)
		args = append(args, filter.ParticipantID)
		argIndex++
	}

	if filter.RiskLevel != "" {
		query += fmt.Sprintf(" AND risk_level = $%d", argIndex)
		args = append(args, string(filter.RiskLevel))
		argIndex++
	}

	if !filter.StartTime.IsZero() {
		query += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, filter.StartTime)
		argIndex++
	}

	if !filter.EndTime.IsZero() {
		query += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, filter.EndTime)
		argIndex++
	}

	query += " ORDER BY created_at DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", filter.Limit)
	}

	rows, err := e.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []*FraudAlert
	for rows.Next() {
		alert := &FraudAlert{}
		var riskLevel, status string
		var triggeredRulesJSON []byte
		var assignedTo sql.NullString
		var resolvedAt sql.NullTime
		var resolution sql.NullString

		err := rows.Scan(
			&alert.AlertID, &alert.TransferID, &alert.ParticipantID, &alert.AlertType,
			&alert.RiskScore, &riskLevel, &triggeredRulesJSON, &status, &alert.CreatedAt,
			&assignedTo, &resolvedAt, &resolution,
		)
		if err != nil {
			continue
		}

		alert.RiskLevel = RiskLevel(riskLevel)
		alert.Status = AlertStatus(status)
		json.Unmarshal(triggeredRulesJSON, &alert.TriggeredRules)

		if assignedTo.Valid {
			alert.AssignedTo = assignedTo.String
		}
		if resolvedAt.Valid {
			alert.ResolvedAt = &resolvedAt.Time
		}
		if resolution.Valid {
			alert.Resolution = resolution.String
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// AlertFilter defines filters for querying alerts
type AlertFilter struct {
	Status        AlertStatus
	ParticipantID string
	RiskLevel     RiskLevel
	StartTime     time.Time
	EndTime       time.Time
	Limit         int
}

// ResolveAlert resolves a fraud alert
func (e *FraudRiskEngine) ResolveAlert(ctx context.Context, alertID string, resolution string, isFalsePositive bool) error {
	status := AlertStatusResolved
	if isFalsePositive {
		status = AlertStatusFalsePositive
	}

	now := time.Now()
	_, err := e.db.ExecContext(ctx, `
		UPDATE fraud_alerts SET status = $1, resolved_at = $2, resolution = $3
		WHERE alert_id = $4
	`, string(status), now, resolution, alertID)

	// Audit log
	if e.auditLogger != nil {
		e.auditLogger.Log(ctx, &AuditEvent{
			EventType: AuditEventType("FRAUD_ALERT_RESOLVED"),
			Severity:  AuditSeverityInfo,
			Actor:     &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Fraud Engine"},
			Subject:   &AuditSubject{SubjectID: alertID, SubjectType: "FRAUD_ALERT", SubjectName: "Alert"},
			Action:    "Resolved fraud alert",
			Details:   map[string]interface{}{"resolution": resolution, "false_positive": isFalsePositive},
		})
	}

	return err
}

// processAlerts processes fraud alerts in the background
func (e *FraudRiskEngine) processAlerts() {
	for alert := range e.alertChan {
		ctx := context.Background()

		// Save alert to database
		triggeredRulesJSON, _ := json.Marshal(alert.TriggeredRules)
		_, err := e.db.ExecContext(ctx, `
			INSERT INTO fraud_alerts (
				alert_id, transfer_id, participant_id, alert_type, risk_score,
				risk_level, triggered_rules, status, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, alert.AlertID, alert.TransferID, alert.ParticipantID, alert.AlertType,
			alert.RiskScore, string(alert.RiskLevel), triggeredRulesJSON,
			string(alert.Status), alert.CreatedAt)

		if err != nil {
			fmt.Printf("ERROR: Failed to save fraud alert: %v\n", err)
			continue
		}

		// Audit log
		if e.auditLogger != nil {
			e.auditLogger.Log(ctx, &AuditEvent{
				EventType: AuditEventType("FRAUD_ALERT_CREATED"),
				Severity:  AuditSeverityWarning,
				Actor:     &AuditActor{ActorID: "SYSTEM", ActorType: "SYSTEM", ActorName: "Fraud Engine"},
				Subject:   &AuditSubject{SubjectID: alert.AlertID, SubjectType: "FRAUD_ALERT", SubjectName: "Alert"},
				Action:    "Created fraud alert",
				Details:   map[string]interface{}{"risk_score": alert.RiskScore, "risk_level": alert.RiskLevel},
			})
		}

		// Send webhook notification if configured
		if e.config.AlertWebhookURL != "" {
			// In production, send HTTP POST to webhook URL
		}
	}
}

// saveCheckResult saves a fraud check result
func (e *FraudRiskEngine) saveCheckResult(ctx context.Context, result *FraudCheckResult) error {
	triggeredRulesJSON, _ := json.Marshal(result.TriggeredRules)
	reasonsJSON, _ := json.Marshal(result.Reasons)

	_, err := e.db.ExecContext(ctx, `
		INSERT INTO fraud_check_results (
			transfer_id, risk_score, risk_level, decision, triggered_rules,
			ml_score, reasons, requires_review, checked_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, result.TransferID, result.RiskScore, string(result.RiskLevel), string(result.Decision),
		triggeredRulesJSON, result.MLScore, reasonsJSON, result.RequiresReview, result.CheckedAt)

	return err
}

// FraudEngineSchema returns the PostgreSQL schema for fraud tables
func FraudEngineSchema() string {
	return `
-- Fraud check results table
CREATE TABLE IF NOT EXISTS fraud_check_results (
    id SERIAL PRIMARY KEY,
    transfer_id VARCHAR(64) NOT NULL,
    risk_score DECIMAL(5,4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    decision VARCHAR(20) NOT NULL,
    triggered_rules JSONB,
    ml_score DECIMAL(5,4),
    reasons JSONB,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for transfer lookups
CREATE INDEX IF NOT EXISTS idx_fraud_check_results_transfer 
ON fraud_check_results(transfer_id);

-- Index for risk level queries
CREATE INDEX IF NOT EXISTS idx_fraud_check_results_risk 
ON fraud_check_results(risk_level, checked_at DESC);

-- Fraud alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    transfer_id VARCHAR(64),
    participant_id VARCHAR(128),
    alert_type VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5,4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    triggered_rules JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    assigned_to VARCHAR(128),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status 
ON fraud_alerts(status, created_at DESC);

-- Index for participant queries
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_participant 
ON fraud_alerts(participant_id, created_at DESC);

-- Fraud rules table (for custom rules)
CREATE TABLE IF NOT EXISTS fraud_rules (
    rule_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    condition JSONB NOT NULL,
    action VARCHAR(20) NOT NULL,
    score DECIMAL(5,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for enabled rules
CREATE INDEX IF NOT EXISTS idx_fraud_rules_enabled 
ON fraud_rules(enabled, category);
`
}

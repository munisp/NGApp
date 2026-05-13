package rules

import (
	"context"
	"fmt"
	"time"

	"github.com/expr-lang/expr"
	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// RuleResult represents the result of evaluating a rule
type RuleResult struct {
	Rule      *models.FraudDetectionRule
	Triggered bool
	Error     error
}

// RuleEngine handles rule evaluation for fraud detection
type RuleEngine struct {
	db          *gorm.DB
	redisClient *redis.Client
	logger      *zap.SugaredLogger
	rules       []*models.FraudDetectionRule
	compiledExpressions map[string]expr.Node
}

// NewRuleEngine creates a new rule engine
func NewRuleEngine(db *gorm.DB, redisClient *redis.Client, logger *zap.SugaredLogger) *RuleEngine {
	return &RuleEngine{
		db:          db,
		redisClient: redisClient,
		logger:      logger,
		rules:       make([]*models.FraudDetectionRule, 0),
		compiledExpressions: make(map[string]expr.Node),
	}
}

// LoadRules loads all active rules from the database
func (e *RuleEngine) LoadRules(ctx context.Context) error {
	var rules []*models.FraudDetectionRule
	result := e.db.Where("enabled = ?", true).Find(&rules)
	if result.Error != nil {
		return fmt.Errorf("failed to load rules: %w", result.Error)
	}

	// Compile expressions for all rules
	for _, rule := range rules {
		compiledExpr, err := expr.Compile(rule.Condition)
		if err != nil {
			e.logger.Warnf("Failed to compile rule %s: %v", rule.ID, err)
			continue
		}
		e.compiledExpressions[rule.ID] = compiledExpr
	}

	e.rules = rules
	e.logger.Infof("Loaded %d rules", len(rules))
	return nil
}

// EvaluateRules evaluates all rules for a transaction
func (e *RuleEngine) EvaluateRules(ctx context.Context, transaction *models.Transaction, customer *models.Customer, history []models.Transaction) ([]*RuleResult, error) {
	results := make([]*RuleResult, 0, len(e.rules))

	// Create evaluation context
	evalContext := map[string]interface{}{
		"transaction": transaction,
		"customer":    customer,
		"history":     history,
		"now":         time.Now(),
	}

	// Add risk factors to context
	riskFactors, err := e.calculateRiskFactors(transaction, customer, history)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate risk factors: %w", err)
	}
	evalContext["risk_factors"] = riskFactors

	// Evaluate each rule
	for _, rule := range e.rules {
		// Skip if rule is disabled
		if !rule.Enabled {
			continue
		}

		// Check if rule result is cached
		cacheKey := fmt.Sprintf("rule:%s:tx:%s", rule.ID, transaction.ID)
		cachedResult, err := e.redisClient.Get(ctx, cacheKey).Result()
		if err == nil && cachedResult != "" {
			// Use cached result
			results = append(results, &RuleResult{
				Rule:      rule,
				Triggered: cachedResult == "true",
				Error:     nil,
			})
			continue
		}

		// Evaluate rule
		start := time.Now()
		result, err := e.evaluateRule(rule, evalContext)
		duration := time.Since(start)

		// Log slow rule evaluations
		if duration > 50*time.Millisecond {
			e.logger.Warnf("Slow rule evaluation: %s took %v", rule.ID, duration)
		}

		// Cache result for 5 minutes
		if err == nil {
			e.redisClient.Set(ctx, cacheKey, fmt.Sprintf("%t", result), 5*time.Minute)
		}

		results = append(results, &RuleResult{
			Rule:      rule,
			Triggered: result,
			Error:     err,
		})
	}

	return results, nil
}

// evaluateRule evaluates a single rule
func (e *RuleEngine) evaluateRule(rule *models.FraudDetectionRule, context map[string]interface{}) (bool, error) {
	// Get compiled expression
	compiledExpr, ok := e.compiledExpressions[rule.ID]
	if !ok {
		// Compile expression if not already compiled
		var err error
		compiledExpr, err = expr.Compile(rule.Condition)
		if err != nil {
			return false, fmt.Errorf("failed to compile rule: %w", err)
		}
		e.compiledExpressions[rule.ID] = compiledExpr
	}

	// Evaluate expression
	result, err := expr.Run(compiledExpr, context)
	if err != nil {
		return false, fmt.Errorf("failed to evaluate rule: %w", err)
	}

	// Convert result to boolean
	boolResult, ok := result.(bool)
	if !ok {
		return false, fmt.Errorf("rule did not return a boolean result")
	}

	return boolResult, nil
}

// calculateRiskFactors calculates risk factors for a transaction
func (e *RuleEngine) calculateRiskFactors(transaction *models.Transaction, customer *models.Customer, history []models.Transaction) (map[string]float64, error) {
	// Location-based risk factors
	usualLocations := make(map[string]bool)
	for _, loc := range customer.UsualLocations {
		usualLocations[loc] = true
	}
	for _, tx := range history {
		usualLocations[tx.Location] = true
	}
	locationRisk := 0.8
	if usualLocations[transaction.Location] {
		locationRisk = 0.1
	}

	// Amount-based risk factors
	avgAmount := 0.0
	if len(history) > 0 {
		totalAmount := 0.0
		for _, tx := range history {
			totalAmount += tx.Amount
		}
		avgAmount = totalAmount / float64(len(history))
	}
	amountRisk := 0.5
	if avgAmount > 0 {
		amountRisk = transaction.Amount / (avgAmount * 3)
		if amountRisk > 1.0 {
			amountRisk = 1.0
		}
	}

	// Time-based risk factors
	txHour := transaction.Timestamp.Hour()
	unusualHour := txHour < 6 || txHour > 22 // Transactions between 10pm and 6am
	timeRisk := 0.1
	if unusualHour {
		timeRisk = 0.7
	}

	// Frequency-based risk factors
	recentCount := 0
	for _, tx := range history {
		if transaction.Timestamp.Sub(tx.Timestamp) < time.Hour {
			recentCount++
		}
	}
	frequencyRisk := float64(recentCount) / 5.0 // More than 5 transactions per hour is risky
	if frequencyRisk > 1.0 {
		frequencyRisk = 1.0
	}

	// Merchant-based risk factors
	merchantRisk := 0.8
	for _, tx := range history {
		if tx.Merchant == transaction.Merchant {
			merchantRisk = 0.1
			break
		}
	}

	// Channel-based risk factors
	channelRisk := 0.5
	channelCounts := make(map[string]int)
	for _, tx := range history {
		channelCounts[tx.Channel]++
	}
	if channelCounts[transaction.Channel] > 0 {
		channelRisk = 0.1
	}

	// Device-based risk factors
	deviceRisk := 0.7
	for _, tx := range history {
		if tx.DeviceID == transaction.DeviceID && tx.DeviceID != "" {
			deviceRisk = 0.1
			break
		}
	}

	// IP-based risk factors
	ipRisk := 0.7
	for _, tx := range history {
		if tx.IPAddress == transaction.IPAddress && tx.IPAddress != "" {
			ipRisk = 0.1
			break
		}
	}

	// Overall risk
	overallRisk := (locationRisk + amountRisk + timeRisk + frequencyRisk + merchantRisk + channelRisk + deviceRisk + ipRisk) / 8.0

	return map[string]float64{
		"location_risk":  locationRisk,
		"amount_risk":    amountRisk,
		"time_risk":      timeRisk,
		"frequency_risk": frequencyRisk,
		"merchant_risk":  merchantRisk,
		"channel_risk":   channelRisk,
		"device_risk":    deviceRisk,
		"ip_risk":        ipRisk,
		"overall_risk":   overallRisk,
	}, nil
}

// GetRule gets a rule by ID
func (e *RuleEngine) GetRule(id string) *models.FraudDetectionRule {
	for _, rule := range e.rules {
		if rule.ID == id {
			return rule
		}
	}
	return nil
}

// RefreshRules refreshes the rules from the database
func (e *RuleEngine) RefreshRules(ctx context.Context) error {
	return e.LoadRules(ctx)
}


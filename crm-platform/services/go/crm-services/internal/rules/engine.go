package rules

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/fraud"
)

// FraudDetectionResult represents the result of a fraud detection evaluation
type FraudDetectionResult struct {
	TransactionID  string   `json:"transaction_id"`
	CustomerID     string   `json:"customer_id"`
	RiskScore      float64  `json:"risk_score"`
	Action         string   `json:"action"`
	TriggeredRules []string `json:"triggered_rules"`
	MLPrediction   bool     `json:"ml_prediction"`
	MLProbability  float64  `json:"ml_probability"`
	AlertID        string   `json:"alert_id,omitempty"`
}

// FraudDetectionEngine handles fraud detection for transactions
type FraudDetectionEngine struct {
	db            *gorm.DB
	redisClient   *redis.Client
	kafkaProducer *kafka.Producer
	ruleEngine    *rules.RuleEngine
	logger        *zap.SugaredLogger
	httpClient    *http.Client
}

// NewFraudDetectionEngine creates a new fraud detection engine
func NewFraudDetectionEngine(
	db *gorm.DB,
	redisClient *redis.Client,
	kafkaProducer *kafka.Producer,
	ruleEngine *rules.RuleEngine,
	logger *zap.SugaredLogger,
) *FraudDetectionEngine {
	return &FraudDetectionEngine{
		db:            db,
		redisClient:   redisClient,
		kafkaProducer: kafkaProducer,
		ruleEngine:    ruleEngine,
		logger:        logger,
		httpClient: &http.Client{
			Timeout: time.Duration(viper.GetInt("ml_service.timeout")) * time.Second,
		},
	}
}

// EvaluateTransaction evaluates a transaction for fraud
func (e *FraudDetectionEngine) EvaluateTransaction(ctx context.Context, transaction *models.Transaction) (*FraudDetectionResult, error) {
	// Get customer information
	var customer models.Customer
	result := e.db.First(&customer, "id = ?", transaction.CustomerID)
	if result.Error != nil {
		e.logger.Warnf("Customer not found for transaction %s: %v", transaction.ID, result.Error)
		// Create a placeholder customer if not found
		customer = models.Customer{
			ID:                transaction.CustomerID,
			PreferredLanguage: "english", // Default language
			UsualLocations:    []string{},
			RiskProfile:       map[string]interface{}{"score": 0.5}, // Default risk profile
		}
	}

	// Get recent transaction history
	var history []models.Transaction
	result = e.db.Where("customer_id = ? AND id != ? AND timestamp > ?", 
		transaction.CustomerID, 
		transaction.ID, 
		time.Now().Add(-24*time.Hour)).
		Order("timestamp desc").
		Limit(20).
		Find(&history)
	
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get transaction history: %w", result.Error)
	}

	// Evaluate rules
	ruleResults, err := e.ruleEngine.EvaluateRules(ctx, transaction, &customer, history)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate rules: %w", err)
	}

	// Calculate rule-based risk score
	ruleRiskScore := e.calculateRuleRiskScore(ruleResults)

	// Get ML risk score
	mlPrediction, mlProbability, err := e.getMLRiskScore(ctx, transaction, &customer, history)
	if err != nil {
		e.logger.Warnf("Failed to get ML risk score: %v", err)
		// Continue with rule-based score only
		mlPrediction = false
		mlProbability = 0.0
	}

	// Combine rule-based and ML risk scores
	combinedRiskScore := e.combineRiskScores(ruleRiskScore, mlProbability)

	// Determine action based on risk score
	action := e.determineAction(combinedRiskScore, &customer)

	// Extract triggered rule IDs
	triggeredRules := make([]string, 0)
	for _, result := range ruleResults {
		if result.Triggered {
			triggeredRules = append(triggeredRules, result.Rule.ID)
		}
	}

	// Create result
	result = &FraudDetectionResult{
		TransactionID:  transaction.ID,
		CustomerID:     transaction.CustomerID,
		RiskScore:      combinedRiskScore,
		Action:         action,
		TriggeredRules: triggeredRules,
		MLPrediction:   mlPrediction,
		MLProbability:  mlProbability,
	}

	// Create alert if risk score is high enough
	if combinedRiskScore >= 0.3 {
		alertID, err := e.createFraudAlert(ctx, transaction, combinedRiskScore, triggeredRules, action)
		if err != nil {
			e.logger.Errorf("Failed to create fraud alert: %v", err)
		} else {
			result.AlertID = alertID
		}
	}

	// Store ML prediction
	if err := e.storeMLPrediction(transaction.ID, mlPrediction, mlProbability); err != nil {
		e.logger.Warnf("Failed to store ML prediction: %v", err)
	}

	return result, nil
}

// calculateRuleRiskScore calculates the risk score based on rule evaluation results
func (e *FraudDetectionEngine) calculateRuleRiskScore(ruleResults []*rules.RuleResult) float64 {
	if len(ruleResults) == 0 {
		return 0.0
	}

	// Sum weighted rule scores
	totalWeight := 0.0
	totalScore := 0.0
	maxWeight := 0.0

	for _, result := range ruleResults {
		if result.Triggered {
			totalScore += result.Rule.RiskScore * float64(result.Rule.Weight)
			totalWeight += float64(result.Rule.Weight)
		}
		maxWeight += float64(result.Rule.Weight)
	}

	// Normalize to 0-1 range
	if maxWeight > 0 && totalWeight > 0 {
		return totalScore / totalWeight
	}

	return 0.0
}

// getMLRiskScore gets the risk score from the ML service
func (e *FraudDetectionEngine) getMLRiskScore(ctx context.Context, transaction *models.Transaction, customer *models.Customer, history []models.Transaction) (bool, float64, error) {
	// Prepare request to ML service
	mlServiceURL := viper.GetString("ml_service.url") + "/predict"

	// Extract features for ML model
	features := map[string]interface{}{
		"transaction_amount":       transaction.Amount,
		"transaction_hour":         transaction.Timestamp.Hour(),
		"transaction_day_of_week":  int(transaction.Timestamp.Weekday()),
		"transaction_channel":      transaction.Channel,
		"customer_id":              transaction.CustomerID,
		"merchant":                 transaction.Merchant,
		"location":                 transaction.Location,
		"device_id":                transaction.DeviceID,
		"ip_address":               transaction.IPAddress,
		"transaction_count_24h":    len(history),
		"transaction_amount_24h":   sumTransactionAmounts(history),
		"new_location":             !containsLocation(history, transaction.Location),
		"new_merchant":             !containsMerchant(history, transaction.Merchant),
		"transaction_velocity_1h":  countTransactionsInLastHour(history, transaction.Timestamp),
		"customer_risk_profile":    customer.RiskProfile,
	}

	// Create request body
	requestBody, err := json.Marshal(map[string]interface{}{
		"transaction_id": transaction.ID,
		"features":       features,
	})
	if err != nil {
		return false, 0.0, fmt.Errorf("failed to marshal ML request: %w", err)
	}

	// Send request to ML service
	req, err := http.NewRequestWithContext(ctx, "POST", mlServiceURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return false, 0.0, fmt.Errorf("failed to create ML request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return false, 0.0, fmt.Errorf("failed to send ML request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, 0.0, fmt.Errorf("ML service returned non-OK status: %d", resp.StatusCode)
	}

	// Parse response
	var mlResponse struct {
		Prediction  bool    `json:"prediction"`
		Probability float64 `json:"probability"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&mlResponse); err != nil {
		return false, 0.0, fmt.Errorf("failed to decode ML response: %w", err)
	}

	return mlResponse.Prediction, mlResponse.Probability, nil
}

// combineRiskScores combines rule-based and ML risk scores
func (e *FraudDetectionEngine) combineRiskScores(ruleScore, mlScore float64) float64 {
	// Simple weighted average
	ruleWeight := viper.GetFloat64("risk_scoring.rule_weight")
	if ruleWeight == 0 {
		ruleWeight = 0.6 // Default weight
	}
	mlWeight := 1.0 - ruleWeight

	return (ruleScore * ruleWeight) + (mlScore * mlWeight)
}

// determineAction determines the action to take based on risk score
func (e *FraudDetectionEngine) determineAction(riskScore float64, customer *models.Customer) string {
	// Get thresholds from config
	blockThreshold := viper.GetFloat64("risk_scoring.block_threshold")
	if blockThreshold == 0 {
		blockThreshold = 0.8 // Default threshold
	}

	verifyCallThreshold := viper.GetFloat64("risk_scoring.verify_call_threshold")
	if verifyCallThreshold == 0 {
		verifyCallThreshold = 0.6 // Default threshold
	}

	verifySMSThreshold := viper.GetFloat64("risk_scoring.verify_sms_threshold")
	if verifySMSThreshold == 0 {
		verifySMSThreshold = 0.4 // Default threshold
	}

	// Determine action based on risk score
	if riskScore >= blockThreshold {
		return "block_transaction"
	} else if riskScore >= verifyCallThreshold {
		return "verify_call"
	} else if riskScore >= verifySMSThreshold {
		return "verify_sms"
	} else {
		return "allow_transaction"
	}
}

// createFraudAlert creates a fraud alert in the database and sends it to Kafka
func (e *FraudDetectionEngine) createFraudAlert(ctx context.Context, transaction *models.Transaction, riskScore float64, triggeredRules []string, action string) (string, error) {
	// Create alert ID
	alertID := uuid.New().String()

	// Create alert in database
	alert := &models.FraudAlert{
		ID:             alertID,
		TransactionID:  transaction.ID,
		CustomerID:     transaction.CustomerID,
		RiskScore:      riskScore,
		TriggeredRules: triggeredRules,
		Status:         "new",
		Action:         action,
		Data: map[string]interface{}{
			"transaction_amount":   transaction.Amount,
			"transaction_currency": transaction.Currency,
			"transaction_time":     transaction.Timestamp,
			"merchant":             transaction.Merchant,
			"location":             transaction.Location,
			"channel":              transaction.Channel,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	result := e.db.Create(alert)
	if result.Error != nil {
		return "", fmt.Errorf("failed to create fraud alert: %w", result.Error)
	}

	// Send alert to Kafka
	alertJSON, err := json.Marshal(alert)
	if err != nil {
		return alertID, fmt.Errorf("failed to marshal alert: %w", err)
	}

	topic := viper.GetString("kafka.fraud_alert_topic")
	if topic == "" {
		topic = "fraud.detection.alerts"
	}

	err = e.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          alertJSON,
		Key:            []byte(alertID),
	}, nil)

	if err != nil {
		return alertID, fmt.Errorf("failed to produce alert to Kafka: %w", err)
	}

	return alertID, nil
}

// storeMLPrediction stores the ML prediction in the database
func (e *FraudDetectionEngine) storeMLPrediction(transactionID string, prediction bool, probability float64) error {
	mlPrediction := &models.MLPrediction{
		ID:            uuid.New().String(),
		ModelID:       "default", // TODO: Get from config
		TransactionID: transactionID,
		Prediction:    prediction,
		Probability:   probability,
		Features:      map[string]interface{}{}, // TODO: Store features
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	result := e.db.Create(mlPrediction)
	return result.Error
}

// Helper functions

// sumTransactionAmounts sums the amounts of all transactions
func sumTransactionAmounts(transactions []models.Transaction) float64 {
	total := 0.0
	for _, tx := range transactions {
		total += tx.Amount
	}
	return total
}

// containsLocation checks if the location is in the transaction history
func containsLocation(transactions []models.Transaction, location string) bool {
	for _, tx := range transactions {
		if tx.Location == location {
			return true
		}
	}
	return false
}

// containsMerchant checks if the merchant is in the transaction history
func containsMerchant(transactions []models.Transaction, merchant string) bool {
	for _, tx := range transactions {
		if tx.Merchant == merchant {
			return true
		}
	}
	return false
}

// countTransactionsInLastHour counts transactions in the last hour
func countTransactionsInLastHour(transactions []models.Transaction, referenceTime time.Time) int {
	count := 0
	for _, tx := range transactions {
		if referenceTime.Sub(tx.Timestamp) <= time.Hour {
			count++
		}
	}
	return count
}


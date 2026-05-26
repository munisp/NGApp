package rules

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// TransactionProcessor handles processing of transactions from various sources
type TransactionProcessor struct {
	db           *gorm.DB
	redisClient  *redis.Client
	kafkaProducer *kafka.Producer
	logger       *zap.SugaredLogger
}

// NewTransactionProcessor creates a new transaction processor
func NewTransactionProcessor(db *gorm.DB, redisClient *redis.Client, kafkaProducer *kafka.Producer, logger *zap.SugaredLogger) *TransactionProcessor {
	return &TransactionProcessor{
		db:           db,
		redisClient:  redisClient,
		kafkaProducer: kafkaProducer,
		logger:       logger,
	}
}

// ProcessTransaction processes a transaction from any source
func (p *TransactionProcessor) ProcessTransaction(ctx context.Context, rawTransaction map[string]interface{}) error {
	// Normalize the transaction
	normalizedTx, err := p.normalizeTransaction(rawTransaction)
	if err != nil {
		return fmt.Errorf("failed to normalize transaction: %w", err)
	}

	// Store the transaction in the database
	if err := p.storeTransaction(normalizedTx); err != nil {
		return fmt.Errorf("failed to store transaction: %w", err)
	}

	// Forward the transaction to the fraud detection engine
	if err := p.forwardToFraudDetection(normalizedTx); err != nil {
		return fmt.Errorf("failed to forward transaction to fraud detection: %w", err)
	}

	p.logger.Infof("Successfully processed transaction %s", normalizedTx.ID)
	return nil
}

// normalizeTransaction normalizes transaction data from different sources
func (p *TransactionProcessor) normalizeTransaction(rawTransaction map[string]interface{}) (*models.Transaction, error) {
	// Generate a new UUID if not provided
	txID, ok := rawTransaction["id"].(string)
	if !ok || txID == "" {
		txID = uuid.New().String()
	}

	// Extract customer ID
	customerID, _ := rawTransaction["customer_id"].(string)
	if customerID == "" {
		customerID, _ = rawTransaction["user_id"].(string)
	}
	if customerID == "" {
		return nil, fmt.Errorf("customer ID not found in transaction")
	}

	// Extract amount
	var amount float64
	switch v := rawTransaction["amount"].(type) {
	case float64:
		amount = v
	case string:
		fmt.Sscanf(v, "%f", &amount)
	default:
		return nil, fmt.Errorf("invalid amount format")
	}

	// Extract currency
	currency, _ := rawTransaction["currency"].(string)
	if currency == "" {
		currency = "NGN" // Default to Nigerian Naira
	}

	// Extract timestamp
	var timestamp time.Time
	if ts, ok := rawTransaction["timestamp"].(string); ok {
		var err error
		timestamp, err = time.Parse(time.RFC3339, ts)
		if err != nil {
			timestamp = time.Now()
		}
	} else {
		timestamp = time.Now()
	}

	// Extract channel
	channel, _ := rawTransaction["channel"].(string)
	if channel == "" {
		channel, _ = rawTransaction["source"].(string)
	}

	// Extract location
	location, _ := rawTransaction["location"].(string)
	if location == "" {
		location, _ = rawTransaction["geo"].(string)
	}

	// Extract merchant
	merchant, _ := rawTransaction["merchant"].(string)
	if merchant == "" {
		merchant, _ = rawTransaction["recipient"].(string)
	}

	// Extract device ID
	deviceID, _ := rawTransaction["device_id"].(string)

	// Extract IP address
	ipAddress, _ := rawTransaction["ip_address"].(string)

	// Extract status
	status, _ := rawTransaction["status"].(string)
	if status == "" {
		status = "pending"
	}

	// Extract source system
	sourceSystem, _ := rawTransaction["source"].(string)

	// Create normalized transaction
	transaction := &models.Transaction{
		ID:           txID,
		CustomerID:   customerID,
		Amount:       amount,
		Currency:     currency,
		Timestamp:    timestamp,
		Channel:      channel,
		Location:     location,
		Merchant:     merchant,
		DeviceID:     deviceID,
		IPAddress:    ipAddress,
		Status:       status,
		SourceSystem: sourceSystem,
		RawData:      rawTransaction,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	return transaction, nil
}

// storeTransaction stores the transaction in the database
func (p *TransactionProcessor) storeTransaction(transaction *models.Transaction) error {
	result := p.db.Create(transaction)
	if result.Error != nil {
		// Check if it's a duplicate key error
		if result.Error.Error() == "duplicate key value violates unique constraint" {
			// Update the existing transaction
			result = p.db.Model(&models.Transaction{}).Where("id = ?", transaction.ID).Updates(transaction)
		}
	}
	return result.Error
}

// forwardToFraudDetection forwards the transaction to the fraud detection engine
func (p *TransactionProcessor) forwardToFraudDetection(transaction *models.Transaction) error {
	// Convert transaction to JSON
	txJSON, err := json.Marshal(transaction)
	if err != nil {
		return fmt.Errorf("failed to marshal transaction: %w", err)
	}

	// Send to Kafka
	topic := "fraud.detection.transactions"
	err = p.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          txJSON,
		Key:            []byte(transaction.ID),
		Headers:        []kafka.Header{{Key: "source", Value: []byte(transaction.SourceSystem)}},
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to produce message to Kafka: %w", err)
	}

	return nil
}


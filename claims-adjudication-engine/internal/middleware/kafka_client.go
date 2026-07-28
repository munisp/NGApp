package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

// KafkaConfig holds Kafka configuration
type KafkaConfig struct {
	Brokers       []string
	ConsumerGroup string
	Topics        KafkaTopics
}

// KafkaTopics defines the topics used by the claims adjudication engine
type KafkaTopics struct {
	ClaimSubmitted      string
	ClaimProcessed      string
	DocumentUploaded    string
	DocumentVerified    string
	FraudDetected       string
	DecisionMade        string
	PaymentInitiated    string
	NotificationSent    string
	AuditLog            string
	SLABreach           string
}

// ClaimEvent represents a claim-related event
type ClaimEvent struct {
	ID          uuid.UUID              `json:"id"`
	Type        string                 `json:"type"`
	ClaimID     uuid.UUID              `json:"claim_id"`
	Timestamp   time.Time              `json:"timestamp"`
	Source      string                 `json:"source"`
	Data        map[string]interface{} `json:"data"`
	Metadata    map[string]string      `json:"metadata,omitempty"`
	CorrelationID string               `json:"correlation_id,omitempty"`
}

// KafkaClient handles Kafka messaging
type KafkaClient struct {
	config  KafkaConfig
	writers map[string]*kafka.Writer
	readers map[string]*kafka.Reader
}

// NewKafkaClient creates a new Kafka client
func NewKafkaClient(config KafkaConfig) *KafkaClient {
	if len(config.Brokers) == 0 {
		brokers := os.Getenv("KAFKA_BROKERS")
		if brokers == "" {
			brokers = "localhost:9092"
		}
		config.Brokers = []string{brokers}
	}

	if config.ConsumerGroup == "" {
		config.ConsumerGroup = "claims-adjudication-engine"
	}

	// Set default topics
	if config.Topics.ClaimSubmitted == "" {
		config.Topics = KafkaTopics{
			ClaimSubmitted:   "claims.submitted",
			ClaimProcessed:   "claims.processed",
			DocumentUploaded: "documents.uploaded",
			DocumentVerified: "documents.verified",
			FraudDetected:    "fraud.detected",
			DecisionMade:     "decisions.made",
			PaymentInitiated: "payments.initiated",
			NotificationSent: "notifications.sent",
			AuditLog:         "audit.log",
			SLABreach:        "sla.breach",
		}
	}

	client := &KafkaClient{
		config:  config,
		writers: make(map[string]*kafka.Writer),
		readers: make(map[string]*kafka.Reader),
	}

	// Initialize writers for all topics
	topics := []string{
		config.Topics.ClaimSubmitted,
		config.Topics.ClaimProcessed,
		config.Topics.DocumentUploaded,
		config.Topics.DocumentVerified,
		config.Topics.FraudDetected,
		config.Topics.DecisionMade,
		config.Topics.PaymentInitiated,
		config.Topics.NotificationSent,
		config.Topics.AuditLog,
		config.Topics.SLABreach,
	}

	for _, topic := range topics {
		client.writers[topic] = &kafka.Writer{
			Addr:         kafka.TCP(config.Brokers...),
			Topic:        topic,
			Balancer:     &kafka.LeastBytes{},
			BatchTimeout: 10 * time.Millisecond,
			RequiredAcks: kafka.RequireOne,
		}
	}

	return client
}

// PublishEvent publishes an event to a Kafka topic
func (c *KafkaClient) PublishEvent(ctx context.Context, topic string, event ClaimEvent) error {
	writer, exists := c.writers[topic]
	if !exists {
		return fmt.Errorf("unknown topic: %s", topic)
	}

	event.ID = uuid.New()
	event.Timestamp = time.Now()
	event.Source = "claims-adjudication-engine"

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := kafka.Message{
		Key:   []byte(event.ClaimID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event-type", Value: []byte(event.Type)},
			{Key: "correlation-id", Value: []byte(event.CorrelationID)},
		},
	}

	if err := writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}

// PublishClaimSubmitted publishes a claim submitted event
func (c *KafkaClient) PublishClaimSubmitted(ctx context.Context, claimID uuid.UUID, data map[string]interface{}) error {
	return c.PublishEvent(ctx, c.config.Topics.ClaimSubmitted, ClaimEvent{
		Type:    "CLAIM_SUBMITTED",
		ClaimID: claimID,
		Data:    data,
	})
}

// PublishClaimProcessed publishes a claim processed event
func (c *KafkaClient) PublishClaimProcessed(ctx context.Context, claimID uuid.UUID, decision string, data map[string]interface{}) error {
	if data == nil {
		data = make(map[string]interface{})
	}
	data["decision"] = decision
	return c.PublishEvent(ctx, c.config.Topics.ClaimProcessed, ClaimEvent{
		Type:    "CLAIM_PROCESSED",
		ClaimID: claimID,
		Data:    data,
	})
}

// PublishDocumentUploaded publishes a document uploaded event
func (c *KafkaClient) PublishDocumentUploaded(ctx context.Context, claimID uuid.UUID, documentID uuid.UUID, documentType string) error {
	return c.PublishEvent(ctx, c.config.Topics.DocumentUploaded, ClaimEvent{
		Type:    "DOCUMENT_UPLOADED",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"document_id":   documentID.String(),
			"document_type": documentType,
		},
	})
}

// PublishDocumentVerified publishes a document verified event
func (c *KafkaClient) PublishDocumentVerified(ctx context.Context, claimID uuid.UUID, documentID uuid.UUID, isVerified bool, confidence float64) error {
	return c.PublishEvent(ctx, c.config.Topics.DocumentVerified, ClaimEvent{
		Type:    "DOCUMENT_VERIFIED",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"document_id": documentID.String(),
			"is_verified": isVerified,
			"confidence":  confidence,
		},
	})
}

// PublishFraudDetected publishes a fraud detected event
func (c *KafkaClient) PublishFraudDetected(ctx context.Context, claimID uuid.UUID, fraudScore float64, indicators []string) error {
	return c.PublishEvent(ctx, c.config.Topics.FraudDetected, ClaimEvent{
		Type:    "FRAUD_DETECTED",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"fraud_score": fraudScore,
			"indicators":  indicators,
		},
	})
}

// PublishDecisionMade publishes a decision made event
func (c *KafkaClient) PublishDecisionMade(ctx context.Context, claimID uuid.UUID, decisionID uuid.UUID, decision string, reasoning string) error {
	return c.PublishEvent(ctx, c.config.Topics.DecisionMade, ClaimEvent{
		Type:    "DECISION_MADE",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"decision_id": decisionID.String(),
			"decision":    decision,
			"reasoning":   reasoning,
		},
	})
}

// PublishPaymentInitiated publishes a payment initiated event
func (c *KafkaClient) PublishPaymentInitiated(ctx context.Context, claimID uuid.UUID, paymentID uuid.UUID, amount float64) error {
	return c.PublishEvent(ctx, c.config.Topics.PaymentInitiated, ClaimEvent{
		Type:    "PAYMENT_INITIATED",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"payment_id": paymentID.String(),
			"amount":     amount,
		},
	})
}

// PublishSLABreach publishes an SLA breach event
func (c *KafkaClient) PublishSLABreach(ctx context.Context, claimID uuid.UUID, slaType string, breachTime time.Time) error {
	return c.PublishEvent(ctx, c.config.Topics.SLABreach, ClaimEvent{
		Type:    "SLA_BREACH",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"sla_type":    slaType,
			"breach_time": breachTime.Format(time.RFC3339),
		},
	})
}

// PublishAuditLog publishes an audit log event
func (c *KafkaClient) PublishAuditLog(ctx context.Context, claimID uuid.UUID, action string, userID string, details map[string]interface{}) error {
	return c.PublishEvent(ctx, c.config.Topics.AuditLog, ClaimEvent{
		Type:    "AUDIT_LOG",
		ClaimID: claimID,
		Data: map[string]interface{}{
			"action":  action,
			"user_id": userID,
			"details": details,
		},
	})
}

// Subscribe subscribes to a Kafka topic
func (c *KafkaClient) Subscribe(ctx context.Context, topic string, handler func(ClaimEvent) error) error {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  c.config.Brokers,
		Topic:    topic,
		GroupID:  c.config.ConsumerGroup,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})
	c.readers[topic] = reader

	go func() {
		for {
			select {
			case <-ctx.Done():
				reader.Close()
				return
			default:
				msg, err := reader.ReadMessage(ctx)
				if err != nil {
					continue
				}

				var event ClaimEvent
				if err := json.Unmarshal(msg.Value, &event); err != nil {
					continue
				}

				if err := handler(event); err != nil {
					// Log error but continue processing
					continue
				}
			}
		}
	}()

	return nil
}

// Close closes all Kafka connections
func (c *KafkaClient) Close() error {
	for _, writer := range c.writers {
		if err := writer.Close(); err != nil {
			return err
		}
	}
	for _, reader := range c.readers {
		if err := reader.Close(); err != nil {
			return err
		}
	}
	return nil
}

package producer

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/actgardner/gogen-avro/v10/encoding"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"underwriting-producer/config"
	"underwriting-producer/pkg/events"
)

// Producer handles Kafka message production
type Producer struct {
	kp *kafka.Producer
	cfg config.Config
	log *logrus.Entry
}

// NewProducer creates a new Kafka producer instance
func NewProducer(cfg config.Config) (*Producer, error) {
	log := logrus.WithField("component", "KafkaProducer")
	
	kp, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.Kafka.BootstrapServers,
		"acks": "all",
		"message.timeout.ms": 5000,
	})
	if err != nil {
		log.WithError(err).Error("Failed to create Kafka producer")
		return nil, fmt.Errorf("failed to create producer: %w", err)
	}

	log.Infof("Created Kafka Producer: %s", kp.String())

	return &Producer{
		kp: kp,
		cfg: cfg,
		log: log,
	}, nil
}

// Close closes the Kafka producer connection
func (p *Producer) Close() {
	p.log.Info("Closing Kafka producer")
	p.kp.Close()
}

// ProduceUnderwritingEvent serializes and sends an Avro event to Kafka
func (p *Producer) ProduceUnderwritingEvent(ctx context.Context, eventType events.UnderwritingEventType, caseID, policyID string, payload interface{}) error {
	eventID := uuid.New().String()
	timestamp := time.Now().UnixMilli()

	// 1. Event Enrichment (Simulated Risk Score)
	var riskScore float64
	if eventType == events.UnderwritingEventType_DECISIONMADE {
		// Simulate fetching/calculating risk score from an external service
		riskScore = p.simulateRiskScore(caseID)
	}

	// 2. Create Avro Event
	avroEvent := events.NewUnderwritingEvent()
	avroEvent.EventId = eventID
	avroEvent.EventType = eventType
	avroEvent.CaseId = caseID
	avroEvent.PolicyId = policyID
	avroEvent.Timestamp = timestamp

	// 3. Set Payload based on event type
	switch eventType {
	case events.UnderwritingEventType_CASECREATED:
		avroEvent.Payload = events.UnderwritingEventPayloadUnion{
			CaseCreatedPayload: &events.CaseCreatedPayload{
				ApplicantDataJson: payload.(string),
			},
		}
	case events.UnderwritingEventType_DECISIONMADE:
		decisionPayload := payload.(map[string]interface{})
		decision := decisionPayload["decision"].(events.Decision)
		modelVersion := decisionPayload["risk_model_version"].(string)

		avroEvent.Payload = events.UnderwritingEventPayloadUnion{
			DecisionMadePayload: &events.DecisionMadePayload{
				Decision: decision,
				RiskScore: riskScore, // Enriched data
				RiskModelVersion: modelVersion,
			},
		}
	case events.UnderwritingEventType_MANUALREVIEW:
		avroEvent.Payload = events.UnderwritingEventPayloadUnion{
			ManualReviewPayload: &events.ManualReviewPayload{
				Reason: payload.(string),
			},
		}
	default:
		return fmt.Errorf("unsupported event type: %s", eventType)
	}

	// 4. Serialize Avro Event
	writer := encoding.NewSpecificDatumWriter()
	binary, err := writer.Write(avroEvent)
	if err != nil {
		p.log.WithError(err).Error("Failed to serialize Avro event")
		return fmt.Errorf("failed to serialize Avro event: %w", err)
	}

	// 5. Produce to Kafka
	deliveryChan := make(chan kafka.Event)
	
	// Structured Logging with Trace ID (using eventID as trace ID)
	logFields := logrus.Fields{
		"event_id": eventID,
		"event_type": eventType,
		"case_id": caseID,
		"policy_id": policyID,
		"topic": p.cfg.Kafka.Topic,
	}
	p.log.WithFields(logFields).Info("Producing underwriting event to Kafka")

	err = p.kp.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &p.cfg.Kafka.Topic, Partition: kafka.PartitionAny},
		Value:          binary,
		Key:            []byte(caseID), // Use caseID as key for partitioning
		Headers: []kafka.Header{
			{Key: "trace-id", Value: []byte(eventID)},
			{Key: "event-type", Value: []byte(string(eventType))},
		},
	}, deliveryChan)

	if err != nil {
		p.log.WithFields(logFields).WithError(err).Error("Failed to produce message")
		return fmt.Errorf("failed to produce message: %w", err)
	}

	// Wait for delivery report
	e := <-deliveryChan
	m := e.(*kafka.Message)

	if m.TopicPartition.Error != nil {
		p.log.WithFields(logFields).WithError(m.TopicPartition.Error).Error("Delivery failed")
		return fmt.Errorf("delivery failed: %w", m.TopicPartition.Error)
	}

	p.log.WithFields(logFields).Infof("Delivered message to topic %s [%d] at offset %v",
		*m.TopicPartition.Topic, m.TopicPartition.Partition, m.TopicPartition.Offset)

	close(deliveryChan)
	return nil
}

// simulateRiskScore simulates fetching a risk score from a hypothetical service
func (p *Producer) simulateRiskScore(caseID string) float64 {
	// In a real application, this would be an API call or database lookup.
	// For simulation, we'll use a simple hash-based score.
	hash := 0
	for _, char := range caseID {
		hash += int(char)
	}
	// Score between 0.0 and 1.0
	return float64(hash%100) / 100.0
}

// MockUnderwritingService simulates the service that triggers events
type MockUnderwritingService struct {
	producer *Producer
	log *logrus.Entry
}

// NewMockUnderwritingService creates a new mock service
func NewMockUnderwritingService(p *Producer) *MockUnderwritingService {
	return &MockUnderwritingService{
		producer: p,
		log: logrus.WithField("component", "MockUnderwritingService"),
	}
}

// ProcessCase simulates the full underwriting lifecycle
func (m *MockUnderwritingService) ProcessCase(ctx context.Context, policyID string) {
	caseID := uuid.New().String()
	m.log.Infof("Starting process for case: %s, policy: %s", caseID, policyID)

	// 1. Case Created Event
	applicantData := map[string]string{"name": "John Doe", "age": "35"}
	dataJSON, _ := json.Marshal(applicantData)
	err := m.producer.ProduceUnderwritingEvent(ctx, events.UnderwritingEventType_CASECREATED, caseID, policyID, string(dataJSON))
	if err != nil {
		m.log.WithError(err).Error("Failed to produce CASE_CREATED event")
		return
	}
	time.Sleep(100 * time.Millisecond)

	// 2. Decision Made Event (Approved)
	decisionPayload := map[string]interface{}{
		"decision": events.Decision_APPROVED,
		"risk_model_version": "v1.2.3",
	}
	err = m.producer.ProduceUnderwritingEvent(ctx, events.UnderwritingEventType_DECISIONMADE, caseID, policyID, decisionPayload)
	if err != nil {
		m.log.WithError(err).Error("Failed to produce DECISION_MADE event")
		return
	}
	time.Sleep(100 * time.Millisecond)

	// 3. Manual Review Event (for a different case)
	caseID2 := uuid.New().String()
	err = m.producer.ProduceUnderwritingEvent(ctx, events.UnderwritingEventType_MANUALREVIEW, caseID2, policyID, "High-risk occupation detected")
	if err != nil {
		m.log.WithError(err).Error("Failed to produce MANUAL_REVIEW event")
		return
	}
	m.log.Infof("Finished process for case: %s, policy: %s", caseID, policyID)
}

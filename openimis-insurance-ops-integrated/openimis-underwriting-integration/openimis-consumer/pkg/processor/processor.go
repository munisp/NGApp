package processor

import (
	"context"
	"fmt"
	"time"

	"github.com/actgardner/gogen-avro/v10/encoding"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/sirupsen/logrus"
	"openimis-consumer/config"
	"openimis-consumer/pkg/events"
)

// EventProcessor defines the interface for processing underwriting events
type EventProcessor interface {
	Process(ctx context.Context, event *events.UnderwritingEvent) error
}

// RiskModelUpdater simulates the OpenIMIS component that updates risk models
type RiskModelUpdater struct {
	log *logrus.Entry
}

// NewRiskModelUpdater creates a new RiskModelUpdater
func NewRiskModelUpdater() *RiskModelUpdater {
	return &RiskModelUpdater{
		log: logrus.WithField("component", "RiskModelUpdater"),
	}
}

// Process implements the EventProcessor interface
func (r *RiskModelUpdater) Process(ctx context.Context, event *events.UnderwritingEvent) error {
	log := r.log.WithFields(logrus.Fields{
		"event_id": event.EventId,
		"event_type": event.EventType,
		"case_id": event.CaseId,
		"policy_id": event.PolicyId,
	})

	log.Infof("Received event: %s", event.EventType)

	switch event.EventType {
	case events.UnderwritingEventType_CASECREATED:
		// Logic for CASE_CREATED: e.g., create a temporary record in OpenIMIS
		log.Info("Processing CASE_CREATED: Creating temporary underwriting record.")
	
	case events.UnderwritingEventType_DECISIONMADE:
		// Logic for DECISION_MADE: Update risk models based on underwriting outcomes
		if event.Payload.DecisionMadePayload == nil {
			return fmt.Errorf("DECISION_MADE event missing payload")
		}
		payload := event.Payload.DecisionMadePayload
		
		log.WithFields(logrus.Fields{
			"decision": payload.Decision,
			"risk_score": payload.RiskScore,
			"model_version": payload.RiskModelVersion,
		}).Info("Processing DECISION_MADE: Updating OpenIMIS risk models.")

		// Simulate the risk model update logic
		if payload.Decision == events.Decision_APPROVED {
			log.Infof("Policy %s approved. Incorporating risk score %.2f into model training data.", event.PolicyId, payload.RiskScore)
		} else {
			log.Warnf("Policy %s rejected. Analyzing rejection reasons for model refinement.", event.PolicyId)
		}

		// Simulate a long-running or complex update operation
		time.Sleep(50 * time.Millisecond)

	case events.UnderwritingEventType_MANUALREVIEW:
		// Logic for MANUAL_REVIEW: e.g., flag the case for manual follow-up in OpenIMIS
		if event.Payload.ManualReviewPayload == nil {
			return fmt.Errorf("MANUAL_REVIEW event missing payload")
		}
		log.Warnf("Processing MANUAL_REVIEW: Case flagged for follow-up. Reason: %s", event.Payload.ManualReviewPayload.Reason)

	default:
		log.Errorf("Unknown event type: %s", event.EventType)
		return fmt.Errorf("unknown event type: %s", event.EventType)
	}

	return nil
}

// Consumer handles Kafka message consumption
type Consumer struct {
	kc *kafka.Consumer
	cfg config.Config
	log *logrus.Entry
	processor EventProcessor
}

// NewConsumer creates a new Kafka consumer instance
func NewConsumer(cfg config.Config, processor EventProcessor) (*Consumer, error) {
	log := logrus.WithField("component", "KafkaConsumer")
	
	kc, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.Kafka.BootstrapServers,
		"group.id":          cfg.Kafka.GroupID,
		"auto.offset.reset": "earliest",
		"enable.auto.commit": "false", // Manual commit for reliable processing
	})
	if err != nil {
		log.WithError(err).Error("Failed to create Kafka consumer")
		return nil, fmt.Errorf("failed to create consumer: %w", err)
	}

	log.Infof("Created Kafka Consumer: %s", kc.String())

	return &Consumer{
		kc: kc,
		cfg: cfg,
		log: log,
		processor: processor,
	}, nil
}

// StartConsumption starts the Kafka consumption loop
func (c *Consumer) StartConsumption(ctx context.Context) {
	err := c.kc.SubscribeTopics([]string{c.cfg.Kafka.Topic}, nil)
	if err != nil {
		c.log.WithError(err).Fatalf("Failed to subscribe to topic %s", c.cfg.Kafka.Topic)
	}

	c.log.Infof("Consumer started, subscribed to topic: %s", c.cfg.Kafka.Topic)

	for {
		select {
		case <-ctx.Done():
			c.log.Info("Consumption loop stopped by context cancellation")
			return
		default:
			// Poll for a message with a timeout
			msg, err := c.kc.ReadMessage(time.Second * 1)
			if err == nil {
				// Message received
				c.handleMessage(ctx, msg)
			} else if !err.(kafka.Error).IsTimeout() {
				// Handle errors other than timeout
				c.log.WithError(err).Error("Error reading message")
			}
		}
	}
}

// handleMessage processes a single Kafka message
func (c *Consumer) handleMessage(ctx context.Context, msg *kafka.Message) {
	// 1. Deserialize Avro Event
	reader := encoding.NewSpecificDatumReader()
	event := events.NewUnderwritingEvent()
	
	err := reader.Read(msg.Value, event)
	if err != nil {
		c.log.WithError(err).WithField("offset", msg.TopicPartition.Offset).Error("Failed to deserialize Avro message. Skipping.")
		// In a real system, a Dead Letter Queue (DLQ) should be used here.
		return
	}

	// Extract trace ID from headers for structured logging
	traceID := "N/A"
	for _, header := range msg.Headers {
		if header.Key == "trace-id" {
			traceID = string(header.Value)
			break
		}
	}

	log := c.log.WithFields(logrus.Fields{
		"trace_id": traceID,
		"topic": *msg.TopicPartition.Topic,
		"partition": msg.TopicPartition.Partition,
		"offset": msg.TopicPartition.Offset,
		"key": string(msg.Key),
	})

	// 2. Process the event
	if err := c.processor.Process(ctx, event); err != nil {
		log.WithError(err).Error("Failed to process event. Will retry on next consumption.")
		// Do not commit offset, allowing the message to be re-read.
		// Implement retry logic/circuit breaker here in a production system.
		return
	}

	// 3. Commit offset manually after successful processing
	_, err = c.kc.CommitMessage(msg)
	if err != nil {
		log.WithError(err).Error("Failed to commit offset")
		// This is a critical error, but processing is done. Log and continue.
	} else {
		log.Info("Successfully processed and committed message")
	}
}

// Close closes the Kafka consumer connection
func (c *Consumer) Close() {
	c.log.Info("Closing Kafka consumer")
	c.kc.Close()
}

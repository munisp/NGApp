package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/client"
	"openimis-insurance-integration/internal/metrics"
	"openimis-insurance-integration/internal/temporal"
	"openimis-insurance-integration/pkg/config"
)

// Consumer is the Kafka consumer for actuarial events
type Consumer struct {
	consumer *kafka.Consumer
	config   *config.Config
	log      *logrus.Entry
	temporalClient client.Client
	metrics  *metrics.Metrics
	topics   []string
	groupID  string
}

// NewConsumer creates a new Kafka consumer
func NewConsumer(cfg *config.Config, groupID string, topics []string, temporalClient client.Client, m *metrics.Metrics) (*Consumer, error) {
	log := logrus.WithField("component", "KafkaConsumer").WithField("group_id", groupID)
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.KafkaBootstrapServers,
		"group.id":          groupID,
		"auto.offset.reset": "earliest",
		"enable.auto.commit": false, // Manual commit for Temporal integration
	})
	if err != nil {
		log.WithError(err).Error("Failed to create Kafka consumer")
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	log.Info("Kafka Consumer created successfully")
	return &Consumer{
		consumer: c,
		config:   cfg,
		log:      log,
		temporalClient: temporalClient,
		metrics:  m,
		topics:   topics,
		groupID:  groupID,
	}, nil
}

// StartConsumption subscribes to topics and starts the consumption loop
func (c *Consumer) StartConsumption(ctx context.Context) error {
	if err := c.consumer.SubscribeTopics(c.topics, nil); err != nil {
		return fmt.Errorf("failed to subscribe to topics %v: %w", c.topics, err)
	}

	c.log.Infof("Subscribed to topics: %v. Starting consumption loop...", c.topics)

	for {
		select {
		case <-ctx.Done():
			c.log.Info("Consumption loop stopped by context cancellation.")
			return nil
		default:
			msg, err := c.consumer.ReadMessage(time.Second)
			if err == nil {
				c.handleMessage(ctx, msg)
			} else if !err.(kafka.Error).IsTimeout() {
				// The client will automatically try to recover from all errors.
				c.log.WithError(err).Error("Error reading message")
			}
		}
	}
}

// handleMessage processes a single Kafka message
func (c *Consumer) handleMessage(ctx context.Context, msg *kafka.Message) {
	var event ActuarialEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		c.log.WithError(err).Error("Failed to unmarshal message value to ActuarialEvent")
		return
	}

	c.metrics.EventsConsumed.WithLabelValues(string(event.EventType), c.groupID).Inc()

	c.log.WithFields(logrus.Fields{
		"event_id": event.EventID,
		"event_type": event.EventType,
		"topic": *msg.TopicPartition.Topic,
		"offset": msg.TopicPartition.Offset,
	}).Info("Received event, starting Temporal workflow")

	// Start Temporal Workflow
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("actuarial-event-%s-%s", event.EventID, time.Now().Format("20060102150405")),
		TaskQueue: temporal.TaskQueue,
	}

	_, err := c.temporalClient.ExecuteWorkflow(ctx, workflowOptions, temporal.ActuarialEventWorkflow, event)
	if err != nil {
		c.log.WithError(err).Error("Failed to start Temporal workflow")
		c.metrics.WorkflowErrors.WithLabelValues("ActuarialEventWorkflow").Inc()
		// Do not commit offset, will retry on next read
		return
	}

	c.metrics.WorkflowStarts.WithLabelValues("ActuarialEventWorkflow").Inc()

	// Commit offset manually after successful workflow start
	_, err = c.consumer.CommitMessage(msg)
	if err != nil {
		c.log.WithError(err).Error("Failed to commit offset")
	}
}

// Close closes the Kafka consumer connection
func (c *Consumer) Close() {
	c.log.Info("Closing Kafka Consumer...")
	c.consumer.Close()
}

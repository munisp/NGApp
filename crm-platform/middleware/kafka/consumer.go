package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// MessageHandler processes a single Kafka message.
type MessageHandler func(ctx context.Context, topic string, key []byte, value json.RawMessage) error

// Consumer wraps confluent-kafka-go consumer for CRM event streams.
type Consumer struct {
	c        *kafka.Consumer
	handlers map[string]MessageHandler
}

// NewConsumer creates a consumer subscribed to the given topics.
func NewConsumer(brokers, groupID string, topics []string) (*Consumer, error) {
	if brokers == "" {
		brokers = os.Getenv("KAFKA_BROKERS")
	}
	if brokers == "" {
		brokers = "kafka:9092"
	}
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":  brokers,
		"group.id":           groupID,
		"auto.offset.reset":  "earliest",
		"enable.auto.commit": false,
		"session.timeout.ms": 30000,
	})
	if err != nil {
		return nil, fmt.Errorf("kafka consumer: %w", err)
	}
	if err := c.SubscribeTopics(topics, nil); err != nil {
		return nil, fmt.Errorf("subscribe: %w", err)
	}
	return &Consumer{c: c, handlers: make(map[string]MessageHandler)}, nil
}

// RegisterHandler registers a handler for a specific topic.
func (co *Consumer) RegisterHandler(topic string, handler MessageHandler) {
	co.handlers[topic] = handler
}

// Run starts the consumer loop. Blocks until context is cancelled.
func (co *Consumer) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			ev := co.c.Poll(100)
			if ev == nil {
				continue
			}
			switch e := ev.(type) {
			case *kafka.Message:
				topic := *e.TopicPartition.Topic
				if handler, ok := co.handlers[topic]; ok {
					if err := handler(ctx, topic, e.Key, e.Value); err != nil {
						fmt.Printf("handler error topic=%s: %v\n", topic, err)
						continue
					}
				}
				co.c.CommitMessage(e)
			case kafka.Error:
				fmt.Printf("kafka error: %v\n", e)
			}
		}
	}
}

// Close closes the consumer.
func (co *Consumer) Close() {
	co.c.Close()
}

// CRM Topic constants
const (
	TopicCustomerEvents    = "crm.customer.events"
	TopicInteractionEvents = "crm.interaction.events"
	TopicCampaignEvents    = "crm.campaign.events"
	TopicAuditLog          = "crm.audit.log"
	TopicAnalyticsStream   = "crm.analytics.stream"
	TopicTelcoEvents       = "crm.telco.events"
	TopicCommodityTrades   = "crm.commodity.trades"
	TopicCPaaSMessages     = "crm.cpaas.messages"
	TopicPaymentEvents     = "crm.payment.events"
)

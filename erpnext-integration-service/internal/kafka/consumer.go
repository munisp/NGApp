package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/IBM/sarama"

	"erpnext-integration-service/internal/models"
	"erpnext-integration-service/internal/sync"
)

// Consumer represents a Kafka consumer for ERPNext integration
type Consumer struct {
	consumer          sarama.ConsumerGroup
	financialSync     *sync.FinancialSyncService
	crmSync           *sync.CRMSyncService
	hrSync            *sync.HRSyncService
	documentSync      *sync.DocumentSyncService
	topics            []string
}

// NewConsumer creates a new Kafka consumer
func NewConsumer(
	brokers []string,
	groupID string,
	topics []string,
	financialSync *sync.FinancialSyncService,
	crmSync *sync.CRMSyncService,
	hrSync *sync.HRSyncService,
	documentSync *sync.DocumentSyncService,
) (*Consumer, error) {
	config := sarama.NewConfig()
	config.Version = sarama.V3_0_0_0
	config.Consumer.Group.Rebalance.Strategy = sarama.NewBalanceStrategyRoundRobin()
	config.Consumer.Offsets.Initial = sarama.OffsetNewest
	config.Consumer.Return.Errors = true

	consumer, err := sarama.NewConsumerGroup(brokers, groupID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer group: %w", err)
	}

	return &Consumer{
		consumer:      consumer,
		financialSync: financialSync,
		crmSync:       crmSync,
		hrSync:        hrSync,
		documentSync:  documentSync,
		topics:        topics,
	}, nil
}

// Start starts consuming messages from Kafka
func (c *Consumer) Start(ctx context.Context) error {
	handler := &consumerGroupHandler{
		financialSync: c.financialSync,
		crmSync:       c.crmSync,
		hrSync:        c.hrSync,
		documentSync:  c.documentSync,
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, stopping consumer")
			return c.consumer.Close()
		default:
			if err := c.consumer.Consume(ctx, c.topics, handler); err != nil {
				log.Printf("Error consuming messages: %v", err)
				time.Sleep(5 * time.Second) // Wait before retrying
			}
		}
	}
}

// Close closes the Kafka consumer
func (c *Consumer) Close() error {
	return c.consumer.Close()
}

// consumerGroupHandler implements sarama.ConsumerGroupHandler
type consumerGroupHandler struct {
	financialSync *sync.FinancialSyncService
	crmSync       *sync.CRMSyncService
	hrSync        *sync.HRSyncService
	documentSync  *sync.DocumentSyncService
}

// Setup is run at the beginning of a new session, before ConsumeClaim
func (h *consumerGroupHandler) Setup(sarama.ConsumerGroupSession) error {
	return nil
}

// Cleanup is run at the end of a session, once all ConsumeClaim goroutines have exited
func (h *consumerGroupHandler) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

// ConsumeClaim processes messages from a partition
func (h *consumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		log.Printf("Received message: Topic=%s, Partition=%d, Offset=%d", message.Topic, message.Partition, message.Offset)

		if err := h.processMessage(session.Context(), message); err != nil {
			log.Printf("Error processing message: %v", err)
			// Continue processing other messages even if one fails
		}

		session.MarkMessage(message, "")
	}

	return nil
}

// processMessage processes a single Kafka message
func (h *consumerGroupHandler) processMessage(ctx context.Context, message *sarama.ConsumerMessage) error {
	// Parse the event type from the message
	var baseEvent struct {
		EventType string `json:"event_type"`
	}

	if err := json.Unmarshal(message.Value, &baseEvent); err != nil {
		return fmt.Errorf("failed to parse event type: %w", err)
	}

	log.Printf("Processing event type: %s", baseEvent.EventType)

	// Route the message to the appropriate handler based on event type
	switch baseEvent.EventType {
	case "premium.paid":
		return h.handlePremiumPaid(ctx, message.Value)
	case "claim.paid":
		return h.handleClaimPaid(ctx, message.Value)
	case "commission.paid":
		return h.handleCommissionPaid(ctx, message.Value)
	case "customer.created":
		return h.handleCustomerCreated(ctx, message.Value)
	case "customer.updated":
		return h.handleCustomerUpdated(ctx, message.Value)
	case "agent.created":
		return h.handleAgentCreated(ctx, message.Value)
	case "document.created":
		return h.handleDocumentCreated(ctx, message.Value)
	default:
		log.Printf("Unknown event type: %s", baseEvent.EventType)
		return nil
	}
}

// handlePremiumPaid handles premium payment events
func (h *consumerGroupHandler) handlePremiumPaid(ctx context.Context, data []byte) error {
	var event models.PremiumPaidEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal premium paid event: %w", err)
	}

	_, err := h.financialSync.SyncPremiumPayment(ctx, &event)
	return err
}

// handleClaimPaid handles claim payment events
func (h *consumerGroupHandler) handleClaimPaid(ctx context.Context, data []byte) error {
	var event models.ClaimPaidEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal claim paid event: %w", err)
	}

	_, err := h.financialSync.SyncClaimPayment(ctx, &event)
	return err
}

// handleCommissionPaid handles commission payment events
func (h *consumerGroupHandler) handleCommissionPaid(ctx context.Context, data []byte) error {
	var event models.CommissionPaidEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal commission paid event: %w", err)
	}

	_, err := h.financialSync.SyncCommissionPayment(ctx, &event)
	return err
}

// handleCustomerCreated handles customer creation events
func (h *consumerGroupHandler) handleCustomerCreated(ctx context.Context, data []byte) error {
	var event models.CustomerCreatedEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal customer created event: %w", err)
	}

	_, err := h.crmSync.SyncCustomerCreated(ctx, &event)
	return err
}

// handleCustomerUpdated handles customer update events
func (h *consumerGroupHandler) handleCustomerUpdated(ctx context.Context, data []byte) error {
	var event models.CustomerUpdatedEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal customer updated event: %w", err)
	}

	return h.crmSync.SyncCustomerUpdated(ctx, &event)
}

// handleAgentCreated handles agent creation events
func (h *consumerGroupHandler) handleAgentCreated(ctx context.Context, data []byte) error {
	var event models.AgentCreatedEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal agent created event: %w", err)
	}

	_, err := h.hrSync.SyncAgentCreated(ctx, &event)
	return err
}

// handleDocumentCreated handles document creation events
func (h *consumerGroupHandler) handleDocumentCreated(ctx context.Context, data []byte) error {
	var event models.DocumentCreatedEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal document created event: %w", err)
	}

	_, err := h.documentSync.SyncDocumentCreated(ctx, &event)
	return err
}

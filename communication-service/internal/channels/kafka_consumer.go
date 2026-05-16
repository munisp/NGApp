package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/insurance-platform/communication-service/internal/models"
	"github.com/insurance-platform/communication-service/internal/router"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

// KafkaConsumer consumes events from Kafka and sends notifications
type KafkaConsumer struct {
	reader *kafka.Reader
	router *router.Router
	logger *zap.Logger
}

// NewKafkaConsumer creates a new Kafka consumer
func NewKafkaConsumer(brokers []string, topic string, groupID string, router *router.Router, logger *zap.Logger) *KafkaConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	return &KafkaConsumer{
		reader: reader,
		router: router,
		logger: logger,
	}
}

// Start starts consuming messages from Kafka
func (c *KafkaConsumer) Start(ctx context.Context) error {
	c.logger.Info("Starting Kafka consumer")

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Stopping Kafka consumer")
			return c.reader.Close()
		default:
			msg, err := c.reader.FetchMessage(ctx)
			if err != nil {
				c.logger.Error("Failed to fetch message", zap.Error(err))
				continue
			}

			c.logger.Info("Received Kafka message",
				zap.String("topic", msg.Topic),
				zap.Int("partition", msg.Partition),
				zap.Int64("offset", msg.Offset))

			// Process message
			if err := c.processMessage(ctx, msg.Value); err != nil {
				c.logger.Error("Failed to process message",
					zap.Error(err),
					zap.String("message", string(msg.Value)))
			}

			// Commit message
			if err := c.reader.CommitMessages(ctx, msg); err != nil {
				c.logger.Error("Failed to commit message", zap.Error(err))
			}
		}
	}
}

// processMessage processes a Kafka message and sends appropriate notifications
func (c *KafkaConsumer) processMessage(ctx context.Context, data []byte) error {
	var event models.NotificationEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	c.logger.Info("Processing notification event",
		zap.String("event_type", event.EventType),
		zap.String("customer_id", event.CustomerID))

	// Route event to appropriate handler
	switch event.EventType {
	case "policy.created":
		return c.handlePolicyCreated(ctx, &event)
	case "policy.renewed":
		return c.handlePolicyRenewed(ctx, &event)
	case "policy.expired":
		return c.handlePolicyExpired(ctx, &event)
	case "claim.submitted":
		return c.handleClaimSubmitted(ctx, &event)
	case "claim.approved":
		return c.handleClaimApproved(ctx, &event)
	case "claim.rejected":
		return c.handleClaimRejected(ctx, &event)
	case "payment.received":
		return c.handlePaymentReceived(ctx, &event)
	case "payment.reminder":
		return c.handlePaymentReminder(ctx, &event)
	default:
		c.logger.Warn("Unknown event type", zap.String("event_type", event.EventType))
		return nil
	}
}

// handlePolicyCreated handles policy creation events
func (c *KafkaConsumer) handlePolicyCreated(ctx context.Context, event *models.NotificationEvent) error {
	// Send SMS notification
	smsReq := &models.SendMessageRequest{
		Channel:    models.ChannelSMS,
		Recipient:  event.Phone,
		TemplateID: "policy-created-sms",
		Variables:  event.Data,
	}

	if _, err := c.router.SendMessage(ctx, smsReq); err != nil {
		c.logger.Error("Failed to send SMS", zap.Error(err))
	}

	// Send WhatsApp notification (if available)
	whatsappReq := &models.SendMessageRequest{
		Channel:    models.ChannelWhatsApp,
		Recipient:  event.Phone,
		TemplateID: "policy-created-whatsapp",
		Variables:  event.Data,
	}

	if _, err := c.router.SendMessage(ctx, whatsappReq); err != nil {
		c.logger.Warn("Failed to send WhatsApp message", zap.Error(err))
		// WhatsApp failure is not critical, SMS was already sent
	}

	return nil
}

// handlePolicyRenewed handles policy renewal events
func (c *KafkaConsumer) handlePolicyRenewed(ctx context.Context, event *models.NotificationEvent) error {
	req := &models.SendMessageRequest{
		Channel:    models.ChannelWhatsApp,
		Recipient:  event.Phone,
		TemplateID: "policy-renewal-whatsapp",
		Variables:  event.Data,
	}

	_, err := c.router.SendMessage(ctx, req)
	return err
}

// handlePolicyExpired handles policy expiration events
func (c *KafkaConsumer) handlePolicyExpired(ctx context.Context, event *models.NotificationEvent) error {
	req := &models.SendMessageRequest{
		Channel:   models.ChannelSMS,
		Recipient: event.Phone,
		Content: fmt.Sprintf("Your policy %s has expired. Please renew to continue coverage. Visit our website or call 0800-INSURANCE.",
			event.Data["policy_number"]),
	}

	_, err := c.router.SendMessage(ctx, req)
	return err
}

// handleClaimSubmitted handles claim submission events
func (c *KafkaConsumer) handleClaimSubmitted(ctx context.Context, event *models.NotificationEvent) error {
	req := &models.SendMessageRequest{
		Channel:   models.ChannelSMS,
		Recipient: event.Phone,
		Content: fmt.Sprintf("Your claim %s has been received and is under review. We'll update you within 48 hours.",
			event.Data["claim_number"]),
	}

	_, err := c.router.SendMessage(ctx, req)
	return err
}

// handleClaimApproved handles claim approval events
func (c *KafkaConsumer) handleClaimApproved(ctx context.Context, event *models.NotificationEvent) error {
	// Send via multiple channels for important updates
	
	// SMS
	smsReq := &models.SendMessageRequest{
		Channel:    models.ChannelSMS,
		Recipient:  event.Phone,
		TemplateID: "claim-approved-sms",
		Variables:  event.Data,
	}
	c.router.SendMessage(ctx, smsReq)

	// WhatsApp
	whatsappReq := &models.SendMessageRequest{
		Channel:    models.ChannelWhatsApp,
		Recipient:  event.Phone,
		TemplateID: "claim-approved-whatsapp",
		Variables:  event.Data,
	}
	c.router.SendMessage(ctx, whatsappReq)

	return nil
}

// handleClaimRejected handles claim rejection events
func (c *KafkaConsumer) handleClaimRejected(ctx context.Context, event *models.NotificationEvent) error {
	req := &models.SendMessageRequest{
		Channel:    models.ChannelWhatsApp,
		Recipient:  event.Phone,
		TemplateID: "claim-rejected-whatsapp",
		Variables:  event.Data,
	}

	_, err := c.router.SendMessage(ctx, req)
	return err
}

// handlePaymentReceived handles payment received events
func (c *KafkaConsumer) handlePaymentReceived(ctx context.Context, event *models.NotificationEvent) error {
	req := &models.SendMessageRequest{
		Channel:   models.ChannelSMS,
		Recipient: event.Phone,
		Content: fmt.Sprintf("Payment of ₦%s received for policy %s. Thank you!",
			event.Data["amount"], event.Data["policy_number"]),
	}

	_, err := c.router.SendMessage(ctx, req)
	return err
}

// handlePaymentReminder handles payment reminder events
func (c *KafkaConsumer) handlePaymentReminder(ctx context.Context, event *models.NotificationEvent) error {
	req := &models.SendMessageRequest{
		Channel:    models.ChannelSMS,
		Recipient:  event.Phone,
		TemplateID: "payment-reminder-sms",
		Variables:  event.Data,
	}

	_, err := c.router.SendMessage(ctx, req)
	return err
}

// Close closes the Kafka consumer
func (c *KafkaConsumer) Close() error {
	return c.reader.Close()
}

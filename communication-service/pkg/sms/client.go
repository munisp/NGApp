package sms

import (
	"context"
	"fmt"

	"github.com/insurance-platform/communication-service/internal/models"
	"github.com/twilio/twilio-go"
	twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
	"go.uber.org/zap"
)

// Client represents an SMS client using Twilio
type Client struct {
	twilioClient *twilio.RestClient
	fromNumber   string
	logger       *zap.Logger
}

// NewClient creates a new SMS client
func NewClient(accountSID, authToken, fromNumber string, logger *zap.Logger) *Client {
	client := twilio.NewRestClientWithParams(twilio.ClientParams{
		Username: accountSID,
		Password: authToken,
	})

	return &Client{
		twilioClient: client,
		fromNumber:   fromNumber,
		logger:       logger,
	}
}

// SendMessage sends an SMS message
func (c *Client) SendMessage(ctx context.Context, recipient, message string) (string, error) {
	c.logger.Info("Sending SMS message",
		zap.String("recipient", recipient),
		zap.Int("message_length", len(message)))

	params := &twilioApi.CreateMessageParams{}
	params.SetTo(recipient)
	params.SetFrom(c.fromNumber)
	params.SetBody(message)

	resp, err := c.twilioClient.Api.CreateMessage(params)
	if err != nil {
		c.logger.Error("Failed to send SMS",
			zap.String("recipient", recipient),
			zap.Error(err))
		return "", fmt.Errorf("failed to send SMS: %w", err)
	}

	messageID := ""
	if resp.Sid != nil {
		messageID = *resp.Sid
	}

	c.logger.Info("SMS sent successfully",
		zap.String("message_id", messageID),
		zap.String("recipient", recipient))

	return messageID, nil
}

// SendBulkMessages sends SMS to multiple recipients
func (c *Client) SendBulkMessages(ctx context.Context, recipients []string, message string) (map[string]string, error) {
	c.logger.Info("Sending bulk SMS",
		zap.Int("recipient_count", len(recipients)))

	results := make(map[string]string)
	
	for _, recipient := range recipients {
		messageID, err := c.SendMessage(ctx, recipient, message)
		if err != nil {
			c.logger.Error("Failed to send SMS to recipient",
				zap.String("recipient", recipient),
				zap.Error(err))
			results[recipient] = fmt.Sprintf("error: %v", err)
		} else {
			results[recipient] = messageID
		}
	}

	return results, nil
}

// HandleWebhook processes incoming SMS webhook events (delivery status, replies)
func (c *Client) HandleWebhook(ctx context.Context, params map[string]string) (*models.InboundMessage, error) {
	messageID := params["MessageSid"]
	from := params["From"]
	body := params["Body"]
	status := params["MessageStatus"]

	c.logger.Info("Received SMS webhook",
		zap.String("message_id", messageID),
		zap.String("from", from),
		zap.String("status", status))

	// If this is an inbound message (not a status update)
	if body != "" {
		inboundMsg := &models.InboundMessage{
			ID:      messageID,
			Channel: models.ChannelSMS,
			Sender:  from,
			Content: body,
			Metadata: map[string]interface{}{
				"status": status,
			},
		}
		return inboundMsg, nil
	}

	// This is a status update, not an inbound message
	return nil, nil
}

// GetMessageStatus retrieves the status of a sent message
func (c *Client) GetMessageStatus(ctx context.Context, messageID string) (string, error) {
	c.logger.Info("Fetching SMS status",
		zap.String("message_id", messageID))

	message, err := c.twilioClient.Api.FetchMessage(messageID, nil)
	if err != nil {
		return "", fmt.Errorf("failed to fetch message status: %w", err)
	}

	status := ""
	if message.Status != nil {
		status = *message.Status
	}

	return status, nil
}

package router

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/insurance-platform/communication-service/internal/models"
	"github.com/insurance-platform/communication-service/internal/templates"
	"github.com/insurance-platform/communication-service/pkg/sms"
	"github.com/insurance-platform/communication-service/pkg/telegram"
	"github.com/insurance-platform/communication-service/pkg/whatsapp"
	"go.uber.org/zap"
)

// Router handles message routing to appropriate channels
type Router struct {
	whatsappClient  *whatsapp.Client
	smsClient       *sms.Client
	telegramClient  *telegram.Client
	templateManager *templates.Manager
	db              *sql.DB
	logger          *zap.Logger
}

// NewRouter creates a new message router
func NewRouter(
	whatsappClient *whatsapp.Client,
	smsClient *sms.Client,
	telegramClient *telegram.Client,
	templateManager *templates.Manager,
	db *sql.DB,
	logger *zap.Logger,
) *Router {
	return &Router{
		whatsappClient:  whatsappClient,
		smsClient:       smsClient,
		templateManager: templateManager,
		db:              db,
		logger:          logger,
		telegramClient:  telegramClient,
	}
}

// SendMessage routes and sends a message through the appropriate channel
func (r *Router) SendMessage(ctx context.Context, req *models.SendMessageRequest) (*models.SendMessageResponse, error) {
	r.logger.Info("Routing message",
		zap.String("channel", string(req.Channel)),
		zap.String("recipient", req.Recipient))

	// Create message record
	message := &models.Message{
		ID:        generateMessageID(),
		Channel:   req.Channel,
		Type:      models.MessageTypeText,
		Recipient: req.Recipient,
		Status:    models.MessageStatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Render template if template ID is provided
	if req.TemplateID != "" {
		template, err := r.templateManager.GetTemplate(ctx, req.TemplateID)
		if err != nil {
			return nil, fmt.Errorf("failed to get template: %w", err)
		}

		content, err := r.templateManager.RenderTemplate(ctx, template, req.Variables)
		if err != nil {
			return nil, fmt.Errorf("failed to render template: %w", err)
		}

		message.Content = content
		message.TemplateID = req.TemplateID
		message.Variables = req.Variables
		message.Type = models.MessageTypeTemplate
	} else {
		message.Content = req.Content
	}

	// Set media URL if provided
	if req.MediaURL != "" {
		message.MediaURL = req.MediaURL
		message.Type = models.MessageTypeImage
	}

	// Save message to database
	if err := r.saveMessage(ctx, message); err != nil {
		r.logger.Error("Failed to save message",
			zap.String("message_id", message.ID),
			zap.Error(err))
		// Continue with sending even if save fails
	}

	// Route to appropriate channel
	var externalID string
	var err error

	switch req.Channel {
	case models.ChannelWhatsApp:
		externalID, err = r.sendWhatsApp(ctx, message)
	case models.ChannelSMS:
		externalID, err = r.sendSMS(ctx, message)
	case models.ChannelTelegram:
		externalID, err = r.sendTelegram(ctx, message)
	default:
		err = fmt.Errorf("unsupported channel: %s", req.Channel)
	}

	// Update message status
	if err != nil {
		message.Status = models.MessageStatusFailed
		message.ErrorMsg = err.Error()
		now := time.Now()
		message.FailedAt = &now
		r.updateMessage(ctx, message)

		return &models.SendMessageResponse{
			MessageID: message.ID,
			Status:    models.MessageStatusFailed,
			Error:     err.Error(),
		}, err
	}

	message.Status = models.MessageStatusSent
	now := time.Now()
	message.SentAt = &now
	message.Metadata = map[string]interface{}{
		"external_id": externalID,
	}
	r.updateMessage(ctx, message)

	return &models.SendMessageResponse{
		MessageID: message.ID,
		Status:    models.MessageStatusSent,
	}, nil
}

// sendWhatsApp sends a message via WhatsApp
func (r *Router) sendWhatsApp(ctx context.Context, message *models.Message) (string, error) {
	switch message.Type {
	case models.MessageTypeText, models.MessageTypeTemplate:
		return r.whatsappClient.SendTextMessage(ctx, message.Recipient, message.Content)
	case models.MessageTypeImage:
		return r.whatsappClient.SendMediaMessage(ctx, message.Recipient, "image", message.MediaURL, message.Content)
	case models.MessageTypeDocument:
		return r.whatsappClient.SendMediaMessage(ctx, message.Recipient, "document", message.MediaURL, message.Content)
	default:
		return "", fmt.Errorf("unsupported message type for WhatsApp: %s", message.Type)
	}
}

// sendSMS sends a message via SMS
func (r *Router) sendSMS(ctx context.Context, message *models.Message) (string, error) {
	// SMS only supports text
	return r.smsClient.SendMessage(ctx, message.Recipient, message.Content)
}

// sendTelegram sends a message via Telegram
func (r *Router) sendTelegram(ctx context.Context, message *models.Message) (string, error) {
	switch message.Type {
	case models.MessageTypeText, models.MessageTypeTemplate:
		messageID, err := r.telegramClient.SendTextMessage(ctx, message.Recipient, message.Content)
		return fmt.Sprintf("%d", messageID), err
	case models.MessageTypeImage:
		messageID, err := r.telegramClient.SendPhoto(ctx, message.Recipient, message.MediaURL, message.Content)
		return fmt.Sprintf("%d", messageID), err
	case models.MessageTypeDocument:
		messageID, err := r.telegramClient.SendDocument(ctx, message.Recipient, message.MediaURL, message.Content)
		return fmt.Sprintf("%d", messageID), err
	default:
		return "", fmt.Errorf("unsupported message type for Telegram: %s", message.Type)
	}
}

// SendBulkMessages sends messages to multiple recipients
func (r *Router) SendBulkMessages(ctx context.Context, channel models.Channel, recipients []string, templateID string, variables map[string]string) (map[string]*models.SendMessageResponse, error) {
	r.logger.Info("Sending bulk messages",
		zap.String("channel", string(channel)),
		zap.Int("recipient_count", len(recipients)))

	results := make(map[string]*models.SendMessageResponse)

	for _, recipient := range recipients {
		req := &models.SendMessageRequest{
			Channel:    channel,
			Recipient:  recipient,
			TemplateID: templateID,
			Variables:  variables,
		}

		resp, err := r.SendMessage(ctx, req)
		if err != nil {
			r.logger.Error("Failed to send message to recipient",
				zap.String("recipient", recipient),
				zap.Error(err))
			results[recipient] = &models.SendMessageResponse{
				Status: models.MessageStatusFailed,
				Error:  err.Error(),
			}
		} else {
			results[recipient] = resp
		}
	}

	return results, nil
}

// GetMessageStatus retrieves the current status of a message
func (r *Router) GetMessageStatus(ctx context.Context, messageID string) (*models.Message, error) {
	query := `
		SELECT id, channel, type, recipient, content, template_id, status, 
		       sent_at, delivered_at, failed_at, error_msg, created_at, updated_at
		FROM messages
		WHERE id = $1
	`

	var message models.Message
	var sentAt, deliveredAt, failedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, messageID).Scan(
		&message.ID,
		&message.Channel,
		&message.Type,
		&message.Recipient,
		&message.Content,
		&message.TemplateID,
		&message.Status,
		&sentAt,
		&deliveredAt,
		&failedAt,
		&message.ErrorMsg,
		&message.CreatedAt,
		&message.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("message not found: %s", messageID)
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	if sentAt.Valid {
		message.SentAt = &sentAt.Time
	}
	if deliveredAt.Valid {
		message.DeliveredAt = &deliveredAt.Time
	}
	if failedAt.Valid {
		message.FailedAt = &failedAt.Time
	}

	return &message, nil
}

// saveMessage saves a message to the database
func (r *Router) saveMessage(ctx context.Context, message *models.Message) error {
	query := `
		INSERT INTO messages (id, channel, type, recipient, content, template_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.db.ExecContext(ctx, query,
		message.ID,
		message.Channel,
		message.Type,
		message.Recipient,
		message.Content,
		message.TemplateID,
		message.Status,
		message.CreatedAt,
		message.UpdatedAt,
	)

	return err
}

// updateMessage updates a message in the database
func (r *Router) updateMessage(ctx context.Context, message *models.Message) error {
	query := `
		UPDATE messages
		SET status = $2, sent_at = $3, delivered_at = $4, failed_at = $5, error_msg = $6, updated_at = $7
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		message.ID,
		message.Status,
		message.SentAt,
		message.DeliveredAt,
		message.FailedAt,
		message.ErrorMsg,
		time.Now(),
	)

	return err
}

// generateMessageID generates a unique message ID
func generateMessageID() string {
	return fmt.Sprintf("MSG-%d", time.Now().UnixNano())
}

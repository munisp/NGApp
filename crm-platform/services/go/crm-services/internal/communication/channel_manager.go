package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/your-org/banking-crm/enterprise-crm/banking-ai-telephony/multi-channel/go/models"
	"github.com/your-org/banking-crm/enterprise-crm/banking-ai-telephony/multi-channel/go/adapters"
)

// ChannelType represents the type of communication channel
type ChannelType string

const (
	ChannelWhatsApp ChannelType = "whatsapp"
	ChannelSMS      ChannelType = "sms"
	ChannelEmail    ChannelType = "email"
	ChannelUSSD     ChannelType = "ussd"
	ChannelVoice    ChannelType = "voice"
)

// ChannelManager handles communication across multiple channels
type ChannelManager struct {
	db            *gorm.DB
	redisClient   *redis.Client
	logger        *zap.SugaredLogger
	adapters      map[ChannelType]adapters.ChannelAdapter
	adaptersMutex sync.RWMutex
}

// NewChannelManager creates a new channel manager
func NewChannelManager(
	db *gorm.DB,
	redisClient *redis.Client,
	logger *zap.SugaredLogger,
) *ChannelManager {
	return &ChannelManager{
		db:          db,
		redisClient: redisClient,
		logger:      logger,
		adapters:    make(map[ChannelType]adapters.ChannelAdapter),
	}
}

// RegisterAdapter registers a channel adapter
func (m *ChannelManager) RegisterAdapter(channelType ChannelType, adapter adapters.ChannelAdapter) {
	m.adaptersMutex.Lock()
	defer m.adaptersMutex.Unlock()
	
	m.adapters[channelType] = adapter
	m.logger.Infof("Registered adapter for channel: %s", channelType)
}

// GetAdapter returns the adapter for a specific channel
func (m *ChannelManager) GetAdapter(channelType ChannelType) (adapters.ChannelAdapter, error) {
	m.adaptersMutex.RLock()
	defer m.adaptersMutex.RUnlock()
	
	adapter, ok := m.adapters[channelType]
	if !ok {
		return nil, fmt.Errorf("adapter not found for channel: %s", channelType)
	}
	
	return adapter, nil
}

// SendMessage sends a message through the specified channel
func (m *ChannelManager) SendMessage(ctx context.Context, message *models.Message) error {
	// Get the adapter for the channel
	adapter, err := m.GetAdapter(ChannelType(message.Channel))
	if err != nil {
		return fmt.Errorf("failed to get adapter: %w", err)
	}
	
	// Generate message ID if not provided
	if message.ID == "" {
		message.ID = uuid.New().String()
	}
	
	// Set timestamps
	now := time.Now()
	message.CreatedAt = now
	message.UpdatedAt = now
	
	// Store message in database
	if err := m.storeMessage(message); err != nil {
		m.logger.Warnf("Failed to store message: %v", err)
		// Continue with sending even if storage fails
	}
	
	// Send message through adapter
	result, err := adapter.SendMessage(ctx, message)
	if err != nil {
		// Update message status to failed
		message.Status = models.MessageStatusFailed
		message.ErrorMessage = err.Error()
		message.UpdatedAt = time.Now()
		
		if updateErr := m.updateMessageStatus(message); updateErr != nil {
			m.logger.Warnf("Failed to update message status: %v", updateErr)
		}
		
		return fmt.Errorf("failed to send message: %w", err)
	}
	
	// Update message with provider-specific information
	message.ProviderMessageID = result.ProviderMessageID
	message.Status = models.MessageStatusSent
	message.UpdatedAt = time.Now()
	
	if err := m.updateMessageStatus(message); err != nil {
		m.logger.Warnf("Failed to update message status: %v", err)
	}
	
	// Publish message to Redis for real-time updates
	if err := m.publishMessageUpdate(message); err != nil {
		m.logger.Warnf("Failed to publish message update: %v", err)
	}
	
	return nil
}

// ProcessIncomingMessage processes an incoming message from any channel
func (m *ChannelManager) ProcessIncomingMessage(ctx context.Context, message *models.Message) error {
	// Generate message ID if not provided
	if message.ID == "" {
		message.ID = uuid.New().String()
	}
	
	// Set timestamps
	now := time.Now()
	message.CreatedAt = now
	message.UpdatedAt = now
	message.Direction = models.MessageDirectionInbound
	
	// Store message in database
	if err := m.storeMessage(message); err != nil {
		return fmt.Errorf("failed to store incoming message: %w", err)
	}
	
	// Publish message to Redis for real-time processing
	if err := m.publishMessageUpdate(message); err != nil {
		m.logger.Warnf("Failed to publish incoming message: %v", err)
	}
	
	// Find or create conversation
	conversation, err := m.findOrCreateConversation(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to find or create conversation: %w", err)
	}
	
	// Add message to conversation
	if err := m.addMessageToConversation(ctx, conversation.ID, message.ID); err != nil {
		m.logger.Warnf("Failed to add message to conversation: %v", err)
	}
	
	// Publish event for message processing
	if err := m.publishMessageProcessingEvent(message, conversation); err != nil {
		m.logger.Warnf("Failed to publish message processing event: %v", err)
	}
	
	return nil
}

// SendTemplatedMessage sends a message using a template
func (m *ChannelManager) SendTemplatedMessage(
	ctx context.Context,
	channelType ChannelType,
	recipient string,
	templateID string,
	language string,
	params map[string]interface{},
	metadata map[string]interface{},
) (*models.Message, error) {
	// Get template
	template, err := m.getTemplate(ctx, templateID, language)
	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}
	
	// Render template
	content, err := m.renderTemplate(template, params)
	if err != nil {
		return nil, fmt.Errorf("failed to render template: %w", err)
	}
	
	// Create message
	message := &models.Message{
		ID:        uuid.New().String(),
		Channel:   string(channelType),
		Direction: models.MessageDirectionOutbound,
		Recipient: recipient,
		Content:   content,
		Metadata:  metadata,
		Status:    models.MessageStatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	// Send message
	if err := m.SendMessage(ctx, message); err != nil {
		return nil, fmt.Errorf("failed to send templated message: %w", err)
	}
	
	return message, nil
}

// GetConversationHistory gets the conversation history for a customer
func (m *ChannelManager) GetConversationHistory(
	ctx context.Context,
	customerID string,
	channelType ChannelType,
	limit int,
	offset int,
) ([]*models.Message, error) {
	var messages []*models.Message
	
	// Find conversation for customer and channel
	conversation, err := m.findConversation(ctx, customerID, string(channelType))
	if err != nil {
		return nil, fmt.Errorf("failed to find conversation: %w", err)
	}
	
	if conversation == nil {
		// No conversation found, return empty list
		return []*models.Message{}, nil
	}
	
	// Get messages for conversation
	result := m.db.
		Where("conversation_id = ?", conversation.ID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&messages)
	
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get conversation history: %w", result.Error)
	}
	
	return messages, nil
}

// storeMessage stores a message in the database
func (m *ChannelManager) storeMessage(message *models.Message) error {
	result := m.db.Create(message)
	return result.Error
}

// updateMessageStatus updates the status of a message in the database
func (m *ChannelManager) updateMessageStatus(message *models.Message) error {
	result := m.db.Model(message).
		Updates(map[string]interface{}{
			"status":              message.Status,
			"error_message":       message.ErrorMessage,
			"provider_message_id": message.ProviderMessageID,
			"updated_at":          message.UpdatedAt,
		})
	
	return result.Error
}

// publishMessageUpdate publishes a message update to Redis
func (m *ChannelManager) publishMessageUpdate(message *models.Message) error {
	// Create channel key
	channelKey := fmt.Sprintf("message:%s:update", message.ID)
	
	// Serialize message
	messageJSON, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}
	
	// Publish to Redis
	if err := m.redisClient.Publish(context.Background(), channelKey, messageJSON).Err(); err != nil {
		return fmt.Errorf("failed to publish message update: %w", err)
	}
	
	return nil
}

// findOrCreateConversation finds or creates a conversation for a message
func (m *ChannelManager) findOrCreateConversation(
	ctx context.Context,
	message *models.Message,
) (*models.Conversation, error) {
	// Extract customer ID from message metadata
	customerID, ok := message.Metadata["customer_id"].(string)
	if !ok || customerID == "" {
		// Try to find customer by recipient
		customer, err := m.findCustomerByContact(ctx, message.Channel, message.Recipient)
		if err != nil {
			return nil, fmt.Errorf("failed to find customer: %w", err)
		}
		
		if customer != nil {
			customerID = customer.ID
		} else {
			// Create anonymous conversation
			customerID = "anonymous"
		}
	}
	
	// Find existing conversation
	conversation, err := m.findConversation(ctx, customerID, message.Channel)
	if err != nil {
		return nil, fmt.Errorf("failed to find conversation: %w", err)
	}
	
	if conversation != nil {
		// Update conversation last activity
		conversation.LastActivityAt = time.Now()
		conversation.UpdatedAt = time.Now()
		
		result := m.db.Save(conversation)
		if result.Error != nil {
			m.logger.Warnf("Failed to update conversation: %v", result.Error)
		}
		
		return conversation, nil
	}
	
	// Create new conversation
	conversation = &models.Conversation{
		ID:             uuid.New().String(),
		CustomerID:     customerID,
		Channel:        message.Channel,
		Status:         models.ConversationStatusActive,
		LastActivityAt: time.Now(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	
	result := m.db.Create(conversation)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", result.Error)
	}
	
	return conversation, nil
}

// findConversation finds a conversation for a customer and channel
func (m *ChannelManager) findConversation(
	ctx context.Context,
	customerID string,
	channel string,
) (*models.Conversation, error) {
	var conversation models.Conversation
	
	result := m.db.
		Where("customer_id = ? AND channel = ?", customerID, channel).
		Order("last_activity_at desc").
		First(&conversation)
	
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find conversation: %w", result.Error)
	}
	
	return &conversation, nil
}

// addMessageToConversation adds a message to a conversation
func (m *ChannelManager) addMessageToConversation(
	ctx context.Context,
	conversationID string,
	messageID string,
) error {
	// Update message with conversation ID
	result := m.db.Model(&models.Message{}).
		Where("id = ?", messageID).
		Update("conversation_id", conversationID)
	
	return result.Error
}

// publishMessageProcessingEvent publishes an event for message processing
func (m *ChannelManager) publishMessageProcessingEvent(
	message *models.Message,
	conversation *models.Conversation,
) error {
	// Create event
	event := map[string]interface{}{
		"event_type":      "message_received",
		"message_id":      message.ID,
		"conversation_id": conversation.ID,
		"customer_id":     conversation.CustomerID,
		"channel":         message.Channel,
		"timestamp":       time.Now().Unix(),
	}
	
	// Serialize event
	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}
	
	// Publish to Redis
	if err := m.redisClient.Publish(context.Background(), "events:message_processing", eventJSON).Err(); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	
	return nil
}

// findCustomerByContact finds a customer by contact information
func (m *ChannelManager) findCustomerByContact(
	ctx context.Context,
	channel string,
	contact string,
) (*models.Customer, error) {
	var customer models.Customer
	
	// Query based on channel type
	query := ""
	switch channel {
	case string(ChannelWhatsApp), string(ChannelSMS):
		query = "phone_number = ?"
	case string(ChannelEmail):
		query = "email = ?"
	default:
		return nil, fmt.Errorf("unsupported channel for customer lookup: %s", channel)
	}
	
	result := m.db.Where(query, contact).First(&customer)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find customer: %w", result.Error)
	}
	
	return &customer, nil
}

// getTemplate gets a template by ID and language
func (m *ChannelManager) getTemplate(
	ctx context.Context,
	templateID string,
	language string,
) (*models.MessageTemplate, error) {
	var template models.MessageTemplate
	
	result := m.db.
		Where("template_id = ? AND language = ?", templateID, language).
		First(&template)
	
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			// Try to get default language template
			result = m.db.
				Where("template_id = ? AND language = ?", templateID, "english").
				First(&template)
			
			if result.Error != nil {
				return nil, fmt.Errorf("failed to get template: %w", result.Error)
			}
		} else {
			return nil, fmt.Errorf("failed to get template: %w", result.Error)
		}
	}
	
	return &template, nil
}

// renderTemplate renders a template with parameters
func (m *ChannelManager) renderTemplate(
	template *models.MessageTemplate,
	params map[string]interface{},
) (string, error) {
	// Simple template rendering for now
	// In a real implementation, use a proper template engine
	content := template.Content
	
	// Replace placeholders with values
	for key, value := range params {
		placeholder := fmt.Sprintf("{{%s}}", key)
		content = fmt.Sprintf(content, placeholder, fmt.Sprintf("%v", value))
	}
	
	return content, nil
}


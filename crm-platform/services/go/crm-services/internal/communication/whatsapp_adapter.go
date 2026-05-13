package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// WhatsAppAdapter implements the ChannelAdapter interface for WhatsApp
type WhatsAppAdapter struct {
	db             *gorm.DB
	redisClient    *redis.Client
	logger         *zap.SugaredLogger
	apiKey         string
	apiSecret      string
	baseURL        string
	webhookSecret  string
	httpClient     *http.Client
	businessPhoneNumber string
}

// WhatsAppMessageType represents the type of WhatsApp message
type WhatsAppMessageType string

const (
	WhatsAppMessageTypeText       WhatsAppMessageType = "text"
	WhatsAppMessageTypeTemplate   WhatsAppMessageType = "template"
	WhatsAppMessageTypeImage      WhatsAppMessageType = "image"
	WhatsAppMessageTypeDocument   WhatsAppMessageType = "document"
	WhatsAppMessageTypeInteractive WhatsAppMessageType = "interactive"
)

// WhatsAppConfig contains configuration for the WhatsApp adapter
type WhatsAppConfig struct {
	APIKey         string
	APISecret      string
	BaseURL        string
	WebhookSecret  string
	BusinessPhoneNumber string
}

// NewWhatsAppAdapter creates a new WhatsApp adapter
func NewWhatsAppAdapter(
	db *gorm.DB,
	redisClient *redis.Client,
	logger *zap.SugaredLogger,
	config WhatsAppConfig,
) *WhatsAppAdapter {
	return &WhatsAppAdapter{
		db:             db,
		redisClient:    redisClient,
		logger:         logger,
		apiKey:         config.APIKey,
		apiSecret:      config.APISecret,
		baseURL:        config.BaseURL,
		webhookSecret:  config.WebhookSecret,
		businessPhoneNumber: config.BusinessPhoneNumber,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendMessage sends a message through WhatsApp
func (a *WhatsAppAdapter) SendMessage(ctx context.Context, message *models.Message) (*MessageResult, error) {
	// Format phone number
	recipient := formatPhoneNumber(message.Recipient)
	
	// Determine message type
	messageType := WhatsAppMessageTypeText
	if message.Metadata != nil {
		if mt, ok := message.Metadata["whatsapp_message_type"].(string); ok {
			messageType = WhatsAppMessageType(mt)
		}
	}
	
	// Prepare request body based on message type
	var requestBody map[string]interface{}
	var err error
	
	switch messageType {
	case WhatsAppMessageTypeText:
		requestBody, err = a.prepareTextMessage(recipient, message.Content)
	case WhatsAppMessageTypeTemplate:
		templateName, _ := message.Metadata["template_name"].(string)
		templateParams, _ := message.Metadata["template_params"].(map[string]interface{})
		requestBody, err = a.prepareTemplateMessage(recipient, templateName, templateParams)
	case WhatsAppMessageTypeImage:
		imageURL, _ := message.Metadata["image_url"].(string)
		caption, _ := message.Metadata["caption"].(string)
		requestBody, err = a.prepareImageMessage(recipient, imageURL, caption)
	case WhatsAppMessageTypeDocument:
		documentURL, _ := message.Metadata["document_url"].(string)
		filename, _ := message.Metadata["filename"].(string)
		caption, _ := message.Metadata["caption"].(string)
		requestBody, err = a.prepareDocumentMessage(recipient, documentURL, filename, caption)
	case WhatsAppMessageTypeInteractive:
		interactiveType, _ := message.Metadata["interactive_type"].(string)
		interactiveData, _ := message.Metadata["interactive_data"].(map[string]interface{})
		requestBody, err = a.prepareInteractiveMessage(recipient, interactiveType, interactiveData)
	default:
		return nil, fmt.Errorf("unsupported WhatsApp message type: %s", messageType)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to prepare WhatsApp message: %w", err)
	}
	
	// Send message to WhatsApp API
	responseBody, err := a.sendWhatsAppRequest(ctx, "messages", requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to send WhatsApp message: %w", err)
	}
	
	// Extract message ID from response
	messageID, ok := responseBody["messages"].([]interface{})[0].(map[string]interface{})["id"].(string)
	if !ok {
		return nil, fmt.Errorf("failed to extract message ID from WhatsApp response")
	}
	
	return &MessageResult{
		ProviderMessageID: messageID,
		ProviderResponse:  responseBody,
	}, nil
}

// ReceiveMessage processes an incoming WhatsApp message
func (a *WhatsAppAdapter) ReceiveMessage(ctx context.Context, payload map[string]interface{}) (*models.Message, error) {
	// Extract message data from payload
	entry, ok := payload["entry"].([]interface{})
	if !ok || len(entry) == 0 {
		return nil, fmt.Errorf("invalid WhatsApp webhook payload format")
	}
	
	changes, ok := entry[0].(map[string]interface{})["changes"].([]interface{})
	if !ok || len(changes) == 0 {
		return nil, fmt.Errorf("invalid WhatsApp webhook payload format")
	}
	
	value, ok := changes[0].(map[string]interface{})["value"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid WhatsApp webhook payload format")
	}
	
	messages, ok := value["messages"].([]interface{})
	if !ok || len(messages) == 0 {
		// This might be a status update, not a message
		a.logger.Debugf("Received WhatsApp webhook with no messages")
		return nil, nil
	}
	
	messageData, ok := messages[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid WhatsApp message format")
	}
	
	// Extract message details
	messageID, _ := messageData["id"].(string)
	from, _ := messageData["from"].(string)
	timestamp, _ := messageData["timestamp"].(string)
	
	// Extract message content based on type
	messageType, _ := messageData["type"].(string)
	var content string
	var metadata map[string]interface{}
	
	switch messageType {
	case "text":
		textData, ok := messageData["text"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid WhatsApp text message format")
		}
		content, _ = textData["body"].(string)
	case "image":
		imageData, ok := messageData["image"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid WhatsApp image message format")
		}
		caption, _ := imageData["caption"].(string)
		content = caption
		metadata = map[string]interface{}{
			"media_type": "image",
			"media_id":   imageData["id"],
			"mime_type":  imageData["mime_type"],
		}
	case "document":
		documentData, ok := messageData["document"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid WhatsApp document message format")
		}
		caption, _ := documentData["caption"].(string)
		content = caption
		metadata = map[string]interface{}{
			"media_type": "document",
			"media_id":   documentData["id"],
			"filename":   documentData["filename"],
			"mime_type":  documentData["mime_type"],
		}
	case "interactive":
		interactiveData, ok := messageData["interactive"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid WhatsApp interactive message format")
		}
		
		interactiveType, _ := interactiveData["type"].(string)
		switch interactiveType {
		case "button_reply":
			buttonReply, _ := interactiveData["button_reply"].(map[string]interface{})
			id, _ := buttonReply["id"].(string)
			title, _ := buttonReply["title"].(string)
			content = title
			metadata = map[string]interface{}{
				"interactive_type": "button_reply",
				"button_id":        id,
				"button_title":     title,
			}
		case "list_reply":
			listReply, _ := interactiveData["list_reply"].(map[string]interface{})
			id, _ := listReply["id"].(string)
			title, _ := listReply["title"].(string)
			content = title
			metadata = map[string]interface{}{
				"interactive_type": "list_reply",
				"list_id":          id,
				"list_title":       title,
			}
		default:
			return nil, fmt.Errorf("unsupported WhatsApp interactive message type: %s", interactiveType)
		}
	default:
		return nil, fmt.Errorf("unsupported WhatsApp message type: %s", messageType)
	}
	
	// Parse timestamp
	var createdAt time.Time
	if timestamp != "" {
		timestampInt, err := parseInt64(timestamp)
		if err == nil {
			createdAt = time.Unix(timestampInt, 0)
		} else {
			createdAt = time.Now()
		}
	} else {
		createdAt = time.Now()
	}
	
	// Create message
	message := &models.Message{
		ID:                messageID,
		Channel:           "whatsapp",
		Direction:         models.MessageDirectionInbound,
		Recipient:         a.businessPhoneNumber,
		Sender:            from,
		Content:           content,
		Metadata:          metadata,
		Status:            models.MessageStatusReceived,
		ProviderMessageID: messageID,
		CreatedAt:         createdAt,
		UpdatedAt:         time.Now(),
	}
	
	return message, nil
}

// HandleStatusUpdate processes a status update from WhatsApp
func (a *WhatsAppAdapter) HandleStatusUpdate(ctx context.Context, payload map[string]interface{}) error {
	// Extract status data from payload
	entry, ok := payload["entry"].([]interface{})
	if !ok || len(entry) == 0 {
		return fmt.Errorf("invalid WhatsApp webhook payload format")
	}
	
	changes, ok := entry[0].(map[string]interface{})["changes"].([]interface{})
	if !ok || len(changes) == 0 {
		return fmt.Errorf("invalid WhatsApp webhook payload format")
	}
	
	value, ok := changes[0].(map[string]interface{})["value"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid WhatsApp webhook payload format")
	}
	
	statuses, ok := value["statuses"].([]interface{})
	if !ok || len(statuses) == 0 {
		return fmt.Errorf("invalid WhatsApp status update format")
	}
	
	statusData, ok := statuses[0].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid WhatsApp status data format")
	}
	
	// Extract status details
	messageID, _ := statusData["id"].(string)
	status, _ := statusData["status"].(string)
	timestamp, _ := statusData["timestamp"].(string)
	
	// Map WhatsApp status to our status
	var messageStatus string
	switch status {
	case "sent":
		messageStatus = models.MessageStatusSent
	case "delivered":
		messageStatus = models.MessageStatusDelivered
	case "read":
		messageStatus = models.MessageStatusRead
	case "failed":
		messageStatus = models.MessageStatusFailed
	default:
		messageStatus = models.MessageStatusUnknown
	}
	
	// Update message status in database
	result := a.db.Model(&models.Message{}).
		Where("provider_message_id = ?", messageID).
		Updates(map[string]interface{}{
			"status":     messageStatus,
			"updated_at": time.Now(),
		})
	
	if result.Error != nil {
		return fmt.Errorf("failed to update message status: %w", result.Error)
	}
	
	// Publish status update to Redis
	statusUpdate := map[string]interface{}{
		"provider_message_id": messageID,
		"status":              messageStatus,
		"timestamp":           timestamp,
	}
	
	statusJSON, err := json.Marshal(statusUpdate)
	if err != nil {
		return fmt.Errorf("failed to marshal status update: %w", err)
	}
	
	if err := a.redisClient.Publish(ctx, "whatsapp:status_updates", statusJSON).Err(); err != nil {
		return fmt.Errorf("failed to publish status update: %w", err)
	}
	
	return nil
}

// VerifyWebhook verifies a WhatsApp webhook request
func (a *WhatsAppAdapter) VerifyWebhook(r *http.Request) (bool, string) {
	// Extract verification parameters
	mode := r.URL.Query().Get("hub.mode")
	token := r.URL.Query().Get("hub.verify_token")
	challenge := r.URL.Query().Get("hub.challenge")
	
	// Verify token
	if mode == "subscribe" && token == a.webhookSecret {
		return true, challenge
	}
	
	return false, ""
}

// prepareTextMessage prepares a text message request
func (a *WhatsAppAdapter) prepareTextMessage(recipient string, content string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "text",
		"text": map[string]interface{}{
			"body": content,
		},
	}, nil
}

// prepareTemplateMessage prepares a template message request
func (a *WhatsAppAdapter) prepareTemplateMessage(
	recipient string,
	templateName string,
	params map[string]interface{},
) (map[string]interface{}, error) {
	// Convert params to template components
	components := []map[string]interface{}{}
	
	// Add header component if present
	if header, ok := params["header"].(map[string]interface{}); ok {
		headerComponent := map[string]interface{}{
			"type": "header",
			"parameters": []map[string]interface{}{},
		}
		
		// Add header parameters
		if headerType, ok := header["type"].(string); ok {
			switch headerType {
			case "text":
				if text, ok := header["text"].(string); ok {
					headerComponent["parameters"] = append(
						headerComponent["parameters"].([]map[string]interface{}),
						map[string]interface{}{
							"type": "text",
							"text": text,
						},
					)
				}
			case "image":
				if imageURL, ok := header["image_url"].(string); ok {
					headerComponent["parameters"] = append(
						headerComponent["parameters"].([]map[string]interface{}),
						map[string]interface{}{
							"type": "image",
							"image": map[string]interface{}{
								"link": imageURL,
							},
						},
					)
				}
			case "document":
				if documentURL, ok := header["document_url"].(string); ok {
					headerComponent["parameters"] = append(
						headerComponent["parameters"].([]map[string]interface{}),
						map[string]interface{}{
							"type": "document",
							"document": map[string]interface{}{
								"link": documentURL,
							},
						},
					)
				}
			}
		}
		
		components = append(components, headerComponent)
	}
	
	// Add body component if present
	if body, ok := params["body"].([]interface{}); ok {
		bodyComponent := map[string]interface{}{
			"type": "body",
			"parameters": []map[string]interface{}{},
		}
		
		// Add body parameters
		for _, param := range body {
			if paramMap, ok := param.(map[string]interface{}); ok {
				paramType, _ := paramMap["type"].(string)
				switch paramType {
				case "text":
					if text, ok := paramMap["text"].(string); ok {
						bodyComponent["parameters"] = append(
							bodyComponent["parameters"].([]map[string]interface{}),
							map[string]interface{}{
								"type": "text",
								"text": text,
							},
						)
					}
				case "currency":
					if currency, ok := paramMap["currency"].(map[string]interface{}); ok {
						bodyComponent["parameters"] = append(
							bodyComponent["parameters"].([]map[string]interface{}),
							map[string]interface{}{
								"type": "currency",
								"currency": map[string]interface{}{
									"fallback_value": currency["fallback_value"],
									"code":           currency["code"],
									"amount_1000":    currency["amount_1000"],
								},
							},
						)
					}
				case "date_time":
					if dateTime, ok := paramMap["date_time"].(map[string]interface{}); ok {
						bodyComponent["parameters"] = append(
							bodyComponent["parameters"].([]map[string]interface{}),
							map[string]interface{}{
								"type": "date_time",
								"date_time": map[string]interface{}{
									"fallback_value": dateTime["fallback_value"],
								},
							},
						)
					}
				}
			}
		}
		
		components = append(components, bodyComponent)
	}
	
	// Add buttons component if present
	if buttons, ok := params["buttons"].([]interface{}); ok {
		for i, button := range buttons {
			if buttonMap, ok := button.(map[string]interface{}); ok {
				buttonComponent := map[string]interface{}{
					"type":       "button",
					"sub_type":   "quick_reply",
					"index":      i,
					"parameters": []map[string]interface{}{},
				}
				
				if payload, ok := buttonMap["payload"].(string); ok {
					buttonComponent["parameters"] = append(
						buttonComponent["parameters"].([]map[string]interface{}),
						map[string]interface{}{
							"type":    "payload",
							"payload": payload,
						},
					)
				}
				
				components = append(components, buttonComponent)
			}
		}
	}
	
	// Create template message request
	return map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "template",
		"template": map[string]interface{}{
			"name":       templateName,
			"language":   map[string]interface{}{"code": "en_US"},
			"components": components,
		},
	}, nil
}

// prepareImageMessage prepares an image message request
func (a *WhatsAppAdapter) prepareImageMessage(
	recipient string,
	imageURL string,
	caption string,
) (map[string]interface{}, error) {
	return map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "image",
		"image": map[string]interface{}{
			"link":    imageURL,
			"caption": caption,
		},
	}, nil
}

// prepareDocumentMessage prepares a document message request
func (a *WhatsAppAdapter) prepareDocumentMessage(
	recipient string,
	documentURL string,
	filename string,
	caption string,
) (map[string]interface{}, error) {
	return map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "document",
		"document": map[string]interface{}{
			"link":     documentURL,
			"filename": filename,
			"caption":  caption,
		},
	}, nil
}

// prepareInteractiveMessage prepares an interactive message request
func (a *WhatsAppAdapter) prepareInteractiveMessage(
	recipient string,
	interactiveType string,
	interactiveData map[string]interface{},
) (map[string]interface{}, error) {
	interactive := map[string]interface{}{}
	
	switch interactiveType {
	case "button":
		// Add header if present
		if header, ok := interactiveData["header"].(map[string]interface{}); ok {
			interactive["header"] = header
		}
		
		// Add body
		if body, ok := interactiveData["body"].(string); ok {
			interactive["body"] = map[string]interface{}{
				"text": body,
			}
		}
		
		// Add footer if present
		if footer, ok := interactiveData["footer"].(string); ok {
			interactive["footer"] = map[string]interface{}{
				"text": footer,
			}
		}
		
		// Add buttons
		if buttons, ok := interactiveData["buttons"].([]interface{}); ok {
			buttonList := []map[string]interface{}{}
			
			for _, button := range buttons {
				if buttonMap, ok := button.(map[string]interface{}); ok {
					buttonType, _ := buttonMap["type"].(string)
					buttonText, _ := buttonMap["text"].(string)
					buttonID, _ := buttonMap["id"].(string)
					
					buttonList = append(buttonList, map[string]interface{}{
						"type": buttonType,
						"reply": map[string]interface{}{
							"id":    buttonID,
							"title": buttonText,
						},
					})
				}
			}
			
			interactive["action"] = map[string]interface{}{
				"buttons": buttonList,
			}
		}
		
		interactive["type"] = "button"
	case "list":
		// Add header if present
		if header, ok := interactiveData["header"].(map[string]interface{}); ok {
			interactive["header"] = header
		}
		
		// Add body
		if body, ok := interactiveData["body"].(string); ok {
			interactive["body"] = map[string]interface{}{
				"text": body,
			}
		}
		
		// Add footer if present
		if footer, ok := interactiveData["footer"].(string); ok {
			interactive["footer"] = map[string]interface{}{
				"text": footer,
			}
		}
		
		// Add button text
		if buttonText, ok := interactiveData["button_text"].(string); ok {
			interactive["action"] = map[string]interface{}{
				"button": buttonText,
			}
		}
		
		// Add sections
		if sections, ok := interactiveData["sections"].([]interface{}); ok {
			sectionList := []map[string]interface{}{}
			
			for _, section := range sections {
				if sectionMap, ok := section.(map[string]interface{}); ok {
					sectionTitle, _ := sectionMap["title"].(string)
					sectionRows, _ := sectionMap["rows"].([]interface{})
					
					rowList := []map[string]interface{}{}
					for _, row := range sectionRows {
						if rowMap, ok := row.(map[string]interface{}); ok {
							rowID, _ := rowMap["id"].(string)
							rowTitle, _ := rowMap["title"].(string)
							rowDescription, _ := rowMap["description"].(string)
							
							rowList = append(rowList, map[string]interface{}{
								"id":          rowID,
								"title":       rowTitle,
								"description": rowDescription,
							})
						}
					}
					
					sectionList = append(sectionList, map[string]interface{}{
						"title": sectionTitle,
						"rows":  rowList,
					})
				}
			}
			
			if action, ok := interactive["action"].(map[string]interface{}); ok {
				action["sections"] = sectionList
			} else {
				interactive["action"] = map[string]interface{}{
					"sections": sectionList,
				}
			}
		}
		
		interactive["type"] = "list"
	default:
		return nil, fmt.Errorf("unsupported interactive message type: %s", interactiveType)
	}
	
	return map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "interactive",
		"interactive":       interactive,
	}, nil
}

// sendWhatsAppRequest sends a request to the WhatsApp API
func (a *WhatsAppAdapter) sendWhatsAppRequest(
	ctx context.Context,
	endpoint string,
	body map[string]interface{},
) (map[string]interface{}, error) {
	// Convert body to JSON
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}
	
	// Create request
	url := fmt.Sprintf("%s/%s", a.baseURL, endpoint)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(bodyJSON)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// Add headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", a.apiKey))
	
	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errorResponse map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&errorResponse); err != nil {
			return nil, fmt.Errorf("failed to decode error response: %w", err)
		}
		
		return nil, fmt.Errorf("WhatsApp API error: %d - %v", resp.StatusCode, errorResponse)
	}
	
	// Decode response
	var responseBody map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&responseBody); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return responseBody, nil
}

// Helper functions

// formatPhoneNumber formats a phone number for WhatsApp API
func formatPhoneNumber(phoneNumber string) string {
	// Remove any non-digit characters
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phoneNumber)
	
	// Ensure it has country code
	if !strings.HasPrefix(digits, "234") && !strings.HasPrefix(digits, "+234") {
		// Assume Nigerian number
		if strings.HasPrefix(digits, "0") {
			digits = "234" + digits[1:]
		} else {
			digits = "234" + digits
		}
	} else if strings.HasPrefix(digits, "+") {
		digits = digits[1:]
	}
	
	return digits
}

// parseInt64 parses a string to int64
func parseInt64(s string) (int64, error) {
	var i int64
	_, err := fmt.Sscanf(s, "%d", &i)
	return i, err
}


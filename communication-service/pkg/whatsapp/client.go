package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/insurance-platform/communication-service/internal/models"
	"go.uber.org/zap"
)

// Client represents a WhatsApp Business API client
type Client struct {
	apiURL      string
	accessToken string
	phoneID     string
	httpClient  *http.Client
	logger      *zap.Logger
}

// NewClient creates a new WhatsApp client
func NewClient(apiURL, accessToken, phoneID string, logger *zap.Logger) *Client {
	return &Client{
		apiURL:      apiURL,
		accessToken: accessToken,
		phoneID:     phoneID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// SendTextMessage sends a text message via WhatsApp
func (c *Client) SendTextMessage(ctx context.Context, recipient, message string) (string, error) {
	c.logger.Info("Sending WhatsApp text message",
		zap.String("recipient", recipient),
		zap.Int("message_length", len(message)))

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "text",
		"text": map[string]string{
			"preview_url": "false",
			"body":        message,
		},
	}

	return c.sendRequest(ctx, payload)
}

// SendTemplateMessage sends a template message via WhatsApp
func (c *Client) SendTemplateMessage(ctx context.Context, recipient, templateName, languageCode string, variables map[string]string) (string, error) {
	c.logger.Info("Sending WhatsApp template message",
		zap.String("recipient", recipient),
		zap.String("template", templateName))

	// Build template components
	components := []map[string]interface{}{}
	
	if len(variables) > 0 {
		parameters := []map[string]string{}
		for _, value := range variables {
			parameters = append(parameters, map[string]string{
				"type": "text",
				"text": value,
			})
		}
		
		components = append(components, map[string]interface{}{
			"type":       "body",
			"parameters": parameters,
		})
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "template",
		"template": map[string]interface{}{
			"name": templateName,
			"language": map[string]string{
				"code": languageCode,
			},
			"components": components,
		},
	}

	return c.sendRequest(ctx, payload)
}

// SendMediaMessage sends a media message (image, document) via WhatsApp
func (c *Client) SendMediaMessage(ctx context.Context, recipient, mediaType, mediaURL, caption string) (string, error) {
	c.logger.Info("Sending WhatsApp media message",
		zap.String("recipient", recipient),
		zap.String("media_type", mediaType),
		zap.String("media_url", mediaURL))

	mediaPayload := map[string]interface{}{
		"link": mediaURL,
	}
	
	if caption != "" {
		mediaPayload["caption"] = caption
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              mediaType,
		mediaType:           mediaPayload,
	}

	return c.sendRequest(ctx, payload)
}

// SendInteractiveMessage sends an interactive message with buttons
func (c *Client) SendInteractiveMessage(ctx context.Context, recipient, bodyText string, buttons []Button) (string, error) {
	c.logger.Info("Sending WhatsApp interactive message",
		zap.String("recipient", recipient),
		zap.Int("button_count", len(buttons)))

	buttonComponents := []map[string]interface{}{}
	for _, btn := range buttons {
		buttonComponents = append(buttonComponents, map[string]interface{}{
			"type": "reply",
			"reply": map[string]string{
				"id":    btn.ID,
				"title": btn.Title,
			},
		})
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "button",
			"body": map[string]string{
				"text": bodyText,
			},
			"action": map[string]interface{}{
				"buttons": buttonComponents,
			},
		},
	}

	return c.sendRequest(ctx, payload)
}

// sendRequest sends an HTTP request to WhatsApp API
func (c *Client) sendRequest(ctx context.Context, payload map[string]interface{}) (string, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/%s/messages", c.apiURL, c.phoneID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.accessToken))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.logger.Error("WhatsApp API error",
			zap.Int("status_code", resp.StatusCode),
			zap.String("response", string(body)))
		return "", fmt.Errorf("WhatsApp API error: %s", string(body))
	}

	var result WhatsAppResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(result.Messages) == 0 {
		return "", fmt.Errorf("no message ID in response")
	}

	c.logger.Info("WhatsApp message sent successfully",
		zap.String("message_id", result.Messages[0].ID))

	return result.Messages[0].ID, nil
}

// HandleWebhook processes incoming WhatsApp webhook events
func (c *Client) HandleWebhook(ctx context.Context, payload []byte) (*models.InboundMessage, error) {
	var webhook WhatsAppWebhook
	if err := json.Unmarshal(payload, &webhook); err != nil {
		return nil, fmt.Errorf("failed to unmarshal webhook: %w", err)
	}

	if len(webhook.Entry) == 0 || len(webhook.Entry[0].Changes) == 0 {
		return nil, fmt.Errorf("invalid webhook payload")
	}

	change := webhook.Entry[0].Changes[0]
	if len(change.Value.Messages) == 0 {
		return nil, fmt.Errorf("no messages in webhook")
	}

	msg := change.Value.Messages[0]

	inboundMsg := &models.InboundMessage{
		ID:        msg.ID,
		Channel:   models.ChannelWhatsApp,
		Sender:    msg.From,
		CreatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"timestamp": msg.Timestamp,
		},
	}

	// Extract content based on message type
	switch msg.Type {
	case "text":
		inboundMsg.Content = msg.Text.Body
	case "image":
		inboundMsg.MediaURL = msg.Image.ID
		inboundMsg.Content = msg.Image.Caption
	case "document":
		inboundMsg.MediaURL = msg.Document.ID
		inboundMsg.Content = msg.Document.Filename
	default:
		inboundMsg.Content = fmt.Sprintf("Unsupported message type: %s", msg.Type)
	}

	c.logger.Info("Received WhatsApp message",
		zap.String("message_id", msg.ID),
		zap.String("sender", msg.From),
		zap.String("type", msg.Type))

	return inboundMsg, nil
}

// Button represents a button in an interactive message
type Button struct {
	ID    string
	Title string
}

// WhatsAppResponse represents the API response
type WhatsAppResponse struct {
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
}

// WhatsAppWebhook represents incoming webhook data
type WhatsAppWebhook struct {
	Entry []struct {
		Changes []struct {
			Value struct {
				Messages []struct {
					ID        string `json:"id"`
					From      string `json:"from"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      struct {
						Body string `json:"body"`
					} `json:"text"`
					Image struct {
						ID      string `json:"id"`
						Caption string `json:"caption"`
					} `json:"image"`
					Document struct {
						ID       string `json:"id"`
						Filename string `json:"filename"`
					} `json:"document"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/models"
)

// TelegramMessageType represents the type of Telegram message
type TelegramMessageType string

const (
	TelegramMessageTypeText     TelegramMessageType = "text"
	TelegramMessageTypePhoto    TelegramMessageType = "photo"
	TelegramMessageTypeDocument TelegramMessageType = "document"
	TelegramMessageTypeInline   TelegramMessageType = "inline_keyboard"
	TelegramMessageTypeVideo    TelegramMessageType = "video"
	TelegramMessageTypeVoice    TelegramMessageType = "voice"
)

// TelegramConfig contains configuration for the Telegram adapter
type TelegramConfig struct {
	BotToken       string
	WebhookURL     string
	WebhookSecret  string
	ParseMode      string // "HTML" or "MarkdownV2"
	DefaultTimeout int    // seconds
}

// TelegramAdapter implements the ChannelAdapter interface for Telegram Bot API
type TelegramAdapter struct {
	db          *gorm.DB
	redisClient *redis.Client
	logger      *zap.SugaredLogger
	botToken    string
	baseURL     string
	webhookURL  string
	webhookSecret string
	parseMode   string
	httpClient  *http.Client
}

// NewTelegramAdapter creates a new Telegram adapter
func NewTelegramAdapter(
	db *gorm.DB,
	redisClient *redis.Client,
	logger *zap.SugaredLogger,
	config TelegramConfig,
) *TelegramAdapter {
	timeout := 30
	if config.DefaultTimeout > 0 {
		timeout = config.DefaultTimeout
	}

	parseMode := "HTML"
	if config.ParseMode != "" {
		parseMode = config.ParseMode
	}

	return &TelegramAdapter{
		db:            db,
		redisClient:   redisClient,
		logger:        logger,
		botToken:      config.BotToken,
		baseURL:       fmt.Sprintf("https://api.telegram.org/bot%s", config.BotToken),
		webhookURL:    config.WebhookURL,
		webhookSecret: config.WebhookSecret,
		parseMode:     parseMode,
		httpClient: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}
}

// SendMessage sends a message through Telegram Bot API
func (a *TelegramAdapter) SendMessage(ctx context.Context, message *models.Message) (*MessageResult, error) {
	chatID := message.Recipient

	messageType := TelegramMessageTypeText
	if message.Metadata != nil {
		if mt, ok := message.Metadata["telegram_message_type"].(string); ok {
			messageType = TelegramMessageType(mt)
		}
	}

	var response map[string]interface{}
	var err error

	switch messageType {
	case TelegramMessageTypeText:
		response, err = a.sendTextMessage(ctx, chatID, message.Content)
	case TelegramMessageTypePhoto:
		photoURL, _ := message.Metadata["photo_url"].(string)
		caption, _ := message.Metadata["caption"].(string)
		response, err = a.sendPhoto(ctx, chatID, photoURL, caption)
	case TelegramMessageTypeDocument:
		documentURL, _ := message.Metadata["document_url"].(string)
		caption, _ := message.Metadata["caption"].(string)
		response, err = a.sendDocument(ctx, chatID, documentURL, caption)
	case TelegramMessageTypeInline:
		keyboard, _ := message.Metadata["inline_keyboard"].([]interface{})
		response, err = a.sendInlineKeyboard(ctx, chatID, message.Content, keyboard)
	case TelegramMessageTypeVideo:
		videoURL, _ := message.Metadata["video_url"].(string)
		caption, _ := message.Metadata["caption"].(string)
		response, err = a.sendVideo(ctx, chatID, videoURL, caption)
	case TelegramMessageTypeVoice:
		voiceURL, _ := message.Metadata["voice_url"].(string)
		response, err = a.sendVoice(ctx, chatID, voiceURL)
	default:
		return nil, fmt.Errorf("unsupported Telegram message type: %s", messageType)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to send Telegram message: %w", err)
	}

	result, ok := response["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid Telegram API response format")
	}

	messageID := ""
	if mid, ok := result["message_id"].(float64); ok {
		messageID = strconv.FormatInt(int64(mid), 10)
	}

	return &MessageResult{
		ProviderMessageID: messageID,
		ProviderResponse:  response,
	}, nil
}

// ReceiveMessage processes an incoming Telegram webhook update
func (a *TelegramAdapter) ReceiveMessage(ctx context.Context, payload map[string]interface{}) (*models.Message, error) {
	msgData, ok := payload["message"].(map[string]interface{})
	if !ok {
		cbQuery, cbOk := payload["callback_query"].(map[string]interface{})
		if cbOk {
			return a.processCallbackQuery(ctx, cbQuery)
		}
		return nil, fmt.Errorf("unsupported Telegram update type")
	}

	from, ok := msgData["from"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid Telegram message: missing 'from' field")
	}

	chat, ok := msgData["chat"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid Telegram message: missing 'chat' field")
	}

	senderID := ""
	if id, ok := from["id"].(float64); ok {
		senderID = strconv.FormatInt(int64(id), 10)
	}

	chatID := ""
	if id, ok := chat["id"].(float64); ok {
		chatID = strconv.FormatInt(int64(id), 10)
	}

	messageID := ""
	if mid, ok := msgData["message_id"].(float64); ok {
		messageID = strconv.FormatInt(int64(mid), 10)
	}

	var content string
	var metadata map[string]interface{}

	if text, ok := msgData["text"].(string); ok {
		content = text
		metadata = map[string]interface{}{
			"telegram_message_type": "text",
		}
	} else if photo, ok := msgData["photo"].([]interface{}); ok && len(photo) > 0 {
		lastPhoto := photo[len(photo)-1].(map[string]interface{})
		fileID, _ := lastPhoto["file_id"].(string)
		caption, _ := msgData["caption"].(string)
		content = caption
		metadata = map[string]interface{}{
			"telegram_message_type": "photo",
			"file_id":              fileID,
		}
	} else if doc, ok := msgData["document"].(map[string]interface{}); ok {
		fileID, _ := doc["file_id"].(string)
		fileName, _ := doc["file_name"].(string)
		caption, _ := msgData["caption"].(string)
		content = caption
		metadata = map[string]interface{}{
			"telegram_message_type": "document",
			"file_id":              fileID,
			"file_name":            fileName,
		}
	} else if contact, ok := msgData["contact"].(map[string]interface{}); ok {
		phoneNumber, _ := contact["phone_number"].(string)
		firstName, _ := contact["first_name"].(string)
		content = fmt.Sprintf("Contact shared: %s (%s)", firstName, phoneNumber)
		metadata = map[string]interface{}{
			"telegram_message_type": "contact",
			"phone_number":         phoneNumber,
			"first_name":           firstName,
		}
	} else if location, ok := msgData["location"].(map[string]interface{}); ok {
		lat, _ := location["latitude"].(float64)
		lon, _ := location["longitude"].(float64)
		content = fmt.Sprintf("Location: %.6f, %.6f", lat, lon)
		metadata = map[string]interface{}{
			"telegram_message_type": "location",
			"latitude":             lat,
			"longitude":            lon,
		}
	}

	firstName, _ := from["first_name"].(string)
	lastName, _ := from["last_name"].(string)
	username, _ := from["username"].(string)

	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["sender_first_name"] = firstName
	metadata["sender_last_name"] = lastName
	metadata["sender_username"] = username
	metadata["chat_id"] = chatID

	return &models.Message{
		ID:                messageID,
		Channel:           "telegram",
		Direction:         models.MessageDirectionInbound,
		Sender:            senderID,
		Recipient:         chatID,
		Content:           content,
		Metadata:          metadata,
		Status:            models.MessageStatusReceived,
		ProviderMessageID: messageID,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}, nil
}

// processCallbackQuery handles inline keyboard button presses
func (a *TelegramAdapter) processCallbackQuery(ctx context.Context, cbQuery map[string]interface{}) (*models.Message, error) {
	from, ok := cbQuery["from"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid callback query: missing 'from' field")
	}

	senderID := ""
	if id, ok := from["id"].(float64); ok {
		senderID = strconv.FormatInt(int64(id), 10)
	}

	callbackData, _ := cbQuery["data"].(string)
	queryID, _ := cbQuery["id"].(string)

	if err := a.answerCallbackQuery(ctx, queryID); err != nil {
		a.logger.Warnf("Failed to answer callback query: %v", err)
	}

	chatID := ""
	if msg, ok := cbQuery["message"].(map[string]interface{}); ok {
		if chat, ok := msg["chat"].(map[string]interface{}); ok {
			if id, ok := chat["id"].(float64); ok {
				chatID = strconv.FormatInt(int64(id), 10)
			}
		}
	}

	return &models.Message{
		ID:        queryID,
		Channel:   "telegram",
		Direction: models.MessageDirectionInbound,
		Sender:    senderID,
		Recipient: chatID,
		Content:   callbackData,
		Metadata: map[string]interface{}{
			"telegram_message_type": "callback_query",
			"callback_data":        callbackData,
			"query_id":             queryID,
		},
		Status:    models.MessageStatusReceived,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

// SetWebhook configures the Telegram webhook endpoint
func (a *TelegramAdapter) SetWebhook(ctx context.Context) error {
	params := url.Values{}
	params.Set("url", a.webhookURL)
	if a.webhookSecret != "" {
		params.Set("secret_token", a.webhookSecret)
	}
	params.Set("allowed_updates", `["message","callback_query","channel_post"]`)

	_, err := a.makeAPIRequest(ctx, "setWebhook", params)
	if err != nil {
		return fmt.Errorf("failed to set Telegram webhook: %w", err)
	}

	a.logger.Infof("Telegram webhook set to: %s", a.webhookURL)
	return nil
}

// DeleteWebhook removes the Telegram webhook
func (a *TelegramAdapter) DeleteWebhook(ctx context.Context) error {
	_, err := a.makeAPIRequest(ctx, "deleteWebhook", nil)
	if err != nil {
		return fmt.Errorf("failed to delete Telegram webhook: %w", err)
	}

	a.logger.Info("Telegram webhook deleted")
	return nil
}

// GetBotInfo retrieves the bot's profile information
func (a *TelegramAdapter) GetBotInfo(ctx context.Context) (map[string]interface{}, error) {
	return a.makeAPIRequest(ctx, "getMe", nil)
}

// sendTextMessage sends a plain text message
func (a *TelegramAdapter) sendTextMessage(ctx context.Context, chatID string, text string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("text", text)
	params.Set("parse_mode", a.parseMode)
	return a.makeAPIRequest(ctx, "sendMessage", params)
}

// sendPhoto sends a photo message
func (a *TelegramAdapter) sendPhoto(ctx context.Context, chatID string, photoURL string, caption string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("photo", photoURL)
	if caption != "" {
		params.Set("caption", caption)
		params.Set("parse_mode", a.parseMode)
	}
	return a.makeAPIRequest(ctx, "sendPhoto", params)
}

// sendDocument sends a document
func (a *TelegramAdapter) sendDocument(ctx context.Context, chatID string, documentURL string, caption string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("document", documentURL)
	if caption != "" {
		params.Set("caption", caption)
		params.Set("parse_mode", a.parseMode)
	}
	return a.makeAPIRequest(ctx, "sendDocument", params)
}

// sendVideo sends a video
func (a *TelegramAdapter) sendVideo(ctx context.Context, chatID string, videoURL string, caption string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("video", videoURL)
	if caption != "" {
		params.Set("caption", caption)
		params.Set("parse_mode", a.parseMode)
	}
	return a.makeAPIRequest(ctx, "sendVideo", params)
}

// sendVoice sends a voice message
func (a *TelegramAdapter) sendVoice(ctx context.Context, chatID string, voiceURL string) (map[string]interface{}, error) {
	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("voice", voiceURL)
	return a.makeAPIRequest(ctx, "sendVoice", params)
}

// sendInlineKeyboard sends a message with inline keyboard buttons
func (a *TelegramAdapter) sendInlineKeyboard(ctx context.Context, chatID string, text string, keyboard []interface{}) (map[string]interface{}, error) {
	replyMarkup := map[string]interface{}{
		"inline_keyboard": keyboard,
	}

	markupJSON, err := json.Marshal(replyMarkup)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal inline keyboard: %w", err)
	}

	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("text", text)
	params.Set("parse_mode", a.parseMode)
	params.Set("reply_markup", string(markupJSON))
	return a.makeAPIRequest(ctx, "sendMessage", params)
}

// SendCampaignMessage sends a promotional campaign message with CTA buttons
func (a *TelegramAdapter) SendCampaignMessage(
	ctx context.Context,
	chatID string,
	text string,
	buttons []CampaignButton,
) (*MessageResult, error) {
	var keyboardRows [][]map[string]interface{}
	for _, btn := range buttons {
		row := []map[string]interface{}{
			{
				"text":          btn.Text,
				"callback_data": btn.CallbackData,
			},
		}
		if btn.URL != "" {
			row[0] = map[string]interface{}{
				"text": btn.Text,
				"url":  btn.URL,
			}
		}
		keyboardRows = append(keyboardRows, row)
	}

	replyMarkup := map[string]interface{}{
		"inline_keyboard": keyboardRows,
	}

	markupJSON, err := json.Marshal(replyMarkup)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal campaign keyboard: %w", err)
	}

	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("text", text)
	params.Set("parse_mode", a.parseMode)
	params.Set("reply_markup", string(markupJSON))

	response, err := a.makeAPIRequest(ctx, "sendMessage", params)
	if err != nil {
		return nil, fmt.Errorf("failed to send campaign message: %w", err)
	}

	result, ok := response["result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid Telegram API response for campaign message")
	}

	messageID := ""
	if mid, ok := result["message_id"].(float64); ok {
		messageID = strconv.FormatInt(int64(mid), 10)
	}

	return &MessageResult{
		ProviderMessageID: messageID,
		ProviderResponse:  response,
	}, nil
}

// CampaignButton represents a button in a campaign message
type CampaignButton struct {
	Text         string `json:"text"`
	CallbackData string `json:"callback_data,omitempty"`
	URL          string `json:"url,omitempty"`
}

// answerCallbackQuery acknowledges a callback query
func (a *TelegramAdapter) answerCallbackQuery(ctx context.Context, queryID string) error {
	params := url.Values{}
	params.Set("callback_query_id", queryID)
	_, err := a.makeAPIRequest(ctx, "answerCallbackQuery", params)
	return err
}

// makeAPIRequest makes a request to the Telegram Bot API
func (a *TelegramAdapter) makeAPIRequest(ctx context.Context, method string, params url.Values) (map[string]interface{}, error) {
	apiURL := fmt.Sprintf("%s/%s", a.baseURL, method)

	var req *http.Request
	var err error

	if params != nil {
		req, err = http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(params.Encode()))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	} else {
		req, err = http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Telegram API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse Telegram API response: %w", err)
	}

	ok, _ := result["ok"].(bool)
	if !ok {
		description, _ := result["description"].(string)
		errorCode, _ := result["error_code"].(float64)
		return nil, fmt.Errorf("Telegram API error %d: %s", int(errorCode), description)
	}

	return result, nil
}

// formatPhoneNumber normalizes a phone number for Telegram matching
func formatTelegramPhoneNumber(phone string) string {
	phone = strings.TrimSpace(phone)
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	if !strings.HasPrefix(phone, "+") {
		if strings.HasPrefix(phone, "0") {
			phone = "+234" + phone[1:]
		} else {
			phone = "+" + phone
		}
	}
	return phone
}

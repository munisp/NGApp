package telegram

import (
	"context"
	"fmt"
	"strconv"

	"github.com/insurance-platform/communication-service/internal/models"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"go.uber.org/zap"
)

// Client represents a Telegram Bot API client
type Client struct {
	bot    *tgbotapi.BotAPI
	logger *zap.Logger
}

// NewClient creates a new Telegram client
func NewClient(botToken string, logger *zap.Logger) (*Client, error) {
	bot, err := tgbotapi.NewBotAPI(botToken)
	if err != nil {
		return nil, fmt.Errorf("failed to create Telegram bot: %w", err)
	}

	logger.Info("Telegram bot connected",
		zap.String("bot_username", bot.Self.UserName))

	return &Client{
		bot:    bot,
		logger: logger,
	}, nil
}

// SendTextMessage sends a text message via Telegram
func (c *Client) SendTextMessage(ctx context.Context, chatID string, message string) (int, error) {
	c.logger.Info("Sending Telegram message",
		zap.String("chat_id", chatID),
		zap.Int("message_length", len(message)))

	chatIDInt, err := strconv.ParseInt(chatID, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid chat ID: %w", err)
	}

	msg := tgbotapi.NewMessage(chatIDInt, message)
	msg.ParseMode = "Markdown"

	sentMsg, err := c.bot.Send(msg)
	if err != nil {
		c.logger.Error("Failed to send Telegram message",
			zap.String("chat_id", chatID),
			zap.Error(err))
		return 0, fmt.Errorf("failed to send message: %w", err)
	}

	c.logger.Info("Telegram message sent successfully",
		zap.Int("message_id", sentMsg.MessageID),
		zap.String("chat_id", chatID))

	return sentMsg.MessageID, nil
}

// SendPhoto sends a photo via Telegram
func (c *Client) SendPhoto(ctx context.Context, chatID, photoURL, caption string) (int, error) {
	c.logger.Info("Sending Telegram photo",
		zap.String("chat_id", chatID),
		zap.String("photo_url", photoURL))

	chatIDInt, err := strconv.ParseInt(chatID, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid chat ID: %w", err)
	}

	msg := tgbotapi.NewPhoto(chatIDInt, tgbotapi.FileURL(photoURL))
	msg.Caption = caption

	sentMsg, err := c.bot.Send(msg)
	if err != nil {
		c.logger.Error("Failed to send Telegram photo",
			zap.String("chat_id", chatID),
			zap.Error(err))
		return 0, fmt.Errorf("failed to send photo: %w", err)
	}

	c.logger.Info("Telegram photo sent successfully",
		zap.Int("message_id", sentMsg.MessageID))

	return sentMsg.MessageID, nil
}

// SendDocument sends a document via Telegram
func (c *Client) SendDocument(ctx context.Context, chatID, documentURL, caption string) (int, error) {
	c.logger.Info("Sending Telegram document",
		zap.String("chat_id", chatID),
		zap.String("document_url", documentURL))

	chatIDInt, err := strconv.ParseInt(chatID, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid chat ID: %w", err)
	}

	msg := tgbotapi.NewDocument(chatIDInt, tgbotapi.FileURL(documentURL))
	msg.Caption = caption

	sentMsg, err := c.bot.Send(msg)
	if err != nil {
		c.logger.Error("Failed to send Telegram document",
			zap.String("chat_id", chatID),
			zap.Error(err))
		return 0, fmt.Errorf("failed to send document: %w", err)
	}

	c.logger.Info("Telegram document sent successfully",
		zap.Int("message_id", sentMsg.MessageID))

	return sentMsg.MessageID, nil
}

// SendInlineKeyboard sends a message with inline keyboard buttons
func (c *Client) SendInlineKeyboard(ctx context.Context, chatID, message string, buttons [][]InlineButton) (int, error) {
	c.logger.Info("Sending Telegram message with inline keyboard",
		zap.String("chat_id", chatID))

	chatIDInt, err := strconv.ParseInt(chatID, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid chat ID: %w", err)
	}

	msg := tgbotapi.NewMessage(chatIDInt, message)
	msg.ParseMode = "Markdown"

	// Build inline keyboard
	var keyboard [][]tgbotapi.InlineKeyboardButton
	for _, row := range buttons {
		var keyboardRow []tgbotapi.InlineKeyboardButton
		for _, btn := range row {
			button := tgbotapi.NewInlineKeyboardButtonData(btn.Text, btn.CallbackData)
			keyboardRow = append(keyboardRow, button)
		}
		keyboard = append(keyboard, keyboardRow)
	}

	msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(keyboard...)

	sentMsg, err := c.bot.Send(msg)
	if err != nil {
		c.logger.Error("Failed to send Telegram message with keyboard",
			zap.String("chat_id", chatID),
			zap.Error(err))
		return 0, fmt.Errorf("failed to send message: %w", err)
	}

	c.logger.Info("Telegram message with keyboard sent successfully",
		zap.Int("message_id", sentMsg.MessageID))

	return sentMsg.MessageID, nil
}

// StartPolling starts polling for updates from Telegram
func (c *Client) StartPolling(ctx context.Context, handler func(*models.InboundMessage)) error {
	c.logger.Info("Starting Telegram polling")

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := c.bot.GetUpdatesChan(u)

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Stopping Telegram polling")
			return ctx.Err()
		case update := <-updates:
			if update.Message != nil {
				inboundMsg := &models.InboundMessage{
					ID:      strconv.Itoa(update.Message.MessageID),
					Channel: models.ChannelTelegram,
					Sender:  strconv.FormatInt(update.Message.Chat.ID, 10),
					Content: update.Message.Text,
					Metadata: map[string]interface{}{
						"username":   update.Message.From.UserName,
						"first_name": update.Message.From.FirstName,
						"last_name":  update.Message.From.LastName,
					},
				}

				// Handle photos
				if update.Message.Photo != nil && len(update.Message.Photo) > 0 {
					photo := update.Message.Photo[len(update.Message.Photo)-1]
					inboundMsg.MediaURL = photo.FileID
					inboundMsg.Content = update.Message.Caption
				}

				// Handle documents
				if update.Message.Document != nil {
					inboundMsg.MediaURL = update.Message.Document.FileID
					inboundMsg.Content = update.Message.Document.FileName
				}

				c.logger.Info("Received Telegram message",
					zap.String("message_id", inboundMsg.ID),
					zap.String("sender", inboundMsg.Sender))

				handler(inboundMsg)
			}

			// Handle callback queries (button clicks)
			if update.CallbackQuery != nil {
				inboundMsg := &models.InboundMessage{
					ID:      update.CallbackQuery.ID,
					Channel: models.ChannelTelegram,
					Sender:  strconv.FormatInt(update.CallbackQuery.From.ID, 10),
					Content: update.CallbackQuery.Data,
					Metadata: map[string]interface{}{
						"type":       "callback_query",
						"message_id": update.CallbackQuery.Message.MessageID,
					},
				}

				c.logger.Info("Received Telegram callback query",
					zap.String("callback_id", inboundMsg.ID),
					zap.String("data", update.CallbackQuery.Data))

				handler(inboundMsg)

				// Acknowledge the callback
				callback := tgbotapi.NewCallback(update.CallbackQuery.ID, "")
				if _, err := c.bot.Request(callback); err != nil {
					c.logger.Error("Failed to acknowledge callback",
						zap.Error(err))
				}
			}
		}
	}
}

// InlineButton represents a button in an inline keyboard
type InlineButton struct {
	Text         string
	CallbackData string
}

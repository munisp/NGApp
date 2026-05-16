package ussd

import (
	"context"
	"fmt"

	"github.com/insurance-platform/communication-service/internal/language"
	"github.com/insurance-platform/communication-service/internal/models"
	"go.uber.org/zap"
)

// GetCustomerLanguage retrieves the customer's preferred language
func (h *Handler) GetCustomerLanguage(ctx context.Context, phoneNumber string) models.Language {
	prefManager := language.NewPreferenceManager(h.db, h.logger)
	pref, err := prefManager.GetPreferenceByPhone(ctx, phoneNumber)
	
	if err != nil {
		h.logger.Warn("Failed to get language preference, using English",
			zap.String("phone", phoneNumber),
			zap.Error(err))
		return models.LanguageEnglish
	}

	// Use effective language (detected or preferred)
	if pref.AutoDetect && pref.DetectedLanguage != "" && pref.DetectedLanguage.IsValid() {
		return pref.DetectedLanguage
	}

	return pref.PreferredLanguage
}

// SetCustomerLanguage sets the customer's language preference
func (h *Handler) SetCustomerLanguage(ctx context.Context, phoneNumber string, lang models.Language) error {
	prefManager := language.NewPreferenceManager(h.db, h.logger)
	
	// Get or create preference
	pref, err := prefManager.GetPreferenceByPhone(ctx, phoneNumber)
	if err != nil {
		pref = &models.LanguagePreference{
			Phone: phoneNumber,
		}
	}

	pref.PreferredLanguage = lang
	pref.AutoDetect = false // User explicitly selected language

	return prefManager.SetPreference(ctx, pref)
}

// HandleLanguageAction handles language change actions
func (h *Handler) HandleLanguageAction(ctx context.Context, session *models.USSDSession, action string) (string, error) {
	var selectedLanguage models.Language

	switch action {
	case "set_language_en":
		selectedLanguage = models.LanguageEnglish
	case "set_language_yo":
		selectedLanguage = models.LanguageYoruba
	case "set_language_ig":
		selectedLanguage = models.LanguageIgbo
	case "set_language_ha":
		selectedLanguage = models.LanguageHausa
	case "set_language_pcm":
		selectedLanguage = models.LanguagePidgin
	default:
		return "", fmt.Errorf("unknown language action: %s", action)
	}

	// Set language preference
	if err := h.SetCustomerLanguage(ctx, session.PhoneNumber, selectedLanguage); err != nil {
		h.logger.Error("Failed to set language preference",
			zap.String("phone", session.PhoneNumber),
			zap.String("language", string(selectedLanguage)),
			zap.Error(err))
		return "Failed to change language. Please try again.", nil
	}

	// Get localized success message
	messages := language.GetUSSDResponseMessages(selectedLanguage)
	return messages["language_changed"], nil
}

// GetLocalizedMenu retrieves the menu in the customer's language
func (h *Handler) GetLocalizedMenu(ctx context.Context, menuID string, phoneNumber string) *models.USSDMenu {
	customerLanguage := h.GetCustomerLanguage(ctx, phoneNumber)
	menu := language.GetUSSDMenu(menuID, customerLanguage)
	
	if menu == nil {
		h.logger.Error("Menu not found",
			zap.String("menu_id", menuID),
			zap.String("language", string(customerLanguage)))
		// Fallback to English
		menu = language.GetUSSDMenu(menuID, models.LanguageEnglish)
	}

	return menu
}

// GetLocalizedMessage retrieves a localized message
func (h *Handler) GetLocalizedMessage(ctx context.Context, phoneNumber string, messageKey string, args ...interface{}) string {
	customerLanguage := h.GetCustomerLanguage(ctx, phoneNumber)
	messages := language.GetUSSDResponseMessages(customerLanguage)
	
	if template, exists := messages[messageKey]; exists {
		if len(args) > 0 {
			return fmt.Sprintf(template, args...)
		}
		return template
	}

	// Fallback to English
	englishMessages := language.GetUSSDResponseMessages(models.LanguageEnglish)
	if template, exists := englishMessages[messageKey]; exists {
		if len(args) > 0 {
			return fmt.Sprintf(template, args...)
		}
		return template
	}

	return messageKey
}

// UpdateHandleRequest to use multilingual menus
func (h *Handler) HandleRequestMultilingual(ctx context.Context, req *models.USSDRequest) (*models.USSDResponse, error) {
	h.logger.Info("Handling multilingual USSD request",
		zap.String("session_id", req.SessionID),
		zap.String("phone_number", req.PhoneNumber),
		zap.String("text", req.Text))

	// Get or create session
	session, err := h.getSession(ctx, req.SessionID, req.PhoneNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Parse user input
	userInput := ""
	if req.Text != "" {
		parts := req.Text[len(req.Text)-1:]
		userInput = parts
	}

	// Get localized menu
	menu := h.GetLocalizedMenu(ctx, session.CurrentMenu, req.PhoneNumber)
	if menu == nil {
		return h.endSession(ctx, session, h.GetLocalizedMessage(ctx, req.PhoneNumber, "service_unavailable"))
	}

	// Process user input
	if userInput != "" && session.CurrentMenu != "main" {
		nextMenu, action, err := h.processInput(ctx, session, menu, userInput)
		if err != nil {
			errorMsg := h.GetLocalizedMessage(ctx, req.PhoneNumber, "invalid_input")
			return h.continueSession(ctx, session, menu, fmt.Sprintf("%s\n\n%s", errorMsg, h.renderMenu(menu)))
		}

		// Handle language change actions
		if action != "" {
			if action[:13] == "set_language_" {
				result, err := h.HandleLanguageAction(ctx, session, action)
				if err != nil {
					h.logger.Error("Failed to handle language action", zap.Error(err))
					return h.endSession(ctx, session, h.GetLocalizedMessage(ctx, req.PhoneNumber, "service_unavailable"))
				}
				return h.endSession(ctx, session, result)
			}

			// Execute other actions
			result, err := h.executeAction(ctx, session, action)
			if err != nil {
				h.logger.Error("Failed to execute action",
					zap.String("action", action),
					zap.Error(err))
				return h.endSession(ctx, session, h.GetLocalizedMessage(ctx, req.PhoneNumber, "service_unavailable"))
			}

			if result != "" {
				return h.endSession(ctx, session, result)
			}
		}

		// Move to next menu
		if nextMenu != "" {
			session.CurrentMenu = nextMenu
			menu = h.GetLocalizedMenu(ctx, nextMenu, req.PhoneNumber)
		}
	}

	// Render current menu
	message := h.renderMenu(menu)
	return h.continueSession(ctx, session, menu, message)
}

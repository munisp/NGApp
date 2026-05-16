package router

import (
	"context"
	"fmt"

	"github.com/insurance-platform/communication-service/internal/language"
	"github.com/insurance-platform/communication-service/internal/models"
	"go.uber.org/zap"
)

// SendMessageWithLanguage sends a message using the customer's preferred language
func (r *Router) SendMessageWithLanguage(ctx context.Context, req *models.SendMessageRequest, customerID string) (*models.SendMessageResponse, error) {
	r.logger.Info("Routing multilingual message",
		zap.String("channel", string(req.Channel)),
		zap.String("recipient", req.Recipient),
		zap.String("customer_id", customerID))

	// Get customer's language preference
	prefManager := language.NewPreferenceManager(r.db, r.logger)
	effectiveLanguage, err := prefManager.GetEffectiveLanguage(ctx, customerID)
	if err != nil {
		r.logger.Warn("Failed to get language preference, using English",
			zap.String("customer_id", customerID),
			zap.Error(err))
		effectiveLanguage = models.LanguageEnglish
	}

	r.logger.Info("Using language for message",
		zap.String("language", string(effectiveLanguage)))

	// If template ID is provided, find the language-specific version
	if req.TemplateID != "" {
		// Get template name without language suffix
		templateName := req.TemplateID
		
		// Try to get language-specific template
		languageSpecificID := fmt.Sprintf("%s-%s-%s", templateName, effectiveLanguage, req.Channel)
		template, err := r.templateManager.GetTemplate(ctx, languageSpecificID)
		
		if err != nil {
			// Fallback to English if language-specific template not found
			r.logger.Warn("Language-specific template not found, falling back to English",
				zap.String("template_id", languageSpecificID),
				zap.Error(err))
			
			englishTemplateID := fmt.Sprintf("%s-%s-%s", templateName, models.LanguageEnglish, req.Channel)
			template, err = r.templateManager.GetTemplate(ctx, englishTemplateID)
			
			if err != nil {
				return nil, fmt.Errorf("template not found: %s", req.TemplateID)
			}
		}

		// Update request with language-specific template
		req.TemplateID = template.ID
	}

	// Send message using the standard router
	return r.SendMessage(ctx, req)
}

// SendMessageByPhone sends a message using phone number to determine language
func (r *Router) SendMessageByPhone(ctx context.Context, req *models.SendMessageRequest) (*models.SendMessageResponse, error) {
	// Get customer's language preference by phone
	prefManager := language.NewPreferenceManager(r.db, r.logger)
	pref, err := prefManager.GetPreferenceByPhone(ctx, req.Recipient)
	
	if err != nil {
		r.logger.Warn("Failed to get language preference by phone, using English",
			zap.String("phone", req.Recipient),
			zap.Error(err))
		return r.SendMessage(ctx, req)
	}

	// Use customer ID if available
	if pref.CustomerID != "" {
		return r.SendMessageWithLanguage(ctx, req, pref.CustomerID)
	}

	// Otherwise use standard router
	return r.SendMessage(ctx, req)
}

// GetTemplateForLanguage retrieves the appropriate template for a given language
func (r *Router) GetTemplateForLanguage(ctx context.Context, templateName string, channel models.Channel, language models.Language) (*models.Template, error) {
	// Try language-specific template
	templateID := fmt.Sprintf("%s-%s-%s", templateName, language, channel)
	template, err := r.templateManager.GetTemplate(ctx, templateID)
	
	if err == nil {
		return template, nil
	}

	// Fallback to English
	r.logger.Warn("Language-specific template not found, using English",
		zap.String("template_name", templateName),
		zap.String("language", string(language)))
	
	englishTemplateID := fmt.Sprintf("%s-%s-%s", templateName, models.LanguageEnglish, channel)
	return r.templateManager.GetTemplate(ctx, englishTemplateID)
}

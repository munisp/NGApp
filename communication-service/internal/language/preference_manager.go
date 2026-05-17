package language

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/insurance-platform/communication-service/internal/models"
	"go.uber.org/zap"
)

// PreferenceManager manages customer language preferences
type PreferenceManager struct {
	db     *sql.DB
	logger *zap.Logger
}

// NewPreferenceManager creates a new language preference manager
func NewPreferenceManager(db *sql.DB, logger *zap.Logger) *PreferenceManager {
	return &PreferenceManager{
		db:     db,
		logger: logger,
	}
}

// GetPreference retrieves a customer's language preference
func (m *PreferenceManager) GetPreference(ctx context.Context, customerID string) (*models.LanguagePreference, error) {
	query := `
		SELECT customer_id, phone, preferred_language, detected_language, auto_detect, created_at, updated_at
		FROM language_preferences
		WHERE customer_id = $1
	`

	var pref models.LanguagePreference
	var detectedLanguage sql.NullString

	err := m.db.QueryRowContext(ctx, query, customerID).Scan(
		&pref.CustomerID,
		&pref.Phone,
		&pref.PreferredLanguage,
		&detectedLanguage,
		&pref.AutoDetect,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return default preference (English)
			return &models.LanguagePreference{
				CustomerID:       customerID,
				PreferredLanguage: models.LanguageEnglish,
				AutoDetect:       true,
			}, nil
		}
		return nil, fmt.Errorf("failed to get language preference: %w", err)
	}

	if detectedLanguage.Valid {
		pref.DetectedLanguage = models.Language(detectedLanguage.String)
	}

	return &pref, nil
}

// GetPreferenceByPhone retrieves a customer's language preference by phone number
func (m *PreferenceManager) GetPreferenceByPhone(ctx context.Context, phone string) (*models.LanguagePreference, error) {
	query := `
		SELECT customer_id, phone, preferred_language, detected_language, auto_detect, created_at, updated_at
		FROM language_preferences
		WHERE phone = $1
	`

	var pref models.LanguagePreference
	var detectedLanguage sql.NullString

	err := m.db.QueryRowContext(ctx, query, phone).Scan(
		&pref.CustomerID,
		&pref.Phone,
		&pref.PreferredLanguage,
		&detectedLanguage,
		&pref.AutoDetect,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return default preference (English)
			return &models.LanguagePreference{
				Phone:            phone,
				PreferredLanguage: models.LanguageEnglish,
				AutoDetect:       true,
			}, nil
		}
		return nil, fmt.Errorf("failed to get language preference: %w", err)
	}

	if detectedLanguage.Valid {
		pref.DetectedLanguage = models.Language(detectedLanguage.String)
	}

	return &pref, nil
}

// SetPreference sets a customer's language preference
func (m *PreferenceManager) SetPreference(ctx context.Context, pref *models.LanguagePreference) error {
	// Validate language
	if !pref.PreferredLanguage.IsValid() {
		return fmt.Errorf("invalid language: %s", pref.PreferredLanguage)
	}

	query := `
		INSERT INTO language_preferences (customer_id, phone, preferred_language, auto_detect, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (customer_id) 
		DO UPDATE SET 
			phone = EXCLUDED.phone,
			preferred_language = EXCLUDED.preferred_language,
			auto_detect = EXCLUDED.auto_detect,
			updated_at = EXCLUDED.updated_at
	`

	now := time.Now()
	pref.CreatedAt = now
	pref.UpdatedAt = now

	_, err := m.db.ExecContext(ctx, query,
		pref.CustomerID,
		pref.Phone,
		pref.PreferredLanguage,
		pref.AutoDetect,
		pref.CreatedAt,
		pref.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to set language preference: %w", err)
	}

	m.logger.Info("Language preference set",
		zap.String("customer_id", pref.CustomerID),
		zap.String("language", string(pref.PreferredLanguage)))

	return nil
}

// UpdateDetectedLanguage updates the detected language for a customer
func (m *PreferenceManager) UpdateDetectedLanguage(ctx context.Context, customerID string, language models.Language) error {
	query := `
		UPDATE language_preferences
		SET detected_language = $2, updated_at = $3
		WHERE customer_id = $1
	`

	_, err := m.db.ExecContext(ctx, query, customerID, language, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update detected language: %w", err)
	}

	return nil
}

// GetEffectiveLanguage returns the effective language to use for a customer
// If auto_detect is enabled and detected_language is set, use detected_language
// Otherwise, use preferred_language
func (m *PreferenceManager) GetEffectiveLanguage(ctx context.Context, customerID string) (models.Language, error) {
	pref, err := m.GetPreference(ctx, customerID)
	if err != nil {
		return models.LanguageEnglish, err
	}

	if pref.AutoDetect && pref.DetectedLanguage != "" && pref.DetectedLanguage.IsValid() {
		return pref.DetectedLanguage, nil
	}

	return pref.PreferredLanguage, nil
}

// GetLanguageStatistics returns statistics on language usage
func (m *PreferenceManager) GetLanguageStatistics(ctx context.Context) (map[models.Language]int, error) {
	query := `
		SELECT preferred_language, COUNT(*) as count
		FROM language_preferences
		GROUP BY preferred_language
	`

	rows, err := m.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get language statistics: %w", err)
	}
	defer rows.Close()

	stats := make(map[models.Language]int)

	for rows.Next() {
		var language models.Language
		var count int

		if err := rows.Scan(&language, &count); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		stats[language] = count
	}

	return stats, nil
}

// InitializeDefaultPreferences creates default language preferences for customers without preferences
func (m *PreferenceManager) InitializeDefaultPreferences(ctx context.Context) error {
	// Get all customers without language preferences
	query := `
		INSERT INTO language_preferences (customer_id, phone, preferred_language, auto_detect, created_at, updated_at)
		SELECT c.id, c.phone, 'en', true, NOW(), NOW()
		FROM customers c
		LEFT JOIN language_preferences lp ON c.id = lp.customer_id
		WHERE lp.customer_id IS NULL
	`

	result, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to initialize default preferences: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	m.logger.Info("Initialized default language preferences",
		zap.Int64("count", rowsAffected))

	return nil
}

// DetectLanguageFromRegion detects likely language based on phone number region
func (m *PreferenceManager) DetectLanguageFromRegion(phone string) models.Language {
	// Nigerian phone numbers: +234XXXXXXXXXX
	// Simple heuristic based on area codes (not 100% accurate but helpful)
	
	if len(phone) < 8 {
		return models.LanguageEnglish
	}

	// Extract area code (assuming +234 prefix is removed)
	// This is a simplified heuristic
	
	// Lagos, Ogun (Yoruba-speaking states): 080, 081, 070, 071
	// Kano, Kaduna (Hausa-speaking states): 080, 081, 070
	// Enugu, Anambra (Igbo-speaking states): 080, 081, 070
	
	// For now, default to English as region-based detection is not reliable
	// In production, use customer registration data or NIN verification
	
	return models.LanguageEnglish
}

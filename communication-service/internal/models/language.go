package models

import "time"

// Language represents supported languages
type Language string

const (
	LanguageEnglish Language = "en"  // English
	LanguageYoruba  Language = "yo"  // Yoruba
	LanguageIgbo    Language = "ig"  // Igbo
	LanguageHausa   Language = "ha"  // Hausa
	LanguagePidgin  Language = "pcm" // Nigerian Pidgin (ISO 639-3)
)

// LanguagePreference represents a customer's language preference
type LanguagePreference struct {
	CustomerID       string    `json:"customer_id"`
	Phone            string    `json:"phone"`
	PreferredLanguage Language  `json:"preferred_language"`
	DetectedLanguage Language  `json:"detected_language,omitempty"`
	AutoDetect       bool      `json:"auto_detect"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// LanguageDetectionRequest represents a request to detect language
type LanguageDetectionRequest struct {
	Text string `json:"text"`
}

// LanguageDetectionResponse represents the detected language
type LanguageDetectionResponse struct {
	Language   Language `json:"language"`
	Confidence float64  `json:"confidence"`
}

// TranslationRequest represents a request to translate text
type TranslationRequest struct {
	Text           string   `json:"text"`
	SourceLanguage Language `json:"source_language"`
	TargetLanguage Language `json:"target_language"`
}

// TranslationResponse represents translated text
type TranslationResponse struct {
	TranslatedText string   `json:"translated_text"`
	SourceLanguage Language `json:"source_language"`
	TargetLanguage Language `json:"target_language"`
}

// GetLanguageName returns the full name of the language
func (l Language) GetLanguageName() string {
	switch l {
	case LanguageEnglish:
		return "English"
	case LanguageYoruba:
		return "Yoruba"
	case LanguageIgbo:
		return "Igbo"
	case LanguageHausa:
		return "Hausa"
	case LanguagePidgin:
		return "Nigerian Pidgin"
	default:
		return "Unknown"
	}
}

// GetNativeName returns the language name in its native script
func (l Language) GetNativeName() string {
	switch l {
	case LanguageEnglish:
		return "English"
	case LanguageYoruba:
		return "Yorùbá"
	case LanguageIgbo:
		return "Igbo"
	case LanguageHausa:
		return "Hausa"
	case LanguagePidgin:
		return "Naija Pidgin"
	default:
		return "Unknown"
	}
}

// IsValid checks if the language code is valid
func (l Language) IsValid() bool {
	switch l {
	case LanguageEnglish, LanguageYoruba, LanguageIgbo, LanguageHausa, LanguagePidgin:
		return true
	default:
		return false
	}
}

// SupportedLanguages returns a list of all supported languages
func SupportedLanguages() []Language {
	return []Language{
		LanguageEnglish,
		LanguageYoruba,
		LanguageIgbo,
		LanguageHausa,
		LanguagePidgin,
	}
}

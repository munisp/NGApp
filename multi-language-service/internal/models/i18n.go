package models

import "time"

type Language struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	NativeName string `json:"native_name"`
	Direction  string `json:"direction"`
	IsActive   bool   `json:"is_active"`
	Coverage   int    `json:"coverage_pct"`
}

type Translation struct {
	ID       string `json:"id"`
	Key      string `json:"key"`
	Language string `json:"language"`
	Value    string `json:"value"`
	Context  string `json:"context,omitempty"`
	Verified bool   `json:"verified"`
}

type TranslationBundle struct {
	Language     string            `json:"language"`
	Translations map[string]string `json:"translations"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

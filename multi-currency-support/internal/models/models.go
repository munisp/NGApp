package models

import (
	"time"

	"github.com/google/uuid"
)

type Currency struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Code      string    `json:"code" gorm:"uniqueIndex"`
	Name      string    `json:"name"`
	Symbol    string    `json:"symbol"`
	Country   string    `json:"country"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type ExchangeRate struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	FromCurrency string    `json:"from_currency" gorm:"index"`
	ToCurrency   string    `json:"to_currency" gorm:"index"`
	Rate         float64   `json:"rate"`
	Source       string    `json:"source"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CurrencyConversion struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	FromCurrency    string    `json:"from_currency"`
	ToCurrency      string    `json:"to_currency"`
	OriginalAmount  float64   `json:"original_amount"`
	ConvertedAmount float64   `json:"converted_amount"`
	ExchangeRate    float64   `json:"exchange_rate"`
	TransactionID   uuid.UUID `json:"transaction_id" gorm:"type:uuid"`
	ConvertedAt     time.Time `json:"converted_at"`
}

type ConversionResult struct {
	ConversionID    uuid.UUID `json:"conversion_id"`
	FromCurrency    string    `json:"from_currency"`
	ToCurrency      string    `json:"to_currency"`
	OriginalAmount  float64   `json:"original_amount"`
	ConvertedAmount float64   `json:"converted_amount"`
	ExchangeRate    float64   `json:"exchange_rate"`
	ConvertedAt     time.Time `json:"converted_at"`
}

package models

import (
	"time"

	"github.com/google/uuid"
)

type Currency struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Code         string    `json:"code" gorm:"type:varchar(3);unique;not null"`
	Name         string    `json:"name" gorm:"type:varchar(100)"`
	Symbol       string    `json:"symbol" gorm:"type:varchar(10)"`
	DecimalPlaces int      `json:"decimal_places" gorm:"default:2"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
	IsBaseCurrency bool    `json:"is_base_currency" gorm:"default:false"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type ExchangeRate struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	FromCurrency   string    `json:"from_currency" gorm:"type:varchar(3);not null;index"`
	ToCurrency     string    `json:"to_currency" gorm:"type:varchar(3);not null;index"`
	Rate           float64   `json:"rate" gorm:"type:decimal(20,10);not null"`
	BidRate        float64   `json:"bid_rate" gorm:"type:decimal(20,10)"`
	AskRate        float64   `json:"ask_rate" gorm:"type:decimal(20,10)"`
	Source         string    `json:"source" gorm:"type:varchar(50)"`
	EffectiveDate  time.Time `json:"effective_date" gorm:"not null;index"`
	ExpiresAt      *time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type CurrencyConversion struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	TransactionRef  string    `json:"transaction_ref" gorm:"type:varchar(100);unique"`
	FromCurrency    string    `json:"from_currency" gorm:"type:varchar(3);not null"`
	ToCurrency      string    `json:"to_currency" gorm:"type:varchar(3);not null"`
	OriginalAmount  float64   `json:"original_amount" gorm:"type:decimal(20,2);not null"`
	ConvertedAmount float64   `json:"converted_amount" gorm:"type:decimal(20,2);not null"`
	ExchangeRate    float64   `json:"exchange_rate" gorm:"type:decimal(20,10);not null"`
	Fee             float64   `json:"fee" gorm:"type:decimal(20,2);default:0"`
	EntityType      string    `json:"entity_type" gorm:"type:varchar(50)"`
	EntityID        uuid.UUID `json:"entity_id" gorm:"type:uuid;index"`
	ConvertedAt     time.Time `json:"converted_at" gorm:"autoCreateTime"`
}

type CurrencyConfig struct {
	ID                  uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	BaseCurrency        string    `json:"base_currency" gorm:"type:varchar(3);not null"`
	AllowedCurrencies   string    `json:"allowed_currencies" gorm:"type:jsonb"`
	AutoConvert         bool      `json:"auto_convert" gorm:"default:false"`
	ConversionFeePercent float64  `json:"conversion_fee_percent" gorm:"type:decimal(5,2);default:0"`
	RateUpdateFrequency string    `json:"rate_update_frequency" gorm:"type:varchar(20);default:'DAILY'"`
	RateSource          string    `json:"rate_source" gorm:"type:varchar(50);default:'CBN'"`
	IsActive            bool      `json:"is_active" gorm:"default:true"`
	CreatedAt           time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt           time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

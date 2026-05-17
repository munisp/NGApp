package service

import (
	"context"
	"fmt"
	"multi-currency-support/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CurrencyService struct {
	db *gorm.DB
}

func NewCurrencyService(db *gorm.DB) *CurrencyService {
	return &CurrencyService{db: db}
}

func (s *CurrencyService) GetCurrencies(ctx context.Context) ([]models.Currency, error) {
	var currencies []models.Currency
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&currencies).Error
	return currencies, err
}

func (s *CurrencyService) GetExchangeRate(ctx context.Context, from, to string) (*models.ExchangeRate, error) {
	var rate models.ExchangeRate
	err := s.db.WithContext(ctx).Where("from_currency = ? AND to_currency = ? AND effective_date <= ?", from, to, time.Now()).Order("effective_date DESC").First(&rate).Error
	return &rate, err
}

func (s *CurrencyService) SetExchangeRate(ctx context.Context, rate *models.ExchangeRate) error {
	rate.ID = uuid.New()
	rate.EffectiveDate = time.Now()
	return s.db.WithContext(ctx).Create(rate).Error
}

func (s *CurrencyService) Convert(ctx context.Context, from, to string, amount float64) (*models.CurrencyConversion, error) {
	rate, err := s.GetExchangeRate(ctx, from, to)
	if err != nil {
		return nil, fmt.Errorf("exchange rate not found: %w", err)
	}

	var config models.CurrencyConfig
	s.db.WithContext(ctx).Where("is_active = ?", true).First(&config)

	fee := amount * (config.ConversionFeePercent / 100)
	convertedAmount := (amount - fee) * rate.Rate

	conversion := &models.CurrencyConversion{
		ID:              uuid.New(),
		TransactionRef:  fmt.Sprintf("CNV-%d", time.Now().UnixNano()),
		FromCurrency:    from,
		ToCurrency:      to,
		OriginalAmount:  amount,
		ConvertedAmount: convertedAmount,
		ExchangeRate:    rate.Rate,
		Fee:             fee,
	}

	if err := s.db.WithContext(ctx).Create(conversion).Error; err != nil {
		return nil, err
	}
	return conversion, nil
}

func (s *CurrencyService) GetConversionHistory(ctx context.Context, entityType string, entityID uuid.UUID) ([]models.CurrencyConversion, error) {
	var conversions []models.CurrencyConversion
	query := s.db.WithContext(ctx)
	if entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if entityID != uuid.Nil {
		query = query.Where("entity_id = ?", entityID)
	}
	err := query.Order("converted_at DESC").Find(&conversions).Error
	return conversions, err
}

func (s *CurrencyService) UpdateConfig(ctx context.Context, config *models.CurrencyConfig) error {
	if config.ID == uuid.Nil {
		config.ID = uuid.New()
		return s.db.WithContext(ctx).Create(config).Error
	}
	return s.db.WithContext(ctx).Save(config).Error
}

func (s *CurrencyService) GetConfig(ctx context.Context) (*models.CurrencyConfig, error) {
	var config models.CurrencyConfig
	err := s.db.WithContext(ctx).Where("is_active = ?", true).First(&config).Error
	return &config, err
}

func (s *CurrencyService) GetRateHistory(ctx context.Context, from, to string, days int) ([]models.ExchangeRate, error) {
	var rates []models.ExchangeRate
	startDate := time.Now().AddDate(0, 0, -days)
	err := s.db.WithContext(ctx).Where("from_currency = ? AND to_currency = ? AND effective_date >= ?", from, to, startDate).Order("effective_date ASC").Find(&rates).Error
	return rates, err
}

func (s *CurrencyService) GetCurrencyStats(ctx context.Context) (map[string]interface{}, error) {
	var totalConversions int64
	var totalVolume float64

	s.db.Model(&models.CurrencyConversion{}).Count(&totalConversions)
	s.db.Model(&models.CurrencyConversion{}).Select("COALESCE(SUM(original_amount), 0)").Scan(&totalVolume)

	return map[string]interface{}{
		"total_conversions": totalConversions,
		"total_volume":      totalVolume,
	}, nil
}

package service

import (
	"context"
	"encoding/json"
	"multi-currency-support/internal/middleware"
	"multi-currency-support/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedCurrencyService struct {
	db         *gorm.DB
	middleware *middleware.MiddlewareClients
}

func NewEnhancedCurrencyService(db *gorm.DB, mw *middleware.MiddlewareClients) *EnhancedCurrencyService {
	return &EnhancedCurrencyService{db: db, middleware: mw}
}

func (s *EnhancedCurrencyService) GetExchangeRate(ctx context.Context, from, to string) (float64, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if rate, err := s.middleware.Redis.GetCachedExchangeRate(ctx, from, to); err == nil {
			return rate, nil
		}
	}

	var rate models.ExchangeRate
	if err := s.db.WithContext(ctx).Where("from_currency = ? AND to_currency = ?", from, to).First(&rate).Error; err != nil {
		if s.middleware != nil && s.middleware.RateProvider != nil {
			rateData, err := s.middleware.RateProvider.FetchLatestRates(ctx, from)
			if err != nil {
				return 0, err
			}
			if toRate, ok := rateData.Rates[to]; ok {
				if s.middleware.Redis != nil {
					go s.middleware.Redis.CacheExchangeRate(context.Background(), from, to, toRate, 15*time.Minute)
				}
				return toRate, nil
			}
		}
		return 0, err
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.CacheExchangeRate(context.Background(), from, to, rate.Rate, 15*time.Minute)
	}

	return rate.Rate, nil
}

func (s *EnhancedCurrencyService) GetAllRates(ctx context.Context, baseCurrency string) (map[string]float64, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		if rates, err := s.middleware.Redis.GetCachedAllRates(ctx, baseCurrency); err == nil {
			return rates, nil
		}
	}

	if s.middleware != nil && s.middleware.RateProvider != nil {
		rateData, err := s.middleware.RateProvider.FetchLatestRates(ctx, baseCurrency)
		if err == nil {
			if s.middleware.Redis != nil {
				go s.middleware.Redis.CacheAllRates(context.Background(), baseCurrency, rateData.Rates, 15*time.Minute)
			}
			return rateData.Rates, nil
		}
	}

	var rates []models.ExchangeRate
	if err := s.db.WithContext(ctx).Where("from_currency = ?", baseCurrency).Find(&rates).Error; err != nil {
		return nil, err
	}

	result := make(map[string]float64)
	for _, rate := range rates {
		result[rate.ToCurrency] = rate.Rate
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.CacheAllRates(context.Background(), baseCurrency, result, 15*time.Minute)
	}

	return result, nil
}

func (s *EnhancedCurrencyService) ConvertCurrency(ctx context.Context, from, to string, amount float64) (*models.ConversionResult, error) {
	rate, err := s.GetExchangeRate(ctx, from, to)
	if err != nil {
		return nil, err
	}

	convertedAmount := amount * rate

	conversion := &models.CurrencyConversion{
		ID:              uuid.New(),
		FromCurrency:    from,
		ToCurrency:      to,
		OriginalAmount:  amount,
		ConvertedAmount: convertedAmount,
		ExchangeRate:    rate,
		ConvertedAt:     time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(conversion).Error; err != nil {
		return nil, err
	}

	if s.middleware != nil && s.middleware.Kafka != nil {
		event := &middleware.CurrencyEvent{
			ID:              uuid.New(),
			EventType:       "CURRENCY_CONVERTED",
			FromCurrency:    from,
			ToCurrency:      to,
			Amount:          amount,
			ConvertedAmount: convertedAmount,
			Rate:            rate,
			Timestamp:       time.Now(),
		}
		go s.middleware.Kafka.PublishCurrencyEvent(context.Background(), event)
	}

	if s.middleware != nil && s.middleware.TigerBeetle != nil {
		entry := &middleware.LedgerEntry{
			ID:            conversion.ID,
			DebitAccount:  1000,
			CreditAccount: 2000,
			Amount:        uint64(amount * 100),
			Currency:      from,
			Code:          2,
			Timestamp:     uint64(time.Now().Unix()),
		}
		go s.middleware.TigerBeetle.CreateCurrencyLedgerEntry(context.Background(), entry)
	}

	if s.middleware != nil && s.middleware.Redis != nil {
		go s.middleware.Redis.IncrementConversionVolume(context.Background(), from, to, amount)
	}

	return &models.ConversionResult{
		ConversionID:    conversion.ID,
		FromCurrency:    from,
		ToCurrency:      to,
		OriginalAmount:  amount,
		ConvertedAmount: convertedAmount,
		ExchangeRate:    rate,
		ConvertedAt:     conversion.ConvertedAt,
	}, nil
}

func (s *EnhancedCurrencyService) UpdateExchangeRates(ctx context.Context) error {
	if s.middleware == nil || s.middleware.RateProvider == nil {
		return nil
	}

	baseCurrencies := []string{"NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"}

	for _, base := range baseCurrencies {
		rateData, err := s.middleware.RateProvider.FetchLatestRates(ctx, base)
		if err != nil {
			continue
		}

		for currency, rate := range rateData.Rates {
			exchangeRate := models.ExchangeRate{
				FromCurrency: base,
				ToCurrency:   currency,
				Rate:         rate,
				UpdatedAt:    time.Now(),
			}

			s.db.WithContext(ctx).Where("from_currency = ? AND to_currency = ?", base, currency).
				Assign(exchangeRate).FirstOrCreate(&exchangeRate)
		}

		if s.middleware.Redis != nil {
			go s.middleware.Redis.CacheAllRates(context.Background(), base, rateData.Rates, 15*time.Minute)
		}

		if s.middleware.Kafka != nil {
			event := &middleware.CurrencyEvent{
				ID:           uuid.New(),
				EventType:    "RATES_UPDATED",
				FromCurrency: base,
				Timestamp:    time.Now(),
				Metadata: map[string]interface{}{
					"currencies_updated": len(rateData.Rates),
				},
			}
			go s.middleware.Kafka.PublishCurrencyEvent(context.Background(), event)
		}
	}

	return nil
}

func (s *EnhancedCurrencyService) GetSupportedCurrencies(ctx context.Context) ([]models.Currency, error) {
	var currencies []models.Currency
	err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&currencies).Error
	return currencies, err
}

func (s *EnhancedCurrencyService) GetConversionHistory(ctx context.Context, limit int) ([]models.CurrencyConversion, error) {
	var conversions []models.CurrencyConversion
	err := s.db.WithContext(ctx).Order("converted_at DESC").Limit(limit).Find(&conversions).Error
	return conversions, err
}

func (s *EnhancedCurrencyService) GetConversionVolume(ctx context.Context, from, to string) (float64, error) {
	if s.middleware != nil && s.middleware.Redis != nil {
		return s.middleware.Redis.GetConversionVolume(ctx, from, to)
	}

	var volume float64
	s.db.Model(&models.CurrencyConversion{}).
		Where("from_currency = ? AND to_currency = ?", from, to).
		Select("COALESCE(SUM(original_amount), 0)").
		Scan(&volume)
	return volume, nil
}

func (s *EnhancedCurrencyService) GetCurrencyStats(ctx context.Context) (map[string]interface{}, error) {
	var totalConversions int64
	var totalVolume float64

	s.db.Model(&models.CurrencyConversion{}).Count(&totalConversions)
	s.db.Model(&models.CurrencyConversion{}).Select("COALESCE(SUM(original_amount), 0)").Scan(&totalVolume)

	var topPairs []struct {
		FromCurrency string
		ToCurrency   string
		Count        int64
	}
	s.db.Model(&models.CurrencyConversion{}).
		Select("from_currency, to_currency, COUNT(*) as count").
		Group("from_currency, to_currency").
		Order("count DESC").
		Limit(5).
		Scan(&topPairs)

	return map[string]interface{}{
		"total_conversions": totalConversions,
		"total_volume":      totalVolume,
		"top_pairs":         topPairs,
	}, nil
}

func (s *EnhancedCurrencyService) GetMiddlewareStatus(ctx context.Context) *middleware.MiddlewareStatus {
	if s.middleware == nil {
		return nil
	}
	return s.middleware.GetStatus(ctx)
}

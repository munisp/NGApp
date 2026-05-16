package repository

import (
	"fmt"
	"math"
	"math/rand"
	"multi-currency-service/internal/models"
	"sync"
	"time"
)

type CurrencyRepository struct {
	mu          sync.RWMutex
	currencies  map[string]models.Currency
	rates       map[string]models.ExchangeRate
	conversions map[string]*models.Conversion
	baseRates   map[string]float64
}

func NewCurrencyRepository() *CurrencyRepository {
	repo := &CurrencyRepository{
		currencies:  make(map[string]models.Currency),
		rates:       make(map[string]models.ExchangeRate),
		conversions: make(map[string]*models.Conversion),
		baseRates: map[string]float64{
			"NGN": 1.0,
			"USD": 0.000645,
			"EUR": 0.000593,
			"GBP": 0.000514,
			"GHS": 0.00786,
			"KES": 0.0832,
			"ZAR": 0.01176,
			"XOF": 0.389,
			"EGP": 0.0316,
			"UGX": 2.38,
			"TZS": 1.617,
			"RWF": 0.876,
			"ETB": 0.0782,
		},
	}
	repo.seedCurrencies()
	repo.refreshRates()
	return repo
}

func (r *CurrencyRepository) seedCurrencies() {
	currencies := []models.Currency{
		{Code: "NGN", Name: "Nigerian Naira", Symbol: "₦", Country: "Nigeria", IsActive: true, Decimals: 2},
		{Code: "USD", Name: "US Dollar", Symbol: "$", Country: "United States", IsActive: true, Decimals: 2},
		{Code: "EUR", Name: "Euro", Symbol: "€", Country: "Eurozone", IsActive: true, Decimals: 2},
		{Code: "GBP", Name: "British Pound", Symbol: "£", Country: "United Kingdom", IsActive: true, Decimals: 2},
		{Code: "GHS", Name: "Ghana Cedi", Symbol: "GH₵", Country: "Ghana", IsActive: true, Decimals: 2},
		{Code: "KES", Name: "Kenyan Shilling", Symbol: "KSh", Country: "Kenya", IsActive: true, Decimals: 2},
		{Code: "ZAR", Name: "South African Rand", Symbol: "R", Country: "South Africa", IsActive: true, Decimals: 2},
		{Code: "XOF", Name: "West African CFA Franc", Symbol: "CFA", Country: "WAEMU", IsActive: true, Decimals: 0},
		{Code: "EGP", Name: "Egyptian Pound", Symbol: "E£", Country: "Egypt", IsActive: true, Decimals: 2},
		{Code: "UGX", Name: "Ugandan Shilling", Symbol: "USh", Country: "Uganda", IsActive: true, Decimals: 0},
		{Code: "TZS", Name: "Tanzanian Shilling", Symbol: "TSh", Country: "Tanzania", IsActive: true, Decimals: 0},
		{Code: "RWF", Name: "Rwandan Franc", Symbol: "RF", Country: "Rwanda", IsActive: true, Decimals: 0},
		{Code: "ETB", Name: "Ethiopian Birr", Symbol: "Br", Country: "Ethiopia", IsActive: true, Decimals: 2},
	}
	for _, c := range currencies {
		r.currencies[c.Code] = c
	}
}

func (r *CurrencyRepository) refreshRates() {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	validTo := now.Add(5 * time.Minute)
	for base, baseRate := range r.baseRates {
		for quote, quoteRate := range r.baseRates {
			if base == quote {
				continue
			}
			rate := quoteRate / baseRate
			jitter := 1.0 + (rand.Float64()-0.5)*0.002
			rate *= jitter
			spread := rate * 0.005
			key := base + "/" + quote
			r.rates[key] = models.ExchangeRate{
				ID:            fmt.Sprintf("RATE-%s-%d", key, now.Unix()),
				BaseCurrency:  base,
				QuoteCurrency: quote,
				Rate:          math.Round(rate*1000000) / 1000000,
				Bid:           math.Round((rate-spread/2)*1000000) / 1000000,
				Ask:           math.Round((rate+spread/2)*1000000) / 1000000,
				Spread:        math.Round(spread*1000000) / 1000000,
				Source:         "CBN/Reuters",
				ValidFrom:     now,
				ValidTo:       validTo,
			}
		}
	}
}

func (r *CurrencyRepository) GetCurrencies() []models.Currency {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Currency
	for _, c := range r.currencies {
		if c.IsActive {
			result = append(result, c)
		}
	}
	return result
}

func (r *CurrencyRepository) GetRate(base, quote string) (*models.ExchangeRate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	key := base + "/" + quote
	rate, ok := r.rates[key]
	if !ok {
		return nil, fmt.Errorf("rate not found for %s", key)
	}
	if time.Now().After(rate.ValidTo) {
		r.mu.RUnlock()
		r.refreshRates()
		r.mu.RLock()
		rate = r.rates[key]
	}
	return &rate, nil
}

func (r *CurrencyRepository) GetAllRates(base string) []models.ExchangeRate {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var rates []models.ExchangeRate
	for _, rate := range r.rates {
		if rate.BaseCurrency == base {
			rates = append(rates, rate)
		}
	}
	return rates
}

func (r *CurrencyRepository) SaveConversion(c *models.Conversion) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.conversions[c.ID] = c
}

func (r *CurrencyRepository) GetConversion(id string) (*models.Conversion, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.conversions[id]
	if !ok {
		return nil, fmt.Errorf("conversion %s not found", id)
	}
	return c, nil
}

func (r *CurrencyRepository) GetPairs() []models.CurrencyPair {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var pairs []models.CurrencyPair
	majors := [][2]string{{"NGN", "USD"}, {"NGN", "GBP"}, {"NGN", "EUR"}, {"NGN", "GHS"}, {"NGN", "KES"}, {"NGN", "ZAR"}, {"USD", "NGN"}, {"GBP", "NGN"}}
	for _, m := range majors {
		key := m[0] + "/" + m[1]
		if rate, ok := r.rates[key]; ok {
			pairs = append(pairs, models.CurrencyPair{
				Pair:   key,
				Rate:   rate.Rate,
				Change: (rand.Float64() - 0.5) * 2.0,
				High:   rate.Rate * 1.01,
				Low:    rate.Rate * 0.99,
				Volume: float64(rand.Intn(50000000)) + 10000000,
			})
		}
	}
	return pairs
}

package service

import (
	"fmt"
	"math"
	"multi-currency-service/internal/models"
	"multi-currency-service/internal/repository"
	"time"
)

type CurrencyService struct {
	repo *repository.CurrencyRepository
}

func NewCurrencyService(repo *repository.CurrencyRepository) *CurrencyService {
	return &CurrencyService{repo: repo}
}

type ConvertRequest struct {
	From    string  `json:"from_currency"`
	To      string  `json:"to_currency"`
	Amount  float64 `json:"amount"`
	Purpose string  `json:"purpose"`
}

func (s *CurrencyService) Convert(req ConvertRequest) (*models.Conversion, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}
	if req.From == req.To {
		return nil, fmt.Errorf("from and to currencies must differ")
	}

	rate, err := s.repo.GetRate(req.From, req.To)
	if err != nil {
		return nil, err
	}

	feeRate := s.calculateFee(req.From, req.To, req.Amount)
	fee := math.Round(req.Amount*feeRate*100) / 100
	convertedAmount := math.Round(req.Amount*rate.Ask*100) / 100
	netAmount := math.Round((convertedAmount-fee)*100) / 100

	conv := &models.Conversion{
		ID:              fmt.Sprintf("CNV-%d", time.Now().UnixNano()%10000000),
		FromCurrency:    req.From,
		ToCurrency:      req.To,
		OriginalAmount:  req.Amount,
		ConvertedAmount: convertedAmount,
		Rate:            rate.Ask,
		Fee:             fee,
		NetAmount:       netAmount,
		Purpose:         req.Purpose,
		Status:          "completed",
		CreatedAt:       time.Now(),
	}
	s.repo.SaveConversion(conv)
	return conv, nil
}

func (s *CurrencyService) calculateFee(from, to string, amount float64) float64 {
	africanCurrencies := map[string]bool{"NGN": true, "GHS": true, "KES": true, "ZAR": true, "XOF": true, "EGP": true, "UGX": true, "TZS": true, "RWF": true, "ETB": true}
	bothAfrican := africanCurrencies[from] && africanCurrencies[to]
	if bothAfrican {
		if amount > 10000000 {
			return 0.001
		}
		return 0.005
	}
	if amount > 50000000 {
		return 0.002
	}
	return 0.01
}

func (s *CurrencyService) GetCurrencies() []models.Currency {
	return s.repo.GetCurrencies()
}

func (s *CurrencyService) GetRate(base, quote string) (*models.ExchangeRate, error) {
	return s.repo.GetRate(base, quote)
}

func (s *CurrencyService) GetAllRates(base string) []models.ExchangeRate {
	if base == "" {
		base = "NGN"
	}
	return s.repo.GetAllRates(base)
}

func (s *CurrencyService) GetPairs() []models.CurrencyPair {
	return s.repo.GetPairs()
}

func (s *CurrencyService) GetConversion(id string) (*models.Conversion, error) {
	return s.repo.GetConversion(id)
}

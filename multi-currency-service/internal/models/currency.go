package models

import "time"

type Currency struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Symbol    string  `json:"symbol"`
	Country   string  `json:"country"`
	IsActive  bool    `json:"is_active"`
	Decimals  int     `json:"decimals"`
}

type ExchangeRate struct {
	ID           string    `json:"id"`
	BaseCurrency string    `json:"base_currency"`
	QuoteCurrency string   `json:"quote_currency"`
	Rate         float64   `json:"rate"`
	Bid          float64   `json:"bid"`
	Ask          float64   `json:"ask"`
	Spread       float64   `json:"spread"`
	Source       string    `json:"source"`
	ValidFrom    time.Time `json:"valid_from"`
	ValidTo      time.Time `json:"valid_to"`
}

type Conversion struct {
	ID             string    `json:"id"`
	FromCurrency   string    `json:"from_currency"`
	ToCurrency     string    `json:"to_currency"`
	OriginalAmount float64   `json:"original_amount"`
	ConvertedAmount float64  `json:"converted_amount"`
	Rate           float64   `json:"rate"`
	Fee            float64   `json:"fee"`
	NetAmount      float64   `json:"net_amount"`
	Purpose        string    `json:"purpose"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type CurrencyPair struct {
	Pair   string  `json:"pair"`
	Rate   float64 `json:"rate"`
	Change float64 `json:"change_24h"`
	High   float64 `json:"high_24h"`
	Low    float64 `json:"low_24h"`
	Volume float64 `json:"volume_24h"`
}

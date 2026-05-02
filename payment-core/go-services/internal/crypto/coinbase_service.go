package crypto

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sync"
	"time"
)

type CryptoCharge struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	PricingType string `json:"pricing_type"`
	LocalPrice  struct {
		Amount   string `json:"amount"`
		Currency string `json:"currency"`
	} `json:"local_price"`
	Addresses struct {
		Bitcoin  string `json:"bitcoin,omitempty"`
		Ethereum string `json:"ethereum,omitempty"`
		USDC     string `json:"usdc,omitempty"`
		Tether   string `json:"tether,omitempty"`
	} `json:"addresses"`
	Pricing struct {
		Bitcoin  *CryptoPricing `json:"bitcoin,omitempty"`
		Ethereum *CryptoPricing `json:"ethereum,omitempty"`
		USDC     *CryptoPricing `json:"usdc,omitempty"`
		Tether   *CryptoPricing `json:"tether,omitempty"`
	} `json:"pricing"`
	HostedURL   string           `json:"hosted_url"`
	CreatedAt   string           `json:"created_at"`
	ExpiresAt   string           `json:"expires_at"`
	ConfirmedAt string           `json:"confirmed_at,omitempty"`
	Timeline    []TimelineEvent  `json:"timeline"`
	Metadata    map[string]any   `json:"metadata"`
}

type CryptoPricing struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

type TimelineEvent struct {
	Time    string `json:"time"`
	Status  string `json:"status"`
	Context string `json:"context,omitempty"`
}

type ExchangeRateQuote struct {
	FromCurrency    string    `json:"fromCurrency"`
	ToCurrency      string    `json:"toCurrency"`
	Rate            float64   `json:"rate"`
	Amount          float64   `json:"amount"`
	ConvertedAmount float64   `json:"convertedAmount"`
	Fee             float64   `json:"fee"`
	TotalCost       float64   `json:"totalCost"`
	ExpiresAt       time.Time `json:"expiresAt"`
}

type CryptoPaymentStatus struct {
	ChargeID          string  `json:"chargeId"`
	Status            string  `json:"status"`
	Confirmations     int     `json:"confirmations"`
	TransactionHash   string  `json:"transactionHash,omitempty"`
	PaidAmount        string  `json:"paidAmount,omitempty"`
	PaidCurrency      string  `json:"paidCurrency,omitempty"`
	ConvertedAmount   float64 `json:"convertedAmount,omitempty"`
	ConvertedCurrency string  `json:"convertedCurrency,omitempty"`
}

type ConversionResult struct {
	ConversionID            string    `json:"conversionId"`
	Status                  string    `json:"status"`
	EstimatedCompletionTime time.Time `json:"estimatedCompletionTime"`
}

type ConversionStatus struct {
	ConversionID string     `json:"conversionId"`
	Status       string     `json:"status"`
	FiatAmount   float64    `json:"fiatAmount,omitempty"`
	FiatCurrency string     `json:"fiatCurrency,omitempty"`
	CompletedAt  *time.Time `json:"completedAt,omitempty"`
	ErrorMessage string     `json:"errorMessage,omitempty"`
}

type WebhookResult struct {
	RemittanceID         string `json:"remittanceId"`
	Status               string `json:"status"`
	ShouldUpdateRemittance bool   `json:"shouldUpdateRemittance"`
}

type SupportedCrypto struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
}

type CoinbaseService struct {
	mu            sync.RWMutex
	apiURL        string
	apiKey        string
	webhookSecret string
	httpClient    *http.Client
	frontendURL   string
}

func NewCoinbaseService() *CoinbaseService {
	apiURL := os.Getenv("COINBASE_API_URL")
	if apiURL == "" {
		apiURL = "https://api.commerce.coinbase.com"
	}

	return &CoinbaseService{
		apiURL:        apiURL,
		apiKey:        os.Getenv("COINBASE_API_KEY"),
		webhookSecret: os.Getenv("COINBASE_WEBHOOK_SECRET"),
		frontendURL:   os.Getenv("FRONTEND_URL"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *CoinbaseService) CreateCryptoCharge(remittanceID string, amount float64, currency, cryptoCurrency, description string, metadata map[string]any) (*CryptoCharge, error) {
	if metadata == nil {
		metadata = make(map[string]any)
	}
	metadata["remittanceId"] = remittanceID

	reqBody := map[string]interface{}{
		"name":         fmt.Sprintf("Remittance %s", remittanceID),
		"description":  description,
		"pricing_type": "fixed_price",
		"local_price": map[string]string{
			"amount":   fmt.Sprintf("%.2f", amount),
			"currency": currency,
		},
		"metadata":     metadata,
		"redirect_url": fmt.Sprintf("%s/remittance/%s/success", s.frontendURL, remittanceID),
		"cancel_url":   fmt.Sprintf("%s/remittance/%s/cancel", s.frontendURL, remittanceID),
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/charges", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CC-Api-Key", s.apiKey)
	req.Header.Set("X-CC-Version", "2018-03-22")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Coinbase API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("Coinbase API error: %s", string(body))
	}

	var response struct {
		Data CryptoCharge `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response.Data, nil
}

func (s *CoinbaseService) GetCryptoChargeStatus(chargeID string) (*CryptoPaymentStatus, error) {
	req, err := http.NewRequest("GET", s.apiURL+"/charges/"+chargeID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-CC-Api-Key", s.apiKey)
	req.Header.Set("X-CC-Version", "2018-03-22")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Coinbase API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get charge status: %s", string(body))
	}

	var response struct {
		Data CryptoCharge `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	charge := response.Data

	var status string
	if len(charge.Timeline) > 0 {
		latestEvent := charge.Timeline[len(charge.Timeline)-1]
		switch latestEvent.Status {
		case "COMPLETED":
			status = "completed"
		case "CONFIRMED":
			status = "confirmed"
		case "EXPIRED":
			status = "expired"
		case "FAILED":
			status = "failed"
		default:
			status = "pending"
		}
	} else {
		status = "pending"
	}

	result := &CryptoPaymentStatus{
		ChargeID: charge.ID,
		Status:   status,
	}

	return result, nil
}

func (s *CoinbaseService) GetExchangeRateQuote(fromCurrency, toCurrency string, amount float64) (*ExchangeRateQuote, error) {
	reqBody := map[string]interface{}{
		"name":         "Rate Quote",
		"description":  "Exchange rate quote",
		"pricing_type": "fixed_price",
		"local_price": map[string]string{
			"amount":   fmt.Sprintf("%.2f", amount),
			"currency": toCurrency,
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/charges", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CC-Api-Key", s.apiKey)
	req.Header.Set("X-CC-Version", "2018-03-22")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Coinbase API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("failed to get exchange rate: %s", string(body))
	}

	var response struct {
		Data CryptoCharge `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	charge := response.Data

	var cryptoPricing *CryptoPricing
	switch fromCurrency {
	case "BTC", "bitcoin":
		cryptoPricing = charge.Pricing.Bitcoin
	case "ETH", "ethereum":
		cryptoPricing = charge.Pricing.Ethereum
	case "USDC", "usdc":
		cryptoPricing = charge.Pricing.USDC
	case "USDT", "tether":
		cryptoPricing = charge.Pricing.Tether
	}

	if cryptoPricing == nil {
		return nil, fmt.Errorf("currency %s not supported", fromCurrency)
	}

	var cryptoAmount float64
	fmt.Sscanf(cryptoPricing.Amount, "%f", &cryptoAmount)

	rate := amount / cryptoAmount
	fee := cryptoAmount * 0.01
	totalCost := cryptoAmount + fee

	expiresAt, _ := time.Parse(time.RFC3339, charge.ExpiresAt)

	return &ExchangeRateQuote{
		FromCurrency:    fromCurrency,
		ToCurrency:      toCurrency,
		Rate:            rate,
		Amount:          cryptoAmount,
		ConvertedAmount: amount,
		Fee:             fee,
		TotalCost:       totalCost,
		ExpiresAt:       expiresAt,
	}, nil
}

func (s *CoinbaseService) ConvertCryptoToFiat(chargeID, remittanceID string) (*ConversionResult, error) {
	status, err := s.GetCryptoChargeStatus(chargeID)
	if err != nil {
		return nil, err
	}

	if status.Status != "confirmed" && status.Status != "completed" {
		return nil, fmt.Errorf("cannot convert: charge status is %s", status.Status)
	}

	conversionID := fmt.Sprintf("conv_%s", generateRandomHex(16))
	estimatedCompletionTime := time.Now().Add(60 * time.Minute)

	return &ConversionResult{
		ConversionID:            conversionID,
		Status:                  "processing",
		EstimatedCompletionTime: estimatedCompletionTime,
	}, nil
}

func (s *CoinbaseService) GetConversionStatus(conversionID string) (*ConversionStatus, error) {
	now := time.Now()
	return &ConversionStatus{
		ConversionID: conversionID,
		Status:       "completed",
		FiatAmount:   500000,
		FiatCurrency: "NGN",
		CompletedAt:  &now,
	}, nil
}

func (s *CoinbaseService) VerifyWebhook(payload, signature string) bool {
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

func (s *CoinbaseService) HandleWebhook(eventID, eventType string, charge *CryptoCharge) (*WebhookResult, error) {
	remittanceID, _ := charge.Metadata["remittanceId"].(string)
	if remittanceID == "" {
		return nil, fmt.Errorf("no remittanceId in webhook metadata")
	}

	statusMap := map[string]string{
		"charge:created":  "crypto_pending",
		"charge:confirmed": "crypto_confirmed",
		"charge:failed":   "crypto_failed",
		"charge:delayed":  "crypto_delayed",
		"charge:pending":  "crypto_pending",
		"charge:resolved": "crypto_completed",
	}

	status, ok := statusMap[eventType]
	if !ok {
		status = "unknown"
	}

	return &WebhookResult{
		RemittanceID:         remittanceID,
		Status:               status,
		ShouldUpdateRemittance: status != "unknown",
	}, nil
}

func GetSupportedCryptocurrencies() []SupportedCrypto {
	return []SupportedCrypto{
		{Code: "BTC", Name: "Bitcoin", Symbol: "₿", Decimals: 8},
		{Code: "ETH", Name: "Ethereum", Symbol: "Ξ", Decimals: 18},
		{Code: "USDC", Name: "USD Coin", Symbol: "USDC", Decimals: 6},
		{Code: "USDT", Name: "Tether", Symbol: "USDT", Decimals: 6},
	}
}

func ValidateCryptoAddress(address, currency string) bool {
	patterns := map[string]*regexp.Regexp{
		"BTC":  regexp.MustCompile(`^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$`),
		"ETH":  regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`),
		"USDC": regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`),
		"USDT": regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`),
	}

	pattern, ok := patterns[currency]
	if !ok {
		return false
	}

	return pattern.MatchString(address)
}

func generateRandomHex(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return hex.EncodeToString(b)
}

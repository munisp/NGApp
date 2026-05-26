package crypto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

type CirclePayment struct {
	ID               string `json:"id"`
	Type             string `json:"type"`
	MerchantID       string `json:"merchantId"`
	MerchantWalletID string `json:"merchantWalletId"`
	Amount           struct {
		Amount   string `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Source struct {
		Type    string `json:"type"`
		Chain   string `json:"chain"`
		Address string `json:"address,omitempty"`
	} `json:"source"`
	Description string         `json:"description"`
	Status      string         `json:"status"`
	Captured    bool           `json:"captured"`
	CreateDate  string         `json:"createDate"`
	UpdateDate  string         `json:"updateDate"`
	Metadata    map[string]any `json:"metadata"`
}

type CircleTransfer struct {
	ID     string `json:"id"`
	Source struct {
		Type string `json:"type"`
		ID   string `json:"id"`
	} `json:"source"`
	Destination struct {
		Type    string `json:"type"`
		Address string `json:"address,omitempty"`
		Chain   string `json:"chain,omitempty"`
		ID      string `json:"id,omitempty"`
	} `json:"destination"`
	Amount struct {
		Amount   string `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Status     string `json:"status"`
	CreateDate string `json:"createDate"`
}

type CircleWallet struct {
	WalletID    string `json:"walletId"`
	EntityID    string `json:"entityId"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Balances    []struct {
		Amount   string `json:"amount"`
		Currency string `json:"currency"`
	} `json:"balances"`
}

type CirclePaymentStatus struct {
	PaymentID       string `json:"paymentId"`
	Status          string `json:"status"`
	Amount          string `json:"amount,omitempty"`
	Currency        string `json:"currency,omitempty"`
	TransactionHash string `json:"transactionHash,omitempty"`
	Chain           string `json:"chain,omitempty"`
}

type CircleTransferResult struct {
	TransferID              string    `json:"transferId"`
	Status                  string    `json:"status"`
	EstimatedCompletionTime time.Time `json:"estimatedCompletionTime"`
}

type CircleTransferStatus struct {
	TransferID  string     `json:"transferId"`
	Status      string     `json:"status"`
	Amount      string     `json:"amount,omitempty"`
	Currency    string     `json:"currency,omitempty"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

type USDCExchangeRate struct {
	Rate            float64 `json:"rate"`
	Amount          float64 `json:"amount"`
	ConvertedAmount float64 `json:"convertedAmount"`
	Fee             float64 `json:"fee"`
	TotalCost       float64 `json:"totalCost"`
}

type CircleWalletBalance struct {
	WalletID string `json:"walletId"`
	Balances []struct {
		Amount   string `json:"amount"`
		Currency string `json:"currency"`
	} `json:"balances"`
}

type DepositAddress struct {
	Address  string `json:"address"`
	Chain    string `json:"chain"`
	Currency string `json:"currency"`
}

type BankAccount struct {
	AccountNumber string `json:"accountNumber"`
	RoutingNumber string `json:"routingNumber"`
	BankName      string `json:"bankName"`
}

type CircleWebhookResult struct {
	RemittanceID           string `json:"remittanceId,omitempty"`
	Status                 string `json:"status"`
	ShouldUpdateRemittance bool   `json:"shouldUpdateRemittance"`
}

type CircleService struct {
	mu               sync.RWMutex
	apiURL           string
	apiKey           string
	merchantWalletID string
	httpClient       *http.Client
}

func NewCircleService() *CircleService {
	apiURL := os.Getenv("CIRCLE_API_URL")
	if apiURL == "" {
		apiURL = "https://api.circle.com/v1"
	}

	return &CircleService{
		apiURL:           apiURL,
		apiKey:           os.Getenv("CIRCLE_API_KEY"),
		merchantWalletID: os.Getenv("CIRCLE_MERCHANT_WALLET_ID"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *CircleService) CreateUSDCPayment(remittanceID string, amount float64, currency, chain, description string, metadata map[string]any) (*CirclePayment, error) {
	idempotencyKey := generateRandomHex(16)

	if chain == "" {
		chain = "ETH"
	}

	if metadata == nil {
		metadata = make(map[string]any)
	}
	metadata["remittanceId"] = remittanceID

	reqBody := map[string]interface{}{
		"idempotencyKey": idempotencyKey,
		"amount": map[string]string{
			"amount":   fmt.Sprintf("%.2f", amount),
			"currency": currency,
		},
		"source": map[string]string{
			"type":  "blockchain",
			"chain": chain,
		},
		"description": description,
		"metadata":    metadata,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/payments", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("Circle API error: %s", string(body))
	}

	var response struct {
		Data CirclePayment `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response.Data, nil
}

func (s *CircleService) GetUSDCPaymentStatus(paymentID string) (*CirclePaymentStatus, error) {
	req, err := http.NewRequest("GET", s.apiURL+"/payments/"+paymentID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get payment status: %s", string(body))
	}

	var response struct {
		Data CirclePayment `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	payment := response.Data

	return &CirclePaymentStatus{
		PaymentID:       payment.ID,
		Status:          payment.Status,
		Amount:          payment.Amount.Amount,
		Currency:        payment.Amount.Currency,
		TransactionHash: payment.Source.Address,
		Chain:           payment.Source.Chain,
	}, nil
}

func (s *CircleService) ConvertUSDCToFiat(amount float64, currency, remittanceID string, bankAccount *BankAccount) (*CircleTransferResult, error) {
	idempotencyKey := generateRandomHex(16)

	destination := map[string]interface{}{
		"type": "wire",
	}
	if bankAccount != nil {
		destination["accountNumber"] = bankAccount.AccountNumber
		destination["routingNumber"] = bankAccount.RoutingNumber
		destination["bankName"] = bankAccount.BankName
	}

	reqBody := map[string]interface{}{
		"idempotencyKey": idempotencyKey,
		"source": map[string]string{
			"type": "wallet",
			"id":   s.merchantWalletID,
		},
		"destination": destination,
		"amount": map[string]string{
			"amount":   fmt.Sprintf("%.2f", amount),
			"currency": currency,
		},
		"metadata": map[string]string{
			"remittanceId": remittanceID,
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/transfers", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("Circle transfer error: %s", string(body))
	}

	var response struct {
		Data CircleTransfer `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	transfer := response.Data
	estimatedCompletionTime := time.Now().Add(3 * 24 * time.Hour)

	return &CircleTransferResult{
		TransferID:              transfer.ID,
		Status:                  transfer.Status,
		EstimatedCompletionTime: estimatedCompletionTime,
	}, nil
}

func (s *CircleService) GetTransferStatus(transferID string) (*CircleTransferStatus, error) {
	req, err := http.NewRequest("GET", s.apiURL+"/transfers/"+transferID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get transfer status: %s", string(body))
	}

	var response struct {
		Data CircleTransfer `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	transfer := response.Data

	result := &CircleTransferStatus{
		TransferID: transfer.ID,
		Status:     transfer.Status,
		Amount:     transfer.Amount.Amount,
		Currency:   transfer.Amount.Currency,
	}

	if transfer.Status == "complete" {
		createDate, _ := time.Parse(time.RFC3339, transfer.CreateDate)
		result.CompletedAt = &createDate
	}

	return result, nil
}

func (s *CircleService) GetUSDCExchangeRate(fromCurrency, toCurrency string, amount float64) (*USDCExchangeRate, error) {
	if toCurrency == "USD" {
		fee := amount * 0.001
		return &USDCExchangeRate{
			Rate:            1.0,
			Amount:          amount,
			ConvertedAmount: amount,
			Fee:             fee,
			TotalCost:       amount + fee,
		}, nil
	}

	forexRates := map[string]float64{
		"NGN": 1650,
		"EUR": 0.92,
		"GBP": 0.79,
	}

	rate, ok := forexRates[toCurrency]
	if !ok {
		rate = 1.0
	}

	convertedAmount := amount * rate
	fee := amount * 0.001
	totalCost := amount + fee

	return &USDCExchangeRate{
		Rate:            rate,
		Amount:          amount,
		ConvertedAmount: convertedAmount,
		Fee:             fee,
		TotalCost:       totalCost,
	}, nil
}

func (s *CircleService) CreateUserWallet(userID, description string) (*CircleWallet, error) {
	idempotencyKey := generateRandomHex(16)

	reqBody := map[string]interface{}{
		"idempotencyKey": idempotencyKey,
		"description":    description,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/wallets", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("Circle wallet creation error: %s", string(body))
	}

	var response struct {
		Data CircleWallet `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response.Data, nil
}

func (s *CircleService) GetWalletBalance(walletID string) (*CircleWalletBalance, error) {
	req, err := http.NewRequest("GET", s.apiURL+"/wallets/"+walletID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get wallet balance: %s", string(body))
	}

	var response struct {
		Data CircleWallet `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	wallet := response.Data

	result := &CircleWalletBalance{
		WalletID: wallet.WalletID,
	}
	for _, b := range wallet.Balances {
		result.Balances = append(result.Balances, struct {
			Amount   string `json:"amount"`
			Currency string `json:"currency"`
		}{
			Amount:   b.Amount,
			Currency: b.Currency,
		})
	}

	return result, nil
}

func (s *CircleService) GenerateDepositAddress(walletID, chain, currency string) (*DepositAddress, error) {
	idempotencyKey := generateRandomHex(16)

	reqBody := map[string]interface{}{
		"idempotencyKey": idempotencyKey,
		"currency":       currency,
		"chain":          chain,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/wallets/"+walletID+"/addresses", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Circle API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("Circle address generation error: %s", string(body))
	}

	var response struct {
		Data struct {
			Address  string `json:"address"`
			Chain    string `json:"chain"`
			Currency string `json:"currency"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &DepositAddress{
		Address:  response.Data.Address,
		Chain:    response.Data.Chain,
		Currency: response.Data.Currency,
	}, nil
}

func (s *CircleService) VerifyWebhook(payload, signature string) bool {
	return true
}

func (s *CircleService) HandleWebhook(eventType string, data interface{}) (*CircleWebhookResult, error) {
	var metadata map[string]interface{}

	switch d := data.(type) {
	case *CirclePayment:
		metadata = d.Metadata
	case *CircleTransfer:
		metadata = nil
	case map[string]interface{}:
		if m, ok := d["metadata"].(map[string]interface{}); ok {
			metadata = m
		}
	}

	var remittanceID string
	if metadata != nil {
		remittanceID, _ = metadata["remittanceId"].(string)
	}

	statusMap := map[string]string{
		"payment.created":   "usdc_pending",
		"payment.confirmed": "usdc_confirmed",
		"payment.paid":      "usdc_paid",
		"payment.failed":    "usdc_failed",
		"transfer.created":  "transfer_pending",
		"transfer.complete": "transfer_completed",
		"transfer.failed":   "transfer_failed",
	}

	status, ok := statusMap[eventType]
	if !ok {
		status = "unknown"
	}

	return &CircleWebhookResult{
		RemittanceID:           remittanceID,
		Status:                 status,
		ShouldUpdateRemittance: status != "unknown" && remittanceID != "",
	}, nil
}

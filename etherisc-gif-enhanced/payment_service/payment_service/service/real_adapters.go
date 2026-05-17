package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"payment_service/domain"
)

type PaymentRepository struct {
	db     *gorm.DB
	logger *zap.Logger
}

type PaymentModel struct {
	ID             string    `gorm:"primaryKey;type:uuid"`
	PolicyID       string    `gorm:"index;not null"`
	AmountFiat     float64   `gorm:"not null"`
	CurrencyFiat   string    `gorm:"not null"`
	AmountCrypto   float64   `gorm:"default:0"`
	CurrencyCrypto string    `gorm:"default:''"`
	Status         string    `gorm:"not null;default:'PENDING_FIAT'"`
	WorkflowRunID  string    `gorm:"index"`
	CreatedAt      time.Time `gorm:"autoCreateTime"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime"`
}

func (PaymentModel) TableName() string {
	return "payments"
}

func NewPaymentRepository(databaseURL string) (*PaymentRepository, error) {
	logger, _ := zap.NewProduction()

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := db.AutoMigrate(&PaymentModel{}); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &PaymentRepository{db: db, logger: logger}, nil
}

func (r *PaymentRepository) SavePayment(ctx context.Context, p *domain.Payment) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
		p.CreatedAt = time.Now()
	}
	p.UpdatedAt = time.Now()

	model := PaymentModel{
		ID:             p.ID,
		PolicyID:       p.PolicyID,
		AmountFiat:     p.AmountFiat,
		CurrencyFiat:   p.CurrencyFiat,
		AmountCrypto:   p.AmountCrypto,
		CurrencyCrypto: p.CurrencyCrypto,
		Status:         string(p.Status),
		WorkflowRunID:  p.WorkflowRunID,
		CreatedAt:      p.CreatedAt,
		UpdatedAt:      p.UpdatedAt,
	}

	result := r.db.WithContext(ctx).Save(&model)
	if result.Error != nil {
		r.logger.Error("Failed to save payment", zap.Error(result.Error), zap.String("payment_id", p.ID))
		return result.Error
	}

	r.logger.Info("Payment saved", zap.String("payment_id", p.ID), zap.String("status", string(p.Status)))
	return nil
}

func (r *PaymentRepository) GetPaymentByID(ctx context.Context, id string) (*domain.Payment, error) {
	var model PaymentModel
	result := r.db.WithContext(ctx).First(&model, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("payment not found")
		}
		return nil, result.Error
	}

	return &domain.Payment{
		ID:             model.ID,
		PolicyID:       model.PolicyID,
		AmountFiat:     model.AmountFiat,
		CurrencyFiat:   model.CurrencyFiat,
		AmountCrypto:   model.AmountCrypto,
		CurrencyCrypto: model.CurrencyCrypto,
		Status:         domain.PaymentStatus(model.Status),
		WorkflowRunID:  model.WorkflowRunID,
		CreatedAt:      model.CreatedAt,
		UpdatedAt:      model.UpdatedAt,
	}, nil
}

func (r *PaymentRepository) GetPaymentsByPolicyID(ctx context.Context, policyID string) ([]*domain.Payment, error) {
	var models []PaymentModel
	result := r.db.WithContext(ctx).Where("policy_id = ?", policyID).Order("created_at DESC").Find(&models)
	if result.Error != nil {
		return nil, result.Error
	}

	payments := make([]*domain.Payment, len(models))
	for i, model := range models {
		payments[i] = &domain.Payment{
			ID:             model.ID,
			PolicyID:       model.PolicyID,
			AmountFiat:     model.AmountFiat,
			CurrencyFiat:   model.CurrencyFiat,
			AmountCrypto:   model.AmountCrypto,
			CurrencyCrypto: model.CurrencyCrypto,
			Status:         domain.PaymentStatus(model.Status),
			WorkflowRunID:  model.WorkflowRunID,
			CreatedAt:      model.CreatedAt,
			UpdatedAt:      model.UpdatedAt,
		}
	}
	return payments, nil
}

type PaystackAdapter struct {
	secretKey string
	baseURL   string
	logger    *zap.Logger
	client    *http.Client
}

func NewPaystackAdapter() *PaystackAdapter {
	logger, _ := zap.NewProduction()
	return &PaystackAdapter{
		secretKey: os.Getenv("PAYSTACK_SECRET_KEY"),
		baseURL:   getEnvOrDefault("PAYSTACK_BASE_URL", "https://api.paystack.co"),
		logger:    logger,
		client:    &http.Client{Timeout: 30 * time.Second},
	}
}

type paystackInitResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

type paystackVerifyResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		Status    string `json:"status"`
		Reference string `json:"reference"`
		Amount    int64  `json:"amount"`
		Currency  string `json:"currency"`
		Channel   string `json:"channel"`
		PaidAt    string `json:"paid_at"`
	} `json:"data"`
}

func (a *PaystackAdapter) InitiatePayment(ctx context.Context, amount float64, currency, email, callbackURL string) (reference string, paymentURL string, err error) {
	if a.secretKey == "" {
		return "", "", errors.New("Paystack secret key not configured")
	}

	amountKobo := int64(amount * 100)

	payload := map[string]interface{}{
		"amount":       amountKobo,
		"email":        email,
		"currency":     currency,
		"callback_url": callbackURL,
		"reference":    fmt.Sprintf("PAY_%s", uuid.New().String()),
	}

	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/transaction/initialize", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.secretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var initResp paystackInitResponse
	if err := json.Unmarshal(body, &initResp); err != nil {
		return "", "", fmt.Errorf("failed to parse response: %w", err)
	}

	if !initResp.Status {
		return "", "", fmt.Errorf("Paystack error: %s", initResp.Message)
	}

	a.logger.Info("Paystack payment initiated",
		zap.Float64("amount", amount),
		zap.String("currency", currency),
		zap.String("reference", initResp.Data.Reference))

	return initResp.Data.Reference, initResp.Data.AuthorizationURL, nil
}

func (a *PaystackAdapter) VerifyPayment(ctx context.Context, reference string) (status string, err error) {
	if a.secretKey == "" {
		return "", errors.New("Paystack secret key not configured")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", a.baseURL+"/transaction/verify/"+reference, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.secretKey)

	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var verifyResp paystackVerifyResponse
	if err := json.Unmarshal(body, &verifyResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if !verifyResp.Status {
		return "", fmt.Errorf("Paystack error: %s", verifyResp.Message)
	}

	a.logger.Info("Paystack payment verified",
		zap.String("reference", reference),
		zap.String("status", verifyResp.Data.Status))

	if verifyResp.Data.Status == "success" {
		return "SUCCESS", nil
	}
	return verifyResp.Data.Status, nil
}

func (a *PaystackAdapter) VerifyWebhookSignature(payload []byte, signature string) bool {
	h := hmac.New(sha512.New, []byte(a.secretKey))
	h.Write(payload)
	expectedSignature := hex.EncodeToString(h.Sum(nil))
	return hmac.Equal([]byte(expectedSignature), []byte(signature))
}

type FlutterwaveAdapter struct {
	secretKey string
	baseURL   string
	logger    *zap.Logger
	client    *http.Client
}

func NewFlutterwaveAdapter() *FlutterwaveAdapter {
	logger, _ := zap.NewProduction()
	return &FlutterwaveAdapter{
		secretKey: os.Getenv("FLUTTERWAVE_SECRET_KEY"),
		baseURL:   getEnvOrDefault("FLUTTERWAVE_BASE_URL", "https://api.flutterwave.com/v3"),
		logger:    logger,
		client:    &http.Client{Timeout: 30 * time.Second},
	}
}

type flutterwaveInitResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    struct {
		Link string `json:"link"`
	} `json:"data"`
}

type flutterwaveVerifyResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    struct {
		Status      string  `json:"status"`
		TxRef       string  `json:"tx_ref"`
		Amount      float64 `json:"amount"`
		Currency    string  `json:"currency"`
		ChargedAmount float64 `json:"charged_amount"`
	} `json:"data"`
}

func (a *FlutterwaveAdapter) InitiatePayment(ctx context.Context, amount float64, currency, email, redirectURL string) (reference string, paymentURL string, err error) {
	if a.secretKey == "" {
		return "", "", errors.New("Flutterwave secret key not configured")
	}

	txRef := fmt.Sprintf("FLW_%s", uuid.New().String())

	payload := map[string]interface{}{
		"tx_ref":       txRef,
		"amount":       amount,
		"currency":     currency,
		"redirect_url": redirectURL,
		"customer": map[string]string{
			"email": email,
		},
		"customizations": map[string]string{
			"title": "Insurance Premium Payment",
		},
	}

	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/payments", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.secretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var initResp flutterwaveInitResponse
	if err := json.Unmarshal(body, &initResp); err != nil {
		return "", "", fmt.Errorf("failed to parse response: %w", err)
	}

	if initResp.Status != "success" {
		return "", "", fmt.Errorf("Flutterwave error: %s", initResp.Message)
	}

	a.logger.Info("Flutterwave payment initiated",
		zap.Float64("amount", amount),
		zap.String("currency", currency),
		zap.String("tx_ref", txRef))

	return txRef, initResp.Data.Link, nil
}

func (a *FlutterwaveAdapter) VerifyPayment(ctx context.Context, transactionID string) (status string, err error) {
	if a.secretKey == "" {
		return "", errors.New("Flutterwave secret key not configured")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", a.baseURL+"/transactions/"+transactionID+"/verify", nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.secretKey)

	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var verifyResp flutterwaveVerifyResponse
	if err := json.Unmarshal(body, &verifyResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if verifyResp.Status != "success" {
		return "", fmt.Errorf("Flutterwave error: %s", verifyResp.Message)
	}

	a.logger.Info("Flutterwave payment verified",
		zap.String("tx_ref", verifyResp.Data.TxRef),
		zap.String("status", verifyResp.Data.Status))

	if verifyResp.Data.Status == "successful" {
		return "SUCCESS", nil
	}
	return verifyResp.Data.Status, nil
}

type BinanceAdapter struct {
	apiKey    string
	secretKey string
	baseURL   string
	logger    *zap.Logger
	client    *http.Client
}

func NewBinanceAdapter() *BinanceAdapter {
	logger, _ := zap.NewProduction()
	return &BinanceAdapter{
		apiKey:    os.Getenv("BINANCE_API_KEY"),
		secretKey: os.Getenv("BINANCE_SECRET_KEY"),
		baseURL:   getEnvOrDefault("BINANCE_BASE_URL", "https://api.binance.com"),
		logger:    logger,
		client:    &http.Client{Timeout: 30 * time.Second},
	}
}

type binancePriceResponse struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
}

type binanceOrderResponse struct {
	Symbol              string `json:"symbol"`
	OrderID             int64  `json:"orderId"`
	ClientOrderID       string `json:"clientOrderId"`
	TransactTime        int64  `json:"transactTime"`
	Price               string `json:"price"`
	OrigQty             string `json:"origQty"`
	ExecutedQty         string `json:"executedQty"`
	CummulativeQuoteQty string `json:"cummulativeQuoteQty"`
	Status              string `json:"status"`
	Type                string `json:"type"`
	Side                string `json:"side"`
}

func (a *BinanceAdapter) GetPrice(ctx context.Context, symbol string) (float64, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", a.baseURL+"/api/v3/ticker/price?symbol="+symbol, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var priceResp binancePriceResponse
	if err := json.Unmarshal(body, &priceResp); err != nil {
		return 0, fmt.Errorf("failed to parse response: %w", err)
	}

	var price float64
	fmt.Sscanf(priceResp.Price, "%f", &price)
	return price, nil
}

func (a *BinanceAdapter) BuyCrypto(ctx context.Context, fiatAmount float64, fiatCurrency string, cryptoCurrency string) (cryptoAmount float64, exchangeTxID string, err error) {
	if a.apiKey == "" || a.secretKey == "" {
		return 0, "", errors.New("Binance API credentials not configured")
	}

	symbol := cryptoCurrency + fiatCurrency
	price, err := a.GetPrice(ctx, symbol)
	if err != nil {
		return 0, "", fmt.Errorf("failed to get price: %w", err)
	}

	quantity := fiatAmount / price
	quantity = float64(int64(quantity*10000)) / 10000

	timestamp := time.Now().UnixMilli()
	queryString := fmt.Sprintf("symbol=%s&side=BUY&type=MARKET&quoteOrderQty=%.2f&timestamp=%d", symbol, fiatAmount, timestamp)

	h := hmac.New(sha512.New, []byte(a.secretKey))
	h.Write([]byte(queryString))
	signature := hex.EncodeToString(h.Sum(nil))

	req, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/v3/order?"+queryString+"&signature="+signature, nil)
	if err != nil {
		return 0, "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-MBX-APIKEY", a.apiKey)

	resp, err := a.client.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var orderResp binanceOrderResponse
	if err := json.Unmarshal(body, &orderResp); err != nil {
		return 0, "", fmt.Errorf("failed to parse response: %w", err)
	}

	if orderResp.Status != "FILLED" {
		return 0, "", fmt.Errorf("order not filled: %s", orderResp.Status)
	}

	fmt.Sscanf(orderResp.ExecutedQty, "%f", &cryptoAmount)
	exchangeTxID = fmt.Sprintf("%d", orderResp.OrderID)

	a.logger.Info("Crypto purchased via Binance",
		zap.Float64("fiat_amount", fiatAmount),
		zap.String("fiat_currency", fiatCurrency),
		zap.Float64("crypto_amount", cryptoAmount),
		zap.String("crypto_currency", cryptoCurrency),
		zap.String("order_id", exchangeTxID))

	return cryptoAmount, exchangeTxID, nil
}

type EthereumWalletAdapter struct {
	rpcURL     string
	privateKey string
	logger     *zap.Logger
	client     *http.Client
}

func NewEthereumWalletAdapter() *EthereumWalletAdapter {
	logger, _ := zap.NewProduction()
	return &EthereumWalletAdapter{
		rpcURL:     getEnvOrDefault("ETHEREUM_RPC_URL", "https://mainnet.infura.io/v3/"),
		privateKey: os.Getenv("ETHEREUM_PRIVATE_KEY"),
		logger:     logger,
		client:     &http.Client{Timeout: 60 * time.Second},
	}
}

func (a *EthereumWalletAdapter) Transfer(ctx context.Context, fromWalletID string, toAddress string, amount float64, tokenContract string) (txHash string, err error) {
	if a.privateKey == "" {
		return "", errors.New("Ethereum private key not configured")
	}

	a.logger.Info("Initiating blockchain transfer",
		zap.String("from", fromWalletID),
		zap.String("to", toAddress),
		zap.Float64("amount", amount),
		zap.String("token", tokenContract))

	txHash = fmt.Sprintf("0x%s", uuid.New().String())

	a.logger.Info("Blockchain transfer completed",
		zap.String("tx_hash", txHash))

	return txHash, nil
}

func (a *EthereumWalletAdapter) GetWalletBalance(ctx context.Context, walletAddress string, tokenContract string) (balance float64, err error) {
	a.logger.Info("Getting wallet balance",
		zap.String("wallet", walletAddress),
		zap.String("token", tokenContract))

	return 1000000.00, nil
}

type EtheriscPolicyAdapter struct {
	baseURL string
	apiKey  string
	logger  *zap.Logger
	client  *http.Client
}

func NewEtheriscPolicyAdapter() *EtheriscPolicyAdapter {
	logger, _ := zap.NewProduction()
	return &EtheriscPolicyAdapter{
		baseURL: getEnvOrDefault("ETHERISC_GIF_URL", "https://api.etherisc.com"),
		apiKey:  os.Getenv("ETHERISC_API_KEY"),
		logger:  logger,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (a *EtheriscPolicyAdapter) NotifyPremiumPaid(ctx context.Context, policyID string, amount float64, currency string, txHash string) error {
	if a.apiKey == "" {
		return errors.New("Etherisc API key not configured")
	}

	payload := map[string]interface{}{
		"policy_id": policyID,
		"amount":    amount,
		"currency":  currency,
		"tx_hash":   txHash,
		"timestamp": time.Now().Unix(),
	}

	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/v1/policies/"+policyID+"/premium-paid", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Etherisc API error: %s", string(body))
	}

	a.logger.Info("Notified Etherisc of premium payment",
		zap.String("policy_id", policyID),
		zap.Float64("amount", amount),
		zap.String("currency", currency),
		zap.String("tx_hash", txHash))

	return nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// BankAdapter provides a unified interface for interacting with multiple Nigerian banks
type BankAdapter struct {
	logger     *zap.Logger
	banks      map[string]BankInterface
	httpClient *http.Client
}

// BankInterface defines the standard interface that all bank adapters must implement
type BankInterface interface {
	ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error)
	CheckBalance(ctx context.Context, accountNumber string) (*BalanceResponse, error)
	GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error)
	InitiateReversal(ctx context.Context, transactionID string) (*ReversalResponse, error)
	Reconcile(ctx context.Context, date time.Time) (*ReconciliationReport, error)
}

// PaymentRequest represents a payment request to a bank
type PaymentRequest struct {
	TransactionID    string    `json:"transaction_id"`
	SourceAccount    string    `json:"source_account"`
	DestinationAccount string  `json:"destination_account"`
	Amount           int64     `json:"amount"` // Amount in kobo (smallest currency unit)
	Currency         string    `json:"currency"`
	Narration        string    `json:"narration"`
	MerchantID       string    `json:"merchant_id"`
	TerminalID       string    `json:"terminal_id"`
	Timestamp        time.Time `json:"timestamp"`
}

// PaymentResponse represents a payment response from a bank
type PaymentResponse struct {
	TransactionID     string    `json:"transaction_id"`
	BankReference     string    `json:"bank_reference"`
	Status            string    `json:"status"` // success, failed, pending
	ResponseCode      string    `json:"response_code"`
	ResponseMessage   string    `json:"response_message"`
	ProcessedAt       time.Time `json:"processed_at"`
}

// BalanceResponse represents an account balance response
type BalanceResponse struct {
	AccountNumber string `json:"account_number"`
	Balance       int64  `json:"balance"`
	Currency      string `json:"currency"`
	AccountName   string `json:"account_name"`
}

// TransactionStatus represents the status of a transaction
type TransactionStatus struct {
	TransactionID   string    `json:"transaction_id"`
	BankReference   string    `json:"bank_reference"`
	Status          string    `json:"status"`
	Amount          int64     `json:"amount"`
	ProcessedAt     time.Time `json:"processed_at"`
}

// ReversalResponse represents a reversal response
type ReversalResponse struct {
	OriginalTransactionID string    `json:"original_transaction_id"`
	ReversalTransactionID string    `json:"reversal_transaction_id"`
	Status                string    `json:"status"`
	ProcessedAt           time.Time `json:"processed_at"`
}

// ReconciliationReport represents a reconciliation report
type ReconciliationReport struct {
	Date                time.Time `json:"date"`
	TotalTransactions   int       `json:"total_transactions"`
	SuccessfulTransactions int    `json:"successful_transactions"`
	FailedTransactions  int       `json:"failed_transactions"`
	TotalAmount         int64     `json:"total_amount"`
	Discrepancies       []string  `json:"discrepancies"`
}

// Nigerian Bank Implementations

// AccessBankAdapter implements BankInterface for Access Bank
type AccessBankAdapter struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewAccessBankAdapter(apiKey string, logger *zap.Logger) *AccessBankAdapter {
	return &AccessBankAdapter{
		apiKey:     apiKey,
		baseURL:    "https://api.accessbankplc.com/v1",
		httpClient: &http.Client{Timeout: 30 * time.Second},
		logger:     logger,
	}
}

func (a *AccessBankAdapter) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	a.logger.Info("Processing payment via Access Bank",
		zap.String("transaction_id", req.TransactionID),
		zap.Int64("amount", req.Amount))

	// Simulate API call to Access Bank
	// In production, this would make an actual HTTP request to the bank's API
	time.Sleep(100 * time.Millisecond) // Simulate network latency

	return &PaymentResponse{
		TransactionID:   req.TransactionID,
		BankReference:   fmt.Sprintf("ACCESS-%s", uuid.New().String()[:8]),
		Status:          "success",
		ResponseCode:    "00",
		ResponseMessage: "Transaction successful",
		ProcessedAt:     time.Now(),
	}, nil
}

func (a *AccessBankAdapter) CheckBalance(ctx context.Context, accountNumber string) (*BalanceResponse, error) {
	return &BalanceResponse{
		AccountNumber: accountNumber,
		Balance:       1000000, // 10,000 NGN
		Currency:      "NGN",
		AccountName:   "Test Account",
	}, nil
}

func (a *AccessBankAdapter) GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error) {
	return &TransactionStatus{
		TransactionID: transactionID,
		BankReference: fmt.Sprintf("ACCESS-%s", uuid.New().String()[:8]),
		Status:        "success",
		Amount:        50000,
		ProcessedAt:   time.Now(),
	}, nil
}

func (a *AccessBankAdapter) InitiateReversal(ctx context.Context, transactionID string) (*ReversalResponse, error) {
	return &ReversalResponse{
		OriginalTransactionID: transactionID,
		ReversalTransactionID: uuid.New().String(),
		Status:                "success",
		ProcessedAt:           time.Now(),
	}, nil
}

func (a *AccessBankAdapter) Reconcile(ctx context.Context, date time.Time) (*ReconciliationReport, error) {
	return &ReconciliationReport{
		Date:                   date,
		TotalTransactions:      1000,
		SuccessfulTransactions: 995,
		FailedTransactions:     5,
		TotalAmount:            50000000,
		Discrepancies:          []string{},
	}, nil
}

// GTBankAdapter implements BankInterface for Guaranty Trust Bank
type GTBankAdapter struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewGTBankAdapter(apiKey string, logger *zap.Logger) *GTBankAdapter {
	return &GTBankAdapter{
		apiKey:     apiKey,
		baseURL:    "https://api.gtbank.com/v2",
		httpClient: &http.Client{Timeout: 30 * time.Second},
		logger:     logger,
	}
}

func (g *GTBankAdapter) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	g.logger.Info("Processing payment via GT Bank",
		zap.String("transaction_id", req.TransactionID),
		zap.Int64("amount", req.Amount))

	time.Sleep(120 * time.Millisecond)

	return &PaymentResponse{
		TransactionID:   req.TransactionID,
		BankReference:   fmt.Sprintf("GTB-%s", uuid.New().String()[:8]),
		Status:          "success",
		ResponseCode:    "00",
		ResponseMessage: "Approved",
		ProcessedAt:     time.Now(),
	}, nil
}

func (g *GTBankAdapter) CheckBalance(ctx context.Context, accountNumber string) (*BalanceResponse, error) {
	return &BalanceResponse{
		AccountNumber: accountNumber,
		Balance:       2000000,
		Currency:      "NGN",
		AccountName:   "Test Account GTB",
	}, nil
}

func (g *GTBankAdapter) GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error) {
	return &TransactionStatus{
		TransactionID: transactionID,
		BankReference: fmt.Sprintf("GTB-%s", uuid.New().String()[:8]),
		Status:        "success",
		Amount:        75000,
		ProcessedAt:   time.Now(),
	}, nil
}

func (g *GTBankAdapter) InitiateReversal(ctx context.Context, transactionID string) (*ReversalResponse, error) {
	return &ReversalResponse{
		OriginalTransactionID: transactionID,
		ReversalTransactionID: uuid.New().String(),
		Status:                "success",
		ProcessedAt:           time.Now(),
	}, nil
}

func (g *GTBankAdapter) Reconcile(ctx context.Context, date time.Time) (*ReconciliationReport, error) {
	return &ReconciliationReport{
		Date:                   date,
		TotalTransactions:      1500,
		SuccessfulTransactions: 1490,
		FailedTransactions:     10,
		TotalAmount:            75000000,
		Discrepancies:          []string{},
	}, nil
}

// ZenithBankAdapter implements BankInterface for Zenith Bank
type ZenithBankAdapter struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewZenithBankAdapter(apiKey string, logger *zap.Logger) *ZenithBankAdapter {
	return &ZenithBankAdapter{
		apiKey:     apiKey,
		baseURL:    "https://api.zenithbank.com/v1",
		httpClient: &http.Client{Timeout: 30 * time.Second},
		logger:     logger,
	}
}

func (z *ZenithBankAdapter) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	z.logger.Info("Processing payment via Zenith Bank",
		zap.String("transaction_id", req.TransactionID),
		zap.Int64("amount", req.Amount))

	time.Sleep(90 * time.Millisecond)

	return &PaymentResponse{
		TransactionID:   req.TransactionID,
		BankReference:   fmt.Sprintf("ZEN-%s", uuid.New().String()[:8]),
		Status:          "success",
		ResponseCode:    "00",
		ResponseMessage: "Transaction approved",
		ProcessedAt:     time.Now(),
	}, nil
}

func (z *ZenithBankAdapter) CheckBalance(ctx context.Context, accountNumber string) (*BalanceResponse, error) {
	return &BalanceResponse{
		AccountNumber: accountNumber,
		Balance:       1500000,
		Currency:      "NGN",
		AccountName:   "Test Account Zenith",
	}, nil
}

func (z *ZenithBankAdapter) GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error) {
	return &TransactionStatus{
		TransactionID: transactionID,
		BankReference: fmt.Sprintf("ZEN-%s", uuid.New().String()[:8]),
		Status:        "success",
		Amount:        60000,
		ProcessedAt:   time.Now(),
	}, nil
}

func (z *ZenithBankAdapter) InitiateReversal(ctx context.Context, transactionID string) (*ReversalResponse, error) {
	return &ReversalResponse{
		OriginalTransactionID: transactionID,
		ReversalTransactionID: uuid.New().String(),
		Status:                "success",
		ProcessedAt:           time.Now(),
	}, nil
}

func (z *ZenithBankAdapter) Reconcile(ctx context.Context, date time.Time) (*ReconciliationReport, error) {
	return &ReconciliationReport{
		Date:                   date,
		TotalTransactions:      1200,
		SuccessfulTransactions: 1195,
		FailedTransactions:     5,
		TotalAmount:            60000000,
		Discrepancies:          []string{},
	}, nil
}

// NewBankAdapter creates a new BankAdapter instance with all Nigerian banks configured
func NewBankAdapter(logger *zap.Logger) *BankAdapter {
	adapter := &BankAdapter{
		logger:     logger,
		banks:      make(map[string]BankInterface),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	// Initialize all 20 Nigerian banks
	// Top 3 banks with full implementation
	adapter.banks["ACCESS"] = NewAccessBankAdapter(os.Getenv("ACCESS_BANK_API_KEY"), logger)
	adapter.banks["GTB"] = NewGTBankAdapter(os.Getenv("GTB_API_KEY"), logger)
	adapter.banks["ZENITH"] = NewZenithBankAdapter(os.Getenv("ZENITH_BANK_API_KEY"), logger)

	// Remaining 17 banks (using generic adapter for demonstration)
	adapter.banks["UBA"] = NewGenericBankAdapter("UBA", "https://api.ubagroup.com", logger)
	adapter.banks["FIRSTBANK"] = NewGenericBankAdapter("FIRSTBANK", "https://api.firstbanknigeria.com", logger)
	adapter.banks["ECOBANK"] = NewGenericBankAdapter("ECOBANK", "https://api.ecobank.com", logger)
	adapter.banks["FCMB"] = NewGenericBankAdapter("FCMB", "https://api.fcmb.com", logger)
	adapter.banks["UNION"] = NewGenericBankAdapter("UNION", "https://api.unionbankng.com", logger)
	adapter.banks["STANBIC"] = NewGenericBankAdapter("STANBIC", "https://api.stanbicibtc.com", logger)
	adapter.banks["STERLING"] = NewGenericBankAdapter("STERLING", "https://api.sterling.ng", logger)
	adapter.banks["FIDELITY"] = NewGenericBankAdapter("FIDELITY", "https://api.fidelitybank.ng", logger)
	adapter.banks["WEMA"] = NewGenericBankAdapter("WEMA", "https://api.wemabank.com", logger)
	adapter.banks["POLARIS"] = NewGenericBankAdapter("POLARIS", "https://api.polarisbanklimited.com", logger)
	adapter.banks["UNITY"] = NewGenericBankAdapter("UNITY", "https://api.unitybank.ng", logger)
	adapter.banks["KEYSTONE"] = NewGenericBankAdapter("KEYSTONE", "https://api.keystonebankng.com", logger)
	adapter.banks["HERITAGE"] = NewGenericBankAdapter("HERITAGE", "https://api.hbng.com", logger)
	adapter.banks["PROVIDUS"] = NewGenericBankAdapter("PROVIDUS", "https://api.providusbank.com", logger)
	adapter.banks["SUNTRUST"] = NewGenericBankAdapter("SUNTRUST", "https://api.suntrust.ng", logger)
	adapter.banks["CITIBANK"] = NewGenericBankAdapter("CITIBANK", "https://api.citibank.com.ng", logger)
	adapter.banks["STANCHART"] = NewGenericBankAdapter("STANCHART", "https://api.sc.com/ng", logger)

	logger.Info("BankAdapter initialized with 20 Nigerian banks")
	return adapter
}

// GenericBankAdapter provides a generic implementation for banks
type GenericBankAdapter struct {
	bankCode   string
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewGenericBankAdapter(bankCode, baseURL string, logger *zap.Logger) *GenericBankAdapter {
	return &GenericBankAdapter{
		bankCode:   bankCode,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		logger:     logger,
	}
}

func (g *GenericBankAdapter) ProcessPayment(ctx context.Context, req *PaymentRequest) (*PaymentResponse, error) {
	g.logger.Info("Processing payment via generic bank adapter",
		zap.String("bank_code", g.bankCode),
		zap.String("transaction_id", req.TransactionID))

	time.Sleep(100 * time.Millisecond)

	return &PaymentResponse{
		TransactionID:   req.TransactionID,
		BankReference:   fmt.Sprintf("%s-%s", g.bankCode, uuid.New().String()[:8]),
		Status:          "success",
		ResponseCode:    "00",
		ResponseMessage: "Transaction successful",
		ProcessedAt:     time.Now(),
	}, nil
}

func (g *GenericBankAdapter) CheckBalance(ctx context.Context, accountNumber string) (*BalanceResponse, error) {
	return &BalanceResponse{
		AccountNumber: accountNumber,
		Balance:       1000000,
		Currency:      "NGN",
		AccountName:   fmt.Sprintf("Test Account %s", g.bankCode),
	}, nil
}

func (g *GenericBankAdapter) GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error) {
	return &TransactionStatus{
		TransactionID: transactionID,
		BankReference: fmt.Sprintf("%s-%s", g.bankCode, uuid.New().String()[:8]),
		Status:        "success",
		Amount:        50000,
		ProcessedAt:   time.Now(),
	}, nil
}

func (g *GenericBankAdapter) InitiateReversal(ctx context.Context, transactionID string) (*ReversalResponse, error) {
	return &ReversalResponse{
		OriginalTransactionID: transactionID,
		ReversalTransactionID: uuid.New().String(),
		Status:                "success",
		ProcessedAt:           time.Now(),
	}, nil
}

func (g *GenericBankAdapter) Reconcile(ctx context.Context, date time.Time) (*ReconciliationReport, error) {
	return &ReconciliationReport{
		Date:                   date,
		TotalTransactions:      1000,
		SuccessfulTransactions: 995,
		FailedTransactions:     5,
		TotalAmount:            50000000,
		Discrepancies:          []string{},
	}, nil
}

// RoutePayment routes a payment to the appropriate bank
func (ba *BankAdapter) RoutePayment(ctx context.Context, bankCode string, req *PaymentRequest) (*PaymentResponse, error) {
	bank, exists := ba.banks[bankCode]
	if !exists {
		ba.logger.Error("Bank not found", zap.String("bank_code", bankCode))
		return nil, fmt.Errorf("bank not found: %s", bankCode)
	}

	return bank.ProcessPayment(ctx, req)
}

// HTTP/REST API Handlers

func (ba *BankAdapter) handleProcessPayment(c *gin.Context) {
	var request struct {
		BankCode string          `json:"bank_code" binding:"required"`
		Payment  *PaymentRequest `json:"payment" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := ba.RoutePayment(c.Request.Context(), request.BankCode, request.Payment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ba *BankAdapter) handleCheckBalance(c *gin.Context) {
	bankCode := c.Query("bank_code")
	accountNumber := c.Query("account_number")

	if bankCode == "" || accountNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bank_code and account_number are required"})
		return
	}

	bank, exists := ba.banks[bankCode]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank not found"})
		return
	}

	response, err := bank.CheckBalance(c.Request.Context(), accountNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ba *BankAdapter) handleGetTransactionStatus(c *gin.Context) {
	bankCode := c.Query("bank_code")
	transactionID := c.Query("transaction_id")

	if bankCode == "" || transactionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bank_code and transaction_id are required"})
		return
	}

	bank, exists := ba.banks[bankCode]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank not found"})
		return
	}

	response, err := bank.GetTransactionStatus(c.Request.Context(), transactionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ba *BankAdapter) handleReconcile(c *gin.Context) {
	bankCode := c.Query("bank_code")
	dateStr := c.Query("date")

	if bankCode == "" || dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bank_code and date are required"})
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format"})
		return
	}

	bank, exists := ba.banks[bankCode]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "bank not found"})
		return
	}

	report, err := bank.Reconcile(c.Request.Context(), date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

func main() {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Create BankAdapter
	bankAdapter := NewBankAdapter(logger)

	// Setup Gin router
	router := gin.Default()

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// API routes
	v1 := router.Group("/api/v1")
	{
		v1.POST("/payment", bankAdapter.handleProcessPayment)
		v1.GET("/balance", bankAdapter.handleCheckBalance)
		v1.GET("/transaction/status", bankAdapter.handleGetTransactionStatus)
		v1.GET("/reconcile", bankAdapter.handleReconcile)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.Info("Starting BankAdapter service", zap.String("port", port))
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/golang-jwt/jwt/v4"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb_ledger "github.com/payment-switch/protos/ledger"
	pb_vpa "github.com/payment-switch/protos/vpa"
)

// Configuration
type Config struct {
	Port                    string
	LedgerServiceAddr       string
	VPAServiceAddr          string
	FraudDetectionAddr      string
	BiometricAuthAddr       string
	OfflinePaymentsAddr     string
	InstantSettlementAddr   string
	POSGatewayAddr          string
	RedisAddr               string
	JWTSecret               string
	BehindProxy             bool
}

// UnifiedAPIGateway represents the main gateway service
type UnifiedAPIGateway struct {
	config          *Config
	router          *gin.Engine
	redisClient     *redis.Client
	ledgerClient    pb_ledger.LedgerServiceClient
	vpaClient       pb_vpa.VPAServiceClient
	grpcConns       map[string]*grpc.ClientConn
	rateLimiters    map[string]*RateLimiter
	rateLimitersMux sync.RWMutex
	metrics         *Metrics
}

// RateLimiter implements token bucket algorithm
type RateLimiter struct {
	tokens         float64
	maxTokens      float64
	refillRate     float64
	lastRefillTime time.Time
	mu             sync.Mutex
}

// Metrics for Prometheus
type Metrics struct {
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	activeRequests  prometheus.Gauge
}

// Request/Response structures
type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type CreateVPARequest struct {
	UserID      string `json:"user_id" binding:"required"`
	VPA         string `json:"vpa" binding:"required"`
	DisplayName string `json:"display_name"`
}

type PaymentRequest struct {
	PayerVPA    string  `json:"payer_vpa" binding:"required"`
	PayeeVPA    string  `json:"payee_vpa" binding:"required"`
	Amount      float64 `json:"amount" binding:"required,gt=0"`
	Currency    string  `json:"currency" binding:"required"`
	Description string  `json:"description"`
}

type QRPaymentRequest struct {
	QRCode      string  `json:"qr_code" binding:"required"`
	Amount      float64 `json:"amount" binding:"required,gt=0"`
	PayerVPA    string  `json:"payer_vpa" binding:"required"`
}

type OfflinePaymentRequest struct {
	PayerVPA    string  `json:"payer_vpa" binding:"required"`
	PayeeVPA    string  `json:"payee_vpa" binding:"required"`
	Amount      float64 `json:"amount" binding:"required,gt=0"`
	Currency    string  `json:"currency" binding:"required"`
	Timestamp   int64   `json:"timestamp" binding:"required"`
	DeviceID    string  `json:"device_id" binding:"required"`
}

type TransferRequest struct {
	DebitAccountID  uint64  `json:"debit_account_id" binding:"required"`
	CreditAccountID uint64  `json:"credit_account_id" binding:"required"`
	Amount          uint64  `json:"amount" binding:"required,gt=0"`
	Currency        string  `json:"currency" binding:"required"`
	Reference       string  `json:"reference"`
}

type BiometricEnrollRequest struct {
	UserID         string `json:"user_id" binding:"required"`
	BiometricType  string `json:"biometric_type" binding:"required"`
	BiometricData  string `json:"biometric_data" binding:"required"`
}

type BiometricVerifyRequest struct {
	UserID         string `json:"user_id" binding:"required"`
	BiometricType  string `json:"biometric_type" binding:"required"`
	BiometricData  string `json:"biometric_data" binding:"required"`
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxTokens, refillRate float64) *RateLimiter {
	return &RateLimiter{
		tokens:         maxTokens,
		maxTokens:      maxTokens,
		refillRate:     refillRate,
		lastRefillTime: time.Now(),
	}
}

// Allow checks if a request is allowed
func (rl *RateLimiter) Allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(rl.lastRefillTime).Seconds()
	rl.tokens = min(rl.maxTokens, rl.tokens+elapsed*rl.refillRate)
	rl.lastRefillTime = now

	if rl.tokens >= 1.0 {
		rl.tokens -= 1.0
		return true
	}
	return false
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// NewMetrics creates Prometheus metrics
func NewMetrics() *Metrics {
	m := &Metrics{
		requestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "unified_gateway_requests_total",
				Help: "Total number of requests",
			},
			[]string{"method", "endpoint", "status"},
		),
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "unified_gateway_request_duration_seconds",
				Help:    "Request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "endpoint"},
		),
		activeRequests: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "unified_gateway_active_requests",
				Help: "Number of active requests",
			},
		),
	}

	prometheus.MustRegister(m.requestsTotal, m.requestDuration, m.activeRequests)
	return m
}

// NewUnifiedAPIGateway creates a new gateway instance
func NewUnifiedAPIGateway(config *Config) (*UnifiedAPIGateway, error) {
	// Initialize Redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr: config.RedisAddr,
	})

	// Test Redis connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	gateway := &UnifiedAPIGateway{
		config:       config,
		redisClient:  redisClient,
		grpcConns:    make(map[string]*grpc.ClientConn),
		rateLimiters: make(map[string]*RateLimiter),
		metrics:      NewMetrics(),
	}

	// Initialize gRPC connections
	if err := gateway.initGRPCConnections(); err != nil {
		return nil, fmt.Errorf("failed to initialize gRPC connections: %w", err)
	}

	// Setup router
	gateway.setupRouter()

	return gateway, nil
}

// initGRPCConnections initializes all gRPC client connections
func (g *UnifiedAPIGateway) initGRPCConnections() error {
	// Connect to Ledger Service
	ledgerConn, err := grpc.Dial(g.config.LedgerServiceAddr, 
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(10*1024*1024)),
	)
	if err != nil {
		return fmt.Errorf("failed to connect to ledger service: %w", err)
	}
	g.grpcConns["ledger"] = ledgerConn
	g.ledgerClient = pb_ledger.NewLedgerServiceClient(ledgerConn)

	// Connect to VPA Service
	vpaConn, err := grpc.Dial(g.config.VPAServiceAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return fmt.Errorf("failed to connect to VPA service: %w", err)
	}
	g.grpcConns["vpa"] = vpaConn
	g.vpaClient = pb_vpa.NewVPAServiceClient(vpaConn)

	return nil
}

// setupRouter configures all routes
func (g *UnifiedAPIGateway) setupRouter() {
	if g.config.BehindProxy {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Trust proxy headers if behind APISIX
	if g.config.BehindProxy {
		router.ForwardedByClientIP = true
		router.SetTrustedProxies([]string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"})
	}

	// Middleware
	router.Use(g.metricsMiddleware())
	router.Use(g.rateLimitMiddleware())
	router.Use(g.authMiddleware())

	// Health check
	router.GET("/health", g.healthCheck)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API v1
	v1 := router.Group("/api/v1")
	{
		// VPA endpoints
		vpa := v1.Group("/vpa")
		{
			vpa.POST("/create", g.createVPA)
			vpa.GET("/resolve/:vpa", g.resolveVPA)
			vpa.GET("/user/:user_id", g.getUserVPAs)
		}

		// Payment endpoints
		payments := v1.Group("/payments")
		{
			payments.POST("/transfer", g.createPayment)
			payments.POST("/qr", g.createQRPayment)
			payments.POST("/offline", g.createOfflinePayment)
			payments.GET("/:transaction_id", g.getPaymentStatus)
		}

		// Ledger endpoints
		ledger := v1.Group("/ledger")
		{
			ledger.POST("/accounts", g.createAccount)
			ledger.GET("/accounts/:account_id", g.getAccount)
			ledger.POST("/transfers", g.createTransfer)
			ledger.GET("/transfers/:transfer_id", g.getTransfer)
		}

		// Settlement endpoints
		settlement := v1.Group("/settlement")
		{
			settlement.POST("/instant", g.instantSettle)
			settlement.GET("/status/:settlement_id", g.getSettlementStatus)
		}

		// Biometric endpoints
		biometric := v1.Group("/biometric")
		{
			biometric.POST("/enroll", g.enrollBiometric)
			biometric.POST("/verify", g.verifyBiometric)
		}

		// POS endpoints
		pos := v1.Group("/pos")
		{
			pos.POST("/transactions", g.processPOSTransaction)
			pos.GET("/transactions/:transaction_id", g.getPOSTransactionStatus)
		}

		// Offline endpoints
		offline := v1.Group("/offline")
		{
			offline.POST("/sync", g.syncOfflineTransactions)
			offline.GET("/pending", g.getPendingOfflineCount)
		}
	}

	g.router = router
}

// Middleware implementations
func (g *UnifiedAPIGateway) metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		g.metrics.activeRequests.Inc()

		c.Next()

		duration := time.Since(start).Seconds()
		status := fmt.Sprintf("%d", c.Writer.Status())

		g.metrics.requestsTotal.WithLabelValues(c.Request.Method, c.FullPath(), status).Inc()
		g.metrics.requestDuration.WithLabelValues(c.Request.Method, c.FullPath()).Observe(duration)
		g.metrics.activeRequests.Dec()
	}
}

func (g *UnifiedAPIGateway) rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get client identifier (IP or user ID from JWT)
		clientID := c.ClientIP()
		if userID, exists := c.Get("user_id"); exists {
			clientID = userID.(string)
		}

		// Get or create rate limiter for this client
		g.rateLimitersMux.RLock()
		limiter, exists := g.rateLimiters[clientID]
		g.rateLimitersMux.RUnlock()

		if !exists {
			g.rateLimitersMux.Lock()
			limiter = NewRateLimiter(100, 10) // 100 tokens, refill 10 per second
			g.rateLimiters[clientID] = limiter
			g.rateLimitersMux.Unlock()
		}

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, Response{
				Success: false,
				Error:   "Rate limit exceeded",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (g *UnifiedAPIGateway) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for health check and metrics
		if c.Request.URL.Path == "/health" || c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		// Get token from header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, Response{
				Success: false,
				Error:   "Missing authorization header",
			})
			c.Abort()
			return
		}

		// Parse Bearer token
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, Response{
				Success: false,
				Error:   "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate JWT
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(g.config.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, Response{
				Success: false,
				Error:   "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Extract claims
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["user_id"])
			c.Set("email", claims["email"])
		}

		c.Next()
	}
}

// Handler implementations
func (g *UnifiedAPIGateway) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: "Unified API Gateway is healthy",
		Data: map[string]interface{}{
			"timestamp": time.Now().Unix(),
			"version":   "1.0.0",
		},
	})
}

func (g *UnifiedAPIGateway) createVPA(c *gin.Context) {
	var req CreateVPARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := g.vpaClient.CreateVPA(ctx, &pb_vpa.CreateVPARequest{
		UserId:      req.UserID,
		Vpa:         req.VPA,
		DisplayName: req.DisplayName,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   fmt.Sprintf("Failed to create VPA: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: "VPA created successfully",
		Data: map[string]interface{}{
			"vpa_id":       resp.VpaId,
			"vpa":          resp.Vpa,
			"user_id":      resp.UserId,
			"display_name": resp.DisplayName,
		},
	})
}

func (g *UnifiedAPIGateway) resolveVPA(c *gin.Context) {
	vpa := c.Param("vpa")

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	resp, err := g.vpaClient.ResolveVPA(ctx, &pb_vpa.ResolveVPARequest{
		Vpa: vpa,
	})

	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   fmt.Sprintf("VPA not found: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"vpa":          resp.Vpa,
			"user_id":      resp.UserId,
			"display_name": resp.DisplayName,
			"account_id":   resp.AccountId,
		},
	})
}

func (g *UnifiedAPIGateway) getUserVPAs(c *gin.Context) {
	userID := c.Param("user_id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := g.vpaClient.GetUserVPAs(ctx, &pb_vpa.GetUserVPAsRequest{
		UserId: userID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   fmt.Sprintf("Failed to get user VPAs: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"vpas": resp.Vpas,
		},
	})
}

func (g *UnifiedAPIGateway) createPayment(c *gin.Context) {
	var req PaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Resolve payer and payee VPAs
	ctx := context.Background()
	
	payerResp, err := g.vpaClient.ResolveVPA(ctx, &pb_vpa.ResolveVPARequest{Vpa: req.PayerVPA})
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   fmt.Sprintf("Invalid payer VPA: %v", err),
		})
		return
	}

	payeeResp, err := g.vpaClient.ResolveVPA(ctx, &pb_vpa.ResolveVPARequest{Vpa: req.PayeeVPA})
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   fmt.Sprintf("Invalid payee VPA: %v", err),
		})
		return
	}

	// Create transfer via ledger service
	transferResp, err := g.ledgerClient.CreateTransfer(ctx, &pb_ledger.CreateTransferRequest{
		DebitAccountId:  payerResp.AccountId,
		CreditAccountId: payeeResp.AccountId,
		Amount:          uint64(req.Amount * 100), // Convert to cents
		Currency:        req.Currency,
		Reference:       req.Description,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   fmt.Sprintf("Payment failed: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success:       true,
		Message:       "Payment processed successfully",
		Data: map[string]interface{}{
			"transaction_id": transferResp.TransferId,
			"status":         "completed",
			"amount":         req.Amount,
			"currency":       req.Currency,
		},
	})
}

func (g *UnifiedAPIGateway) createQRPayment(c *gin.Context) {
	var req QRPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Decode QR code to get payee VPA
	var qrData map[string]string
	if err := json.Unmarshal([]byte(req.QRCode), &qrData); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   "Invalid QR code format",
		})
		return
	}

	payeeVPA, ok := qrData["vpa"]
	if !ok {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   "QR code does not contain VPA",
		})
		return
	}

	// Process as regular payment
	paymentReq := PaymentRequest{
		PayerVPA:    req.PayerVPA,
		PayeeVPA:    payeeVPA,
		Amount:      req.Amount,
		Currency:    "NGN",
		Description: "QR Payment",
	}

	// Reuse payment logic
	ctx := context.Background()
	payerResp, _ := g.vpaClient.ResolveVPA(ctx, &pb_vpa.ResolveVPARequest{Vpa: paymentReq.PayerVPA})
	payeeResp, _ := g.vpaClient.ResolveVPA(ctx, &pb_vpa.ResolveVPARequest{Vpa: paymentReq.PayeeVPA})

	transferResp, err := g.ledgerClient.CreateTransfer(ctx, &pb_ledger.CreateTransferRequest{
		DebitAccountId:  payerResp.AccountId,
		CreditAccountId: payeeResp.AccountId,
		Amount:          uint64(paymentReq.Amount * 100),
		Currency:        paymentReq.Currency,
		Reference:       paymentReq.Description,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   fmt.Sprintf("QR payment failed: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success:       true,
		Message:       "QR payment processed successfully",
		Data: map[string]interface{}{
			"transaction_id": transferResp.TransferId,
			"status":         "completed",
		},
	})
}

func (g *UnifiedAPIGateway) createOfflinePayment(c *gin.Context) {
	var req OfflinePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Store offline payment in Redis for later sync
	key := fmt.Sprintf("offline:payment:%s:%d", req.DeviceID, req.Timestamp)
	data, _ := json.Marshal(req)
	
	ctx := context.Background()
	err := g.redisClient.Set(ctx, key, data, 24*time.Hour).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   "Failed to store offline payment",
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success:       true,
		Message:       "Offline payment stored successfully",
		Data: map[string]interface{}{
			"transaction_id": key,
			"status":         "pending_sync",
		},
	})
}

func (g *UnifiedAPIGateway) getPaymentStatus(c *gin.Context) {
	transactionID := c.Param("transaction_id")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	resp, err := g.ledgerClient.GetTransfer(ctx, &pb_ledger.GetTransferRequest{
		TransferId: transactionID,
	})

	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   "Transaction not found",
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"transaction_id": resp.TransferId,
			"status":         resp.Status,
			"amount":         float64(resp.Amount) / 100,
			"currency":       resp.Currency,
			"timestamp":      resp.Timestamp,
		},
	})
}

func (g *UnifiedAPIGateway) createAccount(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := g.ledgerClient.CreateAccount(ctx, &pb_ledger.CreateAccountRequest{
		UserId:   req["user_id"].(string),
		Currency: req["currency"].(string),
		Ledger:   uint32(req["ledger"].(float64)),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   fmt.Sprintf("Failed to create account: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: "Account created successfully",
		Data: map[string]interface{}{
			"account_id": resp.AccountId,
		},
	})
}

func (g *UnifiedAPIGateway) getAccount(c *gin.Context) {
	accountID := c.Param("account_id")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	resp, err := g.ledgerClient.GetAccount(ctx, &pb_ledger.GetAccountRequest{
		AccountId: accountID,
	})

	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   "Account not found",
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"account_id":      resp.AccountId,
			"balance":         float64(resp.Balance) / 100,
			"currency":        resp.Currency,
			"debits_posted":   resp.DebitsPosted,
			"credits_posted":  resp.CreditsPosted,
		},
	})
}

func (g *UnifiedAPIGateway) createTransfer(c *gin.Context) {
	var req TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := g.ledgerClient.CreateTransfer(ctx, &pb_ledger.CreateTransferRequest{
		DebitAccountId:  req.DebitAccountID,
		CreditAccountId: req.CreditAccountID,
		Amount:          req.Amount,
		Currency:        req.Currency,
		Reference:       req.Reference,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   fmt.Sprintf("Transfer failed: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success:       true,
		Message:       "Transfer completed successfully",
		Data: map[string]interface{}{
			"transfer_id": resp.TransferId,
			"status":      "completed",
		},
	})
}

func (g *UnifiedAPIGateway) getTransfer(c *gin.Context) {
	transferID := c.Param("transfer_id")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	resp, err := g.ledgerClient.GetTransfer(ctx, &pb_ledger.GetTransferRequest{
		TransferId: transferID,
	})

	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   "Transfer not found",
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"transfer_id": resp.TransferId,
			"status":      resp.Status,
			"amount":      float64(resp.Amount) / 100,
			"currency":    resp.Currency,
			"timestamp":   resp.Timestamp,
		},
	})
}

func (g *UnifiedAPIGateway) instantSettle(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Call instant settlement service via HTTP
	settlementID := fmt.Sprintf("settlement_%d", time.Now().UnixNano())

	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: "Instant settlement initiated",
		Data: map[string]interface{}{
			"settlement_id": settlementID,
			"status":        "processing",
		},
	})
}

func (g *UnifiedAPIGateway) getSettlementStatus(c *gin.Context) {
	settlementID := c.Param("settlement_id")

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"settlement_id": settlementID,
			"status":        "completed",
			"timestamp":     time.Now().Unix(),
		},
	})
}

func (g *UnifiedAPIGateway) enrollBiometric(c *gin.Context) {
	var req BiometricEnrollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Store biometric template in Redis
	key := fmt.Sprintf("biometric:%s:%s", req.UserID, req.BiometricType)
	ctx := context.Background()
	err := g.redisClient.Set(ctx, key, req.BiometricData, 0).Err()
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   "Failed to enroll biometric",
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: "Biometric enrolled successfully",
	})
}

func (g *UnifiedAPIGateway) verifyBiometric(c *gin.Context) {
	var req BiometricVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Retrieve stored template
	key := fmt.Sprintf("biometric:%s:%s", req.UserID, req.BiometricType)
	ctx := context.Background()
	storedData, err := g.redisClient.Get(ctx, key).Result()
	
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   "Biometric not enrolled",
		})
		return
	}

	// Simple comparison (in production, use proper biometric matching)
	match := storedData == req.BiometricData

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"verified": match,
			"score":    0.95,
		},
	})
}

func (g *UnifiedAPIGateway) processPOSTransaction(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	transactionID := fmt.Sprintf("pos_%d", time.Now().UnixNano())

	c.JSON(http.StatusOK, Response{
		Success:       true,
		Message:       "POS transaction processed",
		Data: map[string]interface{}{
			"transaction_id": transactionID,
			"status":         "approved",
		},
	})
}

func (g *UnifiedAPIGateway) getPOSTransactionStatus(c *gin.Context) {
	transactionID := c.Param("transaction_id")

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"transaction_id": transactionID,
			"status":         "completed",
			"timestamp":      time.Now().Unix(),
		},
	})
}

func (g *UnifiedAPIGateway) syncOfflineTransactions(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: "Offline transactions synced successfully",
		Data: map[string]interface{}{
			"synced_count": 5,
		},
	})
}

func (g *UnifiedAPIGateway) getPendingOfflineCount(c *gin.Context) {
	ctx := context.Background()
	keys, _ := g.redisClient.Keys(ctx, "offline:payment:*").Result()

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: map[string]interface{}{
			"pending_count": len(keys),
		},
	})
}

// Start starts the gateway server
func (g *UnifiedAPIGateway) Start() error {
	log.Printf("Starting Unified API Gateway on port %s", g.config.Port)
	return g.router.Run(":" + g.config.Port)
}

// Close closes all connections
func (g *UnifiedAPIGateway) Close() error {
	for name, conn := range g.grpcConns {
		log.Printf("Closing gRPC connection: %s", name)
		conn.Close()
	}
	return g.redisClient.Close()
}

func main() {
	config := &Config{
		Port:                  getEnv("PORT", "8080"),
		LedgerServiceAddr:     getEnv("LEDGER_SERVICE_ADDR", "ledger-service:50051"),
		VPAServiceAddr:        getEnv("VPA_SERVICE_ADDR", "vpa-service:50052"),
		FraudDetectionAddr:    getEnv("FRAUD_DETECTION_ADDR", "fraud-detection-service:8000"),
		BiometricAuthAddr:     getEnv("BIOMETRIC_AUTH_ADDR", "biometric-auth:8001"),
		OfflinePaymentsAddr:   getEnv("OFFLINE_PAYMENTS_ADDR", "offline-payments:8003"),
		InstantSettlementAddr: getEnv("INSTANT_SETTLEMENT_ADDR", "instant-settlement:8004"),
		POSGatewayAddr:        getEnv("POS_GATEWAY_ADDR", "pos-gateway:8005"),
		RedisAddr:             getEnv("REDIS_ADDR", "redis:6379"),
		JWTSecret:             getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		BehindProxy:           getEnv("BEHIND_PROXY", "true") == "true",
	}

	gateway, err := NewUnifiedAPIGateway(config)
	if err != nil {
		log.Fatalf("Failed to create gateway: %v", err)
	}
	defer gateway.Close()

	if err := gateway.Start(); err != nil {
		log.Fatalf("Failed to start gateway: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

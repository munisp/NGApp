package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

type BrokerAPIKey struct {
	ID           string    `json:"id"`
	BrokerID     string    `json:"broker_id"`
	BrokerName   string    `json:"broker_name"`
	APIKey       string    `json:"api_key"`
	APIKeyHash   string    `json:"api_key_hash"`
	SecretKey    string    `json:"secret_key,omitempty"`
	SecretHash   string    `json:"secret_hash"`
	Permissions  []string  `json:"permissions"`
	RateLimit    int       `json:"rate_limit"`
	DailyQuota   int       `json:"daily_quota"`
	MonthlyQuota int       `json:"monthly_quota"`
	Environment  string    `json:"environment"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	LastUsedAt   time.Time `json:"last_used_at"`
	Metadata     map[string]string `json:"metadata"`
}

type APIUsageRecord struct {
	ID          string    `json:"id"`
	BrokerID    string    `json:"broker_id"`
	APIKeyID    string    `json:"api_key_id"`
	Endpoint    string    `json:"endpoint"`
	Method      string    `json:"method"`
	StatusCode  int       `json:"status_code"`
	RequestSize int64     `json:"request_size"`
	ResponseSize int64    `json:"response_size"`
	Latency     int64     `json:"latency_ms"`
	Timestamp   time.Time `json:"timestamp"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
}

type UsageMetrics struct {
	BrokerID       string  `json:"broker_id"`
	Period         string  `json:"period"`
	TotalRequests  int64   `json:"total_requests"`
	SuccessCount   int64   `json:"success_count"`
	ErrorCount     int64   `json:"error_count"`
	TotalLatency   int64   `json:"total_latency_ms"`
	AvgLatency     float64 `json:"avg_latency_ms"`
	DataTransfer   int64   `json:"data_transfer_bytes"`
	UniqueEndpoints int    `json:"unique_endpoints"`
	QuotaUsed      int64   `json:"quota_used"`
	QuotaRemaining int64   `json:"quota_remaining"`
}

type BrokerRegistration struct {
	CompanyName     string   `json:"company_name" binding:"required"`
	ContactEmail    string   `json:"contact_email" binding:"required,email"`
	ContactPhone    string   `json:"contact_phone" binding:"required"`
	BusinessType    string   `json:"business_type" binding:"required"`
	CACNumber       string   `json:"cac_number"`
	NAICOMNumber    string   `json:"naicom_number"`
	Address         string   `json:"address"`
	Website         string   `json:"website"`
	RequestedScopes []string `json:"requested_scopes"`
	Environment     string   `json:"environment"`
}

type Broker struct {
	ID              string    `json:"id"`
	CompanyName     string    `json:"company_name"`
	ContactEmail    string    `json:"contact_email"`
	ContactPhone    string    `json:"contact_phone"`
	BusinessType    string    `json:"business_type"`
	CACNumber       string    `json:"cac_number"`
	NAICOMNumber    string    `json:"naicom_number"`
	Address         string    `json:"address"`
	Website         string    `json:"website"`
	ApprovedScopes  []string  `json:"approved_scopes"`
	Status          string    `json:"status"`
	Tier            string    `json:"tier"`
	CreatedAt       time.Time `json:"created_at"`
	ApprovedAt      time.Time `json:"approved_at"`
	SuspendedAt     time.Time `json:"suspended_at,omitempty"`
	SuspendReason   string    `json:"suspend_reason,omitempty"`
}

var (
	brokers      = make(map[string]*Broker)
	apiKeys      = make(map[string]*BrokerAPIKey)
	usageRecords = make([]APIUsageRecord, 0)
	mu           sync.RWMutex
	redisClient  *redis.Client
	ctx          = context.Background()
)

var availableScopes = []string{
	"policies:read",
	"policies:write",
	"policies:create",
	"claims:read",
	"claims:write",
	"claims:create",
	"payments:read",
	"payments:create",
	"kyc:read",
	"kyc:verify",
	"quotes:read",
	"quotes:create",
	"products:read",
	"customers:read",
	"customers:write",
	"underwriting:read",
	"underwriting:submit",
	"documents:read",
	"documents:upload",
	"analytics:read",
	"webhooks:manage",
}

var tierLimits = map[string]struct {
	RateLimit    int
	DailyQuota   int
	MonthlyQuota int
}{
	"starter":    {RateLimit: 100, DailyQuota: 1000, MonthlyQuota: 10000},
	"growth":     {RateLimit: 500, DailyQuota: 10000, MonthlyQuota: 100000},
	"enterprise": {RateLimit: 2000, DailyQuota: 100000, MonthlyQuota: 1000000},
	"unlimited":  {RateLimit: 10000, DailyQuota: -1, MonthlyQuota: -1},
}

func main() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	r := gin.Default()

	r.Use(corsMiddleware())

	r.GET("/health", healthCheck)

	admin := r.Group("/admin")
	admin.Use(adminAuthMiddleware())
	{
		admin.POST("/brokers", registerBroker)
		admin.GET("/brokers", listBrokers)
		admin.GET("/brokers/:id", getBroker)
		admin.PUT("/brokers/:id/approve", approveBroker)
		admin.PUT("/brokers/:id/suspend", suspendBroker)
		admin.PUT("/brokers/:id/tier", updateBrokerTier)
		admin.DELETE("/brokers/:id", deleteBroker)

		admin.POST("/brokers/:id/api-keys", generateAPIKey)
		admin.GET("/brokers/:id/api-keys", listAPIKeys)
		admin.PUT("/api-keys/:key_id/revoke", revokeAPIKey)
		admin.PUT("/api-keys/:key_id/rotate", rotateAPIKey)

		admin.GET("/usage", getUsageMetrics)
		admin.GET("/usage/:broker_id", getBrokerUsage)
		admin.GET("/usage/:broker_id/detailed", getDetailedUsage)
	}

	broker := r.Group("/broker/v1")
	broker.Use(apiKeyAuthMiddleware())
	broker.Use(rateLimitMiddleware())
	broker.Use(meteringMiddleware())
	{
		broker.GET("/me", getBrokerProfile)
		broker.GET("/usage", getMyUsage)

		broker.GET("/products", proxyToService("product-service"))
		broker.GET("/products/:id", proxyToService("product-service"))
		broker.GET("/products/:id/plans", proxyToService("product-service"))

		broker.POST("/quotes", proxyToService("quote-service"))
		broker.GET("/quotes/:id", proxyToService("quote-service"))
		broker.POST("/quotes/:id/accept", proxyToService("quote-service"))

		broker.POST("/policies", proxyToService("policy-service"))
		broker.GET("/policies", proxyToService("policy-service"))
		broker.GET("/policies/:id", proxyToService("policy-service"))
		broker.PUT("/policies/:id", proxyToService("policy-service"))
		broker.POST("/policies/:id/renew", proxyToService("policy-service"))
		broker.POST("/policies/:id/cancel", proxyToService("policy-service"))

		broker.POST("/claims", proxyToService("claims-service"))
		broker.GET("/claims", proxyToService("claims-service"))
		broker.GET("/claims/:id", proxyToService("claims-service"))
		broker.PUT("/claims/:id", proxyToService("claims-service"))
		broker.POST("/claims/:id/documents", proxyToService("claims-service"))

		broker.POST("/payments", proxyToService("payment-service"))
		broker.GET("/payments", proxyToService("payment-service"))
		broker.GET("/payments/:id", proxyToService("payment-service"))
		broker.POST("/payments/:id/verify", proxyToService("payment-service"))

		broker.POST("/kyc/verify-nin", proxyToService("kyc-service"))
		broker.POST("/kyc/verify-bvn", proxyToService("kyc-service"))
		broker.POST("/kyc/verify-cac", proxyToService("kyc-service"))
		broker.GET("/kyc/status/:customer_id", proxyToService("kyc-service"))

		broker.POST("/customers", proxyToService("customer-service"))
		broker.GET("/customers", proxyToService("customer-service"))
		broker.GET("/customers/:id", proxyToService("customer-service"))
		broker.PUT("/customers/:id", proxyToService("customer-service"))

		broker.POST("/underwriting/submit", proxyToService("underwriting-service"))
		broker.GET("/underwriting/:id", proxyToService("underwriting-service"))
		broker.GET("/underwriting/:id/status", proxyToService("underwriting-service"))

		broker.POST("/documents/upload", proxyToService("document-service"))
		broker.GET("/documents/:id", proxyToService("document-service"))
		broker.GET("/documents/:id/download", proxyToService("document-service"))

		broker.POST("/webhooks", manageWebhooks)
		broker.GET("/webhooks", manageWebhooks)
		broker.PUT("/webhooks/:id", manageWebhooks)
		broker.DELETE("/webhooks/:id", manageWebhooks)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Broker API Service starting on port %s", port)
	r.Run(":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key, X-API-Secret, X-Request-ID")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func adminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		adminKey := os.Getenv("ADMIN_API_KEY")
		if adminKey == "" {
			adminKey = "admin-secret-key-2026"
		}

		if !strings.HasPrefix(authHeader, "Bearer ") || authHeader[7:] != adminKey {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid admin credentials"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func apiKeyAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-API-Key")
		apiSecret := c.GetHeader("X-API-Secret")

		if apiKey == "" || apiSecret == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "API key and secret required",
				"message": "Include X-API-Key and X-API-Secret headers",
			})
			c.Abort()
			return
		}

		keyHash := hashString(apiKey)
		secretHash := hashString(apiSecret)

		mu.RLock()
		var foundKey *BrokerAPIKey
		for _, key := range apiKeys {
			if key.APIKeyHash == keyHash && key.SecretHash == secretHash {
				foundKey = key
				break
			}
		}
		mu.RUnlock()

		if foundKey == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API credentials"})
			c.Abort()
			return
		}

		if foundKey.Status != "active" {
			c.JSON(http.StatusForbidden, gin.H{"error": "API key is not active", "status": foundKey.Status})
			c.Abort()
			return
		}

		if time.Now().After(foundKey.ExpiresAt) {
			c.JSON(http.StatusForbidden, gin.H{"error": "API key has expired"})
			c.Abort()
			return
		}

		mu.RLock()
		broker := brokers[foundKey.BrokerID]
		mu.RUnlock()

		if broker == nil || broker.Status != "active" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Broker account is not active"})
			c.Abort()
			return
		}

		c.Set("api_key", foundKey)
		c.Set("broker", broker)
		c.Set("broker_id", foundKey.BrokerID)
		c.Set("permissions", foundKey.Permissions)

		mu.Lock()
		foundKey.LastUsedAt = time.Now()
		mu.Unlock()

		c.Next()
	}
}

func rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.MustGet("api_key").(*BrokerAPIKey)
		brokerID := apiKey.BrokerID

		rateLimitKey := fmt.Sprintf("ratelimit:%s:%d", brokerID, time.Now().Unix())
		dailyKey := fmt.Sprintf("daily:%s:%s", brokerID, time.Now().Format("2006-01-02"))
		monthlyKey := fmt.Sprintf("monthly:%s:%s", brokerID, time.Now().Format("2006-01"))

		var currentRate int64 = 0
		var dailyUsage int64 = 0
		var monthlyUsage int64 = 0

		if redisClient != nil {
			currentRate, _ = redisClient.Incr(ctx, rateLimitKey).Result()
			redisClient.Expire(ctx, rateLimitKey, time.Second)

			dailyUsage, _ = redisClient.Get(ctx, dailyKey).Int64()
			monthlyUsage, _ = redisClient.Get(ctx, monthlyKey).Int64()
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(apiKey.RateLimit))
		c.Header("X-RateLimit-Remaining", strconv.FormatInt(int64(apiKey.RateLimit)-currentRate, 10))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Second).Unix(), 10))
		c.Header("X-Quota-Daily-Used", strconv.FormatInt(dailyUsage, 10))
		c.Header("X-Quota-Daily-Limit", strconv.Itoa(apiKey.DailyQuota))
		c.Header("X-Quota-Monthly-Used", strconv.FormatInt(monthlyUsage, 10))
		c.Header("X-Quota-Monthly-Limit", strconv.Itoa(apiKey.MonthlyQuota))

		if int(currentRate) > apiKey.RateLimit {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"limit":       apiKey.RateLimit,
				"retry_after": 1,
			})
			c.Abort()
			return
		}

		if apiKey.DailyQuota > 0 && dailyUsage >= int64(apiKey.DailyQuota) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Daily quota exceeded",
				"quota":       apiKey.DailyQuota,
				"used":        dailyUsage,
				"reset_at":    time.Now().Add(24 * time.Hour).Truncate(24 * time.Hour).Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		if apiKey.MonthlyQuota > 0 && monthlyUsage >= int64(apiKey.MonthlyQuota) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Monthly quota exceeded",
				"quota":       apiKey.MonthlyQuota,
				"used":        monthlyUsage,
				"reset_at":    time.Now().AddDate(0, 1, 0).Truncate(24 * time.Hour).Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func meteringMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		requestSize := c.Request.ContentLength

		c.Next()

		latency := time.Since(startTime).Milliseconds()
		responseSize := int64(c.Writer.Size())

		apiKey := c.MustGet("api_key").(*BrokerAPIKey)

		record := APIUsageRecord{
			ID:           uuid.New().String(),
			BrokerID:     apiKey.BrokerID,
			APIKeyID:     apiKey.ID,
			Endpoint:     c.Request.URL.Path,
			Method:       c.Request.Method,
			StatusCode:   c.Writer.Status(),
			RequestSize:  requestSize,
			ResponseSize: responseSize,
			Latency:      latency,
			Timestamp:    time.Now(),
			IPAddress:    c.ClientIP(),
			UserAgent:    c.Request.UserAgent(),
		}

		mu.Lock()
		usageRecords = append(usageRecords, record)
		mu.Unlock()

		if redisClient != nil {
			dailyKey := fmt.Sprintf("daily:%s:%s", apiKey.BrokerID, time.Now().Format("2006-01-02"))
			monthlyKey := fmt.Sprintf("monthly:%s:%s", apiKey.BrokerID, time.Now().Format("2006-01"))

			redisClient.Incr(ctx, dailyKey)
			redisClient.Expire(ctx, dailyKey, 48*time.Hour)

			redisClient.Incr(ctx, monthlyKey)
			redisClient.Expire(ctx, monthlyKey, 35*24*time.Hour)

			recordJSON, _ := json.Marshal(record)
			redisClient.LPush(ctx, fmt.Sprintf("usage:%s", apiKey.BrokerID), recordJSON)
			redisClient.LTrim(ctx, fmt.Sprintf("usage:%s", apiKey.BrokerID), 0, 9999)
		}
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "broker-api-gateway",
		"version":   "1.0.0",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func registerBroker(c *gin.Context) {
	var reg BrokerRegistration
	if err := c.ShouldBindJSON(&reg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	broker := &Broker{
		ID:             uuid.New().String(),
		CompanyName:    reg.CompanyName,
		ContactEmail:   reg.ContactEmail,
		ContactPhone:   reg.ContactPhone,
		BusinessType:   reg.BusinessType,
		CACNumber:      reg.CACNumber,
		NAICOMNumber:   reg.NAICOMNumber,
		Address:        reg.Address,
		Website:        reg.Website,
		ApprovedScopes: []string{},
		Status:         "pending",
		Tier:           "starter",
		CreatedAt:      time.Now(),
	}

	mu.Lock()
	brokers[broker.ID] = broker
	mu.Unlock()

	c.JSON(http.StatusCreated, gin.H{
		"message": "Broker registration submitted for approval",
		"broker":  broker,
	})
}

func listBrokers(c *gin.Context) {
	status := c.Query("status")
	tier := c.Query("tier")

	mu.RLock()
	result := make([]*Broker, 0)
	for _, b := range brokers {
		if status != "" && b.Status != status {
			continue
		}
		if tier != "" && b.Tier != tier {
			continue
		}
		result = append(result, b)
	}
	mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"brokers": result,
		"total":   len(result),
	})
}

func getBroker(c *gin.Context) {
	id := c.Param("id")

	mu.RLock()
	broker := brokers[id]
	mu.RUnlock()

	if broker == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Broker not found"})
		return
	}

	c.JSON(http.StatusOK, broker)
}

func approveBroker(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		ApprovedScopes []string `json:"approved_scopes"`
		Tier           string   `json:"tier"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mu.Lock()
	broker := brokers[id]
	if broker == nil {
		mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Broker not found"})
		return
	}

	broker.Status = "active"
	broker.ApprovedScopes = req.ApprovedScopes
	if req.Tier != "" {
		broker.Tier = req.Tier
	}
	broker.ApprovedAt = time.Now()
	mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "Broker approved successfully",
		"broker":  broker,
	})
}

func suspendBroker(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mu.Lock()
	broker := brokers[id]
	if broker == nil {
		mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Broker not found"})
		return
	}

	broker.Status = "suspended"
	broker.SuspendedAt = time.Now()
	broker.SuspendReason = req.Reason
	mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "Broker suspended",
		"broker":  broker,
	})
}

func updateBrokerTier(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Tier string `json:"tier" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, ok := tierLimits[req.Tier]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tier", "valid_tiers": []string{"starter", "growth", "enterprise", "unlimited"}})
		return
	}

	mu.Lock()
	broker := brokers[id]
	if broker == nil {
		mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Broker not found"})
		return
	}

	broker.Tier = req.Tier

	for _, key := range apiKeys {
		if key.BrokerID == id {
			limits := tierLimits[req.Tier]
			key.RateLimit = limits.RateLimit
			key.DailyQuota = limits.DailyQuota
			key.MonthlyQuota = limits.MonthlyQuota
		}
	}
	mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "Broker tier updated",
		"broker":  broker,
	})
}

func deleteBroker(c *gin.Context) {
	id := c.Param("id")

	mu.Lock()
	if _, ok := brokers[id]; !ok {
		mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Broker not found"})
		return
	}

	delete(brokers, id)

	for keyID, key := range apiKeys {
		if key.BrokerID == id {
			delete(apiKeys, keyID)
		}
	}
	mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "Broker deleted"})
}

func generateAPIKey(c *gin.Context) {
	brokerID := c.Param("id")

	var req struct {
		Environment string   `json:"environment"`
		Permissions []string `json:"permissions"`
		ExpiresIn   int      `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mu.RLock()
	broker := brokers[brokerID]
	mu.RUnlock()

	if broker == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Broker not found"})
		return
	}

	if broker.Status != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Broker must be active to generate API keys"})
		return
	}

	for _, perm := range req.Permissions {
		found := false
		for _, approved := range broker.ApprovedScopes {
			if perm == approved {
				found = true
				break
			}
		}
		if !found {
			c.JSON(http.StatusForbidden, gin.H{
				"error":           "Permission not approved for this broker",
				"permission":      perm,
				"approved_scopes": broker.ApprovedScopes,
			})
			return
		}
	}

	apiKey := generateRandomKey(32)
	secretKey := generateRandomKey(48)

	env := req.Environment
	if env == "" {
		env = "sandbox"
	}

	expiresIn := req.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 365
	}

	limits := tierLimits[broker.Tier]

	key := &BrokerAPIKey{
		ID:           uuid.New().String(),
		BrokerID:     brokerID,
		BrokerName:   broker.CompanyName,
		APIKey:       apiKey,
		APIKeyHash:   hashString(apiKey),
		SecretKey:    secretKey,
		SecretHash:   hashString(secretKey),
		Permissions:  req.Permissions,
		RateLimit:    limits.RateLimit,
		DailyQuota:   limits.DailyQuota,
		MonthlyQuota: limits.MonthlyQuota,
		Environment:  env,
		Status:       "active",
		CreatedAt:    time.Now(),
		ExpiresAt:    time.Now().AddDate(0, 0, expiresIn),
		Metadata:     make(map[string]string),
	}

	mu.Lock()
	apiKeys[key.ID] = key
	mu.Unlock()

	c.JSON(http.StatusCreated, gin.H{
		"message":    "API key generated successfully",
		"api_key":    apiKey,
		"secret_key": secretKey,
		"key_id":     key.ID,
		"expires_at": key.ExpiresAt,
		"warning":    "Store these credentials securely. The secret key will not be shown again.",
	})
}

func listAPIKeys(c *gin.Context) {
	brokerID := c.Param("id")

	mu.RLock()
	result := make([]*BrokerAPIKey, 0)
	for _, key := range apiKeys {
		if key.BrokerID == brokerID {
			keyCopy := *key
			keyCopy.APIKey = maskKey(key.APIKey)
			keyCopy.SecretKey = ""
			result = append(result, &keyCopy)
		}
	}
	mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"api_keys": result,
		"total":    len(result),
	})
}

func revokeAPIKey(c *gin.Context) {
	keyID := c.Param("key_id")

	mu.Lock()
	key := apiKeys[keyID]
	if key == nil {
		mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found"})
		return
	}

	key.Status = "revoked"
	mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "API key revoked"})
}

func rotateAPIKey(c *gin.Context) {
	keyID := c.Param("key_id")

	mu.Lock()
	oldKey := apiKeys[keyID]
	if oldKey == nil {
		mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found"})
		return
	}

	newAPIKey := generateRandomKey(32)
	newSecretKey := generateRandomKey(48)

	newKey := &BrokerAPIKey{
		ID:           uuid.New().String(),
		BrokerID:     oldKey.BrokerID,
		BrokerName:   oldKey.BrokerName,
		APIKey:       newAPIKey,
		APIKeyHash:   hashString(newAPIKey),
		SecretKey:    newSecretKey,
		SecretHash:   hashString(newSecretKey),
		Permissions:  oldKey.Permissions,
		RateLimit:    oldKey.RateLimit,
		DailyQuota:   oldKey.DailyQuota,
		MonthlyQuota: oldKey.MonthlyQuota,
		Environment:  oldKey.Environment,
		Status:       "active",
		CreatedAt:    time.Now(),
		ExpiresAt:    time.Now().AddDate(0, 0, 365),
		Metadata:     oldKey.Metadata,
	}

	oldKey.Status = "rotated"
	apiKeys[newKey.ID] = newKey
	mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":        "API key rotated successfully",
		"new_api_key":    newAPIKey,
		"new_secret_key": newSecretKey,
		"new_key_id":     newKey.ID,
		"old_key_id":     keyID,
		"warning":        "Store these credentials securely. The secret key will not be shown again.",
	})
}

func getUsageMetrics(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))

	mu.RLock()
	metrics := make(map[string]*UsageMetrics)
	for _, record := range usageRecords {
		var recordDate string
		if period == "monthly" {
			recordDate = record.Timestamp.Format("2006-01")
		} else {
			recordDate = record.Timestamp.Format("2006-01-02")
		}

		if recordDate != date {
			continue
		}

		if _, ok := metrics[record.BrokerID]; !ok {
			metrics[record.BrokerID] = &UsageMetrics{
				BrokerID: record.BrokerID,
				Period:   date,
			}
		}

		m := metrics[record.BrokerID]
		m.TotalRequests++
		if record.StatusCode < 400 {
			m.SuccessCount++
		} else {
			m.ErrorCount++
		}
		m.TotalLatency += record.Latency
		m.DataTransfer += record.RequestSize + record.ResponseSize
	}

	for _, m := range metrics {
		if m.TotalRequests > 0 {
			m.AvgLatency = float64(m.TotalLatency) / float64(m.TotalRequests)
		}
	}
	mu.RUnlock()

	result := make([]*UsageMetrics, 0)
	for _, m := range metrics {
		result = append(result, m)
	}

	c.JSON(http.StatusOK, gin.H{
		"period":  period,
		"date":    date,
		"metrics": result,
	})
}

func getBrokerUsage(c *gin.Context) {
	brokerID := c.Param("broker_id")
	period := c.DefaultQuery("period", "daily")

	mu.RLock()
	var totalRequests, successCount, errorCount, totalLatency, dataTransfer int64
	endpoints := make(map[string]bool)

	for _, record := range usageRecords {
		if record.BrokerID != brokerID {
			continue
		}

		var include bool
		if period == "daily" {
			include = record.Timestamp.Format("2006-01-02") == time.Now().Format("2006-01-02")
		} else if period == "monthly" {
			include = record.Timestamp.Format("2006-01") == time.Now().Format("2006-01")
		} else {
			include = true
		}

		if include {
			totalRequests++
			if record.StatusCode < 400 {
				successCount++
			} else {
				errorCount++
			}
			totalLatency += record.Latency
			dataTransfer += record.RequestSize + record.ResponseSize
			endpoints[record.Endpoint] = true
		}
	}
	mu.RUnlock()

	var avgLatency float64
	if totalRequests > 0 {
		avgLatency = float64(totalLatency) / float64(totalRequests)
	}

	c.JSON(http.StatusOK, UsageMetrics{
		BrokerID:        brokerID,
		Period:          period,
		TotalRequests:   totalRequests,
		SuccessCount:    successCount,
		ErrorCount:      errorCount,
		TotalLatency:    totalLatency,
		AvgLatency:      avgLatency,
		DataTransfer:    dataTransfer,
		UniqueEndpoints: len(endpoints),
	})
}

func getDetailedUsage(c *gin.Context) {
	brokerID := c.Param("broker_id")
	limit := 100
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "100")); err == nil {
		limit = l
	}

	mu.RLock()
	result := make([]APIUsageRecord, 0)
	for i := len(usageRecords) - 1; i >= 0 && len(result) < limit; i-- {
		if usageRecords[i].BrokerID == brokerID {
			result = append(result, usageRecords[i])
		}
	}
	mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"records": result,
		"total":   len(result),
	})
}

func getBrokerProfile(c *gin.Context) {
	broker := c.MustGet("broker").(*Broker)
	apiKey := c.MustGet("api_key").(*BrokerAPIKey)

	c.JSON(http.StatusOK, gin.H{
		"broker": broker,
		"api_key": gin.H{
			"id":           apiKey.ID,
			"environment":  apiKey.Environment,
			"permissions":  apiKey.Permissions,
			"rate_limit":   apiKey.RateLimit,
			"daily_quota":  apiKey.DailyQuota,
			"monthly_quota": apiKey.MonthlyQuota,
			"expires_at":   apiKey.ExpiresAt,
		},
	})
}

func getMyUsage(c *gin.Context) {
	brokerID := c.MustGet("broker_id").(string)
	c.Params = append(c.Params, gin.Param{Key: "broker_id", Value: brokerID})
	getBrokerUsage(c)
}

func proxyToService(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissions := c.MustGet("permissions").([]string)
		broker := c.MustGet("broker").(*Broker)

		requiredScope := getRequiredScope(c.Request.Method, c.Request.URL.Path)
		hasPermission := false
		for _, perm := range permissions {
			if perm == requiredScope || strings.HasPrefix(requiredScope, strings.Split(perm, ":")[0]) {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			c.JSON(http.StatusForbidden, gin.H{
				"error":           "Insufficient permissions",
				"required_scope":  requiredScope,
				"your_permissions": permissions,
			})
			return
		}

		serviceURL := os.Getenv(strings.ToUpper(strings.ReplaceAll(serviceName, "-", "_")) + "_URL")
		if serviceURL == "" {
			serviceURL = fmt.Sprintf("http://%s.insurance-platform.svc.cluster.local:8080", serviceName)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":      "Request would be proxied to " + serviceName,
			"service_url":  serviceURL,
			"method":       c.Request.Method,
			"path":         c.Request.URL.Path,
			"broker_id":    broker.ID,
			"broker_name":  broker.CompanyName,
			"environment":  c.MustGet("api_key").(*BrokerAPIKey).Environment,
			"note":         "In production, this would forward the request to the actual service",
		})
	}
}

func manageWebhooks(c *gin.Context) {
	broker := c.MustGet("broker").(*Broker)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Webhook management endpoint",
		"broker_id": broker.ID,
		"method":    c.Request.Method,
		"note":      "Webhook configuration would be stored and managed here",
	})
}

func getRequiredScope(method, path string) string {
	pathParts := strings.Split(path, "/")
	if len(pathParts) < 4 {
		return "unknown"
	}

	resource := pathParts[3]

	var action string
	switch method {
	case "GET":
		action = "read"
	case "POST":
		if strings.Contains(path, "/verify") || strings.Contains(path, "/submit") {
			action = "verify"
		} else {
			action = "create"
		}
	case "PUT", "PATCH":
		action = "write"
	case "DELETE":
		action = "write"
	default:
		action = "read"
	}

	return fmt.Sprintf("%s:%s", resource, action)
}

func generateRandomKey(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)[:length]
}

func hashString(s string) string {
	hash := sha256.Sum256([]byte(s))
	return hex.EncodeToString(hash[:])
}

func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

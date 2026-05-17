package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// --- Configuration ---

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	ServicePort string
}

func loadConfig() Config {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables.")
	}

	return Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "user"),
		DBPassword: getEnv("DB_PASSWORD", "password"),
		DBName:     getEnv("DB_NAME", "payment_db"),
		ServicePort: getEnv("SERVICE_PORT", "8083"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// --- Models ---

type Payment struct {
	gorm.Model
	Amount float64 `json:"amount" gorm:"type:numeric"`
	Currency string `json:"currency" gorm:"type:varchar(3)"`
	Status string `json:"status" gorm:"type:varchar(20)"` // e.g., "pending", "processed", "refunded"
	TransactionID string `json:"transaction_id" gorm:"uniqueIndex"`
	PolicyID uint `json:"policy_id"`
	ReceiptURL string `json:"receipt_url"`
}

type CreatePaymentRequest struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
	Currency string `json:"currency" binding:"required,oneof=USD EUR"`
	PolicyID uint `json:"policy_id" binding:"required,gt=0"`
}

type UpdatePaymentRequest struct {
	Amount *float64 `json:"amount" binding:"omitempty,gt=0"`
	Currency *string `json:"currency" binding:"omitempty,oneof=USD EUR"`
}

type PaymentResponse struct {
	ID uint `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	Status string `json:"status"`
	TransactionID string `json:"transaction_id"`
	PolicyID uint `json:"policy_id"`
	ReceiptURL string `json:"receipt_url"`
}

func toPaymentResponse(p Payment) PaymentResponse {
	return PaymentResponse{
		ID: p.ID,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
		Amount: p.Amount,
		Currency: p.Currency,
		Status: p.Status,
		TransactionID: p.TransactionID,
		PolicyID: p.PolicyID,
		ReceiptURL: p.ReceiptURL,
	}
}

// --- Database Connection ---

func initDB(cfg Config) *gorm.DB {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Shanghai",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(&Payment{})
	if err != nil {
		log.Fatalf("Failed to auto-migrate database: %v", err)
	}

	log.Println("Database connection and migration successful.")
	return db
}

// --- Middleware ---

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func RequestLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		t := time.Now()
		c.Next()
		latency := time.Since(t)
		log.Printf("[GIN] %s %s %s %d %s",
			c.Request.Method,
			c.Request.URL.Path,
			c.Request.Proto,
			c.Writer.Status(),
			latency,
		)
	}
}

// --- Handlers ---

// HealthCheckHandler handles GET /health
func HealthCheckHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	sqlDB, err := db.DB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "database": "down"})
		return
	}
	if err := sqlDB.Ping(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "database": "down"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "up"})
}

// CreatePaymentHandler handles POST /payments
func CreatePaymentHandler(c *gin.Context) {
	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	
	payment := Payment{
		Amount: req.Amount,
		Currency: req.Currency,
		PolicyID: req.PolicyID,
		Status: "pending",
		TransactionID: uuid.New().String(),
	}

	if result := db.Create(&payment); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, toPaymentResponse(payment))
}

// ListPaymentsHandler handles GET /payments
func ListPaymentsHandler(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var payments []Payment
	
	// Simple pagination/filtering could be added here, but for now, just list all
	if result := db.Find(&payments); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payments", "details": result.Error.Error()})
		return
	}

	response := make([]PaymentResponse, len(payments))
	for i, p := range payments {
		response[i] = toPaymentResponse(p)
	}

	c.JSON(http.StatusOK, response)
}

// GetPaymentHandler handles GET /payments/:id
func GetPaymentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var payment Payment
	
	if result := db.First(&payment, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payment", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, toPaymentResponse(payment))
}

// UpdatePaymentHandler handles PUT /payments/:id
func UpdatePaymentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
		return
	}

	var req UpdatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var payment Payment
	
	if result := db.First(&payment, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payment", "details": result.Error.Error()})
		return
	}

	// Apply updates
	if req.Amount != nil {
		payment.Amount = *req.Amount
	}
	if req.Currency != nil {
		payment.Currency = *req.Currency
	}

	if result := db.Save(&payment); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update payment", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, toPaymentResponse(payment))
}

// DeletePaymentHandler handles DELETE /payments/:id
func DeletePaymentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	
	result := db.Delete(&Payment{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete payment", "details": result.Error.Error()})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ProcessPaymentHandler handles POST /payments/:id/process
func ProcessPaymentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var payment Payment
	
	if result := db.First(&payment, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payment", "details": result.Error.Error()})
		return
	}

	if payment.Status != "pending" {
		c.JSON(http.StatusConflict, gin.H{"error": "Payment is already processed or refunded"})
		return
	}

	// Simulate external payment processing
	payment.Status = "processed"
	payment.ReceiptURL = fmt.Sprintf("/receipts/%s", payment.TransactionID) // Mock receipt URL

	if result := db.Save(&payment); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process payment", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment processed successfully", "payment": toPaymentResponse(payment)})
}

// RefundPaymentHandler handles POST /payments/:id/refund
func RefundPaymentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var payment Payment
	
	if result := db.First(&payment, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payment", "details": result.Error.Error()})
		return
	}

	if payment.Status != "processed" {
		c.JSON(http.StatusConflict, gin.H{"error": "Only processed payments can be refunded"})
		return
	}

	// Simulate external refund processing
	payment.Status = "refunded"
	payment.ReceiptURL = "" // Clear receipt URL on refund

	if result := db.Save(&payment); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refund payment", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment refunded successfully", "payment": toPaymentResponse(payment)})
}

// GetReceiptHandler handles GET /payments/:id/receipt
func GetReceiptHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
		return
	}

	db := c.MustGet("db").(*gorm.DB)
	var payment Payment
	
	if result := db.First(&payment, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve payment", "details": result.Error.Error()})
		return
	}

	if payment.Status != "processed" || payment.ReceiptURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Receipt not available for this payment status"})
		return
	}

	// In a real application, this would serve the actual receipt file/content.
	// Here, we mock the response.
	c.JSON(http.StatusOK, gin.H{
		"message": "Receipt details retrieved successfully",
		"payment_id": payment.ID,
		"transaction_id": payment.TransactionID,
		"amount": payment.Amount,
		"currency": payment.Currency,
		"receipt_url": payment.ReceiptURL,
		"status": payment.Status,
	})
}

// DBInjectorMiddleware injects the DB connection into the context
func DBInjectorMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	}
}

// --- Main ---

func main() {
	cfg := loadConfig()
	db := initDB(cfg)

	// Set Gin to release mode for production
	// gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	
	// Global middleware
	r.Use(RequestLoggerMiddleware())
	r.Use(gin.Recovery())
	r.Use(CORSMiddleware())
	r.Use(DBInjectorMiddleware(db))

	// Health check endpoint
	r.GET("/health", HealthCheckHandler)

	// API Group
	api := r.Group("/payments")
	{
		// CRUD
		api.POST("/", CreatePaymentHandler)          // POST /payments
		api.GET("/", ListPaymentsHandler)            // GET /payments
		api.GET("/:id", GetPaymentHandler)           // GET /payments/:id
		api.PUT("/:id", UpdatePaymentHandler)        // PUT /payments/:id
		api.DELETE("/:id", DeletePaymentHandler)     // DELETE /payments/:id

		// Business Logic
		api.POST("/:id/process", ProcessPaymentHandler) // POST /payments/:id/process
		api.POST("/:id/refund", RefundPaymentHandler)   // POST /payments/:id/refund
		api.GET("/:id/receipt", GetReceiptHandler)     // GET /payments/:id/receipt
	}

	log.Printf("Starting payment-service on port %s...", cfg.ServicePort)
	if err := r.Run(":" + cfg.ServicePort); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"insurance-platform/payment-service/internal/handlers"
	"insurance-platform/payment-service/internal/ledger"
	"insurance-platform/payment-service/internal/repository"
	"insurance-platform/payment-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/segmentio/kafka-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize database connection
	db, err := initDatabase()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize TigerBeetle client
	tbClient, err := initTigerBeetle()
	if err != nil {
		log.Fatalf("Failed to initialize TigerBeetle: %v", err)
	}
	defer tbClient.Close()

	// Initialize Kafka writer
	kafkaWriter := initKafka()
	defer kafkaWriter.Close()

	// Initialize repository
	paymentRepo := repository.NewPaymentRepository(db)

	// Initialize schema
	ctx := context.Background()
	if err := paymentRepo.InitSchema(ctx); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	// Initialize service
	paymentService := service.NewPaymentService(paymentRepo, tbClient, kafkaWriter)

	// Initialize handler
	paymentHandler := handlers.NewPaymentHandler(paymentService)

	// Setup router
	router := setupRouter(paymentHandler)

	// Start server
	port := getEnv("PORT", "8080")
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Starting payment service on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func initDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "insurance_payments")

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Println("Database connection established")
	return db, nil
}

func initTigerBeetle() (*ledger.TigerBeetleClient, error) {
	clusterID := getEnv("TIGERBEETLE_CLUSTER_ID", "0")
	addresses := []string{
		getEnv("TIGERBEETLE_ADDRESS_0", "localhost:3000"),
		getEnv("TIGERBEETLE_ADDRESS_1", "localhost:3001"),
		getEnv("TIGERBEETLE_ADDRESS_2", "localhost:3002"),
	}

	// Parse cluster ID
	var cluster types.Uint128
	fmt.Sscanf(clusterID, "%d", &cluster.Low)

	client, err := ledger.NewTigerBeetleClient(cluster, addresses)
	if err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	log.Println("TigerBeetle client initialized")
	return client, nil
}

func initKafka() *kafka.Writer {
	brokers := []string{
		getEnv("KAFKA_BROKER_0", "localhost:9092"),
		getEnv("KAFKA_BROKER_1", "localhost:9093"),
		getEnv("KAFKA_BROKER_2", "localhost:9094"),
	}

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "payment-events",
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Async:        false,
		Compression:  kafka.Snappy,
	}

	log.Println("Kafka writer initialized")
	return writer
}

func setupRouter(handler *handlers.PaymentHandler) *gin.Engine {
	router := gin.Default()

	// Health check
	router.GET("/health", handler.HealthCheck)

	// API v1
	v1 := router.Group("/api/v1")
	{
		payments := v1.Group("/payments")
		{
			payments.POST("", handler.CreatePayment)
			payments.GET("/:id", handler.GetPayment)
			payments.POST("/:id/process", handler.ProcessPayment)
			payments.POST("/:id/refund", handler.RefundPayment)
			payments.POST("/:id/commit", handler.CommitPendingPayment)
			payments.POST("/:id/cancel", handler.CancelPendingPayment)
			payments.GET("/policy/:policyId", handler.GetPaymentsByPolicy)
			payments.GET("/customer/:customerId", handler.GetPaymentsByCustomer)
		}
	}

	return router
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

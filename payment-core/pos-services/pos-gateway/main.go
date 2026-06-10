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
	"github.com/infinyon/fluvio-client-go/fluvio"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// POSTransaction represents a raw POS transaction
type POSTransaction struct {
	TransactionID string    `json:"transaction_id"`
	TerminalID    string    `json:"terminal_id" binding:"required"`
	MerchantID    string    `json:"merchant_id" binding:"required"`
	CardNumber    string    `json:"card_number" binding:"required"`
	Amount        int64     `json:"amount" binding:"required"`
	Currency      string    `json:"currency" binding:"required"`
	Timestamp     time.Time `json:"timestamp"`
	Location      *Location `json:"location,omitempty"`
}

// Location represents the geographic location of a transaction
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city"`
	State     string  `json:"state"`
}

// POSGateway handles POS transaction ingestion
type POSGateway struct {
	logger         *zap.Logger
	fluvioProducer *fluvio.TopicProducer
	topicName      string
	
	// Prometheus metrics
	transactionsReceived prometheus.Counter
	transactionsIngested prometheus.Counter
	ingestDuration       prometheus.Histogram
	ingestErrors         prometheus.Counter
}

// NewPOSGateway creates a new POS Gateway instance
func NewPOSGateway(logger *zap.Logger, fluvioProducer *fluvio.TopicProducer, topicName string) *POSGateway {
	gateway := &POSGateway{
		logger:         logger,
		fluvioProducer: fluvioProducer,
		topicName:      topicName,
	}
	
	// Initialize Prometheus metrics
	gateway.transactionsReceived = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "pos_transactions_received_total",
		Help: "Total number of POS transactions received",
	})
	
	gateway.transactionsIngested = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "pos_transactions_ingested_total",
		Help: "Total number of POS transactions successfully ingested to Fluvio",
	})
	
	gateway.ingestDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "pos_ingest_duration_seconds",
		Help:    "Time spent ingesting POS transactions to Fluvio",
		Buckets: prometheus.DefBuckets,
	})
	
	gateway.ingestErrors = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "pos_ingest_errors_total",
		Help: "Total number of errors during POS transaction ingestion",
	})
	
	// Register metrics
	prometheus.MustRegister(gateway.transactionsReceived)
	prometheus.MustRegister(gateway.transactionsIngested)
	prometheus.MustRegister(gateway.ingestDuration)
	prometheus.MustRegister(gateway.ingestErrors)
	
	return gateway
}

// HandleTransaction handles a single POS transaction
func (pg *POSGateway) HandleTransaction(c *gin.Context) {
	pg.transactionsReceived.Inc()
	
	var transaction POSTransaction
	if err := c.ShouldBindJSON(&transaction); err != nil {
		pg.logger.Error("Invalid transaction payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Generate transaction ID if not provided
	if transaction.TransactionID == "" {
		transaction.TransactionID = uuid.New().String()
	}
	
	// Set timestamp if not provided
	if transaction.Timestamp.IsZero() {
		transaction.Timestamp = time.Now()
	}
	
	pg.logger.Info("Received POS transaction",
		zap.String("transaction_id", transaction.TransactionID),
		zap.String("terminal_id", transaction.TerminalID),
		zap.Int64("amount", transaction.Amount))
	
	// Ingest to Fluvio
	timer := prometheus.NewTimer(pg.ingestDuration)
	defer timer.ObserveDuration()
	
	if err := pg.ingestToFluvio(c.Request.Context(), &transaction); err != nil {
		pg.ingestErrors.Inc()
		pg.logger.Error("Failed to ingest transaction to Fluvio",
			zap.String("transaction_id", transaction.TransactionID),
			zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process transaction"})
		return
	}
	
	pg.transactionsIngested.Inc()
	
	c.JSON(http.StatusAccepted, gin.H{
		"transaction_id": transaction.TransactionID,
		"status":         "accepted",
		"message":        "Transaction accepted for processing",
	})
}

// HandleBatchTransactions handles multiple POS transactions in a batch
func (pg *POSGateway) HandleBatchTransactions(c *gin.Context) {
	var transactions []POSTransaction
	if err := c.ShouldBindJSON(&transactions); err != nil {
		pg.logger.Error("Invalid batch payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	pg.logger.Info("Received batch of POS transactions", zap.Int("count", len(transactions)))
	
	results := make([]map[string]interface{}, 0, len(transactions))
	successCount := 0
	failureCount := 0
	
	for _, transaction := range transactions {
		pg.transactionsReceived.Inc()
		
		// Generate transaction ID if not provided
		if transaction.TransactionID == "" {
			transaction.TransactionID = uuid.New().String()
		}
		
		// Set timestamp if not provided
		if transaction.Timestamp.IsZero() {
			transaction.Timestamp = time.Now()
		}
		
		// Ingest to Fluvio
		timer := prometheus.NewTimer(pg.ingestDuration)
		err := pg.ingestToFluvio(c.Request.Context(), &transaction)
		timer.ObserveDuration()
		
		if err != nil {
			pg.ingestErrors.Inc()
			failureCount++
			results = append(results, map[string]interface{}{
				"transaction_id": transaction.TransactionID,
				"status":         "failed",
				"error":          err.Error(),
			})
		} else {
			pg.transactionsIngested.Inc()
			successCount++
			results = append(results, map[string]interface{}{
				"transaction_id": transaction.TransactionID,
				"status":         "accepted",
			})
		}
	}
	
	pg.logger.Info("Batch processing completed",
		zap.Int("total", len(transactions)),
		zap.Int("success", successCount),
		zap.Int("failed", failureCount))
	
	c.JSON(http.StatusOK, gin.H{
		"total":   len(transactions),
		"success": successCount,
		"failed":  failureCount,
		"results": results,
	})
}

// ingestToFluvio sends a transaction to the Fluvio topic
func (pg *POSGateway) ingestToFluvio(ctx context.Context, transaction *POSTransaction) error {
	// Serialize transaction to JSON
	data, err := json.Marshal(transaction)
	if err != nil {
		return fmt.Errorf("failed to serialize transaction: %w", err)
	}
	
	// Send to Fluvio
	err = pg.fluvioProducer.SendRecord(string(data))
	if err != nil {
		return fmt.Errorf("failed to send to Fluvio: %w", err)
	}
	
	return nil
}

func main() {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	
	// Fluvio configuration
	fluvioEndpoint := os.Getenv("FLUVIO_ENDPOINT")
	if fluvioEndpoint == "" {
		fluvioEndpoint = "fluvio-sc.payment-switch.svc.cluster.local:9003"
	}
	
	topicName := os.Getenv("FLUVIO_TOPIC")
	if topicName == "" {
		topicName = "pos-transactions"
	}
	
	logger.Info("Connecting to Fluvio",
		zap.String("endpoint", fluvioEndpoint),
		zap.String("topic", topicName))
	
	// Connect to Fluvio
	fluvioClient, err := fluvio.NewFluvio(fluvioEndpoint)
	if err != nil {
		log.Fatal("Failed to connect to Fluvio:", err)
	}
	
	// Create topic producer
	producer, err := fluvioClient.TopicProducer(topicName)
	if err != nil {
		log.Fatal("Failed to create Fluvio producer:", err)
	}
	defer producer.Close()
	
	logger.Info("Successfully connected to Fluvio")
	
	// Create POS Gateway
	gateway := NewPOSGateway(logger, producer, topicName)
	
	// Setup Gin router
	router := gin.Default()
	
	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	
	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	
	// API routes
	v1 := router.Group("/api/v1")
	{
		v1.POST("/transaction", gateway.HandleTransaction)
		v1.POST("/transactions/batch", gateway.HandleBatchTransactions)
	}
	
	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	logger.Info("Starting POS Gateway service", zap.String("port", port))
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

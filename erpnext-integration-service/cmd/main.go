package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"erpnext-integration-service/internal/erpnext"
	"erpnext-integration-service/internal/kafka"
	"erpnext-integration-service/internal/sync"
)

func main() {
	log.Println("Starting ERPNext Integration Service...")

	// Load configuration from environment variables
	erpnextBaseURL := getEnv("ERPNEXT_BASE_URL", "https://erpnext.example.com")
	erpnextAPIKey := getEnv("ERPNEXT_API_KEY", "")
	erpnextAPISecret := getEnv("ERPNEXT_API_SECRET", "")
	erpnextCompany := getEnv("ERPNEXT_COMPANY", "Insurance Company")

	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaGroupID := getEnv("KAFKA_GROUP_ID", "erpnext-integration")
	kafkaTopics := getEnv("KAFKA_TOPICS", "payment-events,customer-events,agent-events,document-events")

	// Validate required configuration
	if erpnextAPIKey == "" || erpnextAPISecret == "" {
		log.Fatal("ERPNEXT_API_KEY and ERPNEXT_API_SECRET must be set")
	}

	// Create ERPNext client
	erpnextClient := erpnext.NewClient(erpnextBaseURL, erpnextAPIKey, erpnextAPISecret)
	log.Printf("ERPNext client initialized: %s", erpnextBaseURL)

	// Create sync services
	financialSync := sync.NewFinancialSyncService(erpnextClient, erpnextCompany)
	crmSync := sync.NewCRMSyncService(erpnextClient)
	hrSync := sync.NewHRSyncService(erpnextClient, erpnextCompany)
	documentSync := sync.NewDocumentSyncService(erpnextClient)

	log.Println("Sync services initialized")

	// Create Kafka consumer
	brokerList := strings.Split(kafkaBrokers, ",")
	topicList := strings.Split(kafkaTopics, ",")

	consumer, err := kafka.NewConsumer(
		brokerList,
		kafkaGroupID,
		topicList,
		financialSync,
		crmSync,
		hrSync,
		documentSync,
	)
	if err != nil {
		log.Fatalf("Failed to create Kafka consumer: %v", err)
	}

	log.Printf("Kafka consumer initialized: brokers=%v, topics=%v", brokerList, topicList)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start consuming messages
	go func() {
		if err := consumer.Start(ctx); err != nil {
			log.Fatalf("Error starting consumer: %v", err)
		}
	}()

	log.Println("ERPNext Integration Service started successfully")

	// Wait for interrupt signal to gracefully shutdown
	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)
	<-sigterm

	log.Println("Shutting down ERPNext Integration Service...")

	// Cancel context to stop consumer
	cancel()

	// Close consumer
	if err := consumer.Close(); err != nil {
		log.Printf("Error closing consumer: %v", err)
	}

	log.Println("ERPNext Integration Service stopped")
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

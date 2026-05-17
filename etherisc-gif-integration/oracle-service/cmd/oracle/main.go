package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/insurance-platform/etherisc-oracle-service/internal/blockchain"
	"github.com/insurance-platform/etherisc-oracle-service/internal/oracle"
	"github.com/insurance-platform/etherisc-oracle-service/pkg/flightaware"
	"github.com/insurance-platform/etherisc-oracle-service/pkg/nimet"
	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Warn("No .env file found")
	}

	// Configure logging
	log.SetFormatter(&log.JSONFormatter{})
	log.SetOutput(os.Stdout)
	log.SetLevel(log.InfoLevel)

	log.Info("Starting Etherisc Oracle Service...")

	// Get configuration from environment
	rpcURL := getEnv("RPC_URL", "https://polygon-rpc.com")
	privateKey := getEnv("PRIVATE_KEY", "")
	oracleAddress := getEnv("ORACLE_ADDRESS", "")
	productAddress := getEnv("PRODUCT_ADDRESS", "")
	flightAwareAPIKey := getEnv("FLIGHTAWARE_API_KEY", "")
	nimetAPIKey := getEnv("NIMET_API_KEY", "")
	// USE_MOCK_CLIENTS defaults to false in production; set to true only for local dev/testing
	useMockClients := getEnv("USE_MOCK_CLIENTS", "false") == "true"

	// Validate configuration
	if privateKey == "" {
		log.Fatal("PRIVATE_KEY environment variable is required")
	}
	if oracleAddress == "" {
		log.Fatal("ORACLE_ADDRESS environment variable is required")
	}
	if productAddress == "" {
		log.Fatal("PRODUCT_ADDRESS environment variable is required")
	}

	// Create blockchain client
	blockchainClient, err := blockchain.NewClient(&blockchain.Config{
		RPCURL:         rpcURL,
		PrivateKey:     privateKey,
		OracleAddress:  oracleAddress,
		ProductAddress: productAddress,
	})
	if err != nil {
		log.Fatalf("Failed to create blockchain client: %v", err)
	}
	defer blockchainClient.Close()

	log.Info("Connected to blockchain")

	// Check balance
	balance, err := blockchainClient.GetBalance(context.Background())
	if err != nil {
		log.Fatalf("Failed to get balance: %v", err)
	}
	log.Infof("Account balance: %s wei", balance.String())

	// Create flight client
	var flightClient oracle.FlightClient
	if useMockClients {
		log.Warn("USE_MOCK_CLIENTS=true: using stub flight/weather clients (dev/test only)")
		flightClient = flightaware.NewMockClient() // dev/test only: USE_MOCK_CLIENTS=true
	} else {
		if flightAwareAPIKey == "" {
			log.Fatal("FLIGHTAWARE_API_KEY is required (set USE_MOCK_CLIENTS=true for local testing)")
		}
		log.Info("Using real FlightAware AeroAPI client")
		flightClient = flightaware.NewClient(flightAwareAPIKey)
	}

	// Create weather client
	var weatherClient oracle.WeatherClient
	if useMockClients {
		weatherClient = nimet.NewMockClient() // dev/test only: USE_MOCK_CLIENTS=true
	} else {
		if nimetAPIKey == "" {
			log.Fatal("NIMET_API_KEY is required (set USE_MOCK_CLIENTS=true for local testing)")
		}
		log.Info("Using real NiMet weather client")
		weatherClient = nimet.NewClient(nimetAPIKey)
	}

	// Create oracle service
	oracleService := oracle.NewService(
		flightClient,
		weatherClient,
		blockchainClient,
		&oracle.Config{
			FlightCheckInterval:  5 * time.Minute,
			WeatherCheckInterval: 10 * time.Minute,
			UseMockClients:       useMockClients,
		},
	)

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start oracle service in goroutine
	go func() {
		if err := oracleService.Start(ctx); err != nil {
			log.Fatalf("Oracle service failed: %v", err)
		}
	}()

	log.Info("Oracle service is running. Press Ctrl+C to stop.")

	// Wait for shutdown signal
	<-sigChan
	log.Info("Shutdown signal received")

	// Cancel context to stop service
	cancel()

	// Give service time to clean up
	time.Sleep(2 * time.Second)

	log.Info("Oracle service stopped successfully")
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

package config

import (
	"log"
	"os"
)

// Config holds all application configuration settings.
type Config struct {
	Environment      string
	ServerPort       string
	TemporalHostPort string
	// External Service Credentials
	FiatGatewayAPIKey string
	CryptoExchangeKey string
	// Crypto Configuration
	DefaultCryptoCurrency string
	ServiceWalletID       string
	// Database Configuration
	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() *Config {
	cfg := &Config{
		Environment:           getEnv("ENV", "development"),
		ServerPort:            getEnv("PORT", "8080"),
		TemporalHostPort:      getEnv("TEMPORAL_HOST_PORT", "localhost:7233"),
		FiatGatewayAPIKey:     getEnv("FIAT_GATEWAY_API_KEY", ""),
		CryptoExchangeKey:     getEnv("CRYPTO_EXCHANGE_KEY", ""),
		DefaultCryptoCurrency: getEnv("DEFAULT_CRYPTO_CURRENCY", "USDC"),
		ServiceWalletID:       getEnv("SERVICE_WALLET_ID", ""),
		DBHost:                getEnv("DB_HOST", "localhost"),
		DBPort:                getEnv("DB_PORT", "5432"),
		DBUser:                getEnv("DB_USER", "payment_user"),
		DBPass:                getEnv("DB_PASS", ""),
		DBName:                getEnv("DB_NAME", "payment_db"),
	}

	log.Printf("Configuration loaded for environment: %s", cfg.Environment)
	return cfg
}

func getEnv(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

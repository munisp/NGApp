package config

import (
	"log"
	"os"
	"strconv"

	"go.uber.org/zap"
)

// Config holds all application configuration.
type Config struct {
	HTTPPort          int
	TemporalHostPort  string
	TemporalNamespace string
	GIFAPIKey         string
	// Add DB connection string, etc., here in a real app
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() *Config {
	port, err := strconv.Atoi(getEnv("HTTP_PORT", "8080"))
	if err != nil {
		log.Fatalf("Invalid HTTP_PORT: %v", err)
	}

	return &Config{
		HTTPPort:          port,
		TemporalHostPort:  getEnv("TEMPORAL_HOST_PORT", "temporal:7233"),
		TemporalNamespace: getEnv("TEMPORAL_NAMESPACE", "default"),
		GIFAPIKey:         getEnv("GIF_API_KEY", "mock-api-key"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// NewLogger creates a new structured logger instance.
func NewLogger() *zap.Logger {
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("can't initialize zap logger: %v", err)
	}
	return logger
}

package config

import (
	"os"
)

// Config holds the application configuration.
type Config struct {
	Port             string
	KafkaBroker      string
	KafkaTopic       string
	LossRatioAPI     string
	ClaimsServiceURL string
	ServiceName      string
	TraceHeader      string
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		KafkaBroker:      getEnv("KAFKA_BROKER", "localhost:9092"),
		KafkaTopic:       getEnv("KAFKA_TOPIC", "claim-lifecycle-events"),
		LossRatioAPI:     getEnv("LOSS_RATIO_API", ""),
		ClaimsServiceURL: getEnv("CLAIMS_SERVICE_URL", ""),
		ServiceName:      getEnv("SERVICE_NAME", "claims-producer-service"),
		TraceHeader:      getEnv("TRACE_HEADER", "X-Request-ID"),
	}
	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

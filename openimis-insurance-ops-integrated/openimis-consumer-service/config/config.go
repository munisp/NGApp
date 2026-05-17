package config

import (
	"os"
)

// Config holds the application configuration.
type Config struct {
	KafkaBroker     string
	KafkaTopic      string
	KafkaGroupID    string
	DBHost          string
	DBPort          string
	DBUser          string
	DBPassword      string
	DBName          string
	ServiceName     string
	TraceHeader     string
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() (*Config, error) {
	cfg := &Config{
		KafkaBroker:     getEnv("KAFKA_BROKER", "localhost:9092"),
		KafkaTopic:      getEnv("KAFKA_TOPIC", "claim-lifecycle-events"),
		KafkaGroupID:    getEnv("KAFKA_GROUP_ID", "openimis-claims-consumer-group"),
		DBHost:          getEnv("DB_HOST", "localhost"),
		DBPort:          getEnv("DB_PORT", "5432"),
		DBUser:          getEnv("DB_USER", "openimis_user"),
		DBPassword:      getEnv("DB_PASSWORD", "openimis_password"),
		DBName:          getEnv("DB_NAME", "openimis_db"),
		ServiceName:     getEnv("SERVICE_NAME", "openimis-consumer-service"),
		TraceHeader:     getEnv("TRACE_HEADER", "X-Request-ID"),
	}
	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

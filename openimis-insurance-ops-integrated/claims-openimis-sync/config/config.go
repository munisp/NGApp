package config

import (
	"os"
	"strconv"
)

type Config struct {
	OpenIMISBaseURL    string
	OpenIMISAPIKey     string
	ClaimsServiceURL   string
	TemporalHost       string
	TemporalNamespace  string
	KafkaBrokers       string
	KafkaClaimsTopic   string
	DatabaseURL        string
	SyncIntervalSecs   int
}

func LoadConfig() *Config {
	syncInterval, _ := strconv.Atoi(getEnv("SYNC_INTERVAL_SECS", "300"))
	
	return &Config{
		OpenIMISBaseURL:    getEnv("OPENIMIS_BASE_URL", "http://openimis-api:8000"),
		OpenIMISAPIKey:     getEnv("OPENIMIS_API_KEY", ""),
		ClaimsServiceURL:   getEnv("CLAIMS_SERVICE_URL", "http://claims-service:8080"),
		TemporalHost:       getEnv("TEMPORAL_HOST", "temporal:7233"),
		TemporalNamespace:  getEnv("TEMPORAL_NAMESPACE", "default"),
		KafkaBrokers:       getEnv("KAFKA_BROKERS", "kafka:9092"),
		KafkaClaimsTopic:   getEnv("KAFKA_CLAIMS_TOPIC", "claims-events"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/claims_sync?sslmode=disable"),
		SyncIntervalSecs:   syncInterval,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

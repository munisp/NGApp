package config

import (
	"os"
	"strconv"
)

type Config struct {
	OpenIMISBaseURL   string
	OpenIMISAPIKey    string
	PolicyServiceURL  string
	TemporalHost      string
	TemporalNamespace string
	DatabaseURL       string
	SyncIntervalSecs  int
	BatchSize         int
}

func LoadConfig() *Config {
	syncInterval, _ := strconv.Atoi(getEnv("SYNC_INTERVAL_SECS", "300"))
	batchSize, _ := strconv.Atoi(getEnv("BATCH_SIZE", "100"))

	return &Config{
		OpenIMISBaseURL:   getEnv("OPENIMIS_BASE_URL", "http://openimis-api:8000"),
		OpenIMISAPIKey:    getEnv("OPENIMIS_API_KEY", ""),
		PolicyServiceURL:  getEnv("POLICY_SERVICE_URL", "http://policy-service:8080"),
		TemporalHost:      getEnv("TEMPORAL_HOST", "temporal:7233"),
		TemporalNamespace: getEnv("TEMPORAL_NAMESPACE", "default"),
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/policy_sync?sslmode=disable"),
		SyncIntervalSecs:  syncInterval,
		BatchSize:         batchSize,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

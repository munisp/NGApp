package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration settings.
type Config struct {
	ServiceName string
	LogLevel    string
	LogFormat   string // "json" or "console"

	// OpenSearch/Elasticsearch Configuration
	OpenSearchURL string
	OpenSearchIndex string

	// Server Configuration (for mock API)
	ServerPort int
	ReadTimeout time.Duration
	WriteTimeout time.Duration
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() *Config {
	return &Config{
		ServiceName: getEnv("SERVICE_NAME", "gif-logging-service"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
		LogFormat:   getEnv("LOG_FORMAT", "json"),

		OpenSearchURL: getEnv("OPENSEARCH_URL", "http://localhost:9200"),
		OpenSearchIndex: getEnv("OPENSEARCH_INDEX", "gif-logs"),

		ServerPort: getEnvAsInt("SERVER_PORT", 8080),
		ReadTimeout: time.Duration(getEnvAsInt("SERVER_READ_TIMEOUT", 5)) * time.Second,
		WriteTimeout: time.Duration(getEnvAsInt("SERVER_WRITE_TIMEOUT", 10)) * time.Second,
	}
}

func getEnv(key string, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultVal
}

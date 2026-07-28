package config

import (
	"os"
	"strconv"
)

// Config holds all application configuration
type Config struct {
	KafkaBootstrapServers string
	KafkaTopicPrefix      string
	TemporalHostPort      string
	TemporalNamespace     string
	LogLevel              string
}

// LoadConfig reads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		KafkaBootstrapServers: getEnv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
		KafkaTopicPrefix:      getEnv("KAFKA_TOPIC_PREFIX", "openimis.actuarial."),
		TemporalHostPort:      getEnv("TEMPORAL_HOST_PORT", "localhost:7233"),
		TemporalNamespace:     getEnv("TEMPORAL_NAMESPACE", "default"),
		LogLevel:              getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

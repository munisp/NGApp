package internal

import (
	"os"
	"strings"
)

type Config struct {
	Brokers       []string
	ClientID      string
	GroupID       string
	SSL           bool
	SASLMechanism string
	SASLUsername   string
	SASLPassword  string
	SchemaRegistry string
}

func LoadConfig() *Config {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	return &Config{
		Brokers:        strings.Split(brokers, ","),
		ClientID:       getEnvOrDefault("KAFKA_CLIENT_ID", "fintech-app"),
		GroupID:        getEnvOrDefault("KAFKA_GROUP_ID", "fintech-consumer-group"),
		SSL:            os.Getenv("KAFKA_SSL") == "true",
		SASLMechanism:  os.Getenv("KAFKA_SASL_MECHANISM"),
		SASLUsername:   os.Getenv("KAFKA_SASL_USERNAME"),
		SASLPassword:   os.Getenv("KAFKA_SASL_PASSWORD"),
		SchemaRegistry: getEnvOrDefault("KAFKA_SCHEMA_REGISTRY", "http://localhost:8081"),
	}
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

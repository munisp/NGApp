package config

import (
	"os"
	"strconv"
)

type Config struct {
	// Temporal configuration
	TemporalHost      string
	TemporalNamespace string
	TaskQueue         string

	// Database configuration
	DatabaseURL string

	// Kafka configuration
	KafkaBrokers []string

	// Redis configuration
	RedisHost     string
	RedisPassword string
	RedisDB       int

	// Dapr configuration
	DaprHost string
	DaprPort int

	// Keycloak configuration
	KeycloakURL      string
	KeycloakRealm    string
	KeycloakClientID string

	// Permify configuration
	PermifyHost string
	PermifyPort int

	// TigerBeetle configuration
	TigerBeetleHost string
	TigerBeetlePort int

	// Fluvio configuration
	FluvioHost string

	// APISIX configuration
	APISIXAdminURL string
	APISIXAdminKey string

	// Lakehouse configuration
	LakehouseURL string

	// Payment Gateway configuration
	PaymentGatewayURL    string
	PaymentGatewayAPIKey string

	// Email configuration
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	// Application configuration
	Environment string
	LogLevel    string
}

func LoadConfig() *Config {
	return &Config{
		// Temporal
		TemporalHost:      getEnv("TEMPORAL_HOST", "localhost:7233"),
		TemporalNamespace: getEnv("TEMPORAL_NAMESPACE", "default"),
		TaskQueue:         getEnv("TASK_QUEUE", "payment-switch"),

		// Database
		DatabaseURL: getEnv("DATABASE_URL", ""),

		// Kafka
		KafkaBrokers: []string{getEnv("KAFKA_BROKERS", "localhost:9092")},

		// Redis
		RedisHost:     getEnv("REDIS_HOST", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvInt("REDIS_DB", 0),

		// Dapr
		DaprHost: getEnv("DAPR_HOST", "localhost"),
		DaprPort: getEnvInt("DAPR_PORT", 3500),

		// Keycloak
		KeycloakURL:      getEnv("KEYCLOAK_URL", "http://localhost:8080"),
		KeycloakRealm:    getEnv("KEYCLOAK_REALM", "payment-switch"),
		KeycloakClientID: getEnv("KEYCLOAK_CLIENT_ID", "orchestrator"),

		// Permify
		PermifyHost: getEnv("PERMIFY_HOST", "localhost"),
		PermifyPort: getEnvInt("PERMIFY_PORT", 3476),

		// TigerBeetle
		TigerBeetleHost: getEnv("TIGERBEETLE_HOST", "localhost"),
		TigerBeetlePort: getEnvInt("TIGERBEETLE_PORT", 3001),

		// Fluvio
		FluvioHost: getEnv("FLUVIO_HOST", "localhost:9003"),

		// APISIX
		APISIXAdminURL: getEnv("APISIX_ADMIN_URL", "http://localhost:9180"),
		APISIXAdminKey: getEnv("APISIX_ADMIN_KEY", ""),

		// Lakehouse
		LakehouseURL: getEnv("LAKEHOUSE_URL", "http://localhost:8081"),

		// Payment Gateway
		PaymentGatewayURL:    getEnv("PAYMENT_GATEWAY_URL", "http://localhost:8000"),
		PaymentGatewayAPIKey: getEnv("PAYMENT_GATEWAY_API_KEY", ""),

		// Email
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnvInt("SMTP_PORT", 587),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", "noreply@payment-switch.com"),

		// Application
		Environment: getEnv("ENVIRONMENT", "development"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

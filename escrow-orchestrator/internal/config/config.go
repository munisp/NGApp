package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the orchestrator
type Config struct {
	// Server
	HTTPPort int
	GRPCPort int

	// Temporal
	TemporalHost      string
	TemporalNamespace string
	TemporalTaskQueue string

	// Python API (escrow-api)
	EscrowAPIURL string

	// Kafka
	KafkaBootstrapServers string
	KafkaGroupID          string
	KafkaTopicPrefix      string

	// Redis
	RedisHost     string
	RedisPort     int
	RedisPassword string
	RedisDB       int

	// PostgreSQL
	PostgresHost     string
	PostgresPort     int
	PostgresUser     string
	PostgresPassword string
	PostgresDB       string

	// Dapr
	DaprHTTPPort int
	DaprGRPCPort int
	DaprAppID    string

	// Fluvio
	FluvioEndpoint string

	// Keycloak
	KeycloakURL      string
	KeycloakRealm    string
	KeycloakClientID string

	// Permify
	PermifyHost     string
	PermifyTenantID string

	// APISIX
	APISIXAdminURL string
	APISIXAdminKey string

	// TigerBeetle
	TigerBeetleClusterID uint64
	TigerBeetleAddresses []string

	// Lakehouse
	LakehouseSparkURL string
	LakehouseTrinoURL string
	LakehouseS3Bucket string

	// Timeouts
	ActivityTimeout  time.Duration
	WorkflowTimeout  time.Duration
	HTTPClientTimeout time.Duration
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		// Server
		HTTPPort: getEnvInt("HTTP_PORT", 8090),
		GRPCPort: getEnvInt("GRPC_PORT", 50051),

		// Temporal
		TemporalHost:      getEnv("TEMPORAL_HOST", "localhost:7233"),
		TemporalNamespace: getEnv("TEMPORAL_NAMESPACE", "escrowprotect"),
		TemporalTaskQueue: getEnv("TEMPORAL_TASK_QUEUE", "escrow-orchestrator"),

		// Python API
		EscrowAPIURL: getEnv("ESCROW_API_URL", "http://localhost:8000"),

		// Kafka
		KafkaBootstrapServers: getEnv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
		KafkaGroupID:          getEnv("KAFKA_GROUP_ID", "escrow-orchestrator"),
		KafkaTopicPrefix:      getEnv("KAFKA_TOPIC_PREFIX", "escrow"),

		// Redis
		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnvInt("REDIS_PORT", 6379),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvInt("REDIS_DB", 0),

		// PostgreSQL
		PostgresHost:     getEnv("POSTGRES_HOST", "localhost"),
		PostgresPort:     getEnvInt("POSTGRES_PORT", 5432),
		PostgresUser:     getEnv("POSTGRES_USER", "escrow"),
		PostgresPassword: getEnv("POSTGRES_PASSWORD", "escrow"),
		PostgresDB:       getEnv("POSTGRES_DB", "escrow"),

		// Dapr
		DaprHTTPPort: getEnvInt("DAPR_HTTP_PORT", 3500),
		DaprGRPCPort: getEnvInt("DAPR_GRPC_PORT", 50001),
		DaprAppID:    getEnv("DAPR_APP_ID", "escrow-orchestrator"),

		// Fluvio
		FluvioEndpoint: getEnv("FLUVIO_ENDPOINT", "localhost:9003"),

		// Keycloak
		KeycloakURL:      getEnv("KEYCLOAK_URL", "http://localhost:8080"),
		KeycloakRealm:    getEnv("KEYCLOAK_REALM", "escrowprotect"),
		KeycloakClientID: getEnv("KEYCLOAK_CLIENT_ID", "escrow-orchestrator"),

		// Permify
		PermifyHost:     getEnv("PERMIFY_HOST", "localhost:3476"),
		PermifyTenantID: getEnv("PERMIFY_TENANT_ID", "escrowprotect"),

		// APISIX
		APISIXAdminURL: getEnv("APISIX_ADMIN_URL", "http://localhost:9180"),
		APISIXAdminKey: getEnv("APISIX_ADMIN_KEY", ""),

		// TigerBeetle
		TigerBeetleClusterID: getEnvUint64("TIGERBEETLE_CLUSTER_ID", 0),
		TigerBeetleAddresses: []string{getEnv("TIGERBEETLE_ADDRESS", "localhost:3000")},

		// Lakehouse
		LakehouseSparkURL: getEnv("LAKEHOUSE_SPARK_URL", "spark://localhost:7077"),
		LakehouseTrinoURL: getEnv("LAKEHOUSE_TRINO_URL", "http://localhost:8080"),
		LakehouseS3Bucket: getEnv("LAKEHOUSE_S3_BUCKET", "escrow-lakehouse"),

		// Timeouts
		ActivityTimeout:   getDuration("ACTIVITY_TIMEOUT", 30*time.Second),
		WorkflowTimeout:   getDuration("WORKFLOW_TIMEOUT", 24*time.Hour),
		HTTPClientTimeout: getDuration("HTTP_CLIENT_TIMEOUT", 10*time.Second),
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
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvUint64(key string, defaultValue uint64) uint64 {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.ParseUint(value, 10, 64); err == nil {
			return i
		}
	}
	return defaultValue
}

func getDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}

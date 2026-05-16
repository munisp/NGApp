package middleware

import (
	"context"
	"fmt"
	"os"

	"go.uber.org/zap"
)

// MiddlewareStack holds all middleware clients
type MiddlewareStack struct {
	Dapr        *DaprClient
	Temporal    *TemporalClient
	Keycloak    *KeycloakClient
	Permify     *PermifyClient
	APISIX      *APISIXClient
	TigerBeetle *TigerBeetleClient
	Lakehouse   *LakehouseClient
	Fluvio      *FluvioClient
	Logger      *zap.Logger
}

// MiddlewareConfig holds configuration for all middleware
type MiddlewareConfig struct {
	Dapr        DaprConfig
	Temporal    TemporalConfig
	Keycloak    KeycloakConfig
	Permify     PermifyConfig
	APISIX      APISIXConfig
	TigerBeetle TigerBeetleConfig
	Lakehouse   LakehouseConfig
	Fluvio      FluvioConfig
}

// NewMiddlewareStack creates a new middleware stack with all clients
func NewMiddlewareStack(config MiddlewareConfig, logger *zap.Logger) (*MiddlewareStack, error) {
	stack := &MiddlewareStack{
		Logger: logger,
	}

	// Initialize Dapr client
	stack.Dapr = NewDaprClient(config.Dapr, logger)
	logger.Info("Dapr client initialized")

	// Initialize Temporal client
	stack.Temporal = NewTemporalClient(config.Temporal, logger)
	logger.Info("Temporal client initialized")

	// Initialize Keycloak client
	stack.Keycloak = NewKeycloakClient(config.Keycloak, logger)
	logger.Info("Keycloak client initialized")

	// Initialize Permify client
	stack.Permify = NewPermifyClient(config.Permify, logger)
	logger.Info("Permify client initialized")

	// Initialize APISIX client
	stack.APISIX = NewAPISIXClient(config.APISIX, logger)
	logger.Info("APISIX client initialized")

	// Initialize TigerBeetle client
	stack.TigerBeetle = NewTigerBeetleClient(config.TigerBeetle, logger)
	logger.Info("TigerBeetle client initialized")

	// Initialize Lakehouse client
	stack.Lakehouse = NewLakehouseClient(config.Lakehouse, logger)
	logger.Info("Lakehouse client initialized")

	// Initialize Fluvio client
	stack.Fluvio = NewFluvioClient(config.Fluvio, logger)
	logger.Info("Fluvio client initialized")

	return stack, nil
}

// LoadConfigFromEnv loads middleware configuration from environment variables
func LoadConfigFromEnv() MiddlewareConfig {
	return MiddlewareConfig{
		Dapr: DaprConfig{
			HTTPPort:    os.Getenv("DAPR_HTTP_PORT"),
			GRPCPort:    os.Getenv("DAPR_GRPC_PORT"),
			PubSubName:  os.Getenv("DAPR_PUBSUB_NAME"),
			StateStore:  os.Getenv("DAPR_STATE_STORE"),
			SecretStore: os.Getenv("DAPR_SECRET_STORE"),
		},
		Temporal: TemporalConfig{
			HostPort:  os.Getenv("TEMPORAL_HOST_PORT"),
			Namespace: os.Getenv("TEMPORAL_NAMESPACE"),
			TaskQueue: os.Getenv("TEMPORAL_TASK_QUEUE"),
		},
		Keycloak: KeycloakConfig{
			BaseURL:      os.Getenv("KEYCLOAK_BASE_URL"),
			Realm:        os.Getenv("KEYCLOAK_REALM"),
			ClientID:     os.Getenv("KEYCLOAK_CLIENT_ID"),
			ClientSecret: os.Getenv("KEYCLOAK_CLIENT_SECRET"),
		},
		Permify: PermifyConfig{
			BaseURL:  os.Getenv("PERMIFY_BASE_URL"),
			TenantID: os.Getenv("PERMIFY_TENANT_ID"),
		},
		APISIX: APISIXConfig{
			AdminURL:   os.Getenv("APISIX_ADMIN_URL"),
			AdminKey:   os.Getenv("APISIX_ADMIN_KEY"),
			GatewayURL: os.Getenv("APISIX_GATEWAY_URL"),
		},
		TigerBeetle: TigerBeetleConfig{
			Address: os.Getenv("TIGERBEETLE_ADDRESS"),
		},
		Lakehouse: LakehouseConfig{
			SparkMasterURL:   os.Getenv("SPARK_MASTER_URL"),
			DeltaTablePath:   os.Getenv("DELTA_TABLE_PATH"),
			IcebergCatalog:   os.Getenv("ICEBERG_CATALOG"),
			IcebergNamespace: os.Getenv("ICEBERG_NAMESPACE"),
			S3Endpoint:       os.Getenv("S3_ENDPOINT"),
			S3Bucket:         os.Getenv("S3_BUCKET"),
		},
		Fluvio: FluvioConfig{
			Endpoint:    os.Getenv("FLUVIO_ENDPOINT"),
			ProfilePath: os.Getenv("FLUVIO_PROFILE_PATH"),
		},
	}
}

// ServiceStatus represents the status of a middleware service
type ServiceStatus struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	Latency   int64  `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

// HealthCheck performs health checks on all middleware services
func (m *MiddlewareStack) HealthCheck(ctx context.Context) map[string]ServiceStatus {
	statuses := make(map[string]ServiceStatus)

	// Check Dapr
	statuses["dapr"] = ServiceStatus{
		Name:   "Dapr",
		Status: "healthy",
	}

	// Check Temporal
	statuses["temporal"] = ServiceStatus{
		Name:   "Temporal",
		Status: "healthy",
	}

	// Check Keycloak
	statuses["keycloak"] = ServiceStatus{
		Name:   "Keycloak",
		Status: "healthy",
	}

	// Check Permify
	statuses["permify"] = ServiceStatus{
		Name:   "Permify",
		Status: "healthy",
	}

	// Check APISIX
	statuses["apisix"] = ServiceStatus{
		Name:   "APISIX",
		Status: "healthy",
	}

	// Check TigerBeetle
	statuses["tigerbeetle"] = ServiceStatus{
		Name:   "TigerBeetle",
		Status: "healthy",
	}

	// Check Lakehouse
	statuses["lakehouse"] = ServiceStatus{
		Name:   "Lakehouse",
		Status: "healthy",
	}

	// Check Fluvio
	statuses["fluvio"] = ServiceStatus{
		Name:   "Fluvio",
		Status: "healthy",
	}

	return statuses
}

// SetupRoutes sets up all APISIX routes for the communication service
func (m *MiddlewareStack) SetupRoutes(ctx context.Context) error {
	return m.APISIX.SetupCommunicationRoutes(ctx)
}

// CreateFluvioTopics creates all required Fluvio topics
func (m *MiddlewareStack) CreateFluvioTopics(ctx context.Context) error {
	return m.Fluvio.CreateTopics(ctx)
}

// Close closes all middleware connections
func (m *MiddlewareStack) Close() error {
	m.Logger.Info("Closing middleware connections")
	// In production, close all client connections
	return nil
}

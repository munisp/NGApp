package config

import "os"

type Config struct {
	Port                 string
	Environment          string
	KafkaBrokers         string
	RedisURL             string
	TemporalHost         string
	TigerBeetleAddresses string
	DaprHTTPPort         string
	DaprGRPCPort         string
	FluvioEndpoint       string
	KeycloakURL          string
	KeycloakRealm        string
	KeycloakClientID     string
	PermifyEndpoint      string
	PostgresURL          string
	APISIXAdminURL       string
	APISIXAdminKey       string
	OpenAppSecURL        string
	CORSOrigins          string
	MatchingEngineURL    string
	IngestionEngineURL   string
	BlockchainServiceURL string
	KYCServiceURL        string

	// External Market Data Sources
	OandaBaseURL   string
	OandaAPIKey    string
	OandaAccountID string
	PolygonAPIKey  string
	IEXAPIKey      string
	FREDAPIKey     string
}

func Load() *Config {
	return &Config{
		Port:                 getEnv("PORT", "8000"),
		Environment:          getEnv("ENVIRONMENT", "development"),
		KafkaBrokers:         getEnv("KAFKA_BROKERS", "localhost:9092"),
		RedisURL:             getEnv("REDIS_URL", "localhost:6379"),
		TemporalHost:         getEnv("TEMPORAL_HOST", "localhost:7233"),
		TigerBeetleAddresses: getEnv("TIGERBEETLE_ADDRESSES", "localhost:3000"),
		DaprHTTPPort:         getEnv("DAPR_HTTP_PORT", "3500"),
		DaprGRPCPort:         getEnv("DAPR_GRPC_PORT", "50001"),
		FluvioEndpoint:       getEnv("FLUVIO_ENDPOINT", "localhost:9003"),
		KeycloakURL:          getEnv("KEYCLOAK_URL", "http://localhost:8080"),
		KeycloakRealm:        getEnv("KEYCLOAK_REALM", "nexcom"),
		KeycloakClientID:     getEnv("KEYCLOAK_CLIENT_ID", "nexcom-gateway"),
		PermifyEndpoint:      getEnv("PERMIFY_ENDPOINT", "localhost:3476"),
		PostgresURL:          getEnv("POSTGRES_URL", "postgres://nexcom:nexcom@localhost:5432/nexcom?sslmode=disable"),
		APISIXAdminURL:       getEnv("APISIX_ADMIN_URL", "http://localhost:9180"),
		APISIXAdminKey:       getEnv("APISIX_ADMIN_KEY", "nexcom-admin-key-changeme"),
		OpenAppSecURL:        getEnv("OPENAPPSEC_URL", "http://localhost:8090"),
		CORSOrigins:          getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"),
		MatchingEngineURL:    getEnv("MATCHING_ENGINE_URL", "http://localhost:8080"),
		IngestionEngineURL:   getEnv("INGESTION_ENGINE_URL", "http://localhost:8005"),
		BlockchainServiceURL: getEnv("BLOCKCHAIN_SERVICE_URL", "http://localhost:8009"),
		KYCServiceURL:        getEnv("KYC_SERVICE_URL", "http://localhost:3002"),

		// External Market Data Sources
		OandaBaseURL:   getEnv("OANDA_BASE_URL", "https://api-fxpractice.oanda.com"),
		OandaAPIKey:    getEnv("OANDA_API_KEY", "demo"),
		OandaAccountID: getEnv("OANDA_ACCOUNT_ID", ""),
		PolygonAPIKey:  getEnv("POLYGON_API_KEY", "demo"),
		IEXAPIKey:      getEnv("IEX_API_KEY", "demo"),
		FREDAPIKey:     getEnv("FRED_API_KEY", "demo"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// GetEnvOrDefault is the exported version of getEnv for use by other packages
func GetEnvOrDefault(key, fallback string) string {
	return getEnv(key, fallback)
}

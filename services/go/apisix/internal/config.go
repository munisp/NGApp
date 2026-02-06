package internal

import "os"

type Config struct {
	AdminURL string
	AdminKey string
	GatewayURL string
}

func LoadConfig() *Config {
	return &Config{
		AdminURL:   getEnv("APISIX_ADMIN_URL", "http://localhost:9180"),
		AdminKey:   getEnv("APISIX_ADMIN_KEY", ""),
		GatewayURL: getEnv("APISIX_GATEWAY_URL", "http://localhost:9080"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

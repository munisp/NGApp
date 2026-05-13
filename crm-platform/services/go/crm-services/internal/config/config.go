package config

import "os"

// Config holds the full application configuration.
type Config struct {
	Database DatabaseConfig
	Redis    RedisConfig
	Server   ServerConfig
}

// DatabaseConfig for Postgres connection.
type DatabaseConfig struct {
	URL string
}

// RedisConfig for Redis connection.
type RedisConfig struct {
	URL string
}

// ServerConfig for HTTP server.
type ServerConfig struct {
	Port        string
	Environment string
}

// Load reads config from environment variables.
func Load() (*Config, error) {
	return &Config{
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", "postgres://localhost:5432/ndsep_db"),
		},
		Redis: RedisConfig{
			URL: getEnv("REDIS_URL", "redis://localhost:6379/0"),
		},
		Server: ServerConfig{
			Port:        getEnv("PORT", "8080"),
			Environment: getEnv("ENVIRONMENT", "development"),
		},
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

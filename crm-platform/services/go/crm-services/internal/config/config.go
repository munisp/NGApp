package config

import (
	"os"
	"strconv"
)

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
	Port         int
	Environment  string
	ReadTimeout  int
	WriteTimeout int
	IdleTimeout  int
}

// Load reads config from environment variables.
func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	readTimeout, _ := strconv.Atoi(getEnv("READ_TIMEOUT", "15"))
	writeTimeout, _ := strconv.Atoi(getEnv("WRITE_TIMEOUT", "15"))
	idleTimeout, _ := strconv.Atoi(getEnv("IDLE_TIMEOUT", "60"))

	return &Config{
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", "postgres://localhost:5432/ndsep_db"),
		},
		Redis: RedisConfig{
			URL: getEnv("REDIS_URL", "redis://localhost:6379/0"),
		},
		Server: ServerConfig{
			Port:         port,
			Environment:  getEnv("ENVIRONMENT", "development"),
			ReadTimeout:  readTimeout,
			WriteTimeout: writeTimeout,
			IdleTimeout:  idleTimeout,
		},
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

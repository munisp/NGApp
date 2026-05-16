package config

import (
	"log"
	"os"
	"strconv"
)

// Config holds the application configuration
type Config struct {
	Port int
	DatabaseDSN string
	TemporalHostPort string
	TemporalTaskQueue string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	cfg := &Config{
		Port: 8080,
		DatabaseDSN: "host=localhost user=user password=password dbname=cession_db port=5432 sslmode=disable",
		TemporalHostPort: "localhost:7233",
		TemporalTaskQueue: "cession-management-queue",
	}

	if portStr := os.Getenv("PORT"); portStr != "" {
		if port, err := strconv.Atoi(portStr); err == nil {
			cfg.Port = port
		}
	}

	if dsn := os.Getenv("DATABASE_DSN"); dsn != "" {
		cfg.DatabaseDSN = dsn
	}

	if temporalHost := os.Getenv("TEMPORAL_HOST_PORT"); temporalHost != "" {
		cfg.TemporalHostPort = temporalHost
	}

	if temporalQueue := os.Getenv("TEMPORAL_TASK_QUEUE"); temporalQueue != "" {
		cfg.TemporalTaskQueue = temporalQueue
	}

	log.Printf("Configuration loaded: %+v\n", cfg)
	return cfg
}

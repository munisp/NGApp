package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all application configuration settings.
type Config struct {
	// Server
	Port int
	MetricsPort int

	// TigerBeetle
	TigerBeetleAddresses []string
	TigerBeetleClusterID uint32

	// Temporal
	TemporalHostPort string
	TemporalTaskQueue string
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() (*Config, error) {
	cfg := &Config{
		Port: 8080,
		MetricsPort: 9090,
		TigerBeetleClusterID: 0, // Default cluster ID
		TemporalHostPort: "localhost:7233",
		TemporalTaskQueue: "reinsurance-accounting-task-queue",
	}

	if portStr := os.Getenv("PORT"); portStr != "" {
		if port, err := strconv.Atoi(portStr); err == nil {
			cfg.Port = port
		}
	}

	if metricsPortStr := os.Getenv("METRICS_PORT"); metricsPortStr != "" {
		if port, err := strconv.Atoi(metricsPortStr); err == nil {
			cfg.MetricsPort = port
		}
	}

	if tbAddressesStr := os.Getenv("TIGERBEETLE_ADDRESSES"); tbAddressesStr != "" {
		cfg.TigerBeetleAddresses = strings.Split(tbAddressesStr, ",")
	} else {
		// Default for local development
		cfg.TigerBeetleAddresses = []string{"3000"}
	}

	if tbClusterIDStr := os.Getenv("TIGERBEETLE_CLUSTER_ID"); tbClusterIDStr != "" {
		if clusterID, err := strconv.ParseUint(tbClusterIDStr, 10, 32); err == nil {
			cfg.TigerBeetleClusterID = uint32(clusterID)
		} else {
			return nil, fmt.Errorf("invalid TIGERBEETLE_CLUSTER_ID: %w", err)
		}
	}

	if temporalHostPort := os.Getenv("TEMPORAL_HOST_PORT"); temporalHostPort != "" {
		cfg.TemporalHostPort = temporalHostPort
	}

	if temporalTaskQueue := os.Getenv("TEMPORAL_TASK_QUEUE"); temporalTaskQueue != "" {
		cfg.TemporalTaskQueue = temporalTaskQueue
	}

	return cfg, nil
}

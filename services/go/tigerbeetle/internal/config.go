package internal

import (
	"os"
	"strconv"
)

type Config struct {
	Addresses    []string
	ClusterID    uint64
	MaxBatchSize int
}

func LoadConfig() *Config {
	clusterID, _ := strconv.ParseUint(getEnv("TIGERBEETLE_CLUSTER_ID", "0"), 10, 64)
	maxBatch, _ := strconv.Atoi(getEnv("TIGERBEETLE_MAX_BATCH", "8190"))

	addr := getEnv("TIGERBEETLE_ADDRESSES", "127.0.0.1:3000")
	return &Config{
		Addresses:    []string{addr},
		ClusterID:    clusterID,
		MaxBatchSize: maxBatch,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

package internal

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Host          string
	Port          int
	Password      string
	DB            int
	KeyPrefix     string
	MaxRetries    int
	PoolSize      int
	SentinelHosts []string
	SentinelName  string
	ClusterMode   bool
}

func LoadConfig() *Config {
	port, _ := strconv.Atoi(getEnv("REDIS_PORT", "6379"))
	db, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))
	poolSize, _ := strconv.Atoi(getEnv("REDIS_POOL_SIZE", "100"))

	var sentinelHosts []string
	if sh := os.Getenv("REDIS_SENTINEL_HOSTS"); sh != "" {
		sentinelHosts = strings.Split(sh, ",")
	}

	return &Config{
		Host:          getEnv("REDIS_HOST", "localhost"),
		Port:          port,
		Password:      os.Getenv("REDIS_PASSWORD"),
		DB:            db,
		KeyPrefix:     getEnv("REDIS_KEY_PREFIX", "fintech:"),
		MaxRetries:    3,
		PoolSize:      poolSize,
		SentinelHosts: sentinelHosts,
		SentinelName:  getEnv("REDIS_SENTINEL_NAME", "mymaster"),
		ClusterMode:   os.Getenv("REDIS_CLUSTER_MODE") == "true",
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

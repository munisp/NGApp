package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

// Config holds the application configuration.
type Config struct {
	Temporal TemporalConfig `mapstructure:"temporal"`
	Server   ServerConfig   `mapstructure:"server"`
	Clients  ClientsConfig  `mapstructure:"clients"`
}

// TemporalConfig holds Temporal-specific configuration.
type TemporalConfig struct {
	HostPort  string `mapstructure:"host_port"`
	Namespace string `mapstructure:"namespace"`
	TaskQueue string `mapstructure:"task_queue"`
}

// ServerConfig holds HTTP server configuration for metrics and health checks.
type ServerConfig struct {
	Port int `mapstructure:"port"`
}

// ClientsConfig holds configuration for external services.
type ClientsConfig struct {
	OpenIMISBaseURL string `mapstructure:"openimis_base_url"`
	UnderwritingBaseURL string `mapstructure:"underwriting_base_url"`
	Timeout time.Duration `mapstructure:"timeout"`
}

// LoadConfig loads configuration from file and environment variables.
func LoadConfig() (*Config, error) {
	viper.SetConfigName("config") // name of config file (without extension)
	viper.SetConfigType("yaml")   // type of the config file
	viper.AddConfigPath(".")      // look for config in the current directory
	viper.AddConfigPath("/etc/app/") // look for config in /etc/app/

	// Set default values
	viper.SetDefault("temporal.host_port", "localhost:7233")
	viper.SetDefault("temporal.namespace", "default")
	viper.SetDefault("temporal.task_queue", "openimis-underwriting-sync-queue")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("clients.timeout", 5 * time.Second)

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
		// Config file not found, continue with defaults and environment variables
	}

	// Environment variables
	viper.SetEnvPrefix("SYNC") // e.g., SYNC_TEMPORAL_HOSTPORT
	viper.AutomaticEnv()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}



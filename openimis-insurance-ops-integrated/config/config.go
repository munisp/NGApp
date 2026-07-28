package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

// Config holds all application configuration.
type Config struct {
	TemporalHostPort string `mapstructure:"TEMPORAL_HOST_PORT"`
	TemporalNamespace string `mapstructure:"TEMPORAL_NAMESPACE"`
	TaskQueue       string `mapstructure:"TEMPORAL_TASK_QUEUE"`

	ClaimsServiceURL string `mapstructure:"CLAIMS_SERVICE_URL"`
	OpenIMISServiceURL string `mapstructure:"OPENIMIS_SERVICE_URL"`

	SyncInterval time.Duration `mapstructure:"SYNC_INTERVAL"`
	LossRatioReconciliationInterval time.Duration `mapstructure:"LOSS_RATIO_RECONCILIATION_INTERVAL"`
}

// LoadConfig reads configuration from environment variables or a config file.
func LoadConfig() (*Config, error) {
	viper.SetDefault("TEMPORAL_HOST_PORT", "temporal:7233")
	viper.SetDefault("TEMPORAL_NAMESPACE", "default")
	viper.SetDefault("TEMPORAL_TASK_QUEUE", "claims-sync-queue")
	viper.SetDefault("CLAIMS_SERVICE_URL", "http://claims-service:8080")
	viper.SetDefault("OPENIMIS_SERVICE_URL", "http://openimis-service:8081")
	viper.SetDefault("SYNC_INTERVAL", "5m")
	viper.SetDefault("LOSS_RATIO_RECONCILIATION_INTERVAL", "24h")

	viper.AutomaticEnv() // Read from environment variables

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unable to decode into struct, %w", err)
	}

	return &cfg, nil
}

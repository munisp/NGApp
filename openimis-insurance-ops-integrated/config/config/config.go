package config

import (
	"time"

	"github.com/kelseyhightower/envconfig"
)

// Config holds all application configuration.
type Config struct {
	ServiceName string `envconfig:"SERVICE_NAME" default:"actuarial-data-transformer"`
	Environment string `envconfig:"ENVIRONMENT" default:"development"`
	LogLevel    string `envconfig:"LOG_LEVEL" default:"info"`

	// Kafka Configuration
	Kafka struct {
		Brokers []string `envconfig:"KAFKA_BROKERS" required:"true"`
		InputTopic string `envconfig:"KAFKA_INPUT_TOPIC" default:"openimis.claims.events"`
		OutputTopic string `envconfig:"KAFKA_OUTPUT_TOPIC" default:"actuarial.aggregations"`
		GroupID string `envconfig:"KAFKA_GROUP_ID" default:"actuarial-transformer-group"`
	}

	// Data Transformation Configuration
	Data struct {
		LateDataThreshold time.Duration `envconfig:"LATE_DATA_THRESHOLD" default:"24h"` // Time window for considering data "late"
		EnrichmentAPIURL string `envconfig:"ENRICHMENT_API_URL" default:"http://openimis-op-context/api/v1/context"`
	}

	// Aggregation Configuration
	Aggregation struct {
		DailyWindow time.Duration `envconfig:"DAILY_WINDOW" default:"24h"`
		MonthlyWindow time.Duration `envconfig:"MONTHLY_WINDOW" default:"720h"` // Approx 30 days
	}
}

// LoadConfig loads configuration from environment variables.
func LoadConfig() (*Config, error) {
	var cfg Config
	err := envconfig.Process("", &cfg)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

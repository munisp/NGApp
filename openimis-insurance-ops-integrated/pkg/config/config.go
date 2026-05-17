package config

import (
	"log"

	"github.com/spf13/viper"
)

// Config holds the entire application configuration
type Config struct {
	Dapr    DaprConfig    `mapstructure:"dapr"`
	Iceberg IcebergConfig `mapstructure:"iceberg"`
	Temporal TemporalConfig `mapstructure:"temporal"`
	Kafka   KafkaConfig   `mapstructure:"kafka"`
	Metrics MetricsConfig `mapstructure:"metrics"`
}

// DaprConfig holds Dapr-related configuration
type DaprConfig struct {
	ListenAddress string `mapstructure:"listen_address"`
}

// IcebergConfig holds Iceberg-related configuration
type IcebergConfig struct {
	CatalogURI string `mapstructure:"catalog_uri"`
	WarehousePath string `mapstructure:"warehouse_path"`
	Namespace string `mapstructure:"namespace"`
}

// TemporalConfig holds Temporal-related configuration
type TemporalConfig struct {
	HostPort string `mapstructure:"host_port"`
	Namespace string `mapstructure:"namespace"`
	TaskQueue string `mapstructure:"task_queue"`
}

// KafkaConfig holds Kafka (Dapr Pub/Sub) related configuration
type KafkaConfig struct {
	PubsubName string `mapstructure:"pubsub_name"`
	PremiumTopic string `mapstructure:"premium_topic"`
}

// MetricsConfig holds Prometheus metrics configuration
type MetricsConfig struct {
	ListenAddress string `mapstructure:"listen_address"`
}

// LoadConfig reads configuration from file and environment variables
func LoadConfig() *Config {
	viper.SetConfigName("config") // name of config file (without extension)
	viper.SetConfigType("yaml")   // type of config file
	viper.AddConfigPath(".")      // look for config in the current directory
	viper.AddConfigPath("/etc/app/") // look for config in /etc/app/

	// Set default values
	viper.SetDefault("dapr.listen_address", ":8080")
	viper.SetDefault("iceberg.catalog_uri", "http://iceberg-rest-catalog:8080")
	viper.SetDefault("iceberg.warehouse_path", "s3://actuarial-lake/warehouse")
	viper.SetDefault("iceberg.namespace", "actuarial")
	viper.SetDefault("temporal.host_port", "temporal-frontend:7233")
	viper.SetDefault("temporal.namespace", "default")
	viper.SetDefault("temporal.task_queue", "actuarial-queue")
	viper.SetDefault("kafka.pubsub_name", "kafka-pubsub")
	viper.SetDefault("kafka.premium_topic", "premium.calculated")
	viper.SetDefault("metrics.listen_address", ":9090")

	// Read configuration file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Println("Config file not found, using defaults and environment variables.")
		} else {
			log.Fatalf("Fatal error reading config file: %s \n", err)
		}
	}

	// Environment variable binding (e.g., DAPR_LISTEN_ADDRESS)
	viper.SetEnvPrefix("APP")
	viper.AutomaticEnv()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to unmarshal config: %s \n", err)
	}

	return &cfg
}

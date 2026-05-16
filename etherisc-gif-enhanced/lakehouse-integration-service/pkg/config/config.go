package config

import (
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

// Config holds all application configuration settings.
type Config struct {
	Server struct {
		Port string `yaml:"port"`
	} `yaml:"server"`
	Kafka struct {
		BootstrapServers string `yaml:"bootstrap_servers"`
		TopicPolicies    string `yaml:"topic_policies"`
		TopicClaims      string `yaml:"topic_claims"`
	} `yaml:"kafka"`
	Database struct {
		DSN string `yaml:"dsn"` // For simulating Debezium source
	} `yaml:"database"`
	Observability struct {
		MetricsPath string `yaml:"metrics_path"`
	} `yaml:"observability"`
}

// LoadConfig reads configuration from a YAML file.
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = yaml.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}

	// Environment variable overrides
	if os.Getenv("PORT") != "" {
		cfg.Server.Port = os.Getenv("PORT")
	}
	if os.Getenv("KAFKA_BOOTSTRAP_SERVERS") != "" {
		cfg.Kafka.BootstrapServers = os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	}
	if os.Getenv("DB_DSN") != "" {
		cfg.Database.DSN = os.Getenv("DB_DSN")
	}

	log.Printf("Configuration loaded successfully: %+v", cfg)
	return &cfg, nil
}

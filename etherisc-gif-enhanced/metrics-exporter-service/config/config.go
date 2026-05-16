package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// Config holds the application configuration.
type Config struct {
	Server struct {
		Port string `yaml:"port"`
	} `yaml:"server"`
	Metrics struct {
		UpdateIntervalSeconds int `yaml:"update_interval_seconds"`
	} `yaml:"metrics"`
	Integration struct {
		GIFServiceURL      string `yaml:"gif_service_url"`
		PolicyServiceURL   string `yaml:"policy_service_url"`
		ClaimsServiceURL   string `yaml:"claims_service_url"`
		TigerBeetleAPIURL  string `yaml:"tiger_beetle_api_url"`
		LakehouseDBConnStr string `yaml:"lakehouse_db_conn_str"`
	} `yaml:"integration"`
}

// LoadConfig reads the configuration from a YAML file.
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

	return &cfg, nil
}

// DefaultConfig returns a default configuration for the service.
func DefaultConfig() *Config {
	return &Config{
		Server: struct {
			Port string `yaml:"port"`
		}{
			Port: "9100",
		},
		Metrics: struct {
			UpdateIntervalSeconds int `yaml:"update_interval_seconds"`
		}{
			UpdateIntervalSeconds: 60, // Update metrics every 60 seconds
		},
		Integration: struct {
			GIFServiceURL      string `yaml:"gif_service_url"`
			PolicyServiceURL   string `yaml:"policy_service_url"`
			ClaimsServiceURL   string `yaml:"claims_service_url"`
			TigerBeetleAPIURL  string `yaml:"tiger_beetle_api_url"`
			LakehouseDBConnStr string `yaml:"lakehouse_db_conn_str"`
		}{
			GIFServiceURL:      "http://gif-service:8080",
			PolicyServiceURL:   "http://policy-service:8081",
			ClaimsServiceURL:   "http://claims-service:8082",
			TigerBeetleAPIURL:  "http://tigerbeetle-api:8083",
			LakehouseDBConnStr: "postgres://user:password@lakehouse-db:5432/lakehouse",
		},
	}
}

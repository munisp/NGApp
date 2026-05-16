package config

import (
	"log"

	"github.com/spf13/viper"
)

// Config holds the application configuration
type Config struct {
	Kafka struct {
		BootstrapServers string `mapstructure:"bootstrap_servers"`
		Topic            string `mapstructure:"topic"`
		GroupID          string `mapstructure:"group_id"`
	} `mapstructure:"kafka"`
	Service struct {
		Port string `mapstructure:"port"`
	} `mapstructure:"service"`
}

// LoadConfig reads configuration from file or environment variables
func LoadConfig() Config {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./config")
	viper.AddConfigPath(".")

	// Set defaults
	viper.SetDefault("kafka.bootstrap_servers", "localhost:9092")
	viper.SetDefault("kafka.topic", "underwriting-events")
	viper.SetDefault("kafka.group_id", "openimis-risk-model-group")
	viper.SetDefault("service.port", "8081")

	// Read from config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Println("Config file not found, using defaults and environment variables.")
		} else {
			log.Fatalf("Fatal error reading config file: %s \n", err)
		}
	}

	// Read from environment variables
	viper.AutomaticEnv()
	viper.SetEnvPrefix("OC") // OpenIMIS Consumer
	
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to unmarshal config: %v \n", err)
	}

	return cfg
}

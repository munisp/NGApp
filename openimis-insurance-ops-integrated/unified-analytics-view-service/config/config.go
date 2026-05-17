package config

import (
	"log"

	"github.com/spf13/viper"
)

// Config holds the application configuration.
type Config struct {
	Server struct {
		Port string `mapstructure:"port"`
	} `mapstructure:"server"`
	Temporal struct {
		HostPort string `mapstructure:"host_port"`
		Namespace string `mapstructure:"namespace"`
	} `mapstructure:"temporal"`
	Kafka struct {
		Brokers []string `mapstructure:"brokers"`
	} `mapstructure:"kafka"`
	LogLevel string `mapstructure:"log_level"`
}

// LoadConfig reads configuration from file or environment variables.
func LoadConfig() *Config {
	viper.SetConfigName("config") // name of config file (without extension)
	viper.SetConfigType("yaml")   // type of the config file
	viper.AddConfigPath("./config") // path to look for the config file in
	viper.AddConfigPath(".")      // optionally look for config in the working directory
	viper.AutomaticEnv()          // read in environment variables that match

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Println("Config file not found, using defaults/environment variables.")
		} else {
			log.Fatalf("Fatal error reading config file: %s \n", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Unable to decode into struct: %s \n", err)
	}

	// Set defaults if not found
	if cfg.Server.Port == "" {
		cfg.Server.Port = "8080"
	}
	if cfg.Temporal.HostPort == "" {
		cfg.Temporal.HostPort = "localhost:7233"
	}
	if cfg.Temporal.Namespace == "" {
		cfg.Temporal.Namespace = "default"
	}
	if len(cfg.Kafka.Brokers) == 0 {
		cfg.Kafka.Brokers = []string{"localhost:9092"}
	}
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}

	return &cfg
}

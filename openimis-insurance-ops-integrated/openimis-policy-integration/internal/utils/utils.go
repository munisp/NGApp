package utils

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"openimis-policy-integration/configs"
)

// LoadConfig loads configuration from file and environment variables.
func LoadConfig() (*configs.Config, error) {
	viper.SetConfigName("config") // name of config file (without extension)
	viper.SetConfigType("yaml")   // type of the config file
	viper.AddConfigPath("./configs") // path to look for the config file in
	viper.AutomaticEnv()          // read in environment variables that match

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found; ignore error if desired
			fmt.Println("Warning: Config file not found. Using environment variables and defaults.")
		} else {
			return nil, fmt.Errorf("fatal error reading config file: %w", err)
		}
	}

	var cfg configs.Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unable to decode into struct: %w", err)
	}

	// Set defaults if not loaded from file/env
	if cfg.Temporal.TaskQueue == "" {
		cfg.Temporal.TaskQueue = "openimis-task-queue"
	}
	if cfg.Temporal.HostPort == "" {
		cfg.Temporal.HostPort = "localhost:7233"
	}
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8080
	}
	if cfg.OpenIMIS.BaseURL == "" {
		cfg.OpenIMIS.BaseURL = "http://localhost:8081" // Mock OpenIMIS URL
	}
	if cfg.OpenIMIS.Timeout == 0 {
		cfg.OpenIMIS.Timeout = 10
	}

	return &cfg, nil
}

// InitLogger initializes a structured logger with trace ID support (mocked for now).
func InitLogger() *zap.Logger {
	config := zap.NewProductionConfig()
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.MessageKey = "message"
	config.EncoderConfig.LevelKey = "level"
	config.EncoderConfig.CallerKey = "caller"
	config.EncoderConfig.StacktraceKey = "stacktrace"

	logger, err := config.Build()
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	return logger
}

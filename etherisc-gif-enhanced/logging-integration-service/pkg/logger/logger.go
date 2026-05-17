package logger

import (
	"context"
	"os"
	"time"

	"github.com/etherisc/logging-integration-service/pkg/config"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// InitLogger initializes the zerolog logger with structured logging configuration.
func InitLogger(cfg *config.Config) {
	// Set global log level
	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	// Configure time format for logs
	zerolog.TimeFieldFormat = time.RFC3339Nano

	// Configure output format
	if cfg.LogFormat == "console" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	} else {
		// Default to JSON for structured logging (OpenSearch compatible)
		log.Logger = zerolog.New(os.Stderr).With().Timestamp().Logger()
	}

	// Add service name to all logs
	log.Logger = log.With().Str("service", cfg.ServiceName).Logger()
}

// ContextLoggerKey is the key used to store the request-scoped logger in the context.
type contextKey string
const ContextLoggerKey contextKey = "requestLogger"

// Log is the global logger instance.
var Log zerolog.Logger = log.Logger

// GetLoggerFromContext retrieves the request-scoped logger from the context.
// Falls back to the global logger if not found.
func GetLoggerFromContext(ctx context.Context) zerolog.Logger {
	if l, ok := ctx.Value(ContextLoggerKey).(zerolog.Logger); ok {
		return l
	}
	return Log
}

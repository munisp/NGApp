package logging

import (
	"os"

	"github.com/sirupsen/logrus"
)

// Logger is the application-wide structured logger.
var Logger *logrus.Logger

func init() {
	Logger = logrus.New()
	Logger.SetFormatter(&logrus.JSONFormatter{})
	Logger.SetOutput(os.Stdout)
	Logger.SetLevel(logrus.InfoLevel)
}

// WithTraceID returns a new entry with the trace ID field.
func WithTraceID(traceID string) *logrus.Entry {
	return Logger.WithField("trace_id", traceID)
}

// SetLevel sets the logging level based on a string.
func SetLevel(level string) {
	lvl, err := logrus.ParseLevel(level)
	if err != nil {
		Logger.Warnf("Invalid log level '%s', defaulting to 'info'", level)
		lvl = logrus.InfoLevel
	}
	Logger.SetLevel(lvl)
}

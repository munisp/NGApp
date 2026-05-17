package temporal

import (
	"github.com/sirupsen/logrus"
)

// TemporalLogger implements the go.temporal.io/sdk/log.Logger interface using logrus.
type TemporalLogger struct {
	*logrus.Entry
}

// NewTemporalLogger creates a new TemporalLogger instance.
func NewTemporalLogger(entry *logrus.Entry) *TemporalLogger {
	return &TemporalLogger{Entry: entry}
}

// Debug logs a message at Debug level.
func (l *TemporalLogger) Debug(msg string, keyvals ...interface{}) {
	l.log(logrus.DebugLevel, msg, keyvals)
}

// Info logs a message at Info level.
func (l *TemporalLogger) Info(msg string, keyvals ...interface{}) {
	l.log(logrus.InfoLevel, msg, keyvals)
}

// Warn logs a message at Warn level.
func (l *TemporalLogger) Warn(msg string, keyvals ...interface{}) {
	l.log(logrus.WarnLevel, msg, keyvals)
}

// Error logs a message at Error level.
func (l *TemporalLogger) Error(msg string, keyvals ...interface{}) {
	l.log(logrus.ErrorLevel, msg, keyvals)
}

// log is a helper function to process keyvals into logrus fields.
func (l *TemporalLogger) log(level logrus.Level, msg string, keyvals []interface{}) {
	fields := logrus.Fields{}
	for i := 0; i < len(keyvals); i += 2 {
		key := keyvals[i]
		var val interface{}
		if i+1 < len(keyvals) {
			val = keyvals[i+1]
		}
		if k, ok := key.(string); ok {
			fields[k] = val
		} else {
			// Handle non-string keys by converting them to a string
			fields["key_non_string"] = key
			fields["value_non_string"] = val
		}
	}
	l.WithFields(fields).Log(level, msg)
}

// With adds key-value pairs to the logger context.
func (l *TemporalLogger) With(keyvals ...interface{}) *TemporalLogger {
	fields := logrus.Fields{}
	for i := 0; i < len(keyvals); i += 2 {
		key := keyvals[i]
		var val interface{}
		if i+1 < len(keyvals) {
			val = keyvals[i+1]
		}
		if k, ok := key.(string); ok {
			fields[k] = val
		} else {
			fields["key_non_string"] = key
			fields["value_non_string"] = val
		}
	}
	return &TemporalLogger{Entry: l.Entry.WithFields(fields)}
}

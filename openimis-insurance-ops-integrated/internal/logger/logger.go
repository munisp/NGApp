package logger

import (
	"fmt"

	"github.com/sirupsen/logrus"
)

// NewTemporalLogger wraps logrus to satisfy Temporal's Logger interface
type TemporalLogger struct {
	*logrus.Logger
}

func NewTemporalLogger(l *logrus.Logger) *TemporalLogger {
	return &TemporalLogger{l}
}

func (l *TemporalLogger) Debug(msg string, keyvals ...interface{}) {
	l.WithFields(l.keyvalsToFields(keyvals)).Debug(msg)
}

func (l *TemporalLogger) Info(msg string, keyvals ...interface{}) {
	l.WithFields(l.keyvalsToFields(keyvals)).Info(msg)
}

func (l *TemporalLogger) Warn(msg string, keyvals ...interface{}) {
	l.WithFields(l.keyvalsToFields(keyvals)).Warn(msg)
}

func (l *TemporalLogger) Error(msg string, keyvals ...interface{}) {
	l.WithFields(l.keyvalsToFields(keyvals)).Error(msg)
}

func (l *TemporalLogger) keyvalsToFields(keyvals []interface{}) logrus.Fields {
	fields := make(logrus.Fields)
	for i := 0; i < len(keyvals); i += 2 {
		key := fmt.Sprintf("%v", keyvals[i])
		if i+1 < len(keyvals) {
			fields[key] = keyvals[i+1]
		} else {
			fields[key] = nil
		}
	}
	return fields
}

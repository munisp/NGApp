package service

import (
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"go.uber.org/zap"
)

// TemporalClient wraps the Temporal client.
type TemporalClient struct {
	client.Client
	logger *zap.Logger
}

// TemporalWorker wraps the Temporal worker.
type TemporalWorker interface {
	Stop()
}

// NewTemporalClient creates a new Temporal client.
func NewTemporalClient(hostPort string) (*TemporalClient, error) {
	logger, _ := zap.NewDevelopment()
	c, err := client.Dial(client.Options{
		HostPort: hostPort,
		Logger:   logger,
	})
	if err != nil {
		return nil, err
	}
	return &TemporalClient{Client: c, logger: logger}, nil
}

// NewWorker creates a new Temporal worker.
func (tc *TemporalClient) NewWorker(taskQueue string, logger *zap.Logger) worker.Worker {
	return worker.New(tc.Client, taskQueue, worker.Options{
		Logger: logger,
	})
}

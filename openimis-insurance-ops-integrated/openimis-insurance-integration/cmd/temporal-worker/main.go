package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"openimis-insurance-integration/internal/metrics"
	"openimis-insurance-integration/internal/temporal"
	"openimis-insurance-integration/pkg/config"
)

const TaskQueue = "ACTUARIAL_EVENTS_TASK_QUEUE"

func init() {
	// Set up logging
	logrus.SetFormatter(&logrus.JSONFormatter{})
	logrus.SetOutput(os.Stdout)
	logrus.SetLevel(logrus.InfoLevel)
}

func main() {
	cfg := config.LoadConfig()
	if level, err := logrus.ParseLevel(cfg.LogLevel); err == nil {
		logrus.SetLevel(level)
	}

	log := logrus.WithField("component", "TemporalWorker")
	log.Infof("Starting Temporal Worker. Temporal Host: %s, Namespace: %s", cfg.TemporalHostPort, cfg.TemporalNamespace)

	// Initialize Metrics
	metrics := metrics.NewMetrics("temporal_worker")
	metrics.StartMetricsServer(":9094", log.WithField("service", "metrics"))

	// Create the client object
	c, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHostPort,
		Namespace: cfg.TemporalNamespace,
		Logger:    temporal.NewTemporalLogger(log),
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer c.Close()

	// Create the worker
	w := worker.New(c, TaskQueue, worker.Options{})

	// Register workflows and activities
	w.RegisterWorkflow(temporal.ActuarialEventWorkflow)
	activities := temporal.NewActivities(metrics)
	w.RegisterActivity(activities)

	// Start the worker
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigchan
		log.Info("Received shutdown signal, stopping worker...")
		cancel()
	}()

	log.Info("Temporal Worker started. Listening on Task Queue: " + TaskQueue)
	err = w.Run(ctx)
	if err != nil {
		log.Fatalf("Worker failed to start or run: %v", err)
	}
}

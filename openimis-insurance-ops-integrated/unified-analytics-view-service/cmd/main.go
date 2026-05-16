package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/client"
	"unified-analytics-view-service/api"
	"unified-analytics-view-service/config"
	"unified-analytics-view-service/pkg/integrations"
	"unified-analytics-view-service/pkg/service"
	"unified-analytics-view-service/pkg/temporal"
)

func main() {
	// 1. Load Configuration
	cfg := config.LoadConfig()

	// 2. Setup Structured Logging
	logLevel, err := logrus.ParseLevel(cfg.LogLevel)
	if err != nil {
		logLevel = logrus.InfoLevel
	}
	logger := logrus.New()
	logger.SetLevel(logLevel)
	logger.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339Nano,
	})
	entry := logrus.NewEntry(logger).WithField("service", "unified-analytics-view-service")

	// 3. Initialize Integrations
	imisClient := integrations.NewOpenIMISClient()
	dataLakeClient := integrations.NewDataLakeClient()

	kafkaProducer, err := integrations.NewKafkaProducer(cfg.Kafka.Brokers, entry)
	if err != nil {
		entry.WithError(err).Fatal("Failed to initialize Kafka Producer")
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.Temporal.HostPort,
		Namespace: cfg.Temporal.Namespace,
	})
	if err != nil {
		entry.WithError(err).Fatal("Failed to initialize Temporal Client")
	}
	defer temporalClient.Close()

	// 4. Initialize Service Layer
	analyticsService := service.NewAnalyticsService(imisClient, kafkaProducer, dataLakeClient, entry)

	// 5. Start Temporal Worker in a goroutine
	go temporal.StartWorker(temporalClient, analyticsService, entry)

	// 6. Setup REST API Server
	router := api.NewRouter(analyticsService, entry)
	server := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// 7. Start HTTP Server in a goroutine
	go func() {
		entry.Infof("Starting HTTP server on port %s", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			entry.WithError(err).Fatal("HTTP server failed to start")
		}
	}()

	// 8. Schedule Initial Report (Example)
	scheduleID := "monthly-regulatory-report"
	cronSchedule := "0 0 1 * *" // Run at 00:00 on the 1st of every month
	_, err = temporal.StartScheduledReportWorkflow(temporalClient, scheduleID, cronSchedule, temporal.ReportGenerationWorkflowInput{
		ReportPeriod: "monthly",
		RecipientEmail: "actuarial_team@example.com",
	})
	if err != nil {
		entry.WithError(err).Error("Failed to start scheduled report workflow")
	} else {
		entry.Infof("Scheduled report workflow started with ID: %s", scheduleID)
	}

	// 9. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	entry.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		entry.WithError(err).Fatal("Server forced to shutdown")
	}

	entry.Info("Server exiting")
}

package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/etherisc/metrics-exporter-service/config"
	"github.com/etherisc/metrics-exporter-service/metrics"
	"github.com/etherisc/metrics-exporter-service/service"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const configPath = "config/config.yaml"

func main() {
	// 1. Load Configuration
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Printf("Warning: Could not load config from %s: %v. Using default configuration.", configPath, err)
		cfg = config.DefaultConfig()
	}

	// 2. Initialize Components
	exporterMetrics := metrics.NewExporterMetrics()
	dataService := service.NewDataService(cfg)
	metricsUpdater := service.NewMetricsUpdater(cfg, dataService, exporterMetrics)

	// 3. Start Metrics Updater in a goroutine
	go metricsUpdater.Start()

	// 4. Setup HTTP Server for Prometheus Metrics
	http.Handle("/metrics", promhttp.Handler())
	addr := ":" + cfg.Server.Port
	log.Printf("Starting metrics server on %s/metrics", addr)

	server := &http.Server{Addr: addr}

	// 5. Handle graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on %s: %v\n", addr, err)
		}
	}()

	<-stop
	log.Println("Shutting down server...")
	metricsUpdater.Stop()
	// In a real application, you would add a context with timeout to server.Shutdown()
	log.Println("Server gracefully stopped.")
}

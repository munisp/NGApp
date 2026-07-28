package main

import (
	"log"
	"net/http"
	"time"

	"gif-metrics-service/internal/metrics"
	"gif-metrics-service/pkg/blockchain"
	"gif-metrics-service/pkg/reinsurance"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	// The port on which the Prometheus metrics will be exposed.
	metricsPort = ":9090"
)

func main() {
	// 1. Initialize Prometheus Metrics
	m := metrics.NewMetrics()
	log.Println("Prometheus metrics initialized.")

	// 2. Initialize Mock Services (In a real application, these would be actual clients)
	bcService := blockchain.NewMockService(m)
	riService := reinsurance.NewMockService(m)
	log.Println("Mock services initialized.")

	// 3. Start a goroutine to simulate data collection and metric updates
	go func() {
		for {
			// Simulate blockchain and reinsurance activity
			bcService.SimulateActivity()
			riService.SimulateActivity()

			// Update Gauges that represent current state
			bcService.UpdateStateGauges()
			riService.UpdateStateGauges()

			// Sleep for a short duration before the next update
			time.Sleep(5 * time.Second)
		}
	}()
	log.Println("Metric simulation started.")

	// 4. Expose the metrics endpoint
	http.Handle("/metrics", promhttp.Handler())
	log.Printf("Starting metrics server on %s/metrics", metricsPort)
	log.Fatal(http.ListenAndServe(metricsPort, nil))
}

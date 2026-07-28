package service

import (
	"context"
	"log"

	"time"

	"github.com/etherisc/metrics-exporter-service/config"
	"github.com/etherisc/metrics-exporter-service/metrics"
)

// MetricsUpdater is responsible for periodically fetching data and updating Prometheus metrics.
type MetricsUpdater struct {
	cfg         *config.Config
	dataService *DataService
	metrics     *metrics.ExporterMetrics
	stopChan    chan struct{}
}

// NewMetricsUpdater creates a new MetricsUpdater instance.
func NewMetricsUpdater(cfg *config.Config, ds *DataService, m *metrics.ExporterMetrics) *MetricsUpdater {
	return &MetricsUpdater{
		cfg:         cfg,
		dataService: ds,
		metrics:     m,
		stopChan:    make(chan struct{}),
	}
}

// Start begins the periodic metric update loop.
func (mu *MetricsUpdater) Start() {
	log.Printf("Starting metrics updater with interval: %d seconds", mu.cfg.Metrics.UpdateIntervalSeconds)
	ticker := time.NewTicker(time.Duration(mu.cfg.Metrics.UpdateIntervalSeconds) * time.Second)
	defer ticker.Stop()

	// Run initial update immediately
	mu.updateMetrics()

	for {
		select {
		case <-ticker.C:
			mu.updateMetrics()
		case <-mu.stopChan:
			log.Println("Metrics updater stopped.")
			return
		}
	}
}

// Stop signals the updater to stop.
func (mu *MetricsUpdater) Stop() {
	close(mu.stopChan)
}

// updateMetrics fetches data from services and updates all Prometheus metrics.
func (mu *MetricsUpdater) updateMetrics() {
	ctx := context.Background()
	log.Println("Updating metrics...")

	// 1. Blockchain Operations Dashboard
	mu.updateBlockchainMetrics(ctx)

	// 2. Reinsurance Dashboard
	mu.updateReinsuranceMetrics(ctx)

	// 3. Oracle Dashboard
	mu.updateOracleMetrics(ctx)

	// 4. Integration Health (as a general check)
	mu.updateIntegrationHealth(ctx)

	log.Println("Metrics update complete.")
}

func (mu *MetricsUpdater) updateBlockchainMetrics(ctx context.Context) {
	stats, err := mu.dataService.FetchBlockchainStats(ctx)
	if err != nil {
		log.Printf("Error fetching blockchain stats: %v", err)
		return
	}

	// Policy Creation Rate (per minute)
	// Assuming the update interval is the sampling period
	rateFactor := 60.0 / float64(mu.cfg.Metrics.UpdateIntervalSeconds)
	mu.metrics.PolicyCreationRate.Set(float64(stats.PolicyCreations) * rateFactor)

	// Claim Trigger Rate (per minute)
	mu.metrics.ClaimTriggerRate.Set(float64(stats.ClaimTriggers) * rateFactor)

	// Oracle Submission Rate (per minute)
	mu.metrics.OracleSubmissionRate.Set(float64(stats.OracleSubmissions) * rateFactor)

	// Gas Costs Total
	for label, cost := range stats.GasCosts {
		txType := label[:len(label)-4] // e.g., "policy_creation"
		currency := label[len(label)-3:] // e.g., "eth"
		mu.metrics.GasCostsTotal.WithLabelValues(txType, currency).Add(cost)
	}

	// Transaction Success Rate
	successRate := 0.0
	if stats.TotalTransactions > 0 {
		successRate = float64(stats.SuccessfulTransactions) / float64(stats.TotalTransactions)
	}
	mu.metrics.TxSuccessRate.Set(successRate)
}

func (mu *MetricsUpdater) updateReinsuranceMetrics(ctx context.Context) {
	stats, err := mu.dataService.FetchReinsuranceStats(ctx)
	if err != nil {
		log.Printf("Error fetching reinsurance stats: %v", err)
		return
	}

	// Ceded Premiums Total
	mu.metrics.CededPremiumsTotal.Set(stats.CededPremiums)

	// Treaty Utilization
	utilization := 0.0
	if stats.TreatyCapacity > 0 {
		utilization = stats.TreatyUsed / stats.TreatyCapacity
	}
	mu.metrics.TreatyUtilization.Set(utilization)

	// Reinsurer Balances
	for label, balance := range stats.ReinsurerBalances {
		reinsurerID := label[:len(label)-4] // e.g., "reinsurer_a"
		currency := label[len(label)-3:] // e.g., "usd"
		mu.metrics.ReinsurerBalances.WithLabelValues(reinsurerID, currency).Set(balance)
	}

	// Facultative Placements Total
	mu.metrics.FacultativePlacementsTotal.Set(float64(stats.FacultativePlacements))
}

func (mu *MetricsUpdater) updateOracleMetrics(ctx context.Context) {
	stats, err := mu.dataService.FetchOracleStats(ctx)
	if err != nil {
		log.Printf("Error fetching oracle stats: %v", err)
		return
	}

	// Data Fetch Latency Seconds
	mu.metrics.DataFetchLatencySeconds.Set(stats.DataFetchLatency.Seconds())

	// Oracle Submission Success Rate
	successRate := 0.0
	if stats.TotalSubmissions > 0 {
		successRate = float64(stats.SuccessfulSubmissions) / float64(stats.TotalSubmissions)
	}
	mu.metrics.OracleSubmissionSuccessRate.Set(successRate)

	// External API Health
	for apiName, isHealthy := range stats.ExternalAPIHealth {
		healthValue := 0.0
		if isHealthy {
			healthValue = 1.0
		}
		mu.metrics.ExternalAPIHealth.WithLabelValues(apiName).Set(healthValue)
	}
}

func (mu *MetricsUpdater) updateIntegrationHealth(ctx context.Context) {
	// This is a general check, not tied to a specific dashboard metric, but useful for observability.
	// We can use the ExternalAPIHealth metric for this, or create a new one if needed.
	// For simplicity, we'll just log the health status for now.
	health := mu.dataService.GetIntegrationHealth(ctx)
	for service, isHealthy := range health {
		status := "DOWN"
		if isHealthy {
			status = "UP"
		}
		log.Printf("Integration Health: %s is %s", service, status)
	}
}

package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ExporterMetrics holds all the Prometheus metrics for the service.
type ExporterMetrics struct {
	// --- Blockchain Operations Dashboard ---
	PolicyCreationRate prometheus.Gauge
	ClaimTriggerRate   prometheus.Gauge
	OracleSubmissionRate prometheus.Gauge
	GasCostsTotal      *prometheus.CounterVec
	TxSuccessRate      prometheus.Gauge

	// --- Reinsurance Dashboard ---
	CededPremiumsTotal prometheus.Gauge
	TreatyUtilization  prometheus.Gauge
	ReinsurerBalances  *prometheus.GaugeVec
	FacultativePlacementsTotal prometheus.Gauge

	// --- Oracle Dashboard ---
	DataFetchLatencySeconds prometheus.Gauge
	OracleSubmissionSuccessRate prometheus.Gauge
	ExternalAPIHealth       *prometheus.GaugeVec
}

// NewExporterMetrics initializes and registers all Prometheus metrics.
func NewExporterMetrics() *ExporterMetrics {
	return &ExporterMetrics{
		// --- Blockchain Operations Dashboard ---
		PolicyCreationRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_blockchain_policy_creation_rate",
			Help: "Rate of new policy creation per minute.",
		}),
		ClaimTriggerRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_blockchain_claim_trigger_rate",
			Help: "Rate of claim triggers per minute.",
		}),
		OracleSubmissionRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_blockchain_oracle_submission_rate",
			Help: "Rate of oracle submissions per minute.",
		}),
		GasCostsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_blockchain_gas_costs_total",
			Help: "Total gas costs incurred, labeled by transaction type and currency.",
		}, []string{"tx_type", "currency"}),
		TxSuccessRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_blockchain_transaction_success_rate",
			Help: "Percentage of successful blockchain transactions.",
		}),

		// --- Reinsurance Dashboard ---
		CededPremiumsTotal: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_reinsurance_ceded_premiums_total",
			Help: "Total value of ceded premiums.",
		}),
		TreatyUtilization: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_reinsurance_treaty_utilization",
			Help: "Percentage of treaty capacity utilized.",
		}),
		ReinsurerBalances: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "gif_reinsurance_reinsurer_balance",
			Help: "Current balance with each reinsurer.",
		}, []string{"reinsurer_id", "currency"}),
		FacultativePlacementsTotal: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_reinsurance_facultative_placements_total",
			Help: "Total number of facultative placements.",
		}),

		// --- Oracle Dashboard ---
		DataFetchLatencySeconds: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_oracle_data_fetch_latency_seconds",
			Help: "Latency of external data fetching for oracle in seconds.",
		}),
		OracleSubmissionSuccessRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_oracle_submission_success_rate",
			Help: "Percentage of successful oracle submissions.",
		}),
		ExternalAPIHealth: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "gif_oracle_external_api_health",
			Help: "Health status of external APIs (1=up, 0=down).",
		}, []string{"api_name"}),
	}
}

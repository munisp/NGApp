package observability

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// PaymentMetrics holds all Prometheus metrics for the payment switch
type PaymentMetrics struct {
	// Transaction metrics
	TransactionTotal       *prometheus.CounterVec
	TransactionDuration    *prometheus.HistogramVec
	TransactionInFlight    *prometheus.GaugeVec
	TransactionAmount      *prometheus.HistogramVec
	TransactionSuccessRate *prometheus.GaugeVec

	// TPS metrics (calculated)
	CurrentTPS *prometheus.GaugeVec

	// Participant metrics
	ParticipantHealth     *prometheus.GaugeVec
	ParticipantLatency    *prometheus.HistogramVec
	ParticipantTPS        *prometheus.GaugeVec
	ParticipantSuccessRate *prometheus.GaugeVec

	// Settlement metrics
	SettlementPending     prometheus.Gauge
	SettlementCompleted   *prometheus.CounterVec
	SettlementAmount      *prometheus.HistogramVec
	SettlementDuration    *prometheus.HistogramVec

	// Fraud metrics
	FraudAlertsOpen       prometheus.Gauge
	FraudAlertsCritical   prometheus.Gauge
	FraudAlertsResolved   *prometheus.CounterVec
	FraudScoreDistribution *prometheus.HistogramVec
	FraudBlockRate        prometheus.Gauge

	// System metrics
	KafkaLag              *prometheus.GaugeVec
	DeltaLakeWriteLatency *prometheus.HistogramVec
	CacheHitRate          prometheus.Gauge
	APILatency            *prometheus.HistogramVec

	// Kill switch metrics
	KillSwitchActive      *prometheus.GaugeVec
}

var (
	metrics     *PaymentMetrics
	metricsOnce sync.Once
)

// GetMetrics returns the singleton PaymentMetrics instance
func GetMetrics() *PaymentMetrics {
	metricsOnce.Do(func() {
		metrics = initMetrics()
	})
	return metrics
}

func initMetrics() *PaymentMetrics {
	return &PaymentMetrics{
		// Transaction metrics
		TransactionTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "payment_switch_transactions_total",
				Help: "Total number of transactions processed",
			},
			[]string{"status", "type", "currency", "payer", "payee"},
		),
		TransactionDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_transaction_duration_seconds",
				Help:    "Transaction processing duration in seconds",
				Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"status", "type"},
		),
		TransactionInFlight: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_transactions_in_flight",
				Help: "Number of transactions currently being processed",
			},
			[]string{"type"},
		),
		TransactionAmount: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_transaction_amount",
				Help:    "Transaction amount distribution",
				Buckets: []float64{1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000},
			},
			[]string{"currency", "type"},
		),
		TransactionSuccessRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_transaction_success_rate",
				Help: "Transaction success rate (0-1)",
			},
			[]string{"type"},
		),

		// TPS metrics
		CurrentTPS: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_current_tps",
				Help: "Current transactions per second",
			},
			[]string{"type"},
		),

		// Participant metrics
		ParticipantHealth: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_participant_health",
				Help: "Participant health status (0=down, 1=degraded, 2=healthy)",
			},
			[]string{"participant_id", "participant_name", "type"},
		),
		ParticipantLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_participant_latency_seconds",
				Help:    "Participant response latency in seconds",
				Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
			},
			[]string{"participant_id"},
		),
		ParticipantTPS: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_participant_tps",
				Help: "Transactions per second per participant",
			},
			[]string{"participant_id", "participant_name"},
		),
		ParticipantSuccessRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_participant_success_rate",
				Help: "Success rate per participant (0-1)",
			},
			[]string{"participant_id", "participant_name"},
		),

		// Settlement metrics
		SettlementPending: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "payment_switch_settlements_pending",
				Help: "Number of pending settlements",
			},
		),
		SettlementCompleted: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "payment_switch_settlements_completed_total",
				Help: "Total number of completed settlements",
			},
			[]string{"status"},
		),
		SettlementAmount: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_settlement_amount",
				Help:    "Settlement amount distribution",
				Buckets: []float64{1e6, 1e7, 1e8, 1e9, 1e10},
			},
			[]string{"currency"},
		),
		SettlementDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_settlement_duration_hours",
				Help:    "Settlement processing duration in hours",
				Buckets: []float64{0.5, 1, 2, 4, 8, 12, 24, 48},
			},
			[]string{"type"},
		),

		// Fraud metrics
		FraudAlertsOpen: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "payment_switch_fraud_alerts_open",
				Help: "Number of open fraud alerts",
			},
		),
		FraudAlertsCritical: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "payment_switch_fraud_alerts_critical",
				Help: "Number of critical fraud alerts",
			},
		),
		FraudAlertsResolved: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "payment_switch_fraud_alerts_resolved_total",
				Help: "Total number of resolved fraud alerts",
			},
			[]string{"resolution"},
		),
		FraudScoreDistribution: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_fraud_score",
				Help:    "Fraud score distribution",
				Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
			},
			[]string{"decision"},
		),
		FraudBlockRate: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "payment_switch_fraud_block_rate",
				Help: "Fraud block rate (0-1)",
			},
		),

		// System metrics
		KafkaLag: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_kafka_consumer_lag",
				Help: "Kafka consumer lag",
			},
			[]string{"topic", "partition", "consumer_group"},
		),
		DeltaLakeWriteLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_delta_lake_write_latency_seconds",
				Help:    "Delta Lake write latency in seconds",
				Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
			},
			[]string{"table", "layer"},
		),
		CacheHitRate: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "payment_switch_cache_hit_rate",
				Help: "Cache hit rate (0-1)",
			},
		),
		APILatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "payment_switch_api_latency_seconds",
				Help:    "API endpoint latency in seconds",
				Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
			},
			[]string{"endpoint", "method", "status"},
		),

		// Kill switch metrics
		KillSwitchActive: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "payment_switch_kill_switch_active",
				Help: "Kill switch active status (0=inactive, 1=active)",
			},
			[]string{"switch_id", "type", "scope"},
		),
	}
}

// RecordTransaction records a transaction metric
func (m *PaymentMetrics) RecordTransaction(status, txType, currency, payer, payee string, duration time.Duration, amount float64) {
	m.TransactionTotal.WithLabelValues(status, txType, currency, payer, payee).Inc()
	m.TransactionDuration.WithLabelValues(status, txType).Observe(duration.Seconds())
	m.TransactionAmount.WithLabelValues(currency, txType).Observe(amount)
}

// RecordParticipantHealth records participant health status
func (m *PaymentMetrics) RecordParticipantHealth(participantID, participantName, pType string, health int) {
	m.ParticipantHealth.WithLabelValues(participantID, participantName, pType).Set(float64(health))
}

// RecordParticipantLatency records participant response latency
func (m *PaymentMetrics) RecordParticipantLatency(participantID string, latency time.Duration) {
	m.ParticipantLatency.WithLabelValues(participantID).Observe(latency.Seconds())
}

// RecordFraudScore records a fraud score
func (m *PaymentMetrics) RecordFraudScore(score float64, decision string) {
	m.FraudScoreDistribution.WithLabelValues(decision).Observe(score)
}

// RecordAPILatency records API endpoint latency
func (m *PaymentMetrics) RecordAPILatency(endpoint, method, status string, latency time.Duration) {
	m.APILatency.WithLabelValues(endpoint, method, status).Observe(latency.Seconds())
}

// SetKillSwitchStatus sets kill switch status
func (m *PaymentMetrics) SetKillSwitchStatus(switchID, switchType, scope string, active bool) {
	value := 0.0
	if active {
		value = 1.0
	}
	m.KillSwitchActive.WithLabelValues(switchID, switchType, scope).Set(value)
}

// MetricsServer runs the Prometheus metrics HTTP server
type MetricsServer struct {
	server *http.Server
}

// NewMetricsServer creates a new metrics server
func NewMetricsServer(addr string) *MetricsServer {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})

	return &MetricsServer{
		server: &http.Server{
			Addr:    addr,
			Handler: mux,
		},
	}
}

// Start starts the metrics server
func (s *MetricsServer) Start() error {
	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the metrics server
func (s *MetricsServer) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}

// TPSCalculator calculates TPS from transaction counts
type TPSCalculator struct {
	mu           sync.Mutex
	counts       map[string]int64
	lastCounts   map[string]int64
	lastCalcTime time.Time
	metrics      *PaymentMetrics
}

// NewTPSCalculator creates a new TPS calculator
func NewTPSCalculator(metrics *PaymentMetrics) *TPSCalculator {
	return &TPSCalculator{
		counts:       make(map[string]int64),
		lastCounts:   make(map[string]int64),
		lastCalcTime: time.Now(),
		metrics:      metrics,
	}
}

// IncrementCount increments the transaction count for a type
func (c *TPSCalculator) IncrementCount(txType string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counts[txType]++
}

// Calculate calculates and updates TPS metrics
func (c *TPSCalculator) Calculate() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(c.lastCalcTime).Seconds()
	if elapsed < 1 {
		return
	}

	for txType, count := range c.counts {
		lastCount := c.lastCounts[txType]
		tps := float64(count-lastCount) / elapsed
		c.metrics.CurrentTPS.WithLabelValues(txType).Set(tps)
		c.lastCounts[txType] = count
	}

	c.lastCalcTime = now
}

// StartTPSCalculator starts a background goroutine to calculate TPS
func StartTPSCalculator(ctx context.Context, calculator *TPSCalculator) {
	ticker := time.NewTicker(1 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				calculator.Calculate()
			}
		}
	}()
}

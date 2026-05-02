// Package observability provides Prometheus exporter for TigerBeetle
package observability

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// TigerBeetleExporter exports TigerBeetle metrics to Prometheus
type TigerBeetleExporter struct {
	client     *http.Client
	clusterURL string
	mu         sync.RWMutex

	// Cluster metrics
	clusterHealth  prometheus.Gauge
	clusterNodes   prometheus.Gauge
	clusterLeader  *prometheus.GaugeVec
	replicationLag prometheus.Gauge

	// Account metrics
	accountsTotal  prometheus.Gauge
	accountsActive prometheus.Gauge
	accountBalance *prometheus.GaugeVec

	// Transfer metrics
	transfersTotal    *prometheus.CounterVec
	transfersInFlight prometheus.Gauge
	transferLatency   *prometheus.HistogramVec
	transferAmount    *prometheus.HistogramVec
	transferRate      prometheus.Gauge

	// Two-phase commit metrics
	pendingTransfers prometheus.Gauge
	postedTransfers  *prometheus.CounterVec
	voidedTransfers  *prometheus.CounterVec

	// Performance metrics
	batchSize    *prometheus.HistogramVec
	ioLatency    *prometheus.HistogramVec
	cacheHitRate prometheus.Gauge
	diskUsage    prometheus.Gauge
	memoryUsage  prometheus.Gauge

	// Error metrics
	errors   *prometheus.CounterVec
	timeouts *prometheus.CounterVec
}

// NewTigerBeetleExporter creates a new TigerBeetle exporter
func NewTigerBeetleExporter(clusterURL string) *TigerBeetleExporter {
	return &TigerBeetleExporter{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		clusterURL: clusterURL,

		// Cluster metrics
		clusterHealth: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_cluster_health",
			Help: "TigerBeetle cluster health status (0=unhealthy, 1=healthy)",
		}),
		clusterNodes: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_cluster_nodes_total",
			Help: "Total number of nodes in TigerBeetle cluster",
		}),
		clusterLeader: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "tigerbeetle_cluster_leader",
			Help: "Current cluster leader (1=leader, 0=follower)",
		}, []string{"node_id"}),
		replicationLag: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_replication_lag_bytes",
			Help: "Replication lag in bytes",
		}),

		// Account metrics
		accountsTotal: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_accounts_total",
			Help: "Total number of accounts",
		}),
		accountsActive: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_accounts_active",
			Help: "Number of active accounts (with recent activity)",
		}),
		accountBalance: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "tigerbeetle_account_balance",
			Help: "Account balance by ledger and type",
		}, []string{"ledger", "account_type"}),

		// Transfer metrics
		transfersTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "tigerbeetle_transfers_total",
			Help: "Total number of transfers processed",
		}, []string{"status", "ledger"}),
		transfersInFlight: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_transfers_in_flight",
			Help: "Number of transfers currently in flight",
		}),
		transferLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "tigerbeetle_transfer_latency_seconds",
			Help:    "Transfer processing latency in seconds",
			Buckets: []float64{0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1},
		}, []string{"type"}),
		transferAmount: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "tigerbeetle_transfer_amount",
			Help:    "Transfer amount distribution",
			Buckets: []float64{1000, 10000, 100000, 1000000, 10000000, 100000000},
		}, []string{"ledger", "currency"}),
		transferRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_transfers_per_second",
			Help: "Current transfers per second",
		}),

		// Two-phase commit metrics
		pendingTransfers: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_pending_transfers",
			Help: "Number of pending (uncommitted) transfers",
		}),
		postedTransfers: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "tigerbeetle_posted_transfers_total",
			Help: "Total number of posted (committed) transfers",
		}, []string{"ledger"}),
		voidedTransfers: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "tigerbeetle_voided_transfers_total",
			Help: "Total number of voided (rolled back) transfers",
		}, []string{"ledger", "reason"}),

		// Performance metrics
		batchSize: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "tigerbeetle_batch_size",
			Help:    "Batch size distribution",
			Buckets: []float64{1, 10, 50, 100, 500, 1000, 5000, 8190},
		}, []string{"operation"}),
		ioLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "tigerbeetle_io_latency_seconds",
			Help:    "I/O operation latency in seconds",
			Buckets: []float64{0.00001, 0.0001, 0.001, 0.01, 0.1},
		}, []string{"operation"}),
		cacheHitRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_cache_hit_rate",
			Help: "Cache hit rate (0-1)",
		}),
		diskUsage: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_disk_usage_bytes",
			Help: "Disk usage in bytes",
		}),
		memoryUsage: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "tigerbeetle_memory_usage_bytes",
			Help: "Memory usage in bytes",
		}),

		// Error metrics
		errors: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "tigerbeetle_errors_total",
			Help: "Total number of errors",
		}, []string{"type", "operation"}),
		timeouts: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "tigerbeetle_timeouts_total",
			Help: "Total number of timeouts",
		}, []string{"operation"}),
	}
}

// Start starts the exporter background collection
func (e *TigerBeetleExporter) Start(ctx context.Context) {
	go e.collectLoop(ctx)
}

// collectLoop periodically collects metrics
func (e *TigerBeetleExporter) collectLoop(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.collect()
		}
	}
}

// collect fetches metrics from TigerBeetle
func (e *TigerBeetleExporter) collect() {
	// Fetch cluster status
	resp, err := e.client.Get(e.clusterURL + "/status")
	if err != nil {
		e.clusterHealth.Set(0)
		e.errors.WithLabelValues("connection", "status").Inc()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		e.clusterHealth.Set(0)
		return
	}

	var status struct {
		Healthy          bool    `json:"healthy"`
		Nodes            int     `json:"nodes"`
		LeaderID         string  `json:"leader_id"`
		ReplicationLag   int64   `json:"replication_lag"`
		Accounts         int64   `json:"accounts"`
		ActiveAccounts   int64   `json:"active_accounts"`
		PendingTransfers int64   `json:"pending_transfers"`
		TransfersPerSec  float64 `json:"transfers_per_second"`
		CacheHitRate     float64 `json:"cache_hit_rate"`
		DiskUsage        int64   `json:"disk_usage_bytes"`
		MemoryUsage      int64   `json:"memory_usage_bytes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		e.errors.WithLabelValues("parse", "status").Inc()
		return
	}

	// Update metrics
	if status.Healthy {
		e.clusterHealth.Set(1)
	} else {
		e.clusterHealth.Set(0)
	}

	e.clusterNodes.Set(float64(status.Nodes))
	e.replicationLag.Set(float64(status.ReplicationLag))
	e.accountsTotal.Set(float64(status.Accounts))
	e.accountsActive.Set(float64(status.ActiveAccounts))
	e.pendingTransfers.Set(float64(status.PendingTransfers))
	e.transferRate.Set(status.TransfersPerSec)
	e.cacheHitRate.Set(status.CacheHitRate)
	e.diskUsage.Set(float64(status.DiskUsage))
	e.memoryUsage.Set(float64(status.MemoryUsage))
}

// RecordTransfer records a transfer metric
func (e *TigerBeetleExporter) RecordTransfer(status, ledger string, latency time.Duration, amount float64, currency string) {
	e.transfersTotal.WithLabelValues(status, ledger).Inc()
	e.transferLatency.WithLabelValues("transfer").Observe(latency.Seconds())
	e.transferAmount.WithLabelValues(ledger, currency).Observe(amount)
}

// RecordPendingTransfer records a pending transfer
func (e *TigerBeetleExporter) RecordPendingTransfer(ledger string, latency time.Duration) {
	e.transferLatency.WithLabelValues("pending").Observe(latency.Seconds())
}

// RecordPostedTransfer records a posted transfer
func (e *TigerBeetleExporter) RecordPostedTransfer(ledger string, latency time.Duration) {
	e.postedTransfers.WithLabelValues(ledger).Inc()
	e.transferLatency.WithLabelValues("post").Observe(latency.Seconds())
}

// RecordVoidedTransfer records a voided transfer
func (e *TigerBeetleExporter) RecordVoidedTransfer(ledger, reason string, latency time.Duration) {
	e.voidedTransfers.WithLabelValues(ledger, reason).Inc()
	e.transferLatency.WithLabelValues("void").Observe(latency.Seconds())
}

// RecordBatch records a batch operation
func (e *TigerBeetleExporter) RecordBatch(operation string, size int, latency time.Duration) {
	e.batchSize.WithLabelValues(operation).Observe(float64(size))
	e.ioLatency.WithLabelValues(operation).Observe(latency.Seconds())
}

// RecordError records an error
func (e *TigerBeetleExporter) RecordError(errorType, operation string) {
	e.errors.WithLabelValues(errorType, operation).Inc()
}

// RecordTimeout records a timeout
func (e *TigerBeetleExporter) RecordTimeout(operation string) {
	e.timeouts.WithLabelValues(operation).Inc()
}

// UpdateAccountBalance updates account balance metric
func (e *TigerBeetleExporter) UpdateAccountBalance(ledger, accountType string, balance float64) {
	e.accountBalance.WithLabelValues(ledger, accountType).Set(balance)
}

// SetTransfersInFlight sets the in-flight transfers count
func (e *TigerBeetleExporter) SetTransfersInFlight(count int) {
	e.transfersInFlight.Set(float64(count))
}

// Describe implements prometheus.Collector
func (e *TigerBeetleExporter) Describe(ch chan<- *prometheus.Desc) {
	e.clusterHealth.Describe(ch)
	e.clusterNodes.Describe(ch)
	e.clusterLeader.Describe(ch)
	e.replicationLag.Describe(ch)
	e.accountsTotal.Describe(ch)
	e.accountsActive.Describe(ch)
	e.accountBalance.Describe(ch)
	e.transfersTotal.Describe(ch)
	e.transfersInFlight.Describe(ch)
	e.transferLatency.Describe(ch)
	e.transferAmount.Describe(ch)
	e.transferRate.Describe(ch)
	e.pendingTransfers.Describe(ch)
	e.postedTransfers.Describe(ch)
	e.voidedTransfers.Describe(ch)
	e.batchSize.Describe(ch)
	e.ioLatency.Describe(ch)
	e.cacheHitRate.Describe(ch)
	e.diskUsage.Describe(ch)
	e.memoryUsage.Describe(ch)
	e.errors.Describe(ch)
	e.timeouts.Describe(ch)
}

// Collect implements prometheus.Collector
func (e *TigerBeetleExporter) Collect(ch chan<- prometheus.Metric) {
	e.clusterHealth.Collect(ch)
	e.clusterNodes.Collect(ch)
	e.clusterLeader.Collect(ch)
	e.replicationLag.Collect(ch)
	e.accountsTotal.Collect(ch)
	e.accountsActive.Collect(ch)
	e.accountBalance.Collect(ch)
	e.transfersTotal.Collect(ch)
	e.transfersInFlight.Collect(ch)
	e.transferLatency.Collect(ch)
	e.transferAmount.Collect(ch)
	e.transferRate.Collect(ch)
	e.pendingTransfers.Collect(ch)
	e.postedTransfers.Collect(ch)
	e.voidedTransfers.Collect(ch)
	e.batchSize.Collect(ch)
	e.ioLatency.Collect(ch)
	e.cacheHitRate.Collect(ch)
	e.diskUsage.Collect(ch)
	e.memoryUsage.Collect(ch)
	e.errors.Collect(ch)
	e.timeouts.Collect(ch)
}

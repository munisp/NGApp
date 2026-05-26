// Package observability provides Prometheus exporter for Mojaloop
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

// MojaLoopExporter exports Mojaloop metrics to Prometheus
type MojaLoopExporter struct {
	client  *http.Client
	baseURL string
	mu      sync.RWMutex

	// Transfer metrics
	transfersTotal      *prometheus.CounterVec
	transferLatency     *prometheus.HistogramVec
	transferAmount      *prometheus.HistogramVec
	transfersInProgress prometheus.Gauge
	transferSuccessRate prometheus.Gauge

	// Participant metrics
	participantsTotal   prometheus.Gauge
	participantHealth   *prometheus.GaugeVec
	participantBalance  *prometheus.GaugeVec
	participantNDC      *prometheus.GaugeVec
	participantPosition *prometheus.GaugeVec

	// Settlement metrics
	settlementsTotal   *prometheus.CounterVec
	settlementAmount   *prometheus.HistogramVec
	settlementDuration *prometheus.HistogramVec
	settlementsPending prometheus.Gauge
	settlementWindows  prometheus.Gauge

	// Quote metrics
	quotesTotal  *prometheus.CounterVec
	quoteLatency *prometheus.HistogramVec
	quotesActive prometheus.Gauge

	// Party lookup metrics
	partyLookupsTotal  *prometheus.CounterVec
	partyLookupLatency *prometheus.HistogramVec

	// Bulk transfer metrics
	bulkTransfersTotal  *prometheus.CounterVec
	bulkTransferSize    *prometheus.HistogramVec
	bulkTransferLatency *prometheus.HistogramVec

	// Error metrics
	errorsTotal       *prometheus.CounterVec
	timeoutsTotal     *prometheus.CounterVec
	rejectedTransfers *prometheus.CounterVec

	// System metrics
	kafkaLag      *prometheus.GaugeVec
	dbConnections *prometheus.GaugeVec
	cacheHitRate  prometheus.Gauge
}

// NewMojaLoopExporter creates a new Mojaloop exporter
func NewMojaLoopExporter(baseURL string) *MojaLoopExporter {
	return &MojaLoopExporter{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL: baseURL,

		// Transfer metrics
		transfersTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_transfers_total",
			Help: "Total number of transfers",
		}, []string{"status", "currency", "payer_fsp", "payee_fsp"}),
		transferLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_transfer_latency_seconds",
			Help:    "Transfer end-to-end latency in seconds",
			Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
		}, []string{"type"}),
		transferAmount: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_transfer_amount",
			Help:    "Transfer amount distribution",
			Buckets: []float64{100, 1000, 10000, 100000, 1000000, 10000000},
		}, []string{"currency"}),
		transfersInProgress: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_transfers_in_progress",
			Help: "Number of transfers currently in progress",
		}),
		transferSuccessRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_transfer_success_rate",
			Help: "Transfer success rate (0-1)",
		}),

		// Participant metrics
		participantsTotal: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_participants_total",
			Help: "Total number of registered participants",
		}),
		participantHealth: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mojaloop_participant_health",
			Help: "Participant health status (0=down, 1=degraded, 2=healthy)",
		}, []string{"fsp_id", "name"}),
		participantBalance: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mojaloop_participant_balance",
			Help: "Participant account balance",
		}, []string{"fsp_id", "currency", "account_type"}),
		participantNDC: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mojaloop_participant_ndc",
			Help: "Participant Net Debit Cap",
		}, []string{"fsp_id", "currency"}),
		participantPosition: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mojaloop_participant_position",
			Help: "Participant current position",
		}, []string{"fsp_id", "currency"}),

		// Settlement metrics
		settlementsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_settlements_total",
			Help: "Total number of settlements",
		}, []string{"status", "model"}),
		settlementAmount: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_settlement_amount",
			Help:    "Settlement amount distribution",
			Buckets: []float64{1e6, 1e7, 1e8, 1e9, 1e10},
		}, []string{"currency"}),
		settlementDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_settlement_duration_hours",
			Help:    "Settlement processing duration in hours",
			Buckets: []float64{0.5, 1, 2, 4, 8, 12, 24, 48},
		}, []string{"model"}),
		settlementsPending: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_settlements_pending",
			Help: "Number of pending settlements",
		}),
		settlementWindows: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_settlement_windows_open",
			Help: "Number of open settlement windows",
		}),

		// Quote metrics
		quotesTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_quotes_total",
			Help: "Total number of quotes",
		}, []string{"status"}),
		quoteLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_quote_latency_seconds",
			Help:    "Quote processing latency in seconds",
			Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		}, []string{"type"}),
		quotesActive: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_quotes_active",
			Help: "Number of active quotes",
		}),

		// Party lookup metrics
		partyLookupsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_party_lookups_total",
			Help: "Total number of party lookups",
		}, []string{"status", "id_type"}),
		partyLookupLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_party_lookup_latency_seconds",
			Help:    "Party lookup latency in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1},
		}, []string{"id_type"}),

		// Bulk transfer metrics
		bulkTransfersTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_bulk_transfers_total",
			Help: "Total number of bulk transfers",
		}, []string{"status"}),
		bulkTransferSize: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_bulk_transfer_size",
			Help:    "Number of individual transfers in bulk",
			Buckets: []float64{10, 50, 100, 500, 1000, 5000, 10000},
		}, []string{"status"}),
		bulkTransferLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mojaloop_bulk_transfer_latency_seconds",
			Help:    "Bulk transfer processing latency in seconds",
			Buckets: []float64{1, 5, 10, 30, 60, 120, 300},
		}, []string{"status"}),

		// Error metrics
		errorsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_errors_total",
			Help: "Total number of errors",
		}, []string{"type", "code", "service"}),
		timeoutsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_timeouts_total",
			Help: "Total number of timeouts",
		}, []string{"operation", "service"}),
		rejectedTransfers: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "mojaloop_rejected_transfers_total",
			Help: "Total number of rejected transfers",
		}, []string{"reason", "fsp_id"}),

		// System metrics
		kafkaLag: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mojaloop_kafka_consumer_lag",
			Help: "Kafka consumer lag",
		}, []string{"topic", "consumer_group"}),
		dbConnections: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mojaloop_db_connections",
			Help: "Database connection pool status",
		}, []string{"service", "state"}),
		cacheHitRate: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "mojaloop_cache_hit_rate",
			Help: "Cache hit rate (0-1)",
		}),
	}
}

// Start starts the exporter background collection
func (e *MojaLoopExporter) Start(ctx context.Context) {
	go e.collectLoop(ctx)
}

// collectLoop periodically collects metrics
func (e *MojaLoopExporter) collectLoop(ctx context.Context) {
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

// collect fetches metrics from Mojaloop services
func (e *MojaLoopExporter) collect() {
	// Collect from central-ledger
	e.collectCentralLedger()
	// Collect from ml-api-adapter
	e.collectMLAPIAdapter()
	// Collect from central-settlement
	e.collectCentralSettlement()
}

func (e *MojaLoopExporter) collectCentralLedger() {
	resp, err := e.client.Get(e.baseURL + "/central-ledger/health")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var health struct {
		Status            string  `json:"status"`
		ParticipantCount  int     `json:"participant_count"`
		TransfersInFlight int     `json:"transfers_in_flight"`
		SuccessRate       float64 `json:"success_rate"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return
	}

	e.participantsTotal.Set(float64(health.ParticipantCount))
	e.transfersInProgress.Set(float64(health.TransfersInFlight))
	e.transferSuccessRate.Set(health.SuccessRate)
}

func (e *MojaLoopExporter) collectMLAPIAdapter() {
	resp, err := e.client.Get(e.baseURL + "/ml-api-adapter/health")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var health struct {
		ActiveQuotes int     `json:"active_quotes"`
		CacheHitRate float64 `json:"cache_hit_rate"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return
	}

	e.quotesActive.Set(float64(health.ActiveQuotes))
	e.cacheHitRate.Set(health.CacheHitRate)
}

func (e *MojaLoopExporter) collectCentralSettlement() {
	resp, err := e.client.Get(e.baseURL + "/central-settlement/health")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var health struct {
		PendingSettlements int `json:"pending_settlements"`
		OpenWindows        int `json:"open_windows"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return
	}

	e.settlementsPending.Set(float64(health.PendingSettlements))
	e.settlementWindows.Set(float64(health.OpenWindows))
}

// RecordTransfer records a transfer metric
func (e *MojaLoopExporter) RecordTransfer(status, currency, payerFSP, payeeFSP string, latency time.Duration, amount float64) {
	e.transfersTotal.WithLabelValues(status, currency, payerFSP, payeeFSP).Inc()
	e.transferLatency.WithLabelValues("p2p").Observe(latency.Seconds())
	e.transferAmount.WithLabelValues(currency).Observe(amount)
}

// RecordQuote records a quote metric
func (e *MojaLoopExporter) RecordQuote(status string, latency time.Duration) {
	e.quotesTotal.WithLabelValues(status).Inc()
	e.quoteLatency.WithLabelValues("standard").Observe(latency.Seconds())
}

// RecordPartyLookup records a party lookup metric
func (e *MojaLoopExporter) RecordPartyLookup(status, idType string, latency time.Duration) {
	e.partyLookupsTotal.WithLabelValues(status, idType).Inc()
	e.partyLookupLatency.WithLabelValues(idType).Observe(latency.Seconds())
}

// RecordSettlement records a settlement metric
func (e *MojaLoopExporter) RecordSettlement(status, model, currency string, duration time.Duration, amount float64) {
	e.settlementsTotal.WithLabelValues(status, model).Inc()
	e.settlementDuration.WithLabelValues(model).Observe(duration.Hours())
	e.settlementAmount.WithLabelValues(currency).Observe(amount)
}

// RecordBulkTransfer records a bulk transfer metric
func (e *MojaLoopExporter) RecordBulkTransfer(status string, size int, latency time.Duration) {
	e.bulkTransfersTotal.WithLabelValues(status).Inc()
	e.bulkTransferSize.WithLabelValues(status).Observe(float64(size))
	e.bulkTransferLatency.WithLabelValues(status).Observe(latency.Seconds())
}

// RecordError records an error metric
func (e *MojaLoopExporter) RecordError(errorType, code, service string) {
	e.errorsTotal.WithLabelValues(errorType, code, service).Inc()
}

// RecordTimeout records a timeout metric
func (e *MojaLoopExporter) RecordTimeout(operation, service string) {
	e.timeoutsTotal.WithLabelValues(operation, service).Inc()
}

// RecordRejectedTransfer records a rejected transfer
func (e *MojaLoopExporter) RecordRejectedTransfer(reason, fspID string) {
	e.rejectedTransfers.WithLabelValues(reason, fspID).Inc()
}

// UpdateParticipantHealth updates participant health metric
func (e *MojaLoopExporter) UpdateParticipantHealth(fspID, name string, health int) {
	e.participantHealth.WithLabelValues(fspID, name).Set(float64(health))
}

// UpdateParticipantBalance updates participant balance metric
func (e *MojaLoopExporter) UpdateParticipantBalance(fspID, currency, accountType string, balance float64) {
	e.participantBalance.WithLabelValues(fspID, currency, accountType).Set(balance)
}

// UpdateParticipantNDC updates participant NDC metric
func (e *MojaLoopExporter) UpdateParticipantNDC(fspID, currency string, ndc float64) {
	e.participantNDC.WithLabelValues(fspID, currency).Set(ndc)
}

// UpdateParticipantPosition updates participant position metric
func (e *MojaLoopExporter) UpdateParticipantPosition(fspID, currency string, position float64) {
	e.participantPosition.WithLabelValues(fspID, currency).Set(position)
}

// UpdateKafkaLag updates Kafka consumer lag metric
func (e *MojaLoopExporter) UpdateKafkaLag(topic, consumerGroup string, lag int64) {
	e.kafkaLag.WithLabelValues(topic, consumerGroup).Set(float64(lag))
}

// UpdateDBConnections updates database connection pool metric
func (e *MojaLoopExporter) UpdateDBConnections(service, state string, count int) {
	e.dbConnections.WithLabelValues(service, state).Set(float64(count))
}

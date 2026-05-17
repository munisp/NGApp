package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all the Prometheus metrics for the GIF service.
type Metrics struct {
	// Blockchain Operations (Policy/Claim/Oracle/Tx)
	PolicyCreationTotal          *prometheus.CounterVec
	PolicyCreationSuccessTotal   prometheus.Counter
	PolicyCreationFailureTotal   *prometheus.CounterVec
	ClaimTriggerTotal            *prometheus.CounterVec
	ClaimTriggerSuccessTotal     prometheus.Counter
	ClaimTriggerFailureTotal     *prometheus.CounterVec
	OracleSubmissionTotal        *prometheus.CounterVec
	OracleSubmissionSuccessTotal prometheus.Counter
	OracleSubmissionFailureTotal *prometheus.CounterVec
	TransactionTotal             *prometheus.CounterVec
	TransactionFailureTotal      *prometheus.CounterVec
	GasCostTotalWei              prometheus.Counter
	GasCostLastTxWei             prometheus.Gauge
	TransactionLatencySeconds    *prometheus.HistogramVec
	PendingTransactions          prometheus.Gauge
	PolicyCount                  prometheus.Gauge
	ClaimCountPending            prometheus.Gauge
	ClaimCountPaid               prometheus.Counter
	ClaimPayoutTotalEth          prometheus.Counter
	ContractCallsTotal           *prometheus.CounterVec

	// Reinsurance Operations
	ReinsuranceCededPremiumsTotal *prometheus.CounterVec
	ReinsuranceCededPremiumsLast  prometheus.Gauge
	ReinsuranceTreatyUtilization  *prometheus.GaugeVec
	ReinsuranceTreatyCapacityRem  *prometheus.GaugeVec
	ReinsurerBalanceEth           *prometheus.GaugeVec
	ReinsurerPayoutsTotal         *prometheus.CounterVec
	ReinsurerCollectionsTotal     *prometheus.CounterVec
	ReinsuranceTreatyCount        prometheus.Gauge
	ReinsuranceClaimCededTotal    prometheus.Counter
	ReinsuranceClaimCededAmount   prometheus.Counter
	ReinsuranceServiceUp          prometheus.Gauge
}

// NewMetrics initializes and registers all Prometheus metrics.
func NewMetrics() *Metrics {
	m := &Metrics{
		// Blockchain Operations (Policy/Claim/Oracle/Tx) - 20 metrics
		PolicyCreationTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_policy_creation_total",
			Help: "Total number of policies creation attempts.",
		}, []string{"policy_type"}),
		PolicyCreationSuccessTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_policy_creation_success_total",
			Help: "Total successful policy creations.",
		}),
		PolicyCreationFailureTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_policy_creation_failure_total",
			Help: "Total failed policy creations.",
		}, []string{"error_type"}),
		ClaimTriggerTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_claim_trigger_total",
			Help: "Total number of claim trigger attempts.",
		}, []string{"claim_type"}),
		ClaimTriggerSuccessTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_claim_trigger_success_total",
			Help: "Total successful claim triggers.",
		}),
		ClaimTriggerFailureTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_claim_trigger_failure_total",
			Help: "Total failed claim triggers.",
		}, []string{"error_type"}),
		OracleSubmissionTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_oracle_submission_total",
			Help: "Total number of oracle submission attempts.",
		}, []string{"oracle_id"}),
		OracleSubmissionSuccessTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_oracle_submission_success_total",
			Help: "Total successful oracle submissions.",
		}),
		OracleSubmissionFailureTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_oracle_submission_failure_total",
			Help: "Total failed oracle submissions.",
		}, []string{"error_type"}),
		TransactionTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_transaction_total",
			Help: "Total blockchain transactions processed.",
		}, []string{"tx_type", "status"}),
		TransactionFailureTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_transaction_failure_total",
			Help: "Total failed blockchain transactions.",
		}, []string{"tx_type", "reason"}),
		GasCostTotalWei: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_gas_cost_total_wei",
			Help: "Cumulative gas cost in Wei.",
		}),
		GasCostLastTxWei: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_gas_cost_last_tx_wei",
			Help: "Gas cost of the last transaction.",
		}),
		TransactionLatencySeconds: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "gif_transaction_latency_seconds",
			Help:    "Latency of blockchain transactions.",
			Buckets: []float64{0.1, 0.5, 1, 2.5, 5, 10},
		}, []string{"tx_type"}),
		PendingTransactions: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_pending_transactions",
			Help: "Number of transactions currently pending.",
		}),
		PolicyCount: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_policy_count",
			Help: "Current total number of active policies.",
		}),
		ClaimCountPending: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_claim_count_pending",
			Help: "Current number of pending claims.",
		}),
		ClaimCountPaid: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_claim_count_paid",
			Help: "Total number of claims paid.",
		}),
		ClaimPayoutTotalEth: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_claim_payout_total_eth",
			Help: "Total claim payout amount in ETH.",
		}),
		ContractCallsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_contract_calls_total",
			Help: "Total calls to specific smart contract functions.",
		}, []string{"function_name"}),

		// Reinsurance Operations - 11 metrics
		ReinsuranceCededPremiumsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_reinsurance_ceded_premiums_total",
			Help: "Total ceded premiums.",
		}, []string{"treaty_id"}),
		ReinsuranceCededPremiumsLast: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_reinsurance_ceded_premiums_last",
			Help: "Last ceded premium amount.",
		}),
		ReinsuranceTreatyUtilization: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "gif_reinsurance_treaty_utilization_ratio",
			Help: "Current utilization ratio of a treaty.",
		}, []string{"treaty_id"}),
		ReinsuranceTreatyCapacityRem: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "gif_reinsurance_treaty_capacity_remaining",
			Help: "Remaining capacity of a treaty.",
		}, []string{"treaty_id"}),
		ReinsurerBalanceEth: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "gif_reinsurer_balance_eth",
			Help: "Current balance held by a reinsurer.",
		}, []string{"reinsurer_id"}),
		ReinsurerPayoutsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_reinsurer_payouts_total",
			Help: "Total payouts to reinsurers.",
		}, []string{"reinsurer_id"}),
		ReinsurerCollectionsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "gif_reinsurer_collections_total",
			Help: "Total collections from reinsurers.",
		}, []string{"reinsurer_id"}),
		ReinsuranceTreatyCount: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_reinsurance_treaty_count",
			Help: "Total number of active reinsurance treaties.",
		}),
		ReinsuranceClaimCededTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_reinsurance_claim_ceded_total",
			Help: "Total number of claims ceded to reinsurance.",
		}),
		ReinsuranceClaimCededAmount: promauto.NewCounter(prometheus.CounterOpts{
			Name: "gif_reinsurance_claim_ceded_amount_total",
			Help: "Total amount of claims ceded.",
		}),
		ReinsuranceServiceUp: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "gif_reinsurance_service_up",
			Help: "Simple health check for the reinsurance service (1=up, 0=down).",
		}),
	}
	return m
}

// Total metrics: 20 + 11 = 31.

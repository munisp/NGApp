package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/etherisc/gif-prometheus-alerting-service/internal/blockchain"
	"github.com/etherisc/gif-prometheus-alerting-service/internal/reinsurance"
	"github.com/etherisc/gif-prometheus-alerting-service/internal/config"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Define custom metrics
var (
	// Blockchain Metrics
	txFailureCount = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gif_blockchain_tx_failure_total",
			Help: "Total number of failed blockchain transactions.",
		},
		[]string{"service", "error_type"},
	)
	highGasCost = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "gif_blockchain_high_gas_cost_gwei",
			Help: "Current gas cost in Gwei, for alerting on high costs.",
		},
	)
	oracleSubmissionFailure = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gif_blockchain_oracle_submission_failure",
			Help: "Gauge for oracle submission failures (1 for failure, 0 for success).",
		},
		[]string{"oracle_id"},
	)
	smartContractError = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gif_blockchain_smart_contract_error",
			Help: "Gauge for critical smart contract errors (1 for error, 0 for no error).",
		},
		[]string{"contract_address", "error_code"},
	)
	walletBalanceEth = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gif_blockchain_wallet_balance_eth",
			Help: "Current balance of critical wallets in ETH.",
		},
		[]string{"wallet_address", "wallet_type"},
	)

	// Reinsurance Metrics
	treatyLimitExceeded = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gif_reinsurance_treaty_limit_exceeded_ratio",
			Help: "Ratio of current exposure to treaty limit (1.0 means limit exceeded).",
		},
		[]string{"treaty_id"},
	)
	reinsurerBalanceNegative = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gif_reinsurance_reinsurer_balance_negative",
			Help: "Reinsurer balance, negative values indicate a debt.",
		},
		[]string{"reinsurer_id"},
	)
	cessionCalculationError = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "gif_reinsurance_cession_calculation_error",
			Help: "Gauge for cession calculation errors (1 for error, 0 for no error).",
		},
	)
)

func init() {
	// Register the metrics with Prometheus's default registry.
	prometheus.MustRegister(txFailureCount)
	prometheus.MustRegister(highGasCost)
	prometheus.MustRegister(oracleSubmissionFailure)
	prometheus.MustRegister(smartContractError)
	prometheus.MustRegister(walletBalanceEth)
	prometheus.MustRegister(treatyLimitExceeded)
	prometheus.MustRegister(reinsurerBalanceNegative)
	prometheus.MustRegister(cessionCalculationError)
}

// collectMetrics is the main function to fetch data and update metrics
func collectMetrics(cfg *config.Config) {
	// --- Blockchain Data Collection ---
	log.Println("Collecting blockchain metrics...")
	
	// 1. Transaction Failures
	failures := blockchain.GetTransactionFailures()
	for _, f := range failures {
		txFailureCount.WithLabelValues(f.Service, f.ErrorType).Set(float64(f.Count))
	}

	// 2. High Gas Costs
	gasCost := blockchain.GetCurrentGasCost()
	highGasCost.Set(gasCost)

	// 3. Oracle Submission Failures
	oracleFailures := blockchain.GetOracleSubmissionFailures()
	for _, of := range oracleFailures {
		val := 0.0
		if of.Failed {
			val = 1.0
		}
		oracleSubmissionFailure.WithLabelValues(of.OracleID).Set(val)
	}

	// 4. Smart Contract Errors
	contractErrors := blockchain.GetSmartContractErrors()
	for _, ce := range contractErrors {
		val := 0.0
		if ce.HasError {
			val = 1.0
		}
		smartContractError.WithLabelValues(ce.ContractAddress, ce.ErrorCode).Set(val)
	}

	// 5. Wallet Balances
	balances := blockchain.GetWalletBalances()
	for _, b := range balances {
		walletBalanceEth.WithLabelValues(b.Address, b.Type).Set(b.BalanceETH)
	}

	// --- Reinsurance Data Collection ---
	log.Println("Collecting reinsurance metrics...")

	// 6. Treaty Limit Exceeded
	treatyExposures := reinsurance.GetTreatyExposures()
	for _, te := range treatyExposures {
		ratio := te.CurrentExposure / te.TreatyLimit
		treatyLimitExceeded.WithLabelValues(te.TreatyID).Set(ratio)
	}

	// 7. Reinsurer Balance Negative
	reinsurerBalances := reinsurance.GetReinsurerBalances()
	for _, rb := range reinsurerBalances {
		reinsurerBalanceNegative.WithLabelValues(rb.ReinsurerID).Set(rb.Balance)
	}

	// 8. Cession Calculation Error
	if reinsurance.HasCessionCalculationError() {
		cessionCalculationError.Set(1.0)
	} else {
		cessionCalculationError.Set(0.0)
	}
}

func main() {
	// Load configuration
	cfg, err := config.LoadConfig("configs/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Start a goroutine to periodically collect metrics
	go func() {
		// Initial collection
		collectMetrics(cfg)
		
		// Periodic collection
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			collectMetrics(cfg)
		}
	}()

	// Expose the metrics endpoint
	http.Handle("/metrics", promhttp.Handler())
	
	port := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("Starting Prometheus exporter on %s/metrics", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

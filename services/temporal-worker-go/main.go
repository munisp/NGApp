// Temporal Workflow Worker — Saga orchestration for multi-step banking operations
// Go microservice providing workflow definitions, execution tracking, and compensation logic
// Features: payment sagas, loan disbursement, trade finance lifecycle, KYC onboarding, FX settlement

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type WorkflowDefinition struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	TaskQueue      string   `json:"taskQueue"`
	Steps          []Step   `json:"steps"`
	CompensateSteps []Step  `json:"compensateSteps"`
	TimeoutSeconds int      `json:"timeoutSeconds"`
	RetryPolicy    RetryPolicy `json:"retryPolicy"`
	Status         string   `json:"status"`
	CreatedAt      string   `json:"createdAt"`
}

type Step struct {
	Name        string `json:"name"`
	Activity    string `json:"activity"`
	Service     string `json:"service"`
	Timeout     int    `json:"timeoutSeconds"`
	Compensate  string `json:"compensateActivity"`
}

type RetryPolicy struct {
	MaxAttempts       int     `json:"maxAttempts"`
	InitialIntervalMs int    `json:"initialIntervalMs"`
	BackoffCoeff      float64 `json:"backoffCoefficient"`
	MaxIntervalMs     int    `json:"maxIntervalMs"`
}

type WorkflowExecution struct {
	ID              string                 `json:"id"`
	WorkflowID      string                 `json:"workflowId"`
	WorkflowName    string                 `json:"workflowName"`
	RunID           string                 `json:"runId"`
	Input           map[string]interface{} `json:"input"`
	Status          string                 `json:"status"`
	CurrentStep     string                 `json:"currentStep"`
	StepResults     []StepResult           `json:"stepResults"`
	StartedAt       string                 `json:"startedAt"`
	CompletedAt     string                 `json:"completedAt"`
	Error           string                 `json:"error,omitempty"`
	DurationMs      int64                  `json:"durationMs"`
}

type StepResult struct {
	Step      string `json:"step"`
	Status    string `json:"status"`
	StartedAt string `json:"startedAt"`
	EndedAt   string `json:"endedAt"`
	DurationMs int64 `json:"durationMs"`
	Output    interface{} `json:"output,omitempty"`
	Error     string `json:"error,omitempty"`
}

type TaskQueue struct {
	Name          string `json:"name"`
	PendingTasks  int    `json:"pendingTasks"`
	ActiveWorkers int    `json:"activeWorkers"`
	Throughput    int    `json:"throughputPerMin"`
}

var (
	definitions []WorkflowDefinition
	executions  []WorkflowExecution
	taskQueues  []TaskQueue
	mu          sync.RWMutex
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func middlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092")},
		"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379")},
		"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
		"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "status": "embedded"},
		"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200")},
		"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
		"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476")},
		"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "app_id": "temporal-worker"},
		"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003")},
		"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:3002")},
		"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000")},
		"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8181")},
		"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080")},
		"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:4000")},
	}
}

func seedData() {
	now := time.Now().UTC().Format(time.RFC3339)

	definitions = []WorkflowDefinition{
		{ID: "WF-DEF-001", Name: "NIP Payment Saga", TaskQueue: "payments-queue", TimeoutSeconds: 30, Status: "active", CreatedAt: now,
			RetryPolicy: RetryPolicy{MaxAttempts: 3, InitialIntervalMs: 1000, BackoffCoeff: 2.0, MaxIntervalMs: 30000},
			Steps: []Step{
				{Name: "Validate Sender", Activity: "validateAccount", Service: "account-opening-go", Timeout: 5, Compensate: ""},
				{Name: "Check Balance", Activity: "checkBalance", Service: "account-opening-go", Timeout: 5, Compensate: ""},
				{Name: "Debit Sender", Activity: "debitAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10, Compensate: "creditAccount"},
				{Name: "Submit to NIBSS", Activity: "submitNIP", Service: "nibss-direct-debit-go", Timeout: 15, Compensate: "reverseNIP"},
				{Name: "Credit Receiver", Activity: "creditAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10, Compensate: "debitAccount"},
				{Name: "Send Notification", Activity: "sendSMS", Service: "sms-email-gateway-go", Timeout: 5, Compensate: ""},
				{Name: "Publish Event", Activity: "publishEvent", Service: "kafka-broker-go", Timeout: 5, Compensate: ""},
			},
			CompensateSteps: []Step{
				{Name: "Reverse Credit", Activity: "debitAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10},
				{Name: "Reverse NIBSS", Activity: "reverseNIP", Service: "nibss-direct-debit-go", Timeout: 15},
				{Name: "Reverse Debit", Activity: "creditAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10},
			},
		},
		{ID: "WF-DEF-002", Name: "Loan Disbursement Saga", TaskQueue: "loans-queue", TimeoutSeconds: 60, Status: "active", CreatedAt: now,
			RetryPolicy: RetryPolicy{MaxAttempts: 2, InitialIntervalMs: 2000, BackoffCoeff: 2.0, MaxIntervalMs: 60000},
			Steps: []Step{
				{Name: "Validate Loan", Activity: "validateLoan", Service: "loan-origination-go", Timeout: 5, Compensate: ""},
				{Name: "Credit Check", Activity: "checkCredit", Service: "credit-bureau-rs", Timeout: 10, Compensate: ""},
				{Name: "Collateral Verify", Activity: "verifyCollateral", Service: "collateral-valuation-rs", Timeout: 10, Compensate: ""},
				{Name: "Create GL Entries", Activity: "postToGL", Service: "tigerbeetle-ledger-rs", Timeout: 10, Compensate: "reverseGL"},
				{Name: "Disburse Funds", Activity: "disburseFunds", Service: "payments-hub-go", Timeout: 15, Compensate: "reversePayment"},
				{Name: "Update Loan Status", Activity: "updateLoanStatus", Service: "loan-origination-go", Timeout: 5, Compensate: "revertLoanStatus"},
				{Name: "Publish Kafka Event", Activity: "publishEvent", Service: "kafka-broker-go", Timeout: 5, Compensate: ""},
			},
			CompensateSteps: []Step{
				{Name: "Revert Status", Activity: "revertLoanStatus", Service: "loan-origination-go", Timeout: 5},
				{Name: "Reverse Payment", Activity: "reversePayment", Service: "payments-hub-go", Timeout: 15},
				{Name: "Reverse GL", Activity: "reverseGL", Service: "tigerbeetle-ledger-rs", Timeout: 10},
			},
		},
		{ID: "WF-DEF-003", Name: "KYC Onboarding Saga", TaskQueue: "kyc-queue", TimeoutSeconds: 120, Status: "active", CreatedAt: now,
			RetryPolicy: RetryPolicy{MaxAttempts: 5, InitialIntervalMs: 5000, BackoffCoeff: 1.5, MaxIntervalMs: 120000},
			Steps: []Step{
				{Name: "Validate BVN", Activity: "validateBVN", Service: "kyc-aml-screening-py", Timeout: 15, Compensate: ""},
				{Name: "Validate NIN", Activity: "validateNIN", Service: "kyc-aml-screening-py", Timeout: 15, Compensate: ""},
				{Name: "Watchlist Screen", Activity: "screenWatchlist", Service: "kyc-aml-screening-py", Timeout: 20, Compensate: ""},
				{Name: "PEP Check", Activity: "checkPEP", Service: "kyc-aml-screening-py", Timeout: 10, Compensate: ""},
				{Name: "Risk Score", Activity: "computeRiskScore", Service: "risk-scoring-rs", Timeout: 10, Compensate: ""},
				{Name: "Create Account", Activity: "createAccount", Service: "account-opening-go", Timeout: 10, Compensate: "closeAccount"},
				{Name: "Assign Tier", Activity: "assignCBNTier", Service: "account-opening-go", Timeout: 5, Compensate: ""},
			},
			CompensateSteps: []Step{
				{Name: "Close Account", Activity: "closeAccount", Service: "account-opening-go", Timeout: 10},
			},
		},
		{ID: "WF-DEF-004", Name: "FX Settlement Saga", TaskQueue: "fx-queue", TimeoutSeconds: 45, Status: "active", CreatedAt: now,
			RetryPolicy: RetryPolicy{MaxAttempts: 3, InitialIntervalMs: 2000, BackoffCoeff: 2.0, MaxIntervalMs: 30000},
			Steps: []Step{
				{Name: "Validate Deal", Activity: "validateDeal", Service: "fx-rates-engine-rs", Timeout: 5, Compensate: ""},
				{Name: "Check Position Limits", Activity: "checkLimits", Service: "fx-rates-engine-rs", Timeout: 5, Compensate: ""},
				{Name: "Debit Sell Currency", Activity: "debitAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10, Compensate: "creditAccount"},
				{Name: "Credit Buy Currency", Activity: "creditAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10, Compensate: "debitAccount"},
				{Name: "Update Position", Activity: "updatePosition", Service: "fx-rates-engine-rs", Timeout: 5, Compensate: "reversePosition"},
				{Name: "Report to CBN", Activity: "reportToCBN", Service: "regulatory-reporting-py", Timeout: 15, Compensate: ""},
			},
			CompensateSteps: []Step{
				{Name: "Reverse Position", Activity: "reversePosition", Service: "fx-rates-engine-rs", Timeout: 5},
				{Name: "Reverse Buy Credit", Activity: "debitAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10},
				{Name: "Reverse Sell Debit", Activity: "creditAccount", Service: "tigerbeetle-ledger-rs", Timeout: 10},
			},
		},
		{ID: "WF-DEF-005", Name: "LC Amendment Saga", TaskQueue: "trade-finance-queue", TimeoutSeconds: 300, Status: "active", CreatedAt: now,
			RetryPolicy: RetryPolicy{MaxAttempts: 2, InitialIntervalMs: 5000, BackoffCoeff: 2.0, MaxIntervalMs: 60000},
			Steps: []Step{
				{Name: "Validate Amendment", Activity: "validateAmendment", Service: "trade-finance-go", Timeout: 10, Compensate: ""},
				{Name: "Check Credit Limit", Activity: "checkCreditLimit", Service: "credit-bureau-rs", Timeout: 10, Compensate: ""},
				{Name: "Generate MT707", Activity: "generateSWIFT", Service: "trade-finance-go", Timeout: 15, Compensate: ""},
				{Name: "Submit to Advising Bank", Activity: "submitToAdvisingBank", Service: "trade-finance-go", Timeout: 30, Compensate: "cancelAmendment"},
				{Name: "Await Beneficiary Accept", Activity: "awaitBeneficiary", Service: "trade-finance-go", Timeout: 86400, Compensate: "cancelAmendment"},
				{Name: "Update GL", Activity: "postToGL", Service: "tigerbeetle-ledger-rs", Timeout: 10, Compensate: "reverseGL"},
			},
			CompensateSteps: []Step{
				{Name: "Reverse GL", Activity: "reverseGL", Service: "tigerbeetle-ledger-rs", Timeout: 10},
				{Name: "Cancel Amendment", Activity: "cancelAmendment", Service: "trade-finance-go", Timeout: 15},
			},
		},
	}

	executions = []WorkflowExecution{
		{ID: "WF-EX-001", WorkflowID: "WF-DEF-001", WorkflowName: "NIP Payment Saga", RunID: "run-a1b2c3", Status: "completed", CurrentStep: "", StartedAt: "2026-05-09T11:30:00Z", CompletedAt: "2026-05-09T11:30:04Z", DurationMs: 4200,
			Input: map[string]interface{}{"fromAccount": "0012345678", "toAccount": "0023456789", "amount": 500000.0, "narration": "Rent payment"},
			StepResults: []StepResult{
				{Step: "Validate Sender", Status: "completed", StartedAt: "2026-05-09T11:30:00Z", EndedAt: "2026-05-09T11:30:00Z", DurationMs: 120},
				{Step: "Check Balance", Status: "completed", StartedAt: "2026-05-09T11:30:00Z", EndedAt: "2026-05-09T11:30:01Z", DurationMs: 85},
				{Step: "Debit Sender", Status: "completed", StartedAt: "2026-05-09T11:30:01Z", EndedAt: "2026-05-09T11:30:01Z", DurationMs: 450},
				{Step: "Submit to NIBSS", Status: "completed", StartedAt: "2026-05-09T11:30:01Z", EndedAt: "2026-05-09T11:30:03Z", DurationMs: 2100},
				{Step: "Credit Receiver", Status: "completed", StartedAt: "2026-05-09T11:30:03Z", EndedAt: "2026-05-09T11:30:03Z", DurationMs: 380},
				{Step: "Send Notification", Status: "completed", StartedAt: "2026-05-09T11:30:03Z", EndedAt: "2026-05-09T11:30:04Z", DurationMs: 650},
				{Step: "Publish Event", Status: "completed", StartedAt: "2026-05-09T11:30:04Z", EndedAt: "2026-05-09T11:30:04Z", DurationMs: 45},
			}},
		{ID: "WF-EX-002", WorkflowID: "WF-DEF-002", WorkflowName: "Loan Disbursement Saga", RunID: "run-d4e5f6", Status: "completed", CurrentStep: "", StartedAt: "2026-05-09T10:00:00Z", CompletedAt: "2026-05-09T10:00:12Z", DurationMs: 12400,
			Input: map[string]interface{}{"loanId": "LOAN-001", "customerId": "ACC-001", "amount": 5000000.0, "product": "personal"},
			StepResults: []StepResult{
				{Step: "Validate Loan", Status: "completed", DurationMs: 200, StartedAt: "2026-05-09T10:00:00Z", EndedAt: "2026-05-09T10:00:00Z"},
				{Step: "Credit Check", Status: "completed", DurationMs: 3200, StartedAt: "2026-05-09T10:00:00Z", EndedAt: "2026-05-09T10:00:03Z"},
				{Step: "Collateral Verify", Status: "completed", DurationMs: 2800, StartedAt: "2026-05-09T10:00:03Z", EndedAt: "2026-05-09T10:00:06Z"},
				{Step: "Create GL Entries", Status: "completed", DurationMs: 450, StartedAt: "2026-05-09T10:00:06Z", EndedAt: "2026-05-09T10:00:07Z"},
				{Step: "Disburse Funds", Status: "completed", DurationMs: 4500, StartedAt: "2026-05-09T10:00:07Z", EndedAt: "2026-05-09T10:00:11Z"},
				{Step: "Update Loan Status", Status: "completed", DurationMs: 150, StartedAt: "2026-05-09T10:00:11Z", EndedAt: "2026-05-09T10:00:12Z"},
				{Step: "Publish Kafka Event", Status: "completed", DurationMs: 50, StartedAt: "2026-05-09T10:00:12Z", EndedAt: "2026-05-09T10:00:12Z"},
			}},
		{ID: "WF-EX-003", WorkflowID: "WF-DEF-001", WorkflowName: "NIP Payment Saga", RunID: "run-g7h8i9", Status: "compensating", CurrentStep: "Reverse Debit", StartedAt: "2026-05-09T12:00:00Z", CompletedAt: "", DurationMs: 18500,
			Input: map[string]interface{}{"fromAccount": "0034567890", "toAccount": "EXT-GTB-001", "amount": 2000000.0, "narration": "Failed NIP"},
			Error: "NIBSS timeout: session 000015260509120000000002 — no response after 30s",
			StepResults: []StepResult{
				{Step: "Validate Sender", Status: "completed", DurationMs: 95, StartedAt: "2026-05-09T12:00:00Z", EndedAt: "2026-05-09T12:00:00Z"},
				{Step: "Check Balance", Status: "completed", DurationMs: 110, StartedAt: "2026-05-09T12:00:00Z", EndedAt: "2026-05-09T12:00:00Z"},
				{Step: "Debit Sender", Status: "completed", DurationMs: 420, StartedAt: "2026-05-09T12:00:00Z", EndedAt: "2026-05-09T12:00:01Z"},
				{Step: "Submit to NIBSS", Status: "failed", DurationMs: 15000, StartedAt: "2026-05-09T12:00:01Z", EndedAt: "2026-05-09T12:00:16Z", Error: "NIBSS timeout after 15s"},
				{Step: "Reverse NIBSS", Status: "completed", DurationMs: 1200, StartedAt: "2026-05-09T12:00:16Z", EndedAt: "2026-05-09T12:00:17Z"},
				{Step: "Reverse Debit", Status: "running", DurationMs: 0, StartedAt: "2026-05-09T12:00:17Z", EndedAt: ""},
			}},
		{ID: "WF-EX-004", WorkflowID: "WF-DEF-003", WorkflowName: "KYC Onboarding Saga", RunID: "run-j0k1l2", Status: "running", CurrentStep: "Risk Score", StartedAt: "2026-05-09T12:05:00Z", CompletedAt: "", DurationMs: 35000,
			Input: map[string]interface{}{"bvn": "22012345678", "nin": "10012345678", "customerName": "Ibrahim Musa", "accountType": "savings"},
			StepResults: []StepResult{
				{Step: "Validate BVN", Status: "completed", DurationMs: 8500, StartedAt: "2026-05-09T12:05:00Z", EndedAt: "2026-05-09T12:05:08Z"},
				{Step: "Validate NIN", Status: "completed", DurationMs: 9200, StartedAt: "2026-05-09T12:05:08Z", EndedAt: "2026-05-09T12:05:18Z"},
				{Step: "Watchlist Screen", Status: "completed", DurationMs: 12000, StartedAt: "2026-05-09T12:05:18Z", EndedAt: "2026-05-09T12:05:30Z"},
				{Step: "PEP Check", Status: "completed", DurationMs: 3800, StartedAt: "2026-05-09T12:05:30Z", EndedAt: "2026-05-09T12:05:34Z"},
				{Step: "Risk Score", Status: "running", DurationMs: 0, StartedAt: "2026-05-09T12:05:34Z", EndedAt: ""},
			}},
	}

	taskQueues = []TaskQueue{
		{Name: "payments-queue", PendingTasks: 12, ActiveWorkers: 6, Throughput: 450},
		{Name: "loans-queue", PendingTasks: 3, ActiveWorkers: 2, Throughput: 25},
		{Name: "kyc-queue", PendingTasks: 8, ActiveWorkers: 4, Throughput: 120},
		{Name: "fx-queue", PendingTasks: 5, ActiveWorkers: 3, Throughput: 80},
		{Name: "trade-finance-queue", PendingTasks: 1, ActiveWorkers: 2, Throughput: 10},
	}
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "temporal-worker",
		"temporal": map[string]interface{}{
			"workflows":  len(definitions),
			"executions": len(executions),
			"taskQueues": len(taskQueues),
		},
		"middleware": middlewareConfig(),
	})
}

func handleDefinitions(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": definitions, "total": len(definitions)})
}

func handleExecutions(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	status := r.URL.Query().Get("status")
	if status != "" {
		filtered := []WorkflowExecution{}
		for _, e := range executions {
			if e.Status == status {
				filtered = append(filtered, e)
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"items": filtered, "total": len(filtered), "filter": status})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"items": executions, "total": len(executions)})
}

func handleTaskQueues(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": taskQueues, "total": len(taskQueues)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	completed := 0
	failed := 0
	running := 0
	compensating := 0
	totalDuration := int64(0)
	for _, e := range executions {
		switch e.Status {
		case "completed": completed++; totalDuration += e.DurationMs
		case "failed": failed++
		case "running": running++
		case "compensating": compensating++
		}
	}
	avgDuration := int64(0)
	if completed > 0 { avgDuration = totalDuration / int64(completed) }

	totalPending := 0
	totalWorkers := 0
	for _, tq := range taskQueues {
		totalPending += tq.PendingTasks
		totalWorkers += tq.ActiveWorkers
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"totalDefinitions": len(definitions),
		"totalExecutions":  len(executions),
		"byStatus":         map[string]int{"completed": completed, "failed": failed, "running": running, "compensating": compensating},
		"avgDurationMs":    avgDuration,
		"taskQueues":       map[string]int{"total": len(taskQueues), "pendingTasks": totalPending, "activeWorkers": totalWorkers},
		"successRate":      fmt.Sprintf("%.1f%%", float64(completed)/float64(len(executions))*100),
	})
}

func main() {
	port := getEnv("PORT", "8203")
	seedData()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/workflows", handleDefinitions)
	mux.HandleFunc("/v1/executions", handleExecutions)
	mux.HandleFunc("/v1/task-queues", handleTaskQueues)
	mux.HandleFunc("/v1/stats", handleStats)

	log.Printf("[temporal-worker] Listening on :%s with %d workflow definitions, %d executions", port, len(definitions), len(executions))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

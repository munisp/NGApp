package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

var port = getEnv("PORT", "8220")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "saga.started,saga.completed,saga.compensated,saga.failed"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "saga-state-cache,idempotency-keys"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "saga_executions,saga_steps,compensation_log"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "saga-execution-history"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476")},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "saga-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "saga-completions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "namespace": "54bank-production", "taskQueues": "nip-transfers,loan-origination,kyc-onboarding,fx-dealing,eod-processing,trade-finance"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-saga-settlement"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "saga-ledger-entries"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "saga_metrics,compensation_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/sagas/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090")},
}

type SagaDefinition struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Domain        string     `json:"domain"`
	TaskQueue     string     `json:"taskQueue"`
	Steps         []SagaStep `json:"steps"`
	TotalSteps    int        `json:"totalSteps"`
	TimeoutSec    int        `json:"timeoutSeconds"`
	RetryPolicy   RetryPolicy `json:"retryPolicy"`
}

type SagaStep struct {
	Order        int    `json:"order"`
	Activity     string `json:"activity"`
	Service      string `json:"service"`
	Compensation string `json:"compensation"`
	TimeoutSec   int    `json:"timeoutSeconds"`
}

type RetryPolicy struct {
	MaxAttempts     int    `json:"maxAttempts"`
	InitialInterval string `json:"initialInterval"`
	BackoffCoeff    float64 `json:"backoffCoefficient"`
	MaxInterval     string `json:"maxInterval"`
}

type SagaExecution struct {
	ID         string  `json:"id"`
	SagaID     string  `json:"sagaId"`
	SagaName   string  `json:"sagaName"`
	Status     string  `json:"status"`
	StartedAt  string  `json:"startedAt"`
	CompletedAt string `json:"completedAt,omitempty"`
	Duration   float64 `json:"durationMs"`
	StepsCompleted int `json:"stepsCompleted"`
	TotalSteps int    `json:"totalSteps"`
	Error      string  `json:"error,omitempty"`
	Compensated bool  `json:"compensated"`
}

var (
	definitions []SagaDefinition
	executions  []SagaExecution
	mu          sync.RWMutex
)

func init() {
	definitions = []SagaDefinition{
		{ID: "SAGA-NIP", Name: "NIP Transfer Saga", Domain: "payments", TaskQueue: "nip-transfers", TotalSteps: 7, TimeoutSec: 30,
			Steps: []SagaStep{
				{Order: 1, Activity: "ValidateTransaction", Service: "payments-hub", Compensation: "none", TimeoutSec: 5},
				{Order: 2, Activity: "CheckLimit", Service: "credit-facility", Compensation: "none", TimeoutSec: 3},
				{Order: 3, Activity: "DebitSender", Service: "tigerbeetle-ledger", Compensation: "ReverseSenderDebit", TimeoutSec: 5},
				{Order: 4, Activity: "ScreenAML", Service: "kyc-aml-screening", Compensation: "none", TimeoutSec: 5},
				{Order: 5, Activity: "SubmitToNIBSS", Service: "nibss-direct-debit", Compensation: "RecallFromNIBSS", TimeoutSec: 15},
				{Order: 6, Activity: "CreditBeneficiary", Service: "tigerbeetle-ledger", Compensation: "ReverseBeneficiaryCredit", TimeoutSec: 5},
				{Order: 7, Activity: "PostToGL", Service: "accounting-rules", Compensation: "ReverseGLEntry", TimeoutSec: 5},
			},
			RetryPolicy: RetryPolicy{MaxAttempts: 3, InitialInterval: "1s", BackoffCoeff: 2.0, MaxInterval: "30s"},
		},
		{ID: "SAGA-LOAN", Name: "Loan Origination Saga", Domain: "lending", TaskQueue: "loan-origination", TotalSteps: 8, TimeoutSec: 300,
			Steps: []SagaStep{
				{Order: 1, Activity: "ValidateApplication", Service: "loan-origination", Compensation: "none", TimeoutSec: 10},
				{Order: 2, Activity: "CreditScoreCheck", Service: "credit-bureau", Compensation: "none", TimeoutSec: 30},
				{Order: 3, Activity: "CollateralValuation", Service: "collateral-valuation", Compensation: "none", TimeoutSec: 30},
				{Order: 4, Activity: "FacilityLimitCheck", Service: "credit-facility", Compensation: "none", TimeoutSec: 10},
				{Order: 5, Activity: "MakerCheckerApproval", Service: "maker-checker", Compensation: "CancelApproval", TimeoutSec: 86400},
				{Order: 6, Activity: "CreateLoanAccount", Service: "loan-origination", Compensation: "CloseLoanAccount", TimeoutSec: 10},
				{Order: 7, Activity: "DisburseToAccount", Service: "tigerbeetle-ledger", Compensation: "ReverseDisbursement", TimeoutSec: 10},
				{Order: 8, Activity: "PostAccountingEntries", Service: "accounting-rules", Compensation: "ReverseAccounting", TimeoutSec: 10},
			},
			RetryPolicy: RetryPolicy{MaxAttempts: 2, InitialInterval: "5s", BackoffCoeff: 2.0, MaxInterval: "60s"},
		},
		{ID: "SAGA-KYC", Name: "Customer Onboarding Saga", Domain: "operations", TaskQueue: "kyc-onboarding", TotalSteps: 6, TimeoutSec: 600,
			Steps: []SagaStep{
				{Order: 1, Activity: "ValidateBVN", Service: "customer-onboarding", Compensation: "none", TimeoutSec: 30},
				{Order: 2, Activity: "ScreenWatchlists", Service: "kyc-aml-screening", Compensation: "none", TimeoutSec: 30},
				{Order: 3, Activity: "CreateCIF", Service: "cif-management", Compensation: "DeleteCIF", TimeoutSec: 10},
				{Order: 4, Activity: "OpenAccount", Service: "savings-products", Compensation: "CloseAccount", TimeoutSec: 10},
				{Order: 5, Activity: "IssueCard", Service: "card-management", Compensation: "CancelCard", TimeoutSec: 30},
				{Order: 6, Activity: "ActivateChannels", Service: "channel-management", Compensation: "DeactivateChannels", TimeoutSec: 10},
			},
			RetryPolicy: RetryPolicy{MaxAttempts: 3, InitialInterval: "2s", BackoffCoeff: 2.0, MaxInterval: "30s"},
		},
		{ID: "SAGA-EOD", Name: "EOD Processing Saga", Domain: "operations", TaskQueue: "eod-processing", TotalSteps: 5, TimeoutSec: 3600,
			Steps: []SagaStep{
				{Order: 1, Activity: "MarkEOTI", Service: "eod-processor", Compensation: "RollbackEOTI", TimeoutSec: 60},
				{Order: 2, Activity: "RunInterestAccrual", Service: "eod-processor", Compensation: "ReverseAccrual", TimeoutSec: 1200},
				{Order: 3, Activity: "RunMaturityProcessing", Service: "eod-processor", Compensation: "none", TimeoutSec: 600},
				{Order: 4, Activity: "RunGLBalancing", Service: "accounting-rules", Compensation: "none", TimeoutSec: 600},
				{Order: 5, Activity: "MarkEOFI", Service: "eod-processor", Compensation: "RollbackEOFI", TimeoutSec: 60},
			},
			RetryPolicy: RetryPolicy{MaxAttempts: 1, InitialInterval: "10s", BackoffCoeff: 1.0, MaxInterval: "10s"},
		},
	}

	executions = []SagaExecution{
		{ID: "EXEC-001", SagaID: "SAGA-NIP", SagaName: "NIP Transfer Saga", Status: "completed", StartedAt: "2026-05-10T14:30:00Z", CompletedAt: "2026-05-10T14:30:02Z", Duration: 2150, StepsCompleted: 7, TotalSteps: 7, Compensated: false},
		{ID: "EXEC-002", SagaID: "SAGA-NIP", SagaName: "NIP Transfer Saga", Status: "compensated", StartedAt: "2026-05-10T14:32:00Z", CompletedAt: "2026-05-10T14:32:18Z", Duration: 18200, StepsCompleted: 4, TotalSteps: 7, Error: "AML screening flagged — OFAC match", Compensated: true},
		{ID: "EXEC-003", SagaID: "SAGA-LOAN", SagaName: "Loan Origination Saga", Status: "completed", StartedAt: "2026-05-10T10:00:00Z", CompletedAt: "2026-05-10T10:45:00Z", Duration: 2700000, StepsCompleted: 8, TotalSteps: 8, Compensated: false},
		{ID: "EXEC-004", SagaID: "SAGA-KYC", SagaName: "Customer Onboarding Saga", Status: "running", StartedAt: "2026-05-10T16:00:00Z", Duration: 0, StepsCompleted: 3, TotalSteps: 6, Compensated: false},
		{ID: "EXEC-005", SagaID: "SAGA-EOD", SagaName: "EOD Processing Saga", Status: "completed", StartedAt: "2026-05-09T22:00:00Z", CompletedAt: "2026-05-09T22:06:12Z", Duration: 372000, StepsCompleted: 5, TotalSteps: 5, Compensated: false},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "temporal-sagas")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		running := 0
		for _, e := range executions { if e.Status == "running" { running++ } }
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "temporal-sagas",
			"sagas": map[string]int{"definitions": len(definitions), "executions": len(executions), "running": running},
			"middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/definitions", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": definitions, "total": len(definitions)}) })
	mux.HandleFunc("/v1/executions", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": executions, "total": len(executions)}) })
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		completed, compensated, running := 0, 0, 0
		for _, e := range executions {
			switch e.Status {
			case "completed": completed++
			case "compensated": compensated++
			case "running": running++
			}
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalDefinitions": len(definitions), "totalExecutions": len(executions),
			"byStatus": map[string]int{"completed": completed, "compensated": compensated, "running": running},
			"taskQueues": []string{"nip-transfers", "loan-origination", "kyc-onboarding", "fx-dealing", "eod-processing", "trade-finance"},
			"compensationRate": float64(compensated) / float64(len(executions)) * 100,
		})
	})

	log.Printf("[temporal-sagas] Listening on :%s with %d saga definitions, %d executions\n", port, len(definitions), len(executions))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

var port = getEnv("PORT", "8207")

// Full 14-stack middleware integration
var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "eod.interest-accrual,eod.maturity-processing,eod.gl-balancing,eod.revaluation,eod.statements,eod.regulatory"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "batch-progress-cache,lock-manager"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "eod_runs,eod_batch_steps,eod_errors,eod_audit_log"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "eod-audit-trail"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "eod-operator"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "eod:run,eod:approve,eod:cancel"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "eod-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "eod-step-completions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "EODProcessingWorkflow", "taskQueue": "eod-processing"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "settlement-finalization"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "double-entry-posting-verification"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "eod_history,interest_accruals,maturity_events"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/eod/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "eod-batch-protection"},
}

// EOD Batch Step definition
type BatchStep struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Order        int     `json:"order"`
	Category     string  `json:"category"`
	Status       string  `json:"status"`
	Duration     float64 `json:"durationSeconds"`
	RecordsTotal int     `json:"recordsProcessed"`
	ErrorCount   int     `json:"errorCount"`
	DependsOn    []string `json:"dependsOn"`
}

// EOD Run represents a full EOD execution
type EODRun struct {
	ID            string      `json:"id"`
	BusinessDate  string      `json:"businessDate"`
	Status        string      `json:"status"`
	StartedAt     string      `json:"startedAt"`
	CompletedAt   string      `json:"completedAt,omitempty"`
	TotalDuration float64     `json:"totalDurationSeconds"`
	Steps         []BatchStep `json:"steps"`
	Summary       EODSummary  `json:"summary"`
	InitiatedBy   string      `json:"initiatedBy"`
	ApprovedBy    string      `json:"approvedBy"`
}

type EODSummary struct {
	TotalSteps       int     `json:"totalSteps"`
	CompletedSteps   int     `json:"completedSteps"`
	FailedSteps      int     `json:"failedSteps"`
	SkippedSteps     int     `json:"skippedSteps"`
	TotalRecords     int     `json:"totalRecords"`
	TotalErrors      int     `json:"totalErrors"`
	InterestAccrued  float64 `json:"interestAccruedNGN"`
	MaturitiesProc   int     `json:"maturitiesProcessed"`
	StatementsGen    int     `json:"statementsGenerated"`
	GLEntriesPosted  int     `json:"glEntriesPosted"`
	RevalPnL         float64 `json:"revaluationPnLNGN"`
	RegulatoryExtr   int     `json:"regulatoryExtracts"`
}

// Seeded EOD batch steps — the full EOD pipeline
var eodSteps = []BatchStep{
	{ID: "STEP-001", Name: "EOTI Mark", Description: "Mark End-of-Transaction-Input — no more customer transactions accepted", Order: 1, Category: "control", Status: "completed", Duration: 0.5, RecordsTotal: 1, DependsOn: []string{}},
	{ID: "STEP-002", Name: "Interest Accrual — Savings", Description: "Calculate daily interest on all savings accounts using 365-day basis", Order: 2, Category: "interest", Status: "completed", Duration: 45.2, RecordsTotal: 1245000, ErrorCount: 12, DependsOn: []string{"STEP-001"}},
	{ID: "STEP-003", Name: "Interest Accrual — Loans", Description: "Calculate daily interest on all loan accounts (reducing balance method)", Order: 3, Category: "interest", Status: "completed", Duration: 38.7, RecordsTotal: 456000, ErrorCount: 3, DependsOn: []string{"STEP-001"}},
	{ID: "STEP-004", Name: "Interest Accrual — Fixed Deposits", Description: "Accrue interest on term deposits (matured and running)", Order: 4, Category: "interest", Status: "completed", Duration: 12.3, RecordsTotal: 89000, ErrorCount: 0, DependsOn: []string{"STEP-001"}},
	{ID: "STEP-005", Name: "Interest Accrual — Overdrafts", Description: "Calculate penalty interest on overdrawn accounts", Order: 5, Category: "interest", Status: "completed", Duration: 5.1, RecordsTotal: 23000, ErrorCount: 1, DependsOn: []string{"STEP-001"}},
	{ID: "STEP-006", Name: "Maturity Processing — Auto Rollover", Description: "Auto-rollover matured FDs per product config", Order: 6, Category: "maturity", Status: "completed", Duration: 8.4, RecordsTotal: 1200, ErrorCount: 0, DependsOn: []string{"STEP-004"}},
	{ID: "STEP-007", Name: "Maturity Processing — Auto Closure", Description: "Close matured deposits with payout to linked account", Order: 7, Category: "maturity", Status: "completed", Duration: 6.2, RecordsTotal: 450, ErrorCount: 2, DependsOn: []string{"STEP-004"}},
	{ID: "STEP-008", Name: "Standing Instructions Execution", Description: "Execute all standing instructions due today (transfers, payments, sweeps)", Order: 8, Category: "payments", Status: "completed", Duration: 22.1, RecordsTotal: 34500, ErrorCount: 156, DependsOn: []string{"STEP-001"}},
	{ID: "STEP-009", Name: "FX Revaluation", Description: "Revalue foreign currency account balances using closing rates", Order: 9, Category: "revaluation", Status: "completed", Duration: 15.8, RecordsTotal: 67800, ErrorCount: 0, DependsOn: []string{"STEP-005"}},
	{ID: "STEP-010", Name: "GL Balancing", Description: "Verify all GL accounts balance (total debits = total credits)", Order: 10, Category: "accounting", Status: "completed", Duration: 28.5, RecordsTotal: 2340000, ErrorCount: 0, DependsOn: []string{"STEP-002", "STEP-003", "STEP-004", "STEP-005", "STEP-009"}},
	{ID: "STEP-011", Name: "Account Status Update", Description: "Mark dormant accounts (no activity >12 months), frozen accounts, closed accounts", Order: 11, Category: "maintenance", Status: "completed", Duration: 18.3, RecordsTotal: 890000, ErrorCount: 45, DependsOn: []string{"STEP-001"}},
	{ID: "STEP-012", Name: "Accounting Entry Posting", Description: "Post all deferred accounting entries to GL (interest, fees, charges)", Order: 12, Category: "accounting", Status: "completed", Duration: 35.6, RecordsTotal: 4560000, ErrorCount: 8, DependsOn: []string{"STEP-010"}},
	{ID: "STEP-013", Name: "Statement Generation", Description: "Generate monthly statements for accounts with statement date = today", Order: 13, Category: "reporting", Status: "completed", Duration: 42.0, RecordsTotal: 125000, ErrorCount: 23, DependsOn: []string{"STEP-012"}},
	{ID: "STEP-014", Name: "Regulatory Extract — CBN eFASS", Description: "Generate daily regulatory data extract for CBN", Order: 14, Category: "regulatory", Status: "completed", Duration: 18.9, RecordsTotal: 1, ErrorCount: 0, DependsOn: []string{"STEP-012"}},
	{ID: "STEP-015", Name: "Regulatory Extract — NDIC", Description: "Generate NDIC deposit insurance data", Order: 15, Category: "regulatory", Status: "completed", Duration: 8.4, RecordsTotal: 1, ErrorCount: 0, DependsOn: []string{"STEP-012"}},
	{ID: "STEP-016", Name: "Regulatory Extract — AML/CTR", Description: "Generate Currency Transaction Reports for transactions > ₦5M", Order: 16, Category: "regulatory", Status: "completed", Duration: 12.1, RecordsTotal: 3400, ErrorCount: 0, DependsOn: []string{"STEP-012"}},
	{ID: "STEP-017", Name: "Audit Trail Finalization", Description: "Write EOD audit trail to immutable log and OpenSearch", Order: 17, Category: "audit", Status: "completed", Duration: 5.3, RecordsTotal: 1, ErrorCount: 0, DependsOn: []string{"STEP-016"}},
	{ID: "STEP-018", Name: "EOFI Mark", Description: "Mark End-of-Financial-Input — no more financial entries for the day", Order: 18, Category: "control", Status: "completed", Duration: 0.3, RecordsTotal: 1, ErrorCount: 0, DependsOn: []string{"STEP-017"}},
}

// Seeded EOD run history
var eodRuns []EODRun
var mu sync.RWMutex

func init() {
	totalRecords := 0
	totalErrors := 0
	totalDuration := 0.0
	for _, s := range eodSteps {
		totalRecords += s.RecordsTotal
		totalErrors += s.ErrorCount
		totalDuration += s.Duration
	}
	interestAccrued := 45200000.0 + 128900000.0 + 12340000.0 + 3450000.0 // savings + loans + FD + overdraft

	eodRuns = []EODRun{
		{
			ID: "EOD-2026-05-10", BusinessDate: "2026-05-10", Status: "completed",
			StartedAt: "2026-05-10T22:00:00Z", CompletedAt: "2026-05-10T22:05:43Z",
			TotalDuration: totalDuration, Steps: eodSteps, InitiatedBy: "system-scheduler",
			ApprovedBy: "chief-operations-officer",
			Summary: EODSummary{
				TotalSteps: 18, CompletedSteps: 18, FailedSteps: 0, SkippedSteps: 0,
				TotalRecords: totalRecords, TotalErrors: totalErrors,
				InterestAccrued: interestAccrued, MaturitiesProc: 1650,
				StatementsGen: 125000, GLEntriesPosted: 4560000,
				RevalPnL: -2340000.50, RegulatoryExtr: 3,
			},
		},
		{
			ID: "EOD-2026-05-09", BusinessDate: "2026-05-09", Status: "completed",
			StartedAt: "2026-05-09T22:00:00Z", CompletedAt: "2026-05-09T22:06:12Z",
			TotalDuration: 372.0, Steps: eodSteps, InitiatedBy: "system-scheduler",
			ApprovedBy: "chief-operations-officer",
			Summary: EODSummary{
				TotalSteps: 18, CompletedSteps: 18, FailedSteps: 0, SkippedSteps: 0,
				TotalRecords: 9750000, TotalErrors: 198,
				InterestAccrued: 188450000.0, MaturitiesProc: 1580,
				StatementsGen: 0, GLEntriesPosted: 4320000,
				RevalPnL: 1890000.25, RegulatoryExtr: 3,
			},
		},
		{
			ID: "EOD-2026-05-08", BusinessDate: "2026-05-08", Status: "completed_with_errors",
			StartedAt: "2026-05-08T22:00:00Z", CompletedAt: "2026-05-08T22:07:45Z",
			TotalDuration: 465.0, Steps: eodSteps, InitiatedBy: "system-scheduler",
			ApprovedBy: "head-of-operations",
			Summary: EODSummary{
				TotalSteps: 18, CompletedSteps: 17, FailedSteps: 1, SkippedSteps: 0,
				TotalRecords: 9680000, TotalErrors: 342,
				InterestAccrued: 187200000.0, MaturitiesProc: 1520,
				StatementsGen: 124500, GLEntriesPosted: 4280000,
				RevalPnL: -890000.75, RegulatoryExtr: 2,
			},
		},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Tenant-Id", "54bank-main")
	w.Header().Set("X-Service", "eod-processor")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		lastRun := eodRuns[0]
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "eod-processor",
			"lastEOD": map[string]interface{}{
				"businessDate": lastRun.BusinessDate, "status": lastRun.Status,
				"duration": fmt.Sprintf("%.1fs", lastRun.TotalDuration),
			},
			"pipeline": map[string]int{"totalSteps": 18, "categories": 7},
			"middleware": middlewareConfig,
		})
	})

	// List EOD runs
	mux.HandleFunc("/v1/eod-runs", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		jsonResponse(w, 200, map[string]interface{}{
			"items": eodRuns, "total": len(eodRuns),
		})
	})

	// Get specific EOD run
	mux.HandleFunc("/v1/eod-runs/", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[len("/v1/eod-runs/"):]
		mu.RLock()
		defer mu.RUnlock()
		for _, run := range eodRuns {
			if run.ID == id {
				jsonResponse(w, 200, run)
				return
			}
		}
		jsonResponse(w, 404, map[string]string{"error": "EOD run not found"})
	})

	// EOD stats
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		totalInterest := 0.0
		totalMaturities := 0
		totalStatements := 0
		totalGLEntries := 0
		totalRevalPnL := 0.0
		for _, run := range eodRuns {
			totalInterest += run.Summary.InterestAccrued
			totalMaturities += run.Summary.MaturitiesProc
			totalStatements += run.Summary.StatementsGen
			totalGLEntries += run.Summary.GLEntriesPosted
			totalRevalPnL += run.Summary.RevalPnL
		}
		avgDuration := 0.0
		for _, run := range eodRuns {
			avgDuration += run.TotalDuration
		}
		avgDuration /= float64(len(eodRuns))

		jsonResponse(w, 200, map[string]interface{}{
			"totalRuns":              len(eodRuns),
			"avgDurationSeconds":     math.Round(avgDuration*100) / 100,
			"totalInterestAccrued":   totalInterest,
			"totalMaturitiesProcessed": totalMaturities,
			"totalStatementsGenerated": totalStatements,
			"totalGLEntriesPosted":   totalGLEntries,
			"totalRevaluationPnL":    totalRevalPnL,
			"pipelineSteps":          18,
			"pipelineCategories":     []string{"control", "interest", "maturity", "payments", "revaluation", "accounting", "maintenance", "reporting", "regulatory", "audit"},
		})
	})

	// Get current pipeline definition
	mux.HandleFunc("/v1/pipeline", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]interface{}{
			"steps": eodSteps, "total": len(eodSteps),
			"dependencyGraph": buildDependencyGraph(),
		})
	})

	// Trigger new EOD run
	mux.HandleFunc("/v1/eod-runs/trigger", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonResponse(w, 405, map[string]string{"error": "Method not allowed"})
			return
		}
		var req struct {
			BusinessDate string `json:"businessDate"`
			InitiatedBy  string `json:"initiatedBy"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.BusinessDate == "" {
			req.BusinessDate = time.Now().Format("2006-01-02")
		}
		if req.InitiatedBy == "" {
			req.InitiatedBy = "manual-trigger"
		}

		mu.Lock()
		newRun := EODRun{
			ID: fmt.Sprintf("EOD-%s", req.BusinessDate), BusinessDate: req.BusinessDate,
			Status: "running", StartedAt: time.Now().UTC().Format(time.RFC3339),
			Steps: eodSteps, InitiatedBy: req.InitiatedBy,
			Summary: EODSummary{TotalSteps: 18},
		}
		eodRuns = append([]EODRun{newRun}, eodRuns...)
		mu.Unlock()

		jsonResponse(w, 201, newRun)
	})

	log.Printf("[eod-processor] Listening on :%s with %d pipeline steps, %d historical runs\n", port, len(eodSteps), len(eodRuns))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func buildDependencyGraph() map[string][]string {
	graph := make(map[string][]string)
	for _, s := range eodSteps {
		graph[s.ID] = s.DependsOn
	}
	return graph
}

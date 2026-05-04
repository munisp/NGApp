package domestic

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"
)

// ============================================================
// 2. Settlement Reconciliation Engine
// ============================================================

// ReconciliationStatus represents the outcome of a reconciliation run
type ReconciliationStatus string

const (
	ReconMatched    ReconciliationStatus = "MATCHED"
	ReconMismatched ReconciliationStatus = "MISMATCHED"
	ReconPending    ReconciliationStatus = "PENDING"
	ReconInProgress ReconciliationStatus = "IN_PROGRESS"
)

// ReconciliationRecord represents a single reconciliation entry
type ReconciliationRecord struct {
	ID                string               `json:"id"`
	SettlementDate    time.Time            `json:"settlementDate"`
	Product           string               `json:"product"` // NIP, NEFT, NACS, NDD
	Bank              string               `json:"bank"`
	BankCode          string               `json:"bankCode"`
	LedgerAmount      int64                `json:"ledgerAmount"`      // TigerBeetle
	SettlementAmount  int64                `json:"settlementAmount"`  // NIBSS file
	BankConfirmAmount int64                `json:"bankConfirmAmount"` // Bank confirmation
	Status            ReconciliationStatus `json:"status"`
	Discrepancy       int64                `json:"discrepancy"`
	DiscrepancyPct    float64              `json:"discrepancyPct"`
	AutoResolved      bool                 `json:"autoResolved"`
	ResolvedAt        *time.Time           `json:"resolvedAt"`
	Notes             string               `json:"notes"`
}

// SettlementReconciliationEngine handles end-of-day reconciliation
type SettlementReconciliationEngine struct {
	mu      sync.RWMutex
	records []ReconciliationRecord

	// Kafka topics for event emission
	kafkaReconciliationTopic string
	// TigerBeetle connection for ledger queries
	tigerBeetleEndpoint string
	// PostgreSQL for persistence
	postgresConnStr string
	// OpenSearch for indexing
	openSearchEndpoint string
	// Temporal for workflow orchestration
	temporalNamespace string
}

// NewSettlementReconciliationEngine creates a new reconciliation engine
func NewSettlementReconciliationEngine() *SettlementReconciliationEngine {
	return &SettlementReconciliationEngine{
		records:                  make([]ReconciliationRecord, 0),
		kafkaReconciliationTopic: "nibss-settlement-reconciliation",
		tigerBeetleEndpoint:      "tigerbeetle://localhost:3001",
		postgresConnStr:          "postgres://localhost:5432/nibss_recon",
		openSearchEndpoint:       "https://localhost:9200",
		temporalNamespace:        "nibss-reconciliation",
	}
}

// RunReconciliation performs end-of-day reconciliation for a given date and product
func (e *SettlementReconciliationEngine) RunReconciliation(ctx context.Context, date time.Time, product string) ([]ReconciliationRecord, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Step 1: Query TigerBeetle for all ledger entries on the date
	ledgerEntries := e.queryTigerBeetleLedger(ctx, date, product)

	// Step 2: Parse NIBSS settlement file
	settlementEntries := e.parseNIBSSSettlementFile(ctx, date, product)

	// Step 3: Fetch bank confirmation responses
	bankConfirmations := e.fetchBankConfirmations(ctx, date, product)

	// Step 4: Three-way match
	results := e.threeWayMatch(ledgerEntries, settlementEntries, bankConfirmations)

	// Step 5: Auto-resolve minor discrepancies (< 0.01%)
	for i := range results {
		if results[i].DiscrepancyPct < 0.01 && results[i].Status == ReconMismatched {
			results[i].AutoResolved = true
			now := time.Now()
			results[i].ResolvedAt = &now
			results[i].Notes = "Auto-resolved: discrepancy below 0.01% threshold"
			results[i].Status = ReconMatched
		}
	}

	// Step 6: Emit events to Kafka for unresolved discrepancies
	for _, r := range results {
		if r.Status == ReconMismatched && !r.AutoResolved {
			e.emitReconciliationEvent(ctx, r)
		}
	}

	e.records = append(e.records, results...)
	return results, nil
}

func (e *SettlementReconciliationEngine) queryTigerBeetleLedger(_ context.Context, _ time.Time, _ string) map[string]int64 {
	return map[string]int64{
		"044": 50_000_000_000,
		"058": 35_000_000_000,
		"057": 42_000_000_000,
		"011": 28_000_000_000,
		"033": 31_000_000_000,
	}
}

func (e *SettlementReconciliationEngine) parseNIBSSSettlementFile(_ context.Context, _ time.Time, _ string) map[string]int64 {
	return map[string]int64{
		"044": 50_000_000_000,
		"058": 35_000_000_000,
		"057": 42_000_050_000, // Small discrepancy
		"011": 28_000_000_000,
		"033": 31_000_000_000,
	}
}

func (e *SettlementReconciliationEngine) fetchBankConfirmations(_ context.Context, _ time.Time, _ string) map[string]int64 {
	return map[string]int64{
		"044": 50_000_000_000,
		"058": 35_000_000_000,
		"057": 42_000_000_000,
		"011": 28_000_000_000,
		"033": 31_000_000_000,
	}
}

func (e *SettlementReconciliationEngine) threeWayMatch(ledger, settlement, bank map[string]int64) []ReconciliationRecord {
	banks := map[string]string{
		"044": "Access Bank", "058": "GTBank", "057": "Zenith Bank",
		"011": "First Bank", "033": "UBA",
	}

	var results []ReconciliationRecord
	for code, name := range banks {
		l := ledger[code]
		s := settlement[code]
		b := bank[code]

		disc := maxAbs(l-s, l-b, s-b)
		pct := 0.0
		if l > 0 {
			pct = math.Abs(float64(disc)) / float64(l) * 100
		}

		status := ReconMatched
		if disc != 0 {
			status = ReconMismatched
		}

		results = append(results, ReconciliationRecord{
			ID:                fmt.Sprintf("RECON-%s-%d", code, time.Now().UnixMilli()),
			SettlementDate:    time.Now(),
			Product:           "NIP",
			Bank:              name,
			BankCode:          code,
			LedgerAmount:      l,
			SettlementAmount:  s,
			BankConfirmAmount: b,
			Status:            status,
			Discrepancy:       disc,
			DiscrepancyPct:    pct,
		})
	}
	return results
}

func maxAbs(values ...int64) int64 {
	m := values[0]
	for _, v := range values[1:] {
		if abs64(v) > abs64(m) {
			m = v
		}
	}
	return m
}

func abs64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

func (e *SettlementReconciliationEngine) emitReconciliationEvent(_ context.Context, _ ReconciliationRecord) {
	// Emit to Kafka topic: nibss-settlement-reconciliation
}

// ============================================================
// 3. SLA Monitoring & Alerting
// ============================================================

type SLARule struct {
	ID          string        `json:"id"`
	Product     string        `json:"product"`
	Metric      string        `json:"metric"`     // response_time, success_rate, clearing_window
	Threshold   float64       `json:"threshold"`   // e.g., 5000 (ms) or 99.5 (%)
	Window      time.Duration `json:"window"`      // evaluation window
	Severity    string        `json:"severity"`    // WARNING, CRITICAL
	EscalateTo  string        `json:"escalateTo"`  // ops_team, cbn_admin, bank_ops
}

type SLABreach struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"ruleId"`
	Product     string    `json:"product"`
	Bank        string    `json:"bank"`
	Metric      string    `json:"metric"`
	Threshold   float64   `json:"threshold"`
	ActualValue float64   `json:"actualValue"`
	Severity    string    `json:"severity"`
	Status      string    `json:"status"` // OPEN, ACKNOWLEDGED, RESOLVED
	DetectedAt  time.Time `json:"detectedAt"`
	ResolvedAt  *time.Time `json:"resolvedAt"`
}

type SLAMonitor struct {
	mu       sync.RWMutex
	rules    []SLARule
	breaches []SLABreach
}

func NewSLAMonitor() *SLAMonitor {
	return &SLAMonitor{
		rules: []SLARule{
			{ID: "SLA-NIP-RT", Product: "NIP", Metric: "response_time_p99", Threshold: 5000, Window: 5 * time.Minute, Severity: "CRITICAL", EscalateTo: "ops_team"},
			{ID: "SLA-NIP-SR", Product: "NIP", Metric: "success_rate", Threshold: 99.5, Window: 15 * time.Minute, Severity: "WARNING", EscalateTo: "ops_team"},
			{ID: "SLA-NEFT-CW", Product: "NEFT", Metric: "clearing_window", Threshold: 4, Window: 1 * time.Hour, Severity: "CRITICAL", EscalateTo: "cbn_admin"},
			{ID: "SLA-NACS-CW", Product: "NACS", Metric: "clearing_window", Threshold: 24, Window: 24 * time.Hour, Severity: "CRITICAL", EscalateTo: "cbn_admin"},
			{ID: "SLA-NDD-EXEC", Product: "NDD", Metric: "execution_time", Threshold: 30000, Window: 1 * time.Hour, Severity: "WARNING", EscalateTo: "bank_ops"},
			{ID: "SLA-DISPUTE-SLA", Product: "DISPUTES", Metric: "resolution_time", Threshold: 72, Window: 24 * time.Hour, Severity: "CRITICAL", EscalateTo: "cbn_admin"},
			{ID: "SLA-REVERSAL-RT", Product: "REVERSALS", Metric: "processing_time", Threshold: 300000, Window: 30 * time.Minute, Severity: "WARNING", EscalateTo: "ops_team"},
		},
		breaches: make([]SLABreach, 0),
	}
}

func (m *SLAMonitor) EvaluateSLA(_ context.Context, product, metric string, value float64, bank string) *SLABreach {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, rule := range m.rules {
		if rule.Product != product || rule.Metric != metric {
			continue
		}

		breached := false
		switch metric {
		case "response_time_p99", "execution_time", "processing_time", "clearing_window", "resolution_time":
			breached = value > rule.Threshold
		case "success_rate":
			breached = value < rule.Threshold
		}

		if breached {
			breach := SLABreach{
				ID:          fmt.Sprintf("BREACH-%d", time.Now().UnixMilli()),
				RuleID:      rule.ID,
				Product:     product,
				Bank:        bank,
				Metric:      metric,
				Threshold:   rule.Threshold,
				ActualValue: value,
				Severity:    rule.Severity,
				Status:      "OPEN",
				DetectedAt:  time.Now(),
			}
			m.breaches = append(m.breaches, breach)
			return &breach
		}
	}
	return nil
}

// ============================================================
// 4. Participant Health Scorecard
// ============================================================

type ParticipantHealth struct {
	BankCode          string  `json:"bankCode"`
	BankName          string  `json:"bankName"`
	AvailabilityPct   float64 `json:"availabilityPct"`
	SuccessRate       float64 `json:"successRate"`
	AvgResponseMs     float64 `json:"avgResponseMs"`
	P99ResponseMs     float64 `json:"p99ResponseMs"`
	DisputeRate       float64 `json:"disputeRate"`
	ReversalRate      float64 `json:"reversalRate"`
	OverallScore      float64 `json:"overallScore"` // 0-100
	Tier              string  `json:"tier"`          // EXCELLENT, GOOD, FAIR, POOR
	TrendDirection    string  `json:"trendDirection"` // UP, DOWN, STABLE
	LastUpdated       time.Time `json:"lastUpdated"`
}

func CalculateHealthScore(avail, success, avgResp, disputeRate, reversalRate float64) (float64, string) {
	// Weighted scoring
	score := avail*0.25 + success*0.25 + (100-math.Min(avgResp/50, 100))*0.20 + (100-disputeRate*1000)*0.15 + (100-reversalRate*1000)*0.15
	score = math.Max(0, math.Min(100, score))

	tier := "POOR"
	if score >= 95 {
		tier = "EXCELLENT"
	} else if score >= 85 {
		tier = "GOOD"
	} else if score >= 70 {
		tier = "FAIR"
	}
	return score, tier
}

// ============================================================
// 11. Multi-Approval Workflows (Maker-Checker)
// ============================================================

type ApprovalLevel struct {
	Level    int    `json:"level"`
	Role     string `json:"role"`
	Required int    `json:"required"` // Number of approvers needed
}

type ApprovalPolicy struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Product         string          `json:"product"`
	MinAmount       int64           `json:"minAmount"`
	MaxAmount       int64           `json:"maxAmount"`
	Levels          []ApprovalLevel `json:"levels"`
}

type ApprovalRequest struct {
	ID            string          `json:"id"`
	PolicyID      string          `json:"policyId"`
	TransactionID string          `json:"transactionId"`
	Product       string          `json:"product"`
	Amount        int64           `json:"amount"`
	RequestedBy   string          `json:"requestedBy"`
	Status        string          `json:"status"` // PENDING, APPROVED, REJECTED
	Approvals     []ApprovalEntry `json:"approvals"`
	CreatedAt     time.Time       `json:"createdAt"`
	CompletedAt   *time.Time      `json:"completedAt"`
}

type ApprovalEntry struct {
	Approver  string    `json:"approver"`
	Role      string    `json:"role"`
	Level     int       `json:"level"`
	Decision  string    `json:"decision"` // APPROVED, REJECTED
	Comment   string    `json:"comment"`
	Timestamp time.Time `json:"timestamp"`
}

type ApprovalWorkflowEngine struct {
	mu       sync.RWMutex
	policies []ApprovalPolicy
	requests []ApprovalRequest
}

func NewApprovalWorkflowEngine() *ApprovalWorkflowEngine {
	return &ApprovalWorkflowEngine{
		policies: []ApprovalPolicy{
			{
				ID: "POL-NIP-HIGH", Name: "NIP High Value", Product: "NIP",
				MinAmount: 50_000_000, MaxAmount: 999_999_999_999,
				Levels: []ApprovalLevel{
					{Level: 1, Role: "bank_ops", Required: 1},
					{Level: 2, Role: "bank_compliance", Required: 1},
				},
			},
			{
				ID: "POL-NIP-ULTRA", Name: "NIP Ultra High Value", Product: "NIP",
				MinAmount: 1_000_000_000, MaxAmount: 999_999_999_999,
				Levels: []ApprovalLevel{
					{Level: 1, Role: "bank_ops", Required: 1},
					{Level: 2, Role: "bank_compliance", Required: 1},
					{Level: 3, Role: "cbn_admin", Required: 2},
				},
			},
			{
				ID: "POL-NEFT-BATCH", Name: "NEFT Large Batch", Product: "NEFT",
				MinAmount: 500_000_000, MaxAmount: 999_999_999_999,
				Levels: []ApprovalLevel{
					{Level: 1, Role: "bank_ops", Required: 1},
					{Level: 2, Role: "bank_treasury", Required: 1},
				},
			},
		},
		requests: make([]ApprovalRequest, 0),
	}
}

func (e *ApprovalWorkflowEngine) SubmitForApproval(_ context.Context, txnID, product, requestedBy string, amount int64) (*ApprovalRequest, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	var matchedPolicy *ApprovalPolicy
	for i := range e.policies {
		p := &e.policies[i]
		if p.Product == product && amount >= p.MinAmount && amount <= p.MaxAmount {
			matchedPolicy = p
		}
	}

	if matchedPolicy == nil {
		return nil, fmt.Errorf("no approval policy found for %s amount %d", product, amount)
	}

	req := ApprovalRequest{
		ID:            fmt.Sprintf("APRV-%d", time.Now().UnixMilli()),
		PolicyID:      matchedPolicy.ID,
		TransactionID: txnID,
		Product:       product,
		Amount:        amount,
		RequestedBy:   requestedBy,
		Status:        "PENDING",
		Approvals:     make([]ApprovalEntry, 0),
		CreatedAt:     time.Now(),
	}
	e.requests = append(e.requests, req)
	return &req, nil
}

// ============================================================
// 14. Circuit Breaker per Bank
// ============================================================

type CircuitState string

const (
	CircuitClosed   CircuitState = "CLOSED"
	CircuitOpen     CircuitState = "OPEN"
	CircuitHalfOpen CircuitState = "HALF_OPEN"
)

type BankCircuitBreaker struct {
	BankCode        string       `json:"bankCode"`
	BankName        string       `json:"bankName"`
	State           CircuitState `json:"state"`
	FailureCount    int          `json:"failureCount"`
	SuccessCount    int          `json:"successCount"`
	TotalRequests   int          `json:"totalRequests"`
	FailureRate     float64      `json:"failureRate"`
	Threshold       float64      `json:"threshold"` // 5%
	MinRequests     int          `json:"minRequests"` // Minimum requests before evaluating
	CooldownPeriod  time.Duration `json:"cooldownPeriod"`
	LastFailureAt   *time.Time   `json:"lastFailureAt"`
	OpenedAt        *time.Time   `json:"openedAt"`
	HalfOpenAt      *time.Time   `json:"halfOpenAt"`
}

type CircuitBreakerManager struct {
	mu       sync.RWMutex
	breakers map[string]*BankCircuitBreaker
}

func NewCircuitBreakerManager() *CircuitBreakerManager {
	banks := map[string]string{
		"044": "Access Bank", "058": "GTBank", "057": "Zenith Bank",
		"011": "First Bank", "033": "UBA", "050": "Ecobank",
		"035": "Wema Bank", "215": "Unity Bank",
	}

	breakers := make(map[string]*BankCircuitBreaker)
	for code, name := range banks {
		breakers[code] = &BankCircuitBreaker{
			BankCode:       code,
			BankName:       name,
			State:          CircuitClosed,
			Threshold:      5.0,
			MinRequests:    100,
			CooldownPeriod: 5 * time.Minute,
		}
	}

	return &CircuitBreakerManager{breakers: breakers}
}

func (m *CircuitBreakerManager) RecordResult(bankCode string, success bool) CircuitState {
	m.mu.Lock()
	defer m.mu.Unlock()

	cb, ok := m.breakers[bankCode]
	if !ok {
		return CircuitClosed
	}

	cb.TotalRequests++
	if success {
		cb.SuccessCount++
	} else {
		cb.FailureCount++
		now := time.Now()
		cb.LastFailureAt = &now
	}

	if cb.TotalRequests > 0 {
		cb.FailureRate = float64(cb.FailureCount) / float64(cb.TotalRequests) * 100
	}

	switch cb.State {
	case CircuitClosed:
		if cb.TotalRequests >= cb.MinRequests && cb.FailureRate > cb.Threshold {
			cb.State = CircuitOpen
			now := time.Now()
			cb.OpenedAt = &now
		}
	case CircuitOpen:
		if cb.OpenedAt != nil && time.Since(*cb.OpenedAt) > cb.CooldownPeriod {
			cb.State = CircuitHalfOpen
			now := time.Now()
			cb.HalfOpenAt = &now
			cb.FailureCount = 0
			cb.SuccessCount = 0
			cb.TotalRequests = 0
		}
	case CircuitHalfOpen:
		if success {
			cb.State = CircuitClosed
			cb.FailureCount = 0
			cb.TotalRequests = 0
			cb.OpenedAt = nil
			cb.HalfOpenAt = nil
		} else {
			cb.State = CircuitOpen
			now := time.Now()
			cb.OpenedAt = &now
		}
	}

	return cb.State
}

// ============================================================
// 16. Batch Processing Optimization
// ============================================================

type BatchProcessingConfig struct {
	Product         string `json:"product"`
	MaxConcurrency  int    `json:"maxConcurrency"`
	BatchSize       int    `json:"batchSize"`
	RetryAttempts   int    `json:"retryAttempts"`
	TimeoutMs       int    `json:"timeoutMs"`
	PriorityQueue   bool   `json:"priorityQueue"`
}

type BatchProcessingStats struct {
	Product           string  `json:"product"`
	TotalBatches      int     `json:"totalBatches"`
	ProcessedBatches  int     `json:"processedBatches"`
	FailedBatches     int     `json:"failedBatches"`
	AvgProcessingMs   float64 `json:"avgProcessingMs"`
	Throughput        float64 `json:"throughput"` // items per second
	ConcurrencyUsed   int     `json:"concurrencyUsed"`
}

func DefaultBatchConfigs() []BatchProcessingConfig {
	return []BatchProcessingConfig{
		{Product: "NEFT", MaxConcurrency: 32, BatchSize: 500, RetryAttempts: 3, TimeoutMs: 30000, PriorityQueue: true},
		{Product: "NACS", MaxConcurrency: 16, BatchSize: 200, RetryAttempts: 2, TimeoutMs: 60000, PriorityQueue: false},
		{Product: "BULK", MaxConcurrency: 64, BatchSize: 1000, RetryAttempts: 3, TimeoutMs: 15000, PriorityQueue: true},
		{Product: "NDD", MaxConcurrency: 24, BatchSize: 300, RetryAttempts: 3, TimeoutMs: 45000, PriorityQueue: false},
	}
}

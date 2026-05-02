// Package fraud provides production-ready fraud detection and prevention
// with comprehensive model lifecycle management, enforcement, and analytics
package fraud

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"
)

// =============================================================================
// PHASE 1: Fraud Prevention Enforcement
// =============================================================================

// FraudEnforcementAction represents an enforcement action
type FraudEnforcementAction string

const (
	EnforcementActionAllow      FraudEnforcementAction = "ALLOW"
	EnforcementActionHold       FraudEnforcementAction = "HOLD"
	EnforcementActionBlock      FraudEnforcementAction = "BLOCK"
	EnforcementActionStepUp     FraudEnforcementAction = "STEP_UP"
	EnforcementActionLimitReduce FraudEnforcementAction = "LIMIT_REDUCE"
	EnforcementActionFreeze     FraudEnforcementAction = "FREEZE"
)

// EnforcementDecision represents a fraud enforcement decision
type EnforcementDecision struct {
	DecisionID      string                 `json:"decision_id"`
	TransferID      string                 `json:"transfer_id"`
	AccountID       string                 `json:"account_id"`
	Action          FraudEnforcementAction `json:"action"`
	RiskScore       float64                `json:"risk_score"`
	TriggeredRules  []string               `json:"triggered_rules"`
	MLScore         *float64               `json:"ml_score,omitempty"`
	ModelVersion    string                 `json:"model_version"`
	RuleVersion     string                 `json:"rule_version"`
	Reason          string                 `json:"reason"`
	Idempotent      bool                   `json:"idempotent"`
	IdempotencyKey  string                 `json:"idempotency_key"`
	CreatedAt       time.Time              `json:"created_at"`
	ExpiresAt       *time.Time             `json:"expires_at,omitempty"`
	ExecutedAt      *time.Time             `json:"executed_at,omitempty"`
	ExecutionResult string                 `json:"execution_result,omitempty"`
}

// FraudEnforcementEngine enforces fraud decisions with idempotency
type FraudEnforcementEngine struct {
	db              *sql.DB
	decisions       map[string]*EnforcementDecision
	mu              sync.RWMutex
	auditLog        AuditLogger
	alertManager    AlertManager
	accountLimiter  AccountLimiter
	stepUpAuth      StepUpAuthenticator
}

// AuditLogger interface for audit logging
type AuditLogger interface {
	LogDecision(ctx context.Context, decision *EnforcementDecision) error
	LogExecution(ctx context.Context, decision *EnforcementDecision, result string) error
}

// AlertManager interface for alert management
type AlertManager interface {
	CreateAlert(ctx context.Context, decision *EnforcementDecision) error
	EscalateAlert(ctx context.Context, alertID string, reason string) error
}

// AccountLimiter interface for account limit management
type AccountLimiter interface {
	ReduceLimit(ctx context.Context, accountID string, percentage float64) error
	FreezeAccount(ctx context.Context, accountID string, reason string) error
	UnfreezeAccount(ctx context.Context, accountID string) error
}

// StepUpAuthenticator interface for step-up authentication
type StepUpAuthenticator interface {
	RequireStepUp(ctx context.Context, accountID string, transactionID string, method string) error
	VerifyStepUp(ctx context.Context, transactionID string, response string) (bool, error)
}

// NewFraudEnforcementEngine creates a new enforcement engine
func NewFraudEnforcementEngine(db *sql.DB, audit AuditLogger, alerts AlertManager, limiter AccountLimiter, stepUp StepUpAuthenticator) *FraudEnforcementEngine {
	return &FraudEnforcementEngine{
		db:             db,
		decisions:      make(map[string]*EnforcementDecision),
		auditLog:       audit,
		alertManager:   alerts,
		accountLimiter: limiter,
		stepUpAuth:     stepUp,
	}
}

// EnforceDecision enforces a fraud decision with idempotency
func (e *FraudEnforcementEngine) EnforceDecision(ctx context.Context, decision *EnforcementDecision) error {
	// Generate idempotency key if not provided
	if decision.IdempotencyKey == "" {
		decision.IdempotencyKey = e.generateIdempotencyKey(decision)
	}

	// Check for existing decision with same idempotency key
	e.mu.RLock()
	existing, exists := e.decisions[decision.IdempotencyKey]
	e.mu.RUnlock()

	if exists && existing.Idempotent {
		return nil // Already processed
	}

	// Log decision before execution
	if e.auditLog != nil {
		if err := e.auditLog.LogDecision(ctx, decision); err != nil {
			return fmt.Errorf("failed to log decision: %w", err)
		}
	}

	// Execute enforcement action
	var executionResult string
	var err error

	switch decision.Action {
	case EnforcementActionBlock:
		executionResult, err = e.executeBlock(ctx, decision)
	case EnforcementActionHold:
		executionResult, err = e.executeHold(ctx, decision)
	case EnforcementActionStepUp:
		executionResult, err = e.executeStepUp(ctx, decision)
	case EnforcementActionLimitReduce:
		executionResult, err = e.executeLimitReduce(ctx, decision)
	case EnforcementActionFreeze:
		executionResult, err = e.executeFreeze(ctx, decision)
	case EnforcementActionAllow:
		executionResult = "ALLOWED"
	default:
		executionResult = "UNKNOWN_ACTION"
	}

	if err != nil {
		executionResult = fmt.Sprintf("ERROR: %v", err)
	}

	// Update decision with execution result
	now := time.Now()
	decision.ExecutedAt = &now
	decision.ExecutionResult = executionResult
	decision.Idempotent = true

	// Store decision
	e.mu.Lock()
	e.decisions[decision.IdempotencyKey] = decision
	e.mu.Unlock()

	// Persist to database
	if err := e.persistDecision(ctx, decision); err != nil {
		return fmt.Errorf("failed to persist decision: %w", err)
	}

	// Log execution
	if e.auditLog != nil {
		e.auditLog.LogExecution(ctx, decision, executionResult)
	}

	// Create alert if needed
	if decision.Action != EnforcementActionAllow && e.alertManager != nil {
		e.alertManager.CreateAlert(ctx, decision)
	}

	return err
}

func (e *FraudEnforcementEngine) executeBlock(ctx context.Context, decision *EnforcementDecision) (string, error) {
	// Block the transaction - this is enforced at the transfer level
	// The hot path already checks QuickCheck, but this handles async decisions
	return "BLOCKED", nil
}

func (e *FraudEnforcementEngine) executeHold(ctx context.Context, decision *EnforcementDecision) (string, error) {
	// Hold transaction for manual review
	// Set expiry for hold (default 24 hours)
	expiry := time.Now().Add(24 * time.Hour)
	decision.ExpiresAt = &expiry
	return "HELD_FOR_REVIEW", nil
}

func (e *FraudEnforcementEngine) executeStepUp(ctx context.Context, decision *EnforcementDecision) (string, error) {
	if e.stepUpAuth == nil {
		return "STEP_UP_NOT_CONFIGURED", nil
	}
	err := e.stepUpAuth.RequireStepUp(ctx, decision.AccountID, decision.TransferID, "OTP")
	if err != nil {
		return "", err
	}
	return "STEP_UP_REQUIRED", nil
}

func (e *FraudEnforcementEngine) executeLimitReduce(ctx context.Context, decision *EnforcementDecision) (string, error) {
	if e.accountLimiter == nil {
		return "LIMITER_NOT_CONFIGURED", nil
	}
	// Reduce limit by 50% for high-risk accounts
	err := e.accountLimiter.ReduceLimit(ctx, decision.AccountID, 0.5)
	if err != nil {
		return "", err
	}
	return "LIMIT_REDUCED_50%", nil
}

func (e *FraudEnforcementEngine) executeFreeze(ctx context.Context, decision *EnforcementDecision) (string, error) {
	if e.accountLimiter == nil {
		return "LIMITER_NOT_CONFIGURED", nil
	}
	err := e.accountLimiter.FreezeAccount(ctx, decision.AccountID, decision.Reason)
	if err != nil {
		return "", err
	}
	return "ACCOUNT_FROZEN", nil
}

func (e *FraudEnforcementEngine) generateIdempotencyKey(decision *EnforcementDecision) string {
	data := fmt.Sprintf("%s:%s:%s:%f", decision.TransferID, decision.AccountID, decision.Action, decision.RiskScore)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:16])
}

func (e *FraudEnforcementEngine) persistDecision(ctx context.Context, decision *EnforcementDecision) error {
	if e.db == nil {
		return nil
	}

	query := `
		INSERT INTO fraud_enforcement_decisions (
			decision_id, transfer_id, account_id, action, risk_score,
			triggered_rules, ml_score, model_version, rule_version,
			reason, idempotency_key, created_at, executed_at, execution_result
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (idempotency_key) DO NOTHING
	`

	rulesJSON, _ := json.Marshal(decision.TriggeredRules)
	_, err := e.db.ExecContext(ctx, query,
		decision.DecisionID, decision.TransferID, decision.AccountID,
		decision.Action, decision.RiskScore, rulesJSON,
		decision.MLScore, decision.ModelVersion, decision.RuleVersion,
		decision.Reason, decision.IdempotencyKey, decision.CreatedAt,
		decision.ExecutedAt, decision.ExecutionResult,
	)
	return err
}

// =============================================================================
// PHASE 2: Model Lifecycle Management
// =============================================================================

// ModelVersion represents a fraud detection model version
type ModelVersion struct {
	VersionID       string            `json:"version_id"`
	ModelName       string            `json:"model_name"`
	Version         string            `json:"version"`
	Status          ModelStatus       `json:"status"`
	Metrics         *ModelMetrics     `json:"metrics"`
	DriftMetrics    *DriftMetrics     `json:"drift_metrics,omitempty"`
	TrainedAt       time.Time         `json:"trained_at"`
	DeployedAt      *time.Time        `json:"deployed_at,omitempty"`
	RetiredAt       *time.Time        `json:"retired_at,omitempty"`
	Config          map[string]interface{} `json:"config"`
}

// ModelStatus represents model deployment status
type ModelStatus string

const (
	ModelStatusTraining   ModelStatus = "TRAINING"
	ModelStatusValidating ModelStatus = "VALIDATING"
	ModelStatusChallenger ModelStatus = "CHALLENGER"
	ModelStatusChampion   ModelStatus = "CHAMPION"
	ModelStatusRetired    ModelStatus = "RETIRED"
	ModelStatusRollback   ModelStatus = "ROLLBACK"
)

// ModelMetrics represents model performance metrics
type ModelMetrics struct {
	AUC             float64 `json:"auc"`
	Precision       float64 `json:"precision"`
	Recall          float64 `json:"recall"`
	F1Score         float64 `json:"f1_score"`
	FalsePositiveRate float64 `json:"false_positive_rate"`
	FalseNegativeRate float64 `json:"false_negative_rate"`
	Accuracy        float64 `json:"accuracy"`
	LogLoss         float64 `json:"log_loss"`
	KSStatistic     float64 `json:"ks_statistic"`
	GiniCoefficient float64 `json:"gini_coefficient"`
	SampleSize      int64   `json:"sample_size"`
	EvaluatedAt     time.Time `json:"evaluated_at"`
}

// DriftMetrics represents model drift metrics
type DriftMetrics struct {
	FeatureDrift      map[string]float64 `json:"feature_drift"`
	PredictionDrift   float64            `json:"prediction_drift"`
	LabelDrift        float64            `json:"label_drift"`
	PSI               float64            `json:"psi"` // Population Stability Index
	KLDivergence      float64            `json:"kl_divergence"`
	JSDivergence      float64            `json:"js_divergence"`
	DriftDetected     bool               `json:"drift_detected"`
	DriftSeverity     string             `json:"drift_severity"`
	MeasuredAt        time.Time          `json:"measured_at"`
}

// ModelLifecycleManager manages model versions and drift monitoring
type ModelLifecycleManager struct {
	db              *sql.DB
	models          map[string]*ModelVersion
	championModel   *ModelVersion
	challengerModel *ModelVersion
	mu              sync.RWMutex
	driftThreshold  float64
	trafficSplit    float64 // Percentage of traffic to challenger
}

// NewModelLifecycleManager creates a new model lifecycle manager
func NewModelLifecycleManager(db *sql.DB) *ModelLifecycleManager {
	return &ModelLifecycleManager{
		db:             db,
		models:         make(map[string]*ModelVersion),
		driftThreshold: 0.1, // 10% PSI threshold
		trafficSplit:   0.1, // 10% traffic to challenger
	}
}

// RegisterModel registers a new model version
func (m *ModelLifecycleManager) RegisterModel(model *ModelVersion) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	model.Status = ModelStatusValidating
	m.models[model.VersionID] = model
	return nil
}

// PromoteToChallenger promotes a model to challenger status
func (m *ModelLifecycleManager) PromoteToChallenger(versionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	model, ok := m.models[versionID]
	if !ok {
		return fmt.Errorf("model version not found: %s", versionID)
	}

	// Validate model meets minimum requirements
	if model.Metrics == nil || model.Metrics.AUC < 0.7 {
		return fmt.Errorf("model does not meet minimum AUC requirement (0.7)")
	}

	model.Status = ModelStatusChallenger
	m.challengerModel = model
	return nil
}

// PromoteToChampion promotes challenger to champion
func (m *ModelLifecycleManager) PromoteToChampion(versionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	model, ok := m.models[versionID]
	if !ok {
		return fmt.Errorf("model version not found: %s", versionID)
	}

	if model.Status != ModelStatusChallenger {
		return fmt.Errorf("model must be challenger before promotion to champion")
	}

	// Retire current champion
	if m.championModel != nil {
		m.championModel.Status = ModelStatusRetired
		now := time.Now()
		m.championModel.RetiredAt = &now
	}

	// Promote challenger
	model.Status = ModelStatusChampion
	now := time.Now()
	model.DeployedAt = &now
	m.championModel = model
	m.challengerModel = nil

	return nil
}

// RollbackModel rolls back to a previous model version
func (m *ModelLifecycleManager) RollbackModel(versionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	model, ok := m.models[versionID]
	if !ok {
		return fmt.Errorf("model version not found: %s", versionID)
	}

	// Mark current champion for rollback
	if m.championModel != nil {
		m.championModel.Status = ModelStatusRollback
	}

	// Restore previous model
	model.Status = ModelStatusChampion
	now := time.Now()
	model.DeployedAt = &now
	m.championModel = model

	return nil
}

// MonitorDrift monitors model drift
func (m *ModelLifecycleManager) MonitorDrift(ctx context.Context, predictions []PredictionRecord) (*DriftMetrics, error) {
	if m.championModel == nil {
		return nil, fmt.Errorf("no champion model deployed")
	}

	// Calculate feature drift using PSI
	featureDrift := make(map[string]float64)
	var totalPSI float64

	// Group predictions by time window
	recentPreds := filterRecentPredictions(predictions, 24*time.Hour)
	baselinePreds := filterBaselinePredictions(predictions, 7*24*time.Hour, 24*time.Hour)

	if len(recentPreds) < 100 || len(baselinePreds) < 100 {
		return nil, fmt.Errorf("insufficient data for drift calculation")
	}

	// Calculate PSI for each feature
	features := []string{"amount", "hour_of_day", "velocity_1h", "merchant_risk"}
	for _, feature := range features {
		psi := calculatePSI(
			extractFeatureValues(recentPreds, feature),
			extractFeatureValues(baselinePreds, feature),
		)
		featureDrift[feature] = psi
		totalPSI += psi
	}

	// Calculate prediction drift
	predictionDrift := calculatePSI(
		extractScores(recentPreds),
		extractScores(baselinePreds),
	)

	// Calculate label drift (if labels available)
	labelDrift := calculateLabelDrift(recentPreds, baselinePreds)

	// Determine drift severity
	avgPSI := totalPSI / float64(len(features))
	driftDetected := avgPSI > m.driftThreshold || predictionDrift > m.driftThreshold
	
	var driftSeverity string
	if avgPSI > 0.25 {
		driftSeverity = "CRITICAL"
	} else if avgPSI > 0.1 {
		driftSeverity = "HIGH"
	} else if avgPSI > 0.05 {
		driftSeverity = "MEDIUM"
	} else {
		driftSeverity = "LOW"
	}

	drift := &DriftMetrics{
		FeatureDrift:    featureDrift,
		PredictionDrift: predictionDrift,
		LabelDrift:      labelDrift,
		PSI:             avgPSI,
		DriftDetected:   driftDetected,
		DriftSeverity:   driftSeverity,
		MeasuredAt:      time.Now(),
	}

	// Update model drift metrics
	m.mu.Lock()
	m.championModel.DriftMetrics = drift
	m.mu.Unlock()

	return drift, nil
}

// GetModelForScoring returns the model to use for scoring (champion/challenger split)
func (m *ModelLifecycleManager) GetModelForScoring() (*ModelVersion, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// If challenger exists, use traffic split
	if m.challengerModel != nil {
		// Simple random split based on traffic percentage
		if float64(time.Now().UnixNano()%100)/100 < m.trafficSplit {
			return m.challengerModel, true // isChallenger = true
		}
	}

	return m.championModel, false
}

// PredictionRecord represents a prediction for drift monitoring
type PredictionRecord struct {
	TransactionID string             `json:"transaction_id"`
	Features      map[string]float64 `json:"features"`
	Score         float64            `json:"score"`
	Label         *int               `json:"label,omitempty"` // 1=fraud, 0=legitimate
	ModelVersion  string             `json:"model_version"`
	Timestamp     time.Time          `json:"timestamp"`
}

// =============================================================================
// PHASE 2: Backtesting Harness
// =============================================================================

// BacktestHarness provides backtesting capabilities
type BacktestHarness struct {
	db              *sql.DB
	goldenDataset   []GoldenTransaction
	mu              sync.RWMutex
}

// GoldenTransaction represents a golden test transaction
type GoldenTransaction struct {
	TransactionID   string             `json:"transaction_id"`
	Features        map[string]float64 `json:"features"`
	ExpectedScore   float64            `json:"expected_score"`
	ExpectedDecision string            `json:"expected_decision"`
	ActualLabel     int                `json:"actual_label"` // 1=fraud, 0=legitimate
	Category        string             `json:"category"` // e.g., "velocity", "amount", "geo"
}

// BacktestResult represents backtest results
type BacktestResult struct {
	ModelVersion    string         `json:"model_version"`
	TotalTests      int            `json:"total_tests"`
	Passed          int            `json:"passed"`
	Failed          int            `json:"failed"`
	Metrics         *ModelMetrics  `json:"metrics"`
	FailedCases     []FailedCase   `json:"failed_cases"`
	ExecutedAt      time.Time      `json:"executed_at"`
	Duration        time.Duration  `json:"duration"`
}

// FailedCase represents a failed backtest case
type FailedCase struct {
	TransactionID   string  `json:"transaction_id"`
	ExpectedScore   float64 `json:"expected_score"`
	ActualScore     float64 `json:"actual_score"`
	ExpectedDecision string `json:"expected_decision"`
	ActualDecision  string  `json:"actual_decision"`
	Reason          string  `json:"reason"`
}

// NewBacktestHarness creates a new backtest harness
func NewBacktestHarness(db *sql.DB) *BacktestHarness {
	harness := &BacktestHarness{
		db:            db,
		goldenDataset: make([]GoldenTransaction, 0),
	}
	harness.loadGoldenDataset()
	return harness
}

// loadGoldenDataset loads golden test transactions
func (h *BacktestHarness) loadGoldenDataset() {
	// Load from database or initialize with default golden transactions
	h.goldenDataset = []GoldenTransaction{
		// High-risk velocity pattern
		{
			TransactionID: "golden_velocity_001",
			Features: map[string]float64{
				"amount": 5000, "velocity_1h": 15, "velocity_24h": 50,
				"hour_of_day": 3, "is_weekend": 1, "merchant_risk": 0.8,
			},
			ExpectedScore: 0.85, ExpectedDecision: "BLOCK", ActualLabel: 1, Category: "velocity",
		},
		// Large amount pattern
		{
			TransactionID: "golden_amount_001",
			Features: map[string]float64{
				"amount": 500000, "velocity_1h": 1, "velocity_24h": 5,
				"hour_of_day": 14, "is_weekend": 0, "merchant_risk": 0.3,
			},
			ExpectedScore: 0.75, ExpectedDecision: "REVIEW", ActualLabel: 0, Category: "amount",
		},
		// Normal transaction
		{
			TransactionID: "golden_normal_001",
			Features: map[string]float64{
				"amount": 100, "velocity_1h": 1, "velocity_24h": 3,
				"hour_of_day": 10, "is_weekend": 0, "merchant_risk": 0.1,
			},
			ExpectedScore: 0.1, ExpectedDecision: "ALLOW", ActualLabel: 0, Category: "normal",
		},
		// Structuring pattern
		{
			TransactionID: "golden_structuring_001",
			Features: map[string]float64{
				"amount": 9900, "velocity_1h": 5, "velocity_24h": 20,
				"hour_of_day": 16, "is_weekend": 0, "merchant_risk": 0.2,
			},
			ExpectedScore: 0.7, ExpectedDecision: "REVIEW", ActualLabel: 1, Category: "structuring",
		},
	}
}

// RunBacktest runs backtest against a model
func (h *BacktestHarness) RunBacktest(scorer ModelScorer, modelVersion string) (*BacktestResult, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	startTime := time.Now()
	result := &BacktestResult{
		ModelVersion: modelVersion,
		TotalTests:   len(h.goldenDataset),
		FailedCases:  make([]FailedCase, 0),
		ExecutedAt:   startTime,
	}

	var truePositives, trueNegatives, falsePositives, falseNegatives int
	var totalLogLoss float64

	for _, golden := range h.goldenDataset {
		score, decision, err := scorer.Score(golden.Features)
		if err != nil {
			result.FailedCases = append(result.FailedCases, FailedCase{
				TransactionID: golden.TransactionID,
				Reason:        fmt.Sprintf("scoring error: %v", err),
			})
			result.Failed++
			continue
		}

		// Check if score is within tolerance (±0.15)
		scoreDiff := math.Abs(score - golden.ExpectedScore)
		decisionMatch := decision == golden.ExpectedDecision

		if scoreDiff <= 0.15 && decisionMatch {
			result.Passed++
		} else {
			result.Failed++
			result.FailedCases = append(result.FailedCases, FailedCase{
				TransactionID:    golden.TransactionID,
				ExpectedScore:    golden.ExpectedScore,
				ActualScore:      score,
				ExpectedDecision: golden.ExpectedDecision,
				ActualDecision:   decision,
				Reason:           fmt.Sprintf("score diff: %.3f, decision match: %v", scoreDiff, decisionMatch),
			})
		}

		// Calculate metrics
		predicted := 0
		if score >= 0.5 {
			predicted = 1
		}

		if predicted == 1 && golden.ActualLabel == 1 {
			truePositives++
		} else if predicted == 0 && golden.ActualLabel == 0 {
			trueNegatives++
		} else if predicted == 1 && golden.ActualLabel == 0 {
			falsePositives++
		} else {
			falseNegatives++
		}

		// Log loss
		if golden.ActualLabel == 1 {
			totalLogLoss -= math.Log(math.Max(score, 1e-15))
		} else {
			totalLogLoss -= math.Log(math.Max(1-score, 1e-15))
		}
	}

	// Calculate metrics
	total := float64(truePositives + trueNegatives + falsePositives + falseNegatives)
	if total > 0 {
		precision := float64(truePositives) / math.Max(float64(truePositives+falsePositives), 1)
		recall := float64(truePositives) / math.Max(float64(truePositives+falseNegatives), 1)
		
		result.Metrics = &ModelMetrics{
			Precision:         precision,
			Recall:            recall,
			F1Score:           2 * precision * recall / math.Max(precision+recall, 1e-10),
			FalsePositiveRate: float64(falsePositives) / math.Max(float64(falsePositives+trueNegatives), 1),
			FalseNegativeRate: float64(falseNegatives) / math.Max(float64(falseNegatives+truePositives), 1),
			Accuracy:          float64(truePositives+trueNegatives) / total,
			LogLoss:           totalLogLoss / total,
			SampleSize:        int64(total),
			EvaluatedAt:       time.Now(),
		}
	}

	result.Duration = time.Since(startTime)
	return result, nil
}

// ModelScorer interface for model scoring
type ModelScorer interface {
	Score(features map[string]float64) (score float64, decision string, err error)
}

// =============================================================================
// PHASE 2: Feedback Loop
// =============================================================================

// FeedbackLoop manages feedback from confirmed fraud to training
type FeedbackLoop struct {
	db              *sql.DB
	feedbackQueue   chan *FraudFeedback
	labeledData     []*LabeledTransaction
	mu              sync.RWMutex
	batchSize       int
	flushInterval   time.Duration
}

// FraudFeedback represents feedback on a fraud decision
type FraudFeedback struct {
	TransactionID   string    `json:"transaction_id"`
	OriginalScore   float64   `json:"original_score"`
	OriginalDecision string   `json:"original_decision"`
	ActualOutcome   string    `json:"actual_outcome"` // FRAUD, LEGITIMATE, CHARGEBACK
	FeedbackSource  string    `json:"feedback_source"` // REVIEWER, CHARGEBACK, CUSTOMER
	FeedbackAt      time.Time `json:"feedback_at"`
	ReviewerID      string    `json:"reviewer_id,omitempty"`
	Notes           string    `json:"notes,omitempty"`
}

// LabeledTransaction represents a labeled transaction for training
type LabeledTransaction struct {
	TransactionID string             `json:"transaction_id"`
	Features      map[string]float64 `json:"features"`
	Label         int                `json:"label"` // 1=fraud, 0=legitimate
	LabelSource   string             `json:"label_source"`
	LabeledAt     time.Time          `json:"labeled_at"`
	ModelVersion  string             `json:"model_version"`
}

// NewFeedbackLoop creates a new feedback loop
func NewFeedbackLoop(db *sql.DB) *FeedbackLoop {
	fl := &FeedbackLoop{
		db:            db,
		feedbackQueue: make(chan *FraudFeedback, 10000),
		labeledData:   make([]*LabeledTransaction, 0),
		batchSize:     1000,
		flushInterval: 5 * time.Minute,
	}
	go fl.processLoop()
	return fl
}

// SubmitFeedback submits feedback on a fraud decision
func (fl *FeedbackLoop) SubmitFeedback(feedback *FraudFeedback) error {
	select {
	case fl.feedbackQueue <- feedback:
		return nil
	default:
		return fmt.Errorf("feedback queue full")
	}
}

// processLoop processes feedback and creates labeled data
func (fl *FeedbackLoop) processLoop() {
	ticker := time.NewTicker(fl.flushInterval)
	defer ticker.Stop()

	batch := make([]*FraudFeedback, 0, fl.batchSize)

	for {
		select {
		case feedback := <-fl.feedbackQueue:
			batch = append(batch, feedback)
			if len(batch) >= fl.batchSize {
				fl.processBatch(batch)
				batch = make([]*FraudFeedback, 0, fl.batchSize)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				fl.processBatch(batch)
				batch = make([]*FraudFeedback, 0, fl.batchSize)
			}
		}
	}
}

// processBatch processes a batch of feedback
func (fl *FeedbackLoop) processBatch(batch []*FraudFeedback) {
	fl.mu.Lock()
	defer fl.mu.Unlock()

	for _, feedback := range batch {
		// Convert feedback to labeled transaction
		label := 0
		if feedback.ActualOutcome == "FRAUD" || feedback.ActualOutcome == "CHARGEBACK" {
			label = 1
		}

		labeled := &LabeledTransaction{
			TransactionID: feedback.TransactionID,
			Label:         label,
			LabelSource:   feedback.FeedbackSource,
			LabeledAt:     feedback.FeedbackAt,
		}

		fl.labeledData = append(fl.labeledData, labeled)

		// Persist to database
		if fl.db != nil {
			fl.persistLabel(labeled)
		}
	}
}

func (fl *FeedbackLoop) persistLabel(labeled *LabeledTransaction) {
	query := `
		INSERT INTO fraud_labeled_transactions (
			transaction_id, label, label_source, labeled_at
		) VALUES ($1, $2, $3, $4)
		ON CONFLICT (transaction_id) DO UPDATE SET
			label = EXCLUDED.label,
			label_source = EXCLUDED.label_source,
			labeled_at = EXCLUDED.labeled_at
	`
	fl.db.Exec(query, labeled.TransactionID, labeled.Label, labeled.LabelSource, labeled.LabeledAt)
}

// GetTrainingData returns labeled data for model training
func (fl *FeedbackLoop) GetTrainingData(since time.Time, limit int) []*LabeledTransaction {
	fl.mu.RLock()
	defer fl.mu.RUnlock()

	result := make([]*LabeledTransaction, 0)
	for _, labeled := range fl.labeledData {
		if labeled.LabeledAt.After(since) {
			result = append(result, labeled)
			if len(result) >= limit {
				break
			}
		}
	}
	return result
}

// =============================================================================
// PHASE 3: Graph Analytics for Mule Detection
// =============================================================================

// GraphAnalytics provides graph-based fraud detection
type GraphAnalytics struct {
	nodes     map[string]*GraphNode
	edges     map[string][]*GraphEdge
	mu        sync.RWMutex
	db        *sql.DB
}

// GraphNode represents an entity in the fraud graph
type GraphNode struct {
	ID          string            `json:"id"`
	Type        string            `json:"type"` // ACCOUNT, DEVICE, IP, PHONE
	Attributes  map[string]string `json:"attributes"`
	RiskScore   float64           `json:"risk_score"`
	Connections int               `json:"connections"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// GraphEdge represents a connection between entities
type GraphEdge struct {
	FromID      string    `json:"from_id"`
	ToID        string    `json:"to_id"`
	Type        string    `json:"type"` // TRANSFER, SHARED_DEVICE, SHARED_IP, SHARED_PHONE
	Weight      float64   `json:"weight"`
	Count       int       `json:"count"`
	TotalAmount float64   `json:"total_amount"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
}

// MuleDetectionResult represents mule detection analysis
type MuleDetectionResult struct {
	AccountID       string    `json:"account_id"`
	IsMule          bool      `json:"is_mule"`
	MuleScore       float64   `json:"mule_score"`
	MuleType        string    `json:"mule_type"` // MONEY_MULE, FUNNEL, LAYERING
	RiskFactors     []string  `json:"risk_factors"`
	LinkedAccounts  []string  `json:"linked_accounts"`
	NetworkSize     int       `json:"network_size"`
	AnalyzedAt      time.Time `json:"analyzed_at"`
}

// NewGraphAnalytics creates a new graph analytics engine
func NewGraphAnalytics(db *sql.DB) *GraphAnalytics {
	return &GraphAnalytics{
		nodes: make(map[string]*GraphNode),
		edges: make(map[string][]*GraphEdge),
		db:    db,
	}
}

// AddTransaction adds a transaction to the graph
func (g *GraphAnalytics) AddTransaction(fromAccount, toAccount string, amount float64, deviceID, ipAddress string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()

	// Ensure nodes exist
	g.ensureNode(fromAccount, "ACCOUNT", now)
	g.ensureNode(toAccount, "ACCOUNT", now)

	// Add transfer edge
	g.addEdge(fromAccount, toAccount, "TRANSFER", amount, now)

	// Add device linkage if provided
	if deviceID != "" {
		g.ensureNode(deviceID, "DEVICE", now)
		g.addEdge(fromAccount, deviceID, "SHARED_DEVICE", 1, now)
		g.addEdge(toAccount, deviceID, "SHARED_DEVICE", 1, now)
	}

	// Add IP linkage if provided
	if ipAddress != "" {
		g.ensureNode(ipAddress, "IP", now)
		g.addEdge(fromAccount, ipAddress, "SHARED_IP", 1, now)
	}
}

func (g *GraphAnalytics) ensureNode(id, nodeType string, now time.Time) {
	if _, exists := g.nodes[id]; !exists {
		g.nodes[id] = &GraphNode{
			ID:         id,
			Type:       nodeType,
			Attributes: make(map[string]string),
			CreatedAt:  now,
			UpdatedAt:  now,
		}
	}
}

func (g *GraphAnalytics) addEdge(fromID, toID, edgeType string, amount float64, now time.Time) {
	key := fromID + ":" + toID + ":" + edgeType

	// Find existing edge
	edges := g.edges[fromID]
	for _, edge := range edges {
		if edge.ToID == toID && edge.Type == edgeType {
			edge.Count++
			edge.TotalAmount += amount
			edge.LastSeen = now
			edge.Weight = float64(edge.Count) * edge.TotalAmount
			return
		}
	}

	// Create new edge
	edge := &GraphEdge{
		FromID:      fromID,
		ToID:        toID,
		Type:        edgeType,
		Weight:      amount,
		Count:       1,
		TotalAmount: amount,
		FirstSeen:   now,
		LastSeen:    now,
	}
	g.edges[fromID] = append(g.edges[fromID], edge)

	// Update node connections
	if node, ok := g.nodes[fromID]; ok {
		node.Connections++
		node.UpdatedAt = now
	}
	if node, ok := g.nodes[toID]; ok {
		node.Connections++
		node.UpdatedAt = now
	}

	_ = key // Suppress unused variable warning
}

// DetectMule analyzes an account for mule behavior
func (g *GraphAnalytics) DetectMule(accountID string) *MuleDetectionResult {
	g.mu.RLock()
	defer g.mu.RUnlock()

	result := &MuleDetectionResult{
		AccountID:      accountID,
		RiskFactors:    make([]string, 0),
		LinkedAccounts: make([]string, 0),
		AnalyzedAt:     time.Now(),
	}

	node, exists := g.nodes[accountID]
	if !exists {
		return result
	}

	// Analyze transfer patterns
	edges := g.edges[accountID]
	var inboundCount, outboundCount int
	var inboundAmount, outboundAmount float64
	uniqueCounterparties := make(map[string]bool)

	for _, edge := range edges {
		if edge.Type == "TRANSFER" {
			outboundCount += edge.Count
			outboundAmount += edge.TotalAmount
			uniqueCounterparties[edge.ToID] = true
		}
	}

	// Check inbound transfers
	for fromID, fromEdges := range g.edges {
		for _, edge := range fromEdges {
			if edge.ToID == accountID && edge.Type == "TRANSFER" {
				inboundCount += edge.Count
				inboundAmount += edge.TotalAmount
				uniqueCounterparties[fromID] = true
			}
		}
	}

	result.LinkedAccounts = make([]string, 0, len(uniqueCounterparties))
	for cp := range uniqueCounterparties {
		result.LinkedAccounts = append(result.LinkedAccounts, cp)
	}
	result.NetworkSize = len(uniqueCounterparties)

	// Mule detection heuristics
	var muleScore float64

	// 1. High throughput with low retention (funnel pattern)
	if inboundAmount > 0 && outboundAmount/inboundAmount > 0.9 {
		muleScore += 0.3
		result.RiskFactors = append(result.RiskFactors, "HIGH_THROUGHPUT_LOW_RETENTION")
	}

	// 2. Many unique counterparties in short time
	if len(uniqueCounterparties) > 20 {
		muleScore += 0.2
		result.RiskFactors = append(result.RiskFactors, "MANY_COUNTERPARTIES")
	}

	// 3. Rapid in-out pattern
	if inboundCount > 10 && outboundCount > 10 && math.Abs(float64(inboundCount-outboundCount)) < 3 {
		muleScore += 0.25
		result.RiskFactors = append(result.RiskFactors, "RAPID_IN_OUT_PATTERN")
	}

	// 4. Shared device with multiple accounts
	sharedDevices := 0
	for _, edge := range edges {
		if edge.Type == "SHARED_DEVICE" && edge.Count > 1 {
			sharedDevices++
		}
	}
	if sharedDevices > 0 {
		muleScore += 0.15 * float64(sharedDevices)
		result.RiskFactors = append(result.RiskFactors, fmt.Sprintf("SHARED_DEVICE_%d", sharedDevices))
	}

	// 5. New account with high activity
	if node.CreatedAt.After(time.Now().Add(-30*24*time.Hour)) && node.Connections > 50 {
		muleScore += 0.2
		result.RiskFactors = append(result.RiskFactors, "NEW_ACCOUNT_HIGH_ACTIVITY")
	}

	result.MuleScore = math.Min(muleScore, 1.0)
	result.IsMule = result.MuleScore >= 0.6

	// Determine mule type
	if result.IsMule {
		if outboundAmount/inboundAmount > 0.95 {
			result.MuleType = "FUNNEL"
		} else if len(uniqueCounterparties) > 30 {
			result.MuleType = "LAYERING"
		} else {
			result.MuleType = "MONEY_MULE"
		}
	}

	return result
}

// =============================================================================
// PHASE 3: Dynamic Limits
// =============================================================================

// DynamicLimitManager manages dynamic transaction limits based on risk
type DynamicLimitManager struct {
	db          *sql.DB
	limits      map[string]*AccountLimits
	mu          sync.RWMutex
	baseLimits  *BaseLimits
}

// AccountLimits represents limits for an account
type AccountLimits struct {
	AccountID           string    `json:"account_id"`
	DailyLimit          float64   `json:"daily_limit"`
	TransactionLimit    float64   `json:"transaction_limit"`
	VelocityLimit       int       `json:"velocity_limit"` // Max transactions per hour
	RiskMultiplier      float64   `json:"risk_multiplier"`
	LastAdjusted        time.Time `json:"last_adjusted"`
	AdjustmentReason    string    `json:"adjustment_reason"`
}

// BaseLimits represents default limits
type BaseLimits struct {
	DefaultDailyLimit       float64 `json:"default_daily_limit"`
	DefaultTransactionLimit float64 `json:"default_transaction_limit"`
	DefaultVelocityLimit    int     `json:"default_velocity_limit"`
	MinMultiplier           float64 `json:"min_multiplier"`
	MaxMultiplier           float64 `json:"max_multiplier"`
}

// NewDynamicLimitManager creates a new dynamic limit manager
func NewDynamicLimitManager(db *sql.DB) *DynamicLimitManager {
	return &DynamicLimitManager{
		db:     db,
		limits: make(map[string]*AccountLimits),
		baseLimits: &BaseLimits{
			DefaultDailyLimit:       100000,
			DefaultTransactionLimit: 10000,
			DefaultVelocityLimit:    50,
			MinMultiplier:           0.1,
			MaxMultiplier:           2.0,
		},
	}
}

// GetLimits returns limits for an account
func (m *DynamicLimitManager) GetLimits(accountID string) *AccountLimits {
	m.mu.RLock()
	limits, exists := m.limits[accountID]
	m.mu.RUnlock()

	if !exists {
		return &AccountLimits{
			AccountID:        accountID,
			DailyLimit:       m.baseLimits.DefaultDailyLimit,
			TransactionLimit: m.baseLimits.DefaultTransactionLimit,
			VelocityLimit:    m.baseLimits.DefaultVelocityLimit,
			RiskMultiplier:   1.0,
		}
	}
	return limits
}

// AdjustLimits adjusts limits based on risk score
func (m *DynamicLimitManager) AdjustLimits(accountID string, riskScore float64, reason string) *AccountLimits {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Calculate risk multiplier (inverse of risk score)
	// High risk = lower limits, low risk = higher limits
	multiplier := 1.0 - (riskScore * 0.9) // Risk 1.0 -> multiplier 0.1
	multiplier = math.Max(m.baseLimits.MinMultiplier, math.Min(m.baseLimits.MaxMultiplier, multiplier))

	limits := &AccountLimits{
		AccountID:        accountID,
		DailyLimit:       m.baseLimits.DefaultDailyLimit * multiplier,
		TransactionLimit: m.baseLimits.DefaultTransactionLimit * multiplier,
		VelocityLimit:    int(float64(m.baseLimits.DefaultVelocityLimit) * multiplier),
		RiskMultiplier:   multiplier,
		LastAdjusted:     time.Now(),
		AdjustmentReason: reason,
	}

	m.limits[accountID] = limits
	return limits
}

// =============================================================================
// PHASE 3: Step-Up Authentication
// =============================================================================

// StepUpAuthManager manages step-up authentication
type StepUpAuthManager struct {
	db              *sql.DB
	pendingAuth     map[string]*StepUpRequest
	mu              sync.RWMutex
	otpGenerator    OTPGenerator
	notifier        StepUpNotifier
}

// StepUpRequest represents a step-up authentication request
type StepUpRequest struct {
	RequestID       string    `json:"request_id"`
	TransactionID   string    `json:"transaction_id"`
	AccountID       string    `json:"account_id"`
	Method          string    `json:"method"` // OTP, BIOMETRIC, SECURITY_QUESTION
	Challenge       string    `json:"challenge"`
	Status          string    `json:"status"` // PENDING, VERIFIED, FAILED, EXPIRED
	CreatedAt       time.Time `json:"created_at"`
	ExpiresAt       time.Time `json:"expires_at"`
	VerifiedAt      *time.Time `json:"verified_at,omitempty"`
	Attempts        int       `json:"attempts"`
	MaxAttempts     int       `json:"max_attempts"`
}

// OTPGenerator interface for OTP generation
type OTPGenerator interface {
	Generate() string
	Verify(otp, challenge string) bool
}

// StepUpNotifier interface for sending step-up notifications
type StepUpNotifier interface {
	SendOTP(accountID, otp string) error
	SendPushNotification(accountID, message string) error
}

// NewStepUpAuthManager creates a new step-up auth manager
func NewStepUpAuthManager(db *sql.DB, otp OTPGenerator, notifier StepUpNotifier) *StepUpAuthManager {
	return &StepUpAuthManager{
		db:           db,
		pendingAuth:  make(map[string]*StepUpRequest),
		otpGenerator: otp,
		notifier:     notifier,
	}
}

// RequireStepUp initiates step-up authentication
func (m *StepUpAuthManager) RequireStepUp(ctx context.Context, accountID, transactionID, method string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate challenge based on method
	var challenge string
	if m.otpGenerator != nil {
		challenge = m.otpGenerator.Generate()
	} else {
		challenge = fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}

	request := &StepUpRequest{
		RequestID:     fmt.Sprintf("stepup_%d", time.Now().UnixNano()),
		TransactionID: transactionID,
		AccountID:     accountID,
		Method:        method,
		Challenge:     challenge,
		Status:        "PENDING",
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(5 * time.Minute),
		MaxAttempts:   3,
	}

	m.pendingAuth[transactionID] = request

	// Send notification
	if m.notifier != nil {
		switch method {
		case "OTP":
			m.notifier.SendOTP(accountID, challenge)
		default:
			m.notifier.SendPushNotification(accountID, "Please verify your transaction")
		}
	}

	return nil
}

// VerifyStepUp verifies step-up authentication
func (m *StepUpAuthManager) VerifyStepUp(ctx context.Context, transactionID, response string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	request, exists := m.pendingAuth[transactionID]
	if !exists {
		return false, fmt.Errorf("no pending step-up request for transaction")
	}

	// Check expiry
	if time.Now().After(request.ExpiresAt) {
		request.Status = "EXPIRED"
		return false, fmt.Errorf("step-up request expired")
	}

	// Check attempts
	request.Attempts++
	if request.Attempts > request.MaxAttempts {
		request.Status = "FAILED"
		return false, fmt.Errorf("max attempts exceeded")
	}

	// Verify response
	var verified bool
	if m.otpGenerator != nil {
		verified = m.otpGenerator.Verify(response, request.Challenge)
	} else {
		verified = response == request.Challenge
	}

	if verified {
		now := time.Now()
		request.Status = "VERIFIED"
		request.VerifiedAt = &now
		delete(m.pendingAuth, transactionID)
		return true, nil
	}

	return false, nil
}

// =============================================================================
// Helper Functions
// =============================================================================

func filterRecentPredictions(predictions []PredictionRecord, window time.Duration) []PredictionRecord {
	cutoff := time.Now().Add(-window)
	result := make([]PredictionRecord, 0)
	for _, p := range predictions {
		if p.Timestamp.After(cutoff) {
			result = append(result, p)
		}
	}
	return result
}

func filterBaselinePredictions(predictions []PredictionRecord, maxAge, minAge time.Duration) []PredictionRecord {
	maxCutoff := time.Now().Add(-maxAge)
	minCutoff := time.Now().Add(-minAge)
	result := make([]PredictionRecord, 0)
	for _, p := range predictions {
		if p.Timestamp.After(maxCutoff) && p.Timestamp.Before(minCutoff) {
			result = append(result, p)
		}
	}
	return result
}

func extractFeatureValues(predictions []PredictionRecord, feature string) []float64 {
	values := make([]float64, 0, len(predictions))
	for _, p := range predictions {
		if v, ok := p.Features[feature]; ok {
			values = append(values, v)
		}
	}
	return values
}

func extractScores(predictions []PredictionRecord) []float64 {
	scores := make([]float64, len(predictions))
	for i, p := range predictions {
		scores[i] = p.Score
	}
	return scores
}

func calculatePSI(actual, expected []float64) float64 {
	if len(actual) == 0 || len(expected) == 0 {
		return 0
	}

	// Create bins
	numBins := 10
	allValues := append(actual, expected...)
	sort.Float64s(allValues)
	
	binEdges := make([]float64, numBins+1)
	for i := 0; i <= numBins; i++ {
		idx := int(float64(i) / float64(numBins) * float64(len(allValues)-1))
		binEdges[i] = allValues[idx]
	}

	// Count values in each bin
	actualCounts := make([]float64, numBins)
	expectedCounts := make([]float64, numBins)

	for _, v := range actual {
		for i := 0; i < numBins; i++ {
			if v >= binEdges[i] && (i == numBins-1 || v < binEdges[i+1]) {
				actualCounts[i]++
				break
			}
		}
	}

	for _, v := range expected {
		for i := 0; i < numBins; i++ {
			if v >= binEdges[i] && (i == numBins-1 || v < binEdges[i+1]) {
				expectedCounts[i]++
				break
			}
		}
	}

	// Calculate PSI
	var psi float64
	for i := 0; i < numBins; i++ {
		actualPct := (actualCounts[i] + 0.5) / (float64(len(actual)) + 0.5*float64(numBins))
		expectedPct := (expectedCounts[i] + 0.5) / (float64(len(expected)) + 0.5*float64(numBins))
		psi += (actualPct - expectedPct) * math.Log(actualPct/expectedPct)
	}

	return psi
}

func calculateLabelDrift(recent, baseline []PredictionRecord) float64 {
	var recentFraud, baselineFraud int
	var recentTotal, baselineTotal int

	for _, p := range recent {
		if p.Label != nil {
			recentTotal++
			if *p.Label == 1 {
				recentFraud++
			}
		}
	}

	for _, p := range baseline {
		if p.Label != nil {
			baselineTotal++
			if *p.Label == 1 {
				baselineFraud++
			}
		}
	}

	if recentTotal == 0 || baselineTotal == 0 {
		return 0
	}

	recentRate := float64(recentFraud) / float64(recentTotal)
	baselineRate := float64(baselineFraud) / float64(baselineTotal)

	return math.Abs(recentRate - baselineRate)
}

// =============================================================================
// Database Schema
// =============================================================================

// ProductionFraudSchema returns the database schema for production fraud system
func ProductionFraudSchema() string {
	return `
	-- Fraud enforcement decisions
	CREATE TABLE IF NOT EXISTS fraud_enforcement_decisions (
		decision_id VARCHAR(64) PRIMARY KEY,
		transfer_id VARCHAR(64) NOT NULL,
		account_id VARCHAR(64) NOT NULL,
		action VARCHAR(32) NOT NULL,
		risk_score DECIMAL(5,4) NOT NULL,
		triggered_rules JSONB,
		ml_score DECIMAL(5,4),
		model_version VARCHAR(64),
		rule_version VARCHAR(64),
		reason TEXT,
		idempotency_key VARCHAR(64) UNIQUE NOT NULL,
		created_at TIMESTAMP NOT NULL,
		executed_at TIMESTAMP,
		execution_result TEXT,
		INDEX idx_enforcement_transfer (transfer_id),
		INDEX idx_enforcement_account (account_id),
		INDEX idx_enforcement_created (created_at)
	);

	-- Model versions
	CREATE TABLE IF NOT EXISTS fraud_model_versions (
		version_id VARCHAR(64) PRIMARY KEY,
		model_name VARCHAR(128) NOT NULL,
		version VARCHAR(32) NOT NULL,
		status VARCHAR(32) NOT NULL,
		metrics JSONB,
		drift_metrics JSONB,
		config JSONB,
		trained_at TIMESTAMP NOT NULL,
		deployed_at TIMESTAMP,
		retired_at TIMESTAMP,
		INDEX idx_model_status (status),
		INDEX idx_model_name (model_name)
	);

	-- Labeled transactions for training
	CREATE TABLE IF NOT EXISTS fraud_labeled_transactions (
		transaction_id VARCHAR(64) PRIMARY KEY,
		features JSONB,
		label INTEGER NOT NULL,
		label_source VARCHAR(32) NOT NULL,
		labeled_at TIMESTAMP NOT NULL,
		model_version VARCHAR(64),
		INDEX idx_labeled_at (labeled_at),
		INDEX idx_label (label)
	);

	-- Graph nodes
	CREATE TABLE IF NOT EXISTS fraud_graph_nodes (
		id VARCHAR(128) PRIMARY KEY,
		type VARCHAR(32) NOT NULL,
		attributes JSONB,
		risk_score DECIMAL(5,4),
		connections INTEGER DEFAULT 0,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		INDEX idx_node_type (type),
		INDEX idx_node_risk (risk_score)
	);

	-- Graph edges
	CREATE TABLE IF NOT EXISTS fraud_graph_edges (
		from_id VARCHAR(128) NOT NULL,
		to_id VARCHAR(128) NOT NULL,
		type VARCHAR(32) NOT NULL,
		weight DECIMAL(20,4),
		count INTEGER DEFAULT 1,
		total_amount DECIMAL(20,4),
		first_seen TIMESTAMP NOT NULL,
		last_seen TIMESTAMP NOT NULL,
		PRIMARY KEY (from_id, to_id, type),
		INDEX idx_edge_from (from_id),
		INDEX idx_edge_to (to_id)
	);

	-- Account limits
	CREATE TABLE IF NOT EXISTS fraud_account_limits (
		account_id VARCHAR(64) PRIMARY KEY,
		daily_limit DECIMAL(20,4) NOT NULL,
		transaction_limit DECIMAL(20,4) NOT NULL,
		velocity_limit INTEGER NOT NULL,
		risk_multiplier DECIMAL(5,4) NOT NULL,
		last_adjusted TIMESTAMP NOT NULL,
		adjustment_reason TEXT
	);

	-- Step-up authentication requests
	CREATE TABLE IF NOT EXISTS fraud_stepup_requests (
		request_id VARCHAR(64) PRIMARY KEY,
		transaction_id VARCHAR(64) NOT NULL,
		account_id VARCHAR(64) NOT NULL,
		method VARCHAR(32) NOT NULL,
		status VARCHAR(32) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		verified_at TIMESTAMP,
		attempts INTEGER DEFAULT 0,
		INDEX idx_stepup_transaction (transaction_id),
		INDEX idx_stepup_status (status)
	);
	`
}

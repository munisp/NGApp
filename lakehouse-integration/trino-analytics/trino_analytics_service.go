package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	_ "github.com/trinodb/trino-go-client/trino"
)

// TrinoAnalyticsService provides real analytics queries against Trino/Presto
type TrinoAnalyticsService struct {
	db          *sql.DB
	trinoURL    string
	catalog     string
	schema      string
	queryCache  map[string]*CachedResult
	cacheMutex  sync.RWMutex
	cacheTTL    time.Duration
}

// CachedResult stores cached query results
type CachedResult struct {
	Data      interface{}
	Timestamp time.Time
}

// PolicySummary represents aggregated policy statistics
type PolicySummary struct {
	TotalPolicies     int64   `json:"total_policies"`
	ActivePolicies    int64   `json:"active_policies"`
	PendingPolicies   int64   `json:"pending_policies"`
	CancelledPolicies int64   `json:"cancelled_policies"`
	ExpiredPolicies   int64   `json:"expired_policies"`
	TotalPremiumNGN   float64 `json:"total_premium_ngn"`
	AvgPremiumNGN     float64 `json:"avg_premium_ngn"`
	LastUpdated       string  `json:"last_updated"`
}

// ClaimPayoutRatio represents claims analytics
type ClaimPayoutRatio struct {
	TotalClaims       int64   `json:"total_claims"`
	ApprovedClaims    int64   `json:"approved_claims"`
	RejectedClaims    int64   `json:"rejected_claims"`
	PendingClaims     int64   `json:"pending_claims"`
	TotalPayoutNGN    float64 `json:"total_payout_ngn"`
	AvgPayoutNGN      float64 `json:"avg_payout_ngn"`
	PayoutRatio       float64 `json:"payout_ratio"`
	ApprovalRate      float64 `json:"approval_rate"`
	LastUpdated       string  `json:"last_updated"`
}

// CustomerSegmentation represents customer analytics
type CustomerSegmentation struct {
	Segment           string  `json:"segment"`
	CustomerCount     int64   `json:"customer_count"`
	TotalPolicies     int64   `json:"total_policies"`
	TotalPremiumNGN   float64 `json:"total_premium_ngn"`
	AvgPoliciesPerCust float64 `json:"avg_policies_per_customer"`
	ChurnRate         float64 `json:"churn_rate"`
}

// FraudAnalytics represents fraud detection analytics
type FraudAnalytics struct {
	TotalTransactions   int64   `json:"total_transactions"`
	FlaggedTransactions int64   `json:"flagged_transactions"`
	ConfirmedFraud      int64   `json:"confirmed_fraud"`
	FalsePositives      int64   `json:"false_positives"`
	FraudRate           float64 `json:"fraud_rate"`
	FalsePositiveRate   float64 `json:"false_positive_rate"`
	TotalFraudAmountNGN float64 `json:"total_fraud_amount_ngn"`
	LastUpdated         string  `json:"last_updated"`
}

// GeospatialRiskAnalytics represents location-based risk analytics
type GeospatialRiskAnalytics struct {
	Region            string  `json:"region"`
	State             string  `json:"state"`
	PolicyCount       int64   `json:"policy_count"`
	ClaimCount        int64   `json:"claim_count"`
	ClaimRatio        float64 `json:"claim_ratio"`
	AvgRiskScore      float64 `json:"avg_risk_score"`
	TotalExposureNGN  float64 `json:"total_exposure_ngn"`
}

// NewTrinoAnalyticsService creates a new Trino analytics service
func NewTrinoAnalyticsService() (*TrinoAnalyticsService, error) {
	trinoURL := os.Getenv("TRINO_URL")
	if trinoURL == "" {
		trinoURL = "http://trino:8080"
	}

	catalog := os.Getenv("TRINO_CATALOG")
	if catalog == "" {
		catalog = "lakehouse"
	}

	schema := os.Getenv("TRINO_SCHEMA")
	if schema == "" {
		schema = "insurance"
	}

	// Build DSN for Trino connection
	dsn := fmt.Sprintf("%s?catalog=%s&schema=%s", trinoURL, catalog, schema)

	db, err := sql.Open("trino", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Trino: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping Trino: %w", err)
	}

	return &TrinoAnalyticsService{
		db:         db,
		trinoURL:   trinoURL,
		catalog:    catalog,
		schema:     schema,
		queryCache: make(map[string]*CachedResult),
		cacheTTL:   5 * time.Minute,
	}, nil
}

// GetPolicySummary returns aggregated policy statistics from Trino
func (s *TrinoAnalyticsService) GetPolicySummary(ctx context.Context) (*PolicySummary, error) {
	cacheKey := "policy_summary"

	// Check cache
	if cached := s.getFromCache(cacheKey); cached != nil {
		return cached.(*PolicySummary), nil
	}

	query := `
		SELECT 
			COUNT(*) as total_policies,
			COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_policies,
			COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_policies,
			COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_policies,
			COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_policies,
			COALESCE(SUM(premium_amount), 0) as total_premium_ngn,
			COALESCE(AVG(premium_amount), 0) as avg_premium_ngn
		FROM silver.policy_events
		WHERE year = YEAR(CURRENT_DATE)
	`

	row := s.db.QueryRowContext(ctx, query)

	var summary PolicySummary
	err := row.Scan(
		&summary.TotalPolicies,
		&summary.ActivePolicies,
		&summary.PendingPolicies,
		&summary.CancelledPolicies,
		&summary.ExpiredPolicies,
		&summary.TotalPremiumNGN,
		&summary.AvgPremiumNGN,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query policy summary: %w", err)
	}

	summary.LastUpdated = time.Now().Format(time.RFC3339)

	// Cache result
	s.setCache(cacheKey, &summary)

	return &summary, nil
}

// GetClaimPayoutRatio returns claims analytics from Trino
func (s *TrinoAnalyticsService) GetClaimPayoutRatio(ctx context.Context) (*ClaimPayoutRatio, error) {
	cacheKey := "claim_payout_ratio"

	if cached := s.getFromCache(cacheKey); cached != nil {
		return cached.(*ClaimPayoutRatio), nil
	}

	query := `
		WITH claim_stats AS (
			SELECT 
				COUNT(*) as total_claims,
				COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_claims,
				COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_claims,
				COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_claims,
				COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN payout_amount END), 0) as total_payout_ngn,
				COALESCE(AVG(CASE WHEN status = 'APPROVED' THEN payout_amount END), 0) as avg_payout_ngn
			FROM silver.claim_events
			WHERE year = YEAR(CURRENT_DATE)
		),
		premium_stats AS (
			SELECT COALESCE(SUM(premium_amount), 1) as total_premium
			FROM silver.policy_events
			WHERE year = YEAR(CURRENT_DATE) AND status = 'ACTIVE'
		)
		SELECT 
			cs.total_claims,
			cs.approved_claims,
			cs.rejected_claims,
			cs.pending_claims,
			cs.total_payout_ngn,
			cs.avg_payout_ngn,
			cs.total_payout_ngn / ps.total_premium as payout_ratio,
			CAST(cs.approved_claims AS DOUBLE) / NULLIF(cs.total_claims, 0) as approval_rate
		FROM claim_stats cs, premium_stats ps
	`

	row := s.db.QueryRowContext(ctx, query)

	var ratio ClaimPayoutRatio
	err := row.Scan(
		&ratio.TotalClaims,
		&ratio.ApprovedClaims,
		&ratio.RejectedClaims,
		&ratio.PendingClaims,
		&ratio.TotalPayoutNGN,
		&ratio.AvgPayoutNGN,
		&ratio.PayoutRatio,
		&ratio.ApprovalRate,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query claim payout ratio: %w", err)
	}

	ratio.LastUpdated = time.Now().Format(time.RFC3339)
	s.setCache(cacheKey, &ratio)

	return &ratio, nil
}

// GetCustomerSegmentation returns customer segmentation analytics
func (s *TrinoAnalyticsService) GetCustomerSegmentation(ctx context.Context) ([]CustomerSegmentation, error) {
	cacheKey := "customer_segmentation"

	if cached := s.getFromCache(cacheKey); cached != nil {
		return cached.([]CustomerSegmentation), nil
	}

	query := `
		WITH customer_metrics AS (
			SELECT 
				customer_id,
				COUNT(DISTINCT policy_id) as policy_count,
				SUM(premium_amount) as total_premium,
				MAX(event_timestamp) as last_activity
			FROM silver.policy_events
			WHERE status = 'ACTIVE'
			GROUP BY customer_id
		),
		segmented AS (
			SELECT 
				CASE 
					WHEN total_premium >= 5000000 THEN 'Enterprise'
					WHEN total_premium >= 1000000 THEN 'Premium'
					WHEN total_premium >= 500000 THEN 'Standard'
					ELSE 'Basic'
				END as segment,
				customer_id,
				policy_count,
				total_premium,
				CASE WHEN last_activity < CURRENT_TIMESTAMP - INTERVAL '90' DAY THEN 1 ELSE 0 END as churned
			FROM customer_metrics
		)
		SELECT 
			segment,
			COUNT(DISTINCT customer_id) as customer_count,
			SUM(policy_count) as total_policies,
			SUM(total_premium) as total_premium_ngn,
			AVG(policy_count) as avg_policies_per_customer,
			AVG(churned) as churn_rate
		FROM segmented
		GROUP BY segment
		ORDER BY total_premium_ngn DESC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query customer segmentation: %w", err)
	}
	defer rows.Close()

	var segments []CustomerSegmentation
	for rows.Next() {
		var seg CustomerSegmentation
		if err := rows.Scan(
			&seg.Segment,
			&seg.CustomerCount,
			&seg.TotalPolicies,
			&seg.TotalPremiumNGN,
			&seg.AvgPoliciesPerCust,
			&seg.ChurnRate,
		); err != nil {
			return nil, fmt.Errorf("failed to scan customer segmentation: %w", err)
		}
		segments = append(segments, seg)
	}

	s.setCache(cacheKey, segments)
	return segments, nil
}

// GetFraudAnalytics returns fraud detection analytics
func (s *TrinoAnalyticsService) GetFraudAnalytics(ctx context.Context) (*FraudAnalytics, error) {
	cacheKey := "fraud_analytics"

	if cached := s.getFromCache(cacheKey); cached != nil {
		return cached.(*FraudAnalytics), nil
	}

	query := `
		SELECT 
			COUNT(*) as total_transactions,
			COUNT(CASE WHEN fraud_flag = true THEN 1 END) as flagged_transactions,
			COUNT(CASE WHEN fraud_confirmed = true THEN 1 END) as confirmed_fraud,
			COUNT(CASE WHEN fraud_flag = true AND fraud_confirmed = false THEN 1 END) as false_positives,
			CAST(COUNT(CASE WHEN fraud_confirmed = true THEN 1 END) AS DOUBLE) / NULLIF(COUNT(*), 0) as fraud_rate,
			CAST(COUNT(CASE WHEN fraud_flag = true AND fraud_confirmed = false THEN 1 END) AS DOUBLE) / 
				NULLIF(COUNT(CASE WHEN fraud_flag = true THEN 1 END), 0) as false_positive_rate,
			COALESCE(SUM(CASE WHEN fraud_confirmed = true THEN amount END), 0) as total_fraud_amount_ngn
		FROM silver.payment_events
		WHERE year = YEAR(CURRENT_DATE)
	`

	row := s.db.QueryRowContext(ctx, query)

	var analytics FraudAnalytics
	err := row.Scan(
		&analytics.TotalTransactions,
		&analytics.FlaggedTransactions,
		&analytics.ConfirmedFraud,
		&analytics.FalsePositives,
		&analytics.FraudRate,
		&analytics.FalsePositiveRate,
		&analytics.TotalFraudAmountNGN,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query fraud analytics: %w", err)
	}

	analytics.LastUpdated = time.Now().Format(time.RFC3339)
	s.setCache(cacheKey, &analytics)

	return &analytics, nil
}

// GetGeospatialRiskAnalytics returns location-based risk analytics
func (s *TrinoAnalyticsService) GetGeospatialRiskAnalytics(ctx context.Context) ([]GeospatialRiskAnalytics, error) {
	cacheKey := "geospatial_risk"

	if cached := s.getFromCache(cacheKey); cached != nil {
		return cached.([]GeospatialRiskAnalytics), nil
	}

	query := `
		WITH policy_geo AS (
			SELECT 
				p.policy_id,
				p.premium_amount,
				g.region,
				g.state,
				g.risk_score
			FROM silver.policy_events p
			JOIN silver.geospatial_data g ON p.location_id = g.location_id
			WHERE p.status = 'ACTIVE'
		),
		claim_geo AS (
			SELECT 
				c.policy_id,
				c.payout_amount
			FROM silver.claim_events c
			WHERE c.status = 'APPROVED'
		)
		SELECT 
			pg.region,
			pg.state,
			COUNT(DISTINCT pg.policy_id) as policy_count,
			COUNT(DISTINCT cg.policy_id) as claim_count,
			CAST(COUNT(DISTINCT cg.policy_id) AS DOUBLE) / NULLIF(COUNT(DISTINCT pg.policy_id), 0) as claim_ratio,
			AVG(pg.risk_score) as avg_risk_score,
			SUM(pg.premium_amount) as total_exposure_ngn
		FROM policy_geo pg
		LEFT JOIN claim_geo cg ON pg.policy_id = cg.policy_id
		GROUP BY pg.region, pg.state
		ORDER BY total_exposure_ngn DESC
		LIMIT 50
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query geospatial risk analytics: %w", err)
	}
	defer rows.Close()

	var analytics []GeospatialRiskAnalytics
	for rows.Next() {
		var geo GeospatialRiskAnalytics
		if err := rows.Scan(
			&geo.Region,
			&geo.State,
			&geo.PolicyCount,
			&geo.ClaimCount,
			&geo.ClaimRatio,
			&geo.AvgRiskScore,
			&geo.TotalExposureNGN,
		); err != nil {
			return nil, fmt.Errorf("failed to scan geospatial analytics: %w", err)
		}
		analytics = append(analytics, geo)
	}

	s.setCache(cacheKey, analytics)
	return analytics, nil
}

// ExecuteCustomQuery executes a custom analytics query
func (s *TrinoAnalyticsService) ExecuteCustomQuery(ctx context.Context, query string) ([]map[string]interface{}, error) {
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute custom query: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var results []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = values[i]
		}
		results = append(results, row)
	}

	return results, nil
}

func (s *TrinoAnalyticsService) getFromCache(key string) interface{} {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()

	if cached, ok := s.queryCache[key]; ok {
		if time.Since(cached.Timestamp) < s.cacheTTL {
			return cached.Data
		}
	}
	return nil
}

func (s *TrinoAnalyticsService) setCache(key string, data interface{}) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	s.queryCache[key] = &CachedResult{
		Data:      data,
		Timestamp: time.Now(),
	}
}

// Close closes the database connection
func (s *TrinoAnalyticsService) Close() error {
	return s.db.Close()
}

// HTTP Handlers

func (s *TrinoAnalyticsService) handlePolicySummary(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	summary, err := s.GetPolicySummary(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (s *TrinoAnalyticsService) handleClaimPayoutRatio(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	ratio, err := s.GetClaimPayoutRatio(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ratio)
}

func (s *TrinoAnalyticsService) handleCustomerSegmentation(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	segments, err := s.GetCustomerSegmentation(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(segments)
}

func (s *TrinoAnalyticsService) handleFraudAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	analytics, err := s.GetFraudAnalytics(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

func (s *TrinoAnalyticsService) handleGeospatialRisk(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	analytics, err := s.GetGeospatialRiskAnalytics(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

func (s *TrinoAnalyticsService) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	if err := s.db.PingContext(ctx); err != nil {
		http.Error(w, "unhealthy", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("healthy"))
}

func main() {
	log.Println("Starting Trino Analytics Service...")

	service, err := NewTrinoAnalyticsService()
	if err != nil {
		log.Fatalf("Failed to create analytics service: %v", err)
	}
	defer service.Close()

	// Setup HTTP routes
	http.HandleFunc("/api/v1/analytics/policy-summary", service.handlePolicySummary)
	http.HandleFunc("/api/v1/analytics/claim-payout-ratio", service.handleClaimPayoutRatio)
	http.HandleFunc("/api/v1/analytics/customer-segmentation", service.handleCustomerSegmentation)
	http.HandleFunc("/api/v1/analytics/fraud", service.handleFraudAnalytics)
	http.HandleFunc("/api/v1/analytics/geospatial-risk", service.handleGeospatialRisk)
	http.HandleFunc("/health", service.handleHealth)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("Trino Analytics Service listening on port %s", port)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

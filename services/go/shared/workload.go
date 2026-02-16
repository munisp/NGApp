package shared

import (
	"net/http"
	"strings"
)

type WorkloadTier int

const (
	TierCritical   WorkloadTier = iota
	TierHigh
	TierNormal
	TierBackground
)

func (t WorkloadTier) String() string {
	switch t {
	case TierCritical:
		return "critical"
	case TierHigh:
		return "high"
	case TierNormal:
		return "normal"
	case TierBackground:
		return "background"
	}
	return "unknown"
}

type WorkloadClassifier struct {
	criticalPaths  []string
	highPaths      []string
	backgroundPaths []string
}

func NewWorkloadClassifier() *WorkloadClassifier {
	return &WorkloadClassifier{
		criticalPaths: []string{
			"/api/v1/payments",
			"/api/v1/accounts/balance",
			"/api/v1/fraud/score",
			"/api/v1/transfers",
		},
		highPaths: []string{
			"/api/v1/kyc",
			"/api/v1/kyb",
			"/api/v1/bnpl",
			"/api/v1/investments",
			"/api/v1/accounts",
		},
		backgroundPaths: []string{
			"/api/v1/analytics",
			"/api/v1/ml/retrain",
			"/api/v1/reports",
			"/api/v1/backfill",
			"/api/v1/export",
		},
	}
}

func (wc *WorkloadClassifier) Classify(path string) WorkloadTier {
	for _, p := range wc.criticalPaths {
		if strings.HasPrefix(path, p) {
			return TierCritical
		}
	}
	for _, p := range wc.highPaths {
		if strings.HasPrefix(path, p) {
			return TierHigh
		}
	}
	for _, p := range wc.backgroundPaths {
		if strings.HasPrefix(path, p) {
			return TierBackground
		}
	}
	return TierNormal
}

func WorkloadMiddleware(classifier *WorkloadClassifier, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tier := classifier.Classify(r.URL.Path)
		r.Header.Set("X-Workload-Tier", tier.String())
		w.Header().Set("X-Workload-Tier", tier.String())

		existingTier := r.Header.Get("X-Priority-Tier")
		if existingTier == "" {
			r.Header.Set("X-Priority-Tier", tier.String())
		}

		next.ServeHTTP(w, r)
	})
}

type DBRouter struct {
	classifier *WorkloadClassifier
	pool       *DBPool
	cache      *CacheAside
	logger     *StructuredLogger
}

func NewDBRouter(pool *DBPool, cache *CacheAside, classifier *WorkloadClassifier, logger *StructuredLogger) *DBRouter {
	return &DBRouter{
		classifier: classifier,
		pool:       pool,
		cache:      cache,
		logger:     logger,
	}
}

func (r *DBRouter) ReadForPath(path string) interface{} {
	tier := r.classifier.Classify(path)
	switch tier {
	case TierCritical:
		return r.pool.Primary()
	case TierBackground:
		return r.pool.Replica()
	default:
		return r.pool.ReadDB()
	}
}

func (r *DBRouter) WriteForPath(path string) interface{} {
	return r.pool.WriteDB()
}

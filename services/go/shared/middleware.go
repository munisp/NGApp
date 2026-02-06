package shared

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

type CorrelationIDKey struct{}

func TracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		corrID := r.Header.Get("X-Correlation-ID")
		if corrID == "" {
			corrID = fmt.Sprintf("corr-%d-%d", time.Now().UnixNano(), rand.Intn(10000))
		}
		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = fmt.Sprintf("trace-%d", time.Now().UnixNano())
		}
		spanID := fmt.Sprintf("span-%d", time.Now().UnixNano())

		w.Header().Set("X-Correlation-ID", corrID)
		w.Header().Set("X-Trace-ID", traceID)
		w.Header().Set("X-Span-ID", spanID)

		r.Header.Set("X-Correlation-ID", corrID)
		r.Header.Set("X-Trace-ID", traceID)
		r.Header.Set("X-Span-ID", spanID)

		next.ServeHTTP(w, r)
	})
}

type PrometheusMetrics struct {
	mu             sync.Mutex
	requestCount   map[string]*atomic.Int64
	errorCount     map[string]*atomic.Int64
	latencyBuckets map[string]*LatencyHistogram
	serviceName    string
}

type LatencyHistogram struct {
	buckets []float64
	counts  []atomic.Int64
	sum     atomic.Int64
	count   atomic.Int64
}

func NewPrometheusMetrics(serviceName string) *PrometheusMetrics {
	return &PrometheusMetrics{
		requestCount:   make(map[string]*atomic.Int64),
		errorCount:     make(map[string]*atomic.Int64),
		latencyBuckets: make(map[string]*LatencyHistogram),
		serviceName:    serviceName,
	}
}

func (pm *PrometheusMetrics) getCounter(m map[string]*atomic.Int64, key string) *atomic.Int64 {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if c, ok := m[key]; ok {
		return c
	}
	c := &atomic.Int64{}
	m[key] = c
	return c
}

func (pm *PrometheusMetrics) getHistogram(key string) *LatencyHistogram {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if h, ok := pm.latencyBuckets[key]; ok {
		return h
	}
	h := &LatencyHistogram{
		buckets: []float64{5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000},
		counts:  make([]atomic.Int64, 12),
	}
	pm.latencyBuckets[key] = h
	return h
}

func (pm *PrometheusMetrics) RecordRequest(method, path string, statusCode int, durationMs float64) {
	key := fmt.Sprintf("%s_%s", method, path)
	pm.getCounter(pm.requestCount, key).Add(1)
	if statusCode >= 400 {
		pm.getCounter(pm.errorCount, key).Add(1)
	}
	h := pm.getHistogram(key)
	h.sum.Add(int64(durationMs * 1000))
	h.count.Add(1)
	for i, b := range h.buckets {
		if durationMs <= b {
			h.counts[i].Add(1)
		}
	}
	h.counts[len(h.buckets)].Add(1)
}

func (pm *PrometheusMetrics) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		pm.mu.Lock()
		defer pm.mu.Unlock()

		for key, count := range pm.requestCount {
			fmt.Fprintf(w, "http_requests_total{service=\"%s\",endpoint=\"%s\"} %d\n", pm.serviceName, key, count.Load())
		}
		for key, count := range pm.errorCount {
			fmt.Fprintf(w, "http_errors_total{service=\"%s\",endpoint=\"%s\"} %d\n", pm.serviceName, key, count.Load())
		}
		for key, h := range pm.latencyBuckets {
			for i, b := range h.buckets {
				fmt.Fprintf(w, "http_request_duration_ms_bucket{service=\"%s\",endpoint=\"%s\",le=\"%.0f\"} %d\n", pm.serviceName, key, b, h.counts[i].Load())
			}
			fmt.Fprintf(w, "http_request_duration_ms_bucket{service=\"%s\",endpoint=\"%s\",le=\"+Inf\"} %d\n", pm.serviceName, key, h.counts[len(h.buckets)].Load())
			fmt.Fprintf(w, "http_request_duration_ms_sum{service=\"%s\",endpoint=\"%s\"} %.3f\n", pm.serviceName, key, float64(h.sum.Load())/1000)
			fmt.Fprintf(w, "http_request_duration_ms_count{service=\"%s\",endpoint=\"%s\"} %d\n", pm.serviceName, key, h.count.Load())
		}
	}
}

func MetricsMiddleware(metrics *PrometheusMetrics, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rw, r)
		durationMs := float64(time.Since(start).Microseconds()) / 1000
		metrics.RecordRequest(r.Method, r.URL.Path, rw.statusCode, durationMs)
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func JWTAuthMiddleware(keycloakURL string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || r.URL.Path == "/metrics" || r.URL.Path == "/prometheus" || r.URL.Path == "/ready" || r.URL.Path == "/live" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			next.ServeHTTP(w, r)
			return
		}

		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token := authHeader[7:]
			valid, userID := validateToken(keycloakURL, token)
			if valid {
				r.Header.Set("X-User-ID", userID)
			}
		}

		next.ServeHTTP(w, r)
	})
}

func validateToken(keycloakURL, token string) (bool, string) {
	if keycloakURL == "" || token == "" {
		return false, ""
	}
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("POST", keycloakURL+"/auth/validate", nil)
	if err != nil {
		return false, ""
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(req)
	if err != nil {
		return false, ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return false, ""
	}
	var result struct {
		Valid  bool   `json:"valid"`
		UserID string `json:"user_id"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Valid, result.UserID
}

type CircuitBreaker struct {
	name          string
	maxFailures   int
	timeout       time.Duration
	failures      atomic.Int64
	state         atomic.Int32
	lastFailureAt atomic.Int64
}

const (
	StateClosed   int32 = 0
	StateOpen     int32 = 1
	StateHalfOpen int32 = 2
)

func NewCircuitBreaker(name string, maxFailures int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		name:        name,
		maxFailures: maxFailures,
		timeout:     timeout,
	}
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
	state := cb.state.Load()

	if state == StateOpen {
		lastFail := time.Unix(0, cb.lastFailureAt.Load())
		if time.Since(lastFail) > cb.timeout {
			cb.state.CompareAndSwap(StateOpen, StateHalfOpen)
		} else {
			return fmt.Errorf("circuit breaker %s is open", cb.name)
		}
	}

	err := fn()
	if err != nil {
		failures := cb.failures.Add(1)
		cb.lastFailureAt.Store(time.Now().UnixNano())
		if failures >= int64(cb.maxFailures) {
			cb.state.Store(StateOpen)
		}
		return err
	}

	cb.failures.Store(0)
	cb.state.Store(StateClosed)
	return nil
}

func (cb *CircuitBreaker) State() string {
	switch cb.state.Load() {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	}
	return "unknown"
}

func RetryWithBackoff(maxRetries int, baseDelay time.Duration, fn func() error) error {
	var lastErr error
	for i := 0; i <= maxRetries; i++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		if i < maxRetries {
			delay := time.Duration(float64(baseDelay) * math.Pow(2, float64(i)))
			jitter := time.Duration(rand.Int63n(int64(delay / 2)))
			time.Sleep(delay + jitter)
		}
	}
	return fmt.Errorf("after %d retries: %w", maxRetries, lastErr)
}

type StructuredLogger struct {
	service string
}

func NewLogger(service string) *StructuredLogger {
	return &StructuredLogger{service: service}
}

func (l *StructuredLogger) log(level, msg string, fields map[string]interface{}) {
	entry := map[string]interface{}{
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"level":     level,
		"service":   l.service,
		"message":   msg,
	}
	for k, v := range fields {
		entry[k] = v
	}
	data, _ := json.Marshal(entry)
	fmt.Println(string(data))
}

func (l *StructuredLogger) Info(msg string, fields map[string]interface{}) {
	l.log("info", msg, fields)
}

func (l *StructuredLogger) Error(msg string, fields map[string]interface{}) {
	l.log("error", msg, fields)
}

func (l *StructuredLogger) Warn(msg string, fields map[string]interface{}) {
	l.log("warn", msg, fields)
}

func (l *StructuredLogger) Debug(msg string, fields map[string]interface{}) {
	l.log("debug", msg, fields)
}

func ReadinessHandler(checks map[string]func() bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		allReady := true
		results := make(map[string]bool)
		for name, check := range checks {
			ok := check()
			results[name] = ok
			if !ok {
				allReady = false
			}
		}
		w.Header().Set("Content-Type", "application/json")
		if !allReady {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ready":  allReady,
			"checks": results,
		})
	}
}

func LivenessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"alive":     true,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

type HTTPClient struct {
	client  *http.Client
	breaker *CircuitBreaker
	logger  *StructuredLogger
}

func NewHTTPClient(serviceName string, timeout time.Duration, maxFailures int) *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		breaker: NewCircuitBreaker(serviceName, maxFailures, 30*time.Second),
		logger:  NewLogger(serviceName),
	}
}

func (hc *HTTPClient) Do(req *http.Request) (*http.Response, error) {
	var resp *http.Response
	err := hc.breaker.Execute(func() error {
		var err error
		resp, err = hc.client.Do(req)
		if err != nil {
			return err
		}
		if resp.StatusCode >= 500 {
			return fmt.Errorf("server error: %d", resp.StatusCode)
		}
		return nil
	})
	return resp, err
}

func (hc *HTTPClient) CircuitState() string {
	return hc.breaker.State()
}

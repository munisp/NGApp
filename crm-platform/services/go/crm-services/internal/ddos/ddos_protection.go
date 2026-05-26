package ddos

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// DDoS Protection Service with adaptive rate limiting, IP reputation,
// geographic blocking, connection throttling, and circuit breaker patterns

type ProtectionConfig struct {
	GlobalRateLimit     int           `json:"global_rate_limit"`
	PerIPRateLimit      int           `json:"per_ip_rate_limit"`
	PerTenantRateLimit  int           `json:"per_tenant_rate_limit"`
	BurstMultiplier     float64       `json:"burst_multiplier"`
	WindowSize          time.Duration `json:"window_size"`
	BanThreshold        int           `json:"ban_threshold"`
	BanDuration         time.Duration `json:"ban_duration"`
	SuspiciousThreshold int           `json:"suspicious_threshold"`
	MaxConnectionsPerIP int           `json:"max_connections_per_ip"`
	SlowRequestTimeout  time.Duration `json:"slow_request_timeout"`
	GeoBlockedCountries []string      `json:"geo_blocked_countries"`
	WhitelistedIPs      []string      `json:"whitelisted_ips"`
	WhitelistedCIDRs    []string      `json:"whitelisted_cidrs"`
	EnableAdaptive      bool          `json:"enable_adaptive"`
	CircuitBreakerThreshold float64   `json:"circuit_breaker_threshold"`
}

func DefaultProtectionConfig() *ProtectionConfig {
	return &ProtectionConfig{
		GlobalRateLimit:     50000,
		PerIPRateLimit:      100,
		PerTenantRateLimit:  10000,
		BurstMultiplier:     2.0,
		WindowSize:          time.Minute,
		BanThreshold:        5,
		BanDuration:         24 * time.Hour,
		SuspiciousThreshold: 3,
		MaxConnectionsPerIP: 50,
		SlowRequestTimeout:  30 * time.Second,
		EnableAdaptive:      true,
		CircuitBreakerThreshold: 0.8,
	}
}

type IPReputation struct {
	IP              string    `json:"ip"`
	Score           float64   `json:"score"`
	Violations      int       `json:"violations"`
	LastViolation   time.Time `json:"last_violation"`
	IsBanned        bool      `json:"is_banned"`
	BannedUntil     time.Time `json:"banned_until"`
	RequestCount    int64     `json:"request_count"`
	AvgResponseTime float64   `json:"avg_response_time"`
	GeoCountry      string    `json:"geo_country"`
	IsTor           bool      `json:"is_tor"`
	IsProxy         bool      `json:"is_proxy"`
	IsDatacenter    bool      `json:"is_datacenter"`
	ThreatLevel     string    `json:"threat_level"`
}

type AttackType string

const (
	AttackVolumetric       AttackType = "volumetric"
	AttackSlowloris        AttackType = "slowloris"
	AttackHTTPFlood        AttackType = "http_flood"
	AttackApplicationLayer AttackType = "application_layer"
	AttackBruteForce       AttackType = "brute_force"
	AttackScraping         AttackType = "scraping"
)

type AttackSignal struct {
	Type       AttackType `json:"type"`
	Confidence float64    `json:"confidence"`
	SourceIPs  []string   `json:"source_ips"`
	TargetPath string     `json:"target_path"`
	StartTime  time.Time  `json:"start_time"`
	RPS        float64    `json:"rps"`
}

type CircuitBreaker struct {
	state     int32 // 0=closed, 1=half-open, 2=open
	failures  int64
	successes int64
	threshold float64
	resetTime time.Time
	mu        sync.RWMutex
}

type DDoSProtectionService struct {
	config       *ProtectionConfig
	ipTracker    map[string]*ipState
	ipMu         sync.RWMutex
	reputation   map[string]*IPReputation
	reputationMu sync.RWMutex
	globalCount  int64
	circuitBreaker *CircuitBreaker
	whitelist    map[string]bool
	whitelistNets []*net.IPNet
	attackSignals chan *AttackSignal
	metricsCollector *metricsCollector
	stopCh       chan struct{}
}

type ipState struct {
	count       int64
	firstSeen   time.Time
	lastSeen    time.Time
	connections int32
	windowStart time.Time
	violations  int
}

type metricsCollector struct {
	totalRequests    int64
	blockedRequests  int64
	rateLimited      int64
	bannedIPs        int64
	activeAttacks    int64
}

func NewDDoSProtectionService(config *ProtectionConfig) *DDoSProtectionService {
	if config == nil {
		config = DefaultProtectionConfig()
	}
	svc := &DDoSProtectionService{
		config:      config,
		ipTracker:   make(map[string]*ipState),
		reputation:  make(map[string]*IPReputation),
		whitelist:   make(map[string]bool),
		attackSignals: make(chan *AttackSignal, 100),
		circuitBreaker: &CircuitBreaker{
			threshold: config.CircuitBreakerThreshold,
		},
		metricsCollector: &metricsCollector{},
		stopCh: make(chan struct{}),
	}

	for _, ip := range config.WhitelistedIPs {
		svc.whitelist[ip] = true
	}
	for _, cidr := range config.WhitelistedCIDRs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err == nil {
			svc.whitelistNets = append(svc.whitelistNets, ipNet)
		}
	}

	go svc.cleanupLoop()
	go svc.adaptiveAnalysis()
	return svc
}

func (s *DDoSProtectionService) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt64(&s.metricsCollector.totalRequests, 1)
			atomic.AddInt64(&s.globalCount, 1)

			ip := extractIP(r)

			if s.isWhitelisted(ip) {
				next.ServeHTTP(w, r)
				return
			}

			// Check circuit breaker
			if atomic.LoadInt32(&s.circuitBreaker.state) == 2 {
				atomic.AddInt64(&s.metricsCollector.blockedRequests, 1)
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"service_overloaded","retry_after":60}`, http.StatusServiceUnavailable)
				return
			}

			// Check IP ban
			if s.isIPBanned(ip) {
				atomic.AddInt64(&s.metricsCollector.blockedRequests, 1)
				http.Error(w, `{"error":"ip_banned","contact":"security@platform.ng"}`, http.StatusForbidden)
				return
			}

			// Check rate limits
			if !s.checkRateLimit(ip) {
				atomic.AddInt64(&s.metricsCollector.rateLimited, 1)
				s.recordViolation(ip, "rate_limit_exceeded")
				w.Header().Set("Retry-After", "10")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", s.config.PerIPRateLimit))
				w.Header().Set("X-RateLimit-Remaining", "0")
				http.Error(w, `{"error":"rate_limit_exceeded","retry_after":10}`, http.StatusTooManyRequests)
				return
			}

			// Connection tracking
			if !s.trackConnection(ip) {
				s.recordViolation(ip, "max_connections_exceeded")
				http.Error(w, `{"error":"too_many_connections"}`, http.StatusTooManyRequests)
				return
			}
			defer s.releaseConnection(ip)

			// Security headers
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")

			next.ServeHTTP(w, r)
		})
	}
}

func (s *DDoSProtectionService) isWhitelisted(ip string) bool {
	if s.whitelist[ip] {
		return true
	}
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}
	for _, ipNet := range s.whitelistNets {
		if ipNet.Contains(parsedIP) {
			return true
		}
	}
	return false
}

func (s *DDoSProtectionService) isIPBanned(ip string) bool {
	s.reputationMu.RLock()
	rep, exists := s.reputation[ip]
	s.reputationMu.RUnlock()
	if !exists {
		return false
	}
	if rep.IsBanned && time.Now().Before(rep.BannedUntil) {
		return true
	}
	if rep.IsBanned && time.Now().After(rep.BannedUntil) {
		s.reputationMu.Lock()
		rep.IsBanned = false
		s.reputationMu.Unlock()
	}
	return false
}

func (s *DDoSProtectionService) checkRateLimit(ip string) bool {
	now := time.Now()
	s.ipMu.Lock()
	state, exists := s.ipTracker[ip]
	if !exists {
		s.ipTracker[ip] = &ipState{
			count:       1,
			firstSeen:   now,
			lastSeen:    now,
			windowStart: now,
		}
		s.ipMu.Unlock()
		return true
	}

	if now.Sub(state.windowStart) > s.config.WindowSize {
		state.count = 1
		state.windowStart = now
		state.lastSeen = now
		s.ipMu.Unlock()
		return true
	}

	state.count++
	state.lastSeen = now

	limit := int64(s.config.PerIPRateLimit)
	if s.config.EnableAdaptive {
		load := float64(atomic.LoadInt64(&s.globalCount)) / float64(s.config.GlobalRateLimit)
		if load > 0.8 {
			limit = int64(float64(limit) * (1.0 - (load-0.8)*2.0))
			if limit < 10 {
				limit = 10
			}
		}
	}

	allowed := state.count <= limit
	s.ipMu.Unlock()
	return allowed
}

func (s *DDoSProtectionService) trackConnection(ip string) bool {
	s.ipMu.Lock()
	defer s.ipMu.Unlock()
	state, exists := s.ipTracker[ip]
	if !exists {
		s.ipTracker[ip] = &ipState{connections: 1, firstSeen: time.Now(), windowStart: time.Now()}
		return true
	}
	if int(state.connections) >= s.config.MaxConnectionsPerIP {
		return false
	}
	atomic.AddInt32(&state.connections, 1)
	return true
}

func (s *DDoSProtectionService) releaseConnection(ip string) {
	s.ipMu.RLock()
	state, exists := s.ipTracker[ip]
	s.ipMu.RUnlock()
	if exists {
		atomic.AddInt32(&state.connections, -1)
	}
}

func (s *DDoSProtectionService) recordViolation(ip, violationType string) {
	s.reputationMu.Lock()
	defer s.reputationMu.Unlock()

	rep, exists := s.reputation[ip]
	if !exists {
		rep = &IPReputation{IP: ip, Score: 100.0}
		s.reputation[ip] = rep
	}

	rep.Violations++
	rep.LastViolation = time.Now()
	rep.Score = math.Max(0, rep.Score-20.0)

	if rep.Violations >= s.config.BanThreshold {
		rep.IsBanned = true
		rep.BannedUntil = time.Now().Add(s.config.BanDuration)
		rep.ThreatLevel = "critical"
		atomic.AddInt64(&s.metricsCollector.bannedIPs, 1)
	} else if rep.Violations >= s.config.SuspiciousThreshold {
		rep.ThreatLevel = "high"
	}
}

func (s *DDoSProtectionService) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.cleanup()
		case <-s.stopCh:
			return
		}
	}
}

func (s *DDoSProtectionService) cleanup() {
	cutoff := time.Now().Add(-10 * time.Minute)
	s.ipMu.Lock()
	for ip, state := range s.ipTracker {
		if state.lastSeen.Before(cutoff) && state.connections == 0 {
			delete(s.ipTracker, ip)
		}
	}
	s.ipMu.Unlock()
	atomic.StoreInt64(&s.globalCount, 0)
}

func (s *DDoSProtectionService) adaptiveAnalysis() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.analyzeTrafficPatterns()
		case <-s.stopCh:
			return
		}
	}
}

func (s *DDoSProtectionService) analyzeTrafficPatterns() {
	total := atomic.LoadInt64(&s.metricsCollector.totalRequests)
	blocked := atomic.LoadInt64(&s.metricsCollector.blockedRequests)
	if total == 0 {
		return
	}
	blockRate := float64(blocked) / float64(total)
	if blockRate > s.config.CircuitBreakerThreshold {
		atomic.StoreInt32(&s.circuitBreaker.state, 2)
		s.circuitBreaker.mu.Lock()
		s.circuitBreaker.resetTime = time.Now().Add(60 * time.Second)
		s.circuitBreaker.mu.Unlock()
		atomic.AddInt64(&s.metricsCollector.activeAttacks, 1)
	}

	s.circuitBreaker.mu.RLock()
	if atomic.LoadInt32(&s.circuitBreaker.state) == 2 && time.Now().After(s.circuitBreaker.resetTime) {
		atomic.StoreInt32(&s.circuitBreaker.state, 1)
	}
	s.circuitBreaker.mu.RUnlock()
}

func (s *DDoSProtectionService) GetMetrics() map[string]interface{} {
	return map[string]interface{}{
		"total_requests":  atomic.LoadInt64(&s.metricsCollector.totalRequests),
		"blocked_requests": atomic.LoadInt64(&s.metricsCollector.blockedRequests),
		"rate_limited":     atomic.LoadInt64(&s.metricsCollector.rateLimited),
		"banned_ips":       atomic.LoadInt64(&s.metricsCollector.bannedIPs),
		"active_attacks":   atomic.LoadInt64(&s.metricsCollector.activeAttacks),
		"circuit_state":    atomic.LoadInt32(&s.circuitBreaker.state),
	}
}

func (s *DDoSProtectionService) GetIPReputation(ip string) *IPReputation {
	s.reputationMu.RLock()
	defer s.reputationMu.RUnlock()
	if rep, ok := s.reputation[ip]; ok {
		return rep
	}
	return &IPReputation{IP: ip, Score: 100.0, ThreatLevel: "none"}
}

// Handler for DDoS protection dashboard API
type DDoSHandler struct {
	service *DDoSProtectionService
}

func NewDDoSHandler(service *DDoSProtectionService) *DDoSHandler {
	return &DDoSHandler{service: service}
}

func (h *DDoSHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/security/ddos/metrics", h.GetMetrics)
	mux.HandleFunc("GET /api/v1/security/ddos/reputation/{ip}", h.GetIPReputation)
	mux.HandleFunc("POST /api/v1/security/ddos/ban", h.BanIP)
	mux.HandleFunc("POST /api/v1/security/ddos/unban", h.UnbanIP)
	mux.HandleFunc("GET /api/v1/security/ddos/banned", h.ListBanned)
}

func (h *DDoSHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.service.GetMetrics())
}

func (h *DDoSHandler) GetIPReputation(w http.ResponseWriter, r *http.Request) {
	ip := r.PathValue("ip")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.service.GetIPReputation(ip))
}

func (h *DDoSHandler) BanIP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IP       string `json:"ip"`
		Duration string `json:"duration"`
		Reason   string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	dur, _ := time.ParseDuration(req.Duration)
	if dur == 0 {
		dur = 24 * time.Hour
	}
	h.service.reputationMu.Lock()
	h.service.reputation[req.IP] = &IPReputation{
		IP: req.IP, IsBanned: true, BannedUntil: time.Now().Add(dur),
		Score: 0, ThreatLevel: "critical",
	}
	h.service.reputationMu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

func (h *DDoSHandler) UnbanIP(w http.ResponseWriter, r *http.Request) {
	var req struct{ IP string `json:"ip"` }
	json.NewDecoder(r.Body).Decode(&req)
	h.service.reputationMu.Lock()
	if rep, ok := h.service.reputation[req.IP]; ok {
		rep.IsBanned = false
		rep.Score = 50.0
	}
	h.service.reputationMu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

func (h *DDoSHandler) ListBanned(w http.ResponseWriter, r *http.Request) {
	h.service.reputationMu.RLock()
	var banned []*IPReputation
	for _, rep := range h.service.reputation {
		if rep.IsBanned && time.Now().Before(rep.BannedUntil) {
			banned = append(banned, rep)
		}
	}
	h.service.reputationMu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(banned)
}

func (s *DDoSProtectionService) Stop() {
	close(s.stopCh)
}

func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

var strings = struct {
	Split     func(string, string) []string
	TrimSpace func(string) string
}{
	Split:     splitString,
	TrimSpace: trimSpace,
}

func splitString(s, sep string) []string {
	result := []string{}
	for len(s) > 0 {
		i := indexOf(s, sep)
		if i < 0 {
			result = append(result, s)
			break
		}
		result = append(result, s[:i])
		s = s[i+len(sep):]
	}
	return result
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	start := 0
	for start < len(s) && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	end := len(s)
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

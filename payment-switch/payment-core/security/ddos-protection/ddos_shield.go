package ddos

import (
	"math"
	"sync"
	"time"
)

type AttackType string

const (
	AttackVolumetric    AttackType = "VOLUMETRIC"
	AttackProtocol      AttackType = "PROTOCOL"
	AttackApplicationL7 AttackType = "APPLICATION_L7"
	AttackSlowloris     AttackType = "SLOWLORIS"
	AttackSYNFlood      AttackType = "SYN_FLOOD"
	AttackHTTPFlood     AttackType = "HTTP_FLOOD"
	AttackDNSAmplify    AttackType = "DNS_AMPLIFICATION"
)

type MitigationAction string

const (
	ActionAllow     MitigationAction = "ALLOW"
	ActionChallenge MitigationAction = "CHALLENGE"
	ActionRateLimit MitigationAction = "RATE_LIMIT"
	ActionBlock     MitigationAction = "BLOCK"
	ActionBlackhole MitigationAction = "BLACKHOLE"
)

type RateLimitConfig struct {
	WindowSeconds    int
	MaxRequests      int
	BurstMultiplier  float64
	AdaptiveEnabled  bool
	GeoAwareEnabled  bool
	WhitelistedCIDRs []string
}

type RequestFingerprint struct {
	IP        string
	UserAgent string
	Path      string
	Method    string
	Headers   map[string]string
	Timestamp time.Time
	GeoRegion string
	ASN       int
}

type ThreatScore struct {
	Score       float64
	AttackTypes []AttackType
	Confidence  float64
	Action      MitigationAction
}

type DDoSShield struct {
	mu              sync.RWMutex
	requestCounters map[string]*SlidingWindow
	blacklist       map[string]time.Time
	whitelist       map[string]bool
	geoBlocks       map[string]bool
	asnBlocks       map[int]bool
	config          ShieldConfig
	metrics         ShieldMetrics
}

type ShieldConfig struct {
	GlobalRateLimit        RateLimitConfig
	PerIPRateLimit         RateLimitConfig
	PerPathRateLimits      map[string]RateLimitConfig
	SYNFloodThreshold      int
	SlowlorisTimeout       time.Duration
	ChallengeMode          string // "js", "captcha", "proof-of-work"
	AutoBlacklistDuration  time.Duration
	GeoBlockCountries      []string
	ASNBlockList           []int
	L7DetectionEnabled     bool
	BotDetectionEnabled    bool
	TrafficBaselineWindowH int
}

type ShieldMetrics struct {
	TotalRequests       int64
	BlockedRequests     int64
	ChallengedRequests  int64
	RateLimitedRequests int64
	AttacksDetected     int64
	ActiveBlacklist     int
	MitigationLatencyUs int64
}

type SlidingWindow struct {
	counts    []int
	windowSec int
	startTime time.Time
}

var DefaultConfig = ShieldConfig{
	GlobalRateLimit: RateLimitConfig{
		WindowSeconds:   60,
		MaxRequests:     10000,
		BurstMultiplier: 2.0,
		AdaptiveEnabled: true,
	},
	PerIPRateLimit: RateLimitConfig{
		WindowSeconds:    60,
		MaxRequests:      100,
		BurstMultiplier:  1.5,
		AdaptiveEnabled:  true,
		GeoAwareEnabled:  true,
		WhitelistedCIDRs: []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"},
	},
	PerPathRateLimits: map[string]RateLimitConfig{
		"/api/v1/payments/nip": {WindowSeconds: 1, MaxRequests: 50, BurstMultiplier: 3.0},
		"/api/v1/auth/login":  {WindowSeconds: 60, MaxRequests: 5, BurstMultiplier: 1.0},
		"/api/v1/auth/token":  {WindowSeconds: 60, MaxRequests: 10, BurstMultiplier: 1.0},
		"/api/v1/bvn/verify":  {WindowSeconds: 60, MaxRequests: 3, BurstMultiplier: 1.0},
		"/graphql":            {WindowSeconds: 60, MaxRequests: 30, BurstMultiplier: 1.5},
	},
	SYNFloodThreshold:      5000,
	SlowlorisTimeout:       10 * time.Second,
	ChallengeMode:          "js",
	AutoBlacklistDuration:  24 * time.Hour,
	GeoBlockCountries:      []string{"KP", "IR", "SY"},
	ASNBlockList:           []int{},
	L7DetectionEnabled:     true,
	BotDetectionEnabled:    true,
	TrafficBaselineWindowH: 24,
}

func NewDDoSShield(cfg ShieldConfig) *DDoSShield {
	return &DDoSShield{
		requestCounters: make(map[string]*SlidingWindow),
		blacklist:       make(map[string]time.Time),
		whitelist:       make(map[string]bool),
		geoBlocks:       make(map[string]bool),
		asnBlocks:       make(map[int]bool),
		config:          cfg,
	}
}

func (s *DDoSShield) EvaluateRequest(fp RequestFingerprint) ThreatScore {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.metrics.TotalRequests++

	if _, blocked := s.blacklist[fp.IP]; blocked {
		s.metrics.BlockedRequests++
		return ThreatScore{Score: 1.0, Action: ActionBlock, Confidence: 1.0, AttackTypes: []AttackType{AttackHTTPFlood}}
	}

	if s.whitelist[fp.IP] {
		return ThreatScore{Score: 0.0, Action: ActionAllow, Confidence: 1.0}
	}

	if s.geoBlocks[fp.GeoRegion] {
		s.metrics.BlockedRequests++
		return ThreatScore{Score: 0.9, Action: ActionBlock, Confidence: 0.95, AttackTypes: []AttackType{AttackVolumetric}}
	}

	score := s.calculateThreatScore(fp)

	switch {
	case score.Score >= 0.9:
		score.Action = ActionBlock
		s.blacklist[fp.IP] = time.Now().Add(s.config.AutoBlacklistDuration)
		s.metrics.BlockedRequests++
		s.metrics.AttacksDetected++
	case score.Score >= 0.7:
		score.Action = ActionChallenge
		s.metrics.ChallengedRequests++
	case score.Score >= 0.5:
		score.Action = ActionRateLimit
		s.metrics.RateLimitedRequests++
	default:
		score.Action = ActionAllow
	}

	return score
}

func (s *DDoSShield) calculateThreatScore(fp RequestFingerprint) ThreatScore {
	var totalScore float64
	var attacks []AttackType

	// Rate check
	window, exists := s.requestCounters[fp.IP]
	if !exists {
		window = &SlidingWindow{windowSec: s.config.PerIPRateLimit.WindowSeconds, startTime: time.Now()}
		s.requestCounters[fp.IP] = window
	}
	requestRate := float64(len(window.counts)) / float64(s.config.PerIPRateLimit.WindowSeconds)
	if requestRate > float64(s.config.PerIPRateLimit.MaxRequests)/float64(s.config.PerIPRateLimit.WindowSeconds) {
		totalScore += 0.4
		attacks = append(attacks, AttackHTTPFlood)
	}

	// User-Agent anomaly
	if fp.UserAgent == "" || len(fp.UserAgent) < 10 {
		totalScore += 0.2
		attacks = append(attacks, AttackApplicationL7)
	}

	// Path-specific rate limits
	if pathLimit, ok := s.config.PerPathRateLimits[fp.Path]; ok {
		if requestRate > float64(pathLimit.MaxRequests)/float64(pathLimit.WindowSeconds) {
			totalScore += 0.3
		}
	}

	totalScore = math.Min(totalScore, 1.0)

	return ThreatScore{
		Score:       totalScore,
		AttackTypes: attacks,
		Confidence:  0.85,
	}
}

func (s *DDoSShield) GetMetrics() ShieldMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := s.metrics
	m.ActiveBlacklist = len(s.blacklist)
	return m
}

func (s *DDoSShield) AddToWhitelist(ip string)           { s.mu.Lock(); s.whitelist[ip] = true; s.mu.Unlock() }
func (s *DDoSShield) RemoveFromBlacklist(ip string)       { s.mu.Lock(); delete(s.blacklist, ip); s.mu.Unlock() }
func (s *DDoSShield) BlockGeoRegion(region string)        { s.mu.Lock(); s.geoBlocks[region] = true; s.mu.Unlock() }
func (s *DDoSShield) BlockASN(asn int)                    { s.mu.Lock(); s.asnBlocks[asn] = true; s.mu.Unlock() }

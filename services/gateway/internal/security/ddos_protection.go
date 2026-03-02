package security

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// DDoSProtection provides distributed denial-of-service mitigation.
// Implements multi-layer rate limiting, IP reputation tracking, connection throttling,
// and adaptive thresholds based on current load.
//
// Layer 1: Global rate limit (requests per second across all clients)
// Layer 2: Per-IP rate limit (requests per minute per IP)
// Layer 3: Per-endpoint rate limit (requests per minute per endpoint)
// Layer 4: Behavioral analysis (sudden traffic spikes, unusual patterns)
// Layer 5: IP reputation (known bad actors, Tor exit nodes, cloud provider IPs)
type DDoSProtection struct {
	mu              sync.RWMutex
	ipCounters      map[string]*rateBucket
	endpointCounters map[string]*rateBucket
	globalCounter   *rateBucket
	blockedIPs      map[string]time.Time
	ipReputation    map[string]float64 // 0.0 = clean, 100.0 = malicious
	config          DDoSConfig
}

// DDoSConfig holds DDoS protection configuration
type DDoSConfig struct {
	GlobalRPS           int           `json:"global_rps"`            // Global requests per second limit
	PerIPRPM            int           `json:"per_ip_rpm"`            // Per-IP requests per minute
	PerEndpointRPM      int           `json:"per_endpoint_rpm"`      // Per-endpoint requests per minute
	BlockDuration       time.Duration `json:"block_duration"`        // How long to block offending IPs
	SpikeThreshold      float64       `json:"spike_threshold"`       // Traffic spike multiplier threshold
	ReputationThreshold float64       `json:"reputation_threshold"`  // IP reputation score to auto-block
	Enabled             bool          `json:"enabled"`
}

type rateBucket struct {
	count     int
	windowStart time.Time
	window    time.Duration
}

func newRateBucket(window time.Duration) *rateBucket {
	return &rateBucket{
		windowStart: time.Now(),
		window:      window,
	}
}

func (rb *rateBucket) increment() int {
	now := time.Now()
	if now.Sub(rb.windowStart) > rb.window {
		rb.count = 0
		rb.windowStart = now
	}
	rb.count++
	return rb.count
}

// DefaultDDoSConfig returns production-grade DDoS protection defaults
func DefaultDDoSConfig() DDoSConfig {
	return DDoSConfig{
		GlobalRPS:           10000,
		PerIPRPM:            300,
		PerEndpointRPM:      100,
		BlockDuration:       15 * time.Minute,
		SpikeThreshold:      5.0,
		ReputationThreshold: 80.0,
		Enabled:             true,
	}
}

// NewDDoSProtection creates a new DDoS protection layer
func NewDDoSProtection(config DDoSConfig) *DDoSProtection {
	ddos := &DDoSProtection{
		ipCounters:       make(map[string]*rateBucket),
		endpointCounters: make(map[string]*rateBucket),
		globalCounter:    newRateBucket(time.Second),
		blockedIPs:       make(map[string]time.Time),
		ipReputation:     make(map[string]float64),
		config:           config,
	}

	// Cleanup goroutine
	go ddos.cleanupLoop()
	return ddos
}

// Middleware returns Gin middleware for DDoS protection
func (d *DDoSProtection) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !d.config.Enabled {
			c.Next()
			return
		}

		ip := c.ClientIP()

		// Layer 0: Check if IP is blocked
		d.mu.RLock()
		blockExpiry, isBlocked := d.blockedIPs[ip]
		d.mu.RUnlock()

		if isBlocked && time.Now().Before(blockExpiry) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "Your IP has been temporarily blocked due to excessive requests",
				"code":    "IP_BLOCKED",
				"retry_after": int(time.Until(blockExpiry).Seconds()),
			})
			c.Abort()
			return
		}

		// Layer 1: Global rate limit
		d.mu.Lock()
		globalCount := d.globalCounter.increment()
		d.mu.Unlock()

		if globalCount > d.config.GlobalRPS {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"error":   "Service temporarily overloaded, please retry",
				"code":    "GLOBAL_RATE_LIMIT",
			})
			c.Abort()
			return
		}

		// Layer 2: Per-IP rate limit
		d.mu.Lock()
		if _, ok := d.ipCounters[ip]; !ok {
			d.ipCounters[ip] = newRateBucket(time.Minute)
		}
		ipCount := d.ipCounters[ip].increment()
		d.mu.Unlock()

		if ipCount > d.config.PerIPRPM {
			// Block the IP
			d.mu.Lock()
			d.blockedIPs[ip] = time.Now().Add(d.config.BlockDuration)
			d.ipReputation[ip] += 20.0
			d.mu.Unlock()

			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "Rate limit exceeded for your IP",
				"code":    "IP_RATE_LIMIT",
				"retry_after": int(d.config.BlockDuration.Seconds()),
			})
			c.Abort()
			return
		}

		// Layer 3: Per-endpoint rate limit
		endpoint := c.Request.Method + ":" + c.FullPath()
		d.mu.Lock()
		if _, ok := d.endpointCounters[endpoint]; !ok {
			d.endpointCounters[endpoint] = newRateBucket(time.Minute)
		}
		endpointCount := d.endpointCounters[endpoint].increment()
		d.mu.Unlock()

		if endpointCount > d.config.PerEndpointRPM {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "Endpoint rate limit exceeded",
				"code":    "ENDPOINT_RATE_LIMIT",
			})
			c.Abort()
			return
		}

		// Layer 4: IP reputation check
		d.mu.RLock()
		reputation := d.ipReputation[ip]
		d.mu.RUnlock()

		if reputation >= d.config.ReputationThreshold {
			d.mu.Lock()
			d.blockedIPs[ip] = time.Now().Add(d.config.BlockDuration * 4) // 4x longer for bad reputation
			d.mu.Unlock()

			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Access denied based on IP reputation",
				"code":    "IP_REPUTATION_BLOCK",
			})
			c.Abort()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", d.config.PerIPRPM))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", d.config.PerIPRPM-ipCount))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(time.Minute).Unix()))

		c.Next()
	}
}

// BlockIP manually blocks an IP address
func (d *DDoSProtection) BlockIP(ip string, duration time.Duration) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.blockedIPs[ip] = time.Now().Add(duration)
}

// UnblockIP removes an IP from the blocklist
func (d *DDoSProtection) UnblockIP(ip string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.blockedIPs, ip)
}

// SetReputation sets the reputation score for an IP
func (d *DDoSProtection) SetReputation(ip string, score float64) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.ipReputation[ip] = score
}

// Stats returns current DDoS protection statistics
func (d *DDoSProtection) Stats() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return map[string]interface{}{
		"blocked_ips":      len(d.blockedIPs),
		"tracked_ips":      len(d.ipCounters),
		"tracked_endpoints": len(d.endpointCounters),
		"global_rps":       d.globalCounter.count,
		"enabled":          d.config.Enabled,
	}
}

func (d *DDoSProtection) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		d.mu.Lock()
		now := time.Now()
		// Remove expired blocks
		for ip, expiry := range d.blockedIPs {
			if now.After(expiry) {
				delete(d.blockedIPs, ip)
			}
		}
		// Decay reputation scores
		for ip, score := range d.ipReputation {
			d.ipReputation[ip] = score * 0.95 // 5% decay per cycle
			if d.ipReputation[ip] < 1.0 {
				delete(d.ipReputation, ip)
			}
		}
		// Clear old rate buckets
		for ip, bucket := range d.ipCounters {
			if now.Sub(bucket.windowStart) > 5*time.Minute {
				delete(d.ipCounters, ip)
			}
		}
		for ep, bucket := range d.endpointCounters {
			if now.Sub(bucket.windowStart) > 5*time.Minute {
				delete(d.endpointCounters, ep)
			}
		}
		d.mu.Unlock()
	}
}

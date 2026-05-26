package bandwidth

import (
	"compress/gzip"
	"bytes"
	"sync"
	"time"
)

type NetworkTier string

const (
	TierEdge   NetworkTier = "EDGE"     // 2G — 9.6-384kbps
	Tier3G     NetworkTier = "3G"       // 384kbps-2Mbps
	Tier4G     NetworkTier = "4G"       // 2-100Mbps
	Tier5G     NetworkTier = "5G"       // 100Mbps+
	TierWiFi   NetworkTier = "WIFI"
	TierSat    NetworkTier = "SATELLITE" // High latency, variable bandwidth
)

type AdaptiveStrategy string

const (
	StrategyMinimal    AdaptiveStrategy = "MINIMAL"    // Text-only, critical data
	StrategyCompressed AdaptiveStrategy = "COMPRESSED" // Compressed payloads
	StrategyNormal     AdaptiveStrategy = "NORMAL"     // Standard payloads
	StrategyFull       AdaptiveStrategy = "FULL"       // Rich media, full data
)

type BandwidthProbe struct {
	Timestamp    time.Time
	LatencyMs    int64
	BandwidthBps int64
	PacketLoss   float64
	Jitter       int64
	NetworkTier  NetworkTier
}

type AdapterConfig struct {
	ProbeIntervalSec    int
	MinProbes           int
	CompressionEnabled  bool
	ImageOptimization   bool
	LazyLoadEnabled     bool
	PrefetchDisabled    bool
	WebSocketFallback   string // "long-polling", "sse", "none"
	MaxPayloadBytes     map[NetworkTier]int
	RequestTimeout      map[NetworkTier]time.Duration
	RetryStrategy       map[NetworkTier][]int
	ProgressiveLoading  bool
	DataSaverMode       bool
	USSDFallback        bool
}

type BandwidthAdapter struct {
	mu       sync.RWMutex
	probes   []BandwidthProbe
	config   AdapterConfig
	current  BandwidthProbe
	strategy AdaptiveStrategy
}

var DefaultAdapterConfig = AdapterConfig{
	ProbeIntervalSec:   30,
	MinProbes:          3,
	CompressionEnabled: true,
	ImageOptimization:  true,
	LazyLoadEnabled:    true,
	PrefetchDisabled:   false,
	WebSocketFallback:  "long-polling",
	MaxPayloadBytes: map[NetworkTier]int{
		TierEdge: 10 * 1024,      // 10KB
		Tier3G:   100 * 1024,     // 100KB
		Tier4G:   1024 * 1024,    // 1MB
		Tier5G:   10 * 1024 * 1024, // 10MB
		TierWiFi: 10 * 1024 * 1024,
		TierSat:  50 * 1024,      // 50KB — satellite has bandwidth but high latency
	},
	RequestTimeout: map[NetworkTier]time.Duration{
		TierEdge: 60 * time.Second,
		Tier3G:   30 * time.Second,
		Tier4G:   15 * time.Second,
		Tier5G:   10 * time.Second,
		TierWiFi: 15 * time.Second,
		TierSat:  90 * time.Second,
	},
	RetryStrategy: map[NetworkTier][]int{
		TierEdge: {5000, 15000, 30000, 60000, 120000}, // Aggressive backoff for EDGE
		Tier3G:   {2000, 5000, 15000, 30000},
		Tier4G:   {1000, 3000, 10000},
		Tier5G:   {500, 2000, 5000},
		TierWiFi: {1000, 3000, 10000},
		TierSat:  {10000, 30000, 60000, 120000},
	},
	ProgressiveLoading: true,
	DataSaverMode:      false,
	USSDFallback:       true, // Enable USSD fallback for feature phones in rural Africa
}

func NewBandwidthAdapter(cfg AdapterConfig) *BandwidthAdapter {
	return &BandwidthAdapter{
		probes:   make([]BandwidthProbe, 0, 100),
		config:   cfg,
		strategy: StrategyNormal,
	}
}

func (ba *BandwidthAdapter) RecordProbe(probe BandwidthProbe) {
	ba.mu.Lock()
	defer ba.mu.Unlock()

	ba.probes = append(ba.probes, probe)
	if len(ba.probes) > 100 {
		ba.probes = ba.probes[len(ba.probes)-100:]
	}
	ba.current = probe
	ba.strategy = ba.determineStrategy()
}

func (ba *BandwidthAdapter) GetStrategy() AdaptiveStrategy {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	return ba.strategy
}

func (ba *BandwidthAdapter) GetMaxPayload() int {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	if max, ok := ba.config.MaxPayloadBytes[ba.current.NetworkTier]; ok {
		return max
	}
	return 100 * 1024
}

func (ba *BandwidthAdapter) GetTimeout() time.Duration {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	if t, ok := ba.config.RequestTimeout[ba.current.NetworkTier]; ok {
		return t
	}
	return 30 * time.Second
}

func (ba *BandwidthAdapter) ShouldCompress() bool {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	return ba.config.CompressionEnabled && ba.current.NetworkTier != Tier5G && ba.current.NetworkTier != TierWiFi
}

func (ba *BandwidthAdapter) ShouldUseWebSocketFallback() bool {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	return ba.current.NetworkTier == TierEdge || ba.current.NetworkTier == TierSat || ba.current.PacketLoss > 0.1
}

func (ba *BandwidthAdapter) GetWebSocketFallback() string {
	if ba.ShouldUseWebSocketFallback() {
		return ba.config.WebSocketFallback
	}
	return "websocket"
}

func (ba *BandwidthAdapter) CompressPayload(data []byte) ([]byte, error) {
	if !ba.ShouldCompress() || len(data) < 256 {
		return data, nil
	}
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		return data, err
	}
	if err := w.Close(); err != nil {
		return data, err
	}
	if buf.Len() < len(data) {
		return buf.Bytes(), nil
	}
	return data, nil
}

func (ba *BandwidthAdapter) AdaptResponse(data []byte, tier NetworkTier) []byte {
	maxSize := ba.config.MaxPayloadBytes[tier]
	if maxSize == 0 {
		maxSize = 100 * 1024
	}
	if len(data) <= maxSize {
		return data
	}
	return data[:maxSize]
}

func (ba *BandwidthAdapter) determineStrategy() AdaptiveStrategy {
	tier := ba.current.NetworkTier
	loss := ba.current.PacketLoss

	switch {
	case tier == TierEdge || loss > 0.2:
		return StrategyMinimal
	case tier == Tier3G || tier == TierSat || loss > 0.05:
		return StrategyCompressed
	case tier == Tier4G:
		return StrategyNormal
	default:
		return StrategyFull
	}
}

func (ba *BandwidthAdapter) GetCurrentProbe() BandwidthProbe {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	return ba.current
}

func (ba *BandwidthAdapter) GetRetryDelays() []int {
	ba.mu.RLock()
	defer ba.mu.RUnlock()
	if delays, ok := ba.config.RetryStrategy[ba.current.NetworkTier]; ok {
		return delays
	}
	return []int{2000, 5000, 15000}
}

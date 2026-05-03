package connmanager

import (
	"math"
	"sync"
	"time"
)

type ConnectionState string

const (
	StateConnected    ConnectionState = "CONNECTED"
	StateReconnecting ConnectionState = "RECONNECTING"
	StateOffline      ConnectionState = "OFFLINE"
	StateDegraded     ConnectionState = "DEGRADED"
)

type TransportType string

const (
	TransportWebSocket   TransportType = "WEBSOCKET"
	TransportSSE         TransportType = "SSE"
	TransportLongPolling TransportType = "LONG_POLLING"
	TransportHTTP        TransportType = "HTTP"
	TransportUSSD        TransportType = "USSD"
)

type ConnectionConfig struct {
	PrimaryTransport       TransportType
	FallbackChain          []TransportType
	HeartbeatIntervalMs    int
	ReconnectMaxAttempts   int
	ReconnectBaseDelayMs   int
	ReconnectMaxDelayMs    int
	ReconnectJitterMs      int
	ConnectionTimeoutMs    int
	OfflineQueueEnabled    bool
	OfflineMaxQueueSize    int
	BandwidthProbeEnabled  bool
	BandwidthProbeInterval int
	AutoDowngrade          bool
	AutoUpgrade            bool
}

type ConnectionMetrics struct {
	State                ConnectionState
	CurrentTransport     TransportType
	ReconnectAttempts    int
	TotalReconnects      int64
	TotalDowngrades      int64
	TotalUpgrades        int64
	UptimePercent        float64
	AvgLatencyMs         int64
	LastHeartbeatAt      time.Time
	OfflineQueueDepth    int
	TotalMessagesSent    int64
	TotalMessagesReceived int64
	BytesSent            int64
	BytesReceived        int64
	ConnectedSince       time.Time
}

type ConnectionManager struct {
	mu       sync.RWMutex
	config   ConnectionConfig
	state    ConnectionState
	transport TransportType
	metrics  ConnectionMetrics
	reconnectAttempt int
}

var DefaultConnectionConfig = ConnectionConfig{
	PrimaryTransport:       TransportWebSocket,
	FallbackChain:          []TransportType{TransportSSE, TransportLongPolling, TransportHTTP, TransportUSSD},
	HeartbeatIntervalMs:    30000,
	ReconnectMaxAttempts:   10,
	ReconnectBaseDelayMs:   1000,
	ReconnectMaxDelayMs:    60000,
	ReconnectJitterMs:      500,
	ConnectionTimeoutMs:    10000,
	OfflineQueueEnabled:    true,
	OfflineMaxQueueSize:    1000,
	BandwidthProbeEnabled:  true,
	BandwidthProbeInterval: 30,
	AutoDowngrade:          true,
	AutoUpgrade:            true,
}

func NewConnectionManager(cfg ConnectionConfig) *ConnectionManager {
	return &ConnectionManager{
		config:    cfg,
		state:     StateOffline,
		transport: cfg.PrimaryTransport,
		metrics: ConnectionMetrics{
			State:            StateOffline,
			CurrentTransport: cfg.PrimaryTransport,
		},
	}
}

func (cm *ConnectionManager) Connect() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.state = StateConnected
	cm.transport = cm.config.PrimaryTransport
	cm.reconnectAttempt = 0
	cm.metrics.State = StateConnected
	cm.metrics.CurrentTransport = cm.transport
	cm.metrics.ConnectedSince = time.Now()
	cm.metrics.LastHeartbeatAt = time.Now()
	return nil
}

func (cm *ConnectionManager) Disconnect() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.state = StateOffline
	cm.metrics.State = StateOffline
}

func (cm *ConnectionManager) OnDisconnect() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.reconnectAttempt >= cm.config.ReconnectMaxAttempts {
		cm.downgrade()
		cm.reconnectAttempt = 0
		return
	}

	cm.state = StateReconnecting
	cm.metrics.State = StateReconnecting
	cm.reconnectAttempt++
	cm.metrics.ReconnectAttempts = cm.reconnectAttempt
	cm.metrics.TotalReconnects++
}

func (cm *ConnectionManager) OnReconnectSuccess() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.state = StateConnected
	cm.metrics.State = StateConnected
	cm.reconnectAttempt = 0
	cm.metrics.ReconnectAttempts = 0
	cm.metrics.LastHeartbeatAt = time.Now()
}

func (cm *ConnectionManager) GetReconnectDelay() time.Duration {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	baseDelay := float64(cm.config.ReconnectBaseDelayMs)
	maxDelay := float64(cm.config.ReconnectMaxDelayMs)

	// Exponential backoff with jitter
	delay := baseDelay * math.Pow(2, float64(cm.reconnectAttempt))
	if delay > maxDelay {
		delay = maxDelay
	}

	return time.Duration(delay) * time.Millisecond
}

func (cm *ConnectionManager) downgrade() {
	currentIdx := -1
	chain := append([]TransportType{cm.config.PrimaryTransport}, cm.config.FallbackChain...)
	for i, t := range chain {
		if t == cm.transport {
			currentIdx = i
			break
		}
	}

	if currentIdx >= 0 && currentIdx < len(chain)-1 {
		cm.transport = chain[currentIdx+1]
		cm.state = StateConnected
		cm.metrics.CurrentTransport = cm.transport
		cm.metrics.State = StateDegraded
		cm.metrics.TotalDowngrades++
	} else {
		cm.state = StateOffline
		cm.metrics.State = StateOffline
	}
}

func (cm *ConnectionManager) TryUpgrade() bool {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if !cm.config.AutoUpgrade {
		return false
	}

	chain := append([]TransportType{cm.config.PrimaryTransport}, cm.config.FallbackChain...)
	currentIdx := -1
	for i, t := range chain {
		if t == cm.transport {
			currentIdx = i
			break
		}
	}

	if currentIdx > 0 {
		cm.transport = chain[currentIdx-1]
		cm.metrics.CurrentTransport = cm.transport
		cm.metrics.TotalUpgrades++
		if cm.transport == cm.config.PrimaryTransport {
			cm.metrics.State = StateConnected
		}
		return true
	}
	return false
}

func (cm *ConnectionManager) RecordHeartbeat() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.metrics.LastHeartbeatAt = time.Now()
}

func (cm *ConnectionManager) RecordMessage(sent bool, bytes int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if sent {
		cm.metrics.TotalMessagesSent++
		cm.metrics.BytesSent += int64(bytes)
	} else {
		cm.metrics.TotalMessagesReceived++
		cm.metrics.BytesReceived += int64(bytes)
	}
}

func (cm *ConnectionManager) GetState() ConnectionState {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.state
}

func (cm *ConnectionManager) GetTransport() TransportType {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.transport
}

func (cm *ConnectionManager) GetMetrics() ConnectionMetrics {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.metrics
}

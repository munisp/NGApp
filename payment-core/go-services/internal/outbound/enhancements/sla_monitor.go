package enhancements

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"
)

// SLADefinition specifies the target performance for a corridor
type SLADefinition struct {
	Corridor            string        `json:"corridor"`
	MaxLatency          time.Duration `json:"maxLatency"`
	TargetSuccessRate   float64       `json:"targetSuccessRate"` // 0.0-1.0
	MaxComplianceDelay  time.Duration `json:"maxComplianceDelay"`
	MaxSettlementDelay  time.Duration `json:"maxSettlementDelay"`
	EscalationThreshold int           `json:"escalationThreshold"` // consecutive breaches
}

// SLABreach records a breach event
type SLABreach struct {
	ID            string        `json:"id"`
	Corridor      string        `json:"corridor"`
	TransferRef   string        `json:"transferRef"`
	ParticipantID int           `json:"participantId"`
	BreachType    string        `json:"breachType"` // latency, success_rate, compliance, settlement
	Expected      time.Duration `json:"expected"`
	Actual        time.Duration `json:"actual"`
	DetectedAt    time.Time     `json:"detectedAt"`
	Escalated     bool          `json:"escalated"`
	ResolvedAt    *time.Time    `json:"resolvedAt,omitempty"`
}

// CorridorHealth tracks real-time health metrics per corridor
type CorridorHealth struct {
	Corridor         string    `json:"corridor"`
	AvgLatencyMs     int64     `json:"avgLatencyMs"`
	P99LatencyMs     int64     `json:"p99LatencyMs"`
	SuccessRate      float64   `json:"successRate"`
	ActiveTransfers  int       `json:"activeTransfers"`
	BreachCount24h   int       `json:"breachCount24h"`
	LastBreachAt     *time.Time `json:"lastBreachAt,omitempty"`
	HealthScore      float64   `json:"healthScore"` // 0-100
	PrimaryProvider  string    `json:"primaryProvider"`
	BackupProvider   string    `json:"backupProvider"`
	AutoFailoverAt   *time.Time `json:"autoFailoverAt,omitempty"`
}

// SLAMonitor manages SLA tracking and auto-escalation
type SLAMonitor struct {
	mu              sync.RWMutex
	definitions     map[string]SLADefinition // key: corridor
	breaches        []SLABreach
	health          map[string]*CorridorHealth // key: corridor
	consecutiveBreaches map[string]int         // key: corridor
	autoEscalate    bool
}

// NewSLAMonitor creates an SLA monitor with default corridor definitions
func NewSLAMonitor() *SLAMonitor {
	monitor := &SLAMonitor{
		definitions:         make(map[string]SLADefinition),
		breaches:            make([]SLABreach, 0),
		health:              make(map[string]*CorridorHealth),
		consecutiveBreaches: make(map[string]int),
		autoEscalate:        true,
	}

	// Default SLA definitions per corridor category
	corridors := map[string]SLADefinition{
		"NG-GH": {Corridor: "NG-GH", MaxLatency: 30 * time.Second, TargetSuccessRate: 0.98, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 2 * time.Hour, EscalationThreshold: 3},
		"NG-SN": {Corridor: "NG-SN", MaxLatency: 45 * time.Second, TargetSuccessRate: 0.95, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 4 * time.Hour, EscalationThreshold: 3},
		"NG-GB": {Corridor: "NG-GB", MaxLatency: 20 * time.Second, TargetSuccessRate: 0.99, MaxComplianceDelay: 3 * time.Second, MaxSettlementDelay: 1 * time.Hour, EscalationThreshold: 2},
		"NG-US": {Corridor: "NG-US", MaxLatency: 25 * time.Second, TargetSuccessRate: 0.99, MaxComplianceDelay: 3 * time.Second, MaxSettlementDelay: 1 * time.Hour, EscalationThreshold: 2},
		"NG-IN": {Corridor: "NG-IN", MaxLatency: 35 * time.Second, TargetSuccessRate: 0.97, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 3 * time.Hour, EscalationThreshold: 3},
		"NG-CN": {Corridor: "NG-CN", MaxLatency: 60 * time.Second, TargetSuccessRate: 0.93, MaxComplianceDelay: 10 * time.Second, MaxSettlementDelay: 6 * time.Hour, EscalationThreshold: 5},
		"NG-AE": {Corridor: "NG-AE", MaxLatency: 30 * time.Second, TargetSuccessRate: 0.97, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 2 * time.Hour, EscalationThreshold: 3},
		"NG-KE": {Corridor: "NG-KE", MaxLatency: 25 * time.Second, TargetSuccessRate: 0.97, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 2 * time.Hour, EscalationThreshold: 3},
		"NG-ZA": {Corridor: "NG-ZA", MaxLatency: 30 * time.Second, TargetSuccessRate: 0.96, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 3 * time.Hour, EscalationThreshold: 3},
		"NG-CA": {Corridor: "NG-CA", MaxLatency: 25 * time.Second, TargetSuccessRate: 0.98, MaxComplianceDelay: 3 * time.Second, MaxSettlementDelay: 1 * time.Hour, EscalationThreshold: 2},
		"NG-CI": {Corridor: "NG-CI", MaxLatency: 45 * time.Second, TargetSuccessRate: 0.94, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 4 * time.Hour, EscalationThreshold: 4},
		"NG-CM": {Corridor: "NG-CM", MaxLatency: 45 * time.Second, TargetSuccessRate: 0.94, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 4 * time.Hour, EscalationThreshold: 4},
		"NG-TR": {Corridor: "NG-TR", MaxLatency: 40 * time.Second, TargetSuccessRate: 0.96, MaxComplianceDelay: 5 * time.Second, MaxSettlementDelay: 3 * time.Hour, EscalationThreshold: 3},
	}
	for k, v := range corridors {
		monitor.definitions[k] = v
		monitor.health[k] = &CorridorHealth{
			Corridor:    k,
			HealthScore: 100,
		}
	}

	return monitor
}

// RecordTransferLatency records a transfer completion and checks SLA
func (sm *SLAMonitor) RecordTransferLatency(ctx context.Context, corridor, transferRef string, participantID int, latency time.Duration, succeeded bool) *SLABreach {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	def, hasDef := sm.definitions[corridor]
	if !hasDef {
		return nil
	}

	// Update health metrics
	health := sm.health[corridor]
	if health == nil {
		health = &CorridorHealth{Corridor: corridor, HealthScore: 100}
		sm.health[corridor] = health
	}
	health.AvgLatencyMs = (health.AvgLatencyMs*9 + latency.Milliseconds()) / 10 // EMA
	health.ActiveTransfers++

	// Check latency SLA
	if latency > def.MaxLatency {
		breach := SLABreach{
			ID:            fmt.Sprintf("sla-%s-%d", corridor, time.Now().UnixNano()),
			Corridor:      corridor,
			TransferRef:   transferRef,
			ParticipantID: participantID,
			BreachType:    "latency",
			Expected:      def.MaxLatency,
			Actual:        latency,
			DetectedAt:    time.Now(),
		}

		sm.consecutiveBreaches[corridor]++

		// Auto-escalate if threshold exceeded
		if sm.autoEscalate && sm.consecutiveBreaches[corridor] >= def.EscalationThreshold {
			breach.Escalated = true
			now := time.Now()
			health.AutoFailoverAt = &now
			health.HealthScore = math.Max(0, health.HealthScore-20)
		}

		sm.breaches = append(sm.breaches, breach)
		health.BreachCount24h++
		health.LastBreachAt = &breach.DetectedAt

		return &breach
	}

	// Reset consecutive breaches on success
	if succeeded {
		sm.consecutiveBreaches[corridor] = 0
	}

	return nil
}

// GetCorridorHealth returns current health for all corridors
func (sm *SLAMonitor) GetCorridorHealth() map[string]CorridorHealth {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := make(map[string]CorridorHealth, len(sm.health))
	for k, v := range sm.health {
		result[k] = *v
	}
	return result
}

// GetBreaches returns SLA breaches within a time window
func (sm *SLAMonitor) GetBreaches(since time.Time, corridor string) []SLABreach {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var result []SLABreach
	for _, b := range sm.breaches {
		if b.DetectedAt.After(since) {
			if corridor == "" || b.Corridor == corridor {
				result = append(result, b)
			}
		}
	}
	return result
}

// ResolveBreach marks an SLA breach as resolved
func (sm *SLAMonitor) ResolveBreach(breachID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	for i := range sm.breaches {
		if sm.breaches[i].ID == breachID {
			sm.breaches[i].ResolvedAt = &now
			break
		}
	}
}

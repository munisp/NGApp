package enhancements

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// LifecycleStep represents one of the A-G steps in the transfer lifecycle
type LifecycleStep string

const (
	StepAdmission   LifecycleStep = "A-Admission"
	StepWorkflow    LifecycleStep = "B-Workflow"
	StepCompliance  LifecycleStep = "C-Compliance"
	StepPricing     LifecycleStep = "D-Pricing"
	StepRouting     LifecycleStep = "E-Routing"
	StepExecution   LifecycleStep = "F-Execution"
	StepSettlement  LifecycleStep = "G-Settlement"
	StepAudit       LifecycleStep = "H-Audit"
)

// TransferEvent represents a real-time lifecycle event pushed via WebSocket
type TransferEvent struct {
	TransferRef   string        `json:"transferRef"`
	ParticipantID int           `json:"participantId"`
	Step          LifecycleStep `json:"step"`
	Status        string        `json:"status"`
	Timestamp     time.Time     `json:"timestamp"`
	Details       string        `json:"details,omitempty"`
	LatencyMs     int64         `json:"latencyMs,omitempty"`
	Provider      string        `json:"provider,omitempty"`
}

// Subscription represents a WebSocket subscription for a participant
type Subscription struct {
	ParticipantID int
	TransferRef   string // empty means all transfers for participant
	EventChan     chan TransferEvent
	CreatedAt     time.Time
}

// WebSocketTracker manages real-time transfer lifecycle event broadcasting
type WebSocketTracker struct {
	mu            sync.RWMutex
	subscriptions map[string]*Subscription // key: subscriptionID
	eventLog      []TransferEvent          // recent events for replay
	maxLogSize    int
}

// NewWebSocketTracker creates a new tracker instance
func NewWebSocketTracker() *WebSocketTracker {
	return &WebSocketTracker{
		subscriptions: make(map[string]*Subscription),
		eventLog:      make([]TransferEvent, 0, 1000),
		maxLogSize:    1000,
	}
}

// Subscribe creates a new subscription for real-time events
func (wt *WebSocketTracker) Subscribe(participantID int, transferRef string) (string, <-chan TransferEvent) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	subID := fmt.Sprintf("sub-%d-%d", participantID, time.Now().UnixNano())
	ch := make(chan TransferEvent, 100)

	wt.subscriptions[subID] = &Subscription{
		ParticipantID: participantID,
		TransferRef:   transferRef,
		EventChan:     ch,
		CreatedAt:     time.Now(),
	}

	return subID, ch
}

// Unsubscribe removes a subscription
func (wt *WebSocketTracker) Unsubscribe(subID string) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	if sub, ok := wt.subscriptions[subID]; ok {
		close(sub.EventChan)
		delete(wt.subscriptions, subID)
	}
}

// PublishEvent broadcasts a transfer event to relevant subscribers
func (wt *WebSocketTracker) PublishEvent(event TransferEvent) {
	wt.mu.Lock()
	defer wt.mu.Unlock()

	// Store in event log
	if len(wt.eventLog) >= wt.maxLogSize {
		wt.eventLog = wt.eventLog[1:]
	}
	wt.eventLog = append(wt.eventLog, event)

	// Broadcast to matching subscribers (non-blocking)
	for _, sub := range wt.subscriptions {
		if sub.ParticipantID != event.ParticipantID {
			continue
		}
		if sub.TransferRef != "" && sub.TransferRef != event.TransferRef {
			continue
		}
		select {
		case sub.EventChan <- event:
		default:
			// Channel full, skip (client is slow)
		}
	}
}

// GetRecentEvents returns recent events for a participant (for replay on reconnect)
func (wt *WebSocketTracker) GetRecentEvents(participantID int, since time.Time) []TransferEvent {
	wt.mu.RLock()
	defer wt.mu.RUnlock()

	var events []TransferEvent
	for _, e := range wt.eventLog {
		if e.ParticipantID == participantID && e.Timestamp.After(since) {
			events = append(events, e)
		}
	}
	return events
}

// SerializeEvent converts an event to JSON for WebSocket transmission
func SerializeEvent(event TransferEvent) ([]byte, error) {
	return json.Marshal(event)
}

// TransferProgressTracker tracks cumulative progress through the A-G lifecycle
type TransferProgressTracker struct {
	mu       sync.RWMutex
	progress map[string]TransferProgress // key: transferRef
}

// TransferProgress holds the complete lifecycle state for one transfer
type TransferProgress struct {
	TransferRef   string                     `json:"transferRef"`
	ParticipantID int                        `json:"participantId"`
	CurrentStep   LifecycleStep              `json:"currentStep"`
	StepHistory   []StepRecord               `json:"stepHistory"`
	StartedAt     time.Time                  `json:"startedAt"`
	CompletedAt   *time.Time                 `json:"completedAt,omitempty"`
	TotalLatency  int64                      `json:"totalLatencyMs"`
}

// StepRecord records when a step was entered and completed
type StepRecord struct {
	Step       LifecycleStep `json:"step"`
	EnteredAt  time.Time     `json:"enteredAt"`
	ExitedAt   *time.Time    `json:"exitedAt,omitempty"`
	LatencyMs  int64         `json:"latencyMs"`
	Status     string        `json:"status"`
}

// NewTransferProgressTracker creates a progress tracker
func NewTransferProgressTracker() *TransferProgressTracker {
	return &TransferProgressTracker{
		progress: make(map[string]TransferProgress),
	}
}

// RecordStep records a step transition for a transfer
func (tp *TransferProgressTracker) RecordStep(ctx context.Context, transferRef string, participantID int, step LifecycleStep, status string) {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	now := time.Now()
	prog, exists := tp.progress[transferRef]
	if !exists {
		prog = TransferProgress{
			TransferRef:   transferRef,
			ParticipantID: participantID,
			StartedAt:     now,
			StepHistory:   make([]StepRecord, 0, 8),
		}
	}

	// Close previous step
	if len(prog.StepHistory) > 0 {
		last := &prog.StepHistory[len(prog.StepHistory)-1]
		if last.ExitedAt == nil {
			last.ExitedAt = &now
			last.LatencyMs = now.Sub(last.EnteredAt).Milliseconds()
		}
	}

	// Open new step
	prog.CurrentStep = step
	prog.StepHistory = append(prog.StepHistory, StepRecord{
		Step:      step,
		EnteredAt: now,
		Status:    status,
	})

	// If terminal step, mark completed
	if step == StepAudit && (status == "completed" || status == "settled") {
		prog.CompletedAt = &now
		prog.TotalLatency = now.Sub(prog.StartedAt).Milliseconds()
	}

	tp.progress[transferRef] = prog
}

// GetProgress returns the current progress for a transfer
func (tp *TransferProgressTracker) GetProgress(transferRef string) (TransferProgress, bool) {
	tp.mu.RLock()
	defer tp.mu.RUnlock()
	prog, ok := tp.progress[transferRef]
	return prog, ok
}

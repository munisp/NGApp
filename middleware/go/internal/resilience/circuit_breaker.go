// Package resilience provides circuit breaker and retry utilities for
// inter-service communication in the OG-RMM platform.
package resilience

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// State represents the circuit breaker state.
type State int

const (
	StateClosed   State = iota // Requests pass through
	StateOpen                  // Requests are rejected
	StateHalfOpen              // Probe request allowed
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

// CircuitBreakerConfig holds circuit breaker tuning parameters.
type CircuitBreakerConfig struct {
	FailureThreshold int
	ResetTimeout     time.Duration
	HalfOpenMaxProbes int
}

// DefaultCircuitBreakerConfig returns production-ready defaults.
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold:  5,
		ResetTimeout:      30 * time.Second,
		HalfOpenMaxProbes: 1,
	}
}

// CircuitBreaker implements the circuit breaker pattern for service calls.
type CircuitBreaker struct {
	name            string
	cfg             CircuitBreakerConfig
	mu              sync.Mutex
	state           State
	failures        int
	lastFailureTime time.Time
	halfOpenProbes  int
}

// NewCircuitBreaker creates a circuit breaker with the given name and config.
func NewCircuitBreaker(name string, cfg CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		name:  name,
		cfg:   cfg,
		state: StateClosed,
	}
}

// Execute runs fn through the circuit breaker. Returns ErrCircuitOpen if
// the circuit is open.
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func(ctx context.Context) error) error {
	cb.mu.Lock()
	if cb.state == StateOpen {
		if time.Since(cb.lastFailureTime) >= cb.cfg.ResetTimeout {
			cb.transition(StateHalfOpen)
		} else {
			cb.mu.Unlock()
			return ErrCircuitOpen
		}
	}
	if cb.state == StateHalfOpen && cb.halfOpenProbes >= cb.cfg.HalfOpenMaxProbes {
		cb.mu.Unlock()
		return ErrCircuitOpen
	}
	if cb.state == StateHalfOpen {
		cb.halfOpenProbes++
	}
	cb.mu.Unlock()

	err := fn(ctx)

	cb.mu.Lock()
	defer cb.mu.Unlock()
	if err != nil {
		cb.failures++
		cb.lastFailureTime = time.Now()
		if cb.state == StateHalfOpen {
			cb.transition(StateOpen)
			cb.halfOpenProbes = 0
		} else if cb.failures >= cb.cfg.FailureThreshold {
			cb.transition(StateOpen)
		}
		return err
	}

	if cb.state == StateHalfOpen || cb.state == StateOpen {
		cb.transition(StateClosed)
	}
	cb.failures = 0
	cb.halfOpenProbes = 0
	return nil
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

func (cb *CircuitBreaker) transition(to State) {
	from := cb.state
	if from == to {
		return
	}
	cb.state = to
	slog.Info("circuit breaker state change",
		"name", cb.name,
		"from", from.String(),
		"to", to.String(),
	)
}

// ErrCircuitOpen is returned when the circuit breaker is open.
var ErrCircuitOpen = fmt.Errorf("circuit breaker is OPEN — request rejected")

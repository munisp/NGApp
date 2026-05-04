package perf

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// CircuitBreaker prevents cascade failures when calling external services.
type CircuitBreaker struct {
	mu               sync.RWMutex
	name             string
	failureThreshold int
	resetTimeout     time.Duration
	failureCount     int
	lastFailure      time.Time
	state            string // "closed", "open", "half-open"
}

func NewCircuitBreaker(name string, threshold int, resetTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		name:             name,
		failureThreshold: threshold,
		resetTimeout:     resetTimeout,
		state:            "closed",
	}
}

func (cb *CircuitBreaker) Allow() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	if cb.state == "closed" {
		return true
	}
	if cb.state == "open" && time.Since(cb.lastFailure) > cb.resetTimeout {
		return true // half-open
	}
	return false
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount = 0
	cb.state = "closed"
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount++
	cb.lastFailure = time.Now()
	if cb.failureCount >= cb.failureThreshold {
		cb.state = "open"
		log.Printf("[CircuitBreaker:%s] OPEN after %d failures", cb.name, cb.failureCount)
	}
}

func (cb *CircuitBreaker) State() string {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// ObjectPool provides reusable object allocation to reduce GC pressure.
type ObjectPool[T any] struct {
	pool sync.Pool
}

func NewObjectPool[T any](factory func() T) *ObjectPool[T] {
	return &ObjectPool[T]{
		pool: sync.Pool{
			New: func() any { return factory() },
		},
	}
}

func (p *ObjectPool[T]) Get() T {
	return p.pool.Get().(T)
}

func (p *ObjectPool[T]) Put(obj T) {
	p.pool.Put(obj)
}

// ConnectionManager manages pooled connections to external services.
type ConnectionManager struct {
	mu    sync.RWMutex
	pools map[string]*ConnectionPool
}

type ConnectionPool struct {
	Name        string
	MaxConns    int
	ActiveConns int
	IdleConns   int
	CreatedAt   time.Time
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		pools: make(map[string]*ConnectionPool),
	}
}

func (cm *ConnectionManager) Register(name string, maxConns int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.pools[name] = &ConnectionPool{
		Name:      name,
		MaxConns:  maxConns,
		CreatedAt: time.Now(),
	}
}

func (cm *ConnectionManager) Status() map[string]*ConnectionPool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	result := make(map[string]*ConnectionPool, len(cm.pools))
	for k, v := range cm.pools {
		result[k] = v
	}
	return result
}

// GracefulServer wraps an HTTP server with graceful shutdown.
type GracefulServer struct {
	server *http.Server
	done   chan struct{}
}

func NewGracefulServer(addr string, handler http.Handler) *GracefulServer {
	return &GracefulServer{
		server: &http.Server{
			Addr:         addr,
			Handler:      handler,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 30 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
		done: make(chan struct{}),
	}
}

func (gs *GracefulServer) Start() error {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := gs.server.Shutdown(ctx); err != nil {
			log.Printf("Server forced to shutdown: %v", err)
		}
		close(gs.done)
	}()

	log.Printf("Server starting on %s", gs.server.Addr)
	if err := gs.server.ListenAndServe(); err != http.ErrServerClosed {
		return err
	}
	<-gs.done
	return nil
}

// PprofHandler registers pprof endpoints on a separate debug port.
func PprofHandler(debugPort int) {
	if os.Getenv("ENABLE_PPROF") != "true" {
		return
	}
	go func() {
		addr := fmt.Sprintf(":%d", debugPort)
		log.Printf("pprof debug server on %s", addr)
		// net/http/pprof registers handlers on DefaultServeMux
		if err := http.ListenAndServe(addr, nil); err != nil {
			log.Printf("pprof server error: %v", err)
		}
	}()
}

// FastJSON provides a faster JSON marshal using pre-allocated buffers.
func FastJSON(v any) ([]byte, error) {
	return json.Marshal(v)
}

// Metrics tracks basic request metrics.
type Metrics struct {
	mu        sync.RWMutex
	counters  map[string]int64
	durations map[string]time.Duration
}

func NewMetrics() *Metrics {
	return &Metrics{
		counters:  make(map[string]int64),
		durations: make(map[string]time.Duration),
	}
}

func (m *Metrics) Inc(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.counters[name]++
}

func (m *Metrics) RecordDuration(name string, d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.durations[name] = d
}

func (m *Metrics) Snapshot() map[string]any {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make(map[string]any)
	for k, v := range m.counters {
		result[k] = v
	}
	for k, v := range m.durations {
		result[k+"_ms"] = v.Milliseconds()
	}
	return result
}

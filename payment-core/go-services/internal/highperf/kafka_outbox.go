// Package highperf provides async Kafka outbox pattern for high throughput
package highperf

import (
	"context"
	"encoding/binary"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/protobuf/proto"
)

// KafkaEvent represents an event to be sent to Kafka
type KafkaEvent struct {
	Topic     string
	Key       []byte
	Value     []byte
	Headers   map[string][]byte
	Timestamp time.Time
}

// KafkaProducer interface for Kafka operations
type KafkaProducer interface {
	ProduceBatch(ctx context.Context, events []KafkaEvent) error
	Close() error
}

// OutboxConfig configures the Kafka outbox
type OutboxConfig struct {
	BufferSize     int           // Ring buffer size (default: 100000)
	BatchSize      int           // Max events per batch (default: 1000)
	LingerMs       int           // Max time before flush in ms (default: 5)
	MaxInflight    int           // Max concurrent batches (default: 10)
	Compression    string        // Compression type: none, lz4, zstd (default: lz4)
	RetryAttempts  int           // Retry attempts on failure (default: 3)
	RetryBackoffMs int           // Backoff between retries (default: 100)
}

// DefaultOutboxConfig returns optimized defaults
func DefaultOutboxConfig() OutboxConfig {
	return OutboxConfig{
		BufferSize:     100000,
		BatchSize:      1000,
		LingerMs:       5,
		MaxInflight:    10,
		Compression:    "lz4",
		RetryAttempts:  3,
		RetryBackoffMs: 100,
	}
}

// KafkaOutbox provides async event emission with batching
type KafkaOutbox struct {
	config   OutboxConfig
	producer KafkaProducer

	// Per-topic ring buffers for better locality
	buffers     map[string]*EventRingBuffer
	buffersMu   sync.RWMutex
	defaultSize int

	// Stats
	totalQueued   uint64
	totalSent     uint64
	totalFailed   uint64
	totalDropped  uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Object pool for events
	eventPool sync.Pool
}

// EventRingBuffer is a lock-free ring buffer for Kafka events
type EventRingBuffer struct {
	buffer []KafkaEvent
	mask   uint64
	head   uint64
	tail   uint64
}

// NewEventRingBuffer creates a new event ring buffer
func NewEventRingBuffer(size int) *EventRingBuffer {
	size = nextPowerOf2(size)
	return &EventRingBuffer{
		buffer: make([]KafkaEvent, size),
		mask:   uint64(size - 1),
	}
}

// Push adds an event to the buffer
func (rb *EventRingBuffer) Push(event KafkaEvent) bool {
	for {
		tail := atomic.LoadUint64(&rb.tail)
		head := atomic.LoadUint64(&rb.head)

		if tail-head >= uint64(len(rb.buffer)) {
			return false
		}

		if atomic.CompareAndSwapUint64(&rb.tail, tail, tail+1) {
			rb.buffer[tail&rb.mask] = event
			return true
		}
	}
}

// PopBatch pops up to n events from the buffer
func (rb *EventRingBuffer) PopBatch(n int) []KafkaEvent {
	result := make([]KafkaEvent, 0, n)

	for i := 0; i < n; i++ {
		head := atomic.LoadUint64(&rb.head)
		tail := atomic.LoadUint64(&rb.tail)

		if head >= tail {
			break
		}

		event := rb.buffer[head&rb.mask]
		if atomic.CompareAndSwapUint64(&rb.head, head, head+1) {
			result = append(result, event)
		}
	}

	return result
}

// Len returns current buffer length
func (rb *EventRingBuffer) Len() int {
	return int(atomic.LoadUint64(&rb.tail) - atomic.LoadUint64(&rb.head))
}

// NewKafkaOutbox creates a new Kafka outbox
func NewKafkaOutbox(producer KafkaProducer, config OutboxConfig) *KafkaOutbox {
	ctx, cancel := context.WithCancel(context.Background())

	outbox := &KafkaOutbox{
		config:      config,
		producer:    producer,
		buffers:     make(map[string]*EventRingBuffer),
		defaultSize: config.BufferSize,
		ctx:         ctx,
		cancel:      cancel,
		eventPool: sync.Pool{
			New: func() interface{} {
				return &KafkaEvent{
					Headers: make(map[string][]byte),
				}
			},
		},
	}

	// Start flush workers
	outbox.wg.Add(1)
	go outbox.flushLoop()

	return outbox
}

// Emit queues an event for async sending
func (o *KafkaOutbox) Emit(topic string, key []byte, value []byte, headers map[string][]byte) error {
	event := KafkaEvent{
		Topic:     topic,
		Key:       key,
		Value:     value,
		Headers:   headers,
		Timestamp: time.Now(),
	}

	buffer := o.getOrCreateBuffer(topic)
	if !buffer.Push(event) {
		atomic.AddUint64(&o.totalDropped, 1)
		return ErrBufferFull
	}

	atomic.AddUint64(&o.totalQueued, 1)
	return nil
}

// EmitProto queues a protobuf message for async sending
func (o *KafkaOutbox) EmitProto(topic string, key []byte, msg proto.Message, headers map[string][]byte) error {
	value, err := proto.Marshal(msg)
	if err != nil {
		return err
	}
	return o.Emit(topic, key, value, headers)
}

// EmitTransferEvent is a convenience method for transfer events
func (o *KafkaOutbox) EmitTransferEvent(transferID [16]byte, eventType string, payload []byte) error {
	headers := map[string][]byte{
		"event_type": []byte(eventType),
		"timestamp":  int64ToBytes(time.Now().UnixNano()),
	}
	return o.Emit("payment.transfers", transferID[:], payload, headers)
}

// getOrCreateBuffer gets or creates a buffer for a topic
func (o *KafkaOutbox) getOrCreateBuffer(topic string) *EventRingBuffer {
	o.buffersMu.RLock()
	buffer, ok := o.buffers[topic]
	o.buffersMu.RUnlock()

	if ok {
		return buffer
	}

	o.buffersMu.Lock()
	defer o.buffersMu.Unlock()

	// Double-check after acquiring write lock
	if buffer, ok = o.buffers[topic]; ok {
		return buffer
	}

	buffer = NewEventRingBuffer(o.defaultSize)
	o.buffers[topic] = buffer
	return buffer
}

// flushLoop runs the flush loop
func (o *KafkaOutbox) flushLoop() {
	defer o.wg.Done()

	ticker := time.NewTicker(time.Duration(o.config.LingerMs) * time.Millisecond)
	defer ticker.Stop()

	sem := make(chan struct{}, o.config.MaxInflight)

	for {
		select {
		case <-o.ctx.Done():
			o.flushAll(sem)
			return
		case <-ticker.C:
			o.flushAll(sem)
		}
	}
}

// flushAll flushes all topic buffers
func (o *KafkaOutbox) flushAll(sem chan struct{}) {
	o.buffersMu.RLock()
	topics := make([]string, 0, len(o.buffers))
	for topic := range o.buffers {
		topics = append(topics, topic)
	}
	o.buffersMu.RUnlock()

	for _, topic := range topics {
		o.flushTopic(topic, sem)
	}
}

// flushTopic flushes a single topic buffer
func (o *KafkaOutbox) flushTopic(topic string, sem chan struct{}) {
	o.buffersMu.RLock()
	buffer, ok := o.buffers[topic]
	o.buffersMu.RUnlock()

	if !ok || buffer.Len() == 0 {
		return
	}

	// Pop batch
	events := buffer.PopBatch(o.config.BatchSize)
	if len(events) == 0 {
		return
	}

	// Acquire semaphore
	sem <- struct{}{}

	go func() {
		defer func() { <-sem }()
		o.sendBatch(events)
	}()
}

// sendBatch sends a batch of events with retry
func (o *KafkaOutbox) sendBatch(events []KafkaEvent) {
	var lastErr error

	for attempt := 0; attempt < o.config.RetryAttempts; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err := o.producer.ProduceBatch(ctx, events)
		cancel()

		if err == nil {
			atomic.AddUint64(&o.totalSent, uint64(len(events)))
			return
		}

		lastErr = err
		time.Sleep(time.Duration(o.config.RetryBackoffMs*(1<<attempt)) * time.Millisecond)
	}

	// All retries failed
	atomic.AddUint64(&o.totalFailed, uint64(len(events)))
	_ = lastErr // Log error in production
}

// Stats returns outbox statistics
func (o *KafkaOutbox) Stats() (queued, sent, failed, dropped uint64) {
	return atomic.LoadUint64(&o.totalQueued),
		atomic.LoadUint64(&o.totalSent),
		atomic.LoadUint64(&o.totalFailed),
		atomic.LoadUint64(&o.totalDropped)
}

// Close shuts down the outbox
func (o *KafkaOutbox) Close() error {
	o.cancel()
	o.wg.Wait()
	return o.producer.Close()
}

// Helper functions
func int64ToBytes(n int64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, uint64(n))
	return b
}

// IdempotencyStore provides idempotency key storage
type IdempotencyStore struct {
	cache     map[string]int64 // key -> expiry timestamp
	cacheMu   sync.RWMutex
	maxSize   int
	ttlNanos  int64
}

// NewIdempotencyStore creates a new idempotency store
func NewIdempotencyStore(maxSize int, ttl time.Duration) *IdempotencyStore {
	store := &IdempotencyStore{
		cache:    make(map[string]int64, maxSize),
		maxSize:  maxSize,
		ttlNanos: ttl.Nanoseconds(),
	}

	// Start cleanup goroutine
	go store.cleanupLoop()

	return store
}

// Check checks if a key exists and is not expired
func (s *IdempotencyStore) Check(key string) bool {
	s.cacheMu.RLock()
	expiry, ok := s.cache[key]
	s.cacheMu.RUnlock()

	if !ok {
		return false
	}

	return time.Now().UnixNano() < expiry
}

// Set sets an idempotency key
func (s *IdempotencyStore) Set(key string) bool {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	// Check if already exists
	if expiry, ok := s.cache[key]; ok && time.Now().UnixNano() < expiry {
		return false // Already exists
	}

	// Evict if at capacity
	if len(s.cache) >= s.maxSize {
		s.evictOldest()
	}

	s.cache[key] = time.Now().UnixNano() + s.ttlNanos
	return true
}

// evictOldest removes the oldest entry (must hold lock)
func (s *IdempotencyStore) evictOldest() {
	var oldestKey string
	var oldestExpiry int64 = 1<<63 - 1

	for key, expiry := range s.cache {
		if expiry < oldestExpiry {
			oldestKey = key
			oldestExpiry = expiry
		}
	}

	if oldestKey != "" {
		delete(s.cache, oldestKey)
	}
}

// cleanupLoop periodically removes expired entries
func (s *IdempotencyStore) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.cleanup()
	}
}

// cleanup removes expired entries
func (s *IdempotencyStore) cleanup() {
	now := time.Now().UnixNano()

	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	for key, expiry := range s.cache {
		if now >= expiry {
			delete(s.cache, key)
		}
	}
}

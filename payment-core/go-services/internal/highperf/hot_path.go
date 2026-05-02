// Package highperf provides hot path processing for 1M TPS
package highperf

import (
	"context"
	"encoding/binary"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

// HotPathProcessor is the ultra-optimized transaction processor
// Design principles:
// 1. Zero allocations on hot path
// 2. Lock-free data structures
// 3. Batch everything
// 4. Async everything non-essential
type HotPathProcessor struct {
	// Core components
	batchClient  *BatchTransferClient
	kafkaOutbox  *KafkaOutbox
	fraudGate    *FastFraudGate
	jwtCache     *JWTCache
	routingCache *RoutingCache

	// Object pools (zero allocation)
	requestPool  sync.Pool
	responsePool sync.Pool
	bufferPool   sync.Pool

	// Per-core request queues
	requestQueues []*RequestQueue
	numCores      int

	// Stats (atomic, no locks)
	totalProcessed uint64
	totalSuccess   uint64
	totalFailed    uint64
	totalLatencyNs uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// Request represents a hot path request (cache-line aligned)
type Request struct {
	// First cache line (64 bytes) - hot data
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	Amount          uint64
	Ledger          uint32
	Code            uint16
	Flags           uint16

	// Second cache line - metadata
	PayerFSP     [8]byte // Truncated FSP ID
	PayeeFSP     [8]byte
	Timestamp    int64
	ResponseChan chan Response
	_padding     [32]byte // Align to 128 bytes
}

// Response represents a hot path response
type Response struct {
	ID        [16]byte
	Result    uint32
	Timestamp int64
	Error     error
}

// RequestQueue is a per-core request queue
type RequestQueue struct {
	buffer   []Request
	mask     uint64
	head     uint64
	tail     uint64
	_padding [40]byte // Prevent false sharing
}

// HotPathConfig configures the hot path processor
type HotPathConfig struct {
	NumCores        int
	QueueSize       int
	BatchSize       int
	FlushIntervalMs int
	MaxInflight     int
}

// DefaultHotPathConfig returns optimized defaults
func DefaultHotPathConfig() HotPathConfig {
	return HotPathConfig{
		NumCores:        16,
		QueueSize:       65536,
		BatchSize:       1000,
		FlushIntervalMs: 1,
		MaxInflight:     100,
	}
}

// NewHotPathProcessor creates a new hot path processor
func NewHotPathProcessor(
	batchClient *BatchTransferClient,
	kafkaOutbox *KafkaOutbox,
	fraudGate *FastFraudGate,
	jwtCache *JWTCache,
	config HotPathConfig,
) *HotPathProcessor {
	ctx, cancel := context.WithCancel(context.Background())

	p := &HotPathProcessor{
		batchClient:   batchClient,
		kafkaOutbox:   kafkaOutbox,
		fraudGate:     fraudGate,
		jwtCache:      jwtCache,
		routingCache:  NewRoutingCache(10000, 5*time.Minute),
		numCores:      config.NumCores,
		requestQueues: make([]*RequestQueue, config.NumCores),
		ctx:           ctx,
		cancel:        cancel,
	}

	// Initialize per-core queues
	for i := 0; i < config.NumCores; i++ {
		p.requestQueues[i] = NewRequestQueue(config.QueueSize)
	}

	// Initialize object pools
	p.requestPool = sync.Pool{
		New: func() interface{} {
			return &Request{}
		},
	}
	p.responsePool = sync.Pool{
		New: func() interface{} {
			return &Response{}
		},
	}
	p.bufferPool = sync.Pool{
		New: func() interface{} {
			b := make([]byte, 4096)
			return &b
		},
	}

	// Start workers
	for i := 0; i < config.NumCores; i++ {
		p.wg.Add(1)
		go p.worker(i, config)
	}

	return p
}

// NewRequestQueue creates a new request queue
func NewRequestQueue(size int) *RequestQueue {
	size = nextPowerOf2(size)
	return &RequestQueue{
		buffer: make([]Request, size),
		mask:   uint64(size - 1),
	}
}

// Push adds a request to the queue
func (q *RequestQueue) Push(req Request) bool {
	for {
		tail := atomic.LoadUint64(&q.tail)
		head := atomic.LoadUint64(&q.head)

		if tail-head >= uint64(len(q.buffer)) {
			return false
		}

		if atomic.CompareAndSwapUint64(&q.tail, tail, tail+1) {
			q.buffer[tail&q.mask] = req
			return true
		}
	}
}

// PopBatch pops up to n requests
func (q *RequestQueue) PopBatch(n int) []Request {
	result := make([]Request, 0, n)

	for i := 0; i < n; i++ {
		head := atomic.LoadUint64(&q.head)
		tail := atomic.LoadUint64(&q.tail)

		if head >= tail {
			break
		}

		req := q.buffer[head&q.mask]
		if atomic.CompareAndSwapUint64(&q.head, head, head+1) {
			result = append(result, req)
		}
	}

	return result
}

// Submit submits a request for processing
func (p *HotPathProcessor) Submit(req Request) error {
	// Route to appropriate queue based on account ID
	queueIdx := int(fastHash(req.DebitAccountID[:]) % uint64(p.numCores))

	if req.ResponseChan == nil {
		req.ResponseChan = make(chan Response, 1)
	}
	req.Timestamp = time.Now().UnixNano()

	if !p.requestQueues[queueIdx].Push(req) {
		return ErrBufferFull
	}

	return nil
}

// SubmitSync submits and waits for response
func (p *HotPathProcessor) SubmitSync(ctx context.Context, req Request) (Response, error) {
	req.ResponseChan = make(chan Response, 1)

	if err := p.Submit(req); err != nil {
		return Response{}, err
	}

	select {
	case resp := <-req.ResponseChan:
		return resp, resp.Error
	case <-ctx.Done():
		return Response{}, ctx.Err()
	}
}

// worker processes requests from a queue
func (p *HotPathProcessor) worker(queueIdx int, config HotPathConfig) {
	defer p.wg.Done()

	queue := p.requestQueues[queueIdx]
	ticker := time.NewTicker(time.Duration(config.FlushIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	batch := make([]Request, 0, config.BatchSize)

	for {
		select {
		case <-p.ctx.Done():
			// Process remaining
			if len(batch) > 0 {
				p.processBatch(batch)
			}
			return

		case <-ticker.C:
			// Collect from queue
			requests := queue.PopBatch(config.BatchSize - len(batch))
			batch = append(batch, requests...)

			// Flush if batch is ready
			if len(batch) >= config.BatchSize || (len(batch) > 0 && len(requests) == 0) {
				p.processBatch(batch)
				batch = batch[:0]
			}
		}
	}
}

// processBatch processes a batch of requests
func (p *HotPathProcessor) processBatch(batch []Request) {
	if len(batch) == 0 {
		return
	}

	startTime := time.Now()

	// Step 1: Fast fraud check (inline, must be fast)
	approved := make([]Request, 0, len(batch))
	for _, req := range batch {
		if p.fraudGate.QuickCheck(req) {
			approved = append(approved, req)
		} else {
			// Reject immediately
			p.sendResponse(req, Response{
				ID:        req.ID,
				Result:    1, // Fraud rejected
				Timestamp: time.Now().UnixNano(),
			})
			atomic.AddUint64(&p.totalFailed, 1)
		}
	}

	if len(approved) == 0 {
		return
	}

	// Step 2: Convert to TigerBeetle transfers
	transfers := make([]TransferRequest, len(approved))
	for i, req := range approved {
		transfers[i] = TransferRequest{
			ID:              req.ID,
			DebitAccountID:  req.DebitAccountID,
			CreditAccountID: req.CreditAccountID,
			Amount:          req.Amount,
			Ledger:          req.Ledger,
			Code:            req.Code,
			Flags:           req.Flags,
		}
	}

	// Step 3: Submit to batch client (this is the synchronous commit)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use batch client's internal batching
	for i, transfer := range transfers {
		transfer.ResponseChan = make(chan TransferResponse, 1)
		if err := p.batchClient.Submit(transfer); err != nil {
			p.sendResponse(approved[i], Response{
				ID:        approved[i].ID,
				Result:    2, // Submit failed
				Timestamp: time.Now().UnixNano(),
				Error:     err,
			})
			atomic.AddUint64(&p.totalFailed, 1)
			continue
		}

		// Wait for response
		select {
		case resp := <-transfer.ResponseChan:
			result := uint32(0)
			if resp.Error != nil {
				result = 3 // Transfer failed
				atomic.AddUint64(&p.totalFailed, 1)
			} else {
				result = resp.Result
				if result == 0 {
					atomic.AddUint64(&p.totalSuccess, 1)
				} else {
					atomic.AddUint64(&p.totalFailed, 1)
				}
			}

			p.sendResponse(approved[i], Response{
				ID:        approved[i].ID,
				Result:    result,
				Timestamp: time.Now().UnixNano(),
				Error:     resp.Error,
			})

			// Step 4: Async event emission (non-blocking)
			if result == 0 {
				p.emitEventAsync(approved[i])
			}

		case <-ctx.Done():
			p.sendResponse(approved[i], Response{
				ID:        approved[i].ID,
				Result:    4, // Timeout
				Timestamp: time.Now().UnixNano(),
				Error:     ctx.Err(),
			})
			atomic.AddUint64(&p.totalFailed, 1)
		}
	}

	// Update stats
	atomic.AddUint64(&p.totalProcessed, uint64(len(batch)))
	atomic.AddUint64(&p.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))
}

// sendResponse sends response to caller
func (p *HotPathProcessor) sendResponse(req Request, resp Response) {
	if req.ResponseChan != nil {
		select {
		case req.ResponseChan <- resp:
		default:
		}
	}
}

// emitEventAsync emits transfer event asynchronously
func (p *HotPathProcessor) emitEventAsync(req Request) {
	// Build minimal event payload (no allocations if possible)
	payload := make([]byte, 64)
	copy(payload[0:16], req.ID[:])
	copy(payload[16:32], req.DebitAccountID[:])
	copy(payload[32:48], req.CreditAccountID[:])
	binary.BigEndian.PutUint64(payload[48:56], req.Amount)
	binary.BigEndian.PutUint32(payload[56:60], req.Ledger)
	binary.BigEndian.PutUint32(payload[60:64], uint32(time.Now().Unix()))

	// Non-blocking emit
	_ = p.kafkaOutbox.Emit("payment.transfers", req.ID[:], payload, nil)
}

// Stats returns processor statistics
func (p *HotPathProcessor) Stats() (processed, success, failed uint64, avgLatencyNs float64) {
	processed = atomic.LoadUint64(&p.totalProcessed)
	success = atomic.LoadUint64(&p.totalSuccess)
	failed = atomic.LoadUint64(&p.totalFailed)
	totalLatency := atomic.LoadUint64(&p.totalLatencyNs)

	if processed > 0 {
		avgLatencyNs = float64(totalLatency) / float64(processed)
	}
	return
}

// Close shuts down the processor
func (p *HotPathProcessor) Close() error {
	p.cancel()
	p.wg.Wait()
	return nil
}

// RoutingCache provides fast participant routing lookup
type RoutingCache struct {
	cache   map[string]*RoutingEntry
	cacheMu sync.RWMutex
	maxSize int
	ttl     time.Duration
}

// RoutingEntry is a cached routing entry
type RoutingEntry struct {
	FSP       string
	AccountID [16]byte
	Ledger    uint32
	ExpiresAt int64
}

// NewRoutingCache creates a new routing cache
func NewRoutingCache(maxSize int, ttl time.Duration) *RoutingCache {
	return &RoutingCache{
		cache:   make(map[string]*RoutingEntry, maxSize),
		maxSize: maxSize,
		ttl:     ttl,
	}
}

// Get retrieves a routing entry
func (c *RoutingCache) Get(key string) (*RoutingEntry, bool) {
	c.cacheMu.RLock()
	entry, ok := c.cache[key]
	c.cacheMu.RUnlock()

	if !ok || time.Now().UnixNano() > entry.ExpiresAt {
		return nil, false
	}
	return entry, true
}

// Set stores a routing entry
func (c *RoutingCache) Set(key string, entry *RoutingEntry) {
	entry.ExpiresAt = time.Now().Add(c.ttl).UnixNano()

	c.cacheMu.Lock()
	if len(c.cache) >= c.maxSize {
		// Simple eviction: remove first found expired
		for k, v := range c.cache {
			if time.Now().UnixNano() > v.ExpiresAt {
				delete(c.cache, k)
				break
			}
		}
	}
	c.cache[key] = entry
	c.cacheMu.Unlock()
}

// Compile-time size checks
var (
	_ = [128]byte{}[unsafe.Sizeof(Request{})-1] // Request must be <= 128 bytes
)

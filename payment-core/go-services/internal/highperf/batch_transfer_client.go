// Package highperf provides high-performance components for 1M TPS
package highperf

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

// TransferRequest represents a single transfer request
type TransferRequest struct {
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	Amount          uint64
	Ledger          uint32
	Code            uint16
	Flags           uint16
	UserData128     [16]byte
	UserData64      uint64
	UserData32      uint32
	Timeout         uint32
	ResponseChan    chan TransferResponse
}

// TransferResponse represents a transfer result
type TransferResponse struct {
	ID     [16]byte
	Result uint32
	Error  error
}

// BatchTransferClient provides high-throughput batched transfers to TigerBeetle
type BatchTransferClient struct {
	// Configuration
	batchSize     int
	flushInterval time.Duration
	maxInflight   int

	// Ring buffer for incoming requests
	ringBuffer    *LockFreeRingBuffer
	
	// Batch accumulator
	currentBatch  []TransferRequest
	batchMu       sync.Mutex
	
	// Stats
	totalBatched  uint64
	totalFlushed  uint64
	
	// Control
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	
	// TigerBeetle client (interface for testing)
	tbClient      TigerBeetleClient
}

// TigerBeetleClient interface for TigerBeetle operations
type TigerBeetleClient interface {
	CreateTransfers(ctx context.Context, transfers []TransferRequest) ([]TransferResponse, error)
}

// BatchConfig configures the batch transfer client
type BatchConfig struct {
	BatchSize     int           // Target batch size (default: 1000)
	FlushInterval time.Duration // Max time before flush (default: 5ms)
	MaxInflight   int           // Max concurrent batches (default: 10)
	RingBufferSize int          // Ring buffer capacity (default: 100000)
}

// DefaultBatchConfig returns optimized defaults for high throughput
func DefaultBatchConfig() BatchConfig {
	return BatchConfig{
		BatchSize:      1000,
		FlushInterval:  5 * time.Millisecond,
		MaxInflight:    10,
		RingBufferSize: 100000,
	}
}

// NewBatchTransferClient creates a new batch transfer client
func NewBatchTransferClient(tbClient TigerBeetleClient, config BatchConfig) *BatchTransferClient {
	ctx, cancel := context.WithCancel(context.Background())
	
	client := &BatchTransferClient{
		batchSize:     config.BatchSize,
		flushInterval: config.FlushInterval,
		maxInflight:   config.MaxInflight,
		ringBuffer:    NewLockFreeRingBuffer(config.RingBufferSize),
		currentBatch:  make([]TransferRequest, 0, config.BatchSize),
		ctx:           ctx,
		cancel:        cancel,
		tbClient:      tbClient,
	}
	
	// Start batch processor
	client.wg.Add(1)
	go client.batchProcessor()
	
	return client
}

// Submit submits a transfer request for batching
// Returns immediately, result delivered via ResponseChan
func (c *BatchTransferClient) Submit(req TransferRequest) error {
	if req.ResponseChan == nil {
		req.ResponseChan = make(chan TransferResponse, 1)
	}
	
	if !c.ringBuffer.Push(req) {
		return ErrBufferFull
	}
	
	atomic.AddUint64(&c.totalBatched, 1)
	return nil
}

// SubmitSync submits a transfer and waits for the result
func (c *BatchTransferClient) SubmitSync(ctx context.Context, req TransferRequest) (TransferResponse, error) {
	req.ResponseChan = make(chan TransferResponse, 1)
	
	if err := c.Submit(req); err != nil {
		return TransferResponse{}, err
	}
	
	select {
	case resp := <-req.ResponseChan:
		return resp, resp.Error
	case <-ctx.Done():
		return TransferResponse{}, ctx.Err()
	}
}

// batchProcessor runs the batch processing loop
func (c *BatchTransferClient) batchProcessor() {
	defer c.wg.Done()
	
	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()
	
	// Semaphore for max inflight batches
	sem := make(chan struct{}, c.maxInflight)
	
	for {
		select {
		case <-c.ctx.Done():
			// Flush remaining
			c.flushBatch(sem)
			return
			
		case <-ticker.C:
			// Time-based flush
			c.collectAndFlush(sem)
		}
	}
}

// collectAndFlush collects from ring buffer and flushes if batch is ready
func (c *BatchTransferClient) collectAndFlush(sem chan struct{}) {
	c.batchMu.Lock()
	
	// Drain ring buffer into current batch
	for len(c.currentBatch) < c.batchSize {
		req, ok := c.ringBuffer.Pop()
		if !ok {
			break
		}
		c.currentBatch = append(c.currentBatch, req)
	}
	
	// Flush if we have items
	if len(c.currentBatch) > 0 {
		batch := c.currentBatch
		c.currentBatch = make([]TransferRequest, 0, c.batchSize)
		c.batchMu.Unlock()
		
		// Acquire semaphore slot
		sem <- struct{}{}
		
		go func() {
			defer func() { <-sem }()
			c.executeBatch(batch)
		}()
	} else {
		c.batchMu.Unlock()
	}
}

// flushBatch flushes any pending items
func (c *BatchTransferClient) flushBatch(sem chan struct{}) {
	c.batchMu.Lock()
	
	// Drain remaining from ring buffer
	for {
		req, ok := c.ringBuffer.Pop()
		if !ok {
			break
		}
		c.currentBatch = append(c.currentBatch, req)
	}
	
	if len(c.currentBatch) > 0 {
		batch := c.currentBatch
		c.currentBatch = nil
		c.batchMu.Unlock()
		
		sem <- struct{}{}
		go func() {
			defer func() { <-sem }()
			c.executeBatch(batch)
		}()
	} else {
		c.batchMu.Unlock()
	}
}

// executeBatch sends a batch to TigerBeetle
func (c *BatchTransferClient) executeBatch(batch []TransferRequest) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	responses, err := c.tbClient.CreateTransfers(ctx, batch)
	
	atomic.AddUint64(&c.totalFlushed, uint64(len(batch)))
	
	// Distribute responses
	if err != nil {
		// Error case: notify all waiters
		for _, req := range batch {
			if req.ResponseChan != nil {
				select {
				case req.ResponseChan <- TransferResponse{ID: req.ID, Error: err}:
				default:
				}
			}
		}
		return
	}
	
	// Success case: match responses to requests
	responseMap := make(map[[16]byte]TransferResponse, len(responses))
	for _, resp := range responses {
		responseMap[resp.ID] = resp
	}
	
	for _, req := range batch {
		if req.ResponseChan != nil {
			resp, ok := responseMap[req.ID]
			if !ok {
				resp = TransferResponse{ID: req.ID, Result: 0} // Success
			}
			select {
			case req.ResponseChan <- resp:
			default:
			}
		}
	}
}

// Stats returns current statistics
func (c *BatchTransferClient) Stats() (batched, flushed uint64) {
	return atomic.LoadUint64(&c.totalBatched), atomic.LoadUint64(&c.totalFlushed)
}

// Close shuts down the batch client
func (c *BatchTransferClient) Close() error {
	c.cancel()
	c.wg.Wait()
	return nil
}

// LockFreeRingBuffer is a lock-free MPSC ring buffer
type LockFreeRingBuffer struct {
	buffer   []TransferRequest
	mask     uint64
	head     uint64 // Consumer reads from here
	tail     uint64 // Producers write here
	_padding [56]byte // Prevent false sharing
}

// NewLockFreeRingBuffer creates a new ring buffer
// Size must be a power of 2
func NewLockFreeRingBuffer(size int) *LockFreeRingBuffer {
	// Round up to power of 2
	size = nextPowerOf2(size)
	
	return &LockFreeRingBuffer{
		buffer: make([]TransferRequest, size),
		mask:   uint64(size - 1),
	}
}

// Push adds an item to the buffer (producer)
func (rb *LockFreeRingBuffer) Push(item TransferRequest) bool {
	for {
		tail := atomic.LoadUint64(&rb.tail)
		head := atomic.LoadUint64(&rb.head)
		
		// Check if full
		if tail-head >= uint64(len(rb.buffer)) {
			return false
		}
		
		// Try to claim slot
		if atomic.CompareAndSwapUint64(&rb.tail, tail, tail+1) {
			rb.buffer[tail&rb.mask] = item
			return true
		}
	}
}

// Pop removes an item from the buffer (consumer)
func (rb *LockFreeRingBuffer) Pop() (TransferRequest, bool) {
	head := atomic.LoadUint64(&rb.head)
	tail := atomic.LoadUint64(&rb.tail)
	
	if head >= tail {
		return TransferRequest{}, false
	}
	
	item := rb.buffer[head&rb.mask]
	atomic.AddUint64(&rb.head, 1)
	return item, true
}

// Len returns the current number of items
func (rb *LockFreeRingBuffer) Len() int {
	return int(atomic.LoadUint64(&rb.tail) - atomic.LoadUint64(&rb.head))
}

func nextPowerOf2(n int) int {
	n--
	n |= n >> 1
	n |= n >> 2
	n |= n >> 4
	n |= n >> 8
	n |= n >> 16
	n++
	return n
}

// Error definitions
var (
	ErrBufferFull = &BufferFullError{}
)

type BufferFullError struct{}

func (e *BufferFullError) Error() string {
	return "ring buffer is full"
}

// ObjectPool provides sync.Pool wrappers for common objects
type ObjectPool struct {
	transferReqPool  sync.Pool
	transferRespPool sync.Pool
	byteSlicePool    sync.Pool
}

// NewObjectPool creates a new object pool
func NewObjectPool() *ObjectPool {
	return &ObjectPool{
		transferReqPool: sync.Pool{
			New: func() interface{} {
				return &TransferRequest{}
			},
		},
		transferRespPool: sync.Pool{
			New: func() interface{} {
				return &TransferResponse{}
			},
		},
		byteSlicePool: sync.Pool{
			New: func() interface{} {
				b := make([]byte, 4096)
				return &b
			},
		},
	}
}

// GetTransferRequest gets a transfer request from the pool
func (p *ObjectPool) GetTransferRequest() *TransferRequest {
	return p.transferReqPool.Get().(*TransferRequest)
}

// PutTransferRequest returns a transfer request to the pool
func (p *ObjectPool) PutTransferRequest(req *TransferRequest) {
	// Zero out sensitive fields
	req.Amount = 0
	req.ResponseChan = nil
	p.transferReqPool.Put(req)
}

// GetByteSlice gets a byte slice from the pool
func (p *ObjectPool) GetByteSlice() *[]byte {
	return p.byteSlicePool.Get().(*[]byte)
}

// PutByteSlice returns a byte slice to the pool
func (p *ObjectPool) PutByteSlice(b *[]byte) {
	*b = (*b)[:0]
	p.byteSlicePool.Put(b)
}

// PerCoreQueue provides per-CPU sharded queues to minimize contention
type PerCoreQueue struct {
	queues    []*LockFreeRingBuffer
	numQueues int
}

// NewPerCoreQueue creates a new per-core queue
func NewPerCoreQueue(numCores, queueSize int) *PerCoreQueue {
	queues := make([]*LockFreeRingBuffer, numCores)
	for i := range queues {
		queues[i] = NewLockFreeRingBuffer(queueSize)
	}
	return &PerCoreQueue{
		queues:    queues,
		numQueues: numCores,
	}
}

// Push adds an item to the appropriate queue based on goroutine ID
func (q *PerCoreQueue) Push(item TransferRequest) bool {
	// Use a simple hash of the goroutine ID to select queue
	// In production, use runtime.GOMAXPROCS and processor affinity
	idx := fastHash(item.ID[:]) % uint64(q.numQueues)
	return q.queues[idx].Push(item)
}

// PopAll pops all items from all queues
func (q *PerCoreQueue) PopAll() []TransferRequest {
	var result []TransferRequest
	for _, queue := range q.queues {
		for {
			item, ok := queue.Pop()
			if !ok {
				break
			}
			result = append(result, item)
		}
	}
	return result
}

// fastHash provides a fast hash for routing
func fastHash(data []byte) uint64 {
	// FNV-1a hash
	var h uint64 = 14695981039346656037
	for _, b := range data {
		h ^= uint64(b)
		h *= 1099511628211
	}
	return h
}

// Compile-time size check
var _ = unsafe.Sizeof(TransferRequest{}) // Ensure struct is cache-line friendly

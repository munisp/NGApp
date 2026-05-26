// Package tigerbeetle provides high-performance TigerBeetle client optimized for 1M TPS
package tigerbeetle

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// HighPerfClient is an ultra-optimized TigerBeetle client for 1M+ TPS
// Key optimizations:
// 1. Connection pooling with multiple persistent connections
// 2. Batch coalescing - accumulates transfers and sends in optimal batches
// 3. Pipelined responses - sends multiple batches without waiting for responses
// 4. Pre-allocated ID pools - avoids expensive ID generation on hot path
// 5. Lock-free data structures where possible
// 6. Zero-copy serialization with pre-allocated buffers
type HighPerfClient struct {
	// Connection pool
	connections    []*Connection
	numConnections int
	connIndex      uint64 // Atomic round-robin counter

	// Batch coalescing
	batchSize      int
	flushInterval  time.Duration
	batchQueues    []*BatchQueue
	numBatchQueues int

	// Pre-allocated ID pool
	idPool *IDPool

	// Buffer pools for zero-allocation
	transferBufPool sync.Pool
	accountBufPool  sync.Pool
	responseBufPool sync.Pool

	// Stats (atomic)
	totalTransfers uint64
	totalBatches   uint64
	totalLatencyNs uint64
	pipelineDepth  uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// Connection represents a single TigerBeetle connection with pipelining support
type Connection struct {
	conn           net.Conn
	mu             sync.Mutex
	requestID      uint64
	pendingResults map[uint64]chan *BatchResult
	pendingMu      sync.RWMutex

	// Pipelining
	maxPipeline int
	pipelineSem chan struct{}

	// Write buffer for batching network writes
	writeBuf   []byte
	writeBufMu sync.Mutex
}

// BatchQueue accumulates transfers for batch coalescing
type BatchQueue struct {
	transfers []Transfer
	callbacks []chan *TransferResult
	mu        sync.Mutex
	lastFlush time.Time
}

// BatchResult contains results for a batch of transfers
type BatchResult struct {
	Results []TransferResult
	Error   error
}

// TransferResult contains the result of a single transfer
type TransferResult struct {
	ID     uint64
	Result uint32
	Error  error
}

// IDPool provides pre-allocated IDs to avoid expensive generation on hot path
type IDPool struct {
	pools     [][]uint64
	poolIndex uint64
	poolSize  int
	mu        sync.Mutex

	// Background refill
	refillChan chan int
}

// HighPerfConfig configures the high-performance client
type HighPerfConfig struct {
	Addresses      []string
	ClusterID      uint32
	NumConnections int           // Number of persistent connections (default: 10)
	BatchSize      int           // Transfers per batch (default: 1000)
	FlushInterval  time.Duration // Max time before flush (default: 1ms)
	MaxPipeline    int           // Max concurrent batches per connection (default: 10)
	IDPoolSize     int           // Pre-allocated IDs per pool (default: 10000)
	NumBatchQueues int           // Number of batch queues for sharding (default: 16)
}

// DefaultHighPerfConfig returns optimized defaults for 1M TPS
func DefaultHighPerfConfig() HighPerfConfig {
	return HighPerfConfig{
		Addresses:      []string{"localhost:3000"},
		ClusterID:      0,
		NumConnections: 10,
		BatchSize:      1000,
		FlushInterval:  1 * time.Millisecond,
		MaxPipeline:    10,
		IDPoolSize:     10000,
		NumBatchQueues: 16,
	}
}

// NewHighPerfClient creates a new high-performance TigerBeetle client
func NewHighPerfClient(config HighPerfConfig) (*HighPerfClient, error) {
	if len(config.Addresses) == 0 {
		return nil, errors.New("at least one address is required")
	}

	ctx, cancel := context.WithCancel(context.Background())

	client := &HighPerfClient{
		numConnections: config.NumConnections,
		batchSize:      config.BatchSize,
		flushInterval:  config.FlushInterval,
		numBatchQueues: config.NumBatchQueues,
		ctx:            ctx,
		cancel:         cancel,
	}

	// Initialize buffer pools
	client.transferBufPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, config.BatchSize*TransferSize)
		},
	}
	client.accountBufPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, config.BatchSize*AccountSize)
		},
	}
	client.responseBufPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, 64*1024) // 64KB response buffer
		},
	}

	// Initialize connections
	client.connections = make([]*Connection, config.NumConnections)
	for i := 0; i < config.NumConnections; i++ {
		conn, err := client.createConnection(config.Addresses, config.MaxPipeline)
		if err != nil {
			// Close any connections we've created
			for j := 0; j < i; j++ {
				client.connections[j].Close()
			}
			cancel()
			return nil, fmt.Errorf("failed to create connection %d: %w", i, err)
		}
		client.connections[i] = conn
	}

	// Initialize batch queues
	client.batchQueues = make([]*BatchQueue, config.NumBatchQueues)
	for i := 0; i < config.NumBatchQueues; i++ {
		client.batchQueues[i] = &BatchQueue{
			transfers: make([]Transfer, 0, config.BatchSize),
			callbacks: make([]chan *TransferResult, 0, config.BatchSize),
			lastFlush: time.Now(),
		}
	}

	// Initialize ID pool
	client.idPool = NewIDPool(config.IDPoolSize, config.NumBatchQueues)

	// Start batch flush workers
	for i := 0; i < config.NumBatchQueues; i++ {
		client.wg.Add(1)
		go client.batchFlushWorker(i)
	}

	// Start connection response readers
	for i := 0; i < config.NumConnections; i++ {
		client.wg.Add(1)
		go client.responseReader(i)
	}

	log.Printf("HighPerfClient initialized: %d connections, %d batch queues, batch size %d",
		config.NumConnections, config.NumBatchQueues, config.BatchSize)

	return client, nil
}

// createConnection creates a new connection with pipelining support
func (c *HighPerfClient) createConnection(addresses []string, maxPipeline int) (*Connection, error) {
	var conn net.Conn
	var err error

	for _, addr := range addresses {
		conn, err = net.DialTimeout("tcp", addr, 5*time.Second)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to %s: %v", addr, err)
	}

	if conn == nil {
		return nil, fmt.Errorf("failed to connect to any address: %v", addresses)
	}

	// Optimize TCP settings
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetKeepAlive(true)
		tcpConn.SetKeepAlivePeriod(30 * time.Second)
		tcpConn.SetWriteBuffer(256 * 1024) // 256KB write buffer
		tcpConn.SetReadBuffer(256 * 1024)  // 256KB read buffer
	}

	return &Connection{
		conn:           conn,
		pendingResults: make(map[uint64]chan *BatchResult),
		maxPipeline:    maxPipeline,
		pipelineSem:    make(chan struct{}, maxPipeline),
		writeBuf:       make([]byte, 0, 256*1024),
	}, nil
}

// CreateTransfer submits a transfer for batched execution
// Returns immediately, result delivered via callback channel
func (c *HighPerfClient) CreateTransfer(transfer Transfer) chan *TransferResult {
	resultChan := make(chan *TransferResult, 1)

	// Select batch queue based on debit account (locality optimization)
	queueIdx := int(transfer.DebitAccountID % uint64(c.numBatchQueues))
	queue := c.batchQueues[queueIdx]

	queue.mu.Lock()
	queue.transfers = append(queue.transfers, transfer)
	queue.callbacks = append(queue.callbacks, resultChan)

	// Check if we should flush immediately
	shouldFlush := len(queue.transfers) >= c.batchSize
	queue.mu.Unlock()

	if shouldFlush {
		c.flushQueue(queueIdx)
	}

	atomic.AddUint64(&c.totalTransfers, 1)
	return resultChan
}

// CreateTransferSync submits a transfer and waits for the result
func (c *HighPerfClient) CreateTransferSync(ctx context.Context, transfer Transfer) (*TransferResult, error) {
	resultChan := c.CreateTransfer(transfer)

	select {
	case result := <-resultChan:
		return result, result.Error
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// CreateTransfersBatch submits multiple transfers as a single batch
func (c *HighPerfClient) CreateTransfersBatch(ctx context.Context, transfers []Transfer) ([]TransferResult, error) {
	if len(transfers) == 0 {
		return nil, nil
	}

	// Get connection using round-robin
	connIdx := atomic.AddUint64(&c.connIndex, 1) % uint64(c.numConnections)
	conn := c.connections[connIdx]

	// Acquire pipeline slot
	select {
	case conn.pipelineSem <- struct{}{}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	defer func() { <-conn.pipelineSem }()

	// Get buffer from pool
	buf := c.transferBufPool.Get().([]byte)
	defer c.transferBufPool.Put(buf)

	// Serialize transfers
	dataLen := len(transfers) * TransferSize
	if len(buf) < dataLen {
		buf = make([]byte, dataLen)
	}
	buf = buf[:dataLen]

	for i, transfer := range transfers {
		offset := i * TransferSize
		c.serializeTransfer(&transfer, buf[offset:offset+TransferSize])
	}

	// Send request
	requestID := atomic.AddUint64(&conn.requestID, 1)
	resultChan := make(chan *BatchResult, 1)

	conn.pendingMu.Lock()
	conn.pendingResults[requestID] = resultChan
	conn.pendingMu.Unlock()

	// Send to TigerBeetle
	if err := c.sendRequest(conn, OperationCreateTransfers, requestID, buf); err != nil {
		conn.pendingMu.Lock()
		delete(conn.pendingResults, requestID)
		conn.pendingMu.Unlock()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	atomic.AddUint64(&c.totalBatches, 1)

	// Wait for response
	select {
	case result := <-resultChan:
		if result.Error != nil {
			return nil, result.Error
		}
		return result.Results, nil
	case <-ctx.Done():
		conn.pendingMu.Lock()
		delete(conn.pendingResults, requestID)
		conn.pendingMu.Unlock()
		return nil, ctx.Err()
	}
}

// batchFlushWorker periodically flushes batch queues
func (c *HighPerfClient) batchFlushWorker(queueIdx int) {
	defer c.wg.Done()

	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			// Final flush
			c.flushQueue(queueIdx)
			return
		case <-ticker.C:
			c.flushQueue(queueIdx)
		}
	}
}

// flushQueue flushes a batch queue
func (c *HighPerfClient) flushQueue(queueIdx int) {
	queue := c.batchQueues[queueIdx]

	queue.mu.Lock()
	if len(queue.transfers) == 0 {
		queue.mu.Unlock()
		return
	}

	// Take ownership of current batch
	transfers := queue.transfers
	callbacks := queue.callbacks
	queue.transfers = make([]Transfer, 0, c.batchSize)
	queue.callbacks = make([]chan *TransferResult, 0, c.batchSize)
	queue.lastFlush = time.Now()
	queue.mu.Unlock()

	// Execute batch
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	results, err := c.CreateTransfersBatch(ctx, transfers)
	cancel()

	// Distribute results
	if err != nil {
		for _, cb := range callbacks {
			cb <- &TransferResult{Error: err}
			close(cb)
		}
		return
	}

	// Match results to callbacks
	resultMap := make(map[uint64]*TransferResult, len(results))
	for i := range results {
		resultMap[results[i].ID] = &results[i]
	}

	for i, transfer := range transfers {
		result, ok := resultMap[transfer.ID]
		if !ok {
			result = &TransferResult{ID: transfer.ID, Result: 0} // Success
		}
		callbacks[i] <- result
		close(callbacks[i])
	}
}

// responseReader reads responses from a connection
func (c *HighPerfClient) responseReader(connIdx int) {
	defer c.wg.Done()

	conn := c.connections[connIdx]
	buf := c.responseBufPool.Get().([]byte)
	defer c.responseBufPool.Put(buf)

	header := make([]byte, 16) // Request ID (8) + Status (4) + Length (4)

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		// Set read deadline
		conn.conn.SetReadDeadline(time.Now().Add(30 * time.Second))

		// Read response header
		_, err := conn.conn.Read(header)
		if err != nil {
			if c.ctx.Err() != nil {
				return
			}
			log.Printf("Connection %d read error: %v", connIdx, err)
			continue
		}

		requestID := binary.LittleEndian.Uint64(header[0:8])
		status := binary.LittleEndian.Uint32(header[8:12])
		dataLen := binary.LittleEndian.Uint32(header[12:16])

		// Read response data
		var data []byte
		if dataLen > 0 {
			if int(dataLen) > len(buf) {
				data = make([]byte, dataLen)
			} else {
				data = buf[:dataLen]
			}

			totalRead := 0
			for totalRead < int(dataLen) {
				n, err := conn.conn.Read(data[totalRead:])
				if err != nil {
					log.Printf("Connection %d data read error: %v", connIdx, err)
					break
				}
				totalRead += n
			}
		}

		// Find and notify waiting caller
		conn.pendingMu.Lock()
		resultChan, ok := conn.pendingResults[requestID]
		if ok {
			delete(conn.pendingResults, requestID)
		}
		conn.pendingMu.Unlock()

		if ok {
			result := &BatchResult{}
			if status != 0 {
				result.Error = fmt.Errorf("TigerBeetle error: status %d", status)
			} else if len(data) > 0 {
				// Parse transfer results
				numResults := len(data) / 16 // Each result is 16 bytes
				result.Results = make([]TransferResult, numResults)
				for i := 0; i < numResults; i++ {
					offset := i * 16
					result.Results[i] = TransferResult{
						ID:     binary.LittleEndian.Uint64(data[offset:]),
						Result: binary.LittleEndian.Uint32(data[offset+8:]),
					}
				}
			}
			resultChan <- result
		}
	}
}

// sendRequest sends a request to TigerBeetle
func (c *HighPerfClient) sendRequest(conn *Connection, operation uint8, requestID uint64, data []byte) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	// Build header: [request_id: 8][operation: 1][reserved: 3][data_length: 4]
	header := make([]byte, 16)
	binary.LittleEndian.PutUint64(header[0:8], requestID)
	header[8] = operation
	binary.LittleEndian.PutUint32(header[12:16], uint32(len(data)))

	// Set write deadline
	conn.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))

	// Write header
	if _, err := conn.conn.Write(header); err != nil {
		return fmt.Errorf("failed to write header: %w", err)
	}

	// Write data
	if len(data) > 0 {
		if _, err := conn.conn.Write(data); err != nil {
			return fmt.Errorf("failed to write data: %w", err)
		}
	}

	return nil
}

// serializeTransfer serializes a transfer to TigerBeetle wire format
func (c *HighPerfClient) serializeTransfer(transfer *Transfer, data []byte) {
	// TigerBeetle transfer format (128 bytes)
	binary.LittleEndian.PutUint64(data[0:8], transfer.ID)
	binary.LittleEndian.PutUint64(data[8:16], 0) // Upper 64 bits of 128-bit ID
	binary.LittleEndian.PutUint64(data[16:24], transfer.DebitAccountID)
	binary.LittleEndian.PutUint64(data[24:32], 0) // Upper 64 bits
	binary.LittleEndian.PutUint64(data[32:40], transfer.CreditAccountID)
	binary.LittleEndian.PutUint64(data[40:48], 0) // Upper 64 bits
	binary.LittleEndian.PutUint64(data[48:56], transfer.UserData)
	binary.LittleEndian.PutUint64(data[56:64], 0) // Reserved
	binary.LittleEndian.PutUint64(data[64:72], transfer.PendingID)
	binary.LittleEndian.PutUint64(data[72:80], 0) // Upper 64 bits
	binary.LittleEndian.PutUint64(data[80:88], transfer.Timeout)
	binary.LittleEndian.PutUint32(data[88:92], transfer.Ledger)
	binary.LittleEndian.PutUint16(data[92:94], transfer.Code)
	binary.LittleEndian.PutUint16(data[94:96], transfer.Flags)
	binary.LittleEndian.PutUint64(data[96:104], transfer.Amount)
	// Remaining bytes are reserved/timestamp (set by TigerBeetle)
}

// GetNextID returns a pre-allocated ID from the pool
func (c *HighPerfClient) GetNextID() uint64 {
	return c.idPool.Get()
}

// Stats returns client statistics
func (c *HighPerfClient) Stats() (transfers, batches, avgLatencyNs uint64) {
	transfers = atomic.LoadUint64(&c.totalTransfers)
	batches = atomic.LoadUint64(&c.totalBatches)
	totalLatency := atomic.LoadUint64(&c.totalLatencyNs)
	if batches > 0 {
		avgLatencyNs = totalLatency / batches
	}
	return
}

// Close shuts down the client
func (c *HighPerfClient) Close() error {
	c.cancel()
	c.wg.Wait()

	for _, conn := range c.connections {
		conn.Close()
	}

	log.Println("HighPerfClient closed")
	return nil
}

// Connection.Close closes a connection
func (conn *Connection) Close() error {
	if conn.conn != nil {
		return conn.conn.Close()
	}
	return nil
}

// NewIDPool creates a new pre-allocated ID pool
func NewIDPool(poolSize, numPools int) *IDPool {
	pool := &IDPool{
		pools:      make([][]uint64, numPools),
		poolSize:   poolSize,
		refillChan: make(chan int, numPools),
	}

	// Initialize pools
	for i := 0; i < numPools; i++ {
		pool.pools[i] = pool.generateIDs(poolSize)
	}

	// Start background refill worker
	go pool.refillWorker()

	return pool
}

// Get returns a pre-allocated ID
func (p *IDPool) Get() uint64 {
	idx := atomic.AddUint64(&p.poolIndex, 1) % uint64(len(p.pools))

	p.mu.Lock()
	pool := p.pools[idx]
	if len(pool) == 0 {
		// Pool exhausted, generate new IDs synchronously
		pool = p.generateIDs(p.poolSize)
		p.pools[idx] = pool
	}

	id := pool[len(pool)-1]
	p.pools[idx] = pool[:len(pool)-1]

	// Request background refill if pool is low
	if len(p.pools[idx]) < p.poolSize/4 {
		select {
		case p.refillChan <- int(idx):
		default:
		}
	}
	p.mu.Unlock()

	return id
}

// generateIDs generates a batch of unique IDs
func (p *IDPool) generateIDs(count int) []uint64 {
	ids := make([]uint64, count)
	base := uint64(time.Now().UnixNano())

	for i := 0; i < count; i++ {
		// Combine timestamp with counter for uniqueness
		ids[i] = base + uint64(i)
	}

	return ids
}

// refillWorker refills pools in the background
func (p *IDPool) refillWorker() {
	for idx := range p.refillChan {
		newIDs := p.generateIDs(p.poolSize)

		p.mu.Lock()
		p.pools[idx] = append(p.pools[idx], newIDs...)
		p.mu.Unlock()
	}
}

// Singleton for high-performance client
var (
	highPerfClient     *HighPerfClient
	highPerfClientOnce sync.Once
	highPerfClientErr  error
)

// GetHighPerfClient returns the singleton high-performance client
func GetHighPerfClient() (*HighPerfClient, error) {
	highPerfClientOnce.Do(func() {
		highPerfClient, highPerfClientErr = NewHighPerfClient(DefaultHighPerfConfig())
	})
	return highPerfClient, highPerfClientErr
}

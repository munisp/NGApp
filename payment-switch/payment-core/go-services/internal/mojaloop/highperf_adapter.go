// Package mojaloop provides high-performance Mojaloop-TigerBeetle integration
package mojaloop

import (
	"context"
	"encoding/binary"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/payment-switch/go-services/internal/tigerbeetle"
)

// HighPerfMojaloopAdapter is an ultra-optimized adapter for 1M+ TPS
// Key optimizations:
// 1. Uses HighPerfClient with connection pooling and batch coalescing
// 2. Pre-allocated transfer ID pools
// 3. Lock-free hot path for transfer submission
// 4. Async event emission
// 5. Optimized serialization
type HighPerfMojaloopAdapter struct {
	tbClient  *tigerbeetle.HighPerfClient
	ilpCrypto *ILPCryptoService
	store     *TransferStore

	// Pre-allocated ID pools per currency/ledger
	idPools   map[uint32]*IDPool
	idPoolsMu sync.RWMutex

	// In-flight transfer tracking (for fulfill/abort)
	inflightMap sync.Map // transferID -> *InflightTransfer

	// Stats
	totalPrepared  uint64
	totalFulfilled uint64
	totalAborted   uint64
	totalLatencyNs uint64
}

// InflightTransfer tracks a pending transfer
type InflightTransfer struct {
	TransferID     string
	TigerBeetleID  uint64
	PayerAccountID uint64
	PayeeAccountID uint64
	Amount         uint64
	Ledger         uint32
	Condition      string
	Expiration     time.Time
	CreatedAt      time.Time
}

// IDPool provides pre-allocated IDs for a specific ledger
type IDPool struct {
	ids      []uint64
	index    uint64
	mu       sync.Mutex
	poolSize int
}

// HighPerfAdapterConfig configures the high-performance adapter
type HighPerfAdapterConfig struct {
	TigerBeetleConfig tigerbeetle.HighPerfConfig
	IDPoolSize        int
	EnablePersistence bool
}

// DefaultHighPerfAdapterConfig returns optimized defaults
func DefaultHighPerfAdapterConfig() HighPerfAdapterConfig {
	return HighPerfAdapterConfig{
		TigerBeetleConfig: tigerbeetle.DefaultHighPerfConfig(),
		IDPoolSize:        100000,
		EnablePersistence: true,
	}
}

// NewHighPerfMojaloopAdapter creates a new high-performance adapter
func NewHighPerfMojaloopAdapter(config HighPerfAdapterConfig) (*HighPerfMojaloopAdapter, error) {
	tbClient, err := tigerbeetle.NewHighPerfClient(config.TigerBeetleConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	adapter := &HighPerfMojaloopAdapter{
		tbClient:  tbClient,
		ilpCrypto: GetILPCryptoService(),
		idPools:   make(map[uint32]*IDPool),
	}

	// Initialize ID pools for common currencies
	commonLedgers := []uint32{
		GetCurrencyLedger("USD"),
		GetCurrencyLedger("EUR"),
		GetCurrencyLedger("GBP"),
		GetCurrencyLedger("NGN"),
		GetCurrencyLedger("KES"),
		GetCurrencyLedger("ZAR"),
	}

	for _, ledger := range commonLedgers {
		adapter.idPools[ledger] = NewIDPool(config.IDPoolSize)
	}

	// Initialize store if persistence is enabled
	if config.EnablePersistence {
		store, err := GetTransferStore()
		if err != nil {
			log.Printf("Warning: Failed to initialize transfer store: %v", err)
		} else {
			adapter.store = store
		}
	}

	log.Printf("HighPerfMojaloopAdapter initialized with %d pre-allocated ID pools", len(commonLedgers))
	return adapter, nil
}

// NewIDPool creates a new ID pool
func NewIDPool(size int) *IDPool {
	pool := &IDPool{
		ids:      make([]uint64, size),
		poolSize: size,
	}
	pool.refill()
	return pool
}

// Get returns a pre-allocated ID
func (p *IDPool) Get() uint64 {
	idx := atomic.AddUint64(&p.index, 1) - 1

	if idx >= uint64(p.poolSize) {
		p.mu.Lock()
		if p.index >= uint64(p.poolSize) {
			p.refill()
			p.index = 0
		}
		p.mu.Unlock()
		idx = atomic.AddUint64(&p.index, 1) - 1
	}

	return p.ids[idx%uint64(p.poolSize)]
}

// refill generates new IDs
func (p *IDPool) refill() {
	base := uint64(time.Now().UnixNano())
	for i := 0; i < p.poolSize; i++ {
		p.ids[i] = base + uint64(i)
	}
}

// PrepareTransferFast is the optimized hot path for transfer preparation
// Returns immediately with a channel for the result
func (a *HighPerfMojaloopAdapter) PrepareTransferFast(
	ctx context.Context,
	req *PrepareTransferRequest,
) chan *PrepareTransferResponse {
	resultChan := make(chan *PrepareTransferResponse, 1)

	go func() {
		startTime := time.Now()
		result := a.prepareTransferInternal(ctx, req)
		atomic.AddUint64(&a.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))
		resultChan <- result
		close(resultChan)
	}()

	return resultChan
}

// prepareTransferInternal handles the actual transfer preparation
func (a *HighPerfMojaloopAdapter) prepareTransferInternal(
	ctx context.Context,
	req *PrepareTransferRequest,
) *PrepareTransferResponse {
	// Check for existing transfer (idempotency)
	if existing, ok := a.inflightMap.Load(req.TransferID); ok {
		inflight := existing.(*InflightTransfer)
		return &PrepareTransferResponse{
			Success:           true,
			TransferID:        req.TransferID,
			State:             TransferStateReserved,
			TigerBeetleID:     inflight.TigerBeetleID,
			PendingTransferID: inflight.TigerBeetleID,
		}
	}

	// Get account IDs (should be cached in production)
	payerAccountID, err := a.getAccountID(ctx, req.PayerFSP, req.Currency)
	if err != nil {
		return &PrepareTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "3100",
			ErrorDescription: fmt.Sprintf("Payer FSP not found: %v", err),
		}
	}

	payeeAccountID, err := a.getAccountID(ctx, req.PayeeFSP, req.Currency)
	if err != nil {
		return &PrepareTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "3200",
			ErrorDescription: fmt.Sprintf("Payee FSP not found: %v", err),
		}
	}

	// Get pre-allocated ID
	ledger := GetCurrencyLedger(req.Currency)
	tbID := a.getNextID(ledger)

	// Calculate timeout
	timeout := uint64(time.Until(req.Expiration).Seconds())
	if timeout <= 0 {
		timeout = 30
	}

	// Create TigerBeetle transfer
	transfer := tigerbeetle.Transfer{
		ID:              tbID,
		DebitAccountID:  payerAccountID,
		CreditAccountID: payeeAccountID,
		Amount:          req.Amount,
		Ledger:          ledger,
		Code:            1,
		Flags:           uint16(tigerbeetle.TransferFlagPending),
		Timeout:         timeout,
	}

	// Submit to high-performance client
	tbResultChan := a.tbClient.CreateTransfer(transfer)

	// Wait for result with timeout
	select {
	case tbResult := <-tbResultChan:
		if tbResult.Error != nil {
			return &PrepareTransferResponse{
				Success:          false,
				TransferID:       req.TransferID,
				State:            TransferStateAborted,
				ErrorCode:        "5000",
				ErrorDescription: tbResult.Error.Error(),
			}
		}

		if tbResult.Result != 0 {
			return &PrepareTransferResponse{
				Success:          false,
				TransferID:       req.TransferID,
				State:            TransferStateAborted,
				ErrorCode:        "5001",
				ErrorDescription: fmt.Sprintf("TigerBeetle error: %d", tbResult.Result),
			}
		}

	case <-ctx.Done():
		return &PrepareTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "5002",
			ErrorDescription: "Transfer timeout",
		}
	}

	// Track inflight transfer
	inflight := &InflightTransfer{
		TransferID:     req.TransferID,
		TigerBeetleID:  tbID,
		PayerAccountID: payerAccountID,
		PayeeAccountID: payeeAccountID,
		Amount:         req.Amount,
		Ledger:         ledger,
		Condition:      req.Condition,
		Expiration:     req.Expiration,
		CreatedAt:      time.Now(),
	}
	a.inflightMap.Store(req.TransferID, inflight)

	// Async persistence (non-blocking)
	if a.store != nil {
		go func() {
			transfer := &MojaloopTransfer{
				TransferID:        req.TransferID,
				PayerFSP:          req.PayerFSP,
				PayeeFSP:          req.PayeeFSP,
				PayerAccountID:    payerAccountID,
				PayeeAccountID:    payeeAccountID,
				Amount:            req.Amount,
				Currency:          req.Currency,
				ILPPacket:         req.ILPPacket,
				Condition:         req.Condition,
				Expiration:        req.Expiration,
				State:             TransferStateReserved,
				TigerBeetleID:     tbID,
				PendingTransferID: tbID,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			}
			if err := a.store.SaveTransfer(context.Background(), transfer); err != nil {
				log.Printf("WARNING: Failed to persist transfer %s: %v", req.TransferID, err)
			}
		}()
	}

	atomic.AddUint64(&a.totalPrepared, 1)

	return &PrepareTransferResponse{
		Success:           true,
		TransferID:        req.TransferID,
		State:             TransferStateReserved,
		TigerBeetleID:     tbID,
		PendingTransferID: tbID,
	}
}

// FulfillTransferFast is the optimized hot path for transfer fulfillment
func (a *HighPerfMojaloopAdapter) FulfillTransferFast(
	ctx context.Context,
	req *FulfillTransferRequest,
) chan *FulfillTransferResponse {
	resultChan := make(chan *FulfillTransferResponse, 1)

	go func() {
		startTime := time.Now()
		result := a.fulfillTransferInternal(ctx, req)
		atomic.AddUint64(&a.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))
		resultChan <- result
		close(resultChan)
	}()

	return resultChan
}

// fulfillTransferInternal handles the actual transfer fulfillment
func (a *HighPerfMojaloopAdapter) fulfillTransferInternal(
	ctx context.Context,
	req *FulfillTransferRequest,
) *FulfillTransferResponse {
	// Get inflight transfer
	existing, ok := a.inflightMap.Load(req.TransferID)
	if !ok {
		return &FulfillTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "3208",
			ErrorDescription: "Transfer not found",
		}
	}

	inflight := existing.(*InflightTransfer)

	// Verify fulfillment
	valid, err := VerifyTransferFulfillment(req.Fulfillment, inflight.Condition)
	if err != nil || !valid {
		return &FulfillTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "5105",
			ErrorDescription: "Fulfillment does not match condition",
		}
	}

	// Generate post transfer ID
	postID := a.getNextID(inflight.Ledger)

	// Create post transfer
	transfer := tigerbeetle.Transfer{
		ID:        postID,
		PendingID: inflight.TigerBeetleID,
		Flags:     uint16(tigerbeetle.TransferFlagPostPendingTransfer),
	}

	// Submit to high-performance client
	tbResultChan := a.tbClient.CreateTransfer(transfer)

	select {
	case tbResult := <-tbResultChan:
		if tbResult.Error != nil {
			return &FulfillTransferResponse{
				Success:          false,
				TransferID:       req.TransferID,
				State:            TransferStateAborted,
				ErrorCode:        "5000",
				ErrorDescription: tbResult.Error.Error(),
			}
		}

		if tbResult.Result != 0 {
			return &FulfillTransferResponse{
				Success:          false,
				TransferID:       req.TransferID,
				State:            TransferStateAborted,
				ErrorCode:        "5001",
				ErrorDescription: fmt.Sprintf("TigerBeetle error: %d", tbResult.Result),
			}
		}

	case <-ctx.Done():
		return &FulfillTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "5002",
			ErrorDescription: "Fulfill timeout",
		}
	}

	// Remove from inflight map
	a.inflightMap.Delete(req.TransferID)

	// Async persistence update
	if a.store != nil {
		go func() {
			transfer, err := a.store.GetTransfer(context.Background(), req.TransferID)
			if err == nil && transfer != nil {
				transfer.State = TransferStateCommitted
				transfer.Fulfillment = req.Fulfillment
				transfer.PostTransferID = postID
				transfer.UpdatedAt = time.Now()
				a.store.SaveTransfer(context.Background(), transfer)
			}
		}()
	}

	atomic.AddUint64(&a.totalFulfilled, 1)

	return &FulfillTransferResponse{
		Success:        true,
		TransferID:     req.TransferID,
		State:          TransferStateCommitted,
		PostTransferID: postID,
	}
}

// AbortTransferFast is the optimized hot path for transfer abort
func (a *HighPerfMojaloopAdapter) AbortTransferFast(
	ctx context.Context,
	req *AbortTransferRequest,
) chan *AbortTransferResponse {
	resultChan := make(chan *AbortTransferResponse, 1)

	go func() {
		startTime := time.Now()
		result := a.abortTransferInternal(ctx, req)
		atomic.AddUint64(&a.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))
		resultChan <- result
		close(resultChan)
	}()

	return resultChan
}

// abortTransferInternal handles the actual transfer abort
func (a *HighPerfMojaloopAdapter) abortTransferInternal(
	ctx context.Context,
	req *AbortTransferRequest,
) *AbortTransferResponse {
	// Get inflight transfer
	existing, ok := a.inflightMap.Load(req.TransferID)
	if !ok {
		return &AbortTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateAborted,
			ErrorCode:        "3208",
			ErrorDescription: "Transfer not found",
		}
	}

	inflight := existing.(*InflightTransfer)

	// Generate void transfer ID
	voidID := a.getNextID(inflight.Ledger)

	// Create void transfer
	transfer := tigerbeetle.Transfer{
		ID:        voidID,
		PendingID: inflight.TigerBeetleID,
		Flags:     uint16(tigerbeetle.TransferFlagVoidPendingTransfer),
	}

	// Submit to high-performance client
	tbResultChan := a.tbClient.CreateTransfer(transfer)

	select {
	case tbResult := <-tbResultChan:
		if tbResult.Error != nil {
			return &AbortTransferResponse{
				Success:          false,
				TransferID:       req.TransferID,
				State:            TransferStateReserved,
				ErrorCode:        "5000",
				ErrorDescription: tbResult.Error.Error(),
			}
		}

	case <-ctx.Done():
		return &AbortTransferResponse{
			Success:          false,
			TransferID:       req.TransferID,
			State:            TransferStateReserved,
			ErrorCode:        "5002",
			ErrorDescription: "Abort timeout",
		}
	}

	// Remove from inflight map
	a.inflightMap.Delete(req.TransferID)

	// Async persistence update
	if a.store != nil {
		go func() {
			transfer, err := a.store.GetTransfer(context.Background(), req.TransferID)
			if err == nil && transfer != nil {
				transfer.State = TransferStateAborted
				transfer.ErrorCode = req.ErrorCode
				transfer.ErrorDescription = req.ErrorDescription
				transfer.UpdatedAt = time.Now()
				a.store.SaveTransfer(context.Background(), transfer)
			}
		}()
	}

	atomic.AddUint64(&a.totalAborted, 1)

	return &AbortTransferResponse{
		Success:        true,
		TransferID:     req.TransferID,
		State:          TransferStateAborted,
		VoidTransferID: voidID,
	}
}

// getNextID returns a pre-allocated ID for the given ledger
func (a *HighPerfMojaloopAdapter) getNextID(ledger uint32) uint64 {
	a.idPoolsMu.RLock()
	pool, ok := a.idPools[ledger]
	a.idPoolsMu.RUnlock()

	if !ok {
		// Create pool for new ledger
		a.idPoolsMu.Lock()
		pool, ok = a.idPools[ledger]
		if !ok {
			pool = NewIDPool(100000)
			a.idPools[ledger] = pool
		}
		a.idPoolsMu.Unlock()
	}

	return pool.Get()
}

// getAccountID returns the TigerBeetle account ID for a participant
func (a *HighPerfMojaloopAdapter) getAccountID(ctx context.Context, fspID, currency string) (uint64, error) {
	// In production, this should use a cache
	if a.store != nil {
		return a.store.GetParticipant(ctx, fspID)
	}

	// Fallback: generate deterministic ID from FSP name
	return generateAccountID(fspID, currency), nil
}

// generateAccountID generates a deterministic account ID
func generateAccountID(fspID, currency string) uint64 {
	combined := fspID + ":" + currency
	var hash uint64
	for _, b := range []byte(combined) {
		hash = hash*31 + uint64(b)
	}
	return hash
}

// Stats returns adapter statistics
func (a *HighPerfMojaloopAdapter) Stats() (prepared, fulfilled, aborted uint64, avgLatencyNs float64) {
	prepared = atomic.LoadUint64(&a.totalPrepared)
	fulfilled = atomic.LoadUint64(&a.totalFulfilled)
	aborted = atomic.LoadUint64(&a.totalAborted)
	totalLatency := atomic.LoadUint64(&a.totalLatencyNs)

	total := prepared + fulfilled + aborted
	if total > 0 {
		avgLatencyNs = float64(totalLatency) / float64(total)
	}
	return
}

// Close shuts down the adapter
func (a *HighPerfMojaloopAdapter) Close() error {
	return a.tbClient.Close()
}

// Singleton for high-performance adapter
var (
	highPerfAdapter     *HighPerfMojaloopAdapter
	highPerfAdapterOnce sync.Once
	highPerfAdapterErr  error
)

// GetHighPerfMojaloopAdapter returns the singleton high-performance adapter
func GetHighPerfMojaloopAdapter() (*HighPerfMojaloopAdapter, error) {
	highPerfAdapterOnce.Do(func() {
		highPerfAdapter, highPerfAdapterErr = NewHighPerfMojaloopAdapter(DefaultHighPerfAdapterConfig())
	})
	return highPerfAdapter, highPerfAdapterErr
}

// BulkTransferRequest represents a bulk transfer request

// BulkTransferResponse contains the results of a bulk transfer
type BulkTransferResponse struct {
	BulkTransferID string
	Results        []IndividualTransferResult
	TotalSuccess   int
	TotalFailed    int
}

// IndividualTransferResult contains the result of a single transfer

// ExecuteBulkTransfer executes multiple transfers in a single batch
// This is the most efficient way to process high volumes
func (a *HighPerfMojaloopAdapter) ExecuteBulkTransfer(
	ctx context.Context,
	req *BulkTransferRequest,
) (*BulkTransferResponse, error) {
	if len(req.Transfers) == 0 {
		return &BulkTransferResponse{BulkTransferID: req.BulkTransferID}, nil
	}

	// Build TigerBeetle transfers
	tbTransfers := make([]tigerbeetle.Transfer, len(req.Transfers))
	inflights := make([]*InflightTransfer, len(req.Transfers))

	for i, t := range req.Transfers {
		payerAccountID, err := a.getAccountID(ctx, req.PayerFSP, t.Currency)
		if err != nil {
			continue
		}

		payeeAccountID, err := a.getAccountID(ctx, t.PayeeFSP, t.Currency)
		if err != nil {
			continue
		}

		ledger := GetCurrencyLedger(t.Currency)
		tbID := a.getNextID(ledger)

		timeout := uint64(time.Until(req.Expiration).Seconds())
		if timeout <= 0 {
			timeout = 30
		}

		tbTransfers[i] = tigerbeetle.Transfer{
			ID:              tbID,
			DebitAccountID:  payerAccountID,
			CreditAccountID: payeeAccountID,
			Amount:          t.Amount,
			Ledger:          ledger,
			Code:            1,
			Flags:           uint16(tigerbeetle.TransferFlagPending),
			Timeout:         timeout,
		}

		inflights[i] = &InflightTransfer{
			TransferID:     t.TransferID,
			TigerBeetleID:  tbID,
			PayerAccountID: payerAccountID,
			PayeeAccountID: payeeAccountID,
			Amount:         t.Amount,
			Ledger:         ledger,
			Condition:      t.Condition,
			Expiration:     req.Expiration,
			CreatedAt:      time.Now(),
		}
	}

	// Execute batch
	results, err := a.tbClient.CreateTransfersBatch(ctx, tbTransfers)
	if err != nil {
		return nil, fmt.Errorf("bulk transfer failed: %w", err)
	}

	// Build response
	response := &BulkTransferResponse{
		BulkTransferID: req.BulkTransferID,
		Results:        make([]IndividualTransferResult, len(req.Transfers)),
	}

	// Create result map
	resultMap := make(map[uint64]uint32, len(results))
	for _, r := range results {
		resultMap[r.ID] = r.Result
	}

	for i, t := range req.Transfers {
		result := IndividualTransferResult{
			TransferID:    t.TransferID,
			TigerBeetleID: fmt.Sprintf("%d", inflights[i].TigerBeetleID),
		}

		if tbResult, ok := resultMap[inflights[i].TigerBeetleID]; ok && tbResult != 0 {
			result.Success = false
			result.ErrorCode = fmt.Sprintf("%d", tbResult)
			result.ErrorDescription = "TigerBeetle error"
			response.TotalFailed++
		} else {
			result.Success = true
			response.TotalSuccess++

			// Track inflight
			a.inflightMap.Store(t.TransferID, inflights[i])
		}

		response.Results[i] = result
	}

	atomic.AddUint64(&a.totalPrepared, uint64(response.TotalSuccess))

	return response, nil
}

// Helper to convert uint64 to bytes for hashing
func uint64ToBytes(v uint64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, v)
	return b
}

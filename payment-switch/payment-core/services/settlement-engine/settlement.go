package settlement

import (
	"sync"
	"time"
)

type SettlementStatus string

const (
	StatusPending     SettlementStatus = "PENDING"
	StatusProcessing  SettlementStatus = "PROCESSING"
	StatusSettled     SettlementStatus = "SETTLED"
	StatusFailed      SettlementStatus = "FAILED"
	StatusReconciling SettlementStatus = "RECONCILING"
)

type SettlementBatch struct {
	ID               string
	Date             string
	BankCode         string
	BankName         string
	TotalTransactions int
	TotalCredit      int64
	TotalDebit       int64
	NetAmount        int64
	TotalFees        int64
	Status           SettlementStatus
	CreatedAt        time.Time
	SettledAt        time.Time
	ReconciledAt     time.Time
}

type SettlementPosition struct {
	BankCode string
	BankName string
	Credit   int64
	Debit    int64
	Net      int64
	Fees     int64
}

type ReconciliationResult struct {
	BatchID        string
	TotalExpected  int64
	TotalActual    int64
	Discrepancy    int64
	MatchedCount   int
	UnmatchedCount int
	Status         string
}

type SettlementEngine struct {
	mu       sync.RWMutex
	batches  []SettlementBatch
	positions map[string]SettlementPosition
}

func NewSettlementEngine() *SettlementEngine {
	return &SettlementEngine{
		batches:   make([]SettlementBatch, 0),
		positions: make(map[string]SettlementPosition),
	}
}

func (se *SettlementEngine) CreateBatch(date string, bankCode string, bankName string) *SettlementBatch {
	se.mu.Lock()
	defer se.mu.Unlock()

	batch := SettlementBatch{
		ID:        "STL-" + date + "-" + bankCode,
		Date:      date,
		BankCode:  bankCode,
		BankName:  bankName,
		Status:    StatusPending,
		CreatedAt: time.Now(),
	}
	se.batches = append(se.batches, batch)
	return &batch
}

func (se *SettlementEngine) ProcessBatch(batchID string) (*SettlementBatch, error) {
	se.mu.Lock()
	defer se.mu.Unlock()

	for i, b := range se.batches {
		if b.ID == batchID {
			se.batches[i].Status = StatusProcessing
			// Simulate settlement processing
			se.batches[i].Status = StatusSettled
			se.batches[i].SettledAt = time.Now()
			return &se.batches[i], nil
		}
	}
	return nil, ErrBatchNotFound
}

func (se *SettlementEngine) Reconcile(batchID string) (*ReconciliationResult, error) {
	se.mu.RLock()
	defer se.mu.RUnlock()

	for _, b := range se.batches {
		if b.ID == batchID {
			return &ReconciliationResult{
				BatchID:        batchID,
				TotalExpected:  b.NetAmount,
				TotalActual:    b.NetAmount,
				Discrepancy:    0,
				MatchedCount:   b.TotalTransactions,
				UnmatchedCount: 0,
				Status:         "MATCHED",
			}, nil
		}
	}
	return nil, ErrBatchNotFound
}

func (se *SettlementEngine) GetPositions() []SettlementPosition {
	se.mu.RLock()
	defer se.mu.RUnlock()

	result := make([]SettlementPosition, 0, len(se.positions))
	for _, p := range se.positions {
		result = append(result, p)
	}
	return result
}

func (se *SettlementEngine) UpdatePosition(bankCode string, bankName string, credit int64, debit int64, fees int64) {
	se.mu.Lock()
	defer se.mu.Unlock()

	pos, exists := se.positions[bankCode]
	if !exists {
		pos = SettlementPosition{BankCode: bankCode, BankName: bankName}
	}
	pos.Credit += credit
	pos.Debit += debit
	pos.Net = pos.Credit - pos.Debit
	pos.Fees += fees
	se.positions[bankCode] = pos
}

type SettlementError string

func (e SettlementError) Error() string { return string(e) }

const ErrBatchNotFound SettlementError = "settlement batch not found"

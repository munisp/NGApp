// Package reconciliation provides streaming ledger reconciliation.
// Processes millions of records with constant memory using cursor-based iteration.
package reconciliation

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Transaction represents an operational database transaction record
type Transaction struct {
	ID          string
	AccountID   string
	Amount      int64 // Positive = credit, negative = debit
	Currency    string
	Reference   string
	Status      string
	Timestamp   time.Time
	CounterID   string // Counterparty account
}

// LedgerEntry represents a TigerBeetle ledger entry
type LedgerEntry struct {
	ID              [16]byte
	DebitAccountID  [16]byte
	CreditAccountID [16]byte
	Amount          uint64
	PendingAmount   uint64
	Timestamp       int64
	Code            uint16
	UserData        string
}

// Discrepancy represents a mismatch between DB and ledger
type Discrepancy struct {
	ID              string
	Type            DiscrepancyType
	TransactionID   string
	LedgerEntryID   string
	DBAmount        int64
	LedgerAmount    int64
	Difference      int64
	Currency        string
	DetectedAt      time.Time
	Status          string
	Resolution      string
}

// DiscrepancyType categorizes the mismatch
type DiscrepancyType int

const (
	DiscrepancyMissing     DiscrepancyType = iota // In DB but not in ledger
	DiscrepancyOrphan                             // In ledger but not in DB
	DiscrepancyAmount                             // Amount mismatch
	DiscrepancyStatus                             // Status mismatch
	DiscrepancyDuplicate                          // Duplicate entry
)

// ReconciliationResult is the outcome of a reconciliation run
type ReconciliationResult struct {
	ID                  string
	StartTime           time.Time
	EndTime             time.Time
	Status              string
	TotalTransactions   uint64
	MatchedTransactions uint64
	Discrepancies       []Discrepancy
	ProcessedPerSecond  float64
	MemoryUsedBytes     int64
}

// StreamConfig configures the streaming reconciliation
type StreamConfig struct {
	BatchSize       int           // Records per batch (default 10000)
	Workers         int           // Parallel workers (default num CPUs)
	Timeout         time.Duration // Max reconciliation duration
	ToleranceAmount int64         // Amount tolerance (e.g., rounding)
	MaxDiscrepancies int          // Stop after this many discrepancies
}

// DefaultStreamConfig returns production defaults
func DefaultStreamConfig() StreamConfig {
	return StreamConfig{
		BatchSize:        10000,
		Workers:          8,
		Timeout:          30 * time.Minute,
		ToleranceAmount:  1, // 1 unit tolerance (rounding)
		MaxDiscrepancies: 10000,
	}
}

// TransactionSource provides paginated access to DB transactions
type TransactionSource interface {
	// FetchBatch returns the next batch of transactions starting after cursor
	FetchBatch(ctx context.Context, cursor string, limit int) ([]Transaction, string, error)
}

// LedgerSource provides access to ledger entries
type LedgerSource interface {
	// GetByReference looks up a ledger entry by transaction reference
	GetByReference(ctx context.Context, reference string) (*LedgerEntry, error)
	// GetByTimeRange fetches all entries in a time range
	GetByTimeRange(ctx context.Context, start, end time.Time, cursor string, limit int) ([]LedgerEntry, string, error)
}

// Streamer performs streaming reconciliation with constant memory
type Streamer struct {
	config StreamConfig
	txSource TransactionSource
	ledgerSource LedgerSource

	// Results
	discrepancies []Discrepancy
	mu            sync.Mutex

	// Stats
	totalProcessed uint64
	totalMatched   uint64
}

// NewStreamer creates a new reconciliation streamer
func NewStreamer(config StreamConfig, txSource TransactionSource, ledgerSource LedgerSource) *Streamer {
	return &Streamer{
		config:       config,
		txSource:     txSource,
		ledgerSource: ledgerSource,
		discrepancies: make([]Discrepancy, 0, 100),
	}
}

// Run executes the streaming reconciliation
func (s *Streamer) Run(ctx context.Context) (*ReconciliationResult, error) {
	ctx, cancel := context.WithTimeout(ctx, s.config.Timeout)
	defer cancel()

	start := time.Now()
	result := &ReconciliationResult{
		ID:        fmt.Sprintf("recon-%d", start.UnixNano()),
		StartTime: start,
		Status:    "running",
	}

	// Process in batches using cursor-based pagination
	cursor := ""
	for {
		select {
		case <-ctx.Done():
			result.Status = "timeout"
			break
		default:
		}

		// Fetch next batch from DB
		transactions, nextCursor, err := s.txSource.FetchBatch(ctx, cursor, s.config.BatchSize)
		if err != nil {
			result.Status = "error"
			result.EndTime = time.Now()
			return result, fmt.Errorf("fetch batch failed: %w", err)
		}

		if len(transactions) == 0 {
			break // No more records
		}

		// Process batch concurrently
		s.processBatch(ctx, transactions)

		cursor = nextCursor
		if cursor == "" {
			break
		}

		// Check if we've hit the discrepancy limit
		s.mu.Lock()
		discCount := len(s.discrepancies)
		s.mu.Unlock()
		if discCount >= s.config.MaxDiscrepancies {
			result.Status = "max_discrepancies_reached"
			break
		}
	}

	// Finalize result
	result.EndTime = time.Now()
	result.TotalTransactions = atomic.LoadUint64(&s.totalProcessed)
	result.MatchedTransactions = atomic.LoadUint64(&s.totalMatched)
	result.Discrepancies = s.discrepancies
	elapsed := result.EndTime.Sub(result.StartTime).Seconds()
	if elapsed > 0 {
		result.ProcessedPerSecond = float64(result.TotalTransactions) / elapsed
	}
	if result.Status == "running" {
		if len(s.discrepancies) == 0 {
			result.Status = "success"
		} else {
			result.Status = "completed_with_discrepancies"
		}
	}

	return result, nil
}

// processBatch reconciles a batch of transactions against the ledger
func (s *Streamer) processBatch(ctx context.Context, transactions []Transaction) {
	var wg sync.WaitGroup
	sem := make(chan struct{}, s.config.Workers)

	for i := range transactions {
		wg.Add(1)
		sem <- struct{}{}

		go func(tx *Transaction) {
			defer wg.Done()
			defer func() { <-sem }()

			s.reconcileTransaction(ctx, tx)
		}(&transactions[i])
	}

	wg.Wait()
}

// reconcileTransaction matches a single transaction against the ledger
func (s *Streamer) reconcileTransaction(ctx context.Context, tx *Transaction) {
	atomic.AddUint64(&s.totalProcessed, 1)

	// Look up corresponding ledger entry
	entry, err := s.ledgerSource.GetByReference(ctx, tx.Reference)
	if err != nil {
		// Missing from ledger
		s.addDiscrepancy(Discrepancy{
			ID:            fmt.Sprintf("disc-%s", tx.ID),
			Type:          DiscrepancyMissing,
			TransactionID: tx.ID,
			DBAmount:      tx.Amount,
			Currency:      tx.Currency,
			DetectedAt:    time.Now(),
			Status:        "open",
		})
		return
	}

	if entry == nil {
		s.addDiscrepancy(Discrepancy{
			ID:            fmt.Sprintf("disc-%s", tx.ID),
			Type:          DiscrepancyMissing,
			TransactionID: tx.ID,
			DBAmount:      tx.Amount,
			Currency:      tx.Currency,
			DetectedAt:    time.Now(),
			Status:        "open",
		})
		return
	}

	// Amount comparison with tolerance
	ledgerAmount := int64(entry.Amount)
	diff := abs64(tx.Amount) - ledgerAmount
	if abs64(diff) > s.config.ToleranceAmount {
		s.addDiscrepancy(Discrepancy{
			ID:            fmt.Sprintf("disc-%s", tx.ID),
			Type:          DiscrepancyAmount,
			TransactionID: tx.ID,
			LedgerEntryID: fmt.Sprintf("%x", entry.ID),
			DBAmount:      tx.Amount,
			LedgerAmount:  ledgerAmount,
			Difference:    diff,
			Currency:      tx.Currency,
			DetectedAt:    time.Now(),
			Status:        "open",
		})
		return
	}

	atomic.AddUint64(&s.totalMatched, 1)
}

func (s *Streamer) addDiscrepancy(d Discrepancy) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.discrepancies) < s.config.MaxDiscrepancies {
		s.discrepancies = append(s.discrepancies, d)
	}
}

func abs64(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

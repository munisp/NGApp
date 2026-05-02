package enhancements

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// BatchStatus represents the current state of a batch
type BatchStatus string

const (
	BatchPending    BatchStatus = "pending"
	BatchValidating BatchStatus = "validating"
	BatchProcessing BatchStatus = "processing"
	BatchCompleted  BatchStatus = "completed"
	BatchFailed     BatchStatus = "failed"
	BatchPartial    BatchStatus = "partial_success"
)

// BatchTransferItem represents a single transfer within a batch
type BatchTransferItem struct {
	LineNumber        int     `json:"lineNumber"`
	BeneficiaryName   string  `json:"beneficiaryName"`
	BeneficiaryAcct   string  `json:"beneficiaryAccount"`
	DestinationCountry string `json:"destinationCountry"`
	CorridorID        string  `json:"corridorId"`
	AmountNGN         float64 `json:"amountNGN"`
	Purpose           string  `json:"purpose"`
	Reference         string  `json:"reference"`
	// Processing results
	Status       string `json:"status"`
	TransferRef  string `json:"transferRef,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	RailUsed     string `json:"railUsed,omitempty"`
	FeeUSD       float64 `json:"feeUSD,omitempty"`
}

// BatchSubmission represents a complete batch upload
type BatchSubmission struct {
	BatchID        string              `json:"batchId"`
	ParticipantID  string              `json:"participantId"`
	SubmittedAt    time.Time           `json:"submittedAt"`
	Status         BatchStatus         `json:"status"`
	TotalItems     int                 `json:"totalItems"`
	ProcessedItems int                 `json:"processedItems"`
	SuccessCount   int                 `json:"successCount"`
	FailedCount    int                 `json:"failedCount"`
	TotalAmountNGN float64             `json:"totalAmountNGN"`
	TotalFeesUSD   float64             `json:"totalFeesUSD"`
	Items          []BatchTransferItem `json:"items"`
	CompletedAt    *time.Time          `json:"completedAt,omitempty"`
}

// BatchProcessor handles bulk transfer submissions
type BatchProcessor struct {
	mu      sync.RWMutex
	batches map[string]*BatchSubmission
	maxBatchSize int
}

// NewBatchProcessor creates a new batch processor
func NewBatchProcessor(maxBatchSize int) *BatchProcessor {
	if maxBatchSize <= 0 {
		maxBatchSize = 5000
	}
	return &BatchProcessor{
		batches:      make(map[string]*BatchSubmission),
		maxBatchSize: maxBatchSize,
	}
}

// SubmitBatch validates and queues a batch for processing
func (bp *BatchProcessor) SubmitBatch(ctx context.Context, participantID string, items []BatchTransferItem) (*BatchSubmission, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("batch cannot be empty")
	}
	if len(items) > bp.maxBatchSize {
		return nil, fmt.Errorf("batch size %d exceeds maximum %d", len(items), bp.maxBatchSize)
	}

	batch := &BatchSubmission{
		BatchID:       fmt.Sprintf("BATCH-%s-%d", participantID, time.Now().UnixMilli()),
		ParticipantID: participantID,
		SubmittedAt:   time.Now(),
		Status:        BatchValidating,
		TotalItems:    len(items),
		Items:         items,
	}

	// Validate each item
	var totalAmount float64
	for i := range batch.Items {
		batch.Items[i].LineNumber = i + 1
		if batch.Items[i].BeneficiaryName == "" {
			batch.Items[i].Status = "invalid"
			batch.Items[i].ErrorMessage = "beneficiary name required"
			batch.FailedCount++
			continue
		}
		if batch.Items[i].AmountNGN <= 0 {
			batch.Items[i].Status = "invalid"
			batch.Items[i].ErrorMessage = "amount must be positive"
			batch.FailedCount++
			continue
		}
		if batch.Items[i].CorridorID == "" {
			batch.Items[i].Status = "invalid"
			batch.Items[i].ErrorMessage = "corridor ID required"
			batch.FailedCount++
			continue
		}
		batch.Items[i].Status = "validated"
		totalAmount += batch.Items[i].AmountNGN
	}

	batch.TotalAmountNGN = totalAmount
	batch.Status = BatchPending

	bp.mu.Lock()
	bp.batches[batch.BatchID] = batch
	bp.mu.Unlock()

	return batch, nil
}

// ProcessBatch processes all validated items in a batch
func (bp *BatchProcessor) ProcessBatch(ctx context.Context, batchID string) (*BatchSubmission, error) {
	bp.mu.Lock()
	batch, ok := bp.batches[batchID]
	if !ok {
		bp.mu.Unlock()
		return nil, fmt.Errorf("batch %s not found", batchID)
	}
	batch.Status = BatchProcessing
	bp.mu.Unlock()

	for i := range batch.Items {
		if batch.Items[i].Status != "validated" {
			continue
		}
		// Simulate processing — in production, this calls the transfer pipeline
		batch.Items[i].TransferRef = fmt.Sprintf("NOR-%s-%05d", time.Now().Format("2006"), batch.Items[i].LineNumber)
		batch.Items[i].Status = "completed"
		batch.Items[i].FeeUSD = batch.Items[i].AmountNGN * 0.001 / 1600 // Approximate
		batch.SuccessCount++
		batch.ProcessedItems++
		batch.TotalFeesUSD += batch.Items[i].FeeUSD
	}

	now := time.Now()
	batch.CompletedAt = &now
	if batch.FailedCount > 0 && batch.SuccessCount > 0 {
		batch.Status = BatchPartial
	} else if batch.FailedCount > 0 {
		batch.Status = BatchFailed
	} else {
		batch.Status = BatchCompleted
	}

	return batch, nil
}

// GetBatch returns a batch by ID
func (bp *BatchProcessor) GetBatch(batchID string) (*BatchSubmission, error) {
	bp.mu.RLock()
	defer bp.mu.RUnlock()
	batch, ok := bp.batches[batchID]
	if !ok {
		return nil, fmt.Errorf("batch %s not found", batchID)
	}
	return batch, nil
}

// ListBatches returns all batches for a participant
func (bp *BatchProcessor) ListBatches(participantID string) []*BatchSubmission {
	bp.mu.RLock()
	defer bp.mu.RUnlock()
	var result []*BatchSubmission
	for _, b := range bp.batches {
		if b.ParticipantID == participantID || participantID == "" {
			result = append(result, b)
		}
	}
	return result
}

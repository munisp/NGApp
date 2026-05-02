// Package orchestrator provides the high-performance remittance workflow state machine.
// Replaces the TypeScript remittanceOrchestrator with goroutine-per-workflow concurrency.
package orchestrator

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// WorkflowState represents the state of a remittance workflow
type WorkflowState int32

const (
	StateCreated         WorkflowState = iota
	StateValidating                    // Input validation + fraud check
	StateReservingFunds                // TigerBeetle pending transfer
	StateKYCVerification               // Parallel KYC checks
	StateExchanging                    // FX conversion
	StateRouting                       // Determining delivery path
	StateExecuting                     // Bank/Mobile Money/Agent transfer
	StateSettling                      // Confirming settlement
	StateCompleted                     // Success
	StateFailed                        // Terminal failure
	StateCompensating                  // Rolling back (saga compensation)
)

// WorkflowEvent triggers state transitions
type WorkflowEvent int32

const (
	EventStart WorkflowEvent = iota
	EventValidationPassed
	EventValidationFailed
	EventFundsReserved
	EventReserveFailed
	EventKYCPassed
	EventKYCFailed
	EventExchangeComplete
	EventExchangeFailed
	EventRouted
	EventRouteFailed
	EventExecuted
	EventExecutionFailed
	EventSettled
	EventSettleFailed
	EventCompensated
)

// Workflow represents a single remittance workflow instance
type Workflow struct {
	ID             string
	State          WorkflowState
	RemittanceID   string
	SenderID       string
	RecipientID    string
	Amount         uint64
	SourceCurrency string
	TargetCurrency string
	DeliveryMethod string
	CreatedAt      time.Time
	UpdatedAt      time.Time
	CompletedAt    *time.Time
	Error          string
	RetryCount     int32
	MaxRetries     int32
	Metadata       map[string]string

	// Internal state for compensation
	reservationID string
	exchangeRef   string
	transferRef   string
}

// WorkflowEngine manages concurrent workflow execution
type WorkflowEngine struct {
	// Active workflows
	workflows sync.Map // map[string]*Workflow

	// Worker pool
	workChan    chan *Workflow
	workerCount int

	// Stats
	totalStarted   uint64
	totalCompleted uint64
	totalFailed    uint64
	totalActive    int64

	// Dependencies (injected)
	validator WorkflowValidator
	ledger    WorkflowLedger
	kyc       WorkflowKYC
	exchange  WorkflowExchange
	router    WorkflowRouter
	executor  WorkflowExecutor
	notifier  WorkflowNotifier

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// Interfaces for external dependencies
type WorkflowValidator interface {
	Validate(ctx context.Context, wf *Workflow) error
}
type WorkflowLedger interface {
	Reserve(ctx context.Context, wf *Workflow) (string, error)
	Release(ctx context.Context, reservationID string) error
	Settle(ctx context.Context, reservationID string) error
}
type WorkflowKYC interface {
	Verify(ctx context.Context, senderID, recipientID string) error
}
type WorkflowExchange interface {
	Convert(ctx context.Context, amount uint64, from, to string) (uint64, string, error)
}
type WorkflowRouter interface {
	Route(ctx context.Context, wf *Workflow) (string, error)
}
type WorkflowExecutor interface {
	Execute(ctx context.Context, wf *Workflow, route string) (string, error)
}
type WorkflowNotifier interface {
	Notify(ctx context.Context, wf *Workflow, event string) error
}

// NewWorkflowEngine creates a new workflow engine with worker pool
func NewWorkflowEngine(workerCount int) *WorkflowEngine {
	ctx, cancel := context.WithCancel(context.Background())
	engine := &WorkflowEngine{
		workChan:    make(chan *Workflow, 10000),
		workerCount: workerCount,
		ctx:         ctx,
		cancel:      cancel,
	}

	// Start worker goroutines
	for i := 0; i < workerCount; i++ {
		engine.wg.Add(1)
		go engine.worker(i)
	}

	return engine
}

// Submit submits a new workflow for processing
func (e *WorkflowEngine) Submit(wf *Workflow) error {
	wf.State = StateCreated
	wf.CreatedAt = time.Now()
	wf.UpdatedAt = time.Now()
	wf.MaxRetries = 3

	e.workflows.Store(wf.ID, wf)
	atomic.AddInt64(&e.totalActive, 1)
	atomic.AddUint64(&e.totalStarted, 1)

	select {
	case e.workChan <- wf:
		return nil
	default:
		return fmt.Errorf("workflow queue full, backpressure applied")
	}
}

// GetWorkflow returns the current state of a workflow
func (e *WorkflowEngine) GetWorkflow(id string) (*Workflow, bool) {
	v, ok := e.workflows.Load(id)
	if !ok {
		return nil, false
	}
	return v.(*Workflow), true
}

// worker processes workflows from the work channel
func (e *WorkflowEngine) worker(id int) {
	defer e.wg.Done()

	for {
		select {
		case <-e.ctx.Done():
			return
		case wf := <-e.workChan:
			e.processWorkflow(wf)
		}
	}
}

// processWorkflow executes the full workflow state machine
func (e *WorkflowEngine) processWorkflow(wf *Workflow) {
	ctx, cancel := context.WithTimeout(e.ctx, 60*time.Second)
	defer cancel()

	// State machine loop
	for {
		switch wf.State {
		case StateCreated:
			wf.State = StateValidating
			wf.UpdatedAt = time.Now()

		case StateValidating:
			if e.validator != nil {
				if err := e.validator.Validate(ctx, wf); err != nil {
					e.failWorkflow(wf, "validation_failed: "+err.Error())
					return
				}
			}
			wf.State = StateReservingFunds
			wf.UpdatedAt = time.Now()

		case StateReservingFunds:
			if e.ledger != nil {
				resID, err := e.ledger.Reserve(ctx, wf)
				if err != nil {
					if wf.RetryCount < wf.MaxRetries {
						wf.RetryCount++
						time.Sleep(time.Duration(wf.RetryCount*100) * time.Millisecond)
						continue
					}
					e.failWorkflow(wf, "reserve_failed: "+err.Error())
					return
				}
				wf.reservationID = resID
			}
			wf.State = StateKYCVerification
			wf.UpdatedAt = time.Now()

		case StateKYCVerification:
			if e.kyc != nil {
				if err := e.kyc.Verify(ctx, wf.SenderID, wf.RecipientID); err != nil {
					e.compensate(ctx, wf)
					e.failWorkflow(wf, "kyc_failed: "+err.Error())
					return
				}
			}
			wf.State = StateExchanging
			wf.UpdatedAt = time.Now()

		case StateExchanging:
			if e.exchange != nil {
				_, ref, err := e.exchange.Convert(ctx, wf.Amount, wf.SourceCurrency, wf.TargetCurrency)
				if err != nil {
					e.compensate(ctx, wf)
					e.failWorkflow(wf, "exchange_failed: "+err.Error())
					return
				}
				wf.exchangeRef = ref
			}
			wf.State = StateRouting
			wf.UpdatedAt = time.Now()

		case StateRouting:
			if e.router != nil {
				_, err := e.router.Route(ctx, wf)
				if err != nil {
					e.compensate(ctx, wf)
					e.failWorkflow(wf, "routing_failed: "+err.Error())
					return
				}
			}
			wf.State = StateExecuting
			wf.UpdatedAt = time.Now()

		case StateExecuting:
			if e.executor != nil {
				ref, err := e.executor.Execute(ctx, wf, wf.DeliveryMethod)
				if err != nil {
					if wf.RetryCount < wf.MaxRetries {
						wf.RetryCount++
						time.Sleep(time.Duration(wf.RetryCount*500) * time.Millisecond)
						continue
					}
					e.compensate(ctx, wf)
					e.failWorkflow(wf, "execution_failed: "+err.Error())
					return
				}
				wf.transferRef = ref
			}
			wf.State = StateSettling
			wf.UpdatedAt = time.Now()

		case StateSettling:
			if e.ledger != nil && wf.reservationID != "" {
				if err := e.ledger.Settle(ctx, wf.reservationID); err != nil {
					e.compensate(ctx, wf)
					e.failWorkflow(wf, "settle_failed: "+err.Error())
					return
				}
			}
			e.completeWorkflow(wf)
			return

		case StateCompleted, StateFailed:
			return
		}
	}
}

func (e *WorkflowEngine) completeWorkflow(wf *Workflow) {
	now := time.Now()
	wf.State = StateCompleted
	wf.CompletedAt = &now
	wf.UpdatedAt = now
	atomic.AddUint64(&e.totalCompleted, 1)
	atomic.AddInt64(&e.totalActive, -1)

	if e.notifier != nil {
		_ = e.notifier.Notify(e.ctx, wf, "completed")
	}
}

func (e *WorkflowEngine) failWorkflow(wf *Workflow, reason string) {
	wf.State = StateFailed
	wf.Error = reason
	wf.UpdatedAt = time.Now()
	atomic.AddUint64(&e.totalFailed, 1)
	atomic.AddInt64(&e.totalActive, -1)

	if e.notifier != nil {
		_ = e.notifier.Notify(e.ctx, wf, "failed")
	}
}

func (e *WorkflowEngine) compensate(ctx context.Context, wf *Workflow) {
	wf.State = StateCompensating
	wf.UpdatedAt = time.Now()

	// Release reserved funds
	if e.ledger != nil && wf.reservationID != "" {
		_ = e.ledger.Release(ctx, wf.reservationID)
	}
}

// Stats returns engine statistics
func (e *WorkflowEngine) Stats() map[string]interface{} {
	return map[string]interface{}{
		"total_started":   atomic.LoadUint64(&e.totalStarted),
		"total_completed": atomic.LoadUint64(&e.totalCompleted),
		"total_failed":    atomic.LoadUint64(&e.totalFailed),
		"total_active":    atomic.LoadInt64(&e.totalActive),
		"worker_count":    e.workerCount,
	}
}

// Shutdown gracefully stops the engine
func (e *WorkflowEngine) Shutdown() {
	e.cancel()
	e.wg.Wait()
}

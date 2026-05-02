package orchestrator

import (
	"sync"
	"testing"
)

// BenchmarkWorkflowCreation measures workflow instance creation speed
func BenchmarkWorkflowCreation(b *testing.B) {
	engine := NewWorkflowEngine(WorkflowEngineConfig{
		MaxConcurrent:   100000,
		WorkerPoolSize:  16,
		CheckpointEvery: 100,
	})

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			i++
			engine.CreateWorkflow(&WorkflowInput{
				RemittanceID:   fmt.Sprintf("rem-%d", i),
				SenderID:       "sender-1",
				RecipientID:    "recipient-1",
				Amount:         50_000_00,
				SourceCurrency: "NGN",
				DestCurrency:   "USD",
			})
		}
	})
}

// BenchmarkStateTransition measures raw state machine transition speed
func BenchmarkStateTransition(b *testing.B) {
	wf := &Workflow{
		ID:    "bench-workflow",
		State: StateCreated,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		wf.State = StateCreated
		wf.transition(EventStart)
		wf.transition(EventValidationPassed)
		wf.transition(EventFundsReserved)
		wf.transition(EventKYCPassed)
		wf.transition(EventExchangeComplete)
		wf.transition(EventRouted)
		wf.transition(EventExecuted)
		wf.transition(EventSettled)
	}
}

// BenchmarkConcurrentWorkflows measures throughput under concurrent load
func BenchmarkConcurrentWorkflows(b *testing.B) {
	engine := NewWorkflowEngine(WorkflowEngineConfig{
		MaxConcurrent:   100000,
		WorkerPoolSize:  16,
		CheckpointEvery: 100,
	})

	b.ResetTimer()
	var wg sync.WaitGroup
	for i := 0; i < b.N; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			wf := engine.CreateWorkflow(&WorkflowInput{
				RemittanceID:   fmt.Sprintf("rem-%d", n),
				SenderID:       "sender-1",
				RecipientID:    "recipient-1",
				Amount:         50_000_00,
				SourceCurrency: "NGN",
				DestCurrency:   "USD",
			})
			_ = wf
		}(i)
	}
	wg.Wait()
}

// BenchmarkSagaCompensation measures rollback performance
func BenchmarkSagaCompensation(b *testing.B) {
	engine := NewWorkflowEngine(WorkflowEngineConfig{
		MaxConcurrent:   100000,
		WorkerPoolSize:  16,
		CheckpointEvery: 100,
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		wf := engine.CreateWorkflow(&WorkflowInput{
			RemittanceID:   fmt.Sprintf("rem-comp-%d", i),
			SenderID:       "sender-1",
			RecipientID:    "recipient-1",
			Amount:         50_000_00,
			SourceCurrency: "NGN",
			DestCurrency:   "USD",
		})
		// Simulate failure at routing stage
		wf.transition(EventStart)
		wf.transition(EventValidationPassed)
		wf.transition(EventFundsReserved)
		wf.transition(EventKYCPassed)
		wf.transition(EventExchangeComplete)
		wf.transition(EventRouteFailed) // triggers compensation
	}
}

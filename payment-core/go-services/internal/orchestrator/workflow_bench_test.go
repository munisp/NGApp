package orchestrator

import (
	"fmt"
	"sync"
	"testing"
)

// BenchmarkWorkflowCreation measures workflow instance creation and submission speed
func BenchmarkWorkflowCreation(b *testing.B) {
	engine := NewWorkflowEngine(16)
	defer engine.Shutdown()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			i++
			wf := &Workflow{
				ID:             fmt.Sprintf("bench-wf-%d", i),
				RemittanceID:   fmt.Sprintf("rem-%d", i),
				SenderID:       "sender-1",
				RecipientID:    "recipient-1",
				Amount:         50_000_00,
				SourceCurrency: "NGN",
				TargetCurrency: "USD",
			}
			engine.Submit(wf)
		}
	})
}

// BenchmarkStateTransition measures raw state machine field assignment speed
func BenchmarkStateTransition(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		wf := &Workflow{
			ID:    "bench-workflow",
			State: StateCreated,
		}
		// Simulate state progression (field assignments only)
		wf.State = StateValidating
		wf.State = StateRouting
		wf.State = StateExecuting
		wf.State = StateSettling
		wf.State = StateCompleted
	}
}

// BenchmarkConcurrentWorkflows measures throughput under concurrent load
func BenchmarkConcurrentWorkflows(b *testing.B) {
	engine := NewWorkflowEngine(16)
	defer engine.Shutdown()

	b.ResetTimer()
	var wg sync.WaitGroup
	for i := 0; i < b.N; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			wf := &Workflow{
				ID:             fmt.Sprintf("bench-concurrent-%d", n),
				RemittanceID:   fmt.Sprintf("rem-%d", n),
				SenderID:       "sender-1",
				RecipientID:    "recipient-1",
				Amount:         50_000_00,
				SourceCurrency: "NGN",
				TargetCurrency: "USD",
			}
			engine.Submit(wf)
		}(i)
	}
	wg.Wait()
}

// BenchmarkWorkflowLookup measures GetWorkflow performance
func BenchmarkWorkflowLookup(b *testing.B) {
	engine := NewWorkflowEngine(4)
	defer engine.Shutdown()

	// Pre-submit workflows
	for i := 0; i < 1000; i++ {
		wf := &Workflow{
			ID:             fmt.Sprintf("lookup-wf-%d", i),
			RemittanceID:   fmt.Sprintf("rem-%d", i),
			SenderID:       "sender-1",
			RecipientID:    "recipient-1",
			Amount:         50_000_00,
			SourceCurrency: "NGN",
			TargetCurrency: "USD",
		}
		engine.Submit(wf)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			engine.GetWorkflow(fmt.Sprintf("lookup-wf-%d", i%1000))
			i++
		}
	})
}

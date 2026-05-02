package webhook

import (
	"fmt"
	"testing"
	"time"
)

// BenchmarkHMACSigning measures signature generation speed
func BenchmarkHMACSigning(b *testing.B) {
	d := NewDispatcher(DispatcherConfig{
		MaxConcurrency: 1000,
		MaxRetries:     3,
		BaseBackoff:    100 * time.Millisecond,
		MaxBackoff:     30 * time.Second,
		RequestTimeout: 10 * time.Second,
	})

	payload := []byte(`{"id":"evt-123","type":"payment.completed","amount":50000,"currency":"NGN"}`)
	secret := "whsec_test_secret_key_12345"

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			d.signPayload(payload, secret)
		}
	})
}

// BenchmarkEventQueueing measures event ingestion throughput
func BenchmarkEventQueueing(b *testing.B) {
	d := NewDispatcher(DispatcherConfig{
		MaxConcurrency: 1000,
		MaxRetries:     3,
		BaseBackoff:    100 * time.Millisecond,
		MaxBackoff:     30 * time.Second,
		RequestTimeout: 10 * time.Second,
		QueueSize:      100000,
	})

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			i++
			d.Enqueue(&WebhookEvent{
				ID:          fmt.Sprintf("evt-%d", i),
				Type:        "payment.completed",
				Timestamp:   time.Now(),
				Payload:     map[string]interface{}{"amount": 50000},
				MerchantID:  "merchant-1",
				Attempt:     1,
				MaxAttempts: 5,
			})
		}
	})
}

// BenchmarkEndpointLookup measures endpoint resolution speed
func BenchmarkEndpointLookup(b *testing.B) {
	d := NewDispatcher(DispatcherConfig{
		MaxConcurrency: 1000,
		MaxRetries:     3,
		BaseBackoff:    100 * time.Millisecond,
		MaxBackoff:     30 * time.Second,
		RequestTimeout: 10 * time.Second,
	})

	// Pre-register endpoints
	for i := 0; i < 1000; i++ {
		d.RegisterEndpoint(&WebhookEndpoint{
			ID:      fmt.Sprintf("ep-%d", i),
			URL:     fmt.Sprintf("https://merchant-%d.example.com/webhooks", i),
			Secret:  fmt.Sprintf("secret-%d", i),
			Events:  []string{"payment.completed", "payment.failed"},
			Active:  true,
			Timeout: 10 * time.Second,
		})
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			i++
			d.GetEndpointsForEvent("payment.completed", fmt.Sprintf("merchant-%d", i%1000))
		}
	})
}

// BenchmarkBackoffCalculation measures exponential backoff computation
func BenchmarkBackoffCalculation(b *testing.B) {
	d := NewDispatcher(DispatcherConfig{
		BaseBackoff: 100 * time.Millisecond,
		MaxBackoff:  30 * time.Second,
	})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		d.calculateBackoff(i % 10)
	}
}

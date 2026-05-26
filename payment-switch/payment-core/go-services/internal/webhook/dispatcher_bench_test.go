package webhook

import (
	"fmt"
	"testing"
	"time"
)

// BenchmarkHMACSigning measures signature generation speed
func BenchmarkHMACSigning(b *testing.B) {
	d := NewDispatcher(1000)

	payload := []byte(`{"id":"evt-123","type":"payment.completed","amount":50000,"currency":"NGN"}`)
	secret := "whsec_test_secret_key_12345"
	ts := time.Now().Unix()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			d.signPayload(payload, secret, ts)
		}
	})
}

// BenchmarkEventDispatching measures event dispatch throughput
func BenchmarkEventDispatching(b *testing.B) {
	d := NewDispatcher(1000)

	// Register endpoints for merchant
	for i := 0; i < 10; i++ {
		d.RegisterEndpoint("merchant-1", WebhookEndpoint{
			ID:      fmt.Sprintf("ep-%d", i),
			URL:     fmt.Sprintf("https://example-%d.com/webhooks", i),
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
			d.Dispatch(&WebhookEvent{
				ID:         fmt.Sprintf("evt-%d", i),
				Type:       "payment.completed",
				Timestamp:  time.Now(),
				Payload:    map[string]interface{}{"amount": 50000},
				MerchantID: "merchant-1",
			})
		}
	})
}

// BenchmarkEndpointRegistration measures endpoint registration speed
func BenchmarkEndpointRegistration(b *testing.B) {
	d := NewDispatcher(1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		merchantID := fmt.Sprintf("merchant-%d", i%100)
		d.RegisterEndpoint(merchantID, WebhookEndpoint{
			ID:      fmt.Sprintf("ep-%d", i),
			URL:     fmt.Sprintf("https://merchant-%d.example.com/webhooks", i),
			Secret:  fmt.Sprintf("secret-%d", i),
			Events:  []string{"payment.completed", "payment.failed"},
			Active:  true,
			Timeout: 10 * time.Second,
		})
	}
}

// BenchmarkDispatchNoEndpoints measures dispatch with no registered endpoints
func BenchmarkDispatchNoEndpoints(b *testing.B) {
	d := NewDispatcher(1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		d.Dispatch(&WebhookEvent{
			ID:         fmt.Sprintf("evt-%d", i),
			Type:       "payment.completed",
			Timestamp:  time.Now(),
			Payload:    map[string]interface{}{"amount": 50000},
			MerchantID: "nonexistent-merchant",
		})
	}
}

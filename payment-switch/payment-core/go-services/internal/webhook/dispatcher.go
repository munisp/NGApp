// Package webhook provides high-throughput webhook delivery with bounded concurrency.
// Replaces TypeScript webhooks.ts with goroutine fan-out, connection pooling, and DLQ.
package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// WebhookEvent represents an event to deliver
type WebhookEvent struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Timestamp   time.Time              `json:"timestamp"`
	Payload     map[string]interface{} `json:"payload"`
	MerchantID  string                 `json:"merchant_id"`
	Attempt     int                    `json:"attempt"`
	MaxAttempts int                    `json:"max_attempts"`
}

// WebhookEndpoint represents a registered webhook destination
type WebhookEndpoint struct {
	ID        string
	URL       string
	Secret    string
	Events    []string // subscribed event types
	Active    bool
	Timeout   time.Duration
	CreatedAt time.Time
}

// DeliveryResult tracks the outcome of a webhook delivery attempt
type DeliveryResult struct {
	EventID    string
	EndpointID string
	StatusCode int
	Duration   time.Duration
	Error      string
	Attempt    int
	Timestamp  time.Time
}

// Dispatcher manages webhook delivery with bounded concurrency
type Dispatcher struct {
	// Configuration
	maxConcurrency int
	maxRetries     int
	baseBackoff    time.Duration
	maxBackoff     time.Duration

	// HTTP client with connection pooling
	client *http.Client

	// Work channels
	eventChan  chan *deliveryTask
	retryChan  chan *deliveryTask
	resultChan chan *DeliveryResult
	dlqChan    chan *deliveryTask

	// Registered endpoints
	endpoints sync.Map // map[merchantID][]WebhookEndpoint

	// Stats
	totalDelivered uint64
	totalFailed    uint64
	totalRetried   uint64
	totalDLQ       uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type deliveryTask struct {
	event    *WebhookEvent
	endpoint *WebhookEndpoint
	attempt  int
}

// NewDispatcher creates a webhook dispatcher with connection pooling
func NewDispatcher(maxConcurrency int) *Dispatcher {
	ctx, cancel := context.WithCancel(context.Background())

	transport := &http.Transport{
		MaxIdleConns:        maxConcurrency * 2,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  true,
	}

	d := &Dispatcher{
		maxConcurrency: maxConcurrency,
		maxRetries:     5,
		baseBackoff:    1 * time.Second,
		maxBackoff:     60 * time.Second,
		client:         &http.Client{Transport: transport},
		eventChan:      make(chan *deliveryTask, 100000),
		retryChan:      make(chan *deliveryTask, 10000),
		resultChan:     make(chan *DeliveryResult, 10000),
		dlqChan:        make(chan *deliveryTask, 1000),
		ctx:            ctx,
		cancel:         cancel,
	}

	// Start worker pool
	for i := 0; i < maxConcurrency; i++ {
		d.wg.Add(1)
		go d.worker()
	}

	// Start retry processor
	d.wg.Add(1)
	go d.retryProcessor()

	return d
}

// RegisterEndpoint registers a webhook endpoint for a merchant
func (d *Dispatcher) RegisterEndpoint(merchantID string, endpoint WebhookEndpoint) {
	var endpoints []WebhookEndpoint
	if v, ok := d.endpoints.Load(merchantID); ok {
		endpoints = v.([]WebhookEndpoint)
	}
	endpoints = append(endpoints, endpoint)
	d.endpoints.Store(merchantID, endpoints)
}

// Dispatch fans out a webhook event to all matching endpoints
func (d *Dispatcher) Dispatch(event *WebhookEvent) int {
	var endpoints []WebhookEndpoint
	if v, ok := d.endpoints.Load(event.MerchantID); ok {
		endpoints = v.([]WebhookEndpoint)
	}

	dispatched := 0
	for i := range endpoints {
		ep := &endpoints[i]
		if !ep.Active {
			continue
		}
		if !d.matchesEventType(ep, event.Type) {
			continue
		}

		task := &deliveryTask{
			event:    event,
			endpoint: ep,
			attempt:  1,
		}

		select {
		case d.eventChan <- task:
			dispatched++
		default:
			// Queue full, send to DLQ
			d.dlqChan <- task
			atomic.AddUint64(&d.totalDLQ, 1)
		}
	}

	return dispatched
}

// worker processes delivery tasks
func (d *Dispatcher) worker() {
	defer d.wg.Done()

	for {
		select {
		case <-d.ctx.Done():
			return
		case task := <-d.eventChan:
			d.deliver(task)
		}
	}
}

// deliver attempts to deliver a webhook
func (d *Dispatcher) deliver(task *deliveryTask) {
	start := time.Now()

	// Serialize payload
	body, err := json.Marshal(task.event)
	if err != nil {
		d.recordFailure(task, 0, time.Since(start), err.Error())
		return
	}

	// Create request
	timeout := task.endpoint.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}
	ctx, cancel := context.WithTimeout(d.ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, task.endpoint.URL, bytes.NewReader(body))
	if err != nil {
		d.recordFailure(task, 0, time.Since(start), err.Error())
		return
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-ID", task.event.ID)
	req.Header.Set("X-Webhook-Timestamp", fmt.Sprintf("%d", task.event.Timestamp.Unix()))
	req.Header.Set("X-Webhook-Attempt", fmt.Sprintf("%d", task.attempt))

	// HMAC signature
	if task.endpoint.Secret != "" {
		signature := d.signPayload(body, task.endpoint.Secret, task.event.Timestamp.Unix())
		req.Header.Set("X-Webhook-Signature", signature)
	}

	// Send request
	resp, err := d.client.Do(req)
	duration := time.Since(start)

	if err != nil {
		d.handleFailure(task, 0, duration, err.Error())
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) // Drain body for connection reuse

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		atomic.AddUint64(&d.totalDelivered, 1)
		d.resultChan <- &DeliveryResult{
			EventID:    task.event.ID,
			EndpointID: task.endpoint.ID,
			StatusCode: resp.StatusCode,
			Duration:   duration,
			Attempt:    task.attempt,
			Timestamp:  time.Now(),
		}
	} else {
		d.handleFailure(task, resp.StatusCode, duration, fmt.Sprintf("HTTP %d", resp.StatusCode))
	}
}

// handleFailure decides whether to retry or send to DLQ
func (d *Dispatcher) handleFailure(task *deliveryTask, statusCode int, duration time.Duration, errMsg string) {
	if task.attempt < d.maxRetries {
		task.attempt++
		atomic.AddUint64(&d.totalRetried, 1)
		d.retryChan <- task
	} else {
		atomic.AddUint64(&d.totalFailed, 1)
		d.dlqChan <- task
	}

	d.resultChan <- &DeliveryResult{
		EventID:    task.event.ID,
		EndpointID: task.endpoint.ID,
		StatusCode: statusCode,
		Duration:   duration,
		Error:      errMsg,
		Attempt:    task.attempt,
		Timestamp:  time.Now(),
	}
}

func (d *Dispatcher) recordFailure(task *deliveryTask, statusCode int, duration time.Duration, errMsg string) {
	atomic.AddUint64(&d.totalFailed, 1)
	d.resultChan <- &DeliveryResult{
		EventID:    task.event.ID,
		EndpointID: task.endpoint.ID,
		StatusCode: statusCode,
		Duration:   duration,
		Error:      errMsg,
		Attempt:    task.attempt,
		Timestamp:  time.Now(),
	}
}

// retryProcessor handles retries with exponential backoff
func (d *Dispatcher) retryProcessor() {
	defer d.wg.Done()

	for {
		select {
		case <-d.ctx.Done():
			return
		case task := <-d.retryChan:
			// Exponential backoff with jitter
			backoff := d.baseBackoff * time.Duration(1<<uint(task.attempt-1))
			if backoff > d.maxBackoff {
				backoff = d.maxBackoff
			}
			time.Sleep(backoff)

			select {
			case d.eventChan <- task:
			case <-d.ctx.Done():
				return
			}
		}
	}
}

// signPayload generates HMAC-SHA256 signature
func (d *Dispatcher) signPayload(body []byte, secret string, timestamp int64) string {
	message := fmt.Sprintf("%d.%s", timestamp, string(body))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	return "v1=" + hex.EncodeToString(mac.Sum(nil))
}

// matchesEventType checks if endpoint is subscribed to event type
func (d *Dispatcher) matchesEventType(ep *WebhookEndpoint, eventType string) bool {
	if len(ep.Events) == 0 {
		return true // Subscribed to all events
	}
	for _, e := range ep.Events {
		if e == eventType || e == "*" {
			return true
		}
	}
	return false
}

// Stats returns dispatcher statistics
func (d *Dispatcher) Stats() map[string]uint64 {
	return map[string]uint64{
		"total_delivered": atomic.LoadUint64(&d.totalDelivered),
		"total_failed":    atomic.LoadUint64(&d.totalFailed),
		"total_retried":   atomic.LoadUint64(&d.totalRetried),
		"total_dlq":       atomic.LoadUint64(&d.totalDLQ),
	}
}

// Shutdown gracefully stops the dispatcher
func (d *Dispatcher) Shutdown() {
	d.cancel()
	d.wg.Wait()
}

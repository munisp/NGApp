package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

type WebhookEventType string

const (
	EventPaymentCreated    WebhookEventType = "payment.created"
	EventPaymentCompleted  WebhookEventType = "payment.completed"
	EventPaymentFailed     WebhookEventType = "payment.failed"
	EventSettlementCreated WebhookEventType = "settlement.created"
	EventSettlementDone    WebhookEventType = "settlement.completed"
	EventFraudDetected     WebhookEventType = "fraud.detected"
	EventDisputeCreated    WebhookEventType = "dispute.created"
	EventDisputeResolved   WebhookEventType = "dispute.resolved"
	EventRefundCreated     WebhookEventType = "refund.created"
	EventRefundCompleted   WebhookEventType = "refund.completed"
)

type DeliveryStatus string

const (
	DeliveryPending   DeliveryStatus = "PENDING"
	DeliverySuccess   DeliveryStatus = "SUCCESS"
	DeliveryFailed    DeliveryStatus = "FAILED"
	DeliveryRetrying  DeliveryStatus = "RETRYING"
	DeliveryAbandoned DeliveryStatus = "ABANDONED"
)

type WebhookEndpoint struct {
	ID           string
	URL          string
	Secret       string
	Events       []WebhookEventType
	Active       bool
	MerchantID   string
	CreatedAt    time.Time
	IPWhitelist  []string
	RetryPolicy  RetryPolicy
	RateLimit    int
}

type RetryPolicy struct {
	MaxRetries    int
	BackoffMs     []int
	TimeoutSec    int
}

type WebhookDelivery struct {
	ID          string
	EndpointID  string
	EventType   WebhookEventType
	Payload     string
	Status      DeliveryStatus
	StatusCode  int
	RetryCount  int
	CreatedAt   time.Time
	DeliveredAt time.Time
	NextRetryAt time.Time
	LastError   string
}

type WebhookService struct {
	mu         sync.RWMutex
	endpoints  []WebhookEndpoint
	deliveries []WebhookDelivery
	metrics    WebhookMetrics
}

type WebhookMetrics struct {
	TotalDeliveries     int64
	SuccessfulDeliveries int64
	FailedDeliveries    int64
	AverageLatencyMs    int64
	ActiveEndpoints     int
}

var DefaultRetryPolicy = RetryPolicy{
	MaxRetries: 5,
	BackoffMs:  []int{1000, 5000, 30000, 300000, 3600000},
	TimeoutSec: 30,
}

func NewWebhookService() *WebhookService {
	return &WebhookService{
		endpoints:  make([]WebhookEndpoint, 0),
		deliveries: make([]WebhookDelivery, 0),
	}
}

func (ws *WebhookService) RegisterEndpoint(endpoint WebhookEndpoint) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	endpoint.CreatedAt = time.Now()
	if endpoint.RetryPolicy.MaxRetries == 0 {
		endpoint.RetryPolicy = DefaultRetryPolicy
	}
	ws.endpoints = append(ws.endpoints, endpoint)
	ws.metrics.ActiveEndpoints = len(ws.endpoints)
}

func (ws *WebhookService) RemoveEndpoint(id string) bool {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	for i, ep := range ws.endpoints {
		if ep.ID == id {
			ws.endpoints = append(ws.endpoints[:i], ws.endpoints[i+1:]...)
			ws.metrics.ActiveEndpoints = len(ws.endpoints)
			return true
		}
	}
	return false
}

func (ws *WebhookService) QueueDelivery(eventType WebhookEventType, payload string) []string {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	var deliveryIDs []string
	for _, ep := range ws.endpoints {
		if !ep.Active {
			continue
		}
		subscribed := false
		for _, evt := range ep.Events {
			if evt == eventType {
				subscribed = true
				break
			}
		}
		if !subscribed {
			continue
		}

		delivery := WebhookDelivery{
			ID:         generateDeliveryID(),
			EndpointID: ep.ID,
			EventType:  eventType,
			Payload:    payload,
			Status:     DeliveryPending,
			CreatedAt:  time.Now(),
		}
		ws.deliveries = append(ws.deliveries, delivery)
		deliveryIDs = append(deliveryIDs, delivery.ID)
		ws.metrics.TotalDeliveries++
	}
	return deliveryIDs
}

func (ws *WebhookService) MarkDelivered(id string, statusCode int) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	for i, d := range ws.deliveries {
		if d.ID == id {
			ws.deliveries[i].Status = DeliverySuccess
			ws.deliveries[i].StatusCode = statusCode
			ws.deliveries[i].DeliveredAt = time.Now()
			ws.metrics.SuccessfulDeliveries++
			return
		}
	}
}

func (ws *WebhookService) MarkFailed(id string, err string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	for i, d := range ws.deliveries {
		if d.ID == id {
			ws.deliveries[i].RetryCount++
			ws.deliveries[i].LastError = err
			// Find max retries from endpoint
			maxRetries := DefaultRetryPolicy.MaxRetries
			for _, ep := range ws.endpoints {
				if ep.ID == d.EndpointID {
					maxRetries = ep.RetryPolicy.MaxRetries
					break
				}
			}
			if ws.deliveries[i].RetryCount >= maxRetries {
				ws.deliveries[i].Status = DeliveryAbandoned
				ws.metrics.FailedDeliveries++
			} else {
				ws.deliveries[i].Status = DeliveryRetrying
			}
			return
		}
	}
}

func (ws *WebhookService) GetMetrics() WebhookMetrics {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	return ws.metrics
}

func (ws *WebhookService) ListEndpoints() []WebhookEndpoint {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	result := make([]WebhookEndpoint, len(ws.endpoints))
	copy(result, ws.endpoints)
	return result
}

func SignPayload(payload string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

var deliveryCounter int64

func generateDeliveryID() string {
	deliveryCounter++
	return time.Now().Format("20060102") + "-" + hex.EncodeToString([]byte{byte(deliveryCounter)})
}

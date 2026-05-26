package enhancements

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// WebhookEventType categorizes webhook event types
type WebhookEventType string

const (
	EventTransferAdmitted    WebhookEventType = "transfer.admitted"
	EventTransferCompliance  WebhookEventType = "transfer.compliance"
	EventTransferRouted      WebhookEventType = "transfer.routed"
	EventTransferCompleted   WebhookEventType = "transfer.completed"
	EventTransferFailed      WebhookEventType = "transfer.failed"
	EventTransferSettled     WebhookEventType = "transfer.settled"
	EventFundingRequested    WebhookEventType = "funding.requested"
	EventFundingApproved     WebhookEventType = "funding.approved"
	EventDisputeCreated      WebhookEventType = "dispute.created"
	EventDisputeResolved     WebhookEventType = "dispute.resolved"
	EventComplianceEscalated WebhookEventType = "compliance.escalated"
	EventSLABreached         WebhookEventType = "sla.breached"
	EventTierUpgraded        WebhookEventType = "tier.upgraded"
)

// WebhookDeliveryStatus tracks delivery state
type WebhookDeliveryStatus string

const (
	DeliveryPending   WebhookDeliveryStatus = "pending"
	DeliverySuccess   WebhookDeliveryStatus = "success"
	DeliveryFailed    WebhookDeliveryStatus = "failed"
	DeliveryRetrying  WebhookDeliveryStatus = "retrying"
	DeliveryAbandoned WebhookDeliveryStatus = "abandoned"
)

// WebhookEvent represents a single event in the catalog
type WebhookEvent struct {
	ID            string               `json:"id"`
	ParticipantID int                  `json:"participantId"`
	Type          WebhookEventType     `json:"type"`
	Payload       map[string]interface{} `json:"payload"`
	CreatedAt     time.Time            `json:"createdAt"`
	Signature     string               `json:"signature"`
}

// WebhookDelivery tracks an individual delivery attempt
type WebhookDelivery struct {
	ID            string                `json:"id"`
	EventID       string                `json:"eventId"`
	ParticipantID int                   `json:"participantId"`
	Endpoint      string                `json:"endpoint"`
	Status        WebhookDeliveryStatus `json:"status"`
	AttemptCount  int                   `json:"attemptCount"`
	ResponseCode  int                   `json:"responseCode,omitempty"`
	ResponseBody  string                `json:"responseBody,omitempty"`
	NextRetryAt   *time.Time            `json:"nextRetryAt,omitempty"`
	CreatedAt     time.Time             `json:"createdAt"`
	LastAttemptAt *time.Time            `json:"lastAttemptAt,omitempty"`
	Error         string                `json:"error,omitempty"`
}

// WebhookEndpoint stores a participant's registered webhook URL
type WebhookEndpoint struct {
	ParticipantID int                `json:"participantId"`
	URL           string             `json:"url"`
	Secret        string             `json:"secret"` // HMAC signing key
	Events        []WebhookEventType `json:"events"` // subscribed event types
	Active        bool               `json:"active"`
	CreatedAt     time.Time          `json:"createdAt"`
}

// WebhookReplayService manages the event catalog and replay functionality
type WebhookReplayService struct {
	mu         sync.RWMutex
	events     []WebhookEvent
	deliveries []WebhookDelivery
	endpoints  map[int][]WebhookEndpoint // key: participantID
	maxRetries int
}

// NewWebhookReplayService creates a webhook replay service
func NewWebhookReplayService() *WebhookReplayService {
	return &WebhookReplayService{
		events:     make([]WebhookEvent, 0),
		deliveries: make([]WebhookDelivery, 0),
		endpoints:  make(map[int][]WebhookEndpoint),
		maxRetries: 5,
	}
}

// RegisterEndpoint registers a webhook endpoint for a participant
func (ws *WebhookReplayService) RegisterEndpoint(endpoint WebhookEndpoint) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	endpoint.CreatedAt = time.Now()
	ws.endpoints[endpoint.ParticipantID] = append(ws.endpoints[endpoint.ParticipantID], endpoint)
}

// EmitEvent creates a new webhook event and queues delivery
func (ws *WebhookReplayService) EmitEvent(ctx context.Context, participantID int, eventType WebhookEventType, payload map[string]interface{}) string {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	event := WebhookEvent{
		ID:            fmt.Sprintf("evt-%d-%d", participantID, time.Now().UnixNano()),
		ParticipantID: participantID,
		Type:          eventType,
		Payload:       payload,
		CreatedAt:     time.Now(),
	}

	// Sign the event
	endpoints := ws.endpoints[participantID]
	for _, ep := range endpoints {
		if ep.Active && ws.isSubscribed(ep, eventType) {
			event.Signature = ws.signPayload(payload, ep.Secret)

			delivery := WebhookDelivery{
				ID:            fmt.Sprintf("dlv-%s-%d", event.ID, time.Now().UnixNano()),
				EventID:       event.ID,
				ParticipantID: participantID,
				Endpoint:      ep.URL,
				Status:        DeliveryPending,
				AttemptCount:  0,
				CreatedAt:     time.Now(),
			}
			ws.deliveries = append(ws.deliveries, delivery)
		}
	}

	ws.events = append(ws.events, event)
	return event.ID
}

// ReplayEvent re-delivers a previously emitted event
func (ws *WebhookReplayService) ReplayEvent(ctx context.Context, eventID string) (*WebhookDelivery, error) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	// Find the original event
	var event *WebhookEvent
	for i := range ws.events {
		if ws.events[i].ID == eventID {
			event = &ws.events[i]
			break
		}
	}

	if event == nil {
		return nil, fmt.Errorf("event %s not found", eventID)
	}

	// Create new delivery
	endpoints := ws.endpoints[event.ParticipantID]
	if len(endpoints) == 0 {
		return nil, fmt.Errorf("no endpoints registered for participant %d", event.ParticipantID)
	}

	for _, ep := range endpoints {
		if ep.Active && ws.isSubscribed(ep, event.Type) {
			delivery := WebhookDelivery{
				ID:            fmt.Sprintf("replay-%s-%d", eventID, time.Now().UnixNano()),
				EventID:       eventID,
				ParticipantID: event.ParticipantID,
				Endpoint:      ep.URL,
				Status:        DeliveryPending,
				AttemptCount:  0,
				CreatedAt:     time.Now(),
			}
			ws.deliveries = append(ws.deliveries, delivery)
			return &delivery, nil
		}
	}

	return nil, fmt.Errorf("no active subscribed endpoint for event type %s", event.Type)
}

// GetEventCatalog returns all events for a participant with optional type filter
func (ws *WebhookReplayService) GetEventCatalog(participantID int, eventType *WebhookEventType, since *time.Time) []WebhookEvent {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	var result []WebhookEvent
	for _, e := range ws.events {
		if e.ParticipantID != participantID {
			continue
		}
		if eventType != nil && e.Type != *eventType {
			continue
		}
		if since != nil && e.CreatedAt.Before(*since) {
			continue
		}
		result = append(result, e)
	}
	return result
}

// GetDeliveries returns delivery history for a participant
func (ws *WebhookReplayService) GetDeliveries(participantID int, status *WebhookDeliveryStatus) []WebhookDelivery {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	var result []WebhookDelivery
	for _, d := range ws.deliveries {
		if d.ParticipantID != participantID {
			continue
		}
		if status != nil && d.Status != *status {
			continue
		}
		result = append(result, d)
	}
	return result
}

// GetFailedDeliveries returns deliveries that need replay
func (ws *WebhookReplayService) GetFailedDeliveries(participantID int) []WebhookDelivery {
	failed := DeliveryFailed
	return ws.GetDeliveries(participantID, &failed)
}

func (ws *WebhookReplayService) isSubscribed(endpoint WebhookEndpoint, eventType WebhookEventType) bool {
	if len(endpoint.Events) == 0 {
		return true // subscribed to all if no filter
	}
	for _, e := range endpoint.Events {
		if e == eventType {
			return true
		}
	}
	return false
}

func (ws *WebhookReplayService) signPayload(payload map[string]interface{}, secret string) string {
	// HMAC-SHA256 signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%v", payload)))
	return hex.EncodeToString(mac.Sum(nil))
}

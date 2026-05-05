package webhook

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// WebhookEvent types emitted by the platform
type EventType string

const (
	EventCustomerCreated       EventType = "customer.created"
	EventCustomerUpdated       EventType = "customer.updated"
	EventCustomerDeleted       EventType = "customer.deleted"
	EventTransactionCompleted  EventType = "transaction.completed"
	EventTransactionFailed     EventType = "transaction.failed"
	EventTransactionReversed   EventType = "transaction.reversed"
	EventAgentActivated        EventType = "agent.activated"
	EventAgentDeactivated      EventType = "agent.deactivated"
	EventTransferInitiated     EventType = "transfer.initiated"
	EventTransferCompleted     EventType = "transfer.completed"
	EventTransferFailed        EventType = "transfer.failed"
	EventCampaignSent          EventType = "campaign.sent"
	EventCampaignDelivered     EventType = "campaign.delivered"
	EventKYCApproved           EventType = "kyc.approved"
	EventKYCRejected           EventType = "kyc.rejected"
	EventQuotaWarning          EventType = "quota.warning"
	EventQuotaExceeded         EventType = "quota.exceeded"
)

// AllEventTypes returns all available webhook event types
func AllEventTypes() []EventType {
	return []EventType{
		EventCustomerCreated, EventCustomerUpdated, EventCustomerDeleted,
		EventTransactionCompleted, EventTransactionFailed, EventTransactionReversed,
		EventAgentActivated, EventAgentDeactivated,
		EventTransferInitiated, EventTransferCompleted, EventTransferFailed,
		EventCampaignSent, EventCampaignDelivered,
		EventKYCApproved, EventKYCRejected,
		EventQuotaWarning, EventQuotaExceeded,
	}
}

// WebhookSubscription represents a tenant's webhook endpoint subscription
type WebhookSubscription struct {
	ID          string      `json:"id"`
	TenantID    string      `json:"tenant_id"`
	URL         string      `json:"url"`
	Secret      string      `json:"secret"`
	SecretMasked string     `json:"secret_masked"`
	Events      []EventType `json:"events"`
	Status      string      `json:"status"`
	Version     string      `json:"version"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// WebhookDelivery records a delivery attempt
type WebhookDelivery struct {
	ID             string    `json:"id"`
	SubscriptionID string    `json:"subscription_id"`
	TenantID       string    `json:"tenant_id"`
	EventType      EventType `json:"event_type"`
	URL            string    `json:"url"`
	Payload        string    `json:"payload"`
	Signature      string    `json:"signature"`
	StatusCode     int       `json:"status_code"`
	ResponseBody   string    `json:"response_body,omitempty"`
	Attempt        int       `json:"attempt"`
	MaxAttempts    int       `json:"max_attempts"`
	Status         string    `json:"status"`
	DeliveredAt    time.Time `json:"delivered_at"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
}

// WebhookPayload is the standard webhook payload sent to subscribers
type WebhookPayload struct {
	ID        string      `json:"id"`
	Type      EventType   `json:"type"`
	TenantID  string      `json:"tenant_id"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
	Version   string      `json:"version"`
}

// WebhookService manages webhook subscriptions and deliveries
type WebhookService struct {
	subscriptions map[string]*WebhookSubscription
	deliveries    []WebhookDelivery
	mu            sync.RWMutex
}

// NewWebhookService creates a new webhook service with seed data
func NewWebhookService() *WebhookService {
	svc := &WebhookService{
		subscriptions: make(map[string]*WebhookSubscription),
	}
	svc.seed()
	return svc
}

func (s *WebhookService) seed() {
	now := time.Now()
	subs := []struct {
		id       string
		tenant   string
		url      string
		events   []EventType
		status   string
	}{
		{
			"whk-001", "tenant-acme-bank",
			"https://acme-bank.ng/webhooks/crm",
			[]EventType{EventCustomerCreated, EventCustomerUpdated, EventTransactionCompleted, EventTransactionFailed, EventKYCApproved, EventKYCRejected},
			"active",
		},
		{
			"whk-002", "tenant-acme-bank",
			"https://acme-bank.ng/webhooks/campaigns",
			[]EventType{EventCampaignSent, EventCampaignDelivered},
			"active",
		},
		{
			"whk-003", "tenant-quickcash",
			"https://api.quickcash.ng/webhook",
			[]EventType{EventAgentActivated, EventAgentDeactivated, EventTransactionCompleted},
			"active",
		},
		{
			"whk-004", "tenant-swiftremit",
			"https://swiftremit.com/api/hooks",
			[]EventType{EventTransferInitiated, EventTransferCompleted, EventTransferFailed, EventKYCApproved},
			"active",
		},
	}

	for _, sub := range subs {
		secret := generateSecret()
		s.subscriptions[sub.id] = &WebhookSubscription{
			ID:           sub.id,
			TenantID:     sub.tenant,
			URL:          sub.url,
			Secret:       secret,
			SecretMasked: secret[:8] + "..." + secret[len(secret)-4:],
			Events:       sub.events,
			Status:       sub.status,
			Version:      "2024-01-01",
			CreatedAt:    now.Add(-60 * 24 * time.Hour),
			UpdatedAt:    now,
		}
	}

	// Seed delivery history
	deliveryStatuses := []struct {
		code   int
		status string
	}{{200, "delivered"}, {200, "delivered"}, {200, "delivered"}, {200, "delivered"},
		{200, "delivered"}, {200, "delivered"}, {200, "delivered"}, {500, "failed"},
		{200, "delivered"}, {200, "delivered"}, {0, "pending"}, {200, "delivered"},
		{200, "delivered"}, {200, "delivered"}, {200, "delivered"}, {408, "retrying"}}

	events := []EventType{EventCustomerCreated, EventTransactionCompleted, EventKYCApproved, EventTransferCompleted}
	for i, ds := range deliveryStatuses {
		subID := subs[i%len(subs)].id
		sub := s.subscriptions[subID]
		evt := events[i%len(events)]
		payload := WebhookPayload{
			ID:        fmt.Sprintf("evt-%03d", i+1),
			Type:      evt,
			TenantID:  sub.TenantID,
			Timestamp: now.Add(-time.Duration(len(deliveryStatuses)-i) * time.Hour),
			Data:      map[string]string{"resource_id": fmt.Sprintf("res-%03d", i+1)},
			Version:   "2024-01-01",
		}
		payloadJSON, _ := json.Marshal(payload)
		sig := SignPayload(payloadJSON, sub.Secret)
		var nextRetry *time.Time
		if ds.status == "retrying" {
			t := now.Add(30 * time.Minute)
			nextRetry = &t
		}
		s.deliveries = append(s.deliveries, WebhookDelivery{
			ID:             fmt.Sprintf("dlv-%03d", i+1),
			SubscriptionID: subID,
			TenantID:       sub.TenantID,
			EventType:      evt,
			URL:            sub.URL,
			Payload:        string(payloadJSON),
			Signature:      sig,
			StatusCode:     ds.code,
			Attempt:        1,
			MaxAttempts:    5,
			Status:         ds.status,
			DeliveredAt:    now.Add(-time.Duration(len(deliveryStatuses)-i) * time.Hour),
			NextRetryAt:    nextRetry,
		})
	}
}

// SignPayload computes HMAC-SHA256 signature for a webhook payload
func SignPayload(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// VerifySignature verifies a webhook signature against the expected payload
func VerifySignature(payload []byte, signature, secret string) bool {
	expected := SignPayload(payload, secret)
	return hmac.Equal([]byte(expected), []byte(signature))
}

// CreateSubscription registers a new webhook subscription
func (s *WebhookService) CreateSubscription(tenantID, url string, events []EventType) (*WebhookSubscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	secret := generateSecret()
	idBytes := make([]byte, 4)
	rand.Read(idBytes)
	id := "whk-" + hex.EncodeToString(idBytes)

	sub := &WebhookSubscription{
		ID:           id,
		TenantID:     tenantID,
		URL:          url,
		Secret:       secret,
		SecretMasked: secret[:8] + "..." + secret[len(secret)-4:],
		Events:       events,
		Status:       "active",
		Version:      "2024-01-01",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	s.subscriptions[id] = sub
	return sub, nil
}

// ListSubscriptions returns all subscriptions for a tenant
func (s *WebhookService) ListSubscriptions(tenantID string) []*WebhookSubscription {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*WebhookSubscription
	for _, sub := range s.subscriptions {
		if tenantID == "" || sub.TenantID == tenantID {
			result = append(result, sub)
		}
	}
	return result
}

// ListDeliveries returns delivery history for a tenant
func (s *WebhookService) ListDeliveries(tenantID string, limit int) []WebhookDelivery {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []WebhookDelivery
	for i := len(s.deliveries) - 1; i >= 0; i-- {
		d := s.deliveries[i]
		if tenantID == "" || d.TenantID == tenantID {
			result = append(result, d)
			if len(result) >= limit {
				break
			}
		}
	}
	return result
}

// GetDeliveryStats returns delivery success/failure stats for a tenant
func (s *WebhookService) GetDeliveryStats(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total, delivered, failed, retrying, pending := 0, 0, 0, 0, 0
	for _, d := range s.deliveries {
		if tenantID != "" && d.TenantID != tenantID {
			continue
		}
		total++
		switch d.Status {
		case "delivered":
			delivered++
		case "failed":
			failed++
		case "retrying":
			retrying++
		case "pending":
			pending++
		}
	}
	successRate := float64(0)
	if total > 0 {
		successRate = float64(delivered) / float64(total) * 100
	}
	return map[string]interface{}{
		"total":        total,
		"delivered":    delivered,
		"failed":       failed,
		"retrying":     retrying,
		"pending":      pending,
		"success_rate": successRate,
	}
}

// RevokeSubscription disables a webhook subscription
func (s *WebhookService) RevokeSubscription(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sub, ok := s.subscriptions[id]
	if !ok {
		return fmt.Errorf("subscription not found: %s", id)
	}
	sub.Status = "revoked"
	sub.UpdatedAt = time.Now()
	return nil
}

// RotateSecret generates a new signing secret for a subscription
func (s *WebhookService) RotateSecret(id string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sub, ok := s.subscriptions[id]
	if !ok {
		return "", fmt.Errorf("subscription not found: %s", id)
	}
	newSecret := generateSecret()
	sub.Secret = newSecret
	sub.SecretMasked = newSecret[:8] + "..." + newSecret[len(newSecret)-4:]
	sub.UpdatedAt = time.Now()
	return newSecret, nil
}

func generateSecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "whsec_" + hex.EncodeToString(b)
}

// RegisterHTTPHandlers registers webhook API endpoints
func (s *WebhookService) RegisterHTTPHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/api/webhooks", s.handleWebhooks)
	mux.HandleFunc("/api/webhooks/deliveries", s.handleDeliveries)
	mux.HandleFunc("/api/webhooks/stats", s.handleStats)
	mux.HandleFunc("/api/webhooks/events", s.handleEventTypes)
	mux.HandleFunc("/api/webhooks/verify", s.handleVerify)
}

func (s *WebhookService) handleWebhooks(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	switch r.Method {
	case http.MethodGet:
		subs := s.ListSubscriptions(tenantID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(subs)
	case http.MethodPost:
		var req struct {
			URL    string      `json:"url"`
			Events []EventType `json:"events"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		sub, err := s.CreateSubscription(tenantID, req.URL, req.Events)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(sub)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *WebhookService) handleDeliveries(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	deliveries := s.ListDeliveries(tenantID, 50)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(deliveries)
}

func (s *WebhookService) handleStats(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	stats := s.GetDeliveryStats(tenantID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (s *WebhookService) handleEventTypes(w http.ResponseWriter, r *http.Request) {
	events := AllEventTypes()
	categories := map[string][]EventType{
		"Customer":    {EventCustomerCreated, EventCustomerUpdated, EventCustomerDeleted},
		"Transaction": {EventTransactionCompleted, EventTransactionFailed, EventTransactionReversed},
		"Agent":       {EventAgentActivated, EventAgentDeactivated},
		"Transfer":    {EventTransferInitiated, EventTransferCompleted, EventTransferFailed},
		"Campaign":    {EventCampaignSent, EventCampaignDelivered},
		"KYC":         {EventKYCApproved, EventKYCRejected},
		"Quota":       {EventQuotaWarning, EventQuotaExceeded},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"events":     events,
		"categories": categories,
		"total":      len(events),
	})
}

func (s *WebhookService) handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Payload   string `json:"payload"`
		Signature string `json:"signature"`
		Secret    string `json:"secret"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	valid := VerifySignature([]byte(req.Payload), req.Signature, req.Secret)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid":     valid,
		"algorithm": "HMAC-SHA256",
		"prefix":    "sha256=",
	})
}

// MiddlewareSignResponse is an HTTP middleware that signs outbound webhook responses
func MiddlewareSignResponse(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Generate event ID
			eventIDBytes := make([]byte, 16)
			rand.Read(eventIDBytes)
			eventID := hex.EncodeToString(eventIDBytes)
			timestamp := fmt.Sprintf("%d", time.Now().Unix())

			w.Header().Set("X-Webhook-ID", eventID)
			w.Header().Set("X-Webhook-Timestamp", timestamp)

			// Sign: timestamp.payload
			signContent := timestamp + "."
			signature := SignPayload([]byte(signContent), secret)
			w.Header().Set("X-Webhook-Signature", signature)

			next.ServeHTTP(w, r)
		})
	}
}

// FormatEventCategory returns a human-friendly category name from event type
func FormatEventCategory(et EventType) string {
	parts := strings.SplitN(string(et), ".", 2)
	if len(parts) > 0 {
		return parts[0]
	}
	return string(et)
}

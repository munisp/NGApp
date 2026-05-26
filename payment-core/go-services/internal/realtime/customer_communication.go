package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type NotificationType string

const (
	NotificationTypePaymentConfirmation NotificationType = "payment_confirmation"
	NotificationTypePaymentFailed       NotificationType = "payment_failed"
	NotificationTypeRefundProcessed     NotificationType = "refund_processed"
	NotificationTypeTransactionUpdate   NotificationType = "transaction_update"
	NotificationTypeSecurityAlert       NotificationType = "security_alert"
	NotificationTypePromotion           NotificationType = "promotion"
	NotificationTypeReminder            NotificationType = "reminder"
	NotificationTypeDispute             NotificationType = "dispute_update"
)

type DeliveryChannel string

const (
	ChannelWebSocket DeliveryChannel = "websocket"
	ChannelPush      DeliveryChannel = "push"
	ChannelSMS       DeliveryChannel = "sms"
	ChannelEmail     DeliveryChannel = "email"
	ChannelInApp     DeliveryChannel = "in_app"
)

type DeliveryStatus string

const (
	DeliveryStatusPending   DeliveryStatus = "pending"
	DeliveryStatusSent      DeliveryStatus = "sent"
	DeliveryStatusDelivered DeliveryStatus = "delivered"
	DeliveryStatusRead      DeliveryStatus = "read"
	DeliveryStatusFailed    DeliveryStatus = "failed"
	DeliveryStatusRetrying  DeliveryStatus = "retrying"
)

type Priority string

const (
	PriorityLow      Priority = "low"
	PriorityNormal   Priority = "normal"
	PriorityHigh     Priority = "high"
	PriorityCritical Priority = "critical"
)

type Notification struct {
	ID         string                 `json:"id"`
	CustomerID string                 `json:"customer_id"`
	Type       NotificationType       `json:"type"`
	Title      string                 `json:"title"`
	Body       string                 `json:"body"`
	Data       map[string]interface{} `json:"data,omitempty"`
	Priority   Priority               `json:"priority"`
	Channels   []DeliveryChannel      `json:"channels"`
	CreatedAt  time.Time              `json:"created_at"`
	ExpiresAt  *time.Time             `json:"expires_at,omitempty"`
	Metadata   map[string]string      `json:"metadata,omitempty"`
}

type DeliveryAttempt struct {
	ID             string            `json:"id"`
	NotificationID string            `json:"notification_id"`
	Channel        DeliveryChannel   `json:"channel"`
	Status         DeliveryStatus    `json:"status"`
	AttemptNumber  int               `json:"attempt_number"`
	SentAt         *time.Time        `json:"sent_at,omitempty"`
	DeliveredAt    *time.Time        `json:"delivered_at,omitempty"`
	ReadAt         *time.Time        `json:"read_at,omitempty"`
	Error          string            `json:"error,omitempty"`
	ProviderID     string            `json:"provider_id,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

type CustomerPreferences struct {
	CustomerID      string                                 `json:"customer_id"`
	EnabledChannels []DeliveryChannel                      `json:"enabled_channels"`
	QuietHoursStart int                                    `json:"quiet_hours_start"`
	QuietHoursEnd   int                                    `json:"quiet_hours_end"`
	Timezone        string                                 `json:"timezone"`
	TypePreferences map[NotificationType][]DeliveryChannel `json:"type_preferences"`
	PushToken       string                                 `json:"push_token,omitempty"`
	DeviceID        string                                 `json:"device_id,omitempty"`
	UpdatedAt       time.Time                              `json:"updated_at"`
}

type WebSocketConnection struct {
	ID          string      `json:"id"`
	CustomerID  string      `json:"customer_id"`
	DeviceID    string      `json:"device_id"`
	ConnectedAt time.Time   `json:"connected_at"`
	LastPingAt  time.Time   `json:"last_ping_at"`
	IsActive    bool        `json:"is_active"`
	MessageChan chan []byte `json:"-"`
}

type WebSocketMessage struct {
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
}

type CustomerCommunicationService struct {
	mu               sync.RWMutex
	notifications    map[string]*Notification
	deliveryAttempts map[string][]*DeliveryAttempt
	preferences      map[string]*CustomerPreferences
	wsConnections    map[string]*WebSocketConnection
	customerConns    map[string][]string
	eventHandlers    map[string][]func(interface{})
	retryConfig      RetryConfig
}

type RetryConfig struct {
	MaxAttempts       int
	InitialDelayMs    int
	MaxDelayMs        int
	BackoffMultiplier float64
}

func NewCustomerCommunicationService() *CustomerCommunicationService {
	return &CustomerCommunicationService{
		notifications:    make(map[string]*Notification),
		deliveryAttempts: make(map[string][]*DeliveryAttempt),
		preferences:      make(map[string]*CustomerPreferences),
		wsConnections:    make(map[string]*WebSocketConnection),
		customerConns:    make(map[string][]string),
		eventHandlers:    make(map[string][]func(interface{})),
		retryConfig: RetryConfig{
			MaxAttempts:       3,
			InitialDelayMs:    1000,
			MaxDelayMs:        30000,
			BackoffMultiplier: 2.0,
		},
	}
}

func (ccs *CustomerCommunicationService) On(event string, handler func(interface{})) {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()
	ccs.eventHandlers[event] = append(ccs.eventHandlers[event], handler)
}

func (ccs *CustomerCommunicationService) emit(event string, data interface{}) {
	ccs.mu.RLock()
	handlers := ccs.eventHandlers[event]
	ccs.mu.RUnlock()

	for _, handler := range handlers {
		go handler(data)
	}
}

type SendNotificationParams struct {
	CustomerID string
	Type       NotificationType
	Title      string
	Body       string
	Data       map[string]interface{}
	Priority   Priority
	Channels   []DeliveryChannel
	ExpiresIn  time.Duration
	Metadata   map[string]string
}

func (ccs *CustomerCommunicationService) SendNotification(ctx context.Context, params SendNotificationParams) (*Notification, error) {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	channels := params.Channels
	if len(channels) == 0 {
		channels = ccs.getPreferredChannels(params.CustomerID, params.Type)
	}

	if len(channels) == 0 {
		channels = []DeliveryChannel{ChannelInApp}
	}

	var expiresAt *time.Time
	if params.ExpiresIn > 0 {
		t := time.Now().Add(params.ExpiresIn)
		expiresAt = &t
	}

	notification := &Notification{
		ID:         uuid.New().String(),
		CustomerID: params.CustomerID,
		Type:       params.Type,
		Title:      params.Title,
		Body:       params.Body,
		Data:       params.Data,
		Priority:   params.Priority,
		Channels:   channels,
		CreatedAt:  time.Now(),
		ExpiresAt:  expiresAt,
		Metadata:   params.Metadata,
	}

	ccs.notifications[notification.ID] = notification
	ccs.deliveryAttempts[notification.ID] = make([]*DeliveryAttempt, 0)

	for _, channel := range channels {
		go ccs.deliverToChannel(ctx, notification, channel)
	}

	ccs.emit("notificationCreated", notification)
	return notification, nil
}

func (ccs *CustomerCommunicationService) getPreferredChannels(customerID string, notificationType NotificationType) []DeliveryChannel {
	prefs, ok := ccs.preferences[customerID]
	if !ok {
		return []DeliveryChannel{ChannelInApp, ChannelPush}
	}

	if channels, ok := prefs.TypePreferences[notificationType]; ok {
		return channels
	}

	return prefs.EnabledChannels
}

func (ccs *CustomerCommunicationService) deliverToChannel(ctx context.Context, notification *Notification, channel DeliveryChannel) {
	attempt := &DeliveryAttempt{
		ID:             uuid.New().String(),
		NotificationID: notification.ID,
		Channel:        channel,
		Status:         DeliveryStatusPending,
		AttemptNumber:  1,
	}

	ccs.mu.Lock()
	ccs.deliveryAttempts[notification.ID] = append(ccs.deliveryAttempts[notification.ID], attempt)
	ccs.mu.Unlock()

	var err error
	switch channel {
	case ChannelWebSocket:
		err = ccs.deliverViaWebSocket(notification)
	case ChannelPush:
		err = ccs.deliverViaPush(notification)
	case ChannelSMS:
		err = ccs.deliverViaSMS(notification)
	case ChannelEmail:
		err = ccs.deliverViaEmail(notification)
	case ChannelInApp:
		err = ccs.deliverViaInApp(notification)
	default:
		err = errors.New("unsupported channel")
	}

	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	now := time.Now()
	if err != nil {
		attempt.Status = DeliveryStatusFailed
		attempt.Error = err.Error()
		ccs.emit("deliveryFailed", attempt)
	} else {
		attempt.Status = DeliveryStatusSent
		attempt.SentAt = &now
		ccs.emit("deliverySent", attempt)
	}
}

func (ccs *CustomerCommunicationService) deliverViaWebSocket(notification *Notification) error {
	ccs.mu.RLock()
	connIDs, ok := ccs.customerConns[notification.CustomerID]
	ccs.mu.RUnlock()

	if !ok || len(connIDs) == 0 {
		return errors.New("no active websocket connections")
	}

	message := WebSocketMessage{
		Type: "notification",
		Payload: map[string]interface{}{
			"id":       notification.ID,
			"type":     notification.Type,
			"title":    notification.Title,
			"body":     notification.Body,
			"data":     notification.Data,
			"priority": notification.Priority,
		},
		Timestamp: time.Now(),
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		return err
	}

	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	for _, connID := range connIDs {
		if conn, ok := ccs.wsConnections[connID]; ok && conn.IsActive {
			select {
			case conn.MessageChan <- msgBytes:
			default:
			}
		}
	}

	return nil
}

func (ccs *CustomerCommunicationService) deliverViaPush(notification *Notification) error {
	ccs.mu.RLock()
	prefs, ok := ccs.preferences[notification.CustomerID]
	ccs.mu.RUnlock()

	if !ok || prefs.PushToken == "" {
		return errors.New("no push token registered")
	}

	return nil
}

func (ccs *CustomerCommunicationService) deliverViaSMS(notification *Notification) error {
	return nil
}

func (ccs *CustomerCommunicationService) deliverViaEmail(notification *Notification) error {
	return nil
}

func (ccs *CustomerCommunicationService) deliverViaInApp(notification *Notification) error {
	return nil
}

func (ccs *CustomerCommunicationService) RegisterWebSocketConnection(customerID, deviceID string, messageChan chan []byte) (*WebSocketConnection, error) {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	conn := &WebSocketConnection{
		ID:          uuid.New().String(),
		CustomerID:  customerID,
		DeviceID:    deviceID,
		ConnectedAt: time.Now(),
		LastPingAt:  time.Now(),
		IsActive:    true,
		MessageChan: messageChan,
	}

	ccs.wsConnections[conn.ID] = conn

	if _, ok := ccs.customerConns[customerID]; !ok {
		ccs.customerConns[customerID] = make([]string, 0)
	}
	ccs.customerConns[customerID] = append(ccs.customerConns[customerID], conn.ID)

	ccs.emit("connectionRegistered", conn)
	return conn, nil
}

func (ccs *CustomerCommunicationService) UnregisterWebSocketConnection(connectionID string) error {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	conn, ok := ccs.wsConnections[connectionID]
	if !ok {
		return errors.New("connection not found")
	}

	conn.IsActive = false
	delete(ccs.wsConnections, connectionID)

	if connIDs, ok := ccs.customerConns[conn.CustomerID]; ok {
		newConnIDs := make([]string, 0)
		for _, id := range connIDs {
			if id != connectionID {
				newConnIDs = append(newConnIDs, id)
			}
		}
		ccs.customerConns[conn.CustomerID] = newConnIDs
	}

	ccs.emit("connectionUnregistered", conn)
	return nil
}

func (ccs *CustomerCommunicationService) UpdateConnectionPing(connectionID string) error {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	conn, ok := ccs.wsConnections[connectionID]
	if !ok {
		return errors.New("connection not found")
	}

	conn.LastPingAt = time.Now()
	return nil
}

func (ccs *CustomerCommunicationService) BroadcastToCustomer(customerID string, message WebSocketMessage) error {
	ccs.mu.RLock()
	connIDs, ok := ccs.customerConns[customerID]
	ccs.mu.RUnlock()

	if !ok || len(connIDs) == 0 {
		return errors.New("no active connections for customer")
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		return err
	}

	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	for _, connID := range connIDs {
		if conn, ok := ccs.wsConnections[connID]; ok && conn.IsActive {
			select {
			case conn.MessageChan <- msgBytes:
			default:
			}
		}
	}

	return nil
}

func (ccs *CustomerCommunicationService) SendTransactionUpdate(ctx context.Context, customerID, transactionID, status, message string) error {
	_, err := ccs.SendNotification(ctx, SendNotificationParams{
		CustomerID: customerID,
		Type:       NotificationTypeTransactionUpdate,
		Title:      "Transaction Update",
		Body:       message,
		Data: map[string]interface{}{
			"transaction_id": transactionID,
			"status":         status,
		},
		Priority: PriorityHigh,
		Channels: []DeliveryChannel{ChannelWebSocket, ChannelPush},
	})
	return err
}

func (ccs *CustomerCommunicationService) SendPaymentConfirmation(ctx context.Context, customerID, transactionID string, amount float64, currency string) error {
	_, err := ccs.SendNotification(ctx, SendNotificationParams{
		CustomerID: customerID,
		Type:       NotificationTypePaymentConfirmation,
		Title:      "Payment Successful",
		Body:       fmt.Sprintf("Your payment of %.2f %s has been processed successfully.", amount, currency),
		Data: map[string]interface{}{
			"transaction_id": transactionID,
			"amount":         amount,
			"currency":       currency,
		},
		Priority: PriorityHigh,
		Channels: []DeliveryChannel{ChannelWebSocket, ChannelPush, ChannelSMS},
	})
	return err
}

func (ccs *CustomerCommunicationService) SendPaymentFailure(ctx context.Context, customerID, transactionID, reason string) error {
	_, err := ccs.SendNotification(ctx, SendNotificationParams{
		CustomerID: customerID,
		Type:       NotificationTypePaymentFailed,
		Title:      "Payment Failed",
		Body:       fmt.Sprintf("Your payment could not be processed: %s", reason),
		Data: map[string]interface{}{
			"transaction_id": transactionID,
			"reason":         reason,
		},
		Priority: PriorityCritical,
		Channels: []DeliveryChannel{ChannelWebSocket, ChannelPush, ChannelEmail},
	})
	return err
}

func (ccs *CustomerCommunicationService) SetCustomerPreferences(prefs *CustomerPreferences) error {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	prefs.UpdatedAt = time.Now()
	ccs.preferences[prefs.CustomerID] = prefs
	ccs.emit("preferencesUpdated", prefs)
	return nil
}

func (ccs *CustomerCommunicationService) GetCustomerPreferences(customerID string) (*CustomerPreferences, error) {
	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	prefs, ok := ccs.preferences[customerID]
	if !ok {
		return &CustomerPreferences{
			CustomerID:      customerID,
			EnabledChannels: []DeliveryChannel{ChannelInApp, ChannelPush, ChannelEmail},
			QuietHoursStart: 22,
			QuietHoursEnd:   7,
			Timezone:        "Africa/Lagos",
			TypePreferences: make(map[NotificationType][]DeliveryChannel),
			UpdatedAt:       time.Now(),
		}, nil
	}
	return prefs, nil
}

func (ccs *CustomerCommunicationService) RegisterPushToken(customerID, deviceID, pushToken string) error {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	prefs, ok := ccs.preferences[customerID]
	if !ok {
		prefs = &CustomerPreferences{
			CustomerID:      customerID,
			EnabledChannels: []DeliveryChannel{ChannelInApp, ChannelPush},
			TypePreferences: make(map[NotificationType][]DeliveryChannel),
		}
		ccs.preferences[customerID] = prefs
	}

	prefs.PushToken = pushToken
	prefs.DeviceID = deviceID
	prefs.UpdatedAt = time.Now()

	ccs.emit("pushTokenRegistered", map[string]string{
		"customer_id": customerID,
		"device_id":   deviceID,
	})

	return nil
}

func (ccs *CustomerCommunicationService) GetNotification(notificationID string) (*Notification, error) {
	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	notification, ok := ccs.notifications[notificationID]
	if !ok {
		return nil, errors.New("notification not found")
	}
	return notification, nil
}

func (ccs *CustomerCommunicationService) GetCustomerNotifications(customerID string, limit int) []*Notification {
	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	notifications := make([]*Notification, 0)
	for _, n := range ccs.notifications {
		if n.CustomerID == customerID {
			notifications = append(notifications, n)
		}
	}

	if limit > 0 && len(notifications) > limit {
		notifications = notifications[len(notifications)-limit:]
	}

	return notifications
}

func (ccs *CustomerCommunicationService) GetDeliveryAttempts(notificationID string) []*DeliveryAttempt {
	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	return ccs.deliveryAttempts[notificationID]
}

func (ccs *CustomerCommunicationService) MarkAsRead(notificationID string) error {
	ccs.mu.Lock()
	defer ccs.mu.Unlock()

	attempts, ok := ccs.deliveryAttempts[notificationID]
	if !ok {
		return errors.New("notification not found")
	}

	now := time.Now()
	for _, attempt := range attempts {
		if attempt.Status == DeliveryStatusDelivered || attempt.Status == DeliveryStatusSent {
			attempt.Status = DeliveryStatusRead
			attempt.ReadAt = &now
		}
	}

	ccs.emit("notificationRead", notificationID)
	return nil
}

type CommunicationStats struct {
	TotalNotifications  int            `json:"total_notifications"`
	ByType              map[string]int `json:"by_type"`
	ByChannel           map[string]int `json:"by_channel"`
	ByStatus            map[string]int `json:"by_status"`
	ActiveConnections   int            `json:"active_connections"`
	UniqueCustomers     int            `json:"unique_customers"`
	DeliverySuccessRate float64        `json:"delivery_success_rate"`
}

func (ccs *CustomerCommunicationService) GetStats() *CommunicationStats {
	ccs.mu.RLock()
	defer ccs.mu.RUnlock()

	stats := &CommunicationStats{
		TotalNotifications: len(ccs.notifications),
		ByType:             make(map[string]int),
		ByChannel:          make(map[string]int),
		ByStatus:           make(map[string]int),
	}

	for _, n := range ccs.notifications {
		stats.ByType[string(n.Type)]++
	}

	totalAttempts := 0
	successfulAttempts := 0

	for _, attempts := range ccs.deliveryAttempts {
		for _, a := range attempts {
			stats.ByChannel[string(a.Channel)]++
			stats.ByStatus[string(a.Status)]++
			totalAttempts++
			if a.Status == DeliveryStatusSent || a.Status == DeliveryStatusDelivered || a.Status == DeliveryStatusRead {
				successfulAttempts++
			}
		}
	}

	if totalAttempts > 0 {
		stats.DeliverySuccessRate = float64(successfulAttempts) / float64(totalAttempts) * 100
	}

	for _, conn := range ccs.wsConnections {
		if conn.IsActive {
			stats.ActiveConnections++
		}
	}

	stats.UniqueCustomers = len(ccs.customerConns)

	return stats
}

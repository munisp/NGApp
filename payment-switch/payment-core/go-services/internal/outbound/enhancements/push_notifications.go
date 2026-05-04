package enhancements

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// NotificationType categorizes notifications for filtering and routing
type NotificationType string

const (
	NotifyLowBalance         NotificationType = "low_balance"
	NotifyTransferComplete   NotificationType = "transfer_complete"
	NotifyTransferFailed     NotificationType = "transfer_failed"
	NotifyComplianceHold     NotificationType = "compliance_hold"
	NotifySanctionsEscalated NotificationType = "sanctions_escalated"
	NotifyFundingApproved    NotificationType = "funding_approved"
	NotifyTierUpgraded       NotificationType = "tier_upgraded"
	NotifySLABreach          NotificationType = "sla_breach"
	NotifyApprovalRequired   NotificationType = "approval_required"
	NotifySystemMaintenance  NotificationType = "system_maintenance"
)

// NotificationPriority determines delivery urgency
type NotificationPriority string

const (
	PriorityUrgent NotificationPriority = "urgent"
	PriorityHigh   NotificationPriority = "high"
	PriorityNormal NotificationPriority = "normal"
	PriorityLow    NotificationPriority = "low"
)

// NotificationChannel specifies delivery mechanism
type NotificationChannel string

const (
	ChannelPush    NotificationChannel = "push"      // FCM/APNs
	ChannelEmail   NotificationChannel = "email"     // SMTP
	ChannelSMS     NotificationChannel = "sms"       // SMS gateway
	ChannelWebhook NotificationChannel = "webhook"   // HTTP callback
	ChannelInApp   NotificationChannel = "in_app"    // WebSocket
)

// Notification represents a single notification to be delivered
type Notification struct {
	ID            string               `json:"id"`
	ParticipantID int                  `json:"participantId"`
	Type          NotificationType     `json:"type"`
	Priority      NotificationPriority `json:"priority"`
	Title         string               `json:"title"`
	Body          string               `json:"body"`
	Data          map[string]string    `json:"data,omitempty"`
	Channels      []NotificationChannel `json:"channels"`
	CreatedAt     time.Time            `json:"createdAt"`
	DeliveredAt   *time.Time           `json:"deliveredAt,omitempty"`
	ReadAt        *time.Time           `json:"readAt,omitempty"`
}

// NotificationPreferences stores participant notification settings
type NotificationPreferences struct {
	ParticipantID      int                          `json:"participantId"`
	EnabledChannels    []NotificationChannel        `json:"enabledChannels"`
	LowBalanceThreshold float64                    `json:"lowBalanceThreshold"`
	QuietHoursStart    string                       `json:"quietHoursStart"` // "22:00"
	QuietHoursEnd      string                       `json:"quietHoursEnd"`   // "07:00"
	TypePreferences    map[NotificationType]bool    `json:"typePreferences"`
}

// NotificationService handles notification creation and delivery
type NotificationService struct {
	mu            sync.RWMutex
	notifications []Notification
	preferences   map[int]NotificationPreferences // key: participantID
	handlers      map[NotificationChannel]DeliveryHandler
}

// DeliveryHandler interface for channel-specific delivery
type DeliveryHandler interface {
	Deliver(ctx context.Context, notification Notification) error
	IsAvailable() bool
}

// NewNotificationService creates a notification service
func NewNotificationService() *NotificationService {
	return &NotificationService{
		notifications: make([]Notification, 0),
		preferences:   make(map[int]NotificationPreferences),
		handlers:      make(map[NotificationChannel]DeliveryHandler),
	}
}

// RegisterHandler registers a delivery handler for a channel
func (ns *NotificationService) RegisterHandler(channel NotificationChannel, handler DeliveryHandler) {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	ns.handlers[channel] = handler
}

// Send creates and delivers a notification
func (ns *NotificationService) Send(ctx context.Context, participantID int, notifType NotificationType, title, body string, data map[string]string) error {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	// Check preferences
	prefs, hasPrefs := ns.preferences[participantID]
	if hasPrefs {
		if enabled, ok := prefs.TypePreferences[notifType]; ok && !enabled {
			return nil // Notification type disabled by participant
		}
	}

	// Determine channels
	channels := []NotificationChannel{ChannelInApp} // Always in-app
	if hasPrefs {
		channels = prefs.EnabledChannels
	}

	// Determine priority based on type
	priority := PriorityNormal
	switch notifType {
	case NotifyComplianceHold, NotifySanctionsEscalated, NotifySLABreach:
		priority = PriorityUrgent
	case NotifyTransferFailed, NotifyLowBalance:
		priority = PriorityHigh
	case NotifyTransferComplete, NotifyFundingApproved:
		priority = PriorityNormal
	case NotifySystemMaintenance:
		priority = PriorityLow
	}

	notif := Notification{
		ID:            fmt.Sprintf("notif-%d-%d", participantID, time.Now().UnixNano()),
		ParticipantID: participantID,
		Type:          notifType,
		Priority:      priority,
		Title:         title,
		Body:          body,
		Data:          data,
		Channels:      channels,
		CreatedAt:     time.Now(),
	}

	ns.notifications = append(ns.notifications, notif)

	// Deliver to each channel (non-blocking)
	for _, ch := range channels {
		if handler, ok := ns.handlers[ch]; ok && handler.IsAvailable() {
			go func(h DeliveryHandler, n Notification) {
				_ = h.Deliver(ctx, n)
			}(handler, notif)
		}
	}

	return nil
}

// GetUnread returns unread notifications for a participant
func (ns *NotificationService) GetUnread(participantID int) []Notification {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	var unread []Notification
	for _, n := range ns.notifications {
		if n.ParticipantID == participantID && n.ReadAt == nil {
			unread = append(unread, n)
		}
	}
	return unread
}

// MarkRead marks a notification as read
func (ns *NotificationService) MarkRead(notifID string) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	now := time.Now()
	for i := range ns.notifications {
		if ns.notifications[i].ID == notifID {
			ns.notifications[i].ReadAt = &now
			break
		}
	}
}

// SetPreferences updates notification preferences for a participant
func (ns *NotificationService) SetPreferences(prefs NotificationPreferences) {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	ns.preferences[prefs.ParticipantID] = prefs
}

// LowBalanceAlert sends a low balance notification
func (ns *NotificationService) LowBalanceAlert(ctx context.Context, participantID int, balance, threshold float64, currency string) error {
	return ns.Send(ctx, participantID, NotifyLowBalance,
		"Low Prefund Balance Alert",
		fmt.Sprintf("Your prefund balance (%s %.2f) has fallen below threshold (%s %.2f). Top up immediately to avoid transfer failures.", currency, balance, currency, threshold),
		map[string]string{
			"balance":   fmt.Sprintf("%.2f", balance),
			"threshold": fmt.Sprintf("%.2f", threshold),
			"currency":  currency,
		},
	)
}

// TransferCompleteAlert notifies on successful transfer
func (ns *NotificationService) TransferCompleteAlert(ctx context.Context, participantID int, transferRef, corridor, amount string) error {
	return ns.Send(ctx, participantID, NotifyTransferComplete,
		"Transfer Completed",
		fmt.Sprintf("Transfer %s to %s for %s has been settled successfully.", transferRef, corridor, amount),
		map[string]string{
			"transferRef": transferRef,
			"corridor":    corridor,
			"amount":      amount,
		},
	)
}

// ComplianceHoldAlert notifies on compliance holds
func (ns *NotificationService) ComplianceHoldAlert(ctx context.Context, participantID int, transferRef, reason string) error {
	return ns.Send(ctx, participantID, NotifyComplianceHold,
		"Transfer Held for Compliance Review",
		fmt.Sprintf("Transfer %s has been held for compliance review: %s", transferRef, reason),
		map[string]string{
			"transferRef": transferRef,
			"reason":      reason,
		},
	)
}

package repository

import (
	"fmt"
	"notification-service/internal/models"
	"sync"
	"time"
)

type NotificationRepository struct {
	mu            sync.RWMutex
	notifications map[string]*models.Notification
	templates     map[string]models.NotificationTemplate
	preferences   map[string]*models.NotificationPreference
}

func NewNotificationRepository() *NotificationRepository {
	repo := &NotificationRepository{
		notifications: make(map[string]*models.Notification),
		templates:     make(map[string]models.NotificationTemplate),
		preferences:   make(map[string]*models.NotificationPreference),
	}
	repo.seedTemplates()
	return repo
}

func (r *NotificationRepository) seedTemplates() {
	templates := []models.NotificationTemplate{
		{ID: "TPL-001", Name: "premium_due", Type: "sms", Subject: "", Body: "Dear {{name}}, your {{product}} premium of {{currency}}{{amount}} is due on {{date}}. Pay via USSD *384*insurance# or visit our app.", Language: "en", Category: "billing"},
		{ID: "TPL-002", Name: "claim_approved", Type: "sms", Subject: "", Body: "Good news {{name}}! Your claim {{claim_id}} for {{currency}}{{amount}} has been approved. Payout within 24 hours.", Language: "en", Category: "claims"},
		{ID: "TPL-003", Name: "policy_expiry", Type: "email", Subject: "Policy Renewal Reminder", Body: "Dear {{name}}, your {{product}} policy expires on {{date}}. Renew now to maintain coverage.", Language: "en", Category: "renewal"},
		{ID: "TPL-004", Name: "welcome", Type: "whatsapp", Subject: "", Body: "Welcome to NGInsure, {{name}}! 🎉 Your {{product}} policy is now active. Policy ID: {{policy_id}}", Language: "en", Category: "onboarding"},
		{ID: "TPL-005", Name: "payment_received", Type: "sms", Subject: "", Body: "Payment of {{currency}}{{amount}} received for policy {{policy_id}}. Thank you {{name}}!", Language: "en", Category: "billing"},
		{ID: "TPL-006", Name: "premium_due_yo", Type: "sms", Subject: "", Body: "Ẹ kú ilẹ̀ {{name}}, owó iṣeduro {{product}} ti {{currency}}{{amount}} ti tó lati san ni {{date}}.", Language: "yo", Category: "billing"},
		{ID: "TPL-007", Name: "premium_due_ha", Type: "sms", Subject: "", Body: "Barka da yamma {{name}}, kudin inshorar {{product}} na {{currency}}{{amount}} ya kamata a biya a {{date}}.", Language: "ha", Category: "billing"},
	}
	for _, t := range templates {
		r.templates[t.ID] = t
	}
}

func (r *NotificationRepository) Create(n *models.Notification) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.notifications[n.ID] = n
	return nil
}

func (r *NotificationRepository) GetByID(id string) (*models.Notification, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n, ok := r.notifications[id]
	if !ok { return nil, fmt.Errorf("notification %s not found", id) }
	return n, nil
}

func (r *NotificationRepository) UpdateStatus(id, status string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if n, ok := r.notifications[id]; ok {
		n.Status = status
		if status == "sent" { now := time.Now(); n.SentAt = &now }
		if status == "read" { now := time.Now(); n.ReadAt = &now }
	}
}

func (r *NotificationRepository) List(recipientID, status string, limit int) []models.Notification {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Notification
	for _, n := range r.notifications {
		if recipientID != "" && n.RecipientID != recipientID { continue }
		if status != "" && n.Status != status { continue }
		result = append(result, *n)
		if limit > 0 && len(result) >= limit { break }
	}
	return result
}

func (r *NotificationRepository) GetTemplates(category string) []models.NotificationTemplate {
	var result []models.NotificationTemplate
	for _, t := range r.templates {
		if category == "" || t.Category == category {
			result = append(result, t)
		}
	}
	return result
}

func (r *NotificationRepository) GetPreference(id string) *models.NotificationPreference {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.preferences[id]; ok { return p }
	return &models.NotificationPreference{RecipientID: id, SMS: true, Email: true, Push: true, WhatsApp: true, InApp: true}
}

func (r *NotificationRepository) SetPreference(p *models.NotificationPreference) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.preferences[p.RecipientID] = p
}

func (r *NotificationRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	total := len(r.notifications)
	sent, failed, read := 0, 0, 0
	byType := map[string]int{}
	for _, n := range r.notifications {
		byType[string(n.Type)]++
		switch n.Status {
		case "sent": sent++
		case "failed": failed++
		case "read": read++
		}
	}
	return map[string]interface{}{
		"total": total, "sent": sent, "failed": failed, "read": read,
		"by_type": byType, "delivery_rate": float64(sent) / float64(total+1) * 100,
	}
}

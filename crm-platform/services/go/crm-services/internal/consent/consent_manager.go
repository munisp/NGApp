package consent

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// Channel represents a communication channel
type Channel string

const (
	ChannelSMS      Channel = "sms"
	ChannelWhatsApp Channel = "whatsapp"
	ChannelTelegram Channel = "telegram"
	ChannelVoice    Channel = "voice"
	ChannelEmail    Channel = "email"
	ChannelUSSD     Channel = "ussd"
)

// ConsentStatus represents the consent state for a channel
type ConsentStatus string

const (
	ConsentOptedIn  ConsentStatus = "opted_in"
	ConsentOptedOut ConsentStatus = "opted_out"
	ConsentPending  ConsentStatus = "pending"
)

// ConsentRecord represents a customer's consent for a specific channel
type ConsentRecord struct {
	CustomerID string        `json:"customer_id"`
	Channel    Channel       `json:"channel"`
	Status     ConsentStatus `json:"status"`
	Method     string        `json:"method"`
	UpdatedAt  time.Time     `json:"updated_at"`
	IPAddress  string        `json:"ip_address,omitempty"`
}

// ConsentEvent records a consent change for audit trail
type ConsentEvent struct {
	ID          string        `json:"id"`
	CustomerID  string        `json:"customer_id"`
	CustomerName string       `json:"customer_name"`
	Channel     Channel       `json:"channel"`
	OldStatus   ConsentStatus `json:"old_status"`
	NewStatus   ConsentStatus `json:"new_status"`
	Method      string        `json:"method"`
	Timestamp   time.Time     `json:"timestamp"`
}

// ComplianceCheck represents a regulatory compliance check
type ComplianceCheck struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	LastChecked string `json:"last_checked"`
	Severity    string `json:"severity"`
}

// SuppressionList represents a managed suppression list
type SuppressionList struct {
	Name        string `json:"name"`
	Count       int    `json:"count"`
	LastUpdated string `json:"last_updated"`
	Auto        bool   `json:"auto"`
}

// ChannelConsent aggregates consent statistics for a channel
type ChannelConsent struct {
	Channel  Channel `json:"channel"`
	OptedIn  int     `json:"opted_in"`
	OptedOut int     `json:"opted_out"`
	Pending  int     `json:"pending"`
	Total    int     `json:"total"`
	Rate     float64 `json:"rate"`
}

// ConsentManager manages customer consent and NDPR compliance
type ConsentManager struct {
	mu               sync.RWMutex
	consents         map[string]map[Channel]*ConsentRecord
	events           []ConsentEvent
	suppressionLists map[string]*SuppressionList
	complianceChecks []ComplianceCheck
}

// NewConsentManager creates a new consent manager
func NewConsentManager() *ConsentManager {
	cm := &ConsentManager{
		consents:         make(map[string]map[Channel]*ConsentRecord),
		events:           make([]ConsentEvent, 0),
		suppressionLists: make(map[string]*SuppressionList),
		complianceChecks: defaultComplianceChecks(),
	}

	cm.suppressionLists["global_opt_out"] = &SuppressionList{Name: "Global Opt-Out", Count: 35800, LastUpdated: "5 min ago", Auto: true}
	cm.suppressionLists["complaint"] = &SuppressionList{Name: "Complaint Escalation", Count: 234, LastUpdated: "1 hour ago", Auto: true}
	cm.suppressionLists["legal_hold"] = &SuppressionList{Name: "Legal Hold", Count: 12, LastUpdated: "3 days ago", Auto: false}
	cm.suppressionLists["frequency_cap"] = &SuppressionList{Name: "Frequency Cap Exceeded", Count: 1890, LastUpdated: "30 min ago", Auto: true}
	cm.suppressionLists["bounce"] = &SuppressionList{Name: "Bounce/Invalid Numbers", Count: 4560, LastUpdated: "2 hours ago", Auto: true}

	return cm
}

func defaultComplianceChecks() []ComplianceCheck {
	return []ComplianceCheck{
		{1, "NDPR Data Processing Notice", "compliant", "2 hours ago", "critical"},
		{2, "Consent Collection at Registration", "compliant", "2 hours ago", "critical"},
		{3, "Opt-Out Mechanism in Every Message", "compliant", "1 hour ago", "critical"},
		{4, "Data Retention Policy (36 months)", "compliant", "6 hours ago", "high"},
		{5, "Cross-Border Transfer Safeguards", "warning", "12 hours ago", "high"},
		{6, "Minor Customer Data Protection", "compliant", "1 day ago", "critical"},
		{7, "Marketing Frequency Limits", "compliant", "3 hours ago", "medium"},
		{8, "Consent Audit Trail Completeness", "compliant", "4 hours ago", "high"},
		{9, "Right to Erasure Implementation", "warning", "2 days ago", "high"},
		{10, "Data Breach Notification SLA (72h)", "compliant", "1 day ago", "critical"},
	}
}

// UpdateConsent records a consent change for a customer
func (cm *ConsentManager) UpdateConsent(ctx context.Context, customerID, customerName string, channel Channel, status ConsentStatus, method string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, exists := cm.consents[customerID]; !exists {
		cm.consents[customerID] = make(map[Channel]*ConsentRecord)
	}

	oldStatus := ConsentPending
	if existing, exists := cm.consents[customerID][channel]; exists {
		oldStatus = existing.Status
	}

	cm.consents[customerID][channel] = &ConsentRecord{
		CustomerID: customerID,
		Channel:    channel,
		Status:     status,
		Method:     method,
		UpdatedAt:  time.Now(),
	}

	event := ConsentEvent{
		ID:           fmt.Sprintf("CE-%d", time.Now().UnixNano()),
		CustomerID:   customerID,
		CustomerName: customerName,
		Channel:      channel,
		OldStatus:    oldStatus,
		NewStatus:    status,
		Method:       method,
		Timestamp:    time.Now(),
	}
	cm.events = append([]ConsentEvent{event}, cm.events...)
	if len(cm.events) > 1000 {
		cm.events = cm.events[:1000]
	}

	// Auto-update suppression list
	if status == ConsentOptedOut {
		if sl, exists := cm.suppressionLists["global_opt_out"]; exists {
			sl.Count++
			sl.LastUpdated = "just now"
		}
	}

	log.Printf("[ConsentManager] Customer %s %s consent for %s via %s", customerID, status, channel, method)
	return nil
}

// CheckConsent checks if a customer has opted in for a channel
func (cm *ConsentManager) CheckConsent(ctx context.Context, customerID string, channel Channel) bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	if channelConsents, exists := cm.consents[customerID]; exists {
		if record, exists := channelConsents[channel]; exists {
			return record.Status == ConsentOptedIn
		}
	}
	return false
}

// IsOnSuppressionList checks if a customer should be suppressed
func (cm *ConsentManager) IsOnSuppressionList(ctx context.Context, customerID string) bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	if channelConsents, exists := cm.consents[customerID]; exists {
		for _, record := range channelConsents {
			if record.Status == ConsentOptedOut {
				return true
			}
		}
	}
	return false
}

// GetChannelConsentStats returns aggregate consent statistics per channel
func (cm *ConsentManager) GetChannelConsentStats() []ChannelConsent {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	stats := map[Channel]*ChannelConsent{
		ChannelSMS:      {Channel: ChannelSMS},
		ChannelWhatsApp: {Channel: ChannelWhatsApp},
		ChannelTelegram: {Channel: ChannelTelegram},
		ChannelVoice:    {Channel: ChannelVoice},
		ChannelEmail:    {Channel: ChannelEmail},
	}

	for _, channels := range cm.consents {
		for ch, record := range channels {
			if s, exists := stats[ch]; exists {
				switch record.Status {
				case ConsentOptedIn:
					s.OptedIn++
				case ConsentOptedOut:
					s.OptedOut++
				case ConsentPending:
					s.Pending++
				}
				s.Total++
			}
		}
	}

	result := make([]ChannelConsent, 0)
	for _, s := range stats {
		if s.Total > 0 {
			s.Rate = float64(s.OptedIn) / float64(s.Total) * 100
		}
		result = append(result, *s)
	}

	return result
}

// GetConsentEvents returns the audit trail
func (cm *ConsentManager) GetConsentEvents(limit int) []ConsentEvent {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	if limit > len(cm.events) {
		limit = len(cm.events)
	}
	return cm.events[:limit]
}

// GetComplianceChecks returns all compliance check results
func (cm *ConsentManager) GetComplianceChecks() []ComplianceCheck {
	return cm.complianceChecks
}

// GetSuppressionLists returns all suppression lists
func (cm *ConsentManager) GetSuppressionLists() []*SuppressionList {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	result := make([]*SuppressionList, 0, len(cm.suppressionLists))
	for _, sl := range cm.suppressionLists {
		result = append(result, sl)
	}
	return result
}

// GetComplianceScore returns the overall compliance percentage
func (cm *ConsentManager) GetComplianceScore() float64 {
	compliant := 0
	for _, check := range cm.complianceChecks {
		if check.Status == "compliant" {
			compliant++
		}
	}
	if len(cm.complianceChecks) == 0 {
		return 100.0
	}
	return float64(compliant) / float64(len(cm.complianceChecks)) * 100
}

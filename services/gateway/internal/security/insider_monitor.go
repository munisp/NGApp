package security

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// InsiderThreatMonitor detects and alerts on suspicious internal activity.
// Monitors privileged access, abnormal data access patterns, after-hours activity,
// separation of duties violations, and data exfiltration indicators.
type InsiderThreatMonitor struct {
	mu          sync.RWMutex
	activityLog []UserActivity
	alerts      []InsiderAlert
	rules       []InsiderRule
	maxLogSize  int
	onAlertFunc func(InsiderAlert)
	store       *Store // Redis-backed persistent store (optional)
	webhookURL  string // Webhook URL for alert notifications (PagerDuty, Slack, etc.)
}

// UserActivity records a single user action for behavioral analysis
type UserActivity struct {
	Timestamp    time.Time `json:"timestamp"`
	UserID       string    `json:"user_id"`
	Role         string    `json:"role"`
	Action       string    `json:"action"`
	Resource     string    `json:"resource"`
	ResourceType string    `json:"resource_type"`
	IP           string    `json:"ip"`
	Outcome      string    `json:"outcome"` // success, failure, denied
	RiskScore    float64   `json:"risk_score"`
}

// InsiderAlert represents a detected insider threat indicator
type InsiderAlert struct {
	ID          string    `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	UserID      string    `json:"user_id"`
	RuleName    string    `json:"rule_name"`
	Severity    string    `json:"severity"` // low, medium, high, critical
	Description string    `json:"description"`
	Evidence    []string  `json:"evidence"`
	Status      string    `json:"status"` // open, investigating, resolved, false_positive
}

// InsiderRule defines a detection rule
type InsiderRule struct {
	Name        string
	Description string
	Severity    string
	Check       func(activity UserActivity, history []UserActivity) *InsiderAlert
}

// NewInsiderThreatMonitor creates a new insider threat monitor (in-memory only)
func NewInsiderThreatMonitor() *InsiderThreatMonitor {
	return NewInsiderThreatMonitorWithStore(nil, "")
}

// NewInsiderThreatMonitorWithStore creates an insider threat monitor backed by Redis
func NewInsiderThreatMonitorWithStore(store *Store, webhookURL string) *InsiderThreatMonitor {
	itm := &InsiderThreatMonitor{
		activityLog: make([]UserActivity, 0),
		alerts:      make([]InsiderAlert, 0),
		maxLogSize:  100000,
		store:       store,
		webhookURL:  webhookURL,
	}

	// Register detection rules
	itm.registerDefaultRules()
	return itm
}

// SetAlertCallback sets a function called when an insider threat is detected
func (itm *InsiderThreatMonitor) SetAlertCallback(fn func(InsiderAlert)) {
	itm.mu.Lock()
	defer itm.mu.Unlock()
	itm.onAlertFunc = fn
}

// RecordActivity records a user action and checks against detection rules
func (itm *InsiderThreatMonitor) RecordActivity(activity UserActivity) {
	itm.mu.Lock()

	// Add to activity log
	itm.activityLog = append(itm.activityLog, activity)
	if len(itm.activityLog) > itm.maxLogSize {
		itm.activityLog = itm.activityLog[len(itm.activityLog)-itm.maxLogSize:]
	}

	// Get user's recent history
	history := itm.getUserHistory(activity.UserID, 24*time.Hour)
	rules := itm.rules
	alertFn := itm.onAlertFunc
	itm.mu.Unlock()

	// Check against all rules
	for _, rule := range rules {
		if alert := rule.Check(activity, history); alert != nil {
			itm.mu.Lock()
			itm.alerts = append(itm.alerts, *alert)
			itm.mu.Unlock()

			log.Printf("[InsiderMonitor] ALERT: %s — user=%s severity=%s: %s",
				alert.RuleName, alert.UserID, alert.Severity, alert.Description)

			// Persist alert to Redis
			if itm.store != nil {
				itm.store.StoreAlert(*alert)
			}

			// Send webhook notification (PagerDuty, Slack, etc.)
			if itm.webhookURL != "" {
				go itm.sendWebhookAlert(*alert)
			}

			if alertFn != nil {
				go alertFn(*alert)
			}
		}
	}
}

func (itm *InsiderThreatMonitor) getUserHistory(userID string, window time.Duration) []UserActivity {
	cutoff := time.Now().Add(-window)
	var history []UserActivity
	for _, a := range itm.activityLog {
		if a.UserID == userID && a.Timestamp.After(cutoff) {
			history = append(history, a)
		}
	}
	return history
}

func (itm *InsiderThreatMonitor) registerDefaultRules() {
	itm.rules = []InsiderRule{
		{
			Name:        "excessive_failed_access",
			Description: "Multiple failed access attempts in short period",
			Severity:    "high",
			Check: func(activity UserActivity, history []UserActivity) *InsiderAlert {
				if activity.Outcome != "denied" && activity.Outcome != "failure" {
					return nil
				}
				failCount := 0
				for _, h := range history {
					if (h.Outcome == "denied" || h.Outcome == "failure") &&
						time.Since(h.Timestamp) < 15*time.Minute {
						failCount++
					}
				}
				if failCount >= 10 {
					return &InsiderAlert{
						ID:          fmt.Sprintf("insider-%d", time.Now().UnixNano()),
						Timestamp:   time.Now(),
						UserID:      activity.UserID,
						RuleName:    "excessive_failed_access",
						Severity:    "high",
						Description: fmt.Sprintf("User had %d failed access attempts in 15 minutes", failCount),
						Evidence:    []string{fmt.Sprintf("Failed attempts: %d", failCount)},
						Status:      "open",
					}
				}
				return nil
			},
		},
		{
			Name:        "after_hours_admin_access",
			Description: "Administrative actions outside business hours",
			Severity:    "medium",
			Check: func(activity UserActivity, history []UserActivity) *InsiderAlert {
				if activity.Role != "admin" && activity.Role != "compliance_officer" {
					return nil
				}
				hour := activity.Timestamp.Hour()
				// Nigerian business hours: 8am - 6pm WAT (UTC+1)
				utcHour := (hour + 1) % 24
				if utcHour >= 8 && utcHour <= 18 {
					return nil
				}
				return &InsiderAlert{
					ID:        fmt.Sprintf("insider-%d", time.Now().UnixNano()),
					Timestamp: time.Now(),
					UserID:    activity.UserID,
					RuleName:  "after_hours_admin_access",
					Severity:  "medium",
					Description: fmt.Sprintf("Admin action '%s' performed at %s (outside business hours)",
						activity.Action, activity.Timestamp.Format("15:04 UTC")),
					Evidence: []string{
						fmt.Sprintf("Action: %s", activity.Action),
						fmt.Sprintf("Resource: %s", activity.Resource),
						fmt.Sprintf("Time: %s", activity.Timestamp.Format(time.RFC3339)),
					},
					Status: "open",
				}
			},
		},
		{
			Name:        "bulk_data_access",
			Description: "Unusually large number of data access operations (potential exfiltration)",
			Severity:    "critical",
			Check: func(activity UserActivity, history []UserActivity) *InsiderAlert {
				if activity.Action != "data_accessed" && activity.Action != "export" {
					return nil
				}
				accessCount := 0
				for _, h := range history {
					if (h.Action == "data_accessed" || h.Action == "export") &&
						time.Since(h.Timestamp) < 1*time.Hour {
						accessCount++
					}
				}
				if accessCount >= 100 {
					return &InsiderAlert{
						ID:          fmt.Sprintf("insider-%d", time.Now().UnixNano()),
						Timestamp:   time.Now(),
						UserID:      activity.UserID,
						RuleName:    "bulk_data_access",
						Severity:    "critical",
						Description: fmt.Sprintf("User accessed/exported %d records in 1 hour (possible data exfiltration)", accessCount),
						Evidence:    []string{fmt.Sprintf("Access count: %d in 1 hour", accessCount)},
						Status:      "open",
					}
				}
				return nil
			},
		},
		{
			Name:        "privilege_escalation_attempt",
			Description: "Attempt to access resources beyond assigned role",
			Severity:    "high",
			Check: func(activity UserActivity, history []UserActivity) *InsiderAlert {
				if activity.Outcome != "denied" {
					return nil
				}
				// Check for pattern: multiple denied accesses to different resource types
				deniedTypes := make(map[string]bool)
				for _, h := range history {
					if h.Outcome == "denied" && time.Since(h.Timestamp) < 30*time.Minute {
						deniedTypes[h.ResourceType] = true
					}
				}
				if len(deniedTypes) >= 3 {
					types := make([]string, 0, len(deniedTypes))
					for t := range deniedTypes {
						types = append(types, t)
					}
					return &InsiderAlert{
						ID:          fmt.Sprintf("insider-%d", time.Now().UnixNano()),
						Timestamp:   time.Now(),
						UserID:      activity.UserID,
						RuleName:    "privilege_escalation_attempt",
						Severity:    "high",
						Description: fmt.Sprintf("User attempted to access %d different restricted resource types", len(deniedTypes)),
						Evidence:    types,
						Status:      "open",
					}
				}
				return nil
			},
		},
		{
			Name:        "separation_of_duties_violation",
			Description: "User performing conflicting roles (e.g., both submitting and approving)",
			Severity:    "critical",
			Check: func(activity UserActivity, history []UserActivity) *InsiderAlert {
				conflictPairs := [][2]string{
					{"order_placed", "order_approved"},
					{"kyc_submitted", "kyc_approved"},
					{"settlement_initiated", "settlement_finalized"},
					{"asset_created", "asset_approved"},
				}
				for _, pair := range conflictPairs {
					if activity.Action == pair[1] {
						for _, h := range history {
							if h.Action == pair[0] && h.Resource == activity.Resource {
								return &InsiderAlert{
									ID:          fmt.Sprintf("insider-%d", time.Now().UnixNano()),
									Timestamp:   time.Now(),
									UserID:      activity.UserID,
									RuleName:    "separation_of_duties_violation",
									Severity:    "critical",
									Description: fmt.Sprintf("User both '%s' and '%s' on resource %s", pair[0], pair[1], activity.Resource),
									Evidence: []string{
										fmt.Sprintf("Action 1: %s", pair[0]),
										fmt.Sprintf("Action 2: %s", pair[1]),
										fmt.Sprintf("Resource: %s", activity.Resource),
									},
									Status: "open",
								}
							}
						}
					}
				}
				return nil
			},
		},
	}
}

// GetAlerts returns all insider threat alerts
func (itm *InsiderThreatMonitor) GetAlerts() []InsiderAlert {
	itm.mu.RLock()
	defer itm.mu.RUnlock()
	alerts := make([]InsiderAlert, len(itm.alerts))
	copy(alerts, itm.alerts)
	return alerts
}

// GetOpenAlerts returns unresolved alerts
func (itm *InsiderThreatMonitor) GetOpenAlerts() []InsiderAlert {
	itm.mu.RLock()
	defer itm.mu.RUnlock()
	var open []InsiderAlert
	for _, a := range itm.alerts {
		if a.Status == "open" || a.Status == "investigating" {
			open = append(open, a)
		}
	}
	return open
}

// AlertCount returns total and open alert counts
func (itm *InsiderThreatMonitor) AlertCount() (total int, open int) {
	itm.mu.RLock()
	defer itm.mu.RUnlock()
	total = len(itm.alerts)
	for _, a := range itm.alerts {
		if a.Status == "open" || a.Status == "investigating" {
			open++
		}
	}
	return
}

// ActivityCount returns the number of recorded activities
func (itm *InsiderThreatMonitor) ActivityCount() int {
	itm.mu.RLock()
	defer itm.mu.RUnlock()
	return len(itm.activityLog)
}

// sendWebhookAlert sends an alert to a webhook endpoint (PagerDuty, Slack, etc.)
func (itm *InsiderThreatMonitor) sendWebhookAlert(alert InsiderAlert) {
	payload := map[string]interface{}{
		"routing_key":  "nexcom-insider-threat",
		"event_action": "trigger",
		"payload": map[string]interface{}{
			"summary":   fmt.Sprintf("[NEXCOM] Insider Threat: %s — %s", alert.RuleName, alert.Description),
			"severity":  alert.Severity,
			"source":    "nexcom-exchange-gateway",
			"component": "insider-threat-monitor",
			"group":     "security",
			"custom_details": map[string]interface{}{
				"alert_id":  alert.ID,
				"user_id":   alert.UserID,
				"rule_name": alert.RuleName,
				"evidence":  alert.Evidence,
				"timestamp": alert.Timestamp.Format(time.RFC3339),
			},
		},
	}
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[InsiderMonitor] Failed to marshal webhook payload: %v", err)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(itm.webhookURL, "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("[InsiderMonitor] Webhook delivery failed: %v", err)
		return
	}
	resp.Body.Close()
	log.Printf("[InsiderMonitor] Webhook delivered (HTTP %d) for alert %s", resp.StatusCode, alert.ID)
}

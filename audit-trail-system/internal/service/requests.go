package service

import "time"

type RecordEventRequest struct {
	EventType     string                 `json:"event_type"`
	EntityType    string                 `json:"entity_type"`
	EntityID      string                 `json:"entity_id"`
	Module        string                 `json:"module"`
	ActorID       string                 `json:"actor_id"`
	ActorName     string                 `json:"actor_name"`
	ActorRole     string                 `json:"actor_role"`
	ActorIP       string                 `json:"actor_ip"`
	UserAgent     string                 `json:"user_agent"`
	Description   string                 `json:"description"`
	OldValue      map[string]interface{} `json:"old_value"`
	NewValue      map[string]interface{} `json:"new_value"`
	Changes       map[string]interface{} `json:"changes"`
	Metadata      map[string]interface{} `json:"metadata"`
	Outcome       string                 `json:"outcome"`
	ErrorMessage  string                 `json:"error_message"`
	CorrelationID string                 `json:"correlation_id"`
	SessionID     string                 `json:"session_id"`
}

type SearchEventsRequest struct {
	EntityType string    `json:"entity_type"`
	EntityID   string    `json:"entity_id"`
	ActorID    string    `json:"actor_id"`
	EventType  string    `json:"event_type"`
	Module     string    `json:"module"`
	From       time.Time `json:"from"`
	To         time.Time `json:"to"`
	Limit      int       `json:"limit"`
}

type CreatePolicyRequest struct {
	Name             string   `json:"name"`
	EntityType       string   `json:"entity_type"`
	EventTypes       []string `json:"event_types"`
	RetentionDays    int      `json:"retention_days"`
	RequiresApproval bool     `json:"requires_approval"`
	AlertOnEvent     bool     `json:"alert_on_event"`
	RiskLevel        string   `json:"risk_level"`
}

type GenerateReportRequest struct {
	ReportType  string `json:"report_type"`
	Period      string `json:"period"`
	GeneratedBy string `json:"generated_by"`
}

type CreateAlertRuleRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	Condition     string `json:"condition"`
	EntityType    string `json:"entity_type"`
	EventType     string `json:"event_type"`
	Threshold     int    `json:"threshold"`
	WindowMinutes int    `json:"window_minutes"`
	Severity      string `json:"severity"`
	NotifyChannel string `json:"notify_channel"`
}

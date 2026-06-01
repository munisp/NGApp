// Package alerting provides a client for Grafana OnCall — the open-source
// on-call incident management platform (https://grafana.com/oss/oncall/).
//
// Grafana OnCall exposes an Alertmanager-compatible webhook endpoint that
// receives alerts and routes them through escalation policies and schedules.
//
// Spec: IEC 62443 §21.2 — CreateIncidentAlert activity in IncidentTriageWorkflow.
// Replaces PagerDuty with a fully self-hosted, open-source alternative.
//
// Deployment: runs as a container in the platform-core namespace.
//   docker run -d -p 8080:8080 grafana/oncall
//   helm install grafana-oncall grafana/oncall -n platform-core
//
// Auth: Integration token (GRAFANA_ONCALL_TOKEN env var)
// Endpoint: POST /api/v1/integrations/alertmanager/{integration_id}/alerts/
package pagerduty

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Severity maps to Grafana OnCall / Alertmanager severity labels.
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityError    Severity = "error"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

// Alert is a single Alertmanager-format alert sent to Grafana OnCall.
type Alert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    string            `json:"startsAt,omitempty"`
	EndsAt      string            `json:"endsAt,omitempty"`
	GeneratorURL string           `json:"generatorURL,omitempty"`
}

// AlertPayload is the Alertmanager webhook payload (array of alerts).
type AlertPayload struct {
	Version           string            `json:"version"`
	GroupKey          string            `json:"groupKey"`
	Status            string            `json:"status"` // "firing" | "resolved"
	Receiver          string            `json:"receiver"`
	GroupLabels       map[string]string `json:"groupLabels"`
	CommonLabels      map[string]string `json:"commonLabels"`
	CommonAnnotations map[string]string `json:"commonAnnotations"`
	ExternalURL       string            `json:"externalURL"`
	Alerts            []Alert           `json:"alerts"`
}

// Response is the Grafana OnCall API response.
type Response struct {
	AlertGroupID string `json:"alert_group_id"`
	AlertID      string `json:"alert_id"`
}

// Client is the Grafana OnCall alerting client.
// It sends Alertmanager-format payloads to the OnCall integration endpoint.
type Client struct {
	baseURL       string // e.g. "http://grafana-oncall:8080"
	integrationID string // Alertmanager integration ID from OnCall
	token         string // OnCall API token
	httpClient    *http.Client
}

// NewClient creates a new Grafana OnCall client.
//
//	baseURL:       Grafana OnCall base URL (GRAFANA_ONCALL_URL env var)
//	integrationID: Alertmanager integration ID (GRAFANA_ONCALL_INTEGRATION_ID env var)
//	token:         OnCall API token (GRAFANA_ONCALL_TOKEN env var)
func NewClient(baseURL, integrationID, token string) *Client {
	return &Client{
		baseURL:       baseURL,
		integrationID: integrationID,
		token:         token,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

// TriggerIncident fires an alert to Grafana OnCall for a security event.
// Returns the OnCall alert group ID for tracking and resolution.
func (c *Client) TriggerIncident(ctx context.Context, eventID, summary, source string, severity Severity, details map[string]string) (string, error) {
	annotations := map[string]string{
		"summary":     summary,
		"description": fmt.Sprintf("Security incident detected by OG-RMM workflow engine. Source: %s", source),
		"runbook_url": fmt.Sprintf("https://og-rmm.internal/cybersecurity?event=%s", eventID),
	}
	for k, v := range details {
		annotations[k] = v
	}

	payload := AlertPayload{
		Version:  "4",
		GroupKey: fmt.Sprintf("og-rmm-security|%s", eventID),
		Status:   "firing",
		Receiver: "og-rmm-security-team",
		GroupLabels: map[string]string{
			"alertname": "SecurityIncident",
			"namespace": "platform-core",
		},
		CommonLabels: map[string]string{
			"alertname": "SecurityIncident",
			"severity":  string(severity),
			"source":    source,
			"event_id":  eventID,
			"platform":  "og-rmm",
		},
		CommonAnnotations: annotations,
		ExternalURL:       "https://og-rmm.internal",
		Alerts: []Alert{
			{
				Labels: map[string]string{
					"alertname": "SecurityIncident",
					"severity":  string(severity),
					"event_id":  eventID,
					"source":    source,
				},
				Annotations:  annotations,
				StartsAt:     time.Now().UTC().Format(time.RFC3339),
				GeneratorURL: fmt.Sprintf("https://og-rmm.internal/cybersecurity?event=%s", eventID),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal oncall payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/integrations/alertmanager/%s/alerts/", c.baseURL, c.integrationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create oncall request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Token "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("oncall request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read oncall response: %w", err)
	}

	// Grafana OnCall returns 200 OK on success
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("oncall returned %d: %s", resp.StatusCode, string(respBody))
	}

	var onCallResp Response
	if err := json.Unmarshal(respBody, &onCallResp); err != nil {
		// Non-fatal: response may be empty on some versions
		return fmt.Sprintf("og-rmm-security-%s", eventID), nil
	}

	return onCallResp.AlertGroupID, nil
}

// ResolveIncident sends a resolved alert to Grafana OnCall.
// This closes the alert group and notifies the on-call team that the incident is mitigated.
func (c *Client) ResolveIncident(ctx context.Context, eventID, source string) error {
	payload := AlertPayload{
		Version:  "4",
		GroupKey: fmt.Sprintf("og-rmm-security|%s", eventID),
		Status:   "resolved",
		Receiver: "og-rmm-security-team",
		GroupLabels: map[string]string{
			"alertname": "SecurityIncident",
			"namespace": "platform-core",
		},
		CommonLabels: map[string]string{
			"alertname": "SecurityIncident",
			"event_id":  eventID,
			"source":    source,
			"platform":  "og-rmm",
		},
		CommonAnnotations: map[string]string{
			"summary":     fmt.Sprintf("Security incident %s resolved", eventID),
			"description": "Node re-admitted after security clearance. Incident closed by OG-RMM workflow engine.",
		},
		ExternalURL: "https://og-rmm.internal",
		Alerts: []Alert{
			{
				Labels: map[string]string{
					"alertname": "SecurityIncident",
					"event_id":  eventID,
					"source":    source,
				},
				Annotations: map[string]string{
					"summary": fmt.Sprintf("Security incident %s resolved", eventID),
				},
				StartsAt: time.Now().UTC().Add(-1 * time.Hour).Format(time.RFC3339),
				EndsAt:   time.Now().UTC().Format(time.RFC3339),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/v1/integrations/alertmanager/%s/alerts/", c.baseURL, c.integrationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Token "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("oncall resolve returned %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// MapSeverityFromScore converts an OpenCTI severity score (0–100) to an OnCall severity label.
func MapSeverityFromScore(score int) Severity {
	switch {
	case score >= 80:
		return SeverityCritical
	case score >= 60:
		return SeverityError
	case score >= 40:
		return SeverityWarning
	default:
		return SeverityInfo
	}
}

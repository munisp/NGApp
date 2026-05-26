// Package handlers provides HTTP handlers for the Alarm Manager Service.
package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/og-rmm/alarm-manager/internal/processor"
)

// AlarmHandler handles alarm HTTP endpoints.
type AlarmHandler struct {
	pool *pgxpool.Pool
	proc *processor.AlarmProcessor
}

// NewAlarmHandler creates a new handler.
func NewAlarmHandler(pool *pgxpool.Pool, proc *processor.AlarmProcessor) *AlarmHandler {
	return &AlarmHandler{pool: pool, proc: proc}
}

// ListAlarms handles GET /api/v1/alarms
// Query params: state, severity, well_id, limit, offset
func (h *AlarmHandler) ListAlarms(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	state := q.Get("state")
	wellID := q.Get("well_id")
	severity := q.Get("severity")

	query := `
		SELECT alarm_id::text, well_id::text, sensor_type, severity, severity_label,
		       message, value, threshold, state, created_at, acknowledged_at, resolved_at
		FROM alarms
		WHERE ($1 = '' OR state = $1)
		  AND ($2 = '' OR well_id = $2::uuid)
		  AND ($3 = '' OR severity::text = $3)
		ORDER BY severity ASC, created_at DESC
		LIMIT 100`

	rows, err := h.pool.Query(r.Context(), query, state, wellID, severity)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var alarms []map[string]interface{}
	for rows.Next() {
		var id, wid, sensorType, severityLabel, message, st string
		var sev int
		var val, thresh *float64
		var createdAt time.Time
		var ackedAt, resolvedAt *time.Time

		if err := rows.Scan(&id, &wid, &sensorType, &sev, &severityLabel,
			&message, &val, &thresh, &st, &createdAt, &ackedAt, &resolvedAt); err != nil {
			continue
		}
		alarms = append(alarms, map[string]interface{}{
			"alarm_id":       id,
			"well_id":        wid,
			"sensor_type":    sensorType,
			"severity":       sev,
			"severity_label": severityLabel,
			"message":        message,
			"value":          val,
			"threshold":      thresh,
			"state":          st,
			"created_at":     createdAt,
			"acknowledged_at": ackedAt,
			"resolved_at":    resolvedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": alarms, "total": len(alarms)})
}

// GetAlarm handles GET /api/v1/alarms/{id}
func (h *AlarmHandler) GetAlarm(w http.ResponseWriter, r *http.Request) {
	alarmID := r.PathValue("id")
	var alarm map[string]interface{}

	row := h.pool.QueryRow(r.Context(),
		`SELECT alarm_id::text, well_id::text, sensor_type, severity, severity_label,
		        message, value, threshold, state, created_at
		 FROM alarms WHERE alarm_id = $1::uuid`, alarmID)

	var id, wid, sensorType, severityLabel, message, state string
	var sev int
	var val, thresh *float64
	var createdAt time.Time

	if err := row.Scan(&id, &wid, &sensorType, &sev, &severityLabel,
		&message, &val, &thresh, &state, &createdAt); err != nil {
		writeError(w, http.StatusNotFound, "alarm not found")
		return
	}

	alarm = map[string]interface{}{
		"alarm_id":       id,
		"well_id":        wid,
		"sensor_type":    sensorType,
		"severity":       sev,
		"severity_label": severityLabel,
		"message":        message,
		"value":          val,
		"threshold":      thresh,
		"state":          state,
		"created_at":     createdAt,
	}
	writeJSON(w, http.StatusOK, alarm)
}

// CreateAlarm handles POST /api/v1/alarms (manual alarm creation)
func (h *AlarmHandler) CreateAlarm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WellID     string  `json:"well_id"`
		SensorType string  `json:"sensor_type"`
		Severity   int     `json:"severity"`
		Message    string  `json:"message"`
		Value      float64 `json:"value"`
		Threshold  float64 `json:"threshold"`
		TenantID   string  `json:"tenant_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	var alarmID string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO alarms (well_id, sensor_type, severity, message, value, threshold, tenant_id)
		 VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
		 RETURNING alarm_id::text`,
		req.WellID, req.SensorType, req.Severity, req.Message,
		req.Value, req.Threshold, req.TenantID,
	).Scan(&alarmID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "alarm creation failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"alarm_id": alarmID,
		"state":    "UNACKNOWLEDGED",
	})
}

// AcknowledgeAlarm handles PATCH /api/v1/alarms/{id}/acknowledge
func (h *AlarmHandler) AcknowledgeAlarm(w http.ResponseWriter, r *http.Request) {
	alarmID := r.PathValue("id")
	var req struct {
		AcknowledgedBy string `json:"acknowledged_by"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	_, err := h.pool.Exec(r.Context(),
		`UPDATE alarms SET state = 'ACKNOWLEDGED', acknowledged_by = $1, acknowledged_at = NOW()
		 WHERE alarm_id = $2::uuid AND state = 'UNACKNOWLEDGED'`,
		req.AcknowledgedBy, alarmID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"alarm_id": alarmID, "state": "ACKNOWLEDGED"})
}

// ResolveAlarm handles PATCH /api/v1/alarms/{id}/resolve
func (h *AlarmHandler) ResolveAlarm(w http.ResponseWriter, r *http.Request) {
	alarmID := r.PathValue("id")
	var req struct {
		ResolvedBy string `json:"resolved_by"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	_, err := h.pool.Exec(r.Context(),
		`UPDATE alarms SET state = 'RESOLVED', resolved_by = $1, resolved_at = NOW()
		 WHERE alarm_id = $2::uuid AND state IN ('UNACKNOWLEDGED', 'ACKNOWLEDGED')`,
		req.ResolvedBy, alarmID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"alarm_id": alarmID, "state": "RESOLVED"})
}

// ListRules handles GET /api/v1/alarm-rules
func (h *AlarmHandler) ListRules(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT rule_id::text, COALESCE(well_id::text, ''), sensor_type,
		        condition, threshold, severity, message_template, enabled
		 FROM alarm_rules ORDER BY severity, sensor_type`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var rules []map[string]interface{}
	for rows.Next() {
		var id, wellID, sensorType, condition, msgTpl string
		var threshold float64
		var severity int
		var enabled bool
		if err := rows.Scan(&id, &wellID, &sensorType, &condition, &threshold, &severity, &msgTpl, &enabled); err != nil {
			continue
		}
		rules = append(rules, map[string]interface{}{
			"rule_id":          id,
			"well_id":          wellID,
			"sensor_type":      sensorType,
			"condition":        condition,
			"threshold":        threshold,
			"severity":         severity,
			"message_template": msgTpl,
			"enabled":          enabled,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": rules})
}

// CreateRule handles POST /api/v1/alarm-rules
func (h *AlarmHandler) CreateRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WellID          *string `json:"well_id"`
		SensorType      string  `json:"sensor_type"`
		Condition       string  `json:"condition"`
		Threshold       float64 `json:"threshold"`
		Severity        int     `json:"severity"`
		MessageTemplate string  `json:"message_template"`
		DeadBand        float64 `json:"dead_band"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}

	var ruleID string
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO alarm_rules (well_id, sensor_type, condition, threshold, severity, message_template, dead_band)
		 VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
		 RETURNING rule_id::text`,
		req.WellID, req.SensorType, req.Condition, req.Threshold,
		req.Severity, req.MessageTemplate, req.DeadBand,
	).Scan(&ruleID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "rule creation failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"rule_id": ruleID})
}

// GetAlarmStats handles GET /api/v1/alarms/stats
func (h *AlarmHandler) GetAlarmStats(w http.ResponseWriter, r *http.Request) {
	row := h.pool.QueryRow(r.Context(),
		`SELECT
		    COUNT(*) FILTER (WHERE state = 'UNACKNOWLEDGED') as unacked,
		    COUNT(*) FILTER (WHERE state = 'ACKNOWLEDGED') as acked,
		    COUNT(*) FILTER (WHERE state = 'RESOLVED') as resolved,
		    COUNT(*) FILTER (WHERE severity = 1 AND state != 'RESOLVED') as critical_active,
		    COUNT(*) FILTER (WHERE severity = 2 AND state != 'RESOLVED') as high_active,
		    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
		 FROM alarms`)

	var unacked, acked, resolved, critActive, highActive, last24h int
	row.Scan(&unacked, &acked, &resolved, &critActive, &highActive, &last24h)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"unacknowledged":  unacked,
		"acknowledged":    acked,
		"resolved":        resolved,
		"critical_active": critActive,
		"high_active":     highActive,
		"last_24h":        last24h,
	})
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]interface{}{"error": msg, "code": code})
}

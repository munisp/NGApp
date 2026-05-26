// Package store provides time-series and relational storage for telemetry data.
// Hot time-series data → InfluxDB via HTTP line protocol API.
// Metadata and aggregates → PostgreSQL.
package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/og-rmm/telemetry-ingestion/internal/handlers"
)

// TelemetryStat holds aggregated statistics for a sensor type.
type TelemetryStat struct {
	SensorType string  `json:"sensor_type"`
	Min        float64 `json:"min"`
	Max        float64 `json:"max"`
	Avg        float64 `json:"avg"`
	Last       float64 `json:"last"`
	Unit       string  `json:"unit"`
	Count      int64   `json:"count"`
}

// InfluxWriter writes telemetry data points to InfluxDB via HTTP API v2.
type InfluxWriter struct {
	url        string
	token      string
	org        string
	bucket     string
	httpClient *http.Client
}

// NewInfluxWriter creates a new InfluxDB writer.
func NewInfluxWriter(url, token, org, bucket string) *InfluxWriter {
	slog.Info("InfluxDB writer initialized", "url", url, "org", org, "bucket", bucket)
	return &InfluxWriter{
		url:    strings.TrimRight(url, "/"),
		token:  token,
		org:    org,
		bucket: bucket,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// WriteBatch writes multiple sensor readings to InfluxDB using line protocol.
func (w *InfluxWriter) WriteBatch(ctx context.Context, readings []handlers.SensorReading) error {
	if len(readings) == 0 {
		return nil
	}

	var sb strings.Builder
	for _, r := range readings {
		sb.WriteString("sensor_reading")
		sb.WriteString(",well_id=")
		sb.WriteString(escapeTag(r.WellID))
		sb.WriteString(",sensor_id=")
		sb.WriteString(escapeTag(r.SensorID))
		sb.WriteString(",sensor_type=")
		sb.WriteString(escapeTag(r.SensorType))
		sb.WriteString(",tenant_id=")
		sb.WriteString(escapeTag(r.TenantID))
		sb.WriteString(",unit=")
		sb.WriteString(escapeTag(r.Unit))

		for k, v := range r.Tags {
			sb.WriteString(",")
			sb.WriteString(escapeTag(k))
			sb.WriteString("=")
			sb.WriteString(escapeTag(v))
		}

		sb.WriteString(" value=")
		sb.WriteString(fmt.Sprintf("%g", r.Value))
		sb.WriteString(",quality=")
		sb.WriteString(fmt.Sprintf("%di", r.Quality))
		sb.WriteString(" ")
		sb.WriteString(fmt.Sprintf("%d", r.Timestamp.UnixNano()))
		sb.WriteString("\n")
	}

	writeURL := fmt.Sprintf("%s/api/v2/write?org=%s&bucket=%s&precision=ns", w.url, w.org, w.bucket)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, writeURL, strings.NewReader(sb.String()))
	if err != nil {
		return fmt.Errorf("influx write request: %w", err)
	}
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	req.Header.Set("Authorization", "Token "+w.token)

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("influx write: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("influx write HTTP %d: %s", resp.StatusCode, string(body))
	}

	slog.Debug("InfluxDB batch write", "count", len(readings), "bytes", sb.Len())
	return nil
}

// WritePoint writes a single sensor reading.
func (w *InfluxWriter) WritePoint(ctx context.Context, r handlers.SensorReading) error {
	return w.WriteBatch(ctx, []handlers.SensorReading{r})
}

// QueryLatest returns the most recent reading for each sensor type on a well.
func (w *InfluxWriter) QueryLatest(ctx context.Context, wellID string) ([]TelemetryStat, error) {
	fluxQuery := fmt.Sprintf(`
from(bucket: %q)
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor_reading" and r.well_id == %q)
  |> filter(fn: (r) => r._field == "value")
  |> group(columns: ["sensor_type", "unit"])
  |> reduce(
       fn: (r, accumulator) => ({
         min: if r._value < accumulator.min then r._value else accumulator.min,
         max: if r._value > accumulator.max then r._value else accumulator.max,
         sum: accumulator.sum + r._value,
         count: accumulator.count + 1.0,
         last: r._value,
       }),
       identity: {min: 999999.0, max: -999999.0, sum: 0.0, count: 0.0, last: 0.0}
     )`, w.bucket, wellID)

	results, err := w.executeFluxQuery(ctx, fluxQuery)
	if err != nil {
		return nil, fmt.Errorf("query latest: %w", err)
	}

	var stats []TelemetryStat
	for _, row := range results {
		st := TelemetryStat{
			SensorType: getStringField(row, "sensor_type"),
			Unit:       getStringField(row, "unit"),
		}
		if v, ok := row["min"].(float64); ok {
			st.Min = v
		}
		if v, ok := row["max"].(float64); ok {
			st.Max = v
		}
		if v, ok := row["last"].(float64); ok {
			st.Last = v
		}
		if cnt, ok := row["count"].(float64); ok {
			st.Count = int64(cnt)
			if sum, ok := row["sum"].(float64); ok && cnt > 0 {
				st.Avg = sum / cnt
			}
		}
		stats = append(stats, st)
	}
	return stats, nil
}

// QueryHistory returns historical readings for a well and sensor type.
func (w *InfluxWriter) QueryHistory(ctx context.Context, wellID, sensorType, start, stop string) ([]handlers.SensorReading, error) {
	fluxQuery := fmt.Sprintf(`
from(bucket: %q)
  |> range(start: %s, stop: %s)
  |> filter(fn: (r) => r._measurement == "sensor_reading" and r.well_id == %q and r.sensor_type == %q)
  |> filter(fn: (r) => r._field == "value")
  |> sort(columns: ["_time"])`, w.bucket, start, stop, wellID, sensorType)

	results, err := w.executeFluxQuery(ctx, fluxQuery)
	if err != nil {
		return nil, fmt.Errorf("query history: %w", err)
	}

	readings := make([]handlers.SensorReading, 0, len(results))
	for _, row := range results {
		r := handlers.SensorReading{
			WellID:     wellID,
			SensorType: sensorType,
			Unit:       getStringField(row, "unit"),
		}
		if v, ok := row["_value"].(float64); ok {
			r.Value = v
		}
		if ts, ok := row["_time"].(string); ok {
			if t, err := time.Parse(time.RFC3339Nano, ts); err == nil {
				r.Timestamp = t
			}
		}
		readings = append(readings, r)
	}
	return readings, nil
}

// QueryStats returns aggregated statistics for a well over a time window.
func (w *InfluxWriter) QueryStats(ctx context.Context, wellID, window string) ([]TelemetryStat, error) {
	return w.QueryLatest(ctx, wellID)
}

func (w *InfluxWriter) executeFluxQuery(ctx context.Context, query string) ([]map[string]interface{}, error) {
	queryURL := fmt.Sprintf("%s/api/v2/query?org=%s", w.url, w.org)
	body := map[string]interface{}{
		"query": query,
		"type":  "flux",
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, queryURL, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Token "+w.token)
	req.Header.Set("Accept", "application/json")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("flux query: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("flux query HTTP %d: %s", resp.StatusCode, string(errBody))
	}

	var result []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode flux result: %w", err)
	}
	return result, nil
}

// Close releases InfluxDB client resources.
func (w *InfluxWriter) Close() {
	slog.Info("InfluxDB writer closed")
}

func escapeTag(s string) string {
	s = strings.ReplaceAll(s, " ", "\\ ")
	s = strings.ReplaceAll(s, ",", "\\,")
	s = strings.ReplaceAll(s, "=", "\\=")
	return s
}

func getStringField(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

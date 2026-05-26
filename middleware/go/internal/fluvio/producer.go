// Package fluvio provides a Fluvio HTTP producer client for the OG-RMM middleware.
//
// Architecture role:
//   EMQX MQTT Broker  →  og.emqx.telemetry  (Fluvio topic)
//   FledgePOWER IEC104 →  og.fledge.raw      (Fluvio topic)
//   Kafka consumer     →  og.field.telemetry.raw (Fluvio topic, mirrored from Redpanda)
//
// Fluvio is the secondary streaming lane. The primary lane is Redpanda/Kafka.
// All publish calls degrade gracefully: if Fluvio is unavailable, the error
// is logged and the caller continues without interruption.
package fluvio

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"
)

// Config holds Fluvio connection settings loaded from environment variables.
type Config struct {
	// Endpoint is the Fluvio SC HTTP API base URL, e.g. "http://fluvio:9003"
	Endpoint string
	// Enabled controls whether publishing is active
	Enabled bool
}

// ConfigFromEnv loads Fluvio config from environment variables.
func ConfigFromEnv() Config {
	endpoint := os.Getenv("FLUVIO_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://fluvio:9003"
	}
	enabled := os.Getenv("FLUVIO_DUAL_PUBLISH") == "true" || os.Getenv("FLUVIO_DUAL_PUBLISH") == "1"
	return Config{Endpoint: endpoint, Enabled: enabled}
}

// Record is a single Fluvio record in the produce request.
type Record struct {
	Value string `json:"value"`
}

// ProduceRequest is the Fluvio HTTP produce API body.
type ProduceRequest struct {
	Records []Record `json:"records"`
}

// Producer is a Fluvio HTTP producer client.
type Producer struct {
	cfg    Config
	client *http.Client
	logger *zap.Logger
}

// NewProducer creates a new Fluvio producer with the given config.
func NewProducer(cfg Config, logger *zap.Logger) *Producer {
	return &Producer{
		cfg:    cfg,
		client: &http.Client{Timeout: 5 * time.Second},
		logger: logger,
	}
}

// Publish sends a batch of JSON-serializable records to the specified Fluvio topic.
// Returns nil even if Fluvio is unavailable (graceful degradation).
func (p *Producer) Publish(ctx context.Context, topic string, records []interface{}) error {
	if !p.cfg.Enabled || len(records) == 0 {
		return nil
	}

	fluvioRecords := make([]Record, 0, len(records))
	for _, r := range records {
		b, err := json.Marshal(r)
		if err != nil {
			p.logger.Warn("fluvio: failed to marshal record", zap.Error(err))
			continue
		}
		fluvioRecords = append(fluvioRecords, Record{Value: string(b)})
	}

	if len(fluvioRecords) == 0 {
		return nil
	}

	body, err := json.Marshal(ProduceRequest{Records: fluvioRecords})
	if err != nil {
		return nil // graceful degradation
	}

	url := fmt.Sprintf("%s/topics/%s/records", p.cfg.Endpoint, topic)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil // graceful degradation
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		p.logger.Warn("fluvio: publish failed (continuing)",
			zap.String("topic", topic),
			zap.Error(err),
		)
		return nil // graceful degradation
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		p.logger.Warn("fluvio: publish rejected",
			zap.String("topic", topic),
			zap.Int("status", resp.StatusCode),
		)
		return nil // graceful degradation
	}

	p.logger.Debug("fluvio: published records",
		zap.String("topic", topic),
		zap.Int("count", len(fluvioRecords)),
	)
	return nil
}

// PublishTelemetry publishes telemetry records to og.field.telemetry.raw
func (p *Producer) PublishTelemetry(ctx context.Context, records []interface{}) error {
	return p.Publish(ctx, "og.field.telemetry.raw", records)
}

// PublishEMQXTelemetry publishes EMQX MQTT bridge records to og.emqx.telemetry
func (p *Producer) PublishEMQXTelemetry(ctx context.Context, records []interface{}) error {
	return p.Publish(ctx, "og.emqx.telemetry", records)
}

// PublishFledgeRaw publishes FledgePOWER IEC 104 records to og.fledge.raw
func (p *Producer) PublishFledgeRaw(ctx context.Context, records []interface{}) error {
	return p.Publish(ctx, "og.fledge.raw", records)
}

// PublishSecurityEvent publishes security events to og.security.events
func (p *Producer) PublishSecurityEvent(ctx context.Context, event interface{}) error {
	return p.Publish(ctx, "og.security.events", []interface{}{event})
}

// PublishDRDispatch publishes demand response dispatch events to og.dr.dispatch
func (p *Producer) PublishDRDispatch(ctx context.Context, event interface{}) error {
	return p.Publish(ctx, "og.dr.dispatch", []interface{}{event})
}

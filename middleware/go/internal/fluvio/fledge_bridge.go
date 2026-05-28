// fledge_bridge.go — FledgePOWER IEC 60870-5-104 → Fluvio bridge
//
// FledgePOWER normalises IEC 104, DNP3, and Modbus RTU data from protection
// relays and legacy outstations into RTDIP PCDM tags. This bridge polls the
// FledgePOWER REST API and publishes normalised records to Fluvio og.fledge.raw.
//
// Pipeline:
//   Protection Relay (IEC 104) → FledgePOWER → RTDIP PCDM tags
//     → FledgeBridge.Poll() → og.fledge.raw (Fluvio)
//     → Kafka mirror (Redpanda) for stream processing
//
// FledgePOWER REST API: GET /fledge/asset/{asset_name}/readings
package fluvio

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"
)

// FledgeConfig holds FledgePOWER connection settings.
type FledgeConfig struct {
	BaseURL      string
	PollInterval time.Duration
	AssetNames   []string // RTDIP PCDM asset names to poll
}

// FledgeConfigFromEnv loads FledgePOWER config from environment variables.
func FledgeConfigFromEnv() FledgeConfig {
	baseURL := os.Getenv("FLEDGE_URL")
	if baseURL == "" {
		baseURL = "http://fledge:8081"
	}
	return FledgeConfig{
		BaseURL:      baseURL,
		PollInterval: 5 * time.Second,
		AssetNames: []string{
			"W-001.WELLHEAD_PRESSURE",
			"W-001.CASING_PRESSURE",
			"W-001.TUBING_TEMP",
			"W-001.CHOKE_POSITION",
			"W-002.WELLHEAD_PRESSURE",
			"W-002.CASING_PRESSURE",
			"W-002.TUBING_TEMP",
			"W-003.WELLHEAD_PRESSURE",
			"W-003.GAS_FLOW_RATE",
		},
	}
}

// FledgeReading is a single RTDIP PCDM reading from FledgePOWER.
type FledgeReading struct {
	AssetCode string                 `json:"asset_code"`
	Timestamp int64                  `json:"timestamp_ms"`
	Readings  map[string]interface{} `json:"readings"`
	Source    string                 `json:"source"`
}

// FledgeBridge polls FledgePOWER and bridges records to Fluvio.
type FledgeBridge struct {
	cfg      FledgeConfig
	producer *Producer
	client   *http.Client
	logger   *zap.Logger
}

// NewFledgeBridge creates a new FledgePOWER→Fluvio bridge.
func NewFledgeBridge(cfg FledgeConfig, producer *Producer, logger *zap.Logger) *FledgeBridge {
	return &FledgeBridge{
		cfg:      cfg,
		producer: producer,
		client:   &http.Client{Timeout: 10 * time.Second},
		logger:   logger,
	}
}

// Run starts the FledgePOWER→Fluvio bridge. Blocks until ctx is cancelled.
func (b *FledgeBridge) Run(ctx context.Context) error {
	ticker := time.NewTicker(b.cfg.PollInterval)
	defer ticker.Stop()

	b.logger.Info("[FledgeBridge] Started",
		zap.String("base_url", b.cfg.BaseURL),
		zap.Duration("poll_interval", b.cfg.PollInterval),
		zap.Int("asset_count", len(b.cfg.AssetNames)),
	)

	for {
		select {
		case <-ctx.Done():
			b.logger.Info("[FledgeBridge] Stopped")
			return nil
		case <-ticker.C:
			b.pollAndPublish(ctx)
		}
	}
}

func (b *FledgeBridge) pollAndPublish(ctx context.Context) {
	records := make([]interface{}, 0, len(b.cfg.AssetNames))

	for _, assetName := range b.cfg.AssetNames {
		readings, err := b.fetchReadings(ctx, assetName)
		if err != nil {
			b.logger.Debug("[FledgeBridge] fetch failed (may be unavailable)",
				zap.String("asset", assetName),
				zap.Error(err),
			)
			continue
		}
		for _, r := range readings {
			records = append(records, r)
		}
	}

	if len(records) == 0 {
		return
	}

	if err := b.producer.PublishFledgeRaw(ctx, records); err != nil {
		b.logger.Warn("[FledgeBridge] Fluvio publish failed", zap.Error(err))
	} else {
		b.logger.Debug("[FledgeBridge] Published readings",
			zap.Int("count", len(records)),
		)
	}
}

func (b *FledgeBridge) fetchReadings(ctx context.Context, assetName string) ([]FledgeReading, error) {
	url := fmt.Sprintf("%s/fledge/asset/%s?limit=10", b.cfg.BaseURL, assetName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("FledgePOWER returned HTTP %d for asset %s", resp.StatusCode, assetName)
	}

	// FledgePOWER returns: [{"asset_code": "...", "timestamp": "...", "reading": {...}}]
	var raw []struct {
		AssetCode string                 `json:"asset_code"`
		Timestamp string                 `json:"timestamp"`
		Reading   map[string]interface{} `json:"reading"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode FledgePOWER response: %w", err)
	}

	readings := make([]FledgeReading, 0, len(raw))
	for _, r := range raw {
		readings = append(readings, FledgeReading{
			AssetCode: r.AssetCode,
			Timestamp: time.Now().UnixMilli(),
			Readings:  r.Reading,
			Source:    "fledgepower-iec104",
		})
	}
	return readings, nil
}

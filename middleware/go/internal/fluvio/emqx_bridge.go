// emqx_bridge.go — EMQX MQTT → Fluvio bridge for the OG-RMM middleware
//
// This bridge subscribes to EMQX via MQTT and publishes every message to
// the Fluvio topic og.emqx.telemetry. This is the path for IoT devices
// that connect directly to EMQX (smart sensors, RTUs with MQTT 5.0 support)
// rather than going through the Rust edge agent.
//
// Pipeline:
//   IoT Device → EMQX MQTT Broker (port 1883/8883)
//     → EMQXBridge.Subscribe() → og.emqx.telemetry (Fluvio)
//     → og.field.telemetry.raw (Fluvio, normalised)
//     → Kafka mirror (Redpanda) for stream processing
//
// Topic pattern: wells/+/+/+/+ (well_id/subsystem/sensor_type/sensor_id)
package fluvio

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"go.uber.org/zap"
)

// EMQXConfig holds EMQX connection settings.
type EMQXConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	ClientID string
}

// EMQXConfigFromEnv loads EMQX config from environment variables.
func EMQXConfigFromEnv() EMQXConfig {
	host := os.Getenv("EMQX_HOST")
	if host == "" {
		host = "emqx"
	}
	port := 1883
	username := os.Getenv("EMQX_USERNAME")
	if username == "" {
		username = "og-rmm-bridge"
	}
	password := os.Getenv("EMQX_PASSWORD")
	if password == "" {
		password = "bridge-secret"
	}
	return EMQXConfig{
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
		ClientID: fmt.Sprintf("og-rmm-fluvio-bridge-%d", time.Now().UnixNano()),
	}
}

// EMQXTelemetryRecord is the normalised record published to Fluvio.
type EMQXTelemetryRecord struct {
	Topic     string          `json:"topic"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"timestamp_ms"`
	Source    string          `json:"source"`
}

// EMQXBridge subscribes to EMQX and bridges messages to Fluvio.
type EMQXBridge struct {
	emqxCfg  EMQXConfig
	producer *Producer
	logger   *zap.Logger
}

// NewEMQXBridge creates a new EMQX→Fluvio bridge.
func NewEMQXBridge(emqxCfg EMQXConfig, producer *Producer, logger *zap.Logger) *EMQXBridge {
	return &EMQXBridge{
		emqxCfg:  emqxCfg,
		producer: producer,
		logger:   logger,
	}
}

// Run starts the EMQX→Fluvio bridge. Blocks until ctx is cancelled.
func (b *EMQXBridge) Run(ctx context.Context) error {
	opts := mqtt.NewClientOptions().
		AddBroker(fmt.Sprintf("tcp://%s:%d", b.emqxCfg.Host, b.emqxCfg.Port)).
		SetClientID(b.emqxCfg.ClientID).
		SetUsername(b.emqxCfg.Username).
		SetPassword(b.emqxCfg.Password).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second).
		SetOnConnectHandler(func(c mqtt.Client) {
			b.logger.Info("[EMQXBridge] Connected to EMQX",
				zap.String("host", b.emqxCfg.Host),
				zap.Int("port", b.emqxCfg.Port),
			)
			// Subscribe to all well telemetry topics
			token := c.Subscribe("wells/+/+/+/+", 1, b.handleMessage)
			if token.Wait() && token.Error() != nil {
				b.logger.Error("[EMQXBridge] Subscribe failed", zap.Error(token.Error()))
			}
		}).
		SetConnectionLostHandler(func(c mqtt.Client, err error) {
			b.logger.Warn("[EMQXBridge] Connection lost, reconnecting...", zap.Error(err))
		})

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		b.logger.Warn("[EMQXBridge] Initial connect failed, will retry",
			zap.Error(token.Error()),
		)
	}

	<-ctx.Done()
	client.Disconnect(250)
	b.logger.Info("[EMQXBridge] Stopped")
	return nil
}

func (b *EMQXBridge) handleMessage(_ mqtt.Client, msg mqtt.Message) {
	record := EMQXTelemetryRecord{
		Topic:     msg.Topic(),
		Payload:   json.RawMessage(msg.Payload()),
		Timestamp: time.Now().UnixMilli(),
		Source:    "emqx-bridge",
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := b.producer.PublishEMQXTelemetry(ctx, []interface{}{record}); err != nil {
		b.logger.Warn("[EMQXBridge] Failed to publish to Fluvio", zap.Error(err))
	}
}

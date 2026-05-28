// fluvio_producer.rs — Fluvio dual-publish path for the OG-RMM Edge Agent
//
// Role in the pipeline:
//   Rust Edge Agent reads sensors (Modbus/OPC-UA/DNP3/MQTT)
//     └─► Kafka (Redpanda) → og.telemetry.raw  [primary, for stream processing]
//     └─► Fluvio           → og.field.telemetry.raw  [secondary, for archival/replay]
//
// When FLUVIO_DUAL_PUBLISH=true and FLUVIO_ENDPOINT is set, every telemetry
// batch is also published to Fluvio using its HTTP producer API.
// When Fluvio is unavailable, the agent continues without error (graceful degradation).

use anyhow::Result;
use serde::Serialize;
use tracing::{debug, warn};

/// Configuration for the Fluvio producer.
#[derive(Debug, Clone)]
pub struct FluvioConfig {
    /// e.g. "http://fluvio:9003"
    pub endpoint: String,
    /// Topic for raw telemetry: "og.field.telemetry.raw"
    pub telemetry_topic: String,
    /// Topic for alarms: "og.field.alarms"
    pub alarm_topic: String,
    /// Whether dual-publish is enabled
    pub enabled: bool,
}

impl FluvioConfig {
    pub fn from_env() -> Self {
        let endpoint = std::env::var("FLUVIO_ENDPOINT")
            .unwrap_or_else(|_| "http://fluvio:9003".to_string());
        let enabled = std::env::var("FLUVIO_DUAL_PUBLISH")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        Self {
            endpoint,
            telemetry_topic: std::env::var("FLUVIO_TOPIC_TELEMETRY")
                .unwrap_or_else(|_| "og.field.telemetry.raw".to_string()),
            alarm_topic: std::env::var("FLUVIO_TOPIC_ALARMS")
                .unwrap_or_else(|_| "og.field.alarms".to_string()),
            enabled,
        }
    }
}

/// FluvioProducer wraps the Fluvio HTTP producer API.
/// Uses the Fluvio REST API: POST /topics/{topic}/records
pub struct FluvioProducer {
    cfg: FluvioConfig,
    client: reqwest::Client,
}

#[derive(Serialize)]
struct FluvioRecord {
    value: String,
}

#[derive(Serialize)]
struct FluvioProduceRequest {
    records: Vec<FluvioRecord>,
}

impl FluvioProducer {
    pub fn new(cfg: FluvioConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("Failed to build Fluvio HTTP client");
        Self { cfg, client }
    }

    /// Publish a batch of serializable records to a Fluvio topic.
    /// Returns Ok(()) even if Fluvio is unavailable (graceful degradation).
    pub async fn publish<T: Serialize>(&self, topic: &str, records: &[T]) -> Result<()> {
        if !self.cfg.enabled || records.is_empty() {
            return Ok(());
        }

        let fluvio_records: Vec<FluvioRecord> = records
            .iter()
            .filter_map(|r| serde_json::to_string(r).ok().map(|v| FluvioRecord { value: v }))
            .collect();

        if fluvio_records.is_empty() {
            return Ok(());
        }

        let url = format!("{}/topics/{}/records", self.cfg.endpoint, topic);
        let body = FluvioProduceRequest { records: fluvio_records };

        match self.client.post(&url).json(&body).send().await {
            Ok(resp) if resp.status().is_success() => {
                debug!(
                    "[Fluvio] Published {} records to topic '{}'",
                    records.len(),
                    topic
                );
                Ok(())
            }
            Ok(resp) => {
                warn!(
                    "[Fluvio] Publish to '{}' rejected: HTTP {}",
                    topic,
                    resp.status()
                );
                Ok(()) // graceful degradation
            }
            Err(e) => {
                warn!("[Fluvio] Publish to '{}' failed: {} (continuing)", topic, e);
                Ok(()) // graceful degradation — Kafka path is primary
            }
        }
    }

    /// Publish telemetry readings to og.field.telemetry.raw
    pub async fn publish_telemetry<T: Serialize>(&self, readings: &[T]) -> Result<()> {
        self.publish(&self.cfg.telemetry_topic.clone(), readings).await
    }

    /// Publish alarm events to og.field.alarms
    pub async fn publish_alarms<T: Serialize>(&self, alarms: &[T]) -> Result<()> {
        self.publish(&self.cfg.alarm_topic.clone(), alarms).await
    }
}

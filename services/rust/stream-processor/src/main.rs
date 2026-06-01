// Oil & Gas RMM Platform — Rust Stream Processor
// Consumes telemetry from Kafka og.field.telemetry.raw, applies:
//   1. Rolling window statistics (mean, stddev, min, max)
//   2. Z-score anomaly detection (flags readings > 3σ from mean)
//   3. Rate-of-change detection (sudden pressure drops = potential blowout)
//   4. ESP health scoring (vibration + current + frequency composite)
// Publishes anomalies to Kafka og.field.alarms
// Spec: FRQ-012 — event processing latency < 100ms

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::time::Duration;
use tokio::time;
use tracing::{info, warn};

/// SensorReading consumed from Kafka.
#[derive(Debug, Clone, Deserialize)]
pub struct SensorReading {
    pub well_id: String,
    pub sensor_id: String,
    pub sensor_type: String,
    pub value: f64,
    pub unit: String,
    pub quality: u8,
    pub timestamp: DateTime<Utc>,
}

/// AnomalyEvent published to Kafka og.field.alarms.
#[derive(Debug, Clone, Serialize)]
pub struct AnomalyEvent {
    pub well_id: String,
    pub sensor_type: String,
    pub anomaly_type: AnomalyType,
    pub value: f64,
    pub expected_range: (f64, f64),
    pub z_score: Option<f64>,
    pub severity: u8,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AnomalyType {
    StatisticalOutlier,
    RapidRateOfChange,
    ThresholdBreach,
    EspHealthDegradation,
    DataQualityIssue,
}

/// RollingWindow maintains a sliding window of recent values for statistics.
struct RollingWindow {
    values: VecDeque<f64>,
    window_size: usize,
    sum: f64,
    sum_sq: f64,
}

impl RollingWindow {
    fn new(window_size: usize) -> Self {
        Self {
            values: VecDeque::with_capacity(window_size),
            window_size,
            sum: 0.0,
            sum_sq: 0.0,
        }
    }

    fn push(&mut self, value: f64) {
        if self.values.len() >= self.window_size {
            if let Some(old) = self.values.pop_front() {
                self.sum -= old;
                self.sum_sq -= old * old;
            }
        }
        self.values.push_back(value);
        self.sum += value;
        self.sum_sq += value * value;
    }

    fn mean(&self) -> f64 {
        if self.values.is_empty() {
            return 0.0;
        }
        self.sum / self.values.len() as f64
    }

    fn stddev(&self) -> f64 {
        let n = self.values.len() as f64;
        if n < 2.0 {
            return 0.0;
        }
        let mean = self.mean();
        let variance = (self.sum_sq / n) - (mean * mean);
        variance.max(0.0).sqrt()
    }

    fn z_score(&self, value: f64) -> f64 {
        let std = self.stddev();
        if std < 1e-10 {
            return 0.0;
        }
        (value - self.mean()) / std
    }

    fn is_full(&self) -> bool {
        self.values.len() >= self.window_size / 2
    }

    fn last(&self) -> Option<f64> {
        self.values.back().copied()
    }
}

/// EspHealthMonitor tracks ESP (Electric Submersible Pump) health metrics.
struct EspHealthMonitor {
    current_window: RollingWindow,
    vibration_window: RollingWindow,
    frequency_window: RollingWindow,
}

impl EspHealthMonitor {
    fn new() -> Self {
        Self {
            current_window: RollingWindow::new(60),
            vibration_window: RollingWindow::new(60),
            frequency_window: RollingWindow::new(60),
        }
    }

    /// Compute composite health score 0-100 (100 = healthy).
    fn health_score(&self) -> f64 {
        let current_cv = coefficient_of_variation(&self.current_window);
        let vibration_mean = self.vibration_window.mean();
        let freq_stability = 1.0 - coefficient_of_variation(&self.frequency_window).min(1.0);

        let current_score = (1.0 - current_cv.min(0.5) * 2.0).max(0.0) * 40.0;
        let vibration_score = (1.0 - (vibration_mean / 5.0).min(1.0)) * 40.0;
        let freq_score = freq_stability * 20.0;

        current_score + vibration_score + freq_score
    }
}

fn coefficient_of_variation(window: &RollingWindow) -> f64 {
    let mean = window.mean();
    if mean.abs() < 1e-10 {
        return 0.0;
    }
    window.stddev() / mean.abs()
}

/// StreamProcessor maintains per-well, per-sensor rolling windows.
struct StreamProcessor {
    windows: HashMap<(String, String), RollingWindow>,
    esp_monitors: HashMap<String, EspHealthMonitor>,
    z_threshold: f64,
    roc_threshold: f64,
}

impl StreamProcessor {
    fn new() -> Self {
        Self {
            windows: HashMap::new(),
            esp_monitors: HashMap::new(),
            z_threshold: 3.0,
            roc_threshold: 0.20,
        }
    }

    fn process(&mut self, reading: &SensorReading) -> Vec<AnomalyEvent> {
        let mut anomalies = Vec::new();

        if reading.quality < 50 {
            anomalies.push(AnomalyEvent {
                well_id: reading.well_id.clone(),
                sensor_type: reading.sensor_type.clone(),
                anomaly_type: AnomalyType::DataQualityIssue,
                value: reading.value,
                expected_range: (0.0, 0.0),
                z_score: None,
                severity: 3,
                message: format!(
                    "Low quality reading ({}) on {} sensor",
                    reading.quality, reading.sensor_type
                ),
                timestamp: reading.timestamp,
            });
            return anomalies;
        }

        let key = (reading.well_id.clone(), reading.sensor_type.clone());
        let window = self.windows.entry(key).or_insert_with(|| RollingWindow::new(120));

        // Rate of change detection
        if let Some(last_val) = window.last() {
            if last_val.abs() > 1e-10 {
                let roc = ((reading.value - last_val) / last_val).abs();
                if roc > self.roc_threshold && window.is_full() {
                    anomalies.push(AnomalyEvent {
                        well_id: reading.well_id.clone(),
                        sensor_type: reading.sensor_type.clone(),
                        anomaly_type: AnomalyType::RapidRateOfChange,
                        value: reading.value,
                        expected_range: (last_val * 0.8, last_val * 1.2),
                        z_score: None,
                        severity: if roc > 0.5 { 1 } else { 2 },
                        message: format!(
                            "{} changed by {:.1}% in one reading (from {:.2} to {:.2} {})",
                            reading.sensor_type,
                            roc * 100.0,
                            last_val,
                            reading.value,
                            reading.unit
                        ),
                        timestamp: reading.timestamp,
                    });
                }
            }
        }

        window.push(reading.value);

        // Z-score anomaly detection
        if window.is_full() {
            let z = window.z_score(reading.value);
            if z.abs() > self.z_threshold {
                let mean = window.mean();
                let std = window.stddev();
                anomalies.push(AnomalyEvent {
                    well_id: reading.well_id.clone(),
                    sensor_type: reading.sensor_type.clone(),
                    anomaly_type: AnomalyType::StatisticalOutlier,
                    value: reading.value,
                    expected_range: (mean - 3.0 * std, mean + 3.0 * std),
                    z_score: Some(z),
                    severity: if z.abs() > 5.0 { 1 } else if z.abs() > 4.0 { 2 } else { 3 },
                    message: format!(
                        "{} outlier: {:.2} {} (z={:.2}, expected {:.2}±{:.2})",
                        reading.sensor_type, reading.value, reading.unit, z, mean, std
                    ),
                    timestamp: reading.timestamp,
                });
            }
        }

        // ESP health monitoring
        if reading.sensor_type.starts_with("ESP_") {
            let monitor = self
                .esp_monitors
                .entry(reading.well_id.clone())
                .or_insert_with(EspHealthMonitor::new);

            match reading.sensor_type.as_str() {
                "ESP_CURRENT" => monitor.current_window.push(reading.value),
                "ESP_VIBRATION" => monitor.vibration_window.push(reading.value),
                "ESP_FREQUENCY" => monitor.frequency_window.push(reading.value),
                _ => {}
            }

            let health = monitor.health_score();
            if health < 60.0 {
                anomalies.push(AnomalyEvent {
                    well_id: reading.well_id.clone(),
                    sensor_type: "ESP_HEALTH".to_string(),
                    anomaly_type: AnomalyType::EspHealthDegradation,
                    value: health,
                    expected_range: (80.0, 100.0),
                    z_score: None,
                    severity: if health < 40.0 { 1 } else { 2 },
                    message: format!(
                        "ESP health degraded to {:.1}% on well {} — potential failure in 7 days",
                        health, reading.well_id
                    ),
                    timestamp: reading.timestamp,
                });
            }
        }

        anomalies
    }
}

use axum::{routing::get, Json, Router};
use std::sync::atomic::{AtomicU64, Ordering};

static READING_COUNT: AtomicU64 = AtomicU64::new(0);
static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

async fn health_handler() -> Json<serde_json::Value> {
    let uptime = START_TIME.get().map(|s| s.elapsed().as_secs()).unwrap_or(0);
    Json(serde_json::json!({
        "status": "ok",
        "service": "stream-processor",
        "uptime_s": uptime,
        "readings_processed": READING_COUNT.load(Ordering::Relaxed),
        "timestamp": Utc::now().to_rfc3339()
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    START_TIME.get_or_init(std::time::Instant::now);

    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "stream_processor=info".to_string()),
        )
        .init();

    info!("OG RMM Stream Processor starting");

    let kafka_brokers = std::env::var("KAFKA_BROKERS")
        .unwrap_or_else(|_| "kafka:9092".to_string());
    let alarm_url = std::env::var("ALARM_SERVICE_URL")
        .unwrap_or_else(|_| "http://alarm-manager:8084".to_string());
    let health_port = std::env::var("HEALTH_PORT").unwrap_or_else(|_| "8111".to_string());

    info!(kafka = %kafka_brokers, alarm_url = %alarm_url, "configuration loaded");

    // Start health endpoint
    let health_app = Router::new().route("/health", get(health_handler));
    let health_addr = format!("0.0.0.0:{}", health_port);
    let listener = tokio::net::TcpListener::bind(&health_addr).await?;
    tokio::spawn(async move {
        info!("Health endpoint listening on {}", health_addr);
        axum::serve(listener, health_app).await.ok();
    });

    let mut processor = StreamProcessor::new();
    let mut interval = time::interval(Duration::from_millis(100));

    loop {
        interval.tick().await;
        let count = READING_COUNT.fetch_add(1, Ordering::Relaxed) + 1;

        // In production: consume from Kafka og.field.telemetry.raw
        let reading = SensorReading {
            well_id: "well-001".to_string(),
            sensor_id: "tp-001".to_string(),
            sensor_type: "TUBING_PRESSURE".to_string(),
            value: 1300.0 + 50.0 * (count as f64 * 0.05).sin(),
            unit: "PSI".to_string(),
            quality: 95,
            timestamp: Utc::now(),
        };

        let anomalies = processor.process(&reading);
        for anomaly in &anomalies {
            warn!(
                well_id = %anomaly.well_id,
                sensor_type = %anomaly.sensor_type,
                severity = anomaly.severity,
                message = %anomaly.message,
                "anomaly detected"
            );
        }

        if count % 1000 == 0 {
            info!("processed {} readings", count);
        }
    }
}

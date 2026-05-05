use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

use dashmap::DashMap;
use serde_json::json;
use tracing::info;

use crate::models::{Channel, ChannelMetrics, EngineMetrics};

/// Thread-safe metrics collector for the bulk send engine
pub struct MetricsCollector {
    start_time: Instant,
    total_processed: AtomicU64,
    total_sent: AtomicU64,
    total_failed: AtomicU64,
    total_retried: AtomicU64,
    channel_sent: DashMap<String, AtomicU64>,
    channel_failed: DashMap<String, AtomicU64>,
    channel_latency_sum: DashMap<String, AtomicU64>,
    channel_latency_count: DashMap<String, AtomicU64>,
    channel_latency_max: DashMap<String, AtomicU64>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            total_processed: AtomicU64::new(0),
            total_sent: AtomicU64::new(0),
            total_failed: AtomicU64::new(0),
            total_retried: AtomicU64::new(0),
            channel_sent: DashMap::new(),
            channel_failed: DashMap::new(),
            channel_latency_sum: DashMap::new(),
            channel_latency_count: DashMap::new(),
            channel_latency_max: DashMap::new(),
        }
    }

    pub fn record_sent(&self, channel: &Channel, latency_ms: u64) {
        self.total_processed.fetch_add(1, Ordering::Relaxed);
        self.total_sent.fetch_add(1, Ordering::Relaxed);

        let key = channel.to_string();

        self.channel_sent
            .entry(key.clone())
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(1, Ordering::Relaxed);

        self.channel_latency_sum
            .entry(key.clone())
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(latency_ms, Ordering::Relaxed);

        self.channel_latency_count
            .entry(key.clone())
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(1, Ordering::Relaxed);

        self.channel_latency_max
            .entry(key)
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_max(latency_ms, Ordering::Relaxed);
    }

    pub fn record_failed(&self, channel: &Channel) {
        self.total_processed.fetch_add(1, Ordering::Relaxed);
        self.total_failed.fetch_add(1, Ordering::Relaxed);

        let key = channel.to_string();
        self.channel_failed
            .entry(key)
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_retry(&self) {
        self.total_retried.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self, queue_depth: u64, retry_queue_depth: u64) -> EngineMetrics {
        let uptime = self.start_time.elapsed().as_secs();
        let total_processed = self.total_processed.load(Ordering::Relaxed);
        let throughput = if uptime > 0 {
            total_processed as f64 / uptime as f64
        } else {
            0.0
        };

        let mut channels = HashMap::new();

        for entry in self.channel_sent.iter() {
            let key = entry.key().clone();
            let sent = entry.value().load(Ordering::Relaxed);
            let failed = self
                .channel_failed
                .get(&key)
                .map(|v| v.load(Ordering::Relaxed))
                .unwrap_or(0);
            let latency_sum = self
                .channel_latency_sum
                .get(&key)
                .map(|v| v.load(Ordering::Relaxed))
                .unwrap_or(0);
            let latency_count = self
                .channel_latency_count
                .get(&key)
                .map(|v| v.load(Ordering::Relaxed))
                .unwrap_or(1);
            let latency_max = self
                .channel_latency_max
                .get(&key)
                .map(|v| v.load(Ordering::Relaxed))
                .unwrap_or(0);

            channels.insert(
                key,
                ChannelMetrics {
                    sent,
                    delivered: sent, // approximation until delivery receipts
                    failed,
                    retried: 0,
                    rate_limited: 0,
                    avg_latency_ms: latency_sum as f64 / latency_count as f64,
                    p99_latency_ms: latency_max,
                },
            );
        }

        EngineMetrics {
            total_processed,
            total_sent: self.total_sent.load(Ordering::Relaxed),
            total_failed: self.total_failed.load(Ordering::Relaxed),
            total_retried: self.total_retried.load(Ordering::Relaxed),
            queue_depth,
            retry_queue_depth,
            throughput_per_sec: throughput,
            channels,
            uptime_seconds: uptime,
        }
    }

    /// Publish metrics to Redis for dashboard consumption
    pub async fn publish_to_redis(
        &self,
        redis: &mut redis::aio::ConnectionManager,
        queue_depth: u64,
        retry_queue_depth: u64,
    ) {
        let metrics = self.snapshot(queue_depth, retry_queue_depth);
        let payload = serde_json::to_string(&metrics).unwrap_or_default();

        let _: Result<(), _> = redis::cmd("SET")
            .arg("bulk_sender:metrics")
            .arg(&payload)
            .arg("EX")
            .arg(60)
            .query_async(redis)
            .await;

        let _: Result<(), _> = redis::cmd("PUBLISH")
            .arg("bulk_sender:metrics_updates")
            .arg(&payload)
            .query_async(redis)
            .await;

        info!(
            "Metrics: processed={} sent={} failed={} throughput={:.1}/s",
            metrics.total_processed,
            metrics.total_sent,
            metrics.total_failed,
            metrics.throughput_per_sec
        );
    }
}

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use tracing::{info, warn, error};
use tracing_subscriber::EnvFilter;

mod engine;
mod models;
mod rate_limiter;
mod retry;
mod channels;
mod metrics;

use engine::BulkSendEngine;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    info!("Starting Bulk Send Engine v0.1.0");

    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let kafka_brokers = std::env::var("KAFKA_BROKERS")
        .unwrap_or_else(|_| "localhost:9092".to_string());
    let default_rate_limit: u32 = std::env::var("DEFAULT_RATE_LIMIT")
        .unwrap_or_else(|_| "100".to_string())
        .parse()
        .unwrap_or(100);
    let worker_count: usize = std::env::var("WORKER_COUNT")
        .unwrap_or_else(|_| "8".to_string())
        .parse()
        .unwrap_or(8);

    let engine = Arc::new(
        BulkSendEngine::new(
            &redis_url,
            &kafka_brokers,
            default_rate_limit,
            worker_count,
        )
        .await?,
    );

    info!(
        "Engine initialized: {} workers, {} msg/s rate limit",
        worker_count, default_rate_limit
    );

    let engine_clone = engine.clone();
    let consumer_handle = tokio::spawn(async move {
        if let Err(e) = engine_clone.start_consuming().await {
            error!("Consumer error: {}", e);
        }
    });

    let engine_clone = engine.clone();
    let retry_handle = tokio::spawn(async move {
        loop {
            if let Err(e) = engine_clone.process_retry_queue().await {
                warn!("Retry queue error: {}", e);
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });

    let engine_clone = engine.clone();
    let metrics_handle = tokio::spawn(async move {
        loop {
            engine_clone.report_metrics().await;
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    info!("Bulk Send Engine running. Press Ctrl+C to stop.");
    tokio::signal::ctrl_c().await?;
    info!("Shutting down gracefully...");

    consumer_handle.abort();
    retry_handle.abort();
    metrics_handle.abort();

    info!("Bulk Send Engine stopped.");
    Ok(())
}

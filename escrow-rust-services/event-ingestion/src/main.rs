//! Event Ingestion Service for EscrowProtect Platform
//!
//! High-throughput Kafka consumer that processes platform events,
//! performs enrichment, deduplication, and triggers webhook deliveries.
//!
//! Features:
//! - Kafka consumer with configurable parallelism
//! - Event deduplication using Redis
//! - Idempotent processing with outbox pattern
//! - RustFS integration for event archival
//! - Prometheus metrics for observability

mod consumer;
mod enrichment;
mod handlers;
mod outbox;
mod storage;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    routing::get,
    Router,
};
use tower_http::trace::TraceLayer;
use tracing::{info, Level};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use escrow_common::{
    config::AppConfig,
    db::create_pool,
    redis_client::RedisClient,
};

use crate::consumer::EventConsumer;
use crate::handlers::AppState;
use crate::storage::RustFSClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "event_ingestion=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Event Ingestion Service");

    let config = AppConfig::from_env("event-ingestion")?;
    
    let db_pool = create_pool(&config.database).await?;
    info!("Database connection pool created");

    let redis_client = RedisClient::new(&config.redis).await?;
    info!("Redis client connected");

    let rustfs_client = RustFSClient::new(&config.rustfs).await?;
    info!("RustFS client initialized");

    let consumer = Arc::new(
        EventConsumer::new(
            &config.kafka,
            db_pool.clone(),
            redis_client.clone(),
            rustfs_client.clone(),
        ).await?
    );

    let consumer_clone = consumer.clone();
    tokio::spawn(async move {
        consumer_clone.start().await;
    });

    let state = AppState {
        db: db_pool,
        redis: redis_client,
        rustfs: rustfs_client,
    };

    let app = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/ready", get(handlers::readiness_check))
        .route("/metrics", get(handlers::metrics))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Event Ingestion Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Event Ingestion Service shutting down");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    info!("Received shutdown signal");
}

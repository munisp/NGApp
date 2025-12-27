//! Webhook Dispatcher Service for EscrowProtect Platform
//!
//! High-performance, concurrent webhook delivery service built in Rust.
//! Features:
//! - Exponential backoff with jitter for retries
//! - Concurrent delivery with configurable parallelism
//! - HMAC-SHA256 signature generation
//! - Dead letter queue for failed deliveries
//! - Prometheus metrics for observability
//! - Graceful shutdown handling

mod dispatcher;
mod handlers;
mod repository;
mod retry;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing::{info, Level};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use escrow_common::{
    config::AppConfig,
    db::create_pool,
    redis_client::RedisClient,
};

use crate::dispatcher::WebhookDispatcher;
use crate::handlers::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "webhook_dispatcher=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Webhook Dispatcher Service");

    let config = AppConfig::from_env("webhook-dispatcher")?;
    
    let db_pool = create_pool(&config.database).await?;
    info!("Database connection pool created");

    let redis_client = RedisClient::new(&config.redis).await?;
    info!("Redis client connected");

    let dispatcher = Arc::new(
        WebhookDispatcher::new(db_pool.clone(), redis_client.clone()).await?
    );

    let dispatcher_clone = dispatcher.clone();
    tokio::spawn(async move {
        dispatcher_clone.start_retry_processor().await;
    });

    let state = AppState {
        db: db_pool,
        redis: redis_client,
        dispatcher,
    };

    let app = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/ready", get(handlers::readiness_check))
        .route("/metrics", get(handlers::metrics))
        .route("/api/v1/webhooks/endpoints", post(handlers::create_endpoint))
        .route("/api/v1/webhooks/endpoints", get(handlers::list_endpoints))
        .route("/api/v1/webhooks/endpoints/:id", get(handlers::get_endpoint))
        .route("/api/v1/webhooks/endpoints/:id", axum::routing::delete(handlers::delete_endpoint))
        .route("/api/v1/webhooks/deliver", post(handlers::deliver_webhook))
        .route("/api/v1/webhooks/deliveries", get(handlers::list_deliveries))
        .route("/api/v1/webhooks/deliveries/:id/retry", post(handlers::retry_delivery))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Webhook Dispatcher listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Webhook Dispatcher shutting down");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    info!("Received shutdown signal");
}

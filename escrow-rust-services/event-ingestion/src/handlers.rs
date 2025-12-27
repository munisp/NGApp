//! HTTP handlers for event ingestion service

use axum::{
    extract::State,
    Json,
};
use chrono::Utc;
use serde::Serialize;
use sqlx::PgPool;

use escrow_common::{
    db::health_check as db_health_check,
    redis_client::RedisClient,
};

use crate::storage::RustFSClient;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisClient,
    pub rustfs: RustFSClient,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub timestamp: String,
}

#[derive(Serialize)]
pub struct ReadinessResponse {
    pub ready: bool,
    pub database: bool,
    pub redis: bool,
    pub rustfs: bool,
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "event-ingestion".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

pub async fn readiness_check(State(state): State<AppState>) -> Json<ReadinessResponse> {
    let db_ok = db_health_check(&state.db).await;
    let mut redis = state.redis.clone();
    let redis_ok = redis.health_check().await;
    let rustfs_ok = state.rustfs.health_check().await;

    Json(ReadinessResponse {
        ready: db_ok && redis_ok && rustfs_ok,
        database: db_ok,
        redis: redis_ok,
        rustfs: rustfs_ok,
    })
}

pub async fn metrics() -> &'static str {
    "# Prometheus metrics placeholder\n"
}

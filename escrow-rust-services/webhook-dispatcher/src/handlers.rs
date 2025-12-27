//! HTTP handlers for webhook dispatcher API

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use escrow_common::{
    db::health_check as db_health_check,
    redis_client::RedisClient,
    types::{DeliveryStatus, WebhookEndpoint, WebhookEventType},
};

use crate::dispatcher::WebhookDispatcher;
use crate::repository::WebhookRepository;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: RedisClient,
    pub dispatcher: Arc<WebhookDispatcher>,
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
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "webhook-dispatcher".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

pub async fn readiness_check(State(state): State<AppState>) -> Json<ReadinessResponse> {
    let db_ok = db_health_check(&state.db).await;
    let mut redis = state.redis.clone();
    let redis_ok = redis.health_check().await;

    Json(ReadinessResponse {
        ready: db_ok && redis_ok,
        database: db_ok,
        redis: redis_ok,
    })
}

pub async fn metrics() -> impl IntoResponse {
    "# Prometheus metrics placeholder\n"
}

#[derive(Deserialize)]
pub struct CreateEndpointRequest {
    pub merchant_id: Uuid,
    pub url: String,
    pub events: Vec<WebhookEventType>,
}

#[derive(Serialize)]
pub struct EndpointResponse {
    pub id: Uuid,
    pub merchant_id: Uuid,
    pub url: String,
    pub secret: String,
    pub events: Vec<WebhookEventType>,
    pub enabled: bool,
    pub created_at: String,
}

impl From<WebhookEndpoint> for EndpointResponse {
    fn from(e: WebhookEndpoint) -> Self {
        Self {
            id: e.id,
            merchant_id: e.merchant_id,
            url: e.url,
            secret: e.secret,
            events: e.events,
            enabled: e.enabled,
            created_at: e.created_at.to_rfc3339(),
        }
    }
}

pub async fn create_endpoint(
    State(state): State<AppState>,
    Json(req): Json<CreateEndpointRequest>,
) -> Result<Json<EndpointResponse>, (StatusCode, String)> {
    let secret = generate_secret();
    
    let endpoint = WebhookEndpoint {
        id: Uuid::new_v4(),
        merchant_id: req.merchant_id,
        url: req.url,
        secret,
        events: req.events,
        enabled: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let repo = WebhookRepository::new(state.db);
    repo.create_endpoint(&endpoint)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(endpoint.into()))
}

#[derive(Deserialize)]
pub struct ListEndpointsQuery {
    pub merchant_id: Uuid,
}

pub async fn list_endpoints(
    State(state): State<AppState>,
    Query(query): Query<ListEndpointsQuery>,
) -> Result<Json<Vec<EndpointResponse>>, (StatusCode, String)> {
    let repo = WebhookRepository::new(state.db);
    let endpoints = repo
        .list_endpoints(query.merchant_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(endpoints.into_iter().map(Into::into).collect()))
}

pub async fn get_endpoint(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<EndpointResponse>, (StatusCode, String)> {
    let repo = WebhookRepository::new(state.db);
    let endpoint = repo
        .get_endpoint(id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Endpoint not found".to_string()))?;

    Ok(Json(endpoint.into()))
}

pub async fn delete_endpoint(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let repo = WebhookRepository::new(state.db);
    let deleted = repo
        .delete_endpoint(id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, "Endpoint not found".to_string()))
    }
}

#[derive(Deserialize)]
pub struct DeliverWebhookRequest {
    pub endpoint_id: Uuid,
    pub event_type: WebhookEventType,
    pub payload: serde_json::Value,
}

#[derive(Serialize)]
pub struct DeliveryResponse {
    pub id: Uuid,
    pub endpoint_id: Uuid,
    pub event_type: WebhookEventType,
    pub status: DeliveryStatus,
    pub attempts: i32,
    pub created_at: String,
}

pub async fn deliver_webhook(
    State(state): State<AppState>,
    Json(req): Json<DeliverWebhookRequest>,
) -> Result<Json<DeliveryResponse>, (StatusCode, String)> {
    let delivery = state
        .dispatcher
        .queue_delivery(req.endpoint_id, req.event_type, req.payload)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(DeliveryResponse {
        id: delivery.id,
        endpoint_id: delivery.endpoint_id,
        event_type: delivery.event_type,
        status: delivery.status,
        attempts: delivery.attempts,
        created_at: delivery.created_at.to_rfc3339(),
    }))
}

#[derive(Deserialize)]
pub struct ListDeliveriesQuery {
    pub endpoint_id: Option<Uuid>,
    pub status: Option<DeliveryStatus>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    100
}

pub async fn list_deliveries(
    State(state): State<AppState>,
    Query(query): Query<ListDeliveriesQuery>,
) -> Result<Json<Vec<DeliveryResponse>>, (StatusCode, String)> {
    let repo = WebhookRepository::new(state.db);
    let deliveries = repo
        .list_deliveries(query.endpoint_id, query.status, query.limit)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        deliveries
            .into_iter()
            .map(|d| DeliveryResponse {
                id: d.id,
                endpoint_id: d.endpoint_id,
                event_type: d.event_type,
                status: d.status,
                attempts: d.attempts,
                created_at: d.created_at.to_rfc3339(),
            })
            .collect(),
    ))
}

pub async fn retry_delivery(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DeliveryResponse>, (StatusCode, String)> {
    let repo = WebhookRepository::new(state.db);
    
    let mut delivery = repo
        .get_delivery(id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Delivery not found".to_string()))?;

    let endpoint = repo
        .get_endpoint(delivery.endpoint_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Endpoint not found".to_string()))?;

    delivery.status = DeliveryStatus::Pending;
    delivery.attempts = 0;
    delivery.max_attempts = 5;

    state
        .dispatcher
        .deliver(&endpoint, &mut delivery)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(DeliveryResponse {
        id: delivery.id,
        endpoint_id: delivery.endpoint_id,
        event_type: delivery.event_type,
        status: delivery.status,
        attempts: delivery.attempts,
        created_at: delivery.created_at.to_rfc3339(),
    }))
}

fn generate_secret() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    format!("whsec_{}", hex::encode(bytes))
}

use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "cache-invalidation",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "cache-invalidation-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "cache-invalidation-rs", "route": "/v1/cache-invalidation"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "invalidation_channels": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Redis Pub/Sub Cache Invalidation" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8536".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "CI-001", "channel": "accounts:*", "subscribers": 12, "invalidations24h": 4520, "avgPropagationMs": 2.1, "pattern": "prefix", "status": "active"}, {"id": "CI-002", "channel": "transactions:*", "subscribers": 8, "invalidations24h": 12340, "avgPropagationMs": 1.8, "pattern": "prefix", "status": "active"}, {"id": "CI-003", "channel": "kyc:*", "subscribers": 6, "invalidations24h": 890, "avgPropagationMs": 3.2, "pattern": "prefix", "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Redis Pub/Sub Cache Invalidation on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/cache-invalidation/list", web::get().to(list))
            .route("/v1/cache-invalidation/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

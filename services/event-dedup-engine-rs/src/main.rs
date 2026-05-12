use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "event-dedup",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "event-dedup-engine-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "event-dedup-engine-rs", "route": "/v1/event-dedup"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "dedup_configs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Event Deduplication Engine" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8563".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "ED-001", "topic": "transactions", "windowMs": 5000, "strategy": "idempotency-key", "duplicatesBlocked24h": 12340, "totalEvents24h": 4523000, "dedupRate": "0.27%", "redisMemoryMB": 23, "status": "active"}, {"id": "ED-002", "topic": "fraud-events", "windowMs": 10000, "strategy": "content-hash", "duplicatesBlocked24h": 890, "totalEvents24h": 1234000, "dedupRate": "0.07%", "redisMemoryMB": 12, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Event Deduplication Engine on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/event-dedup/list", web::get().to(list))
            .route("/v1/event-dedup/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

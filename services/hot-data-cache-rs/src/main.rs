use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "hot-data-cache",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "hot-data-cache-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "hot-data-cache-rs", "route": "/v1/hot-data-cache"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "hot_caches": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Service-Level Hot Data Cache" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8544".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "HD-001", "service": "account-service", "cacheType": "LRU", "maxEntries": 50000, "currentEntries": 34560, "hitRate": "94.2%", "evictions24h": 12340, "memoryMB": 64, "ttlSeconds": 30, "status": "active"}, {"id": "HD-002", "service": "transaction-service", "cacheType": "LFU", "maxEntries": 100000, "currentEntries": 78900, "hitRate": "91.8%", "evictions24h": 23450, "memoryMB": 128, "ttlSeconds": 15, "status": "active"}, {"id": "HD-003", "service": "kyc-service", "cacheType": "ARC", "maxEntries": 25000, "currentEntries": 18900, "hitRate": "96.1%", "evictions24h": 4560, "memoryMB": 32, "ttlSeconds": 60, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Service-Level Hot Data Cache on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/hot-data-cache/list", web::get().to(list))
            .route("/v1/hot-data-cache/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

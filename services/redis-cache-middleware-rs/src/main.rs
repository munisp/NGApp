use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "redis-cache",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "redis-cache-middleware-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "redis-cache-middleware-rs", "route": "/v1/redis-cache"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "cache_entries": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Redis Response Cache Middleware" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8534".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "RC-001", "route": "/api/accounts", "ttlSeconds": 30, "hitCount": 45230, "missCount": 3201, "hitRate": "93.4%", "avgLatencyMs": 0.8, "memoryMB": 12.4, "status": "active"}, {"id": "RC-002", "route": "/api/transactions", "ttlSeconds": 15, "hitCount": 89120, "missCount": 12340, "hitRate": "87.8%", "avgLatencyMs": 1.2, "memoryMB": 28.7, "status": "active"}, {"id": "RC-003", "route": "/api/dashboard/kpis", "ttlSeconds": 60, "hitCount": 15670, "missCount": 890, "hitRate": "94.6%", "avgLatencyMs": 0.3, "memoryMB": 2.1, "status": "active"}, {"id": "RC-004", "route": "/api/customers", "ttlSeconds": 30, "hitCount": 34560, "missCount": 4230, "hitRate": "89.1%", "avgLatencyMs": 0.9, "memoryMB": 8.5, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Redis Response Cache Middleware on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/redis-cache/list", web::get().to(list))
            .route("/v1/redis-cache/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

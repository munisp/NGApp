use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "query-cache",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "query-cache-engine-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "query-cache-engine-rs", "route": "/v1/query-cache"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "cached_queries": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Query Result Cache with TTL" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8540".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "QC-001", "queryHash": "a1b2c3d4", "table": "transactions", "resultCount": 2500, "ttlSeconds": 30, "hitCount": 12340, "missCount": 890, "hitRate": "93.3%", "cacheSizeKB": 156, "status": "active"}, {"id": "QC-002", "queryHash": "e5f6g7h8", "table": "accounts", "resultCount": 150, "ttlSeconds": 60, "hitCount": 8920, "missCount": 340, "hitRate": "96.3%", "cacheSizeKB": 23, "status": "active"}, {"id": "QC-003", "queryHash": "i9j0k1l2", "table": "audit_logs", "resultCount": 10000, "ttlSeconds": 15, "hitCount": 45230, "missCount": 5670, "hitRate": "88.9%", "cacheSizeKB": 890, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Query Result Cache with TTL on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/query-cache/list", web::get().to(list))
            .route("/v1/query-cache/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

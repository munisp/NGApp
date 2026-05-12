use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "bloom-filter",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "bloom-filter-cache-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "bloom-filter-cache-rs", "route": "/v1/bloom-filter"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "bloom_filters": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Redis Bloom Filter Negative Cache" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8537".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "BF-001", "name": "account_ids", "capacity": 10000000, "falsePositiveRate": "0.01%", "bitsPerElement": 14.4, "hashFunctions": 10, "memoryMB": 17.1, "lookups24h": 234560, "negativeCacheHits": "34.2%", "status": "active"}, {"id": "BF-002", "name": "transaction_refs", "capacity": 50000000, "falsePositiveRate": "0.001%", "bitsPerElement": 19.2, "hashFunctions": 13, "memoryMB": 114.4, "lookups24h": 890120, "negativeCacheHits": "28.7%", "status": "active"}, {"id": "BF-003", "name": "customer_bvns", "capacity": 5000000, "falsePositiveRate": "0.01%", "bitsPerElement": 14.4, "hashFunctions": 10, "memoryMB": 8.6, "lookups24h": 45230, "negativeCacheHits": "41.5%", "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Redis Bloom Filter Negative Cache on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/bloom-filter/list", web::get().to(list))
            .route("/v1/bloom-filter/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

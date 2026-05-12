use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "fast-json",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "fast-json-serializer-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "fast-json-serializer-rs", "route": "/v1/fast-json"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "schema_configs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Pre-compiled JSON Serializer" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8553".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "FJ-001", "schema": "AccountResponse", "compiledSizeBytes": 1234, "serializationsPerSec": 890000, "avgSerializeNs": 1120, "vsStdJsonSpeedup": "3.2x", "status": "active"}, {"id": "FJ-002", "schema": "TransactionResponse", "compiledSizeBytes": 2345, "serializationsPerSec": 670000, "avgSerializeNs": 1490, "vsStdJsonSpeedup": "2.8x", "status": "active"}, {"id": "FJ-003", "schema": "CustomerResponse", "compiledSizeBytes": 3456, "serializationsPerSec": 450000, "avgSerializeNs": 2220, "vsStdJsonSpeedup": "2.5x", "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Pre-compiled JSON Serializer on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/fast-json/list", web::get().to(list))
            .route("/v1/fast-json/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

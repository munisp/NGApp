use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "response-compressor",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "response-compressor-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "response-compressor-rs", "route": "/v1/response-compressor"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "compression_configs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Per-Service Response Compressor" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8547".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "CO-001", "algorithm": "brotli", "level": 4, "minBytes": 1024, "compressionRatio": "4.2x", "bandwidthSaved24h": "12.4GB", "avgCompressionMs": 0.8, "status": "active"}, {"id": "CO-002", "algorithm": "gzip", "level": 6, "minBytes": 512, "compressionRatio": "3.1x", "bandwidthSaved24h": "8.9GB", "avgCompressionMs": 0.4, "status": "active"}, {"id": "CO-003", "algorithm": "zstd", "level": 3, "minBytes": 1024, "compressionRatio": "4.8x", "bandwidthSaved24h": "15.2GB", "avgCompressionMs": 0.6, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Per-Service Response Compressor on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/response-compressor/list", web::get().to(list))
            .route("/v1/response-compressor/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

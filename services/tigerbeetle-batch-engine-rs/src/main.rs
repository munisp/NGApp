use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "tb-batch",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "tigerbeetle-batch-engine-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "tigerbeetle-batch-engine-rs", "route": "/v1/tb-batch"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "batch_configs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "TigerBeetle Batch Transfer Engine" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8565".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "TB-001", "batchSize": 8190, "avgBatchLatencyMs": 1.2, "throughputTps": 1200000, "transfersProcessed24h": 89000000, "pendingBatches": 0, "status": "active"}, {"id": "TB-002", "batchSize": 4095, "avgBatchLatencyMs": 0.8, "throughputTps": 890000, "transfersProcessed24h": 45000000, "pendingBatches": 0, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("TigerBeetle Batch Transfer Engine on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/tb-batch/list", web::get().to(list))
            .route("/v1/tb-batch/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

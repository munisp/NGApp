use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "table-partitioner",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "table-partitioner-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "table-partitioner-rs", "route": "/v1/table-partitioner"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "partition_configs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Time-Series Table Partitioner" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8542".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "TP-001", "table": "transactions", "partitionKey": "created_at", "type": "range_monthly", "activePartitions": 84, "rowsPerPartition": "10M", "totalRows": "840M", "prunePolicy": "84 months", "status": "active"}, {"id": "TP-002", "table": "audit_logs", "partitionKey": "timestamp", "type": "range_monthly", "activePartitions": 84, "rowsPerPartition": "5M", "totalRows": "420M", "prunePolicy": "84 months", "status": "active"}, {"id": "TP-003", "table": "event_store", "partitionKey": "timestamp", "type": "range_monthly", "activePartitions": 60, "rowsPerPartition": "20M", "totalRows": "1.2B", "prunePolicy": "60 months", "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Time-Series Table Partitioner on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/table-partitioner/list", web::get().to(list))
            .route("/v1/table-partitioner/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

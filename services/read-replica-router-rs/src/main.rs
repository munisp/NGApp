use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState {
    data: RwLock<serde_json::Value>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "read-replica",
        "status": "healthy",
        "version": "1.0.0",
        "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "read-replica-router-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "read-replica-router-rs", "route": "/v1/read-replica"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}
    }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "replica_configs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "PostgreSQL Read Replica Router" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8568".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#'[{"id": "RR-001", "replicaHost": "pg-replica-1", "lag_ms": 2, "assignedQueries": ["SELECT", "dashboard", "reports"], "queriesRouted24h": 2340000, "loadPct": 45, "status": "active"}, {"id": "RR-002", "replicaHost": "pg-replica-2", "lag_ms": 3, "assignedQueries": ["SELECT", "analytics", "exports"], "queriesRouted24h": 1890000, "loadPct": 38, "status": "active"}, {"id": "RR-003", "replicaHost": "pg-replica-3", "lag_ms": 1, "assignedQueries": ["SELECT", "search", "listings"], "queriesRouted24h": 3450000, "loadPct": 62, "status": "active"}]'#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("PostgreSQL Read Replica Router on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/read-replica/list", web::get().to(list))
            .route("/v1/read-replica/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

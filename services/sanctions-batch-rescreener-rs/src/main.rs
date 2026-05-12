use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState { data: RwLock<serde_json::Value> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({ "service": "sanctions-batch-rescreener", "status": "healthy", "version": "1.0.0", "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "sanctions-batch-rescreener-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "sanctions-batch-rescreener-rs", "route": "/v1/sanctions-batch-rescreener"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}} }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "batch_runs": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Sanctions Batch Re-screener" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8584".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#"[{"id": "BATCH-2026-05-13", "triggerType": "scheduled_daily", "customersScreened": 25000, "listsChecked": 6, "newMatches": 0, "updatedMatches": 1, "falsePositives": 2, "truePositives": 0, "processingTimeMin": 12, "avgScreeningMs": 28, "startedAt": "2026-05-13T02:00:00Z", "completedAt": "2026-05-13T02:12:00Z", "nextScheduled": "2026-05-14T02:00:00Z", "status": "completed"}, {"id": "BATCH-2026-05-12", "triggerType": "list_update_ofac", "customersScreened": 25000, "listsChecked": 1, "newMatches": 1, "updatedMatches": 0, "falsePositives": 0, "truePositives": 1, "processingTimeMin": 4, "avgScreeningMs": 9, "startedAt": "2026-05-12T18:30:00Z", "completedAt": "2026-05-12T18:34:00Z", "nextScheduled": "N/A", "status": "completed_with_matches"}]"#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Sanctions Batch Re-screener on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/sanctions-batch-rescreener/list", web::get().to(list))
            .route("/v1/sanctions-batch-rescreener/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

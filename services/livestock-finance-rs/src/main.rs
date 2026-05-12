use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["livestock_finance.events", "livestock_finance.audit"]}, "dapr": {"status": "connected", "appId": "livestock-finance-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "livestock_finance-stream"}, "temporal": {"status": "connected", "namespace": "livestock_finance"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "livestock_finance"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "livestock_finance_authz"}, "redis": {"status": "connected", "prefix": "livestock_finance:"}, "mojaloop": {"status": "connected", "participant": "livestock_finance"}, "opensearch": {"status": "connected", "index": "livestock_finance-*"}, "openappsec": {"status": "connected", "policy": "livestock-finance-rs-protection"}, "apisix": {"status": "connected", "upstream": "livestock_finance"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "livestock_finance_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "livestock-finance-rs",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "middleware": mw
    }))
}

async fn list_records(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "items": *records,
        "total": records.len()
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8596".into()).parse().unwrap_or(8596);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Livestock Financing Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Livestock Financing Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Livestock Financing Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Livestock Financing Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("livestock-finance-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/livestock_finance/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

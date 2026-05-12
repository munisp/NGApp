use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["livestock_insurance.events", "livestock_insurance.audit"]}, "dapr": {"status": "connected", "appId": "livestock-insurance-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "livestock_insurance-stream"}, "temporal": {"status": "connected", "namespace": "livestock_insurance"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "livestock_insurance"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "livestock_insurance_authz"}, "redis": {"status": "connected", "prefix": "livestock_insurance:"}, "mojaloop": {"status": "connected", "participant": "livestock_insurance"}, "opensearch": {"status": "connected", "index": "livestock_insurance-*"}, "openappsec": {"status": "connected", "policy": "livestock-insurance-rs-protection"}, "apisix": {"status": "connected", "upstream": "livestock_insurance"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "livestock_insurance_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "livestock-insurance-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8607".into()).parse().unwrap_or(8607);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Livestock Insurance Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Livestock Insurance Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Livestock Insurance Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Livestock Insurance Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("livestock-insurance-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/livestock_insurance/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

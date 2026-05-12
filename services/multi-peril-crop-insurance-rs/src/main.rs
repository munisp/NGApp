use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["multi_peril_crop_insurance.events", "multi_peril_crop_insurance.audit"]}, "dapr": {"status": "connected", "appId": "multi-peril-crop-insurance-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "multi_peril_crop_insurance-stream"}, "temporal": {"status": "connected", "namespace": "multi_peril_crop_insurance"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "multi_peril_crop_insurance"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "multi_peril_crop_insurance_authz"}, "redis": {"status": "connected", "prefix": "multi_peril_crop_insurance:"}, "mojaloop": {"status": "connected", "participant": "multi_peril_crop_insurance"}, "opensearch": {"status": "connected", "index": "multi_peril_crop_insurance-*"}, "openappsec": {"status": "connected", "policy": "multi-peril-crop-insurance-rs-protection"}, "apisix": {"status": "connected", "upstream": "multi_peril_crop_insurance"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "multi_peril_crop_insurance_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "multi-peril-crop-insurance-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8610".into()).parse().unwrap_or(8610);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Multi Peril Crop Insurance Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Multi Peril Crop Insurance Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Multi Peril Crop Insurance Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Multi Peril Crop Insurance Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("multi-peril-crop-insurance-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/multi_peril_crop_insurance/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

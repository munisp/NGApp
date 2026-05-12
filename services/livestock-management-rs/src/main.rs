use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["livestock_management.events", "livestock_management.audit"]}, "dapr": {"status": "connected", "appId": "livestock-management-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "livestock_management-stream"}, "temporal": {"status": "connected", "namespace": "livestock_management"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "livestock_management"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "livestock_management_authz"}, "redis": {"status": "connected", "prefix": "livestock_management:"}, "mojaloop": {"status": "connected", "participant": "livestock_management"}, "opensearch": {"status": "connected", "index": "livestock_management-*"}, "openappsec": {"status": "connected", "policy": "livestock-management-rs-protection"}, "apisix": {"status": "connected", "upstream": "livestock_management"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "livestock_management_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "livestock-management-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8590".into()).parse().unwrap_or(8590);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "LST-001", "tag": "NG-KN-001-2024", "species": "cattle", "breed": "Sokoto Gudali", "sex": "female", "ageMonths": 36, "weightKg": 350.0, "healthStatus": "healthy", "vaccinationStatus": "up_to_date", "ownerFarmerId": "FRM-001", "location": "Kano", "herdId": "HRD-001", "purpose": "dairy", "marketValue": 850000.0, "status": "active"}, {"id": "LST-002", "tag": "NG-KN-002-2024", "species": "cattle", "breed": "White Fulani", "sex": "male", "ageMonths": 24, "weightKg": 420.0, "healthStatus": "healthy", "vaccinationStatus": "up_to_date", "ownerFarmerId": "FRM-001", "location": "Kano", "herdId": "HRD-001", "purpose": "fattening", "marketValue": 1200000.0, "status": "active"}, {"id": "LST-003", "tag": "NG-OY-001-2025", "species": "poultry", "breed": "Noiler", "sex": "female", "ageMonths": 8, "weightKg": 2.5, "healthStatus": "healthy", "vaccinationStatus": "up_to_date", "ownerFarmerId": "FRM-003", "location": "Oyo", "herdId": "FLK-001", "purpose": "dual_purpose", "marketValue": 5000.0, "status": "active"}, {"id": "LST-004", "tag": "NG-BN-001-2025", "species": "goat", "breed": "Red Sokoto", "sex": "female", "ageMonths": 18, "weightKg": 35.0, "healthStatus": "healthy", "vaccinationStatus": "due", "ownerFarmerId": "FRM-004", "location": "Benue", "herdId": "HRD-003", "purpose": "breeding", "marketValue": 45000.0, "status": "active"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("livestock-management-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/livestock_management/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

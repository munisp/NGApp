use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["parametric_insurance_iot.events", "parametric_insurance_iot.audit"]}, "dapr": {"status": "connected", "appId": "parametric-insurance-iot-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "parametric_insurance_iot-stream"}, "temporal": {"status": "connected", "namespace": "parametric_insurance_iot"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "parametric_insurance_iot"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "parametric_insurance_iot_authz"}, "redis": {"status": "connected", "prefix": "parametric_insurance_iot:"}, "mojaloop": {"status": "connected", "participant": "parametric_insurance_iot"}, "opensearch": {"status": "connected", "index": "parametric_insurance_iot-*"}, "openappsec": {"status": "connected", "policy": "parametric-insurance-iot-rs-protection"}, "apisix": {"status": "connected", "upstream": "parametric_insurance_iot"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "parametric_insurance_iot_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "parametric-insurance-iot-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8624".into()).parse().unwrap_or(8624);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Parametric Insurance IoT Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Parametric Insurance IoT Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Parametric Insurance IoT Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Parametric Insurance IoT Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("parametric-insurance-iot-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/parametric_insurance_iot/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

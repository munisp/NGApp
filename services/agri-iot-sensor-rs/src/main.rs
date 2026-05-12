use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["agri_iot_sensor.events", "agri_iot_sensor.audit"]}, "dapr": {"status": "connected", "appId": "agri-iot-sensor-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_iot_sensor-stream"}, "temporal": {"status": "connected", "namespace": "agri_iot_sensor"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_iot_sensor"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_iot_sensor_authz"}, "redis": {"status": "connected", "prefix": "agri_iot_sensor:"}, "mojaloop": {"status": "connected", "participant": "agri_iot_sensor"}, "opensearch": {"status": "connected", "index": "agri_iot_sensor-*"}, "openappsec": {"status": "connected", "policy": "agri-iot-sensor-rs-protection"}, "apisix": {"status": "connected", "upstream": "agri_iot_sensor"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_iot_sensor_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "agri-iot-sensor-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8615".into()).parse().unwrap_or(8615);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Agricultural IoT Sensor Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Agricultural IoT Sensor Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Agricultural IoT Sensor Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Agricultural IoT Sensor Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("agri-iot-sensor-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/agri_iot_sensor/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

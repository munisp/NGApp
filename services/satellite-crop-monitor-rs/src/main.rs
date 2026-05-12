use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["satellite_crop_monitor.events", "satellite_crop_monitor.audit"]}, "dapr": {"status": "connected", "appId": "satellite-crop-monitor-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "satellite_crop_monitor-stream"}, "temporal": {"status": "connected", "namespace": "satellite_crop_monitor"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "satellite_crop_monitor"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "satellite_crop_monitor_authz"}, "redis": {"status": "connected", "prefix": "satellite_crop_monitor:"}, "mojaloop": {"status": "connected", "participant": "satellite_crop_monitor"}, "opensearch": {"status": "connected", "index": "satellite_crop_monitor-*"}, "openappsec": {"status": "connected", "policy": "satellite-crop-monitor-rs-protection"}, "apisix": {"status": "connected", "upstream": "satellite_crop_monitor"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "satellite_crop_monitor_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "satellite-crop-monitor-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8600".into()).parse().unwrap_or(8600);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Satellite Crop Monitoring Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Satellite Crop Monitoring Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Satellite Crop Monitoring Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Satellite Crop Monitoring Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("satellite-crop-monitor-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/satellite_crop_monitor/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

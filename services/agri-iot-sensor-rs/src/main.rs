use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;

#[derive(Clone)]
struct AppState { start_time: Instant }

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "agri-iot-sensor-rs",
        "status": "healthy",
        "domain": "Agri Iot Sensor",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "agri-iot-sensor.events, agri-iot-sensor.audit",
            "postgres": "agri_iot_sensor_records",
            "redis": "agri-iot-sensor_cache",
            "temporal": "AgriIotSensorWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "agri-iot-sensor-2026"
        }
    }))
}


async fn list_records() -> HttpResponse {
    HttpResponse::Ok().json(json!({"records": [
        {"id": "REC-001", "status": "active", "domain": "Agri Iot Sensor", "createdAt": "2026-05-09T10:00:00Z"},
        {"id": "REC-002", "status": "processing", "domain": "Agri Iot Sensor", "createdAt": "2026-05-09T11:00:00Z"},
        {"id": "REC-003", "status": "completed", "domain": "Agri Iot Sensor", "createdAt": "2026-05-08T14:00:00Z"},
    ], "total": 3, "domain": "Agri Iot Sensor"}))
}
async fn create_record(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({"created": true, "data": *body}))
}
async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(json!({"total": 1247, "active": 1100, "pending": 120, "archived": 27}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9201".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("Agri Iot Sensor (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/agri-iot-sensor/list", web::get().to(list_records))
            .route("/v1/agri-iot-sensor/create", web::post().to(create_record))
            .route("/v1/agri-iot-sensor/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

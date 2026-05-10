use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct MiddlewareConfig {
    kafka_broker: String, redis_url: String, postgres_url: String, opensearch_url: String,
    keycloak_url: String, permify_url: String, dapr_url: String, fluvio_url: String,
    temporal_url: String, mojaloop_url: String, tigerbeetle_url: String, lakehouse_url: String,
    apisix_url: String, openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()),
        opensearch_url: std::env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()),
        keycloak_url: std::env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()),
        permify_url: std::env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()),
        dapr_url: std::env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()),
        fluvio_url: std::env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()),
        temporal_url: std::env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()),
        mojaloop_url: std::env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()),
        tigerbeetle_url: std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()),
        lakehouse_url: std::env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()),
        apisix_url: std::env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()),
        openappsec_url: std::env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()),
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct BiometricRecord {
    id: String,
    customer_id: String,
    customer_name: String,
    biometric_type: String,
    device: String,
    confidence_score: f64,
    location: String,
    auth_result: String,
    timestamp: String,
}

fn seed() -> Vec<BiometricRecord> { vec![
        BiometricRecord { id: "BIO-001".into(), customer_id: "C-001".into(), customer_name: "Dangote Industries Ltd".into(), biometric_type: "fingerprint".into(), device: "Dermalog LF10".into(), confidence_score: 99.2, location: "Victoria Island Branch".into(), auth_result: "match".into(), timestamp: "2026-05-09T10:30:00Z".into() },
        BiometricRecord { id: "BIO-002".into(), customer_id: "C-002".into(), customer_name: "Emeka Obi".into(), biometric_type: "facial_recognition".into(), device: "iPhone 16 Pro".into(), confidence_score: 95.8, location: "Mobile App".into(), auth_result: "match".into(), timestamp: "2026-05-09T11:15:00Z".into() },
        BiometricRecord { id: "BIO-003".into(), customer_id: "C-003".into(), customer_name: "Fatima Musa".into(), biometric_type: "voice_recognition".into(), device: "IVR System".into(), confidence_score: 88.5, location: "Contact Center".into(), auth_result: "match".into(), timestamp: "2026-05-09T09:45:00Z".into() },
        BiometricRecord { id: "BIO-004".into(), customer_id: "C-004".into(), customer_name: "Unknown".into(), biometric_type: "fingerprint".into(), device: "ATM Scanner".into(), confidence_score: 32.1, location: "Ikeja ATM-004".into(), auth_result: "no_match".into(), timestamp: "2026-05-08T22:30:00Z".into() },
        BiometricRecord { id: "BIO-005".into(), customer_id: "C-005".into(), customer_name: "Adaeze Nwankwo".into(), biometric_type: "iris_scan".into(), device: "IriTech IriShield".into(), confidence_score: 99.9, location: "Abuja Main Branch".into(), auth_result: "match".into(), timestamp: "2026-05-09T14:00:00Z".into() },
    ]
}

struct AppState { items: Mutex<Vec<BiometricRecord>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "biometric-auth-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "broker": c.kafka_broker, "topics": ["biometric.auth","biometric.fraud-alerts","biometric.enrollment"] },
            "redis": { "url": c.redis_url }, "postgres": { "url": c.postgres_url, "tables": ["biometric_records","biometric_templates","biometric_devices"] },
            "opensearch": { "url": c.opensearch_url }, "keycloak": { "url": c.keycloak_url, "realm": "54bank" },
            "permify": { "url": c.permify_url }, "dapr": { "url": c.dapr_url, "app_id": "biometric-auth-rs" },
            "fluvio": { "url": c.fluvio_url }, "temporal": { "url": c.temporal_url },
            "mojaloop": { "url": c.mojaloop_url }, "tigerbeetle": { "url": c.tigerbeetle_url },
            "lakehouse": { "url": c.lakehouse_url }, "apisix": { "url": c.apisix_url },
            "openappsec": { "url": c.openappsec_url }
        }
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8189".into()).parse().unwrap_or(8189);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Biometric Authentication Service running on port {}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/biometric-auth-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
}

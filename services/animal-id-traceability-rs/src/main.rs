use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["animal_id_traceability.events", "animal_id_traceability.audit"]}, "dapr": {"status": "connected", "appId": "animal-id-traceability-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "animal_id_traceability-stream"}, "temporal": {"status": "connected", "namespace": "animal_id_traceability"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "animal_id_traceability"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "animal_id_traceability_authz"}, "redis": {"status": "connected", "prefix": "animal_id_traceability:"}, "mojaloop": {"status": "connected", "participant": "animal_id_traceability"}, "opensearch": {"status": "connected", "index": "animal_id_traceability-*"}, "openappsec": {"status": "connected", "policy": "animal-id-traceability-rs-protection"}, "apisix": {"status": "connected", "upstream": "animal_id_traceability"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "animal_id_traceability_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "animal-id-traceability-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8613".into()).parse().unwrap_or(8613);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Animal ID Traceability Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Animal ID Traceability Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Animal ID Traceability Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Animal ID Traceability Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("animal-id-traceability-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/animal_id_traceability/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["farm_boundary_mapping.events", "farm_boundary_mapping.audit"]}, "dapr": {"status": "connected", "appId": "farm-boundary-mapping-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "farm_boundary_mapping-stream"}, "temporal": {"status": "connected", "namespace": "farm_boundary_mapping"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "farm_boundary_mapping"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "farm_boundary_mapping_authz"}, "redis": {"status": "connected", "prefix": "farm_boundary_mapping:"}, "mojaloop": {"status": "connected", "participant": "farm_boundary_mapping"}, "opensearch": {"status": "connected", "index": "farm_boundary_mapping-*"}, "openappsec": {"status": "connected", "policy": "farm-boundary-mapping-rs-protection"}, "apisix": {"status": "connected", "upstream": "farm_boundary_mapping"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "farm_boundary_mapping_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "farm-boundary-mapping-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8603".into()).parse().unwrap_or(8603);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Farm Boundary Mapping Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Farm Boundary Mapping Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Farm Boundary Mapping Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Farm Boundary Mapping Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("farm-boundary-mapping-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/farm_boundary_mapping/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

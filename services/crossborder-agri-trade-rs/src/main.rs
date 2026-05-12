use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["crossborder_agri_trade.events", "crossborder_agri_trade.audit"]}, "dapr": {"status": "connected", "appId": "crossborder-agri-trade-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "crossborder_agri_trade-stream"}, "temporal": {"status": "connected", "namespace": "crossborder_agri_trade"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "crossborder_agri_trade"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "crossborder_agri_trade_authz"}, "redis": {"status": "connected", "prefix": "crossborder_agri_trade:"}, "mojaloop": {"status": "connected", "participant": "crossborder_agri_trade"}, "opensearch": {"status": "connected", "index": "crossborder_agri_trade-*"}, "openappsec": {"status": "connected", "policy": "crossborder-agri-trade-rs-protection"}, "apisix": {"status": "connected", "upstream": "crossborder_agri_trade"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "crossborder_agri_trade_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "crossborder-agri-trade-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8619".into()).parse().unwrap_or(8619);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "REC-001", "name": "Cross Border Agri Trade Record 1", "category": "primary", "status": "active", "amount": 1000000.0, "region": "Lagos"}, {"id": "REC-002", "name": "Cross Border Agri Trade Record 2", "category": "primary", "status": "active", "amount": 2500000.0, "region": "Kano"}, {"id": "REC-003", "name": "Cross Border Agri Trade Record 3", "category": "secondary", "status": "pending", "amount": 500000.0, "region": "Benue"}, {"id": "REC-004", "name": "Cross Border Agri Trade Record 4", "category": "secondary", "status": "active", "amount": 3000000.0, "region": "Oyo"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("crossborder-agri-trade-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/crossborder_agri_trade/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

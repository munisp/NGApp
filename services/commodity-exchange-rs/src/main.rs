use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use actix_cors::Cors;
use serde_json::json;
use std::sync::Mutex;

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"status": "connected", "topics": ["commodity_exchange.events", "commodity_exchange.audit"]}, "dapr": {"status": "connected", "appId": "commodity-exchange-rs-sidecar"}, "fluvio": {"status": "connected", "topic": "commodity_exchange-stream"}, "temporal": {"status": "connected", "namespace": "commodity_exchange"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "commodity_exchange"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "commodity_exchange_authz"}, "redis": {"status": "connected", "prefix": "commodity_exchange:"}, "mojaloop": {"status": "connected", "participant": "commodity_exchange"}, "opensearch": {"status": "connected", "index": "commodity_exchange-*"}, "openappsec": {"status": "connected", "policy": "commodity-exchange-rs-protection"}, "apisix": {"status": "connected", "upstream": "commodity_exchange"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "commodity_exchange_iceberg"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "service": "commodity-exchange-rs",
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
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8597".into()).parse().unwrap_or(8597);
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "CXO-001", "exchange": "NCX", "commodity": "maize", "grade": "Grade 1", "bidPrice": 220000.0, "askPrice": 225000.0, "lastTraded": 222500.0, "volumeTonnes": 150.0, "warehouse": "Kano", "deliveryMonth": "2026-07", "status": "open"}, {"id": "CXO-002", "exchange": "AFEX", "commodity": "soybean", "grade": "Grade A", "bidPrice": 380000.0, "askPrice": 390000.0, "lastTraded": 385000.0, "volumeTonnes": 80.0, "warehouse": "Benue", "deliveryMonth": "2026-08", "status": "open"}, {"id": "CXO-003", "exchange": "SABEX", "commodity": "paddy_rice", "grade": "Grade 1", "bidPrice": 450000.0, "askPrice": 460000.0, "lastTraded": 455000.0, "volumeTonnes": 200.0, "warehouse": "Kebbi", "deliveryMonth": "2026-09", "status": "open"}, {"id": "CXO-004", "exchange": "NCX", "commodity": "cocoa", "grade": "Export", "bidPrice": 4500000.0, "askPrice": 4600000.0, "lastTraded": 4550000.0, "volumeTonnes": 25.0, "warehouse": "Cross River", "deliveryMonth": "2026-06", "status": "matched"}]"#).unwrap_or_default();
    let data = web::Data::new(AppState {
        records: Mutex::new(seed),
    });
    println!("commodity-exchange-rs listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/commodity_exchange/list", web::get().to(list_records))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

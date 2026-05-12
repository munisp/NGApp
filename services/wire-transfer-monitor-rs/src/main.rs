use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState { data: RwLock<serde_json::Value> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({ "service": "wire-transfer-monitor", "status": "healthy", "version": "1.0.0", "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "wire-transfer-monitor-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "wire-transfer-monitor-rs", "route": "/v1/wire-transfer-monitor"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}} }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "wire_transfers": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Wire Transfer Monitor (Travel Rule)" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8586".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#"[{"id": "WT-001", "transactionId": "TXN-WT-001", "originatorName": "Lagos Trading Co", "originatorAccount": "0012345678", "originatorBVN": "22334455667", "originatorBank": "54Bank", "beneficiaryName": "Global Supplies Ltd", "beneficiaryAccount": "GB29NWBK60161331926819", "beneficiaryBank": "NatWest London", "amount": 50000, "currency": "USD", "ngnEquivalent": 75000000, "purpose": "Payment for imported goods \u2014 LC REF: LC-2026-001", "riskScore": 45, "sanctionsCleared": true, "travelRuleCompliant": true, "originatorInfoComplete": true, "beneficiaryInfoComplete": true, "intermediaryBank": "Citibank NY", "swiftRef": "CITI260513001", "status": "completed"}, {"id": "WT-002", "transactionId": "TXN-WT-002", "originatorName": "Unknown Sender", "originatorAccount": "MISSING", "originatorBVN": "MISSING", "originatorBank": "Unknown", "beneficiaryName": "Adeola Fashola", "beneficiaryAccount": "0098765432", "beneficiaryBank": "54Bank", "amount": 25000, "currency": "USD", "ngnEquivalent": 37500000, "purpose": "NOT PROVIDED", "riskScore": 95, "sanctionsCleared": false, "travelRuleCompliant": false, "originatorInfoComplete": false, "beneficiaryInfoComplete": true, "intermediaryBank": "Unknown", "swiftRef": "UNK260513002", "status": "held_for_review"}]"#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Wire Transfer Monitor (Travel Rule) on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/wire-transfer-monitor/list", web::get().to(list))
            .route("/v1/wire-transfer-monitor/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

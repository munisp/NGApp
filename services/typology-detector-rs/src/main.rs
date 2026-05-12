use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState { data: RwLock<serde_json::Value> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({ "service": "typology-detector", "status": "healthy", "version": "1.0.0", "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "typology-detector-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "typology-detector-rs", "route": "/v1/typology-detector"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}} }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "typology_matches": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "ML/TF Typology Detection Engine" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8588".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#"[{"id": "TYP-001", "typologyCode": "FATF-TYP-001", "typologyName": "Structuring / Smurfing", "description": "Breaking large transactions into smaller amounts below reporting threshold", "riskLevel": "high", "indicatorsMatched": ["multiple_sub_threshold_deposits", "different_branches_same_day", "round_amounts"], "customersTriggered": 3, "lastTriggered": "2026-05-13T14:30:00Z", "autoSARGeneration": true, "status": "active"}, {"id": "TYP-002", "typologyCode": "FATF-TYP-005", "typologyName": "Trade-Based Money Laundering", "description": "Over/under-invoicing of goods/services, phantom shipments, multiple invoicing", "riskLevel": "critical", "indicatorsMatched": ["invoice_price_deviation", "phantom_shipping_docs", "multiple_invoicing_same_goods"], "customersTriggered": 1, "lastTriggered": "2026-05-13T08:15:00Z", "autoSARGeneration": true, "status": "active"}, {"id": "TYP-003", "typologyCode": "CBN-TYP-003", "typologyName": "Loan-Back Scheme", "description": "Criminal deposits funds, obtains loan secured by same deposit, defaults to create legitimate loss", "riskLevel": "high", "indicatorsMatched": ["deposit_collateralized_loan", "rapid_default", "offshore_deposit_source"], "customersTriggered": 0, "lastTriggered": null, "autoSARGeneration": true, "status": "active"}, {"id": "TYP-004", "typologyCode": "CBN-TYP-007", "typologyName": "POS/Mobile Money Laundering", "description": "Using multiple POS terminals or mobile money accounts to layer funds", "riskLevel": "medium", "indicatorsMatched": ["multiple_pos_accounts", "circular_transfers", "agent_network_abuse"], "customersTriggered": 2, "lastTriggered": "2026-05-12T16:45:00Z", "autoSARGeneration": false, "status": "active"}]"#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("ML/TF Typology Detection Engine on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/typology-detector/list", web::get().to(list))
            .route("/v1/typology-detector/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState { data: RwLock<serde_json::Value> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({ "service": "aml-risk-scoring", "status": "healthy", "version": "1.0.0", "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "aml-risk-scoring-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "aml-risk-scoring-rs", "route": "/v1/aml-risk-scoring"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}} }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "risk_scores": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "AML Risk Scoring Engine" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8574".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#"[{"id": "ARS-001", "customerId": "CUS-1045", "customerName": "Adeola Fashola", "riskScore": 78, "riskLevel": "high", "factors": ["high_value_transfers", "multiple_jurisdictions", "pep_connection"], "sanctionsHits": 0, "pepMatch": false, "adverseMedia": 1, "transactionVelocity": "elevated", "lastScreened": "2026-05-13T10:30:00Z", "nextReview": "2026-06-13", "cddLevel": "enhanced", "status": "active"}, {"id": "ARS-002", "customerId": "CUS-2089", "customerName": "BUA Group Holdings", "riskScore": 45, "riskLevel": "medium", "factors": ["corporate_complexity", "multi_layered_ownership"], "sanctionsHits": 0, "pepMatch": true, "adverseMedia": 0, "transactionVelocity": "normal", "lastScreened": "2026-05-13T09:00:00Z", "nextReview": "2026-08-13", "cddLevel": "enhanced", "status": "active"}, {"id": "ARS-003", "customerId": "CUS-3021", "customerName": "ABC Import Export Ltd", "riskScore": 92, "riskLevel": "critical", "factors": ["trade_based_ml_indicators", "shell_company_network", "rapid_fund_movement", "geographic_risk"], "sanctionsHits": 1, "pepMatch": false, "adverseMedia": 3, "transactionVelocity": "high", "lastScreened": "2026-05-13T08:15:00Z", "nextReview": "2026-05-20", "cddLevel": "prohibited", "status": "blocked"}, {"id": "ARS-004", "customerId": "CUS-4567", "customerName": "Ngozi Okafor", "riskScore": 12, "riskLevel": "low", "factors": [], "sanctionsHits": 0, "pepMatch": false, "adverseMedia": 0, "transactionVelocity": "normal", "lastScreened": "2026-05-13T11:00:00Z", "nextReview": "2027-05-13", "cddLevel": "standard", "status": "active"}]"#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("AML Risk Scoring Engine on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/aml-risk-scoring/list", web::get().to(list))
            .route("/v1/aml-risk-scoring/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

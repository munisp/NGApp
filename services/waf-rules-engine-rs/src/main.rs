use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Serialize, Deserialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
struct Item {
    #[serde(flatten)]
    data: serde_json::Value,
}

struct State {
    items: Mutex<Vec<serde_json::Value>>,
}

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.waf.rules.engine.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "waf-rules-engine-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "waf-rules-engine-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "OWASP CRS, custom WAF rules, virtual patching, bot detection, IP reputation, anomaly scoring",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "waf_rules": *items
    }))
}

async fn get_stats(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    let mut status_map = std::collections::HashMap::new();
    for item in items.iter() {
        if let Some(s) = item.get("status").and_then(|v| v.as_str()) {
            *status_map.entry(s.to_string()).or_insert(0) += 1;
        }
    }
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "byStatus": status_map
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "WAF-001", "ruleId": "CRS-941", "name": "XSS Detection", "category": "xss", "severity": "critical", "paranoia": 2, "matched24h": 4567, "blocked24h": 4567, "falsePositives": 23, "status": "enforced"}, {"id": "WAF-002", "ruleId": "CRS-942", "name": "SQL Injection Detection", "category": "sqli", "severity": "critical", "paranoia": 2, "matched24h": 2345, "blocked24h": 2345, "falsePositives": 12, "status": "enforced"}, {"id": "WAF-003", "ruleId": "CRS-931", "name": "Remote File Inclusion", "category": "rfi", "severity": "high", "paranoia": 1, "matched24h": 890, "blocked24h": 890, "falsePositives": 5, "status": "enforced"}, {"id": "WAF-004", "ruleId": "CRS-932", "name": "Remote Command Execution", "category": "rce", "severity": "critical", "paranoia": 1, "matched24h": 234, "blocked24h": 234, "falsePositives": 0, "status": "enforced"}, {"id": "WAF-005", "ruleId": "54B-001", "name": "Nigerian Banking API Protection", "category": "custom", "severity": "high", "paranoia": 2, "matched24h": 567, "blocked24h": 456, "falsePositives": 111, "status": "enforced"}, {"id": "WAF-006", "ruleId": "54B-002", "name": "Bot Detection (Credential Stuffing)", "category": "bot", "severity": "high", "paranoia": 3, "matched24h": 12000, "blocked24h": 11500, "falsePositives": 500, "status": "enforced"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8520".to_string());
    println!("WAF Rules Engine listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/waf-rules/list", web::get().to(list_items))
            .route("/v1/waf-rules/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

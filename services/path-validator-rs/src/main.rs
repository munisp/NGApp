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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.path.validator.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "path-validator-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "path-validator-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Path traversal prevention, parameter pattern validation, URL encoding normalization, OWASP path rules",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "validation_rules": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "PV-001", "pattern": "customerId", "regex": "^[A-Z]{3}-[0-9]{3,6}$", "blocked24h": 1234, "passed24h": 890000, "commonViolations": ["../etc/passwd", "' OR 1=1", "<script>"], "status": "enforced"}, {"id": "PV-002", "pattern": "accountId", "regex": "^[0-9]{10}$", "blocked24h": 567, "passed24h": 2300000, "commonViolations": ["../../admin", "%00null", "${jndi:}"], "status": "enforced"}, {"id": "PV-003", "pattern": "transactionId", "regex": "^TXN-[0-9]{12}$", "blocked24h": 89, "passed24h": 670000, "commonViolations": ["TXN-' DROP TABLE", "..%2f..%2f"], "status": "enforced"}, {"id": "PV-004", "pattern": "fileUpload", "regex": "^[a-zA-Z0-9_-]+\\.(pdf|jpg|png)$", "blocked24h": 2345, "passed24h": 45000, "commonViolations": ["../../etc/shadow", "shell.php", "cmd.exe"], "status": "enforced"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8512".to_string());
    println!("Path Validator listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/path-validator/list", web::get().to(list_items))
            .route("/v1/path-validator/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

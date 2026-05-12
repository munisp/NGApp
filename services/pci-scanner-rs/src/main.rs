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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.pci.scanner.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "pci-scanner-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "pci-scanner-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Automated PCI compliance scanning, cardholder data discovery, log scrubbing, SAQ validation",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "scan_results": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "PCI-001", "requirement": "Req 3: Protect Stored Data", "controls": 12, "passing": 11, "failing": 1, "findings": ["CVV stored in staging logs"], "lastScan": "2026-05-09T06:00:00Z", "scanDuration": "45m", "status": "warning"}, {"id": "PCI-002", "requirement": "Req 4: Encrypt Transmission", "controls": 8, "passing": 8, "failing": 0, "findings": [], "lastScan": "2026-05-09T06:00:00Z", "scanDuration": "30m", "status": "passed"}, {"id": "PCI-003", "requirement": "Req 6: Secure Systems", "controls": 15, "passing": 13, "failing": 2, "findings": ["2 services missing security patches", "SQL injection vector in legacy query"], "lastScan": "2026-05-09T06:00:00Z", "scanDuration": "60m", "status": "warning"}, {"id": "PCI-004", "requirement": "Req 8: Identify Users", "controls": 10, "passing": 10, "failing": 0, "findings": [], "lastScan": "2026-05-09T06:00:00Z", "scanDuration": "25m", "status": "passed"}, {"id": "PCI-005", "requirement": "Req 10: Track Access", "controls": 8, "passing": 7, "failing": 1, "findings": ["3 services missing audit trail for admin actions"], "lastScan": "2026-05-09T06:00:00Z", "scanDuration": "35m", "status": "warning"}, {"id": "PCI-006", "requirement": "Req 11: Test Security", "controls": 6, "passing": 5, "failing": 1, "findings": ["Quarterly ASV scan overdue"], "lastScan": "2026-05-09T06:00:00Z", "scanDuration": "20m", "status": "warning"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8510".to_string());
    println!("PCI-DSS Scanner listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/pci-scanner/list", web::get().to(list_items))
            .route("/v1/pci-scanner/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

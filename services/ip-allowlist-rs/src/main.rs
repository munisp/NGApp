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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.ip.allowlist.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "ip-allowlist-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "ip-allowlist-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Admin IP allowlisting, CIDR range management, geo-IP blocking, VPN detection, IP reputation scoring",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "ip_rules": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "IP-001", "name": "54Bank HQ Lagos", "cidr": "41.58.0.0/16", "type": "allowlist", "appliesTo": "admin_api", "hits24h": 45000, "blocked24h": 0, "geoCountry": "NG", "status": "active"}, {"id": "IP-002", "name": "54Bank Abuja DC", "cidr": "197.210.0.0/16", "type": "allowlist", "appliesTo": "admin_api", "hits24h": 12000, "blocked24h": 0, "geoCountry": "NG", "status": "active"}, {"id": "IP-003", "name": "Known Botnet C2", "cidr": "185.220.0.0/16", "type": "blocklist", "appliesTo": "all", "hits24h": 8900, "blocked24h": 8900, "geoCountry": "RU", "status": "active"}, {"id": "IP-004", "name": "TOR Exit Nodes", "cidr": "dynamic", "type": "blocklist", "appliesTo": "banking_api", "hits24h": 2340, "blocked24h": 2340, "geoCountry": "various", "status": "active"}, {"id": "IP-005", "name": "AWS Nigeria Region", "cidr": "3.8.0.0/14", "type": "allowlist", "appliesTo": "service_mesh", "hits24h": 890000, "blocked24h": 0, "geoCountry": "NG", "status": "active"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8522".to_string());
    println!("IP Allowlist Engine listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ip-allowlist/list", web::get().to(list_items))
            .route("/v1/ip-allowlist/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

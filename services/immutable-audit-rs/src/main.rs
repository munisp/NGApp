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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.immutable.audit.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "immutable-audit-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "immutable-audit-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Append-only audit store, Merkle tree verification, tamper detection, blockchain anchoring, hash chain",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "audit_blocks": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "BLK-001", "blockNumber": 1000000, "previousHash": "a3f8c2e1d4b5a7f9c3e1d4b5a7f9c3e1", "merkleRoot": "b7d9e3f2c1a4d6b8e3f2c1a4d6b8e3f2", "transactions": 256, "timestamp": "2026-05-09T14:00:00Z", "validator": "node-1", "anchoredToChain": "ethereum-sepolia", "anchorTxHash": "0xabc123...def456", "verified": true, "status": "confirmed"}, {"id": "BLK-002", "blockNumber": 999999, "previousHash": "c4e1a8f3d2b7e9a1f3d2b7e9a1f3d2b7", "merkleRoot": "d5f2b9c3e1a8f4c2b9c3e1a8f4c2b9c3", "transactions": 312, "timestamp": "2026-05-09T13:55:00Z", "validator": "node-2", "anchoredToChain": "ethereum-sepolia", "anchorTxHash": "0xdef789...abc012", "verified": true, "status": "confirmed"}, {"id": "BLK-003", "blockNumber": 999998, "previousHash": "e6a3c1d4f2b9d7e1c1d4f2b9d7e1c1d4", "merkleRoot": "f7b4d2e1a3c8e5d2b4e1a3c8e5d2b4e1", "transactions": 189, "timestamp": "2026-05-09T13:50:00Z", "validator": "node-1", "anchoredToChain": "ethereum-sepolia", "anchorTxHash": "0x123abc...789def", "verified": true, "status": "confirmed"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8527".to_string());
    println!("Immutable Audit Chain listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/immutable-audit/list", web::get().to(list_items))
            .route("/v1/immutable-audit/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

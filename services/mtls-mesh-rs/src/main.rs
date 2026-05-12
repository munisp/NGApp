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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.mtls.mesh.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "mtls-mesh-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "mtls-mesh-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "Mutual TLS between 266 services, certificate provisioning, SPIFFE identity, zero-trust networking",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "mesh_nodes": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "MESH-001", "service": "core-banking-go", "spiffeId": "spiffe://54bank.app/core-banking", "certSerial": "A1:B2:C3:D4", "certExpiry": "2026-06-09T00:00:00Z", "issuer": "54bank-mesh-ca", "peerConnections": 45, "handshakes24h": 890000, "failedHandshakes": 12, "status": "active"}, {"id": "MESH-002", "service": "payments-hub-go", "spiffeId": "spiffe://54bank.app/payments-hub", "certSerial": "E5:F6:G7:H8", "certExpiry": "2026-06-09T00:00:00Z", "issuer": "54bank-mesh-ca", "peerConnections": 32, "handshakes24h": 1200000, "failedHandshakes": 3, "status": "active"}, {"id": "MESH-003", "service": "fraud-detection-rs", "spiffeId": "spiffe://54bank.app/fraud-detection", "certSerial": "I9:J0:K1:L2", "certExpiry": "2026-06-09T00:00:00Z", "issuer": "54bank-mesh-ca", "peerConnections": 28, "handshakes24h": 450000, "failedHandshakes": 1, "status": "active"}, {"id": "MESH-004", "service": "kyc-engine-py", "spiffeId": "spiffe://54bank.app/kyc-engine", "certSerial": "M3:N4:O5:P6", "certExpiry": "2026-06-09T00:00:00Z", "issuer": "54bank-mesh-ca", "peerConnections": 15, "handshakes24h": 120000, "failedHandshakes": 0, "status": "active"}, {"id": "MESH-005", "service": "tigerbeetle-proxy-rs", "spiffeId": "spiffe://54bank.app/tigerbeetle-proxy", "certSerial": "Q7:R8:S9:T0", "certExpiry": "2026-06-09T00:00:00Z", "issuer": "54bank-mesh-ca", "peerConnections": 52, "handshakes24h": 3400000, "failedHandshakes": 0, "status": "active"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8505".to_string());
    println!("mTLS Service Mesh listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/mtls-mesh/list", web::get().to(list_items))
            .route("/v1/mtls-mesh/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

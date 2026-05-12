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
    let mw: serde_json::Value = serde_json::from_str(r#"{"kafka": {"broker": "kafka:9092", "topics": ["security.cloud.kms.bridge.rs"]}, "redis": {"url": "redis://redis:6379/0"}, "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking"}, "opensearch": {"url": "https://opensearch:9200"}, "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank"}, "permify": {"endpoint": "permify:3476"}, "dapr": {"appId": "cloud-kms-bridge-rs"}, "fluvio": {"endpoint": "fluvio:9003"}, "temporal": {"namespace": "54bank-security"}, "mojaloop": {"hub": "mojaloop:4000"}, "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27}, "lakehouse": {"endpoint": "lakehouse:8080"}, "apisix": {"admin": "apisix:9180"}, "openappsec": {"endpoint": "openappsec:8090"}}"#).unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "cloud-kms-bridge-rs",
        "status": "healthy",
        "version": "1.0.0",
        "description": "AWS KMS / Azure Key Vault / GCP Cloud KMS integration, envelope encryption, key policy management",
        "middleware": mw
    }))
}

async fn list_items(state: web::Data<State>) -> HttpResponse {
    let items = state.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "total": items.len(),
        "kms_keys": *items
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
    let seed: Vec<serde_json::Value> = serde_json::from_str(r#"[{"id": "KMS-001", "provider": "aws", "keyId": "arn:aws:kms:eu-west-1:***:key/card-encryption", "algorithm": "AES_256", "usage": "ENCRYPT_DECRYPT", "state": "Enabled", "rotationEnabled": true, "encryptionOps24h": 890000, "decryptionOps24h": 120000, "status": "active"}, {"id": "KMS-002", "provider": "aws", "keyId": "arn:aws:kms:eu-west-1:***:key/jwt-signing", "algorithm": "RSA_2048", "usage": "SIGN_VERIFY", "state": "Enabled", "rotationEnabled": true, "encryptionOps24h": 0, "decryptionOps24h": 0, "status": "active"}, {"id": "KMS-003", "provider": "azure", "keyId": "https://54bank-vault.vault.azure.net/keys/backup-encryption", "algorithm": "RSA_4096", "usage": "ENCRYPT_DECRYPT", "state": "Enabled", "rotationEnabled": true, "encryptionOps24h": 24, "decryptionOps24h": 2, "status": "active"}, {"id": "KMS-004", "provider": "aws", "keyId": "arn:aws:kms:eu-west-1:***:key/pin-encryption", "algorithm": "AES_256", "usage": "ENCRYPT_DECRYPT", "state": "Enabled", "rotationEnabled": true, "encryptionOps24h": 1500000, "decryptionOps24h": 450000, "status": "active"}]"#).unwrap_or_default();
    let state = web::Data::new(State { items: Mutex::new(seed) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8507".to_string());
    println!("Cloud KMS Bridge listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/cloud-kms/list", web::get().to(list_items))
            .route("/v1/cloud-kms/stats", web::get().to(get_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

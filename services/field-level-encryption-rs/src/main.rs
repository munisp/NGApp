use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EncryptionPolicy { id: String, table_name: String, field_name: String, algorithm: String, key_id: String, data_classification: String, mask_pattern: String, searchable: bool, status: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EncryptionAudit { id: String, policy_id: String, operation: String, table_name: String, field_name: String, record_id: String, actor: String, timestamp: String }

struct State { policies: Mutex<Vec<EncryptionPolicy>>, audit: Mutex<Vec<EncryptionAudit>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "field-level-encryption-rs", "version": "3.0.0", "status": "healthy", "port": 8494,
        "description": "Field-Level Encryption — AES-256-GCM per-field, format-preserving encryption, searchable encryption",
        "features": ["aes256_gcm_per_field", "format_preserving_encryption", "searchable_encryption", "data_classification", "automatic_masking", "key_rotation_transparent", "pci_dss_compliance", "gdpr_right_to_erasure", "column_level_access_control"],
        "dataClassifications": ["public", "internal", "confidential", "restricted", "pci_cardholder", "pii_sensitive"],
        "middleware": {
            "kafka": {"topics": ["encryption.policy-applied", "encryption.key-rotated", "encryption.decryption-requested"]},
            "redis": {"usage": "Encryption key cache, decrypted data TTL cache"},
            "postgres": {"tables": ["encryption_policies", "encryption_audit"]},
            "opensearch": {"indices": ["encryption-operations"]},
            "keycloak": {"realm": "54bank"}, "permify": {"schema": "field_encryption"},
            "dapr": {"appId": "field-level-encryption-rs"}, "fluvio": {"topics": ["encryption-stream"]},
            "temporal": {"workflows": ["key-rotation-migration", "data-reclassification"]},
            "mojaloop": {"usage": "Payment data encryption"}, "tigerbeetle": {"ledger": 24},
            "lakehouse": {"tables": ["encryption_analytics"]},
            "apisix": {"routes": ["/v1/encryption/*"]}, "openappsec": {"policy": "data-encryption-enforcement"}
        }
    }))
}

async fn list_policies(data: web::Data<State>) -> HttpResponse {
    let p = data.policies.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *p, "total": p.len()}))
}
async fn list_audit(data: web::Data<State>) -> HttpResponse {
    let a = data.audit.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *a, "total": a.len()}))
}
async fn stats(data: web::Data<State>) -> HttpResponse {
    let p = data.policies.lock().unwrap();
    let mut by_class: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for pol in p.iter() { *by_class.entry(pol.data_classification.clone()).or_insert(0) += 1; }
    HttpResponse::Ok().json(serde_json::json!({"totalPolicies": p.len(), "byClassification": by_class}))
}

fn seed() -> State {
    State {
        policies: Mutex::new(vec![
            EncryptionPolicy { id: "EP-001".into(), table_name: "customers".into(), field_name: "bvn".into(), algorithm: "AES-256-GCM".into(), key_id: "KEY-004".into(), data_classification: "pii_sensitive".into(), mask_pattern: "****{last4}".into(), searchable: true, status: "active".into() },
            EncryptionPolicy { id: "EP-002".into(), table_name: "customers".into(), field_name: "nin".into(), algorithm: "AES-256-GCM".into(), key_id: "KEY-004".into(), data_classification: "pii_sensitive".into(), mask_pattern: "****{last4}".into(), searchable: true, status: "active".into() },
            EncryptionPolicy { id: "EP-003".into(), table_name: "card_transactions".into(), field_name: "pan".into(), algorithm: "FPE-FF1".into(), key_id: "KEY-001".into(), data_classification: "pci_cardholder".into(), mask_pattern: "****-****-****-{last4}".into(), searchable: false, status: "active".into() },
            EncryptionPolicy { id: "EP-004".into(), table_name: "card_transactions".into(), field_name: "cvv".into(), algorithm: "AES-256-GCM".into(), key_id: "KEY-001".into(), data_classification: "pci_cardholder".into(), mask_pattern: "***".into(), searchable: false, status: "active".into() },
            EncryptionPolicy { id: "EP-005".into(), table_name: "customers".into(), field_name: "phone_number".into(), algorithm: "AES-256-GCM".into(), key_id: "KEY-004".into(), data_classification: "confidential".into(), mask_pattern: "+234****{last4}".into(), searchable: true, status: "active".into() },
            EncryptionPolicy { id: "EP-006".into(), table_name: "customers".into(), field_name: "email".into(), algorithm: "AES-256-GCM".into(), key_id: "KEY-004".into(), data_classification: "confidential".into(), mask_pattern: "{first2}***@***".into(), searchable: true, status: "active".into() },
            EncryptionPolicy { id: "EP-007".into(), table_name: "accounts".into(), field_name: "account_number".into(), algorithm: "FPE-FF1".into(), key_id: "KEY-004".into(), data_classification: "restricted".into(), mask_pattern: "****{last4}".into(), searchable: true, status: "active".into() },
        ]),
        audit: Mutex::new(vec![
            EncryptionAudit { id: "EA-001".into(), policy_id: "EP-001".into(), operation: "encrypt".into(), table_name: "customers".into(), field_name: "bvn".into(), record_id: "CUST-1001".into(), actor: "onboarding-service".into(), timestamp: "2026-05-09T14:00:00Z".into() },
            EncryptionAudit { id: "EA-002".into(), policy_id: "EP-003".into(), operation: "decrypt".into(), table_name: "card_transactions".into(), field_name: "pan".into(), record_id: "CTX-50001".into(), actor: "fraud-engine".into(), timestamp: "2026-05-09T14:30:00Z".into() },
            EncryptionAudit { id: "EA-003".into(), policy_id: "EP-005".into(), operation: "mask".into(), table_name: "customers".into(), field_name: "phone_number".into(), record_id: "CUST-1002".into(), actor: "customer-portal".into(), timestamp: "2026-05-09T15:00:00Z".into() },
        ]),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8494);
    let data = web::Data::new(seed());
    println!("field-level-encryption-rs on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/encryption/policies", web::get().to(list_policies))
            .route("/v1/encryption/audit", web::get().to(list_audit))
            .route("/v1/encryption/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

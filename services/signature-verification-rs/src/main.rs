use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct MiddlewareConfig {
    kafka_broker: String, redis_url: String, postgres_url: String, opensearch_url: String,
    keycloak_url: String, permify_url: String, dapr_url: String, fluvio_url: String,
    temporal_url: String, mojaloop_url: String, tigerbeetle_url: String, lakehouse_url: String,
    apisix_url: String, openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()),
        opensearch_url: std::env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()),
        keycloak_url: std::env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()),
        permify_url: std::env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()),
        dapr_url: std::env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()),
        fluvio_url: std::env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()),
        temporal_url: std::env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()),
        mojaloop_url: std::env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()),
        tigerbeetle_url: std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()),
        lakehouse_url: std::env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()),
        apisix_url: std::env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()),
        openappsec_url: std::env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()),
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct SignatureRecord {
    id: String,
    customer_id: String,
    customer_name: String,
    signature_type: String,
    verification_method: String,
    confidence_score: f64,
    verified_by: String,
    document_type: String,
    status: String,
    verified_at: String,
}

fn seed() -> Vec<SignatureRecord> {
    vec![
        SignatureRecord { id: "SIG-001".into(), customer_id: "C-001".into(), customer_name: "Dangote Industries Ltd".into(), signature_type: "authorized_signatory".into(), verification_method: "biometric_match".into(), confidence_score: 98.5, verified_by: "auto".into(), document_type: "cheque".into(), status: "verified".into(), verified_at: "2026-05-09T10:30:00Z".into() },
        SignatureRecord { id: "SIG-002".into(), customer_id: "C-002".into(), customer_name: "BUA Group".into(), signature_type: "sole_signatory".into(), verification_method: "pattern_match".into(), confidence_score: 92.3, verified_by: "auto".into(), document_type: "transfer_instruction".into(), status: "verified".into(), verified_at: "2026-05-09T11:15:00Z".into() },
        SignatureRecord { id: "SIG-003".into(), customer_id: "C-003".into(), customer_name: "Emeka Obi".into(), signature_type: "joint_signatory".into(), verification_method: "manual_review".into(), confidence_score: 75.0, verified_by: "OPS-012".into(), document_type: "loan_agreement".into(), status: "pending_review".into(), verified_at: "2026-05-09T09:00:00Z".into() },
        SignatureRecord { id: "SIG-004".into(), customer_id: "C-004".into(), customer_name: "Adenuga Family Office".into(), signature_type: "authorized_signatory".into(), verification_method: "biometric_match".into(), confidence_score: 45.2, verified_by: "auto".into(), document_type: "cheque".into(), status: "rejected".into(), verified_at: "2026-05-08T16:45:00Z".into() },
        SignatureRecord { id: "SIG-005".into(), customer_id: "C-005".into(), customer_name: "NNPC Ltd".into(), signature_type: "dual_signatory".into(), verification_method: "pattern_match".into(), confidence_score: 88.7, verified_by: "auto".into(), document_type: "guarantee".into(), status: "verified".into(), verified_at: "2026-05-09T14:00:00Z".into() },
    ]
}

struct AppState { items: Mutex<Vec<SignatureRecord>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "signature-verification-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "broker": c.kafka_broker, "topics": ["signature.verifications","signature.alerts","signature.audit"] },
            "redis": { "url": c.redis_url, "cache_keys": ["signature-verification-rs:cache"] },
            "postgres": { "url": c.postgres_url, "tables": ["signature_records","signature_specimens","verification_logs"] },
            "opensearch": { "url": c.opensearch_url, "indices": ["signature-verifications","signature-audit"] },
            "keycloak": { "url": c.keycloak_url, "realm": "54bank", "client": "signature-verification-rs" },
            "permify": { "url": c.permify_url, "resources": ["signature-verification-rs"] },
            "dapr": { "url": c.dapr_url, "app_id": "signature-verification-rs", "pubsub": "signature-verification-rs-pubsub" },
            "fluvio": { "url": c.fluvio_url, "topics": ["signature-verification-rs-stream"] },
            "temporal": { "url": c.temporal_url, "workflows": ["SignatureVerificationWorkflow","SpecimenUpdateWorkflow"] },
            "mojaloop": { "url": c.mojaloop_url, "usage": "settlement" },
            "tigerbeetle": { "url": c.tigerbeetle_url, "ledgers": ["signature_fees","signature_fraud"] },
            "lakehouse": { "url": c.lakehouse_url, "tables": ["signature-verification-rs_history"] },
            "apisix": { "url": c.apisix_url, "routes": ["/v1/signature-verification-rs/*"] },
            "openappsec": { "url": c.openappsec_url, "policy": "signature-verification-rs-waf" }
        }
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8180".into()).parse().unwrap_or(8180);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Signature Verification Service running on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/signature-verification-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
}

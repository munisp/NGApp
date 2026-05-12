use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde_json::json;
use std::env;

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "secrets-rotation-rs", "port": 8318}))
}
async fn rotation_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "vault_backend": "hashicorp_vault",
        "vault_url": "https://vault.54bank.internal:8200",
        "seal_type": "awskms", "auto_unseal": true,
        "secret_engines": [
            {"engine": "kv-v2", "path": "secret/", "secrets": 247, "description": "Application secrets"},
            {"engine": "database", "path": "database/", "secrets": 12, "description": "Dynamic DB credentials"},
            {"engine": "transit", "path": "transit/", "keys": 8, "description": "Encryption as a service"},
            {"engine": "pki", "path": "pki/", "certs": 34, "description": "TLS certificate management"}
        ],
        "rotation_policies": [
            {"secret_type": "database_credentials", "rotation_days": 7, "last_rotation": "2026-05-08", "next_rotation": "2026-05-15", "auto": true},
            {"secret_type": "api_keys", "rotation_days": 90, "last_rotation": "2026-04-01", "next_rotation": "2026-06-30", "auto": true},
            {"secret_type": "jwt_signing_keys", "rotation_days": 30, "last_rotation": "2026-05-01", "next_rotation": "2026-05-31", "auto": true},
            {"secret_type": "tls_certificates", "rotation_days": 365, "last_rotation": "2026-01-15", "next_rotation": "2027-01-15", "auto": true},
            {"secret_type": "kafka_credentials", "rotation_days": 30, "auto": true},
            {"secret_type": "redis_passwords", "rotation_days": 14, "auto": true}
        ],
        "compliance": {"pci_dss": true, "cbn_guidelines": true, "sox": true, "iso27001": true}
    }))
}
async fn middleware_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka": {"topics": ["secrets.rotation", "secrets.audit"]},
        "dapr": {"stateStore": "secrets-state"}, "fluvio": {"topics": ["secrets-events"]},
        "temporal": {"workflows": ["secret-rotation-workflow", "cert-renewal"]},
        "postgres": {"tables": ["secret_rotation_log", "secret_policies"]},
        "keycloak": {"roles": ["secrets-admin"]},
        "permify": {"relations": ["secrets:can_rotate"]},
        "redis": {"keys": ["secrets:rotation:schedule"]},
        "mojaloop": {"oracle": "secrets-oracle"},
        "opensearch": {"indices": ["secrets-audit"]},
        "openappsec": {"policy": "secrets-protection"},
        "apisix": {"route": "/api/secrets-rotation/*"},
        "tigerbeetle": {"accounts": []},
        "lakehouse": {"tables": ["secrets_analytics"]}
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8318".into()).parse().unwrap_or(8318);
    println!("Secrets Rotation on :{}", port);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/api/secrets-rotation/config", web::get().to(rotation_config))
        .route("/api/secrets-rotation/middleware", web::get().to(middleware_config))
    ).bind(("0.0.0.0", port))?.run().await
}

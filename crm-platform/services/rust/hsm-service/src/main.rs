use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct KeyMetadata {
    key_id: String,
    algorithm: String,
    key_type: String,
    created_at: String,
    expires_at: Option<String>,
    status: String,
    tenant_id: String,
    purpose: String,
    rotation_policy: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptRequest {
    tenant_id: String,
    key_id: String,
    plaintext: String,
    context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptResponse {
    ciphertext: String,
    key_id: String,
    iv: String,
    algorithm: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DecryptRequest {
    tenant_id: String,
    key_id: String,
    ciphertext: String,
    iv: String,
    context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SignRequest {
    tenant_id: String,
    key_id: String,
    message: String,
    algorithm: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RotateKeyRequest {
    tenant_id: String,
    key_id: String,
    new_algorithm: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GenerateKeyRequest {
    tenant_id: String,
    algorithm: String,
    key_type: String,
    purpose: String,
    rotation_policy: String,
    expires_in_days: Option<u32>,
}

struct AppState {
    keys: Mutex<Vec<KeyMetadata>>,
}

fn seed_keys() -> Vec<KeyMetadata> {
    vec![
        KeyMetadata {
            key_id: "key-aes-001".into(), algorithm: "AES-256-GCM".into(), key_type: "symmetric".into(),
            created_at: "2026-01-15T10:00:00Z".into(), expires_at: Some("2027-01-15T10:00:00Z".into()),
            status: "active".into(), tenant_id: "acme-bank".into(), purpose: "data-encryption".into(),
            rotation_policy: "90-days".into(),
        },
        KeyMetadata {
            key_id: "key-rsa-002".into(), algorithm: "RSA-4096".into(), key_type: "asymmetric".into(),
            created_at: "2026-02-01T08:00:00Z".into(), expires_at: Some("2028-02-01T08:00:00Z".into()),
            status: "active".into(), tenant_id: "acme-bank".into(), purpose: "digital-signatures".into(),
            rotation_policy: "365-days".into(),
        },
        KeyMetadata {
            key_id: "key-ec-003".into(), algorithm: "ECDSA-P384".into(), key_type: "asymmetric".into(),
            created_at: "2026-03-10T14:00:00Z".into(), expires_at: None,
            status: "active".into(), tenant_id: "acme-bank".into(), purpose: "api-signing".into(),
            rotation_policy: "180-days".into(),
        },
        KeyMetadata {
            key_id: "key-hmac-004".into(), algorithm: "HMAC-SHA512".into(), key_type: "symmetric".into(),
            created_at: "2025-06-01T00:00:00Z".into(), expires_at: Some("2026-06-01T00:00:00Z".into()),
            status: "pending-rotation".into(), tenant_id: "acme-bank".into(), purpose: "webhook-verification".into(),
            rotation_policy: "365-days".into(),
        },
    ]
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "hsm-service"}))
}

async fn list_keys(data: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let keys = data.keys.lock().unwrap();
    let tenant_id = query.get("tenant_id").cloned().unwrap_or_default();
    let filtered: Vec<_> = keys.iter()
        .filter(|k| tenant_id.is_empty() || k.tenant_id == tenant_id)
        .collect();
    HttpResponse::Ok().json(serde_json::json!({
        "keys": filtered,
        "total": filtered.len()
    }))
}

async fn get_key(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let key_id = path.into_inner();
    let keys = data.keys.lock().unwrap();
    match keys.iter().find(|k| k.key_id == key_id) {
        Some(key) => HttpResponse::Ok().json(key),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Key not found"})),
    }
}

async fn generate_key(data: web::Data<AppState>, body: web::Json<GenerateKeyRequest>) -> HttpResponse {
    let new_key = KeyMetadata {
        key_id: format!("key-{}-{}", body.algorithm.to_lowercase().replace("-", ""), uuid_simple()),
        algorithm: body.algorithm.clone(),
        key_type: body.key_type.clone(),
        created_at: chrono_now(),
        expires_at: body.expires_in_days.map(|d| format!("{}d from now", d)),
        status: "active".into(),
        tenant_id: body.tenant_id.clone(),
        purpose: body.purpose.clone(),
        rotation_policy: body.rotation_policy.clone(),
    };
    let mut keys = data.keys.lock().unwrap();
    keys.push(new_key.clone());
    HttpResponse::Created().json(new_key)
}

async fn encrypt(_body: web::Json<EncryptRequest>) -> HttpResponse {
    HttpResponse::Ok().json(EncryptResponse {
        ciphertext: "encrypted:base64data".into(),
        key_id: _body.key_id.clone(),
        iv: "random-iv-base64".into(),
        algorithm: "AES-256-GCM".into(),
    })
}

async fn decrypt(_body: web::Json<DecryptRequest>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "plaintext": "decrypted-data",
        "key_id": _body.key_id,
    }))
}

async fn sign(_body: web::Json<SignRequest>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "signature": "base64-signature-data",
        "key_id": _body.key_id,
        "algorithm": _body.algorithm,
    }))
}

async fn rotate_key(data: web::Data<AppState>, body: web::Json<RotateKeyRequest>) -> HttpResponse {
    let mut keys = data.keys.lock().unwrap();
    if let Some(key) = keys.iter_mut().find(|k| k.key_id == body.key_id && k.tenant_id == body.tenant_id) {
        key.status = "rotated".into();
        let new_key = KeyMetadata {
            key_id: format!("{}-rotated", key.key_id),
            algorithm: body.new_algorithm.clone().unwrap_or_else(|| key.algorithm.clone()),
            key_type: key.key_type.clone(),
            created_at: chrono_now(),
            expires_at: key.expires_at.clone(),
            status: "active".into(),
            tenant_id: body.tenant_id.clone(),
            purpose: key.purpose.clone(),
            rotation_policy: key.rotation_policy.clone(),
        };
        keys.push(new_key.clone());
        HttpResponse::Ok().json(serde_json::json!({"old_key": body.key_id, "new_key": new_key}))
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Key not found"}))
    }
}

async fn audit_log() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "events": [
            {"event": "key-generated", "key_id": "key-aes-001", "user": "system", "timestamp": "2026-01-15T10:00:00Z"},
            {"event": "encrypt", "key_id": "key-aes-001", "user": "crm-service", "timestamp": "2026-05-04T14:22:00Z"},
            {"event": "key-rotated", "key_id": "key-hmac-004", "user": "admin", "timestamp": "2026-05-03T09:00:00Z"},
        ]
    }))
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}", d.as_nanos())
}

fn chrono_now() -> String {
    "2026-05-04T20:00:00Z".to_string()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let state = web::Data::new(AppState { keys: Mutex::new(seed_keys()) });
    let port = std::env::var("PORT").unwrap_or_else(|_| "8120".into()).parse::<u16>().unwrap_or(8120);
    println!("HSM Service starting on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/health", web::get().to(health))
            .route("/api/v1/keys", web::get().to(list_keys))
            .route("/api/v1/keys/{key_id}", web::get().to(get_key))
            .route("/api/v1/keys/generate", web::post().to(generate_key))
            .route("/api/v1/encrypt", web::post().to(encrypt))
            .route("/api/v1/decrypt", web::post().to(decrypt))
            .route("/api/v1/sign", web::post().to(sign))
            .route("/api/v1/keys/rotate", web::post().to(rotate_key))
            .route("/api/v1/audit", web::get().to(audit_log))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

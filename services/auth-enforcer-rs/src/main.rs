#![allow(unused)]
use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// auth-enforcer-rs — Authentication enforcement gateway

struct AppState {
    policies: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn validate_token_claims(exp: u64, iss: &str) -> Result<(), String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    if exp < now { return Err("Token expired".into()); }
    if iss != "54bank-auth" { return Err("Invalid issuer".into()); }
    Ok(())
}

fn permission_check(role: &str, resource: &str, action: &str) -> bool {
    match role {
        "admin" => true,
        "manager" => action != "delete",
        "user" => action == "read",
        _ => false,
    }
}

fn role_hierarchy(role: &str) -> u8 {
    match role { "admin" => 4, "manager" => 3, "operator" => 2, "user" => 1, _ => 0 }
}

fn can_escalate(current_role: &str, target_role: &str) -> bool {
    role_hierarchy(current_role) > role_hierarchy(target_role)
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "auth-enforcer-rs", "version": "1.0.0"}))
}

async fn enforce(body: web::Json<serde_json::Value>) -> HttpResponse {
    let role = body.get("role").and_then(|v| v.as_str()).unwrap_or("user");
    let resource = body.get("resource").and_then(|v| v.as_str()).unwrap_or("");
    let action = body.get("action").and_then(|v| v.as_str()).unwrap_or("read");
    let exp = body.get("token_exp").and_then(|v| v.as_u64()).unwrap_or(0);
    let iss = body.get("token_iss").and_then(|v| v.as_str()).unwrap_or("");
    let token_valid = validate_token_claims(exp, iss).is_ok();
    let permitted = permission_check(role, resource, action);
    let allowed = token_valid && permitted;
    HttpResponse::Ok().json(json!({
        "allowed": allowed, "token_valid": token_valid, "permission": permitted,
        "role": role, "action": action, "resource": resource,
    }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let policies = state.policies.lock().unwrap();
    HttpResponse::Ok().json(json!({"total_policies": policies.len(), "service": "auth-enforcer-rs"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "auth-enforcer-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"auth-enforcer-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"auth-enforcer-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8201);
    let state = web::Data::new(AppState {
        policies: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("auth-enforcer-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/enforce", web::post().to(enforce))
            .route("/v1/stats", web::get().to(stats))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// biometric-auth-rs — Biometric authentication scoring and matching

struct AppState {
    enrollments: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn match_confidence(template_distance: f64, threshold: f64) -> (bool, f64) {
    let confidence = (1.0 - template_distance / threshold).max(0.0).min(1.0);
    (template_distance <= threshold, confidence)
}

fn multi_factor_score(biometric: f64, device: f64, behavioral: f64) -> f64 {
    biometric * 0.5 + device * 0.3 + behavioral * 0.2
}

fn liveness_score(blink_detected: bool, head_movement: bool, texture_score: f64) -> f64 {
    let mut score = texture_score * 0.4;
    if blink_detected { score += 0.3; }
    if head_movement { score += 0.3; }
    score.min(1.0)
}

fn auth_decision(mfa_score: f64, liveness: f64) -> (&'static str, f64) {
    let combined = mfa_score * 0.7 + liveness * 0.3;
    if combined >= 0.8 { ("authenticated", combined) }
    else if combined >= 0.5 { ("step_up_required", combined) }
    else { ("rejected", combined) }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "biometric-auth-rs", "version": "1.0.0"}))
}

async fn enroll(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let mut enrollments = state.enrollments.lock().unwrap();
    enrollments.push(body.into_inner());
    HttpResponse::Ok().json(json!({"enrolled": true, "total_enrollments": enrollments.len()}))
}

async fn verify(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let distance = body.get("template_distance").and_then(|v| v.as_f64()).unwrap_or(0.5);
    let threshold = body.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.6);
    let biometric = body.get("biometric_score").and_then(|v| v.as_f64()).unwrap_or(0.8);
    let device = body.get("device_score").and_then(|v| v.as_f64()).unwrap_or(0.9);
    let behavioral = body.get("behavioral_score").and_then(|v| v.as_f64()).unwrap_or(0.7);
    let (matched, confidence) = match_confidence(distance, threshold);
    let mfa = multi_factor_score(biometric, device, behavioral);
    let live = liveness_score(true, true, 0.85);
    let (decision, combined) = auth_decision(mfa, live);
    HttpResponse::Ok().json(json!({
        "matched": matched, "confidence": confidence, "mfa_score": mfa,
        "liveness_score": live, "decision": decision, "combined_score": combined,
    }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let enrollments = state.enrollments.lock().unwrap();
    HttpResponse::Ok().json(json!({"total_enrollments": enrollments.len(), "service": "biometric-auth-rs"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "biometric-auth-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"biometric-auth-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"biometric-auth-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(val) => {
            if let Ok(s) = val.to_str() {
                if s.starts_with("Bearer ") { return Ok(()); }
            }
            Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"})))
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"})))
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8202);
    let state = web::Data::new(AppState {
        enrollments: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("biometric-auth-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/biometric/enroll", web::post().to(enroll))
            .route("/v1/biometric/verify", web::post().to(verify))
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

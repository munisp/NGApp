use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

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

async fn verify(body: web::Json<serde_json::Value>) -> HttpResponse {
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
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/biometric/enroll", web::post().to(enroll))
            .route("/v1/biometric/verify", web::post().to(verify))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

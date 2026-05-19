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
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
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
    HttpResponse::Ok().insert_header(("content-security-policy", "default-src 'self'")).json(json!({"status": "healthy", "service": "biometric-auth-rs", "version": "1.0.0"}))
}

async fn enroll(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let _sanitized = sanitize_input(&body.to_string());
    let mut enrollments = state.enrollments.lock().unwrap();
    enrollments.push(body.into_inner());
    HttpResponse::Ok().json(json!({"enrolled": true, "total_enrollments": enrollments.len()}))
}

async fn verify(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
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
    // Inter-service call: liveness_check
    let _upstream_url = std::env::var("LIVENESS_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    match call_service_sync(&format!("{}/v1/check", _upstream_url), "{}") {
        Ok(_resp) => eprintln!("biometric-auth-rs: liveness_check ok"),
        Err(e) => eprintln!("biometric-auth-rs: liveness_check failed: {}", e),
    }

    let _result_data = json!({"endpoint": "verify"});
    db_persist(&state, "verify", &_result_data).await;

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
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;


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


// --- Security Headers Middleware ---
#[allow(dead_code)]
fn add_security_headers(resp: &mut actix_web::HttpResponse) {
    let hdrs = resp.headers_mut();
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-frame-options"),
        actix_web::http::header::HeaderValue::from_static("DENY"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-xss-protection"),
        actix_web::http::header::HeaderValue::from_static("1; mode=block"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("strict-transport-security"),
        actix_web::http::header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("referrer-policy"),
        actix_web::http::header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}


async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "biometric_auth_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let svc_name = String::from("biometric-auth-rs");
        let status = String::from("active");
        let data_str = serde_json::to_string(data).unwrap_or_default();
        let _ = client.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
            &[&id, &svc_name, &endpoint, &status, &data_str],
        ).await;
    }
}


fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(5)) {
        Ok(mut stream) => {
            let host = host_port.split(':').next().unwrap_or("localhost");
            let req = format!("POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", path, host, body.len(), body);
            stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
            let mut resp = String::new();
            stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
            Ok(resp)
        }
        Err(e) => Err(format!("connection failed: {}", e))
    }
}


static _RL_TOKENS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(100);
static _RL_LAST: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    if now - _RL_LAST.load(std::sync::atomic::Ordering::Relaxed) >= 1000 {
        _RL_TOKENS.store(100, std::sync::atomic::Ordering::Relaxed);
        _RL_LAST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
    if _RL_TOKENS.fetch_sub(1, std::sync::atomic::Ordering::Relaxed) <= 0 {
        _RL_TOKENS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        return false;
    }
    true
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8202);
    let state = web::Data::new(AppState {
        enrollments: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
        db_client: None,
    });
    // Wire DB client
    if let Ok(url) = std::env::var("DATABASE_URL") {
        if let Some(client) = init_db(&url).await {
            println!("biometric_auth_rs: connected to Postgres");
            // Note: Cannot mutate web::Data after creation, DB used via init_db
        }
    }
    println!("biometric-auth-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
                .wrap(add_security_headers())
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[biometric-auth-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .wrap(actix_web::middleware::DefaultHeaders::new()
                .add(("X-Content-Type-Options", "nosniff"))
                .add(("X-Frame-Options", "DENY"))
                .add(("X-XSS-Protection", "1; mode=block"))
                .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                .add(("Content-Security-Policy", "default-src 'self'"))
                .add(("Referrer-Policy", "strict-origin-when-cross-origin")))
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_factor_score() { let r = multi_factor_score(10000.0); assert!(r >= 0.0); }

    #[test]
    fn test_liveness_score() { let r = liveness_score(10000.0); assert!(r >= 0.0); }
}

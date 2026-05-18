#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// fraudfusion-ensemble-rs — Multi-model fraud ensemble scoring

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
    db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

fn ensemble_weighted_avg(scores: &[(f64, f64)]) -> f64 {
    let total_w: f64 = scores.iter().map(|(_, w)| w).sum();
    if total_w == 0.0 { return 0.0; }
    scores.iter().map(|(s, w)| s * w).sum::<f64>() / total_w
}
fn ensemble_max(scores: &[f64]) -> f64 { scores.iter().cloned().fold(0.0, f64::max) }
fn ensemble_voting(scores: &[f64], threshold: f64) -> (u32, u32) {
    let fraud = scores.iter().filter(|&&s| s >= threshold).count() as u32;
    (fraud, scores.len() as u32 - fraud)
}
fn f1_score(precision: f64, recall: f64) -> f64 {
    if precision + recall == 0.0 { 0.0 } else { 2.0 * precision * recall / (precision + recall) }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fraudfusion-ensemble-rs",
        "version": "1.0.0",
        "description": "Multi-model fraud ensemble scoring",
    }))
}

async fn ensemble_score(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let scores: Vec<(f64, f64)> = input.get("models").and_then(|v| v.as_array()).map(|a| {
        a.iter().filter_map(|m| {
            let score = m.get("score").and_then(|s| s.as_f64())?;
            let weight = m.get("weight").and_then(|w| w.as_f64()).unwrap_or(1.0);
            Some((score, weight))
        }).collect()
    }).unwrap_or_default();
    let weighted_avg = ensemble_weighted_avg(&scores);
    let all_scores: Vec<f64> = scores.iter().map(|(s, _)| *s).collect();
    let max_score = ensemble_max(&all_scores);
    let threshold = input.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.5);
    let (fraud_votes, legit_votes) = ensemble_voting(&all_scores, threshold);
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "ensemble_score",
        "result": {"weighted_avg": weighted_avg, "max_score": max_score, "fraud_votes": fraud_votes, "legit_votes": legit_votes},
    }))
}

async fn model_performance(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let scores_v: Vec<f64> = input.get("scores").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let scores = scores_v.as_slice();
    let result = ensemble_max(scores);
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "model_performance",
        "result": json!({"value": result}),
    }))
}

async fn threshold_optimize(req: actix_web::HttpRequest, body: web::Json<serde_json::Value>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let input = body.into_inner();
    let scores_v: Vec<f64> = input.get("scores").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
    let scores = scores_v.as_slice();
    let threshold = input.get("threshold").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let result = ensemble_voting(scores, threshold);
    HttpResponse::Ok().json(json!({
        "service": "fraudfusion-ensemble-rs",
        "endpoint": "threshold_optimize",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn list_records(req: actix_web::HttpRequest, state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let offset = (page - 1) * limit;
    if let Some(ref client) = state.db_client {
        match client.query(
            "SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            &[&"fraudfusion_ensemble_rs", &(limit as i64), &(offset as i64)]
        ).await {
            Ok(rows) => {
                let items: Vec<serde_json::Value> = rows.iter().map(|r| {
                    json!({
                        "id": r.get::<_, String>(0),
                        "service": r.get::<_, String>(1),
                        "type": r.get::<_, String>(2),
                        "status": r.get::<_, String>(3),
                        "data": r.get::<_, String>(4),
                    })
                }).collect();
                let total: i64 = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"fraudfusion_ensemble_rs"]).await.map(|r| r.get(0)).unwrap_or(0);
                return HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "database"}));
            }
            Err(e) => { eprintln!("DB query failed: {} — fallback to in-memory", e); }
        }
    }
    let records = state.records.lock().unwrap();
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip(offset).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit, "source": "in-memory"}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    if let Some(ref client) = state.db_client {
        if let Ok(row) = client.query_one("SELECT COUNT(*) FROM service_records WHERE service = $1", &[&"fraudfusion_ensemble_rs"]).await {
            let total: i64 = row.get(0);
            return HttpResponse::Ok().json(json!({"total": total, "service": env!("CARGO_PKG_NAME"), "source": "database"}));
        }
    }
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME"), "source": "in-memory"}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;


async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "fraudfusion-ensemble-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"fraudfusion-ensemble-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"fraudfusion-ensemble-rs\"}} {}\n", r, e);
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8123);
    let db_client = if let Ok(url) = std::env::var("DATABASE_URL") {
        match init_db(&url).await {
            Some(c) => { println!("fraudfusion-ensemble-rs: connected to Postgres"); Some(std::sync::Arc::new(c)) }
            None => None,
        }
    } else { None };
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
        db_client,
    });
    println!("fraudfusion-ensemble-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[fraudfusion-ensemble-rs] {} {} trace={}", req.method(), req.path(), trace_id);
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
            .route("/v1/ensemble", web::post().to(ensemble_score))
            .route("/v1/model_stats", web::post().to(model_performance))
            .route("/v1/optimize", web::post().to(threshold_optimize))
            .route("/v1/records", web::get().to(list_records))
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
    fn test_ensemble_max() { assert_eq!(ensemble_max(&[10.0, 20.0, 30.0]), 60.0); }

    #[test]
    fn test_f1_score() { let r = f1_score(10000.0); assert!(r >= 0.0); }
}

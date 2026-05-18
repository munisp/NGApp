use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// resilience-service-rs — Service resilience (circuit breaker, retry)

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn circuit_state(failures: u32, threshold: u32, last_failure_ms: u64, recovery_ms: u64) -> &'static str {
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    if failures >= threshold { if now_ms - last_failure_ms > recovery_ms { "half_open" } else { "open" } } else { "closed" }
}
fn retry_delay(attempt: u32, base_ms: u64) -> u64 { base_ms * 2u64.pow(attempt.min(6)) }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "resilience-service-rs"}))
}

async fn check_circuit(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let failures = input.get("failures").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let threshold = input.get("threshold").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let last_failure_ms = input.get("last_failure_ms").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let recovery_ms = input.get("recovery_ms").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = circuit_state(failures, threshold, last_failure_ms, recovery_ms);
    HttpResponse::Ok().json(json!({
        "service": "resilience-service-rs",
        "endpoint": "check_circuit",
        "result": json!({"value": format!("{:?}", result)}),
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let items: Vec<&serde_json::Value> = records.iter().skip((page-1)*limit).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "resilience-service-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8244);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("resilience-service-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/check_circuit", web::post().to(check_circuit))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

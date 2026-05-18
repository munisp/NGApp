use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// mtls-mesh-rs — Mutual TLS service mesh

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn cert_valid(not_before: u64, not_after: u64) -> bool { let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(); now >= not_before && now <= not_after }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "mtls-mesh-rs"}))
}

async fn verify_cert(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let not_before = input.get("not_before").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let not_after = input.get("not_after").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let result = cert_valid(not_before, not_after);
    HttpResponse::Ok().json(json!({
        "service": "mtls-mesh-rs",
        "endpoint": "verify_cert",
        "result": json!({"value": result}),
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "mtls-mesh-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8228);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("mtls-mesh-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/verify_cert", web::post().to(verify_cert))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// jwt-validator-rs — JWT token validation

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn validate_claims(exp: u64, nbf: u64, iss: &str) -> Vec<String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let mut errors = Vec::new();
    if exp < now { errors.push("token expired".into()); }
    if nbf > now { errors.push("token not yet valid".into()); }
    if iss.is_empty() { errors.push("missing issuer".into()); }
    errors
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "jwt-validator-rs"}))
}

async fn validate_jwt(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let exp = input.get("exp").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let nbf = input.get("nbf").and_then(|v| v.as_u64()).unwrap_or(0) as u64;
    let iss_s = input.get("iss").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let iss = iss_s.as_str();
    let result = validate_claims(exp, nbf, iss);
    HttpResponse::Ok().json(json!({
        "service": "jwt-validator-rs",
        "endpoint": "validate_jwt",
        "result": serde_json::to_value(&result).unwrap_or(json!([])),
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "jwt-validator-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8224);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("jwt-validator-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/validate_jwt", web::post().to(validate_jwt))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

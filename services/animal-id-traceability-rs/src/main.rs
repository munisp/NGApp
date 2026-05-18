use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// animal-id-traceability-rs — Livestock identification and traceability

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn generate_nlis_tag(state: &str, species: &str, seq: u32) -> String { format!("{}-{}-{:06}", state, species, seq) }
fn movement_record(from: &str, to: &str) -> String { format!("{} -> {}", from, to) }
fn quarantine_required(disease_zone: bool) -> bool { disease_zone }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "animal-id-traceability-rs"}))
}

async fn trace_animal(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let state_s = input.get("state").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let state = state_s.as_str();
    let species_s = input.get("species").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let species = species_s.as_str();
    let seq = input.get("seq").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let result = generate_nlis_tag(state, species, seq);
    HttpResponse::Ok().json(json!({
        "service": "animal-id-traceability-rs",
        "endpoint": "trace_animal",
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
    HttpResponse::Ok().json(json!({"total": records.len(), "service": "animal-id-traceability-rs"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8172);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("animal-id-traceability-rs on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/trace_animal", web::post().to(trace_animal))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

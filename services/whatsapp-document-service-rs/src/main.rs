#![allow(unused)]
use tokio_postgres;
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// whatsapp-document-service-rs — WhatsApp document processing service

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}

fn supported_mime(mime: &str) -> bool {
    matches!(mime, "image/jpeg" | "image/png" | "application/pdf" | "image/webp")
}
fn max_file_size_mb() -> u64 { 16 }
fn document_type_from_text(text: &str) -> &str {
    let lower = text.to_lowercase();
    if lower.contains("national identity") || lower.contains("nin") { "national_id" }
    else if lower.contains("driver") { "drivers_license" }
    else if lower.contains("passport") { "passport" }
    else if lower.contains("voter") { "voters_card" }
    else { "unknown" }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "whatsapp-document-service-rs",
        "version": "1.0.0",
        "description": "WhatsApp document processing service",
    }))
}

async fn process_document(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let mime_s = input.get("mime").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let mime = mime_s.as_str();
    let result = supported_mime(mime);
    HttpResponse::Ok().json(json!({
        "service": "whatsapp-document-service-rs",
        "endpoint": "process_document",
        "result": json!({"value": result}),
    }))
}

async fn extract_text(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();

    let result = max_file_size_mb();
    HttpResponse::Ok().json(json!({
        "service": "whatsapp-document-service-rs",
        "endpoint": "extract_text",
        "result": json!({"value": result}),
    }))
}

async fn classify_document(body: web::Json<serde_json::Value>) -> HttpResponse {
    let input = body.into_inner();
    let text_s = input.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let text = text_s.as_str();
    let result = document_type_from_text(text);
    HttpResponse::Ok().json(json!({
        "service": "whatsapp-document-service-rs",
        "endpoint": "classify_document",
        "result": json!({"value": result}),
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let start = (page - 1) * limit;
    let items: Vec<&serde_json::Value> = records.iter().skip(start).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME")}))
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "whatsapp-document-service-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"whatsapp-document-service-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"whatsapp-document-service-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8139);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("whatsapp-document-service-rs listening on port {}", port);
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
            .route("/v1/process", web::post().to(process_document))
            .route("/v1/extract", web::post().to(extract_text))
            .route("/v1/classify", web::post().to(classify_document))
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

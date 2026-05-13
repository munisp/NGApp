use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;

#[derive(Clone)]
struct AppState { start_time: Instant }

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "ip-allowlist-rs",
        "status": "healthy",
        "domain": "Ip Allowlist",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "ip-allowlist.events, ip-allowlist.audit",
            "postgres": "ip_allowlist_records",
            "redis": "ip-allowlist_cache",
            "temporal": "IpAllowlistWorkflow",
            "tigerbeetle": "ledger_integration",
            "opensearch": "ip-allowlist-2026"
        }
    }))
}


async fn list_records() -> HttpResponse {
    HttpResponse::Ok().json(json!({"records": [
        {"id": "REC-001", "status": "active", "domain": "Ip Allowlist", "createdAt": "2026-05-09T10:00:00Z"},
        {"id": "REC-002", "status": "processing", "domain": "Ip Allowlist", "createdAt": "2026-05-09T11:00:00Z"},
        {"id": "REC-003", "status": "completed", "domain": "Ip Allowlist", "createdAt": "2026-05-08T14:00:00Z"},
    ], "total": 3, "domain": "Ip Allowlist"}))
}
async fn create_record(body: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Created().json(json!({"created": true, "data": *body}))
}
async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(json!({"total": 1247, "active": 1100, "pending": 120, "archived": 27}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "9246".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("Ip Allowlist (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ip-allowlist/list", web::get().to(list_records))
            .route("/v1/ip-allowlist/create", web::post().to(create_record))
            .route("/v1/ip-allowlist/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

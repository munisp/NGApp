use actix_web::{web, App, HttpServer, HttpResponse};
use serde::Serialize;

#[derive(Serialize, Clone)]
struct RateLimitPolicy {
    id: String, tenant_id: String, endpoint: String,
    requests_per_minute: u32, burst_limit: u32, status: String,
}

fn seed_data() -> Vec<RateLimitPolicy> {
    vec![
        RateLimitPolicy { id: "RL-001".into(), tenant_id: "TEN-GTBANK".into(), endpoint: "/api/transfers".into(), requests_per_minute: 1000, burst_limit: 2000, status: "active".into() },
        RateLimitPolicy { id: "RL-002".into(), tenant_id: "TEN-FIRSTBANK".into(), endpoint: "/api/payments".into(), requests_per_minute: 800, burst_limit: 1500, status: "active".into() },
        RateLimitPolicy { id: "RL-003".into(), tenant_id: "TEN-ACCESS".into(), endpoint: "/api/accounts".into(), requests_per_minute: 500, burst_limit: 1000, status: "active".into() },
        RateLimitPolicy { id: "RL-004".into(), tenant_id: "TEN-UBA".into(), endpoint: "/api/cards".into(), requests_per_minute: 300, burst_limit: 600, status: "active".into() },
        RateLimitPolicy { id: "RL-005".into(), tenant_id: "TEN-WEMA".into(), endpoint: "/api/*".into(), requests_per_minute: 200, burst_limit: 400, status: "throttled".into() },
    ]
}

async fn list_policies() -> HttpResponse {
    let data = seed_data();
    HttpResponse::Ok().json(serde_json::json!({"items": data, "total": data.len()}))
}

async fn get_stats() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"total_policies": 5, "active": 4, "throttled": 1, "avg_rpm": 560, "total_requests_today": 4850000}))
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status":"healthy","service":"tenant-ratelimit-rs","port":8259}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8259".into()).parse::<u16>().unwrap_or(8259);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/v1/rate-limits", web::get().to(list_policies))
        .route("/v1/stats", web::get().to(get_stats))
    ).bind(("0.0.0.0", port))?.run().await
}

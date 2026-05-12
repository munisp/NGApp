use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RateLimitPolicy { id: String, name: String, endpoint_pattern: String, window_seconds: u32, max_requests: u32, burst_limit: u32, penalty_action: String, applies_to: String, status: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RateLimitEvent { id: String, policy_id: String, client_id: String, ip_address: String, endpoint: String, action_taken: String, requests_in_window: u32, timestamp: String }

struct State { policies: Mutex<Vec<RateLimitPolicy>>, events: Mutex<Vec<RateLimitEvent>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "adaptive-rate-limiter-rs", "version": "3.0.0", "status": "healthy", "port": 8493,
        "description": "Adaptive Rate Limiter — Token bucket, sliding window, per-IP/per-key/per-tenant with DDoS mitigation",
        "features": ["token_bucket", "sliding_window", "fixed_window", "per_ip", "per_api_key", "per_tenant", "adaptive_thresholds", "ddos_mitigation", "graceful_degradation", "bypass_whitelist"],
        "middleware": {
            "kafka": {"topics": ["rate-limit.triggered", "rate-limit.ddos-detected"]},
            "redis": {"usage": "Rate limit counters, sliding window state"},
            "postgres": {"tables": ["rate_limit_policies", "rate_limit_events"]},
            "opensearch": {"indices": ["rate-limit-events"]},
            "keycloak": {"realm": "54bank"}, "permify": {"schema": "rate_limiter"},
            "dapr": {"appId": "adaptive-rate-limiter-rs"}, "fluvio": {"topics": ["rate-limit-stream"]},
            "temporal": {"workflows": ["ddos-investigation", "adaptive-threshold-update"]},
            "mojaloop": {"usage": "Payment rate limiting"}, "tigerbeetle": {"ledger": 23},
            "lakehouse": {"tables": ["rate_limit_analytics"]},
            "apisix": {"routes": ["/v1/rate-limits/*"]}, "openappsec": {"policy": "ddos-rate-limiting"}
        }
    }))
}

async fn list_policies(data: web::Data<State>) -> HttpResponse {
    let p = data.policies.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *p, "total": p.len()}))
}
async fn list_events(data: web::Data<State>) -> HttpResponse {
    let e = data.events.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *e, "total": e.len()}))
}
async fn stats(data: web::Data<State>) -> HttpResponse {
    let e = data.events.lock().unwrap();
    let mut by_action: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for ev in e.iter() { *by_action.entry(ev.action_taken.clone()).or_insert(0) += 1; }
    HttpResponse::Ok().json(serde_json::json!({"totalEvents": e.len(), "byAction": by_action}))
}

fn seed() -> State {
    State {
        policies: Mutex::new(vec![
            RateLimitPolicy { id: "RL-001".into(), name: "Standard API".into(), endpoint_pattern: "/api/v2/*".into(), window_seconds: 60, max_requests: 100, burst_limit: 150, penalty_action: "throttle".into(), applies_to: "per_api_key".into(), status: "active".into() },
            RateLimitPolicy { id: "RL-002".into(), name: "Auth Endpoints".into(), endpoint_pattern: "/api/auth/*".into(), window_seconds: 300, max_requests: 10, burst_limit: 15, penalty_action: "block_15min".into(), applies_to: "per_ip".into(), status: "active".into() },
            RateLimitPolicy { id: "RL-003".into(), name: "Transfer API".into(), endpoint_pattern: "/api/v2/transfers".into(), window_seconds: 60, max_requests: 30, burst_limit: 40, penalty_action: "throttle+alert".into(), applies_to: "per_api_key".into(), status: "active".into() },
            RateLimitPolicy { id: "RL-004".into(), name: "DDoS Protection".into(), endpoint_pattern: "/*".into(), window_seconds: 10, max_requests: 500, burst_limit: 1000, penalty_action: "block+investigate".into(), applies_to: "per_ip".into(), status: "active".into() },
        ]),
        events: Mutex::new(vec![
            RateLimitEvent { id: "RLE-001".into(), policy_id: "RL-002".into(), client_id: "unknown".into(), ip_address: "185.220.101.45".into(), endpoint: "/api/auth/login".into(), action_taken: "blocked".into(), requests_in_window: 15, timestamp: "2026-05-09T14:00:00Z".into() },
            RateLimitEvent { id: "RLE-002".into(), policy_id: "RL-001".into(), client_id: "AK-002".into(), ip_address: "52.31.139.75".into(), endpoint: "/api/v2/accounts".into(), action_taken: "throttled".into(), requests_in_window: 120, timestamp: "2026-05-09T14:30:00Z".into() },
            RateLimitEvent { id: "RLE-003".into(), policy_id: "RL-004".into(), client_id: "unknown".into(), ip_address: "45.33.32.156".into(), endpoint: "/api/v2/health".into(), action_taken: "blocked+investigated".into(), requests_in_window: 850, timestamp: "2026-05-09T13:00:00Z".into() },
        ]),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8493);
    let data = web::Data::new(seed());
    println!("adaptive-rate-limiter-rs on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/rate-limits/policies", web::get().to(list_policies))
            .route("/v1/rate-limits/events", web::get().to(list_events))
            .route("/v1/rate-limits/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

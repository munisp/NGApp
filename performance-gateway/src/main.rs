use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

#[derive(Debug, Serialize)]
struct GatewayMetrics {
    total_requests: u64,
    requests_per_second: f64,
    avg_latency_ms: f64,
    p99_latency_ms: f64,
    cache_hit_rate: f64,
    circuit_breakers_open: u32,
    active_connections: u32,
    rate_limited_requests: u64,
    uptime_seconds: u64,
}

#[derive(Debug, Serialize)]
struct CircuitBreaker {
    service: String,
    status: String, // closed, open, half_open
    failure_count: u32,
    success_count: u32,
    threshold: u32,
    last_failure: String,
    recovery_timeout_sec: u32,
}

struct AppState {
    request_count: AtomicU64,
}

async fn gateway_metrics(data: web::Data<Arc<AppState>>) -> HttpResponse {
    let count = data.request_count.fetch_add(1, Ordering::Relaxed);
    HttpResponse::Ok().json(GatewayMetrics {
        total_requests: count + 1,
        requests_per_second: 2500.0,
        avg_latency_ms: 3.2,
        p99_latency_ms: 15.0,
        cache_hit_rate: 0.72,
        circuit_breakers_open: 0,
        active_connections: 1250,
        rate_limited_requests: 45,
        uptime_seconds: 2592000, // 30 days
    })
}

async fn circuit_breakers() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "circuit_breakers": [
            CircuitBreaker {
                service: "claims-engine".into(),
                status: "closed".into(),
                failure_count: 2,
                success_count: 15420,
                threshold: 5,
                last_failure: "2026-05-15T10:30:00Z".into(),
                recovery_timeout_sec: 30,
            },
            CircuitBreaker {
                service: "payment-gateway".into(),
                status: "closed".into(),
                failure_count: 0,
                success_count: 45000,
                threshold: 5,
                last_failure: "never".into(),
                recovery_timeout_sec: 30,
            },
            CircuitBreaker {
                service: "kyc-service".into(),
                status: "closed".into(),
                failure_count: 1,
                success_count: 8900,
                threshold: 5,
                last_failure: "2026-05-14T08:00:00Z".into(),
                recovery_timeout_sec: 60,
            },
        ]
    }))
}

async fn rate_limit_config() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "global_rate_limit": 10000,
        "per_ip_limit": 100,
        "per_api_key_limit": 5000,
        "burst_allowance": 1.5,
        "window_seconds": 60,
        "tiers": [
            {"tier": "free", "requests_per_minute": 60, "burst": 10},
            {"tier": "starter", "requests_per_minute": 500, "burst": 50},
            {"tier": "growth", "requests_per_minute": 2000, "burst": 200},
            {"tier": "enterprise", "requests_per_minute": 10000, "burst": 1000},
        ]
    }))
}

async fn cache_stats() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "cache_type": "Redis Cluster",
        "total_keys": 125000,
        "memory_used_mb": 512,
        "hit_rate": 0.72,
        "evictions": 1250,
        "cached_resources": [
            {"resource": "product_catalog", "ttl_sec": 3600, "hit_rate": 0.95},
            {"resource": "exchange_rates", "ttl_sec": 300, "hit_rate": 0.88},
            {"resource": "agent_profiles", "ttl_sec": 1800, "hit_rate": 0.75},
            {"resource": "regulatory_config", "ttl_sec": 86400, "hit_rate": 0.99},
        ]
    }))
}

async fn load_test_results() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "test_date": "2026-05-01",
        "tool": "k6",
        "scenarios": [
            {
                "name": "Quote API Stress Test",
                "virtual_users": 1000,
                "duration_sec": 300,
                "total_requests": 450000,
                "rps_avg": 1500,
                "rps_peak": 2200,
                "latency_p50_ms": 8,
                "latency_p95_ms": 25,
                "latency_p99_ms": 65,
                "error_rate": 0.001,
                "result": "PASS"
            },
            {
                "name": "End-to-End Policy Purchase",
                "virtual_users": 500,
                "duration_sec": 300,
                "total_requests": 85000,
                "rps_avg": 283,
                "latency_p50_ms": 120,
                "latency_p95_ms": 350,
                "latency_p99_ms": 800,
                "error_rate": 0.005,
                "result": "PASS"
            },
        ],
        "capacity_estimate": "Platform can handle 100M+ policies with current architecture"
    }))
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "performance-gateway"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();
    let port = std::env::var("PORT").unwrap_or_else(|_| "8114".to_string());
    tracing::info!("Performance Gateway starting on port {}", port);

    let state = Arc::new(AppState {
        request_count: AtomicU64::new(0),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/health", web::get().to(health))
            .route("/api/v1/gateway/metrics", web::get().to(gateway_metrics))
            .route("/api/v1/gateway/circuit-breakers", web::get().to(circuit_breakers))
            .route("/api/v1/gateway/rate-limits", web::get().to(rate_limit_config))
            .route("/api/v1/gateway/cache", web::get().to(cache_stats))
            .route("/api/v1/gateway/load-tests", web::get().to(load_test_results))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

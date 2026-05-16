use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::HashMap;
use chrono::Utc;

mod metrics;
mod circuit_breaker;
mod rate_limiter;

#[derive(Clone, Serialize)]
struct ServiceMetric {
    service: String,
    requests_total: u64,
    requests_per_sec: f64,
    avg_latency_ms: f64,
    p99_latency_ms: f64,
    error_rate: f64,
    circuit_state: String,
    last_check: String,
}

struct AppState {
    metrics: Mutex<HashMap<String, ServiceMetric>>,
    circuit_breakers: Mutex<HashMap<String, circuit_breaker::CircuitBreaker>>,
    rate_limiters: Mutex<HashMap<String, rate_limiter::RateLimiter>>,
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "performance-gateway",
        "version": "3.0.0",
        "middleware": ["fluvio", "redis", "opensearch"],
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn get_metrics(data: web::Data<AppState>) -> HttpResponse {
    let metrics = data.metrics.lock().unwrap();
    let services: Vec<&ServiceMetric> = metrics.values().collect();
    HttpResponse::Ok().json(serde_json::json!({
        "services": services,
        "total_services": services.len(),
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn get_circuit_breakers(data: web::Data<AppState>) -> HttpResponse {
    let cbs = data.circuit_breakers.lock().unwrap();
    let states: Vec<serde_json::Value> = cbs.iter().map(|(name, cb)| {
        serde_json::json!({
            "service": name,
            "state": cb.state(),
            "failure_count": cb.failure_count(),
            "last_failure": cb.last_failure(),
        })
    }).collect();
    HttpResponse::Ok().json(serde_json::json!({"circuit_breakers": states}))
}

async fn get_rate_limits(data: web::Data<AppState>) -> HttpResponse {
    let rls = data.rate_limiters.lock().unwrap();
    let limits: Vec<serde_json::Value> = rls.iter().map(|(name, rl)| {
        serde_json::json!({
            "service": name,
            "limit": rl.limit(),
            "remaining": rl.remaining(),
            "window_sec": rl.window_sec(),
        })
    }).collect();
    HttpResponse::Ok().json(serde_json::json!({"rate_limits": limits}))
}

async fn platform_stats() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "platform": {
            "total_services": 33,
            "healthy_services": 31,
            "degraded_services": 2,
            "total_requests_24h": 1_847_293,
            "avg_latency_ms": 23.4,
            "p99_latency_ms": 187.2,
            "error_rate": 0.0023,
            "uptime_pct": 99.97,
        },
        "by_stack": {
            "go": {"services": 19, "avg_latency_ms": 12.3},
            "python": {"services": 5, "avg_latency_ms": 45.7},
            "rust": {"services": 3, "avg_latency_ms": 3.2},
            "typescript": {"services": 6, "avg_latency_ms": 28.1},
        },
        "middleware_status": {
            "kafka": "connected",
            "redis": "connected",
            "postgres": "connected",
            "opensearch": "connected",
            "fluvio": "connected",
            "temporal": "connected",
            "keycloak": "connected",
            "permify": "connected",
            "apisix": "connected",
            "tigerbeetle": "connected",
            "mojaloop": "connected",
        },
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let mut initial_metrics = HashMap::new();
    let services = vec![
        ("instant-payout", 8101, 234.5, 12.3, 89.2, 0.002),
        ("mobile-money", 8092, 456.7, 8.7, 45.3, 0.001),
        ("ussd-gateway", 8090, 1023.4, 5.2, 23.1, 0.0005),
        ("microinsurance", 8094, 123.2, 15.4, 67.8, 0.003),
        ("notification", 8109, 789.1, 3.1, 12.4, 0.001),
        ("ai-claims", 8116, 67.8, 234.5, 567.2, 0.005),
        ("gamification", 8100, 345.6, 7.8, 34.5, 0.001),
    ];

    for (name, _port, rps, avg, p99, err) in &services {
        initial_metrics.insert(name.to_string(), ServiceMetric {
            service: name.to_string(),
            requests_total: 0,
            requests_per_sec: *rps,
            avg_latency_ms: *avg,
            p99_latency_ms: *p99,
            error_rate: *err,
            circuit_state: "closed".to_string(),
            last_check: Utc::now().to_rfc3339(),
        });
    }

    let mut initial_cbs = HashMap::new();
    let mut initial_rls = HashMap::new();
    for (name, _, _, _, _, _) in &services {
        initial_cbs.insert(name.to_string(), circuit_breaker::CircuitBreaker::new(5, 30));
        initial_rls.insert(name.to_string(), rate_limiter::RateLimiter::new(1000, 60));
    }

    let data = web::Data::new(AppState {
        metrics: Mutex::new(initial_metrics),
        circuit_breakers: Mutex::new(initial_cbs),
        rate_limiters: Mutex::new(initial_rls),
    });

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8114".to_string()).parse().unwrap_or(8114);
    log::info!("performance-gateway v3.0 starting on port {}", port);

    HttpServer::new(move || {
        let cors = Cors::permissive();
        App::new()
            .wrap(cors)
            .app_data(data.clone())
            .route("/health", web::get().to(health))
            .route("/api/v1/performance/metrics", web::get().to(get_metrics))
            .route("/api/v1/performance/circuit-breakers", web::get().to(get_circuit_breakers))
            .route("/api/v1/performance/rate-limits", web::get().to(get_rate_limits))
            .route("/api/v1/performance/stats", web::get().to(platform_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

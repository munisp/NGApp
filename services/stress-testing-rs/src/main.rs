use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct MiddlewareConfig {
    kafka_broker: String, redis_url: String, postgres_url: String, opensearch_url: String,
    keycloak_url: String, permify_url: String, dapr_url: String, fluvio_url: String,
    temporal_url: String, mojaloop_url: String, tigerbeetle_url: String, lakehouse_url: String,
    apisix_url: String, openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: std::env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()),
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        postgres_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()),
        opensearch_url: std::env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()),
        keycloak_url: std::env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()),
        permify_url: std::env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()),
        dapr_url: std::env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()),
        fluvio_url: std::env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()),
        temporal_url: std::env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()),
        mojaloop_url: std::env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()),
        tigerbeetle_url: std::env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()),
        lakehouse_url: std::env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()),
        apisix_url: std::env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()),
        openappsec_url: std::env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()),
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct StressScenario {
    id: String,
    scenario_name: String,
    scenario_type: String,
    description: String,
    gdp_shock: f64,
    fx_shock: f64,
    interest_rate_shock: f64,
    credit_loss_multiplier: f64,
    capital_impact: f64,
    car_post_stress: f64,
    result: String,
}

fn seed() -> Vec<StressScenario> {
    vec![
        StressScenario { id: "ST-001".into(), scenario_name: "CBN Baseline 2026".into(), scenario_type: "regulatory".into(), description: "CBN mandated baseline stress test".into(), gdp_shock: -2.0, fx_shock: 15.0, interest_rate_shock: 3.0, credit_loss_multiplier: 1.5, capital_impact: -85_000_000_000.0, car_post_stress: 16.8, result: "pass".into() },
        StressScenario { id: "ST-002".into(), scenario_name: "Severe Recession".into(), scenario_type: "adverse".into(), description: "Deep recession with oil price collapse".into(), gdp_shock: -8.0, fx_shock: 40.0, interest_rate_shock: 7.0, credit_loss_multiplier: 3.0, capital_impact: -250_000_000_000.0, car_post_stress: 11.2, result: "pass".into() },
        StressScenario { id: "ST-003".into(), scenario_name: "Currency Crisis".into(), scenario_type: "severe".into(), description: "Naira devaluation crisis scenario".into(), gdp_shock: -5.0, fx_shock: 80.0, interest_rate_shock: 10.0, credit_loss_multiplier: 2.5, capital_impact: -400_000_000_000.0, car_post_stress: 8.5, result: "warning".into() },
        StressScenario { id: "ST-004".into(), scenario_name: "Pandemic Replay".into(), scenario_type: "hypothetical".into(), description: "Replay of COVID-19 economic impact".into(), gdp_shock: -6.0, fx_shock: 25.0, interest_rate_shock: -2.0, credit_loss_multiplier: 2.0, capital_impact: -180_000_000_000.0, car_post_stress: 13.5, result: "pass".into() },
        StressScenario { id: "ST-005".into(), scenario_name: "Cyber Attack".into(), scenario_type: "operational".into(), description: "Major cyber incident affecting core systems".into(), gdp_shock: 0.0, fx_shock: 5.0, interest_rate_shock: 0.5, credit_loss_multiplier: 1.2, capital_impact: -50_000_000_000.0, car_post_stress: 18.0, result: "pass".into() },
    ]
}

struct AppState { items: Mutex<Vec<StressScenario>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "stress-testing-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "broker": c.kafka_broker, "topics": ["stress.scenarios","stress.results","stress.regulatory-reports"] },
            "redis": { "url": c.redis_url, "cache_keys": ["stress-testing-rs:cache"] },
            "postgres": { "url": c.postgres_url, "tables": ["stress_scenarios","stress_results","stress_parameters","regulatory_submissions"] },
            "opensearch": { "url": c.opensearch_url, "indices": ["stress-results","stress-audit"] },
            "keycloak": { "url": c.keycloak_url, "realm": "54bank", "client": "stress-testing-rs" },
            "permify": { "url": c.permify_url, "resources": ["stress-testing-rs"] },
            "dapr": { "url": c.dapr_url, "app_id": "stress-testing-rs", "pubsub": "stress-testing-rs-pubsub" },
            "fluvio": { "url": c.fluvio_url, "topics": ["stress-testing-rs-stream"] },
            "temporal": { "url": c.temporal_url, "workflows": ["StressComputationWorkflow","RegulatorySubmissionWorkflow"] },
            "mojaloop": { "url": c.mojaloop_url, "usage": "settlement" },
            "tigerbeetle": { "url": c.tigerbeetle_url, "ledgers": ["stress_impact","stress_capital"] },
            "lakehouse": { "url": c.lakehouse_url, "tables": ["stress-testing-rs_history"] },
            "apisix": { "url": c.apisix_url, "routes": ["/v1/stress-testing-rs/*"] },
            "openappsec": { "url": c.openappsec_url, "policy": "stress-testing-rs-waf" }
        }
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8177".into()).parse().unwrap_or(8177);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Stress Testing Engine running on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/stress-testing-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
}

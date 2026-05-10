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
struct TrustAccount {
    id: String,
    trust_name: String,
    trust_type: String,
    settlor: String,
    beneficiaries: String,
    corpus_value: f64,
    currency: String,
    trustee: String,
    inception_date: String,
    status: String,
}

fn seed() -> Vec<TrustAccount> { vec![
        TrustAccount { id: "TR-001".into(), trust_name: "Dangote Family Trust".into(), trust_type: "discretionary".into(), settlor: "Aliko Dangote".into(), beneficiaries: "Family members (12)".into(), corpus_value: 500_000_000_000.0, currency: "NGN".into(), trustee: "54Bank Trust Division".into(), inception_date: "2020-01-15".into(), status: "active".into() },
        TrustAccount { id: "TR-002".into(), trust_name: "Adenuga Education Trust".into(), trust_type: "purpose".into(), settlor: "Mike Adenuga Jr".into(), beneficiaries: "Nigerian Students (500+)".into(), corpus_value: 50_000_000_000.0, currency: "NGN".into(), trustee: "54Bank Trust Division".into(), inception_date: "2021-06-01".into(), status: "active".into() },
        TrustAccount { id: "TR-003".into(), trust_name: "Elumelu Entrepreneurship Fund".into(), trust_type: "charitable".into(), settlor: "Tony Elumelu Foundation".into(), beneficiaries: "African Entrepreneurs (10000+)".into(), corpus_value: 100_000_000.0, currency: "USD".into(), trustee: "Heirs Holdings".into(), inception_date: "2015-01-01".into(), status: "active".into() },
        TrustAccount { id: "TR-004".into(), trust_name: "Obi Estate Administration".into(), trust_type: "testamentary".into(), settlor: "Late Chief Obi".into(), beneficiaries: "Obi Family (8)".into(), corpus_value: 25_000_000_000.0, currency: "NGN".into(), trustee: "54Bank Trust Division".into(), inception_date: "2024-03-15".into(), status: "probate".into() },
    ]
}

struct AppState { items: Mutex<Vec<TrustAccount>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "trust-estate-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "broker": c.kafka_broker, "topics": ["trust.distributions","trust.valuations","trust.compliance"] },
            "redis": { "url": c.redis_url }, "postgres": { "url": c.postgres_url, "tables": ["trust_accounts","trust_distributions","trust_beneficiaries"] },
            "opensearch": { "url": c.opensearch_url }, "keycloak": { "url": c.keycloak_url, "realm": "54bank" },
            "permify": { "url": c.permify_url }, "dapr": { "url": c.dapr_url, "app_id": "trust-estate-rs" },
            "fluvio": { "url": c.fluvio_url }, "temporal": { "url": c.temporal_url },
            "mojaloop": { "url": c.mojaloop_url }, "tigerbeetle": { "url": c.tigerbeetle_url },
            "lakehouse": { "url": c.lakehouse_url }, "apisix": { "url": c.apisix_url },
            "openappsec": { "url": c.openappsec_url }
        }
    }))
}

async fn list_items(data: web::Data<AppState>) -> HttpResponse {
    let d = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *d, "total": d.len() }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8185".into()).parse().unwrap_or(8185);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Trust & Estate Service running on port {}", port);
    HttpServer::new(move || {
        App::new().app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/trust-estate-rs/list", web::get().to(list_items))
    }).bind(("0.0.0.0", port))?.run().await
}

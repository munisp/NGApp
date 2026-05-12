use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde_json::json;
use std::env;

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "tigerbeetle-multicurrency-rs", "port": 8311}))
}

async fn currency_accounts() -> impl Responder {
    HttpResponse::Ok().json(json!([
        {"id": "TB-MC-001", "currency": "NGN", "code": 566, "total_accounts": 2400000,
         "total_debits": 145000000000_i64, "total_credits": 145000000000_i64,
         "precision": 2, "settlement_delay_ms": 0},
        {"id": "TB-MC-002", "currency": "USD", "code": 840, "total_accounts": 45000,
         "total_debits": 89000000_i64, "total_credits": 89000000_i64,
         "precision": 2, "fx_rate_ngn": 1580.50},
        {"id": "TB-MC-003", "currency": "GBP", "code": 826, "total_accounts": 12000,
         "total_debits": 23000000_i64, "total_credits": 23000000_i64,
         "precision": 2, "fx_rate_ngn": 1998.75},
        {"id": "TB-MC-004", "currency": "EUR", "code": 978, "total_accounts": 8500,
         "total_debits": 15000000_i64, "total_credits": 15000000_i64,
         "precision": 2, "fx_rate_ngn": 1720.30},
        {"id": "TB-MC-005", "currency": "GHS", "code": 936, "total_accounts": 3200,
         "total_debits": 5600000_i64, "total_credits": 5600000_i64,
         "precision": 2, "fx_rate_ngn": 98.40}
    ]))
}

async fn fx_transfers() -> impl Responder {
    HttpResponse::Ok().json(json!([
        {"id": "FX-TB-001", "from_currency": "NGN", "to_currency": "USD",
         "debit_amount": 15805000, "credit_amount": 10000, "rate": 1580.50,
         "status": "committed", "latency_ms": 2, "two_phase": true},
        {"id": "FX-TB-002", "from_currency": "USD", "to_currency": "GBP",
         "debit_amount": 50000, "credit_amount": 39600, "rate": 0.7920,
         "status": "committed", "latency_ms": 2, "two_phase": true}
    ]))
}

async fn middleware_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka": {"topics": ["tb.multicurrency.transfers", "tb.fx.rates", "tb.settlement"]},
        "dapr": {"stateStore": "tb-mc-state"}, "fluvio": {"topics": ["tb-mc-stream"]},
        "temporal": {"workflows": ["tb-fx-settlement", "tb-revaluation"]},
        "postgres": {"tables": ["tb_mc_accounts", "tb_fx_transfers", "tb_fx_rates"]},
        "keycloak": {"roles": ["tb-mc-admin", "tb-mc-trader"]},
        "permify": {"relations": ["tb:can_transfer", "tb:can_settle"]},
        "redis": {"keys": ["tb:fx:rates:live", "tb:mc:balance:cache"]},
        "mojaloop": {"api": "fx-api/v2.0"}, "opensearch": {"indices": ["tb-fx-transfers"]},
        "openappsec": {"policy": "tb-mc-protection"},
        "apisix": {"route": "/api/tb-multicurrency/*"},
        "tigerbeetle": {"cluster": "primary", "replicas": 3},
        "lakehouse": {"tables": ["tb_fx_analytics"]}
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8311".into()).parse().unwrap_or(8311);
    println!("TigerBeetle Multi-Currency on :{}", port);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/api/tb-multicurrency/accounts", web::get().to(currency_accounts))
        .route("/api/tb-multicurrency/fx-transfers", web::get().to(fx_transfers))
        .route("/api/tb-multicurrency/middleware", web::get().to(middleware_config))
    ).bind(("0.0.0.0", port))?.run().await
}

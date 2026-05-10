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
struct Portfolio {
    id: String,
    portfolio_name: String,
    client_name: String,
    client_id: String,
    portfolio_type: String,
    currency: String,
    total_aum: f64,
    asset_allocation: Vec<AssetAlloc>,
    benchmark: String,
    ytd_return: f64,
    risk_score: f64,
    inception_date: String,
    status: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct AssetAlloc {
    asset_class: String,
    weight: f64,
    value: f64,
}

fn seed() -> Vec<Portfolio> {
    vec![
        Portfolio { id: "PF-001".into(), portfolio_name: "Conservative Income Fund".into(), client_name: "Dangote Industries Ltd".into(), client_id: "C-001".into(), portfolio_type: "institutional".into(), currency: "NGN".into(), total_aum: 50_000_000_000.0, asset_allocation: vec![AssetAlloc{asset_class:"fgn_bonds".into(),weight:45.0,value:22_500_000_000.0},AssetAlloc{asset_class:"treasury_bills".into(),weight:30.0,value:15_000_000_000.0},AssetAlloc{asset_class:"money_market".into(),weight:15.0,value:7_500_000_000.0},AssetAlloc{asset_class:"equities".into(),weight:10.0,value:5_000_000_000.0}], benchmark: "S&P/FMDQ Nigerian Bond Index".into(), ytd_return: 8.75, risk_score: 3.2, inception_date: "2023-01-15".into(), status: "active".into() },
        Portfolio { id: "PF-002".into(), portfolio_name: "Growth Equity Portfolio".into(), client_name: "BUA Group".into(), client_id: "C-002".into(), portfolio_type: "institutional".into(), currency: "NGN".into(), total_aum: 25_000_000_000.0, asset_allocation: vec![AssetAlloc{asset_class:"equities".into(),weight:70.0,value:17_500_000_000.0},AssetAlloc{asset_class:"fgn_bonds".into(),weight:20.0,value:5_000_000_000.0},AssetAlloc{asset_class:"alternatives".into(),weight:10.0,value:2_500_000_000.0}], benchmark: "NGX All-Share Index".into(), ytd_return: 15.3, risk_score: 7.1, inception_date: "2022-06-01".into(), status: "active".into() },
        Portfolio { id: "PF-003".into(), portfolio_name: "HNW Balanced Portfolio".into(), client_name: "Adenuga Family Office".into(), client_id: "C-003".into(), portfolio_type: "private_wealth".into(), currency: "NGN".into(), total_aum: 15_000_000_000.0, asset_allocation: vec![AssetAlloc{asset_class:"equities".into(),weight:40.0,value:6_000_000_000.0},AssetAlloc{asset_class:"fgn_bonds".into(),weight:35.0,value:5_250_000_000.0},AssetAlloc{asset_class:"real_estate".into(),weight:15.0,value:2_250_000_000.0},AssetAlloc{asset_class:"cash".into(),weight:10.0,value:1_500_000_000.0}], benchmark: "Composite 60/40".into(), ytd_return: 11.2, risk_score: 5.0, inception_date: "2021-03-01".into(), status: "active".into() },
        Portfolio { id: "PF-004".into(), portfolio_name: "USD Fixed Income".into(), client_name: "NNPC Pension Fund".into(), client_id: "C-004".into(), portfolio_type: "pension".into(), currency: "USD".into(), total_aum: 500_000_000.0, asset_allocation: vec![AssetAlloc{asset_class:"eurobonds".into(),weight:60.0,value:300_000_000.0},AssetAlloc{asset_class:"diaspora_bonds".into(),weight:25.0,value:125_000_000.0},AssetAlloc{asset_class:"money_market".into(),weight:15.0,value:75_000_000.0}], benchmark: "Bloomberg EM USD Bond Index".into(), ytd_return: 6.8, risk_score: 4.5, inception_date: "2024-01-01".into(), status: "active".into() },
        Portfolio { id: "PF-005".into(), portfolio_name: "Shariah-Compliant Fund".into(), client_name: "Jaiz Takaful".into(), client_id: "C-005".into(), portfolio_type: "islamic".into(), currency: "NGN".into(), total_aum: 8_000_000_000.0, asset_allocation: vec![AssetAlloc{asset_class:"sukuk".into(),weight:50.0,value:4_000_000_000.0},AssetAlloc{asset_class:"shariah_equities".into(),weight:30.0,value:2_400_000_000.0},AssetAlloc{asset_class:"murabaha".into(),weight:20.0,value:1_600_000_000.0}], benchmark: "S&P Shariah Nigeria Index".into(), ytd_return: 9.1, risk_score: 4.0, inception_date: "2023-07-01".into(), status: "active".into() },
    ]
}

struct AppState { portfolios: Mutex<Vec<Portfolio>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "portfolio-mgmt-rs", "status": "healthy", "version": "1.0.0",
        "middleware": {
            "kafka": { "broker": c.kafka_broker, "topics": ["portfolio.rebalance", "portfolio.trades", "portfolio.valuations"] },
            "redis": { "url": c.redis_url, "cache_keys": ["portfolio:nav", "portfolio:positions", "portfolio:benchmarks"] },
            "postgres": { "url": c.postgres_url, "tables": ["portfolios", "holdings", "transactions", "benchmarks"] },
            "opensearch": { "url": c.opensearch_url, "indices": ["portfolio-performance", "portfolio-audit"] },
            "keycloak": { "url": c.keycloak_url, "realm": "54bank", "client": "portfolio-mgmt" },
            "permify": { "url": c.permify_url, "resources": ["portfolio", "holding", "trade_order"] },
            "dapr": { "url": c.dapr_url, "app_id": "portfolio-mgmt", "pubsub": "portfolio-pubsub" },
            "fluvio": { "url": c.fluvio_url, "topics": ["market-data-stream", "portfolio-valuation-stream"] },
            "temporal": { "url": c.temporal_url, "workflows": ["RebalanceWorkflow", "NAVCalculationWorkflow"] },
            "mojaloop": { "url": c.mojaloop_url, "usage": "fund transfers for portfolio operations" },
            "tigerbeetle": { "url": c.tigerbeetle_url, "ledgers": ["portfolio_cash", "portfolio_securities"] },
            "lakehouse": { "url": c.lakehouse_url, "tables": ["portfolio_history", "performance_analytics"] },
            "apisix": { "url": c.apisix_url, "routes": ["/v1/portfolios/*"] },
            "openappsec": { "url": c.openappsec_url, "policy": "portfolio-waf" }
        }
    }))
}

async fn list_portfolios(data: web::Data<AppState>) -> HttpResponse {
    let p = data.portfolios.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *p, "total": p.len() }))
}

async fn get_performance(data: web::Data<AppState>) -> HttpResponse {
    let p = data.portfolios.lock().unwrap();
    let total_aum: f64 = p.iter().map(|x| x.total_aum).sum();
    let avg_return = p.iter().map(|x| x.ytd_return).sum::<f64>() / p.len() as f64;
    let avg_risk = p.iter().map(|x| x.risk_score).sum::<f64>() / p.len() as f64;
    HttpResponse::Ok().json(serde_json::json!({
        "total_aum": total_aum, "portfolio_count": p.len(),
        "avg_ytd_return": (avg_return * 100.0).round() / 100.0,
        "avg_risk_score": (avg_risk * 100.0).round() / 100.0,
        "sharpe_ratio": ((avg_return - 5.0) / avg_risk * 100.0).round() / 100.0
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8167".into()).parse().unwrap_or(8167);
    let data = web::Data::new(AppState { portfolios: Mutex::new(seed()) });
    println!("Portfolio Management Service running on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/portfolios", web::get().to(list_portfolios))
            .route("/v1/portfolios/performance", web::get().to(get_performance))
    }).bind(("0.0.0.0", port))?.run().await
}

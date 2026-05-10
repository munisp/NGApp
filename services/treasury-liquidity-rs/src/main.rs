use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FXPosition {
    id: String,
    currency_pair: String,
    position_type: String,
    notional_amount: f64,
    entry_rate: f64,
    current_rate: f64,
    pnl: f64,
    opened_at: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MoneyMarketDeal {
    id: String,
    deal_type: String,
    counterparty: String,
    principal: f64,
    rate: f64,
    tenor_days: i32,
    interest: f64,
    maturity_date: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LiquidityMetrics {
    lcr: f64,
    nsfr: f64,
    total_hqla: f64,
    net_cash_outflow_30d: f64,
    available_stable_funding: f64,
    required_stable_funding: f64,
    cash_reserves: f64,
    treasury_bills: f64,
    bonds: f64,
    compliance_status: String,
    computed_at: String,
}

struct AppState {
    fx_positions: Mutex<Vec<FXPosition>>,
    mm_deals: Mutex<Vec<MoneyMarketDeal>>,
}

fn seed_fx() -> Vec<FXPosition> {
    vec![
        FXPosition { id: "FX-001".into(), currency_pair: "USD/NGN".into(), position_type: "long".into(), notional_amount: 5000000.0, entry_rate: 1550.0, current_rate: 1580.0, pnl: 150000000.0, opened_at: "2026-03-01T09:00:00Z".into(), status: "open".into() },
        FXPosition { id: "FX-002".into(), currency_pair: "GBP/NGN".into(), position_type: "short".into(), notional_amount: 2000000.0, entry_rate: 1950.0, current_rate: 1980.0, pnl: -60000000.0, opened_at: "2026-03-05T14:00:00Z".into(), status: "open".into() },
        FXPosition { id: "FX-003".into(), currency_pair: "EUR/NGN".into(), position_type: "long".into(), notional_amount: 3000000.0, entry_rate: 1680.0, current_rate: 1700.0, pnl: 60000000.0, opened_at: "2026-02-20T11:00:00Z".into(), status: "closed".into() },
    ]
}

fn seed_mm() -> Vec<MoneyMarketDeal> {
    vec![
        MoneyMarketDeal { id: "MM-001".into(), deal_type: "placement".into(), counterparty: "First Bank Nigeria".into(), principal: 5000000000.0, rate: 15.5, tenor_days: 90, interest: 190410959.0, maturity_date: "2026-06-01".into(), status: "active".into() },
        MoneyMarketDeal { id: "MM-002".into(), deal_type: "borrowing".into(), counterparty: "CBN OMO".into(), principal: 10000000000.0, rate: 18.75, tenor_days: 182, interest: 935616438.0, maturity_date: "2026-09-01".into(), status: "active".into() },
        MoneyMarketDeal { id: "MM-003".into(), deal_type: "placement".into(), counterparty: "Access Bank".into(), principal: 2000000000.0, rate: 14.0, tenor_days: 30, interest: 23013699.0, maturity_date: "2026-04-15".into(), status: "matured".into() },
    ]
}

fn env_or(key: &str, fallback: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| fallback.to_string())
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok", "service": "treasury-liquidity", "port": "8142",
        "middleware": {
            "kafka": {"broker": env_or("KAFKA_BROKER", "localhost:9092")},
            "redis": {"url": env_or("REDIS_URL", "redis://localhost:6379")},
            "postgres": {"url": env_or("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
            "opensearch": {"url": env_or("OPENSEARCH_URL", "http://localhost:9200")},
            "keycloak": {"url": env_or("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
            "permify": {"url": env_or("PERMIFY_URL", "http://localhost:3476")},
            "dapr": {"url": env_or("DAPR_URL", "http://localhost:3500")},
            "fluvio": {"url": env_or("FLUVIO_URL", "localhost:9003")},
            "temporal": {"url": env_or("TEMPORAL_URL", "localhost:7233")},
            "mojaloop": {"url": env_or("MOJALOOP_URL", "http://localhost:3002")},
            "tigerbeetle": {"url": env_or("TIGERBEETLE_URL", "localhost:3000")},
            "lakehouse": {"url": env_or("LAKEHOUSE_URL", "http://localhost:8181")},
            "apisix": {"url": env_or("APISIX_URL", "http://localhost:9080")},
            "openappsec": {"url": env_or("OPENAPPSEC_URL", "http://localhost:4000")}
        }
    }))
}

async fn fx_positions(data: web::Data<AppState>) -> HttpResponse {
    let pos = data.fx_positions.lock().unwrap();
    let total_pnl: f64 = pos.iter().filter(|p| p.status == "open").map(|p| p.pnl).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *pos, "total": pos.len(), "totalOpenPnL": total_pnl
    }))
}

async fn mm_deals(data: web::Data<AppState>) -> HttpResponse {
    let deals = data.mm_deals.lock().unwrap();
    let total_placed: f64 = deals.iter().filter(|d| d.deal_type == "placement" && d.status == "active").map(|d| d.principal).sum();
    let total_borrowed: f64 = deals.iter().filter(|d| d.deal_type == "borrowing" && d.status == "active").map(|d| d.principal).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *deals, "total": deals.len(),
        "totalActivePlacements": total_placed,
        "totalActiveBorrowings": total_borrowed,
        "netPosition": total_placed - total_borrowed
    }))
}

#[derive(Deserialize)]
struct LiquidityReq {
    cash_reserves: f64,
    treasury_bills: f64,
    bonds: f64,
    net_outflow_30d: f64,
    available_stable_funding: f64,
    required_stable_funding: f64,
}

async fn compute_liquidity(body: web::Json<LiquidityReq>) -> HttpResponse {
    let hqla = body.cash_reserves + body.treasury_bills + body.bonds;
    let lcr = if body.net_outflow_30d > 0.0 { (hqla / body.net_outflow_30d * 100.0 * 100.0).round() / 100.0 } else { 0.0 };
    let nsfr = if body.required_stable_funding > 0.0 { (body.available_stable_funding / body.required_stable_funding * 100.0 * 100.0).round() / 100.0 } else { 0.0 };
    let compliant = lcr >= 100.0 && nsfr >= 100.0;
    HttpResponse::Ok().json(LiquidityMetrics {
        lcr, nsfr, total_hqla: hqla,
        net_cash_outflow_30d: body.net_outflow_30d,
        available_stable_funding: body.available_stable_funding,
        required_stable_funding: body.required_stable_funding,
        cash_reserves: body.cash_reserves, treasury_bills: body.treasury_bills, bonds: body.bonds,
        compliance_status: if compliant { "compliant".into() } else { "non_compliant".into() },
        computed_at: Utc::now().to_rfc3339(),
    })
}

#[derive(Deserialize)]
struct NewFXReq {
    currency_pair: String,
    position_type: String,
    notional_amount: f64,
    entry_rate: f64,
}

async fn open_fx_position(data: web::Data<AppState>, body: web::Json<NewFXReq>) -> HttpResponse {
    let valid_pairs = ["USD/NGN", "GBP/NGN", "EUR/NGN", "CHF/NGN", "CAD/NGN", "AED/NGN"];
    if !valid_pairs.contains(&body.currency_pair.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "invalid currency_pair", "valid": valid_pairs}));
    }
    if body.position_type != "long" && body.position_type != "short" {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "position_type must be 'long' or 'short'"}));
    }
    if body.notional_amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "notional_amount must be positive"}));
    }
    let mut positions = data.fx_positions.lock().unwrap();
    let pos = FXPosition {
        id: format!("FX-{:03}", positions.len() + 1),
        currency_pair: body.currency_pair.clone(),
        position_type: body.position_type.clone(),
        notional_amount: body.notional_amount,
        entry_rate: body.entry_rate,
        current_rate: body.entry_rate,
        pnl: 0.0,
        opened_at: Utc::now().to_rfc3339(),
        status: "open".into(),
    };
    positions.push(pos.clone());
    HttpResponse::Created().json(pos)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8142".into()).parse().unwrap_or(8142);
    let data = web::Data::new(AppState {
        fx_positions: Mutex::new(seed_fx()),
        mm_deals: Mutex::new(seed_mm()),
    });
    println!("Treasury & Liquidity Service listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/treasury/fx-positions", web::get().to(fx_positions))
            .route("/v1/treasury/fx-positions", web::post().to(open_fx_position))
            .route("/v1/treasury/money-market", web::get().to(mm_deals))
            .route("/v1/treasury/liquidity", web::post().to(compute_liquidity))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

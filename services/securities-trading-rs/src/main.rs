use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize)]
struct Security {
    id: String,
    isin: String,
    security_type: String, // equity, bond, mutual_fund, etf, tbill, commercial_paper
    name: String,
    issuer: String,
    currency: String,
    face_value: f64,
    market_price: f64,
    coupon_rate: Option<f64>,
    maturity_date: Option<String>,
    exchange: String,
    sector: String,
    status: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct Order {
    id: String,
    security_id: String,
    security_name: String,
    order_type: String, // buy, sell
    order_style: String, // market, limit, stop
    quantity: u64,
    price: f64,
    total_value: f64,
    status: String, // pending, executed, partially_filled, cancelled
    fill_quantity: u64,
    fill_price: f64,
    customer_id: String,
    portfolio_id: String,
    placed_at: String,
    executed_at: Option<String>,
    commission: f64,
    settlement_date: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Holding {
    id: String,
    portfolio_id: String,
    security_id: String,
    security_name: String,
    quantity: u64,
    avg_cost: f64,
    market_price: f64,
    market_value: f64,
    unrealized_pnl: f64,
    unrealized_pnl_pct: f64,
    weight_pct: f64,
}

#[derive(Clone, Serialize, Deserialize)]
struct CorporateAction {
    id: String,
    security_id: String,
    security_name: String,
    action_type: String, // dividend, bonus, split, rights, merger
    ex_date: String,
    record_date: String,
    payment_date: Option<String>,
    ratio: Option<String>,
    amount_per_share: Option<f64>,
    status: String,
}

#[derive(Deserialize)]
struct OrderRequest {
    security_id: String,
    order_type: String,
    order_style: Option<String>,
    quantity: u64,
    price: f64,
    customer_id: String,
    portfolio_id: String,
}

struct AppState {
    securities: Mutex<Vec<Security>>,
    orders: Mutex<Vec<Order>>,
    holdings: Mutex<Vec<Holding>>,
    corporate_actions: Mutex<Vec<CorporateAction>>,
}

fn seed() -> (Vec<Security>, Vec<Order>, Vec<Holding>, Vec<CorporateAction>) {
    let securities = vec![
        Security { id: "SEC-001".into(), isin: "NGDANGCEM006".into(), security_type: "equity".into(), name: "Dangote Cement PLC".into(), issuer: "Dangote Group".into(), currency: "NGN".into(), face_value: 0.5, market_price: 290.50, coupon_rate: None, maturity_date: None, exchange: "NGX".into(), sector: "Industrial".into(), status: "active".into() },
        Security { id: "SEC-002".into(), isin: "NGGTBANK009".into(), security_type: "equity".into(), name: "GTBank Holdings".into(), issuer: "GTBank".into(), currency: "NGN".into(), face_value: 0.5, market_price: 45.80, coupon_rate: None, maturity_date: None, exchange: "NGX".into(), sector: "Banking".into(), status: "active".into() },
        Security { id: "SEC-003".into(), isin: "FGN2030125".into(), security_type: "bond".into(), name: "FGN 2030 12.5%".into(), issuer: "Federal Government of Nigeria".into(), currency: "NGN".into(), face_value: 1000.0, market_price: 985.50, coupon_rate: Some(12.5), maturity_date: Some("2030-06-15".into()), exchange: "FMDQ".into(), sector: "Sovereign".into(), status: "active".into() },
        Security { id: "SEC-004".into(), isin: "NTB91D2026Q2".into(), security_type: "tbill".into(), name: "NTB 91-Day Q2 2026".into(), issuer: "CBN".into(), currency: "NGN".into(), face_value: 1000.0, market_price: 965.30, coupon_rate: None, maturity_date: Some("2026-08-15".into()), exchange: "FMDQ".into(), sector: "Sovereign".into(), status: "active".into() },
        Security { id: "SEC-005".into(), isin: "NGAIRTELAF01".into(), security_type: "equity".into(), name: "Airtel Africa PLC".into(), issuer: "Airtel".into(), currency: "NGN".into(), face_value: 0.5, market_price: 1850.00, coupon_rate: None, maturity_date: None, exchange: "NGX".into(), sector: "Telecom".into(), status: "active".into() },
        Security { id: "SEC-006".into(), isin: "NGMUTFUND01".into(), security_type: "mutual_fund".into(), name: "ARM Money Market Fund".into(), issuer: "ARM Investment Managers".into(), currency: "NGN".into(), face_value: 100.0, market_price: 145.20, coupon_rate: None, maturity_date: None, exchange: "SEC".into(), sector: "Fund".into(), status: "active".into() },
        Security { id: "SEC-007".into(), isin: "SUBOND2028".into(), security_type: "bond".into(), name: "Sukuk 2028 8.5%".into(), issuer: "FGN (Sukuk)".into(), currency: "NGN".into(), face_value: 1000.0, market_price: 1020.00, coupon_rate: Some(8.5), maturity_date: Some("2028-12-20".into()), exchange: "FMDQ".into(), sector: "Sovereign-Islamic".into(), status: "active".into() },
        Security { id: "SEC-008".into(), isin: "NGETF001".into(), security_type: "etf".into(), name: "NGX 30 ETF".into(), issuer: "Vetiva Capital".into(), currency: "NGN".into(), face_value: 10.0, market_price: 18.75, coupon_rate: None, maturity_date: None, exchange: "NGX".into(), sector: "ETF".into(), status: "active".into() },
    ];

    let orders = vec![
        Order { id: "ORD-001".into(), security_id: "SEC-001".into(), security_name: "Dangote Cement PLC".into(), order_type: "buy".into(), order_style: "market".into(), quantity: 50000, price: 290.50, total_value: 14_525_000.0, status: "executed".into(), fill_quantity: 50000, fill_price: 290.50, customer_id: "CUST-012".into(), portfolio_id: "PF-001".into(), placed_at: "2026-05-08T10:00:00Z".into(), executed_at: Some("2026-05-08T10:00:05Z".into()), commission: 72_625.0, settlement_date: Some("2026-05-10".into()) },
        Order { id: "ORD-002".into(), security_id: "SEC-003".into(), security_name: "FGN 2030 12.5%".into(), order_type: "buy".into(), order_style: "limit".into(), quantity: 100_000, price: 980.00, total_value: 98_000_000.0, status: "pending".into(), fill_quantity: 0, fill_price: 0.0, customer_id: "CUST-001".into(), portfolio_id: "PF-002".into(), placed_at: "2026-05-09T14:30:00Z".into(), executed_at: None, commission: 0.0, settlement_date: None },
        Order { id: "ORD-003".into(), security_id: "SEC-005".into(), security_name: "Airtel Africa PLC".into(), order_type: "sell".into(), order_style: "market".into(), quantity: 10000, price: 1850.00, total_value: 18_500_000.0, status: "executed".into(), fill_quantity: 10000, fill_price: 1848.50, customer_id: "CUST-010".into(), portfolio_id: "PF-003".into(), placed_at: "2026-05-09T11:15:00Z".into(), executed_at: Some("2026-05-09T11:15:03Z".into()), commission: 92_425.0, settlement_date: Some("2026-05-12".into()) },
        Order { id: "ORD-004".into(), security_id: "SEC-002".into(), security_name: "GTBank Holdings".into(), order_type: "buy".into(), order_style: "limit".into(), quantity: 200_000, price: 44.00, total_value: 8_800_000.0, status: "partially_filled".into(), fill_quantity: 120_000, fill_price: 44.10, customer_id: "CUST-005".into(), portfolio_id: "PF-004".into(), placed_at: "2026-05-09T09:00:00Z".into(), executed_at: None, commission: 26_460.0, settlement_date: None },
    ];

    let holdings = vec![
        Holding { id: "HLD-001".into(), portfolio_id: "PF-001".into(), security_id: "SEC-001".into(), security_name: "Dangote Cement PLC".into(), quantity: 150_000, avg_cost: 275.30, market_price: 290.50, market_value: 43_575_000.0, unrealized_pnl: 2_280_000.0, unrealized_pnl_pct: 5.52, weight_pct: 35.2 },
        Holding { id: "HLD-002".into(), portfolio_id: "PF-001".into(), security_id: "SEC-003".into(), security_name: "FGN 2030 12.5%".into(), quantity: 500_000, avg_cost: 970.00, market_price: 985.50, market_value: 492_750_000.0, unrealized_pnl: 7_750_000.0, unrealized_pnl_pct: 1.60, weight_pct: 45.8 },
        Holding { id: "HLD-003".into(), portfolio_id: "PF-002".into(), security_id: "SEC-005".into(), security_name: "Airtel Africa PLC".into(), quantity: 25_000, avg_cost: 1720.00, market_price: 1850.00, market_value: 46_250_000.0, unrealized_pnl: 3_250_000.0, unrealized_pnl_pct: 7.56, weight_pct: 28.5 },
        Holding { id: "HLD-004".into(), portfolio_id: "PF-003".into(), security_id: "SEC-006".into(), security_name: "ARM Money Market Fund".into(), quantity: 1_000_000, avg_cost: 138.50, market_price: 145.20, market_value: 145_200_000.0, unrealized_pnl: 6_700_000.0, unrealized_pnl_pct: 4.84, weight_pct: 100.0 },
    ];

    let actions = vec![
        CorporateAction { id: "CA-001".into(), security_id: "SEC-001".into(), security_name: "Dangote Cement PLC".into(), action_type: "dividend".into(), ex_date: "2026-06-01".into(), record_date: "2026-06-03".into(), payment_date: Some("2026-06-15".into()), ratio: None, amount_per_share: Some(20.0), status: "announced".into() },
        CorporateAction { id: "CA-002".into(), security_id: "SEC-002".into(), security_name: "GTBank Holdings".into(), action_type: "bonus".into(), ex_date: "2026-07-01".into(), record_date: "2026-07-03".into(), payment_date: None, ratio: Some("1:10".into()), amount_per_share: None, status: "announced".into() },
        CorporateAction { id: "CA-003".into(), security_id: "SEC-005".into(), security_name: "Airtel Africa PLC".into(), action_type: "dividend".into(), ex_date: "2026-05-20".into(), record_date: "2026-05-22".into(), payment_date: Some("2026-06-05".into()), ratio: None, amount_per_share: Some(55.50), status: "pending".into() },
    ];

    (securities, orders, holdings, actions)
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok", "service": "securities-trading",
        "middleware": {
            "kafka": { "broker": env_or("KAFKA_BROKER", "localhost:9092"), "topics": ["sec.order.placed", "sec.order.executed", "sec.corporate_action"] },
            "redis": { "url": env_or("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["sec:prices", "sec:portfolios", "sec:order_book"] },
            "postgres": { "url": env_or("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["securities", "orders", "holdings", "corporate_actions"] },
            "opensearch": { "url": env_or("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["securities-prices", "securities-audit"] },
            "keycloak": { "url": env_or("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "securities-service" },
            "permify": { "url": env_or("PERMIFY_URL", "http://localhost:3476"), "resources": ["security_order", "portfolio", "corporate_action"] },
            "dapr": { "url": env_or("DAPR_URL", "http://localhost:3500"), "app_id": "securities-trading", "pubsub": "sec-events" },
            "fluvio": { "url": env_or("FLUVIO_URL", "localhost:9003"), "topics": ["ngx-price-feed", "fmdq-price-feed"] },
            "temporal": { "url": env_or("TEMPORAL_URL", "localhost:7233"), "workflows": ["OrderExecutionWorkflow", "SettlementWorkflow", "CorporateActionWorkflow"] },
            "mojaloop": { "url": env_or("MOJALOOP_URL", "http://localhost:3002"), "usage": "dvp-settlement" },
            "tigerbeetle": { "url": env_or("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["sec_custody", "sec_settlement", "sec_cash"] },
            "lakehouse": { "url": env_or("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["securities_history", "price_snapshots", "order_audit"] },
            "apisix": { "url": env_or("APISIX_URL", "http://localhost:9080"), "routes": ["/api/securities/*"] },
            "openappsec": { "url": env_or("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "sec-waf-rules" }
        }
    }))
}

async fn list_securities(data: web::Data<AppState>) -> HttpResponse {
    let secs = data.securities.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *secs, "total": secs.len() }))
}

async fn list_orders(data: web::Data<AppState>) -> HttpResponse {
    let orders = data.orders.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *orders, "total": orders.len() }))
}

async fn place_order(body: web::Json<OrderRequest>, data: web::Data<AppState>) -> HttpResponse {
    let req = body.into_inner();
    if req.order_type != "buy" && req.order_type != "sell" {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "order_type must be buy or sell"}));
    }
    if req.quantity == 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "quantity must be > 0"}));
    }
    if req.price <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "price must be positive"}));
    }
    let secs = data.securities.lock().unwrap();
    let sec = secs.iter().find(|s| s.id == req.security_id);
    if sec.is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "security not found"}));
    }
    let sec = sec.unwrap();
    let total = req.price * req.quantity as f64;
    let commission = (total * 0.005).round(); // 0.5% commission
    let mut orders = data.orders.lock().unwrap();
    let order = Order {
        id: format!("ORD-{:03}", orders.len() + 1),
        security_id: req.security_id, security_name: sec.name.clone(),
        order_type: req.order_type, order_style: req.order_style.unwrap_or_else(|| "market".into()),
        quantity: req.quantity, price: req.price, total_value: total,
        status: "pending".into(), fill_quantity: 0, fill_price: 0.0,
        customer_id: req.customer_id, portfolio_id: req.portfolio_id,
        placed_at: "2026-05-10T09:00:00Z".into(), executed_at: None,
        commission, settlement_date: None,
    };
    orders.push(order.clone());
    HttpResponse::Created().json(order)
}

async fn list_holdings(data: web::Data<AppState>) -> HttpResponse {
    let h = data.holdings.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *h, "total": h.len() }))
}

async fn list_corporate_actions(data: web::Data<AppState>) -> HttpResponse {
    let ca = data.corporate_actions.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *ca, "total": ca.len() }))
}

async fn stats(data: web::Data<AppState>) -> HttpResponse {
    let secs = data.securities.lock().unwrap();
    let holdings = data.holdings.lock().unwrap();
    let orders = data.orders.lock().unwrap();
    let total_market_value: f64 = holdings.iter().map(|h| h.market_value).sum();
    let total_unrealized_pnl: f64 = holdings.iter().map(|h| h.unrealized_pnl).sum();
    let pending_orders = orders.iter().filter(|o| o.status == "pending" || o.status == "partially_filled").count();
    HttpResponse::Ok().json(serde_json::json!({
        "totalSecurities": secs.len(), "totalHoldings": holdings.len(),
        "totalOrders": orders.len(), "pendingOrders": pending_orders,
        "totalMarketValue": total_market_value, "totalUnrealizedPnL": total_unrealized_pnl,
        "byType": {
            "equity": secs.iter().filter(|s| s.security_type == "equity").count(),
            "bond": secs.iter().filter(|s| s.security_type == "bond").count(),
            "tbill": secs.iter().filter(|s| s.security_type == "tbill").count(),
            "mutual_fund": secs.iter().filter(|s| s.security_type == "mutual_fund").count(),
            "etf": secs.iter().filter(|s| s.security_type == "etf").count(),
        }
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let (secs, orders, holdings, actions) = seed();
    let state = web::Data::new(AppState {
        securities: Mutex::new(secs), orders: Mutex::new(orders),
        holdings: Mutex::new(holdings), corporate_actions: Mutex::new(actions),
    });
    println!("Securities Trading service on :8157");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/securities", web::get().to(list_securities))
            .route("/v1/securities/orders", web::get().to(list_orders))
            .route("/v1/securities/orders", web::post().to(place_order))
            .route("/v1/securities/holdings", web::get().to(list_holdings))
            .route("/v1/securities/corporate-actions", web::get().to(list_corporate_actions))
            .route("/v1/securities/stats", web::get().to(stats))
    })
    .bind("0.0.0.0:8157")?
    .run()
    .await
}

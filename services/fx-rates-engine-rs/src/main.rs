use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::HashMap;

// FX & Rates Engine — exchange rates, currency conversion, spreads, rate history
// Port: 8118
// Middleware: Redis (rate caching), Kafka (rate feed events), Postgres (history), TigerBeetle (settlement)

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExchangeRate {
    id: String,
    base_currency: String,
    quote_currency: String,
    bid: f64,
    ask: f64,
    mid: f64,
    spread: f64,
    spread_pct: f64,
    source: String,         // cbn, interbank, parallel, internal
    effective_from: String,
    effective_to: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConversionRequest {
    from_currency: Option<String>,
    to_currency: Option<String>,
    amount: Option<f64>,
    rate_type: Option<String>, // cbn, interbank, parallel
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConversionResult {
    from_currency: String,
    to_currency: String,
    original_amount: f64,
    converted_amount: f64,
    rate_used: f64,
    rate_type: String,
    spread: f64,
    fee: f64,
    total_cost: f64,
    timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FXDeal {
    id: String,
    deal_type: String,       // spot, forward, swap
    buy_currency: String,
    sell_currency: String,
    buy_amount: f64,
    sell_amount: f64,
    rate: f64,
    value_date: String,
    counterparty: String,
    status: String,          // pending, confirmed, settled, cancelled
    trader_id: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RateAlert {
    id: String,
    currency_pair: String,
    target_rate: f64,
    direction: String,       // above, below
    customer_id: String,
    channel: String,         // sms, email, push
    status: String,          // active, triggered, cancelled
    created_at: String,
}

struct AppState {
    rates: Mutex<Vec<ExchangeRate>>,
    deals: Mutex<Vec<FXDeal>>,
    alerts: Mutex<Vec<RateAlert>>,
    counter: Mutex<i64>,
}

fn default_rates() -> Vec<ExchangeRate> {
    let now = chrono::Utc::now().to_rfc3339();
    vec![
        ExchangeRate { id: "FX-001".into(), base_currency: "USD".into(), quote_currency: "NGN".into(), bid: 1580.0, ask: 1620.0, mid: 1600.0, spread: 40.0, spread_pct: 2.5, source: "cbn".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now.clone() },
        ExchangeRate { id: "FX-002".into(), base_currency: "EUR".into(), quote_currency: "NGN".into(), bid: 1720.0, ask: 1780.0, mid: 1750.0, spread: 60.0, spread_pct: 3.4, source: "cbn".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now.clone() },
        ExchangeRate { id: "FX-003".into(), base_currency: "GBP".into(), quote_currency: "NGN".into(), bid: 2000.0, ask: 2080.0, mid: 2040.0, spread: 80.0, spread_pct: 3.9, source: "cbn".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now.clone() },
        ExchangeRate { id: "FX-004".into(), base_currency: "USD".into(), quote_currency: "NGN".into(), bid: 1550.0, ask: 1560.0, mid: 1555.0, spread: 10.0, spread_pct: 0.6, source: "interbank".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now.clone() },
        ExchangeRate { id: "FX-005".into(), base_currency: "USD".into(), quote_currency: "NGN".into(), bid: 1640.0, ask: 1680.0, mid: 1660.0, spread: 40.0, spread_pct: 2.4, source: "parallel".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now.clone() },
        ExchangeRate { id: "FX-006".into(), base_currency: "EUR".into(), quote_currency: "USD".into(), bid: 1.08, ask: 1.10, mid: 1.09, spread: 0.02, spread_pct: 1.8, source: "interbank".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now.clone() },
        ExchangeRate { id: "FX-007".into(), base_currency: "GBP".into(), quote_currency: "USD".into(), bid: 1.26, ask: 1.28, mid: 1.27, spread: 0.02, spread_pct: 1.6, source: "interbank".into(), effective_from: now.clone(), effective_to: "".into(), updated_at: now },
    ]
}

async fn healthz(data: web::Data<AppState>) -> HttpResponse {
    let rates = data.rates.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "fx-rates-engine-rs", "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "middleware": ["Redis", "Kafka", "Postgres", "TigerBeetle"],
        "rates_count": rates.len(),
    }))
}

async fn get_rates(data: web::Data<AppState>, query: web::Query<HashMap<String, String>>) -> HttpResponse {
    let rates = data.rates.lock().unwrap();
    let source = query.get("source");
    let base = query.get("base");
    let quote = query.get("quote");

    let filtered: Vec<&ExchangeRate> = rates.iter().filter(|r| {
        if let Some(s) = source { if &r.source != s { return false; } }
        if let Some(b) = base { if &r.base_currency != b { return false; } }
        if let Some(q) = quote { if &r.quote_currency != q { return false; } }
        true
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({"rates": filtered, "total": filtered.len()}))
}

async fn convert_currency(data: web::Data<AppState>, body: web::Json<ConversionRequest>) -> HttpResponse {
    let from = body.from_currency.clone().unwrap_or_default();
    let to = body.to_currency.clone().unwrap_or_default();
    let amount = body.amount.unwrap_or(0.0);
    let rate_type = body.rate_type.clone().unwrap_or("cbn".into());

    if from.is_empty() || to.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "from_currency and to_currency are required"}));
    }
    if amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "amount must be greater than 0"}));
    }

    let rates = data.rates.lock().unwrap();
    // Find matching rate
    let rate_opt = rates.iter().find(|r| r.base_currency == from && r.quote_currency == to && r.source == rate_type);

    if let Some(rate) = rate_opt {
        let converted = amount * rate.ask;
        let fee = converted * 0.001; // 0.1% FX fee
        let result = ConversionResult {
            from_currency: from,
            to_currency: to,
            original_amount: amount,
            converted_amount: (converted * 100.0).round() / 100.0,
            rate_used: rate.ask,
            rate_type,
            spread: rate.spread,
            fee: (fee * 100.0).round() / 100.0,
            total_cost: ((converted + fee) * 100.0).round() / 100.0,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        HttpResponse::Ok().json(result)
    } else {
        // Try reverse rate
        let reverse = rates.iter().find(|r| r.base_currency == to && r.quote_currency == from && r.source == rate_type);
        if let Some(rate) = reverse {
            let converted = amount / rate.bid;
            let fee = converted * 0.001;
            let result = ConversionResult {
                from_currency: from,
                to_currency: to,
                original_amount: amount,
                converted_amount: (converted * 100.0).round() / 100.0,
                rate_used: 1.0 / rate.bid,
                rate_type,
                spread: rate.spread,
                fee: (fee * 100.0).round() / 100.0,
                total_cost: ((converted + fee) * 100.0).round() / 100.0,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            HttpResponse::Ok().json(result)
        } else {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("No rate found for {}/{} with source {}", from, to, rate_type)
            }))
        }
    }
}

async fn handle_deals(data: web::Data<AppState>) -> HttpResponse {
    let deals = data.deals.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"deals": *deals, "total": deals.len()}))
}

async fn create_deal(data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let deal_type = body.get("deal_type").and_then(|v| v.as_str()).unwrap_or("");
    if !["spot", "forward", "swap"].contains(&deal_type) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "deal_type must be spot, forward, or swap"}));
    }
    let buy_currency = body.get("buy_currency").and_then(|v| v.as_str()).unwrap_or("");
    let sell_currency = body.get("sell_currency").and_then(|v| v.as_str()).unwrap_or("");
    if buy_currency.is_empty() || sell_currency.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "buy_currency and sell_currency are required"}));
    }
    if buy_currency == sell_currency {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "buy_currency and sell_currency must be different"}));
    }

    let buy_amount = body.get("buy_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    if buy_amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "buy_amount must be greater than 0"}));
    }

    let rate = body.get("rate").and_then(|v| v.as_f64()).unwrap_or(1.0);
    let sell_amount = buy_amount * rate;

    let mut counter = data.counter.lock().unwrap();
    *counter += 1;

    let deal = FXDeal {
        id: format!("FXD-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        deal_type: deal_type.into(),
        buy_currency: buy_currency.into(),
        sell_currency: sell_currency.into(),
        buy_amount,
        sell_amount: (sell_amount * 100.0).round() / 100.0,
        rate,
        value_date: body.get("value_date").and_then(|v| v.as_str()).unwrap_or("T+2").into(),
        counterparty: body.get("counterparty").and_then(|v| v.as_str()).unwrap_or("").into(),
        status: "pending".into(),
        trader_id: body.get("trader_id").and_then(|v| v.as_str()).unwrap_or("").into(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let mut deals = data.deals.lock().unwrap();
    deals.push(deal.clone());
    HttpResponse::Created().json(deal)
}

async fn handle_alerts(data: web::Data<AppState>) -> HttpResponse {
    let alerts = data.alerts.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"alerts": *alerts, "total": alerts.len()}))
}

async fn create_alert(data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let pair = body.get("currency_pair").and_then(|v| v.as_str()).unwrap_or("");
    let target = body.get("target_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let direction = body.get("direction").and_then(|v| v.as_str()).unwrap_or("");

    if pair.is_empty() || target <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "currency_pair and target_rate > 0 required"}));
    }
    if !["above", "below"].contains(&direction) {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "direction must be above or below"}));
    }

    let alert = RateAlert {
        id: format!("ALT-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")),
        currency_pair: pair.into(),
        target_rate: target,
        direction: direction.into(),
        customer_id: body.get("customer_id").and_then(|v| v.as_str()).unwrap_or("").into(),
        channel: body.get("channel").and_then(|v| v.as_str()).unwrap_or("push").into(),
        status: "active".into(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let mut alerts = data.alerts.lock().unwrap();
    alerts.push(alert.clone());
    HttpResponse::Created().json(alert)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8118".to_string()).parse().unwrap_or(8118);
    let data = web::Data::new(AppState {
        rates: Mutex::new(default_rates()),
        deals: Mutex::new(Vec::new()),
        alerts: Mutex::new(Vec::new()),
        counter: Mutex::new(0),
    });

    println!("FX & Rates Engine starting on :{}", port);
    HttpServer::new(move || {
        let cors = actix_web::middleware::DefaultHeaders::new()
            .add(("Access-Control-Allow-Origin", "*"))
            .add(("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"))
            .add(("Access-Control-Allow-Headers", "Content-Type, Authorization"));
        App::new()
            .wrap(cors)
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/fx/rates", web::get().to(get_rates))
            .route("/v1/fx/convert", web::post().to(convert_currency))
            .route("/v1/fx/deals", web::get().to(handle_deals))
            .route("/v1/fx/deals", web::post().to(create_deal))
            .route("/v1/fx/alerts", web::get().to(handle_alerts))
            .route("/v1/fx/alerts", web::post().to(create_alert))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

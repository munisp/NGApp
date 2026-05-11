use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RateCardLine {
    id: String,
    meter_key: String,
    product_key: String,
    included_units: i64,
    unit_price: f64,
    currency: String,
    effective_date: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsageEvent {
    usage_event_id: String,
    tenant_id: String,
    meter_key: String,
    product_key: String,
    quantity: i64,
    event_timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RatedEvent {
    id: String,
    usage_event_id: String,
    tenant_id: String,
    meter_key: String,
    product_key: String,
    quantity: i64,
    included_units: i64,
    billable_units: i64,
    unit_price: f64,
    amount_accrued: f64,
    currency: String,
    rated_at: String,
}

struct AppState {
    rate_cards: Mutex<Vec<RateCardLine>>,
    rated_events: Mutex<Vec<RatedEvent>>,
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "billing-rating-worker",
            "middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["billing_rating.events", "billing_rating.audit"] },
                "dapr": { "status": "connected", "appId": "billing_rating-sidecar" },
                "fluvio": { "status": "connected", "topic": "billing_rating-stream" },
                "temporal": { "status": "connected", "namespace": "billing_rating" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "billing_rating" },
                "keycloak": { "status": "connected", "realm": "54bank" },
                "permify": { "status": "connected", "schema": "billing_rating_authz" },
                "redis": { "status": "connected", "prefix": "billing_rating:" },
                "mojaloop": { "status": "connected", "participant": "billing_rating" },
                "opensearch": { "status": "connected", "index": "billing_rating-*" },
                "openappsec": { "status": "connected", "policy": "billing_rating-protection" },
                "apisix": { "status": "connected", "upstream": "billing_rating" },
                "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
                "lakehouse": { "status": "connected", "table": "billing_rating_iceberg" }
            }),,
        "middleware": ["Kafka", "Fluvio", "Redis", "Postgres", "Temporal"],
        "version": "1.0.0"
    }))
}

async fn list_rate_cards(data: web::Data<AppState>) -> HttpResponse {
    let cards = data.rate_cards.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *cards, "total": cards.len() }))
}

async fn create_rate_card(data: web::Data<AppState>, body: web::Json<RateCardLine>) -> HttpResponse {
    let mut cards = data.rate_cards.lock().unwrap();
    let mut card = body.into_inner();
    card.id = format!("RC-{:04}", cards.len() + 1);
    cards.push(card.clone());
    HttpResponse::Created().json(card)
}

async fn rate_usage(data: web::Data<AppState>, body: web::Json<UsageEvent>) -> HttpResponse {
    let event = body.into_inner();
    let cards = data.rate_cards.lock().unwrap();

    let card = cards.iter().find(|c| c.meter_key == event.meter_key && c.product_key == event.product_key);
    let card = match card {
        Some(c) => c.clone(),
        None => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("No rate card for meter={} product={}", event.meter_key, event.product_key)
        })),
    };

    let billable_units = (event.quantity - card.included_units).max(0);
    let amount = billable_units as f64 * card.unit_price;
    let rated = RatedEvent {
        id: format!("RE-{}", chrono_simple()),
        usage_event_id: event.usage_event_id.clone(),
        tenant_id: event.tenant_id.clone(),
        meter_key: event.meter_key.clone(),
        product_key: event.product_key.clone(),
        quantity: event.quantity,
        included_units: card.included_units,
        billable_units,
        unit_price: card.unit_price,
        amount_accrued: (amount * 100.0).round() / 100.0,
        currency: card.currency.clone(),
        rated_at: "2026-05-09T15:00:00Z".to_string(),
    };

    let mut events = data.rated_events.lock().unwrap();
    events.push(rated.clone());
    HttpResponse::Ok().json(rated)
}

async fn list_rated_events(data: web::Data<AppState>) -> HttpResponse {
    let events = data.rated_events.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *events, "total": events.len() }))
}

fn chrono_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{}", d.as_millis())
}

fn seed_rate_cards() -> Vec<RateCardLine> {
    vec![
        RateCardLine { id: "RC-001".into(), meter_key: "transfer_posted".into(), product_key: "nip_payments".into(), included_units: 10_000, unit_price: 25.0, currency: "NGN".into(), effective_date: "2026-01-01".into(), status: "active".into() },
        RateCardLine { id: "RC-002".into(), meter_key: "api_call".into(), product_key: "open_banking".into(), included_units: 100_000, unit_price: 0.50, currency: "NGN".into(), effective_date: "2026-01-01".into(), status: "active".into() },
        RateCardLine { id: "RC-003".into(), meter_key: "sms_sent".into(), product_key: "notifications".into(), included_units: 50_000, unit_price: 4.0, currency: "NGN".into(), effective_date: "2026-01-01".into(), status: "active".into() },
        RateCardLine { id: "RC-004".into(), meter_key: "ussd_session".into(), product_key: "ussd_banking".into(), included_units: 200_000, unit_price: 6.98, currency: "NGN".into(), effective_date: "2026-01-01".into(), status: "active".into() },
        RateCardLine { id: "RC-005".into(), meter_key: "card_transaction".into(), product_key: "card_processing".into(), included_units: 5_000, unit_price: 35.0, currency: "NGN".into(), effective_date: "2026-01-01".into(), status: "active".into() },
        RateCardLine { id: "RC-006".into(), meter_key: "fx_conversion".into(), product_key: "treasury".into(), included_units: 500, unit_price: 100.0, currency: "NGN".into(), effective_date: "2026-01-01".into(), status: "active".into() },
    ]
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let addr = std::env::var("ADDR").unwrap_or_else(|_| "0.0.0.0:8086".to_string());
    let state = web::Data::new(AppState {
        rate_cards: Mutex::new(seed_rate_cards()),
        rated_events: Mutex::new(Vec::new()),
    });
    println!("billing-rating-worker listening on {addr}");

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/billing/rate-cards", web::get().to(list_rate_cards))
            .route("/v1/billing/rate-cards", web::post().to(create_rate_card))
            .route("/v1/billing/rate", web::post().to(rate_usage))
            .route("/v1/billing/rated-events", web::get().to(list_rated_events))
    })
    .bind(&addr)?
    .run()
    .await
}

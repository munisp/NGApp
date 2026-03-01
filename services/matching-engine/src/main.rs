//! NEXCOM Exchange Matching Engine
//! High-performance commodity exchange with microsecond-latency orderbook,
//! futures/options lifecycle, CCP clearing, FIX 4.4 gateway, market surveillance,
//! physical delivery infrastructure, and HA/DR failover.

mod broker;
mod clearing;
mod corporate_actions;
mod delivery;
mod engine;
mod fix;
mod futures;
mod ha;
mod indices;
mod market_maker;
mod options;
mod orderbook;
pub mod persistence;
mod surveillance;
mod types;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use engine::ExchangeEngine;
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tracing::info;
use types::*;

type AppState = Arc<ExchangeEngine>;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "nexcom_matching_engine=info,tower_http=info".into()),
        )
        .with_target(false)
        .init();

    let node_id = std::env::var("NODE_ID").unwrap_or_else(|_| "nexcom-primary".to_string());
    let role = match std::env::var("NODE_ROLE")
        .unwrap_or_else(|_| "primary".to_string())
        .as_str()
    {
        "standby" => NodeRole::Standby,
        _ => NodeRole::Primary,
    };
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());

    info!(
        "Starting NEXCOM Matching Engine v{}",
        env!("CARGO_PKG_VERSION")
    );

    let engine = Arc::new(ExchangeEngine::new(node_id, role));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Health & Status
        .route("/health", get(health))
        .route("/api/v1/status", get(exchange_status))
        .route("/api/v1/cluster", get(cluster_status))
        // Orders
        .route("/api/v1/orders", post(submit_order))
        .route(
            "/api/v1/orders/:symbol/:order_id",
            delete(cancel_order),
        )
        .route(
            "/api/v1/orders/:symbol/:order_id/amend",
            put(amend_order),
        )
        // Market Data
        .route("/api/v1/depth/:symbol", get(market_depth))
        .route("/api/v1/symbols", get(list_symbols))
        // Futures
        .route("/api/v1/futures/contracts", get(list_futures))
        .route("/api/v1/futures/contracts/:symbol", get(get_future))
        .route("/api/v1/futures/specs", get(list_specs))
        // Options
        .route("/api/v1/options/contracts", get(list_options))
        .route("/api/v1/options/price", get(price_option))
        .route("/api/v1/options/chain/:underlying", get(option_chain))
        // Clearing
        .route("/api/v1/clearing/margins/:account_id", get(get_margins))
        .route(
            "/api/v1/clearing/positions/:account_id",
            get(get_positions),
        )
        .route("/api/v1/clearing/guarantee-fund", get(guarantee_fund))
        // Surveillance
        .route("/api/v1/surveillance/alerts", get(surveillance_alerts))
        .route(
            "/api/v1/surveillance/position-limits/:account_id/:symbol",
            get(check_position),
        )
        .route("/api/v1/surveillance/reports/daily", get(daily_report))
        // Delivery
        .route("/api/v1/delivery/warehouses", get(list_warehouses))
        .route(
            "/api/v1/delivery/warehouses/:commodity",
            get(warehouses_for_commodity),
        )
        .route(
            "/api/v1/delivery/receipts/:account_id",
            get(account_receipts),
        )
        .route("/api/v1/delivery/receipts", post(issue_receipt))
        .route(
            "/api/v1/delivery/grades/:commodity",
            get(commodity_grades),
        )
        .route("/api/v1/delivery/stocks", get(warehouse_stocks))
        // Audit
        .route("/api/v1/audit/entries", get(audit_entries))
        .route("/api/v1/audit/integrity", get(audit_integrity))
        // FIX
        .route("/api/v1/fix/sessions", get(fix_sessions))
        .route("/api/v1/fix/message", post(fix_message))
        // Market Makers
        .route("/api/v1/market-makers", get(list_market_makers))
        .route("/api/v1/market-makers/:id", get(get_market_maker))
        .route("/api/v1/market-makers/:id/performance", get(market_maker_performance))
        .route("/api/v1/market-makers/quotes/:symbol", get(market_maker_quotes))
        .route("/api/v1/market-makers/quotes", post(submit_quote))
        // Indices
        .route("/api/v1/indices", get(list_indices))
        .route("/api/v1/indices/values", get(index_values))
        .route("/api/v1/indices/:id", get(get_index))
        .route("/api/v1/indices/:id/value", get(get_index_value))
        // Corporate Actions
        .route("/api/v1/corporate-actions", get(list_corporate_actions))
        .route("/api/v1/corporate-actions/pending", get(pending_corporate_actions))
        .route("/api/v1/corporate-actions/:symbol", get(corporate_actions_for_symbol))
        .route("/api/v1/corporate-actions/:id/process", post(process_corporate_action))
        // Brokers
        .route("/api/v1/brokers", get(list_brokers))
        .route("/api/v1/brokers/:id", get(get_broker))
        .route("/api/v1/brokers/connected", get(connected_brokers))
        .route("/api/v1/brokers/route", post(route_order))
        .layer(RequestBodyLimitLayer::new(1024 * 1024)) // 1MB request body limit
        .layer(cors)
        .with_state(engine);

    let addr = format!("0.0.0.0:{}", port);
    info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// ─── Health & Status ─────────────────────────────────────────────────────────

async fn health(State(engine): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "nexcom-matching-engine",
        "version": env!("CARGO_PKG_VERSION"),
        "role": engine.cluster.role(),
        "accepting_orders": engine.cluster.is_accepting_orders(),
    }))
}

async fn exchange_status(State(engine): State<AppState>) -> Json<serde_json::Value> {
    Json(engine.status())
}

async fn cluster_status(State(engine): State<AppState>) -> Json<serde_json::Value> {
    Json(engine.cluster.cluster_status())
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async fn submit_order(
    State(engine): State<AppState>,
    Json(req): Json<NewOrderRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    let order = Order::new(
        req.client_order_id,
        req.account_id,
        req.symbol,
        req.side,
        req.order_type,
        req.time_in_force,
        req.price.map(to_price).unwrap_or(0),
        req.stop_price.map(to_price).unwrap_or(0),
        (req.quantity * 1_000_000.0) as Qty,
    );

    match engine.submit_order(order) {
        Ok((trades, result_order)) => {
            let response = serde_json::json!({
                "order": {
                    "id": result_order.id,
                    "status": result_order.status,
                    "filled_quantity": result_order.filled_quantity,
                    "remaining_quantity": result_order.remaining_quantity,
                    "average_price": from_price(result_order.average_price),
                },
                "trades": trades.iter().map(|t| serde_json::json!({
                    "id": t.id,
                    "price": from_price(t.price),
                    "quantity": t.quantity,
                    "buyer": t.buyer_account,
                    "seller": t.seller_account,
                    "timestamp": t.timestamp,
                })).collect::<Vec<_>>(),
            });
            Ok(Json(ApiResponse::ok(response)))
        }
        Err(e) => Ok(Json(ApiResponse::<serde_json::Value>::err(e))),
    }
}

async fn cancel_order(
    State(engine): State<AppState>,
    Path((symbol, order_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    let uuid = uuid::Uuid::parse_str(&order_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    match engine.cancel_order(&symbol, uuid, "system") {
        Ok(order) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "order_id": order.id,
            "status": order.status,
        })))),
        Err(e) => Ok(Json(ApiResponse::<serde_json::Value>::err(e))),
    }
}

#[derive(serde::Deserialize)]
struct AmendOrderRequest {
    price: Option<f64>,
    quantity: Option<f64>,
}

async fn amend_order(
    State(engine): State<AppState>,
    Path((symbol, order_id)): Path<(String, String)>,
    Json(req): Json<AmendOrderRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    let uuid = uuid::Uuid::parse_str(&order_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let new_price = req.price.map(to_price);
    let new_quantity = req.quantity.map(|q| (q * 1_000_000.0) as Qty);

    match engine.amend_order(&symbol, uuid, new_price, new_quantity) {
        Ok((trades, new_order, old_order)) => {
            let response = serde_json::json!({
                "old_order": {
                    "id": old_order.id,
                    "status": old_order.status,
                },
                "new_order": {
                    "id": new_order.id,
                    "status": new_order.status,
                    "price": from_price(new_order.price),
                    "quantity": new_order.quantity,
                    "filled_quantity": new_order.filled_quantity,
                },
                "trades": trades.iter().map(|t| serde_json::json!({
                    "id": t.id,
                    "price": from_price(t.price),
                    "quantity": t.quantity,
                })).collect::<Vec<_>>(),
            });
            Ok(Json(ApiResponse::ok(response)))
        }
        Err(e) => Ok(Json(ApiResponse::<serde_json::Value>::err(e))),
    }
}

// ─── Market Data ─────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct DepthQuery {
    levels: Option<usize>,
}

async fn market_depth(
    State(engine): State<AppState>,
    Path(symbol): Path<String>,
    Query(params): Query<DepthQuery>,
) -> Json<ApiResponse<MarketDepth>> {
    let levels = params.levels.unwrap_or(20);
    match engine.orderbooks.depth(&symbol, levels) {
        Some(depth) => Json(ApiResponse::ok(depth)),
        None => Json(ApiResponse::err(format!("Symbol {} not found", symbol))),
    }
}

async fn list_symbols(State(engine): State<AppState>) -> Json<ApiResponse<Vec<String>>> {
    Json(ApiResponse::ok(engine.orderbooks.symbols()))
}

// ─── Futures ─────────────────────────────────────────────────────────────────

async fn list_futures(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<FuturesContract>>> {
    Json(ApiResponse::ok(engine.futures.active_contracts()))
}

async fn get_future(
    State(engine): State<AppState>,
    Path(symbol): Path<String>,
) -> Json<ApiResponse<FuturesContract>> {
    match engine.futures.get_contract(&symbol) {
        Some(contract) => Json(ApiResponse::ok(contract)),
        None => Json(ApiResponse::err(format!("Contract {} not found", symbol))),
    }
}

async fn list_specs(State(engine): State<AppState>) -> Json<ApiResponse<serde_json::Value>> {
    let specs: Vec<serde_json::Value> = engine
        .futures
        .get_specs()
        .into_iter()
        .map(|(name, spec)| {
            serde_json::json!({
                "underlying": name,
                "contract_size": spec.contract_size,
                "tick_size": from_price(spec.tick_size),
                "initial_margin_pct": spec.initial_margin_pct,
                "maintenance_margin_pct": spec.maintenance_margin_pct,
                "daily_limit_pct": spec.daily_limit_pct,
                "settlement_type": spec.settlement_type,
                "delivery_months": spec.delivery_months,
                "trading_hours": spec.trading_hours,
            })
        })
        .collect();
    Json(ApiResponse::ok(serde_json::json!(specs)))
}

// ─── Options ─────────────────────────────────────────────────────────────────

async fn list_options(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<OptionsContract>>> {
    Json(ApiResponse::ok(engine.options.active_contracts()))
}

#[derive(serde::Deserialize)]
struct PriceOptionQuery {
    symbol: String,
    futures_price: f64,
    volatility: f64,
}

async fn price_option(
    State(engine): State<AppState>,
    Query(params): Query<PriceOptionQuery>,
) -> Json<ApiResponse<serde_json::Value>> {
    match engine
        .options
        .price_option(&params.symbol, params.futures_price, params.volatility)
    {
        Some((price, greeks)) => Json(ApiResponse::ok(serde_json::json!({
            "symbol": params.symbol,
            "theoretical_price": price,
            "greeks": greeks,
        }))),
        None => Json(ApiResponse::err("Option not found")),
    }
}

async fn option_chain(
    State(engine): State<AppState>,
    Path(underlying): Path<String>,
) -> Json<ApiResponse<Vec<OptionsContract>>> {
    let contracts = engine.options.options_for_underlying(&underlying);
    Json(ApiResponse::ok(contracts))
}

// ─── Clearing ────────────────────────────────────────────────────────────────

async fn get_margins(
    State(engine): State<AppState>,
    Path(account_id): Path<String>,
) -> Json<ApiResponse<MarginRequirement>> {
    let positions = engine.clearing.get_positions(&account_id);
    if positions.is_empty() {
        return Json(ApiResponse::err("No positions found"));
    }

    let mut prices = HashMap::new();
    for pos in &positions {
        prices.insert(pos.symbol.clone(), from_price(pos.average_price));
    }

    let margin = engine.clearing.span.calculate_margin(&positions, &prices);
    Json(ApiResponse::ok(margin))
}

async fn get_positions(
    State(engine): State<AppState>,
    Path(account_id): Path<String>,
) -> Json<ApiResponse<Vec<Position>>> {
    Json(ApiResponse::ok(engine.clearing.get_positions(&account_id)))
}

async fn guarantee_fund(
    State(engine): State<AppState>,
) -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse::ok(serde_json::json!({
        "total": from_price(engine.clearing.guarantee_fund_total()),
        "members": engine.clearing.member_count(),
    })))
}

// ─── Surveillance ────────────────────────────────────────────────────────────

async fn surveillance_alerts(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<SurveillanceAlert>>> {
    Json(ApiResponse::ok(engine.surveillance.unresolved_alerts()))
}

async fn check_position(
    State(engine): State<AppState>,
    Path((account_id, symbol)): Path<(String, String)>,
) -> Json<ApiResponse<serde_json::Value>> {
    let pos = engine
        .surveillance
        .position_limits
        .get_position(&account_id, &symbol);
    Json(ApiResponse::ok(serde_json::json!({
        "account_id": account_id,
        "symbol": symbol,
        "net_position": pos,
    })))
}

async fn daily_report(
    State(_engine): State<AppState>,
) -> Json<ApiResponse<serde_json::Value>> {
    let report = surveillance::RegulatoryReporter::daily_trade_report(&[]);
    Json(ApiResponse::ok(report))
}

// ─── Delivery ────────────────────────────────────────────────────────────────

async fn list_warehouses(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<Warehouse>>> {
    Json(ApiResponse::ok(engine.delivery.get_warehouses()))
}

async fn warehouses_for_commodity(
    State(engine): State<AppState>,
    Path(commodity): Path<String>,
) -> Json<ApiResponse<Vec<Warehouse>>> {
    Json(ApiResponse::ok(
        engine
            .delivery
            .get_warehouses_for_commodity(&commodity.to_uppercase()),
    ))
}

async fn account_receipts(
    State(engine): State<AppState>,
    Path(account_id): Path<String>,
) -> Json<ApiResponse<Vec<WarehouseReceipt>>> {
    Json(ApiResponse::ok(
        engine.delivery.get_receipts_for_account(&account_id),
    ))
}

#[derive(serde::Deserialize)]
struct IssueReceiptRequest {
    warehouse_id: String,
    commodity: String,
    quantity_tonnes: f64,
    grade: String,
    owner_account: String,
}

async fn issue_receipt(
    State(engine): State<AppState>,
    Json(req): Json<IssueReceiptRequest>,
) -> Json<ApiResponse<WarehouseReceipt>> {
    match engine.delivery.issue_receipt(
        &req.warehouse_id,
        &req.commodity,
        req.quantity_tonnes,
        &req.grade,
        &req.owner_account,
    ) {
        Ok(receipt) => Json(ApiResponse::ok(receipt)),
        Err(e) => Json(ApiResponse::err(e)),
    }
}

async fn commodity_grades(
    State(engine): State<AppState>,
    Path(commodity): Path<String>,
) -> Json<ApiResponse<Vec<delivery::GradeSpec>>> {
    Json(ApiResponse::ok(
        engine.delivery.get_grades(&commodity.to_uppercase()),
    ))
}

async fn warehouse_stocks(
    State(engine): State<AppState>,
) -> Json<ApiResponse<HashMap<String, f64>>> {
    Json(ApiResponse::ok(engine.delivery.total_stocks()))
}

// ─── Audit ───────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct AuditQuery {
    from_seq: Option<u64>,
    to_seq: Option<u64>,
}

async fn audit_entries(
    State(engine): State<AppState>,
    Query(params): Query<AuditQuery>,
) -> Json<ApiResponse<Vec<AuditEntry>>> {
    let from = params.from_seq.unwrap_or(1);
    let to = params.to_seq.unwrap_or(engine.audit.current_sequence());
    Json(ApiResponse::ok(engine.audit.get_range(from, to)))
}

async fn audit_integrity(
    State(engine): State<AppState>,
) -> Json<ApiResponse<serde_json::Value>> {
    let valid = engine.audit.verify_integrity();
    Json(ApiResponse::ok(serde_json::json!({
        "integrity_valid": valid,
        "total_entries": engine.audit.entry_count(),
        "current_sequence": engine.audit.current_sequence(),
    })))
}

// ─── FIX ─────────────────────────────────────────────────────────────────────

async fn fix_sessions(
    State(engine): State<AppState>,
) -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse::ok(serde_json::json!({
        "total_sessions": engine.fix_gateway.session_count(),
        "logged_in": engine.fix_gateway.logged_in_count(),
    })))
}

#[derive(serde::Deserialize)]
struct FixMessageRequest {
    raw_message: String,
}

async fn fix_message(
    State(engine): State<AppState>,
    Json(req): Json<FixMessageRequest>,
) -> Json<ApiResponse<serde_json::Value>> {
    match engine.fix_gateway.process_message(&req.raw_message) {
        Ok((response, order)) => {
            if let Some(order) = order {
                let _ = engine.submit_order(order);
            }
            Json(ApiResponse::ok(serde_json::json!({
                "response": response,
            })))
        }
        Err(e) => Json(ApiResponse::err(e)),
    }
}

// ─── Market Makers ──────────────────────────────────────────────────────────

async fn list_market_makers(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<market_maker::MarketMaker>>> {
    Json(ApiResponse::ok(engine.market_makers.list_makers()))
}

async fn get_market_maker(
    State(engine): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<market_maker::MarketMaker>> {
    match engine.market_makers.get_maker(&id) {
        Some(mm) => Json(ApiResponse::ok(mm)),
        None => Json(ApiResponse::err(format!("Market maker {} not found", id))),
    }
}

async fn market_maker_performance(
    State(engine): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<serde_json::Value>> {
    match engine.market_makers.evaluate_performance(&id) {
        Some(perf) => Json(ApiResponse::ok(perf)),
        None => Json(ApiResponse::err(format!("Market maker {} not found", id))),
    }
}

async fn market_maker_quotes(
    State(engine): State<AppState>,
    Path(symbol): Path<String>,
) -> Json<ApiResponse<Vec<market_maker::TwoSidedQuote>>> {
    Json(ApiResponse::ok(engine.market_makers.quotes_for_symbol(&symbol)))
}

#[derive(serde::Deserialize)]
struct SubmitQuoteRequest {
    market_maker_id: String,
    symbol: String,
    bid_price: f64,
    bid_quantity: f64,
    ask_price: f64,
    ask_quantity: f64,
}

async fn submit_quote(
    State(engine): State<AppState>,
    Json(req): Json<SubmitQuoteRequest>,
) -> Json<ApiResponse<market_maker::TwoSidedQuote>> {
    let quote = market_maker::TwoSidedQuote {
        id: uuid::Uuid::new_v4(),
        market_maker_id: req.market_maker_id,
        symbol: req.symbol,
        bid_price: to_price(req.bid_price),
        bid_quantity: (req.bid_quantity * 1_000_000.0) as Qty,
        ask_price: to_price(req.ask_price),
        ask_quantity: (req.ask_quantity * 1_000_000.0) as Qty,
        bid_levels: vec![],
        ask_levels: vec![],
        submitted_at: chrono::Utc::now(),
        valid_until: None,
    };
    match engine.market_makers.submit_quote(quote) {
        Ok(q) => Json(ApiResponse::ok(q)),
        Err(e) => Json(ApiResponse::err(e)),
    }
}

// ─── Indices ────────────────────────────────────────────────────────────────

async fn list_indices(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<indices::IndexDefinition>>> {
    Json(ApiResponse::ok(engine.indices.list_indices()))
}

async fn index_values(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<indices::IndexValue>>> {
    Json(ApiResponse::ok(engine.indices.all_values()))
}

async fn get_index(
    State(engine): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<indices::IndexDefinition>> {
    match engine.indices.get_index(&id) {
        Some(idx) => Json(ApiResponse::ok(idx)),
        None => Json(ApiResponse::err(format!("Index {} not found", id))),
    }
}

async fn get_index_value(
    State(engine): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<indices::IndexValue>> {
    match engine.indices.get_value(&id) {
        Some(val) => Json(ApiResponse::ok(val)),
        None => Json(ApiResponse::err(format!("Index {} not found", id))),
    }
}

// ─── Corporate Actions ──────────────────────────────────────────────────────

async fn list_corporate_actions(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<corporate_actions::CorporateAction>>> {
    Json(ApiResponse::ok(engine.corporate_actions.all_actions()))
}

async fn pending_corporate_actions(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<corporate_actions::CorporateAction>>> {
    Json(ApiResponse::ok(engine.corporate_actions.pending_actions()))
}

async fn corporate_actions_for_symbol(
    State(engine): State<AppState>,
    Path(symbol): Path<String>,
) -> Json<ApiResponse<Vec<corporate_actions::CorporateAction>>> {
    Json(ApiResponse::ok(engine.corporate_actions.actions_for_symbol(&symbol)))
}

async fn process_corporate_action(
    State(engine): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<corporate_actions::CorporateAction>> {
    let uuid = match uuid::Uuid::parse_str(&id) {
        Ok(u) => u,
        Err(_) => return Json(ApiResponse::err("Invalid action ID")),
    };
    match engine.corporate_actions.process_action(uuid) {
        Ok(action) => Json(ApiResponse::ok(action)),
        Err(e) => Json(ApiResponse::err(e)),
    }
}

// ─── Brokers ────────────────────────────────────────────────────────────────

async fn list_brokers(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<broker::Broker>>> {
    Json(ApiResponse::ok(engine.brokers.list_brokers()))
}

async fn get_broker(
    State(engine): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<broker::Broker>> {
    match engine.brokers.get_broker(&id) {
        Some(b) => Json(ApiResponse::ok(b)),
        None => Json(ApiResponse::err(format!("Broker {} not found", id))),
    }
}

async fn connected_brokers(
    State(engine): State<AppState>,
) -> Json<ApiResponse<Vec<broker::Broker>>> {
    Json(ApiResponse::ok(engine.brokers.connected_brokers()))
}

#[derive(serde::Deserialize)]
struct RouteOrderRequest {
    broker_id: String,
    client_account: String,
    symbol: String,
    side: String,
    quantity: f64,
}

async fn route_order(
    State(engine): State<AppState>,
    Json(req): Json<RouteOrderRequest>,
) -> Json<ApiResponse<broker::OrderRoute>> {
    match engine.brokers.route_order(
        &req.broker_id,
        &req.client_account,
        &req.symbol,
        &req.side,
        (req.quantity * 1_000_000.0) as i64,
    ) {
        Ok(route) => Json(ApiResponse::ok(route)),
        Err(e) => Json(ApiResponse::err(e)),
    }
}

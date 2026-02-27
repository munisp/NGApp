//! NEXCOM Exchange Matching Engine
//! High-performance commodity exchange with microsecond-latency orderbook,
//! futures/options lifecycle, CCP clearing, FIX 4.4 gateway, market surveillance,
//! physical delivery infrastructure, and HA/DR failover.

mod clearing;
mod delivery;
mod engine;
mod fix;
mod futures;
mod ha;
mod options;
mod orderbook;
mod surveillance;
mod types;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use engine::ExchangeEngine;
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
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

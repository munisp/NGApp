// NEXCOM Exchange - Settlement Service
// Integrates TigerBeetle for double-entry accounting and Mojaloop for
// interoperable settlement. Handles T+0 blockchain settlement and T+2 traditional.

use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

mod ledger;
mod mojaloop;
mod settlement;

use settlement::SettlementEngine;

#[derive(Clone)]
pub struct AppState {
    pub engine: Arc<RwLock<SettlementEngine>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .json()
        .init();

    tracing::info!("Starting NEXCOM Settlement Service...");

    let tigerbeetle_address = std::env::var("TIGERBEETLE_ADDRESS")
        .unwrap_or_else(|_| "localhost:3000".to_string());
    let mojaloop_url = std::env::var("MOJALOOP_HUB_URL")
        .unwrap_or_else(|_| "http://localhost:4001".to_string());

    let engine = SettlementEngine::new(&tigerbeetle_address, &mojaloop_url);
    let state = AppState {
        engine: Arc::new(RwLock::new(engine)),
    };

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8005".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid u16");

    tracing::info!("Settlement Service listening on port {}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(ready))
            .service(
                web::scope("/api/v1")
                    .route("/settlement/initiate", web::post().to(initiate_settlement))
                    .route("/settlement/{id}", web::get().to(get_settlement))
                    .route("/settlement/{id}/status", web::get().to(get_settlement_status))
                    .route("/ledger/accounts/{user_id}", web::get().to(get_accounts))
                    .route("/ledger/accounts", web::post().to(create_account))
                    .route("/ledger/transfers", web::post().to(create_transfer))
                    .route("/ledger/balance/{account_id}", web::get().to(get_balance))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "settlement"
    }))
}

async fn ready() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ready"}))
}

#[derive(Deserialize)]
pub struct InitiateSettlementRequest {
    pub trade_id: String,
    pub buyer_id: String,
    pub seller_id: String,
    pub symbol: String,
    pub quantity: String,
    pub price: String,
    pub settlement_type: String, // "blockchain_t0" or "traditional_t2"
}

#[derive(Serialize)]
pub struct SettlementResponse {
    pub settlement_id: String,
    pub status: String,
    pub message: String,
}

async fn initiate_settlement(
    state: web::Data<AppState>,
    req: web::Json<InitiateSettlementRequest>,
) -> HttpResponse {
    let engine = state.engine.read().await;
    match engine.initiate(&req).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_settlement(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let settlement_id = path.into_inner();
    let engine = state.engine.read().await;
    match engine.get_settlement(&settlement_id).await {
        Ok(settlement) => HttpResponse::Ok().json(settlement),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_settlement_status(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let settlement_id = path.into_inner();
    let engine = state.engine.read().await;
    match engine.get_status(&settlement_id).await {
        Ok(status) => HttpResponse::Ok().json(status),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_accounts(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let user_id = path.into_inner();
    let engine = state.engine.read().await;
    match engine.get_user_accounts(&user_id).await {
        Ok(accounts) => HttpResponse::Ok().json(accounts),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
pub struct CreateAccountRequest {
    pub user_id: String,
    pub currency: String,
    pub account_type: String,
}

async fn create_account(
    state: web::Data<AppState>,
    req: web::Json<CreateAccountRequest>,
) -> HttpResponse {
    let engine = state.engine.read().await;
    match engine.create_account(&req).await {
        Ok(account) => HttpResponse::Created().json(account),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
pub struct CreateTransferRequest {
    pub debit_account_id: String,
    pub credit_account_id: String,
    pub amount: String,
    pub currency: String,
    pub reference: String,
}

async fn create_transfer(
    state: web::Data<AppState>,
    req: web::Json<CreateTransferRequest>,
) -> HttpResponse {
    let engine = state.engine.read().await;
    match engine.create_transfer(&req).await {
        Ok(transfer) => HttpResponse::Created().json(transfer),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn get_balance(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let account_id = path.into_inner();
    let engine = state.engine.read().await;
    match engine.get_balance(&account_id).await {
        Ok(balance) => HttpResponse::Ok().json(balance),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

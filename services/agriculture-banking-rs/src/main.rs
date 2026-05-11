use actix_web::{web, App, HttpServer};
use std::sync::Mutex;

mod models;
mod handlers;
mod enhancements;

use models::*;

struct AppState {
    farmers: Mutex<Vec<Farmer>>,
    agri_loans: Mutex<Vec<AgriLoan>>,
    crop_insurance: Mutex<Vec<CropInsurancePolicy>>,
    value_chain: Mutex<Vec<ValueChainContract>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            farmers: Mutex::new(Vec::new()),
            agri_loans: Mutex::new(Vec::new()),
            crop_insurance: Mutex::new(Vec::new()),
            value_chain: Mutex::new(Vec::new()),
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let addr = std::env::var("ADDR").unwrap_or_else(|_| "0.0.0.0:8090".to_string());
    let state = web::Data::new(AppState::new());
    let enh_state = web::Data::new(enhancements::AgriEnhState::new());
    println!("agriculture-banking-rs listening on {addr}");
    println!("middleware integrations: Kafka, Redis, Postgres, Temporal, Fluvio, APISIX, Keycloak, OpenAppSec, Lakehouse");

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .app_data(enh_state.clone())
            .route("/healthz", web::get().to(handlers::healthz))
            // Farmer CRUD
            .route("/v1/agriculture/farmers", web::get().to(handlers::list_farmers))
            .route("/v1/agriculture/farmers", web::post().to(handlers::create_farmer))
            .route("/v1/agriculture/farmers/{id}", web::get().to(handlers::get_farmer))
            .route("/v1/agriculture/farmers/{id}", web::put().to(handlers::update_farmer))
            .route("/v1/agriculture/farmers/{id}", web::delete().to(handlers::delete_farmer))
            // Agri-Loan CRUD
            .route("/v1/agriculture/loans", web::get().to(handlers::list_agri_loans))
            .route("/v1/agriculture/loans", web::post().to(handlers::create_agri_loan))
            .route("/v1/agriculture/loans/{id}", web::get().to(handlers::get_agri_loan))
            .route("/v1/agriculture/loans/{id}", web::put().to(handlers::update_agri_loan))
            .route("/v1/agriculture/loans/{id}/disburse", web::post().to(handlers::disburse_agri_loan))
            .route("/v1/agriculture/loans/{id}/repay", web::post().to(handlers::repay_agri_loan))
            // Crop Insurance CRUD
            .route("/v1/agriculture/insurance", web::get().to(handlers::list_crop_insurance))
            .route("/v1/agriculture/insurance", web::post().to(handlers::create_crop_insurance))
            .route("/v1/agriculture/insurance/{id}", web::get().to(handlers::get_crop_insurance))
            .route("/v1/agriculture/insurance/{id}/claim", web::post().to(handlers::file_insurance_claim))
            // Value Chain CRUD
            .route("/v1/agriculture/value-chain", web::get().to(handlers::list_value_chain))
            .route("/v1/agriculture/value-chain", web::post().to(handlers::create_value_chain_contract))
            .route("/v1/agriculture/value-chain/{id}", web::get().to(handlers::get_value_chain_contract))
            .route("/v1/agriculture/value-chain/{id}/milestone", web::post().to(handlers::record_milestone))
            // B4: Weather, USSD, Warehouse Receipt Financing
            .route("/v1/agriculture/weather", web::get().to(enhancements::get_weather))
            .route("/v1/agriculture/weather", web::post().to(enhancements::report_weather))
            .route("/v1/agriculture/ussd", web::post().to(enhancements::ussd_handler))
            .route("/v1/agriculture/warehouse-receipts", web::get().to(enhancements::list_warehouse_receipts))
            .route("/v1/agriculture/warehouse-receipts", web::post().to(enhancements::create_warehouse_receipt))
    })
    .bind(&addr)?
    .run()
    .await
}

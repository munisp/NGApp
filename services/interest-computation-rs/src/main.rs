#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;


#[derive(Debug, Serialize, Deserialize, Clone)]
struct InterestCalcRequest {
    pub principal: f64,
    pub rate_percent: f64,
    pub tenor_days: u32,
    pub day_count_convention: Option<String>,
    pub compounding: Option<String>,
    pub accrual_start: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AccrualSchedule {
    pub account_id: String,
    pub principal: f64,
    pub rate: f64,
    pub start_date: String,
    pub end_date: String,
    pub frequency: String,
}

struct AppState {
    db_url: Option<String>,
}


fn compute_simple_interest(principal: f64, rate: f64, days: u32, day_basis: u32) -> f64 {
    principal * (rate / 100.0) * (days as f64 / day_basis as f64)
}

fn compute_compound_interest(principal: f64, rate: f64, days: u32, day_basis: u32, freq: u32) -> f64 {
    let periods = days as f64 / (day_basis as f64 / freq as f64);
    let rate_per_period = rate / 100.0 / freq as f64;
    principal * (1.0 + rate_per_period).powf(periods) - principal
}

fn get_day_basis(convention: &str) -> u32 {
    match convention {
        "ACT/360" => 360,
        "ACT/365" => 365,
        "30/360" => 360,
        "ACT/ACT" => 365,
        _ => 365,
    }
}

fn generate_accrual_schedule(principal: f64, rate: f64, days: u32, freq: &str) -> Vec<serde_json::Value> {
    let periods = match freq {
        "daily" => days,
        "monthly" => days / 30,
        "quarterly" => days / 90,
        _ => 1,
    };
    let per_period = compute_simple_interest(principal, rate, days / periods.max(1), 365) ;
    (0..periods.max(1)).map(|i| json!({"period": i + 1, "accrued": per_period * (i + 1) as f64, "incremental": per_period})).collect()
}

async fn health(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "interest-computation-rs",
        "version": "1.0.0",
    }))
}


async fn calculate_interest(body: web::Json<InterestCalcRequest>) -> HttpResponse {
    let convention = body.day_count_convention.as_deref().unwrap_or("ACT/365");
    let day_basis = get_day_basis(convention);
    let compounding = body.compounding.as_deref().unwrap_or("simple");
    let interest = match compounding {
        "simple" => compute_simple_interest(body.principal, body.rate_percent, body.tenor_days, day_basis),
        "monthly" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 12),
        "quarterly" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 4),
        "daily" => compute_compound_interest(body.principal, body.rate_percent, body.tenor_days, day_basis, 365),
        _ => compute_simple_interest(body.principal, body.rate_percent, body.tenor_days, day_basis),
    };
    let maturity = body.principal + interest;
    HttpResponse::Ok().json(json!({"principal": body.principal, "rate": body.rate_percent, "tenor_days": body.tenor_days,
        "day_count": convention, "compounding": compounding, "interest": (interest * 100.0).round() / 100.0,
        "maturity_amount": (maturity * 100.0).round() / 100.0}))
}

async fn accrual_schedule(body: web::Json<AccrualSchedule>) -> HttpResponse {
    let schedule = generate_accrual_schedule(body.principal, body.rate, 365, &body.frequency);
    HttpResponse::Ok().json(json!({"account_id": body.account_id, "schedule": schedule}))
}

async fn effective_rate(body: web::Json<InterestCalcRequest>) -> HttpResponse {
    let nominal = body.rate_percent / 100.0;
    let n = match body.compounding.as_deref().unwrap_or("monthly") {
        "daily" => 365.0, "monthly" => 12.0, "quarterly" => 4.0, "semi-annual" => 2.0, _ => 12.0,
    };
    let effective = ((1.0 + nominal / n).powf(n) - 1.0) * 100.0;
    HttpResponse::Ok().json(json!({"nominal_rate": body.rate_percent, "effective_rate": (effective * 10000.0).round() / 10000.0, "compounding_frequency": n}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8103);
    let state = web::Data::new(AppState {
            db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("interest-computation-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/interest/calculate", web::post().to(calculate_interest))
            .route("/v1/interest/accrual-schedule", web::post().to(accrual_schedule))
            .route("/v1/interest/effective-rate", web::post().to(effective_rate))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

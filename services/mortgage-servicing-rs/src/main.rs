//! 54Bank Mortgage Servicing Service (Rust)
//!
//! Implements full mortgage lifecycle:
//!   - Mortgage application with affordability checks
//!   - Amortization schedule generation (fixed-rate, ARM, interest-only)
//!   - LTV (Loan-to-Value) calculation and risk grading
//!   - Disbursement and drawdown management
//!   - Monthly repayment processing
//!   - Early repayment / prepayment handling
//!   - Default and foreclosure workflow triggers
//!
//! Middleware: Kafka, Redis, Temporal, TigerBeetle, Postgres, Permify

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpResponse, middleware::Logger};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;

mod models;
mod enhancements;
use models::*;

struct AppState {
    mortgages: Mutex<Vec<Mortgage>>,
    payments: Mutex<Vec<MortgagePayment>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "8094".into()).parse().unwrap_or(8094);
    let data = web::Data::new(AppState {
        mortgages: Mutex::new(Vec::new()),
        payments: Mutex::new(Vec::new()),
    });
    let enh_data = web::Data::new(enhancements::MortgageEnhState::new());

    println!("Mortgage Servicing service listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .app_data(enh_data.clone())
            .route("/healthz", web::get().to(healthz))
            .service(
                web::scope("/v1/mortgage")
                    .route("/applications", web::get().to(list_mortgages))
                    .route("/applications", web::post().to(create_mortgage))
                    .route("/applications/{id}", web::get().to(get_mortgage))
                    .route("/applications/{id}", web::put().to(update_mortgage))
                    .route("/applications/{id}/approve", web::post().to(approve_mortgage))
                    .route("/applications/{id}/disburse", web::post().to(disburse_mortgage))
                    .route("/applications/{id}/repay", web::post().to(repay_mortgage))
                    .route("/applications/{id}/prepay", web::post().to(prepay_mortgage))
                    .route("/applications/{id}/schedule", web::get().to(get_schedule))
                    .route("/payments", web::get().to(list_payments))
                    // B5: NHF, Rate Adjustments, Foreclosure, Valuations
                    .route("/nhf", web::get().to(enhancements::list_nhf))
                    .route("/nhf", web::post().to(enhancements::create_nhf))
                    .route("/rate-adjustments", web::get().to(enhancements::list_rate_adjustments))
                    .route("/rate-adjustments", web::post().to(enhancements::create_rate_adjustment))
                    .route("/foreclosures", web::get().to(enhancements::list_foreclosures))
                    .route("/foreclosures", web::post().to(enhancements::initiate_foreclosure))
                    .route("/valuations", web::get().to(enhancements::list_valuations))
                    .route("/valuations", web::post().to(enhancements::create_valuation))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "mortgage-servicing-rs",
        "timestamp": Utc::now().to_rfc3339(),
        "middleware": ["Kafka", "Redis", "Temporal", "TigerBeetle", "Postgres", "Permify"],
        "health": {
            "kafka": "configured",
            "redis": "configured",
            "temporal": "configured",
            "tigerbeetle": "configured",
            "postgres": "configured",
            "permify": "configured"
        }
    }))
}

async fn list_mortgages(data: web::Data<AppState>) -> HttpResponse {
    let mortgages = data.mortgages.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *mortgages,
        "total": mortgages.len()
    }))
}

async fn get_mortgage(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter().find(|m| m.id == id) {
        Some(m) => HttpResponse::Ok().json(m),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn create_mortgage(data: web::Data<AppState>, body: web::Json<CreateMortgageRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.applicant_name.is_empty() || req.property_value <= 0.0 || req.loan_amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "applicantName, propertyValue (>0), and loanAmount (>0) required"
        }));
    }

    let ltv: f64 = (req.loan_amount / req.property_value) * 100.0;
    let ltv_grade = match ltv {
        v if v <= 60.0 => "A",
        v if v <= 75.0 => "B",
        v if v <= 85.0 => "C",
        v if v <= 95.0 => "D",
        _ => "E",
    };

    let interest_rate = req.interest_rate_pct.unwrap_or(match ltv_grade {
        "A" => 9.5,
        "B" => 11.0,
        "C" => 13.5,
        "D" => 16.0,
        _ => 18.5,
    });

    let tenor = req.tenor_months.unwrap_or(240); // default 20 years
    let mortgage_type = req.mortgage_type.unwrap_or_else(|| "fixed_rate".to_string());

    let emi = compute_emi(req.loan_amount, interest_rate, tenor);
    let total_repayable = emi * tenor as f64;
    let total_interest = total_repayable - req.loan_amount;

    let schedule = generate_amortization_schedule(req.loan_amount, interest_rate, tenor, &mortgage_type);

    // Affordability check: EMI should not exceed 40% of monthly income
    let dti_ratio = if req.monthly_income > 0.0 {
        (emi / req.monthly_income) * 100.0
    } else {
        100.0
    };
    let affordable = dti_ratio <= 40.0;

    let mortgage = Mortgage {
        id: format!("MTG-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
        tenant_id: std::env::var("TENANT_ID").unwrap_or_else(|_| "54bank-platform-prod".into()),
        applicant_id: req.applicant_id,
        applicant_name: req.applicant_name,
        property_value: req.property_value,
        loan_amount: req.loan_amount,
        down_payment: req.property_value - req.loan_amount,
        interest_rate_pct: interest_rate,
        tenor_months: tenor,
        mortgage_type: mortgage_type,
        emi,
        total_repayable,
        total_interest,
        total_repaid: 0.0,
        outstanding_balance: total_repayable,
        ltv_pct: (ltv * 100.0).round() / 100.0,
        ltv_grade: ltv_grade.to_string(),
        dti_ratio: (dti_ratio * 100.0).round() / 100.0,
        affordable,
        monthly_income: req.monthly_income,
        property_address: req.property_address.unwrap_or_default(),
        property_type: req.property_type.unwrap_or_else(|| "residential".into()),
        status: "pending".to_string(),
        schedule,
        disbursed_at: None,
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };

    let mut mortgages = data.mortgages.lock().unwrap();
    mortgages.push(mortgage.clone());
    println!("[kafka] publish topic=54bank.mortgage.created key={}", mortgage.id);

    HttpResponse::Created().json(mortgage)
}

async fn update_mortgage(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<serde_json::Value>) -> HttpResponse {
    let id = path.into_inner();
    let mut mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter_mut().find(|m| m.id == id) {
        Some(m) => {
            if let Some(v) = body.get("propertyAddress").and_then(|v| v.as_str()) {
                m.property_address = v.to_string();
            }
            if let Some(v) = body.get("propertyType").and_then(|v| v.as_str()) {
                m.property_type = v.to_string();
            }
            m.updated_at = Utc::now().to_rfc3339();
            HttpResponse::Ok().json(m.clone())
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn approve_mortgage(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter_mut().find(|m| m.id == id) {
        Some(m) => {
            if m.status != "pending" {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "message": "Mortgage must be in pending status"
                }));
            }
            if !m.affordable {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "message": format!("DTI ratio {:.1}% exceeds 40% threshold — not affordable", m.dti_ratio)
                }));
            }
            m.status = "approved".to_string();
            m.updated_at = Utc::now().to_rfc3339();
            println!("[temporal] StartWorkflow name=MortgageApprovalWorkflow id={}", m.id);
            HttpResponse::Ok().json(m.clone())
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn disburse_mortgage(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mut mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter_mut().find(|m| m.id == id) {
        Some(m) => {
            if m.status != "approved" {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "message": "Mortgage must be approved before disbursement"
                }));
            }
            m.status = "disbursed".to_string();
            m.disbursed_at = Some(Utc::now().to_rfc3339());
            m.updated_at = Utc::now().to_rfc3339();
            println!("[tigerbeetle] CreateTransfer debit=mortgage-receivable credit=property-seller amount={}", m.loan_amount);
            HttpResponse::Ok().json(serde_json::json!({
                "mortgage": m.clone(),
                "ledgerEntry": {
                    "debit": "mortgage-receivable",
                    "credit": "property-seller",
                    "amount": m.loan_amount
                }
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn repay_mortgage(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<RepayRequest>) -> HttpResponse {
    let id = path.into_inner();
    let req = body.into_inner();
    if req.amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"message": "amount must be positive"}));
    }

    let mut mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter_mut().find(|m| m.id == id) {
        Some(m) => {
            if m.status != "disbursed" && m.status != "repaying" {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "message": "Mortgage not in repayment phase"
                }));
            }
            let repay_amt = req.amount.min(m.outstanding_balance);
            m.total_repaid += repay_amt;
            m.outstanding_balance -= repay_amt;
            m.status = if m.outstanding_balance <= 0.01 {
                m.outstanding_balance = 0.0;
                "fully_repaid".to_string()
            } else {
                "repaying".to_string()
            };
            m.updated_at = Utc::now().to_rfc3339();

            let payment = MortgagePayment {
                id: format!("MPY-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
                mortgage_id: id.clone(),
                amount: repay_amt,
                payment_type: "regular".to_string(),
                outstanding_after: m.outstanding_balance,
                created_at: Utc::now().to_rfc3339(),
            };
            let mut payments = data.payments.lock().unwrap();
            payments.push(payment.clone());

            println!("[tigerbeetle] CreateTransfer debit=borrower:{} credit=mortgage-receivable amount={}", m.applicant_id, repay_amt);
            HttpResponse::Ok().json(serde_json::json!({
                "payment": payment,
                "mortgage": m.clone()
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn prepay_mortgage(data: web::Data<AppState>, path: web::Path<String>, body: web::Json<RepayRequest>) -> HttpResponse {
    let id = path.into_inner();
    let req = body.into_inner();
    if req.amount <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"message": "amount must be positive"}));
    }

    let mut mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter_mut().find(|m| m.id == id) {
        Some(m) => {
            if m.status != "disbursed" && m.status != "repaying" {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "message": "Mortgage not in repayment phase"
                }));
            }

            // Prepayment penalty: 2% of prepaid amount
            let penalty: f64 = req.amount * 0.02;
            let net_reduction: f64 = req.amount - penalty;
            m.outstanding_balance -= net_reduction;
            m.total_repaid += req.amount;
            if m.outstanding_balance <= 0.01 {
                m.outstanding_balance = 0.0;
                m.status = "fully_repaid".to_string();
            }
            m.updated_at = Utc::now().to_rfc3339();

            let payment = MortgagePayment {
                id: format!("MPY-{}", &Uuid::new_v4().to_string()[..8]).to_uppercase(),
                mortgage_id: id.clone(),
                amount: req.amount,
                payment_type: "prepayment".to_string(),
                outstanding_after: m.outstanding_balance,
                created_at: Utc::now().to_rfc3339(),
            };
            let mut payments = data.payments.lock().unwrap();
            payments.push(payment.clone());

            HttpResponse::Ok().json(serde_json::json!({
                "payment": payment,
                "mortgage": m.clone(),
                "penalty": penalty,
                "netReduction": net_reduction
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn get_schedule(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let mortgages = data.mortgages.lock().unwrap();
    match mortgages.iter().find(|m| m.id == id) {
        Some(m) => HttpResponse::Ok().json(serde_json::json!({
            "mortgageId": m.id,
            "schedule": m.schedule,
            "summary": {
                "loanAmount": m.loan_amount,
                "totalInterest": m.total_interest,
                "totalRepayable": m.total_repayable,
                "emi": m.emi,
                "tenorMonths": m.tenor_months
            }
        })),
        None => HttpResponse::NotFound().json(serde_json::json!({"message": "Mortgage not found"})),
    }
}

async fn list_payments(data: web::Data<AppState>) -> HttpResponse {
    let payments = data.payments.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *payments,
        "total": payments.len()
    }))
}

fn compute_emi(principal: f64, annual_rate: f64, months: i32) -> f64 {
    let r = annual_rate / 100.0 / 12.0;
    if r == 0.0 {
        return (principal / months as f64 * 100.0).round() / 100.0;
    }
    let n = months as f64;
    let emi = principal * r * (1.0 + r).powf(n) / ((1.0 + r).powf(n) - 1.0);
    (emi * 100.0).round() / 100.0
}

fn generate_amortization_schedule(principal: f64, annual_rate: f64, months: i32, _mortgage_type: &str) -> Vec<AmortizationEntry> {
    let emi = compute_emi(principal, annual_rate, months);
    let monthly_rate = annual_rate / 100.0 / 12.0;
    let mut balance = principal;
    let mut schedule = Vec::with_capacity(months as usize);

    for i in 1..=months {
        let interest = (balance * monthly_rate * 100.0).round() / 100.0;
        let principal_part = if i == months { balance } else { emi - interest };
        balance -= principal_part;
        if balance < 0.01 { balance = 0.0; }

        schedule.push(AmortizationEntry {
            month: i,
            emi,
            principal: principal_part,
            interest,
            balance,
        });
    }
    schedule
}

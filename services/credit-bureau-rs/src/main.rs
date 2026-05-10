use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
struct CreditReport {
    id: String,
    customer_id: String,
    customer_name: String,
    bvn: String,
    bureau: String,
    credit_score: u32,
    score_band: String,
    total_facilities: u32,
    active_facilities: u32,
    total_outstanding: f64,
    total_overdue: f64,
    max_days_past_due: u32,
    performing_percentage: f64,
    enquiry_count_6m: u32,
    report_date: String,
    next_refresh: String,
    status: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct FacilityRecord {
    id: String,
    report_id: String,
    institution: String,
    facility_type: String,
    original_amount: f64,
    outstanding_balance: f64,
    overdue_amount: f64,
    classification: String,
    start_date: String,
    maturity_date: String,
    days_past_due: u32,
}

#[derive(Deserialize)]
struct ScoreRequest {
    bvn: String,
    customer_name: String,
    bureau: Option<String>,
}

struct AppState {
    reports: Mutex<Vec<CreditReport>>,
    facilities: Mutex<Vec<FacilityRecord>>,
}

fn seed_reports() -> Vec<CreditReport> {
    vec![
        CreditReport { id: "CR-001".into(), customer_id: "CUST-001".into(), customer_name: "Aisha Mohammed".into(), bvn: "22100012345".into(), bureau: "CRC".into(), credit_score: 720, score_band: "Good".into(), total_facilities: 3, active_facilities: 2, total_outstanding: 3_500_000.0, total_overdue: 0.0, max_days_past_due: 0, performing_percentage: 100.0, enquiry_count_6m: 2, report_date: "2026-05-09".into(), next_refresh: "2026-06-09".into(), status: "current".into() },
        CreditReport { id: "CR-002".into(), customer_id: "CUST-002".into(), customer_name: "Ibrahim Musa".into(), bvn: "22100067890".into(), bureau: "FirstCentral".into(), credit_score: 780, score_band: "Excellent".into(), total_facilities: 5, active_facilities: 3, total_outstanding: 25_000_000.0, total_overdue: 0.0, max_days_past_due: 0, performing_percentage: 100.0, enquiry_count_6m: 1, report_date: "2026-05-08".into(), next_refresh: "2026-06-08".into(), status: "current".into() },
        CreditReport { id: "CR-003".into(), customer_id: "CUST-003".into(), customer_name: "Zenith Construction Ltd".into(), bvn: "22100099999".into(), bureau: "CreditRegistry".into(), credit_score: 580, score_band: "Fair".into(), total_facilities: 8, active_facilities: 6, total_outstanding: 250_000_000.0, total_overdue: 18_500_000.0, max_days_past_due: 45, performing_percentage: 75.0, enquiry_count_6m: 5, report_date: "2026-05-05".into(), next_refresh: "2026-06-05".into(), status: "watch_list".into() },
        CreditReport { id: "CR-004".into(), customer_id: "CUST-010".into(), customer_name: "Pinnacle Holdings Ltd".into(), bvn: "22100055555".into(), bureau: "CRC".into(), credit_score: 750, score_band: "Good".into(), total_facilities: 12, active_facilities: 8, total_outstanding: 700_000_000.0, total_overdue: 0.0, max_days_past_due: 0, performing_percentage: 100.0, enquiry_count_6m: 3, report_date: "2026-05-01".into(), next_refresh: "2026-06-01".into(), status: "current".into() },
        CreditReport { id: "CR-005".into(), customer_id: "CUST-006".into(), customer_name: "Niger Delta Dredging Ltd".into(), bvn: "22100033333".into(), bureau: "CRC".into(), credit_score: 380, score_band: "Poor".into(), total_facilities: 4, active_facilities: 3, total_outstanding: 120_000_000.0, total_overdue: 85_000_000.0, max_days_past_due: 180, performing_percentage: 25.0, enquiry_count_6m: 0, report_date: "2026-04-15".into(), next_refresh: "2026-05-15".into(), status: "non_performing".into() },
    ]
}

fn seed_facilities() -> Vec<FacilityRecord> {
    vec![
        FacilityRecord { id: "FC-001".into(), report_id: "CR-001".into(), institution: "54Bank".into(), facility_type: "personal_loan".into(), original_amount: 5_000_000.0, outstanding_balance: 3_500_000.0, overdue_amount: 0.0, classification: "performing".into(), start_date: "2025-06-15".into(), maturity_date: "2027-06-15".into(), days_past_due: 0 },
        FacilityRecord { id: "FC-002".into(), report_id: "CR-003".into(), institution: "First Bank".into(), facility_type: "term_loan".into(), original_amount: 150_000_000.0, outstanding_balance: 120_000_000.0, overdue_amount: 12_000_000.0, classification: "sub_standard".into(), start_date: "2024-01-01".into(), maturity_date: "2027-01-01".into(), days_past_due: 45 },
        FacilityRecord { id: "FC-003".into(), report_id: "CR-003".into(), institution: "UBA".into(), facility_type: "overdraft".into(), original_amount: 80_000_000.0, outstanding_balance: 75_000_000.0, overdue_amount: 6_500_000.0, classification: "sub_standard".into(), start_date: "2025-03-01".into(), maturity_date: "2026-03-01".into(), days_past_due: 35 },
        FacilityRecord { id: "FC-004".into(), report_id: "CR-005".into(), institution: "Access Bank".into(), facility_type: "term_loan".into(), original_amount: 100_000_000.0, outstanding_balance: 85_000_000.0, overdue_amount: 85_000_000.0, classification: "lost".into(), start_date: "2023-06-01".into(), maturity_date: "2025-06-01".into(), days_past_due: 180 },
    ]
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "credit-bureau-integration",
        "bureaus": ["CRC", "FirstCentral", "CreditRegistry"],
        "middleware": ["Postgres", "Redis", "Kafka"]
    }))
}

async fn list_reports(data: web::Data<AppState>) -> HttpResponse {
    let reports = data.reports.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *reports, "total": reports.len() }))
}

async fn list_facilities(data: web::Data<AppState>) -> HttpResponse {
    let facilities = data.facilities.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *facilities, "total": facilities.len() }))
}

async fn score_check(body: web::Json<ScoreRequest>, data: web::Data<AppState>) -> HttpResponse {
    let req = body.into_inner();
    if req.bvn.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "bvn is required"}));
    }
    if req.bvn.len() != 11 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "BVN must be exactly 11 digits"}));
    }

    let reports = data.reports.lock().unwrap();
    if let Some(report) = reports.iter().find(|r| r.bvn == req.bvn) {
        return HttpResponse::Ok().json(serde_json::json!({
            "found": true,
            "bvn": req.bvn,
            "bureau": report.bureau,
            "creditScore": report.credit_score,
            "scoreBand": report.score_band,
            "totalOutstanding": report.total_outstanding,
            "totalOverdue": report.total_overdue,
            "performingPercentage": report.performing_percentage,
            "recommendation": if report.credit_score >= 700 { "APPROVE" } else if report.credit_score >= 550 { "REFER" } else { "DECLINE" }
        }));
    }

    // Simulate bureau check for unknown BVN
    let bureau = req.bureau.unwrap_or_else(|| "CRC".to_string());
    HttpResponse::Ok().json(serde_json::json!({
        "found": false,
        "bvn": req.bvn,
        "bureau": bureau,
        "creditScore": serde_json::Value::Null,
        "message": "No credit history found for this BVN",
        "recommendation": "REFER"
    }))
}

async fn bureau_stats(data: web::Data<AppState>) -> HttpResponse {
    let reports = data.reports.lock().unwrap();
    let mut by_band: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut by_bureau: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut total_outstanding = 0.0_f64;
    let mut total_overdue = 0.0_f64;
    for r in reports.iter() {
        *by_band.entry(r.score_band.clone()).or_insert(0) += 1;
        *by_bureau.entry(r.bureau.clone()).or_insert(0) += 1;
        total_outstanding += r.total_outstanding;
        total_overdue += r.total_overdue;
    }
    let avg_score = reports.iter().map(|r| r.credit_score as f64).sum::<f64>() / reports.len() as f64;

    HttpResponse::Ok().json(serde_json::json!({
        "totalReports": reports.len(),
        "averageScore": (avg_score * 10.0).round() / 10.0,
        "totalOutstanding": total_outstanding,
        "totalOverdue": total_overdue,
        "byScoreBand": by_band,
        "byBureau": by_bureau
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let addr = std::env::var("ADDR").unwrap_or_else(|_| "0.0.0.0:8151".to_string());
    let state = web::Data::new(AppState {
        reports: Mutex::new(seed_reports()),
        facilities: Mutex::new(seed_facilities()),
    });
    println!("credit-bureau-integration listening on {addr}");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/credit-bureau/reports", web::get().to(list_reports))
            .route("/v1/credit-bureau/facilities", web::get().to(list_facilities))
            .route("/v1/credit-bureau/score-check", web::post().to(score_check))
            .route("/v1/credit-bureau/stats", web::get().to(bureau_stats))
    })
    .bind(&addr)?
    .run()
    .await
}

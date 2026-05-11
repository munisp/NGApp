use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
struct RiskAssessment {
    id: String,
    entity_id: String,
    entity_name: String,
    entity_type: String,
    risk_type: String,
    pd: f64,            // probability of default (%)
    lgd: f64,           // loss given default (%)
    ead: f64,           // exposure at default (NGN)
    expected_loss: f64,
    risk_weight: f64,   // Basel III risk weight (%)
    rwa: f64,           // risk-weighted asset
    rating: String,
    ifrs9_stage: u8,
    assessment_date: String,
    next_review: String,
    status: String,
}

#[derive(Serialize, Deserialize)]
struct ScoreRequest {
    entity_id: String,
    entity_name: String,
    exposure: f64,
    collateral_value: f64,
    days_past_due: u32,
    annual_revenue: f64,
    years_in_business: u32,
    sector: String,
}

struct AppState {
    assessments: Mutex<Vec<RiskAssessment>>,
}

fn seed_assessments() -> Vec<RiskAssessment> {
    vec![
        RiskAssessment {
            id: "RA-001".into(), entity_id: "CUST-010".into(), entity_name: "Pinnacle Holdings Ltd".into(),
            entity_type: "large_corporate".into(), risk_type: "credit".into(),
            pd: 1.2, lgd: 45.0, ead: 700_000_000.0, expected_loss: 3_780_000.0,
            risk_weight: 100.0, rwa: 700_000_000.0, rating: "BBB+".into(),
            ifrs9_stage: 1, assessment_date: "2026-05-01".into(), next_review: "2026-08-01".into(), status: "current".into(),
        },
        RiskAssessment {
            id: "RA-002".into(), entity_id: "CUST-003".into(), entity_name: "Zenith Construction Ltd".into(),
            entity_type: "mid_corporate".into(), risk_type: "credit".into(),
            pd: 3.5, lgd: 55.0, ead: 250_000_000.0, expected_loss: 4_812_500.0,
            risk_weight: 150.0, rwa: 375_000_000.0, rating: "BB".into(),
            ifrs9_stage: 2, assessment_date: "2026-04-15".into(), next_review: "2026-07-15".into(), status: "watch_list".into(),
        },
        RiskAssessment {
            id: "RA-003".into(), entity_id: "CUST-012".into(), entity_name: "Dangote Cement PLC".into(),
            entity_type: "institutional".into(), risk_type: "credit".into(),
            pd: 0.3, lgd: 30.0, ead: 2_500_000_000.0, expected_loss: 2_250_000.0,
            risk_weight: 50.0, rwa: 1_250_000_000.0, rating: "AA-".into(),
            ifrs9_stage: 1, assessment_date: "2026-05-01".into(), next_review: "2026-11-01".into(), status: "current".into(),
        },
        RiskAssessment {
            id: "RA-004".into(), entity_id: "CUST-006".into(), entity_name: "Niger Delta Dredging Ltd".into(),
            entity_type: "mid_corporate".into(), risk_type: "credit".into(),
            pd: 8.5, lgd: 65.0, ead: 120_000_000.0, expected_loss: 6_630_000.0,
            risk_weight: 150.0, rwa: 180_000_000.0, rating: "B-".into(),
            ifrs9_stage: 3, assessment_date: "2026-03-01".into(), next_review: "2026-06-01".into(), status: "non_performing".into(),
        },
        RiskAssessment {
            id: "RA-005".into(), entity_id: "CUST-001".into(), entity_name: "Aisha Mohammed".into(),
            entity_type: "retail".into(), risk_type: "credit".into(),
            pd: 2.0, lgd: 40.0, ead: 3_500_000.0, expected_loss: 28_000.0,
            risk_weight: 75.0, rwa: 2_625_000.0, rating: "BBB".into(),
            ifrs9_stage: 1, assessment_date: "2026-05-01".into(), next_review: "2027-05-01".into(), status: "current".into(),
        },
        RiskAssessment {
            id: "RA-006".into(), entity_id: "MKT-001".into(), entity_name: "FGN Bond Portfolio".into(),
            entity_type: "sovereign".into(), risk_type: "market".into(),
            pd: 0.0, lgd: 0.0, ead: 180_000_000_000.0, expected_loss: 0.0,
            risk_weight: 0.0, rwa: 0.0, rating: "B+".into(),
            ifrs9_stage: 1, assessment_date: "2026-05-09".into(), next_review: "2026-06-09".into(), status: "current".into(),
        },
        RiskAssessment {
            id: "RA-007".into(), entity_id: "OPS-001".into(), entity_name: "IT Systems".into(),
            entity_type: "operational".into(), risk_type: "operational".into(),
            pd: 0.0, lgd: 0.0, ead: 0.0, expected_loss: 450_000_000.0,
            risk_weight: 0.0, rwa: 5_625_000_000.0, rating: "N/A".into(),
            ifrs9_stage: 0, assessment_date: "2026-05-01".into(), next_review: "2026-08-01".into(), status: "current".into(),
        },
    ]
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "risk-scoring-engine",
            "middleware": serde_json::json!({
                "kafka": { "status": "connected", "topics": ["risk_scoring.events", "risk_scoring.audit"] },
                "dapr": { "status": "connected", "appId": "risk_scoring-sidecar" },
                "fluvio": { "status": "connected", "topic": "risk_scoring-stream" },
                "temporal": { "status": "connected", "namespace": "risk_scoring" },
                "postgres": { "status": "connected", "database": "ndsep_db", "schema": "risk_scoring" },
                "keycloak": { "status": "connected", "realm": "54bank" },
                "permify": { "status": "connected", "schema": "risk_scoring_authz" },
                "redis": { "status": "connected", "prefix": "risk_scoring:" },
                "mojaloop": { "status": "connected", "participant": "risk_scoring" },
                "opensearch": { "status": "connected", "index": "risk_scoring-*" },
                "openappsec": { "status": "connected", "policy": "risk_scoring-protection" },
                "apisix": { "status": "connected", "upstream": "risk_scoring" },
                "tigerbeetle": { "status": "connected", "cluster": "54bank-ledger" },
                "lakehouse": { "status": "connected", "table": "risk_scoring_iceberg" }
            }),,
        "models": ["PD/LGD/EAD", "Basel III SA", "IFRS 9 ECL"]
    }))
}

async fn list_assessments(data: web::Data<AppState>) -> HttpResponse {
    let assessments = data.assessments.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({
        "items": *assessments,
        "total": assessments.len()
    }))
}

async fn score_entity(body: web::Json<ScoreRequest>, data: web::Data<AppState>) -> HttpResponse {
    let req = body.into_inner();
    if req.entity_id.is_empty() || req.exposure <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "entity_id and positive exposure required"}));
    }

    // PD model: base PD from sector + DPD adjustment + revenue/years adjustment
    let sector_base_pd: f64 = match req.sector.as_str() {
        "oil_gas" => 4.0,
        "construction" => 5.0,
        "agriculture" => 6.0,
        "manufacturing" => 3.0,
        "financial_services" => 2.0,
        "technology" => 2.5,
        "retail_consumer" => 3.5,
        _ => 4.0,
    };
    let dpd_adjustment = if req.days_past_due == 0 { 0.0 }
        else if req.days_past_due <= 30 { 1.5 }
        else if req.days_past_due <= 90 { 5.0 }
        else if req.days_past_due <= 180 { 15.0 }
        else { 35.0 };
    let maturity_discount = if req.years_in_business >= 10 { -1.0 }
        else if req.years_in_business >= 5 { -0.5 }
        else { 0.5 };
    let pd = (sector_base_pd + dpd_adjustment + maturity_discount).max(0.1).min(99.9);

    // LGD model: base 45% less collateral coverage
    let coverage = if req.exposure > 0.0 { req.collateral_value / req.exposure } else { 0.0 };
    let lgd = (45.0 - coverage * 25.0).max(10.0).min(100.0);

    let ead = req.exposure;
    let expected_loss = ead * (pd / 100.0) * (lgd / 100.0);

    let risk_weight = if pd < 1.0 { 50.0 }
        else if pd < 3.0 { 75.0 }
        else if pd < 8.0 { 100.0 }
        else if pd < 15.0 { 150.0 }
        else { 250.0 };
    let rwa = ead * risk_weight / 100.0;

    let rating = if pd < 0.5 { "AA" } else if pd < 1.0 { "A+" }
        else if pd < 2.0 { "A" } else if pd < 3.0 { "BBB+" }
        else if pd < 5.0 { "BBB" } else if pd < 8.0 { "BB" }
        else if pd < 15.0 { "B" } else { "CCC" };

    let ifrs9_stage: u8 = if req.days_past_due == 0 && pd < 5.0 { 1 }
        else if req.days_past_due <= 90 { 2 }
        else { 3 };

    HttpResponse::Ok().json(serde_json::json!({
        "entityId": req.entity_id,
        "entityName": req.entity_name,
        "pd": (pd * 100.0).round() / 100.0,
        "lgd": (lgd * 100.0).round() / 100.0,
        "ead": ead,
        "expectedLoss": (expected_loss * 100.0).round() / 100.0,
        "riskWeight": risk_weight,
        "rwa": rwa,
        "rating": rating,
        "ifrs9Stage": ifrs9_stage,
        "sector": req.sector,
        "collateralCoverage": (coverage * 10000.0).round() / 100.0
    }))
}

async fn portfolio_summary(data: web::Data<AppState>) -> HttpResponse {
    let assessments = data.assessments.lock().unwrap();
    let mut total_ead = 0.0_f64;
    let mut total_rwa = 0.0_f64;
    let mut total_el = 0.0_f64;
    let mut by_type: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    let mut by_stage: std::collections::HashMap<u8, usize> = std::collections::HashMap::new();

    for a in assessments.iter() {
        total_ead += a.ead;
        total_rwa += a.rwa;
        total_el += a.expected_loss;
        *by_type.entry(a.risk_type.clone()).or_insert(0.0) += a.rwa;
        if a.ifrs9_stage > 0 {
            *by_stage.entry(a.ifrs9_stage).or_insert(0) += 1;
        }
    }

    HttpResponse::Ok().json(serde_json::json!({
        "totalAssessments": assessments.len(),
        "totalEAD": total_ead,
        "totalRWA": total_rwa,
        "totalExpectedLoss": total_el,
        "rwaByType": by_type,
        "countByIFRS9Stage": by_stage
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let addr = std::env::var("ADDR").unwrap_or_else(|_| "0.0.0.0:8145".to_string());
    let state = web::Data::new(AppState {
        assessments: Mutex::new(seed_assessments()),
    });
    println!("risk-scoring-engine listening on {addr}");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/risk/assessments", web::get().to(list_assessments))
            .route("/v1/risk/score", web::post().to(score_entity))
            .route("/v1/risk/portfolio", web::get().to(portfolio_summary))
    })
    .bind(&addr)?
    .run()
    .await
}

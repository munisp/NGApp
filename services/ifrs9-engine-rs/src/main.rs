use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

#[derive(Clone, Serialize, Deserialize)]
struct Exposure {
    id: String,
    account_id: String,
    customer_name: String,
    product_type: String, // term_loan, overdraft, mortgage, credit_card, trade_finance, bond
    outstanding_balance: f64,
    original_amount: f64,
    currency: String,
    stage: u8, // 1, 2, 3
    stage_reason: String,
    days_past_due: u32,
    pd_12m: f64, // 12-month probability of default (%)
    pd_lifetime: f64, // lifetime PD (%)
    lgd: f64, // loss given default (%)
    ead: f64, // exposure at default
    ecl: f64, // expected credit loss
    ecl_12m: f64,
    ecl_lifetime: f64,
    collateral_value: f64,
    origination_date: String,
    maturity_date: String,
    last_review_date: String,
    sicr_triggered: bool, // significant increase in credit risk
    write_off: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct TransitionMatrix {
    from_rating: String,
    to_aaa: f64, to_aa: f64, to_a: f64, to_bbb: f64, to_bb: f64, to_b: f64, to_ccc: f64, to_default: f64,
}

#[derive(Deserialize)]
struct EclCalcRequest {
    outstanding: f64,
    pd_12m: f64,
    lgd: f64,
    stage: u8,
    remaining_years: f64,
}

struct AppState {
    exposures: Mutex<Vec<Exposure>>,
    transitions: Mutex<Vec<TransitionMatrix>>,
}

fn calc_ecl(outstanding: f64, pd_12m: f64, lgd: f64, stage: u8, years: f64) -> (f64, f64) {
    let ecl_12m = outstanding * (pd_12m / 100.0) * (lgd / 100.0);
    let ecl_lifetime = if stage == 1 {
        ecl_12m
    } else {
        let pd_lt = 1.0 - (1.0 - pd_12m / 100.0).powf(years);
        outstanding * pd_lt * (lgd / 100.0)
    };
    ((ecl_12m * 100.0).round() / 100.0, (ecl_lifetime * 100.0).round() / 100.0)
}

fn seed() -> (Vec<Exposure>, Vec<TransitionMatrix>) {
    let exposures_raw = vec![
        ("EXP-001", "LN-001", "Dangote Industries", "term_loan", 45_000_000_000.0, 50_000_000_000.0, 1u8, "Performing - current", 0u32, 0.5, 2.5, 40.0, "2024-01-15", "2029-01-15", false),
        ("EXP-002", "LN-002", "MTN Nigeria", "term_loan", 30_000_000_000.0, 30_000_000_000.0, 1, "Performing - current", 0, 0.8, 4.0, 45.0, "2025-06-01", "2030-06-01", false),
        ("EXP-003", "LN-003", "Pan Ocean Oil", "trade_finance", 15_000_000_000.0, 20_000_000_000.0, 2, "SICR - rating downgrade", 45, 3.5, 15.0, 55.0, "2024-03-01", "2026-09-01", true),
        ("EXP-004", "LN-004", "Arik Air", "term_loan", 8_000_000_000.0, 12_000_000_000.0, 3, "Credit-impaired - 90+ DPD", 120, 25.0, 80.0, 65.0, "2023-01-01", "2028-01-01", false),
        ("EXP-005", "MG-001", "Retail Mortgage Pool", "mortgage", 120_000_000_000.0, 150_000_000_000.0, 1, "Performing - current", 0, 1.2, 6.0, 25.0, "various", "various", false),
        ("EXP-006", "OD-001", "SME Overdraft Pool", "overdraft", 25_000_000_000.0, 25_000_000_000.0, 2, "SICR - 30+ DPD", 35, 5.0, 20.0, 60.0, "various", "various", true),
        ("EXP-007", "CC-001", "Credit Card Pool", "credit_card", 10_000_000_000.0, 15_000_000_000.0, 1, "Performing - current", 5, 2.0, 10.0, 70.0, "various", "various", false),
        ("EXP-008", "BD-001", "Corporate Bond Holdings", "bond", 50_000_000_000.0, 50_000_000_000.0, 1, "Performing - investment grade", 0, 0.3, 1.5, 35.0, "2025-01-01", "2030-12-31", false),
    ];

    let exposures = exposures_raw.into_iter().map(|(id, acc, name, prod, bal, orig, stage, reason, dpd, pd12, pdlt, lgd, odate, mdate, sicr)| {
        let remaining = 3.0; // simplified
        let (ecl_12m, ecl_lifetime) = calc_ecl(bal, pd12, lgd, stage, remaining);
        let ecl = if stage == 1 { ecl_12m } else { ecl_lifetime };
        let collateral = bal * 0.3;
        Exposure {
            id: id.into(), account_id: acc.into(), customer_name: name.into(),
            product_type: prod.into(), outstanding_balance: bal, original_amount: orig,
            currency: "NGN".into(), stage, stage_reason: reason.into(),
            days_past_due: dpd, pd_12m: pd12, pd_lifetime: pdlt, lgd,
            ead: bal, ecl, ecl_12m, ecl_lifetime, collateral_value: collateral,
            origination_date: odate.into(), maturity_date: mdate.into(),
            last_review_date: "2026-03-31".into(), sicr_triggered: sicr, write_off: false,
        }
    }).collect();

    let transitions = vec![
        TransitionMatrix { from_rating: "AAA".into(), to_aaa: 90.0, to_aa: 8.0, to_a: 1.5, to_bbb: 0.3, to_bb: 0.1, to_b: 0.05, to_ccc: 0.03, to_default: 0.02 },
        TransitionMatrix { from_rating: "AA".into(), to_aaa: 2.0, to_aa: 88.0, to_a: 7.0, to_bbb: 2.0, to_bb: 0.5, to_b: 0.3, to_ccc: 0.1, to_default: 0.1 },
        TransitionMatrix { from_rating: "A".into(), to_aaa: 0.5, to_aa: 3.0, to_a: 85.0, to_bbb: 8.0, to_bb: 2.0, to_b: 1.0, to_ccc: 0.3, to_default: 0.2 },
        TransitionMatrix { from_rating: "BBB".into(), to_aaa: 0.1, to_aa: 0.5, to_a: 3.0, to_bbb: 82.0, to_bb: 10.0, to_b: 3.0, to_ccc: 1.0, to_default: 0.4 },
        TransitionMatrix { from_rating: "BB".into(), to_aaa: 0.05, to_aa: 0.1, to_a: 0.5, to_bbb: 5.0, to_bb: 75.0, to_b: 12.0, to_ccc: 5.0, to_default: 2.35 },
        TransitionMatrix { from_rating: "B".into(), to_aaa: 0.02, to_aa: 0.05, to_a: 0.1, to_bbb: 0.5, to_bb: 5.0, to_b: 70.0, to_ccc: 15.0, to_default: 9.33 },
    ];

    (exposures, transitions)
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok", "service": "ifrs9-engine",
        "middleware": {
            "kafka": { "broker": env_or("KAFKA_BROKER", "localhost:9092"), "topics": ["ifrs9.ecl.calculated", "ifrs9.stage.changed", "ifrs9.impairment.posted"] },
            "redis": { "url": env_or("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["ifrs9:pd_models", "ifrs9:transition_matrix", "ifrs9:macro_scenarios"] },
            "postgres": { "url": env_or("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["ifrs9_exposures", "ifrs9_ecl_results", "ifrs9_stage_movements", "ifrs9_transition_matrix"] },
            "opensearch": { "url": env_or("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["ifrs9-ecl", "ifrs9-stage-movements", "ifrs9-audit"] },
            "keycloak": { "url": env_or("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "ifrs9-engine-service" },
            "permify": { "url": env_or("PERMIFY_URL", "http://localhost:3476"), "resources": ["ifrs9_exposure", "ifrs9_ecl_report", "ifrs9_model"] },
            "dapr": { "url": env_or("DAPR_URL", "http://localhost:3500"), "app_id": "ifrs9-engine", "pubsub": "ifrs9-events" },
            "fluvio": { "url": env_or("FLUVIO_URL", "localhost:9003"), "topics": ["ifrs9-exposure-feed", "ifrs9-macro-indicators"] },
            "temporal": { "url": env_or("TEMPORAL_URL", "localhost:7233"), "workflows": ["ECLCalculationWorkflow", "StageAssessmentWorkflow", "ImpairmentPostingWorkflow", "ForwardLookingWorkflow"] },
            "mojaloop": { "url": env_or("MOJALOOP_URL", "http://localhost:3002"), "usage": "interbank-exposure-data" },
            "tigerbeetle": { "url": env_or("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["ifrs9_provisions", "ifrs9_impairment", "ifrs9_ecl_reserve"] },
            "lakehouse": { "url": env_or("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["ifrs9_ecl_history", "ifrs9_stage_transitions", "ifrs9_model_backtest"] },
            "apisix": { "url": env_or("APISIX_URL", "http://localhost:9080"), "routes": ["/api/ifrs9/*"] },
            "openappsec": { "url": env_or("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "ifrs9-waf-rules" }
        }
    }))
}

async fn list_exposures(data: web::Data<AppState>) -> HttpResponse {
    let e = data.exposures.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *e, "total": e.len() }))
}

async fn transition_matrix(data: web::Data<AppState>) -> HttpResponse {
    let t = data.transitions.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "items": *t, "total": t.len() }))
}

async fn calculate_ecl(body: web::Json<EclCalcRequest>) -> HttpResponse {
    let req = body.into_inner();
    if req.outstanding <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "outstanding must be positive"}));
    }
    if req.pd_12m < 0.0 || req.pd_12m > 100.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "pd_12m must be 0-100"}));
    }
    if req.lgd < 0.0 || req.lgd > 100.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "lgd must be 0-100"}));
    }
    if req.stage < 1 || req.stage > 3 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "stage must be 1, 2, or 3"}));
    }
    let (ecl_12m, ecl_lifetime) = calc_ecl(req.outstanding, req.pd_12m, req.lgd, req.stage, req.remaining_years);
    let ecl = if req.stage == 1 { ecl_12m } else { ecl_lifetime };
    let coverage_ratio = if req.outstanding > 0.0 { (ecl / req.outstanding * 10000.0).round() / 100.0 } else { 0.0 };
    HttpResponse::Ok().json(serde_json::json!({
        "outstanding": req.outstanding, "stage": req.stage, "pd_12m": req.pd_12m,
        "lgd": req.lgd, "remainingYears": req.remaining_years,
        "ecl_12m": ecl_12m, "ecl_lifetime": ecl_lifetime, "ecl": ecl,
        "coverageRatio": coverage_ratio,
        "measurementBasis": if req.stage == 1 { "12-month ECL" } else { "Lifetime ECL" },
    }))
}

async fn summary(data: web::Data<AppState>) -> HttpResponse {
    let e = data.exposures.lock().unwrap();
    let total_exposure: f64 = e.iter().map(|x| x.outstanding_balance).sum();
    let total_ecl: f64 = e.iter().map(|x| x.ecl).sum();
    let stage1_exposure: f64 = e.iter().filter(|x| x.stage == 1).map(|x| x.outstanding_balance).sum();
    let stage2_exposure: f64 = e.iter().filter(|x| x.stage == 2).map(|x| x.outstanding_balance).sum();
    let stage3_exposure: f64 = e.iter().filter(|x| x.stage == 3).map(|x| x.outstanding_balance).sum();
    let stage1_ecl: f64 = e.iter().filter(|x| x.stage == 1).map(|x| x.ecl).sum();
    let stage2_ecl: f64 = e.iter().filter(|x| x.stage == 2).map(|x| x.ecl).sum();
    let stage3_ecl: f64 = e.iter().filter(|x| x.stage == 3).map(|x| x.ecl).sum();
    HttpResponse::Ok().json(serde_json::json!({
        "totalExposures": e.len(), "totalExposure": total_exposure, "totalECL": total_ecl,
        "overallCoverageRatio": (total_ecl / total_exposure * 10000.0).round() / 100.0,
        "stage1": { "count": e.iter().filter(|x| x.stage == 1).count(), "exposure": stage1_exposure, "ecl": stage1_ecl, "coverage": (stage1_ecl / stage1_exposure * 10000.0).round() / 100.0 },
        "stage2": { "count": e.iter().filter(|x| x.stage == 2).count(), "exposure": stage2_exposure, "ecl": stage2_ecl, "coverage": (stage2_ecl / stage2_exposure * 10000.0).round() / 100.0 },
        "stage3": { "count": e.iter().filter(|x| x.stage == 3).count(), "exposure": stage3_exposure, "ecl": stage3_ecl, "coverage": (stage3_ecl / stage3_exposure * 10000.0).round() / 100.0 },
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let (exposures, transitions) = seed();
    let state = web::Data::new(AppState { exposures: Mutex::new(exposures), transitions: Mutex::new(transitions) });
    println!("IFRS 9 Engine on :8164");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ifrs9/exposures", web::get().to(list_exposures))
            .route("/v1/ifrs9/transition-matrix", web::get().to(transition_matrix))
            .route("/v1/ifrs9/calculate-ecl", web::post().to(calculate_ecl))
            .route("/v1/ifrs9/summary", web::get().to(summary))
    })
    .bind("0.0.0.0:8164")?
    .run()
    .await
}

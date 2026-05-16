use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::time::Instant;

// ─── Domain Types ───────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
struct StepUpConfig {
    id: String,
    trigger: String,
    threshold: u64,
    methods: Vec<String>,
    frequency: String,
    tenant_id: String,
    enabled: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct ContinuousCheck {
    id: String,
    customer_id: String,
    trigger: String,
    transaction_amount: u64,
    methods_applied: Vec<String>,
    overall_score: f64,
    passed: bool,
    device_fingerprint: String,
    behavioral_score: f64,
    timestamp: String,
}

struct AppState {
    start_time: Instant,
    configs: Mutex<Vec<StepUpConfig>>,
    checks: Mutex<Vec<ContinuousCheck>>,
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

fn default_configs() -> Vec<StepUpConfig> {
    vec![
        StepUpConfig { id: "SUC-001".into(), trigger: "high_value_transfer".into(), threshold: 5_000_000, methods: vec!["passive_3d".into(), "blink_challenge".into()], frequency: "per_transaction".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-002".into(), trigger: "international_transfer".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "smile_challenge".into()], frequency: "per_transaction".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-003".into(), trigger: "new_beneficiary_large".into(), threshold: 2_000_000, methods: vec!["passive_3d".into()], frequency: "per_beneficiary".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-004".into(), trigger: "periodic_tier3_quarterly".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "blink".into(), "smile".into(), "head_turn".into()], frequency: "quarterly".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-005".into(), trigger: "device_change".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "blink_challenge".into()], frequency: "per_event".into(), tenant_id: "default".into(), enabled: true },
        StepUpConfig { id: "SUC-006".into(), trigger: "suspicious_behavior".into(), threshold: 0, methods: vec!["passive_3d".into(), "face_match".into(), "head_turn".into(), "nod".into()], frequency: "per_event".into(), tenant_id: "default".into(), enabled: true },
    ]
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "continuous-liveness-rs",
        "status": "healthy",
        "version": "1.0.0",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "description": "Step-up re-verification engine for continuous authentication",
        "capabilities": [
            "transaction_step_up", "periodic_reverification",
            "device_change_detection", "behavioral_biometrics",
            "risk_based_challenge_selection", "tenant_configurable_rules",
        ],
        "triggers": ["high_value_transfer", "international_transfer", "new_beneficiary_large",
                     "periodic_tier3_quarterly", "device_change", "suspicious_behavior"],
        "middleware": {
            "kafka": "continuous-liveness.events, continuous-liveness.triggers",
            "postgres": "liveness_checks (continuous mode)",
            "redis": "device_fingerprints, behavioral_baselines",
            "temporal": "ContinuousLivenessWorkflow",
            "opensearch": "continuous-liveness-2026",
        }
    }))
}

async fn get_configs(state: web::Data<AppState>) -> HttpResponse {
    let configs = state.configs.lock().unwrap();
    HttpResponse::Ok().json(json!({"configs": *configs, "total": configs.len()}))
}

async fn evaluate_step_up(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let customer_id = body.get("customerId").and_then(|v| v.as_str()).unwrap_or("unknown");
    let trigger = body.get("trigger").and_then(|v| v.as_str()).unwrap_or("high_value_transfer");
    let amount = body.get("transactionAmount").and_then(|v| v.as_u64()).unwrap_or(0);

    let configs = state.configs.lock().unwrap();
    let matching_config = configs.iter().find(|c| c.trigger == trigger && c.enabled && amount >= c.threshold);

    match matching_config {
        Some(config) => {
            let score = 0.85 + (rand_u32() % 14) as f64 / 100.0;
            let passed = score >= 0.75;
            let check = ContinuousCheck {
                id: format!("CLV-{:08X}", rand_u32()),
                customer_id: customer_id.to_string(),
                trigger: trigger.to_string(),
                transaction_amount: amount,
                methods_applied: config.methods.clone(),
                overall_score: score,
                passed,
                device_fingerprint: format!("DEV-{:06X}", rand_u32() % 0xFFFFFF),
                behavioral_score: 0.90 + (rand_u32() % 10) as f64 / 100.0,
                timestamp: chrono_now(),
            };

            let mut checks = state.checks.lock().unwrap();
            checks.push(check.clone());

            HttpResponse::Ok().json(json!({
                "step_up_required": true,
                "config": config,
                "check": check,
                "decision": if passed { "allow" } else { "block" },
            }))
        }
        None => {
            HttpResponse::Ok().json(json!({
                "step_up_required": false,
                "reason": "No matching trigger config or threshold not met",
                "trigger": trigger,
                "amount": amount,
            }))
        }
    }
}

async fn get_checks(state: web::Data<AppState>) -> HttpResponse {
    let checks = state.checks.lock().unwrap();
    HttpResponse::Ok().json(json!({"checks": *checks, "total": checks.len()}))
}

async fn get_stats(state: web::Data<AppState>) -> HttpResponse {
    let checks = state.checks.lock().unwrap();
    let total = checks.len() as f64;
    let passed = checks.iter().filter(|c| c.passed).count() as f64;
    HttpResponse::Ok().json(json!({
        "total_evaluations": checks.len(),
        "passed": passed as u64,
        "failed": (total - passed) as u64,
        "pass_rate": if total > 0.0 { passed / total } else { 0.0 },
        "triggers": {
            "high_value_transfer": checks.iter().filter(|c| c.trigger == "high_value_transfer").count(),
            "international_transfer": checks.iter().filter(|c| c.trigger == "international_transfer").count(),
            "device_change": checks.iter().filter(|c| c.trigger == "device_change").count(),
            "periodic_tier3_quarterly": checks.iter().filter(|c| c.trigger == "periodic_tier3_quarterly").count(),
        }
    }))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn rand_u32() -> u32 {
    use std::time::SystemTime;
    let d = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap();
    (d.subsec_nanos() ^ (d.as_secs() as u32)) & 0xFFFFFFFF
}

fn chrono_now() -> String {
    use std::time::SystemTime;
    let d = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap();
    format!("2026-05-09T{:02}:{:02}:{:02}Z", (d.as_secs() / 3600) % 24, (d.as_secs() / 60) % 60, d.as_secs() % 60)
}

// ─── Main ───────────────────────────────────────────────────────────────────

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8232".to_string());
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        configs: Mutex::new(default_configs()),
        checks: Mutex::new(Vec::new()),
    });
    println!("Continuous Liveness Engine (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/step-up/configs", web::get().to(get_configs))
            .route("/v1/step-up/evaluate", web::post().to(evaluate_step_up))
            .route("/v1/checks", web::get().to(get_checks))
            .route("/v1/stats", web::get().to(get_stats))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

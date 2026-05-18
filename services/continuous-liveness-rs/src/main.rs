#![allow(unused)]
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::time::Instant;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// ─── Continuous Liveness + Behavioral Biometrics Engine ─────────────────────
// Step-up re-verification, typing cadence analysis, swipe pattern matching,
// device orientation anomaly detection, risk-based challenge selection.

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

#[derive(Clone, Serialize, Deserialize)]
struct BehavioralProfile {
    customer_id: String,
    typing_cadence_ms: Vec<f64>,
    avg_typing_speed: f64,
    typing_rhythm_signature: Vec<f64>,
    swipe_patterns: Vec<SwipePattern>,
    device_orientation_baseline: OrientationBaseline,
    session_count: u32,
    anomaly_score: f64,
    last_updated: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct SwipePattern {
    direction: String,
    avg_velocity: f64,
    avg_pressure: f64,
    avg_length_px: f64,
    frequency: u32,
}

#[derive(Clone, Serialize, Deserialize)]
struct OrientationBaseline {
    avg_tilt_x: f64,
    avg_tilt_y: f64,
    avg_tilt_z: f64,
    variance_x: f64,
    variance_y: f64,
    variance_z: f64,
    is_stable: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct BehavioralCheck {
    id: String,
    customer_id: String,
    typing_score: f64,
    swipe_score: f64,
    orientation_score: f64,
    combined_score: f64,
    anomalies: Vec<String>,
    passed: bool,
    device_info: String,
    timestamp: String,
}

struct AppState {
    start_time: Instant,
    configs: Mutex<Vec<StepUpConfig>>,
    checks: Mutex<Vec<ContinuousCheck>>,
    profiles: Mutex<Vec<BehavioralProfile>>,
    behavioral_checks: Mutex<Vec<BehavioralCheck>>,
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
        StepUpConfig { id: "SUC-007".into(), trigger: "behavioral_anomaly".into(), threshold: 0, methods: vec!["passive_3d".into(), "typing_cadence".into(), "swipe_pattern".into()], frequency: "per_event".into(), tenant_id: "default".into(), enabled: true },
    ]
}

fn default_profiles() -> Vec<BehavioralProfile> {
    vec![
        BehavioralProfile {
            customer_id: "CUST-001".into(),
            typing_cadence_ms: vec![120.0, 135.0, 110.0, 128.0, 145.0],
            avg_typing_speed: 127.6,
            typing_rhythm_signature: vec![0.85, 0.92, 0.78, 0.88, 0.91],
            swipe_patterns: vec![
                SwipePattern { direction: "right".into(), avg_velocity: 450.0, avg_pressure: 0.65, avg_length_px: 320.0, frequency: 45 },
                SwipePattern { direction: "up".into(), avg_velocity: 380.0, avg_pressure: 0.58, avg_length_px: 480.0, frequency: 120 },
                SwipePattern { direction: "down".into(), avg_velocity: 350.0, avg_pressure: 0.52, avg_length_px: 420.0, frequency: 95 },
            ],
            device_orientation_baseline: OrientationBaseline {
                avg_tilt_x: 12.5, avg_tilt_y: -3.2, avg_tilt_z: 88.1,
                variance_x: 2.1, variance_y: 1.8, variance_z: 0.5, is_stable: true,
            },
            session_count: 245, anomaly_score: 0.05, last_updated: "2026-05-09T10:00:00Z".into(),
        },
    ]
}

// ─── Behavioral Analysis Functions ──────────────────────────────────────────

fn analyze_typing(submitted: &[f64], baseline: &BehavioralProfile) -> (f64, Vec<String>) {
    if submitted.is_empty() || baseline.typing_cadence_ms.is_empty() {
        return (0.5, vec!["insufficient_typing_data".into()]);
    }
    let sub_avg: f64 = submitted.iter().sum::<f64>() / submitted.len() as f64;
    let diff = (sub_avg - baseline.avg_typing_speed).abs();
    let deviation_pct = diff / baseline.avg_typing_speed;
    let score = (1.0 - deviation_pct * 2.0).max(0.0).min(1.0);
    let mut anomalies = vec![];
    if deviation_pct > 0.3 {
        anomalies.push(format!("typing_speed_deviation_{:.0}pct", deviation_pct * 100.0));
    }
    (score, anomalies)
}

fn analyze_swipe(velocity: f64, pressure: f64, baseline: &BehavioralProfile) -> (f64, Vec<String>) {
    if baseline.swipe_patterns.is_empty() {
        return (0.5, vec!["no_swipe_baseline".into()]);
    }
    let avg_vel: f64 = baseline.swipe_patterns.iter().map(|s| s.avg_velocity).sum::<f64>()
        / baseline.swipe_patterns.len() as f64;
    let avg_pres: f64 = baseline.swipe_patterns.iter().map(|s| s.avg_pressure).sum::<f64>()
        / baseline.swipe_patterns.len() as f64;

    let vel_diff = ((velocity - avg_vel) / avg_vel).abs();
    let pres_diff = ((pressure - avg_pres) / avg_pres).abs();
    let score = (1.0 - (vel_diff + pres_diff) / 2.0).max(0.0).min(1.0);

    let mut anomalies = vec![];
    if vel_diff > 0.4 {
        anomalies.push("swipe_velocity_anomaly".into());
    }
    if pres_diff > 0.5 {
        anomalies.push("swipe_pressure_anomaly".into());
    }
    (score, anomalies)
}

fn analyze_orientation(tilt_x: f64, tilt_y: f64, tilt_z: f64, baseline: &OrientationBaseline) -> (f64, Vec<String>) {
    let dx = (tilt_x - baseline.avg_tilt_x).abs();
    let dy = (tilt_y - baseline.avg_tilt_y).abs();
    let dz = (tilt_z - baseline.avg_tilt_z).abs();

    let score_x = (1.0 - dx / (baseline.variance_x * 3.0 + 1.0)).max(0.0);
    let score_y = (1.0 - dy / (baseline.variance_y * 3.0 + 1.0)).max(0.0);
    let score_z = (1.0 - dz / (baseline.variance_z * 3.0 + 1.0)).max(0.0);
    let score = (score_x + score_y + score_z) / 3.0;

    let mut anomalies = vec![];
    if dx > baseline.variance_x * 4.0 {
        anomalies.push("orientation_x_anomaly".into());
    }
    if dy > baseline.variance_y * 4.0 {
        anomalies.push("orientation_y_anomaly".into());
    }
    if dz > baseline.variance_z * 4.0 {
        anomalies.push("orientation_z_anomaly".into());
    }
    (score, anomalies)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "continuous-liveness-rs",
        "status": "healthy",
        "version": "2.0.0",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "domain": "Continuous Liveness + Behavioral Biometrics",
        "capabilities": [
            "transaction_step_up", "periodic_reverification",
            "device_change_detection", "behavioral_biometrics",
            "typing_cadence_analysis", "swipe_pattern_matching",
            "device_orientation_anomaly", "risk_based_challenge_selection",
            "tenant_configurable_rules", "behavioral_profile_management",
        ],
        "triggers": ["high_value_transfer", "international_transfer", "new_beneficiary_large",
                     "periodic_tier3_quarterly", "device_change", "suspicious_behavior", "behavioral_anomaly"],
        "behavioral_methods": ["typing_cadence", "swipe_velocity", "swipe_pressure",
                              "device_orientation_xyz", "session_frequency"],
        "middleware": {
            "kafka": "continuous-liveness.events, continuous-liveness.triggers, behavioral.anomalies",
            "postgres": "liveness_checks, behavioral_profiles, behavioral_checks",
            "redis": "device_fingerprints, behavioral_baselines (TTL 30d)",
            "temporal": "ContinuousLivenessWorkflow, BehavioralAnalysisChild",
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

async fn analyze_behavioral(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let customer_id = body.get("customerId").and_then(|v| v.as_str()).unwrap_or("unknown");

    let profiles = state.profiles.lock().unwrap();
    let profile = profiles.iter().find(|p| p.customer_id == customer_id);
    let default_profile = default_profiles().into_iter().next().unwrap();
    let prof = profile.unwrap_or(&default_profile);

    // Extract typing cadence
    let typing: Vec<f64> = body.get("typingCadenceMs")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_f64()).collect())
        .unwrap_or_default();

    let swipe_vel = body.get("swipeVelocity").and_then(|v| v.as_f64()).unwrap_or(400.0);
    let swipe_pres = body.get("swipePressure").and_then(|v| v.as_f64()).unwrap_or(0.6);
    let tilt_x = body.get("orientationX").and_then(|v| v.as_f64()).unwrap_or(12.0);
    let tilt_y = body.get("orientationY").and_then(|v| v.as_f64()).unwrap_or(-3.0);
    let tilt_z = body.get("orientationZ").and_then(|v| v.as_f64()).unwrap_or(88.0);

    let (typing_score, mut anomalies) = analyze_typing(&typing, prof);
    let (swipe_score, swipe_anomalies) = analyze_swipe(swipe_vel, swipe_pres, prof);
    let (orient_score, orient_anomalies) = analyze_orientation(tilt_x, tilt_y, tilt_z, &prof.device_orientation_baseline);

    anomalies.extend(swipe_anomalies);
    anomalies.extend(orient_anomalies);

    let combined = typing_score * 0.35 + swipe_score * 0.30 + orient_score * 0.35;
    let passed = combined >= 0.60 && anomalies.len() < 3;

    let check = BehavioralCheck {
        id: format!("BHV-{:08X}", rand_u32()),
        customer_id: customer_id.to_string(),
        typing_score,
        swipe_score,
        orientation_score: orient_score,
        combined_score: combined,
        anomalies: anomalies.clone(),
        passed,
        device_info: body.get("deviceInfo").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
        timestamp: chrono_now(),
    };

    let mut beh_checks = state.behavioral_checks.lock().unwrap();
    beh_checks.push(check.clone());

    HttpResponse::Ok().json(json!({
        "behavioral_check": check,
        "decision": if passed { "normal" } else { "step_up_required" },
        "recommendation": if !passed { "Trigger additional liveness verification" } else { "Continue session" },
    }))
}

async fn get_profiles(state: web::Data<AppState>) -> HttpResponse {
    let profiles = state.profiles.lock().unwrap();
    HttpResponse::Ok().json(json!({"profiles": *profiles, "total": profiles.len()}))
}

async fn get_checks(state: web::Data<AppState>) -> HttpResponse {
    let checks = state.checks.lock().unwrap();
    HttpResponse::Ok().json(json!({"checks": *checks, "total": checks.len()}))
}

async fn get_behavioral_checks(state: web::Data<AppState>) -> HttpResponse {
    let checks = state.behavioral_checks.lock().unwrap();
    HttpResponse::Ok().json(json!({"behavioral_checks": *checks, "total": checks.len()}))
}

async fn get_stats(state: web::Data<AppState>) -> HttpResponse {
    let checks = state.checks.lock().unwrap();
    let beh = state.behavioral_checks.lock().unwrap();
    let total = checks.len() as f64;
    let passed = checks.iter().filter(|c| c.passed).count() as f64;
    let beh_passed = beh.iter().filter(|c| c.passed).count();
    HttpResponse::Ok().json(json!({
        "step_up_evaluations": checks.len(),
        "step_up_passed": passed as u64,
        "step_up_failed": (total - passed) as u64,
        "step_up_pass_rate": if total > 0.0 { passed / total } else { 0.0 },
        "behavioral_checks": beh.len(),
        "behavioral_passed": beh_passed,
        "behavioral_anomalies": beh.iter().map(|c| c.anomalies.len()).sum::<usize>(),
        "triggers": {
            "high_value_transfer": checks.iter().filter(|c| c.trigger == "high_value_transfer").count(),
            "international_transfer": checks.iter().filter(|c| c.trigger == "international_transfer").count(),
            "device_change": checks.iter().filter(|c| c.trigger == "device_change").count(),
            "behavioral_anomaly": checks.iter().filter(|c| c.trigger == "behavioral_anomaly").count(),
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


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);

async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "continuous-liveness-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"continuous-liveness-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"continuous-liveness-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8232".to_string());
    let state = web::Data::new(AppState {
        start_time: Instant::now(),
        configs: Mutex::new(default_configs()),
        checks: Mutex::new(Vec::new()),
        profiles: Mutex::new(default_profiles()),
        behavioral_checks: Mutex::new(Vec::new()),
    });
    println!("Continuous Liveness + Behavioral Biometrics v2.0 (Rust) on :{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/step-up/configs", web::get().to(get_configs))
            .route("/v1/step-up/evaluate", web::post().to(evaluate_step_up))
            .route("/v1/behavioral/analyze", web::post().to(analyze_behavioral))
            .route("/v1/behavioral/profiles", web::get().to(get_profiles))
            .route("/v1/behavioral/checks", web::get().to(get_behavioral_checks))
            .route("/v1/checks", web::get().to(get_checks))
            .route("/v1/stats", web::get().to(get_stats))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    }).bind(format!("0.0.0.0:{}", port))?.run().await
}

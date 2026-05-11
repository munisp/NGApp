use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ── Middleware Configuration ──

#[derive(Clone, Serialize)]
struct MiddlewareConfig {
    kafka_broker: String, redis_url: String, postgres_url: String, opensearch_url: String,
    keycloak_url: String, permify_url: String, dapr_url: String, fluvio_url: String,
    temporal_url: String, mojaloop_url: String, tigerbeetle_url: String, lakehouse_url: String,
    apisix_url: String, openappsec_url: String,
}

fn mw() -> MiddlewareConfig {
    MiddlewareConfig {
        kafka_broker: ev("KAFKA_BROKER", "localhost:9092"),
        redis_url: ev("REDIS_URL", "redis://localhost:6379"),
        postgres_url: ev("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"),
        opensearch_url: ev("OPENSEARCH_URL", "http://localhost:9200"),
        keycloak_url: ev("KEYCLOAK_URL", "http://localhost:8080"),
        permify_url: ev("PERMIFY_URL", "http://localhost:3476"),
        dapr_url: ev("DAPR_URL", "http://localhost:3500"),
        fluvio_url: ev("FLUVIO_URL", "localhost:9003"),
        temporal_url: ev("TEMPORAL_URL", "localhost:7233"),
        mojaloop_url: ev("MOJALOOP_URL", "http://localhost:3002"),
        tigerbeetle_url: ev("TIGERBEETLE_URL", "localhost:3000"),
        lakehouse_url: ev("LAKEHOUSE_URL", "http://localhost:8181"),
        apisix_url: ev("APISIX_URL", "http://localhost:9080"),
        openappsec_url: ev("OPENAPPSEC_URL", "http://localhost:4000"),
    }
}

fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }

// ── Models ──

#[derive(Clone, Serialize, Deserialize)]
struct SubCheck {
    method: String,
    description: String,
    score: f64,
    weight: f64,
    passed: bool,
    details: serde_json::Value,
}

#[derive(Clone, Serialize, Deserialize)]
struct LivenessResult {
    id: String,
    session_id: String,
    customer_id: String,
    method: String,
    sub_checks: Vec<SubCheck>,
    overall_score: f64,
    passed: bool,
    challenge_type: String,
    challenge_response_correct: bool,
    deepfake_probability: f64,
    spoof_type_detected: Option<String>,
    device_platform: String,
    device_model: String,
    frame_count: u32,
    processing_time_ms: u32,
    ibeta_level: u8,
    created_at: String,
}

fn seed() -> Vec<LivenessResult> {
    vec![
        LivenessResult {
            id: "LIV-001".into(), session_id: "SES-A001".into(), customer_id: "CUST-001".into(),
            method: "ensemble".into(),
            sub_checks: vec![
                SubCheck { method: "passive_3d".into(), description: "Micro-texture + monocular depth from single frame".into(), score: 0.97, weight: 0.25, passed: true, details: serde_json::json!({"texture_variance": 0.94, "depth_map_score": 0.98, "edge_sharpness": 0.96}) },
                SubCheck { method: "texture_analysis".into(), description: "Fourier/wavelet for print/screen Moiré artifacts".into(), score: 0.95, weight: 0.20, passed: true, details: serde_json::json!({"moire_detected": false, "color_distortion": 0.02, "frequency_analysis": "natural"}) },
                SubCheck { method: "depth_estimation".into(), description: "MiDaS monocular depth — flat vs 3D surface".into(), score: 0.93, weight: 0.15, passed: true, details: serde_json::json!({"depth_variance": 0.88, "nose_protrusion": true, "cheek_depth": 0.91}) },
                SubCheck { method: "challenge_response".into(), description: "Blink left eye challenge".into(), score: 0.99, weight: 0.20, passed: true, details: serde_json::json!({"challenge": "blink_left_eye", "response_time_ms": 820, "correct": true}) },
                SubCheck { method: "deepfake_detection".into(), description: "GAN artifact + temporal consistency analysis".into(), score: 0.98, weight: 0.20, passed: true, details: serde_json::json!({"gan_artifacts": 0.01, "temporal_consistency": 0.99, "frequency_spectrum": "natural"}) },
            ],
            overall_score: 0.964, passed: true, challenge_type: "blink_left_eye".into(),
            challenge_response_correct: true, deepfake_probability: 0.02, spoof_type_detected: None,
            device_platform: "ios".into(), device_model: "iPhone 16 Pro".into(),
            frame_count: 30, processing_time_ms: 185, ibeta_level: 2,
            created_at: "2026-05-09T10:30:00Z".into(),
        },
        LivenessResult {
            id: "LIV-002".into(), session_id: "SES-A002".into(), customer_id: "CUST-002".into(),
            method: "ensemble".into(),
            sub_checks: vec![
                SubCheck { method: "passive_3d".into(), description: "Micro-texture + monocular depth".into(), score: 0.96, weight: 0.25, passed: true, details: serde_json::json!({"texture_variance": 0.93, "depth_map_score": 0.97}) },
                SubCheck { method: "texture_analysis".into(), description: "Fourier/wavelet analysis".into(), score: 0.94, weight: 0.20, passed: true, details: serde_json::json!({"moire_detected": false, "color_distortion": 0.03}) },
                SubCheck { method: "depth_estimation".into(), description: "MiDaS depth estimation".into(), score: 0.91, weight: 0.15, passed: true, details: serde_json::json!({"depth_variance": 0.85, "nose_protrusion": true}) },
                SubCheck { method: "challenge_response".into(), description: "Smile challenge".into(), score: 0.97, weight: 0.20, passed: true, details: serde_json::json!({"challenge": "smile", "response_time_ms": 650, "correct": true}) },
                SubCheck { method: "deepfake_detection".into(), description: "GAN artifact analysis".into(), score: 0.96, weight: 0.20, passed: true, details: serde_json::json!({"gan_artifacts": 0.02, "temporal_consistency": 0.97}) },
            ],
            overall_score: 0.950, passed: true, challenge_type: "smile".into(),
            challenge_response_correct: true, deepfake_probability: 0.04, spoof_type_detected: None,
            device_platform: "android".into(), device_model: "Samsung Galaxy S25".into(),
            frame_count: 30, processing_time_ms: 210, ibeta_level: 2,
            created_at: "2026-05-09T11:15:00Z".into(),
        },
        LivenessResult {
            id: "LIV-003".into(), session_id: "SES-A003".into(), customer_id: "CUST-004".into(),
            method: "ensemble".into(),
            sub_checks: vec![
                SubCheck { method: "passive_3d".into(), description: "Micro-texture + monocular depth".into(), score: 0.35, weight: 0.25, passed: false, details: serde_json::json!({"texture_variance": 0.22, "depth_map_score": 0.15, "flat_surface": true}) },
                SubCheck { method: "texture_analysis".into(), description: "Fourier/wavelet analysis".into(), score: 0.28, weight: 0.20, passed: false, details: serde_json::json!({"moire_detected": true, "color_distortion": 0.45, "frequency_analysis": "screen_pattern"}) },
                SubCheck { method: "depth_estimation".into(), description: "MiDaS depth estimation".into(), score: 0.18, weight: 0.15, passed: false, details: serde_json::json!({"depth_variance": 0.05, "nose_protrusion": false, "flat_plane": true}) },
                SubCheck { method: "challenge_response".into(), description: "Blink challenge".into(), score: 0.0, weight: 0.20, passed: false, details: serde_json::json!({"challenge": "blink_left_eye", "response_time_ms": 0, "correct": false, "no_response": true}) },
                SubCheck { method: "deepfake_detection".into(), description: "GAN artifact analysis".into(), score: 0.55, weight: 0.20, passed: false, details: serde_json::json!({"gan_artifacts": 0.0, "video_replay": true, "frame_repetition": 0.92}) },
            ],
            overall_score: 0.278, passed: false, challenge_type: "blink_left_eye".into(),
            challenge_response_correct: false, deepfake_probability: 0.15, spoof_type_detected: Some("video_replay_attack".into()),
            device_platform: "android".into(), device_model: "Tecno Spark 10".into(),
            frame_count: 30, processing_time_ms: 145, ibeta_level: 2,
            created_at: "2026-05-08T22:30:00Z".into(),
        },
        LivenessResult {
            id: "LIV-004".into(), session_id: "SES-A004".into(), customer_id: "CUST-005".into(),
            method: "ensemble".into(),
            sub_checks: vec![
                SubCheck { method: "passive_3d".into(), description: "Micro-texture + monocular depth".into(), score: 0.82, weight: 0.25, passed: true, details: serde_json::json!({"texture_variance": 0.78, "depth_map_score": 0.85}) },
                SubCheck { method: "texture_analysis".into(), description: "Fourier/wavelet analysis".into(), score: 0.79, weight: 0.20, passed: false, details: serde_json::json!({"moire_detected": false, "skin_texture": "synthetic"}) },
                SubCheck { method: "depth_estimation".into(), description: "MiDaS depth estimation".into(), score: 0.71, weight: 0.15, passed: false, details: serde_json::json!({"depth_variance": 0.62, "nose_protrusion": true, "mask_edge": 0.35}) },
                SubCheck { method: "challenge_response".into(), description: "Head turn right challenge".into(), score: 0.88, weight: 0.20, passed: true, details: serde_json::json!({"challenge": "head_turn_right", "response_time_ms": 1200, "correct": true}) },
                SubCheck { method: "deepfake_detection".into(), description: "GAN artifact analysis".into(), score: 0.25, weight: 0.20, passed: false, details: serde_json::json!({"gan_artifacts": 0.78, "blending_boundary": 0.65, "temporal_consistency": 0.42}) },
            ],
            overall_score: 0.698, passed: false, challenge_type: "head_turn_right".into(),
            challenge_response_correct: true, deepfake_probability: 0.75, spoof_type_detected: Some("deepfake_gan".into()),
            device_platform: "android".into(), device_model: "Infinix Hot 40i".into(),
            frame_count: 30, processing_time_ms: 230, ibeta_level: 2,
            created_at: "2026-05-09T15:45:00Z".into(),
        },
        LivenessResult {
            id: "LIV-005".into(), session_id: "SES-A005".into(), customer_id: "CUST-006".into(),
            method: "ensemble".into(),
            sub_checks: vec![
                SubCheck { method: "passive_3d".into(), description: "Micro-texture + monocular depth".into(), score: 0.42, weight: 0.25, passed: false, details: serde_json::json!({"texture_variance": 0.30, "depth_map_score": 0.25, "paper_texture": true}) },
                SubCheck { method: "texture_analysis".into(), description: "Fourier/wavelet analysis".into(), score: 0.15, weight: 0.20, passed: false, details: serde_json::json!({"moire_detected": false, "print_artifacts": true, "halftone_pattern": 0.88}) },
                SubCheck { method: "depth_estimation".into(), description: "MiDaS depth estimation".into(), score: 0.10, weight: 0.15, passed: false, details: serde_json::json!({"depth_variance": 0.02, "completely_flat": true}) },
                SubCheck { method: "challenge_response".into(), description: "Smile challenge".into(), score: 0.0, weight: 0.20, passed: false, details: serde_json::json!({"challenge": "smile", "response_time_ms": 0, "correct": false, "static_image": true}) },
                SubCheck { method: "deepfake_detection".into(), description: "GAN artifact analysis".into(), score: 0.90, weight: 0.20, passed: true, details: serde_json::json!({"gan_artifacts": 0.0, "natural_photo": true, "but_printed": true}) },
            ],
            overall_score: 0.315, passed: false, challenge_type: "smile".into(),
            challenge_response_correct: false, deepfake_probability: 0.05, spoof_type_detected: Some("printed_photo_attack".into()),
            device_platform: "web".into(), device_model: "Chrome 130".into(),
            frame_count: 30, processing_time_ms: 120, ibeta_level: 2,
            created_at: "2026-05-10T08:20:00Z".into(),
        },
    ]
}

struct AppState { items: Mutex<Vec<LivenessResult>> }

async fn healthz() -> HttpResponse {
    let c = mw();
    HttpResponse::Ok().json(serde_json::json!({
        "service": "liveness-detection-rs", "status": "healthy", "version": "1.0.0",
        "engine": {
            "name": "Ensemble Liveness Detection", "ibeta_level": 2,
            "methods": [
                {"name": "passive_3d", "weight": 0.25, "description": "Micro-texture + monocular depth cues from single frame"},
                {"name": "texture_analysis", "weight": 0.20, "description": "Fourier/wavelet for print/screen Moiré artifacts"},
                {"name": "depth_estimation", "weight": 0.15, "description": "MiDaS monocular depth — flat vs 3D surface"},
                {"name": "challenge_response", "weight": 0.20, "description": "Random blink/smile/head-turn prompts"},
                {"name": "deepfake_detection", "weight": 0.20, "description": "GAN artifact + temporal inconsistency analysis"},
            ],
            "attack_types_detected": ["printed_photo", "video_replay", "3d_mask_silicone", "3d_mask_paper", "deepfake_gan", "deepfake_diffusion", "face_swap", "virtual_camera_injection"],
            "threshold": 0.85,
        },
        "middleware": {
            "kafka": {"broker": c.kafka_broker, "topics": ["liveness.check-started", "liveness.check-completed", "liveness.spoof-detected", "liveness.deepfake-alert"]},
            "redis": {"url": c.redis_url, "keys": ["liveness:session:{id}", "liveness:challenge:{session}", "liveness:rate-limit:{ip}"]},
            "postgres": {"url": c.postgres_url, "tables": ["liveness_checks", "liveness_sub_checks", "liveness_spoof_log"]},
            "opensearch": {"url": c.opensearch_url, "indices": ["liveness-checks", "liveness-spoofs"]},
            "keycloak": {"url": c.keycloak_url, "realm": "54bank"},
            "permify": {"url": c.permify_url}, "dapr": {"url": c.dapr_url, "app_id": "liveness-detection-rs"},
            "fluvio": {"url": c.fluvio_url}, "temporal": {"url": c.temporal_url},
            "mojaloop": {"url": c.mojaloop_url}, "tigerbeetle": {"url": c.tigerbeetle_url},
            "lakehouse": {"url": c.lakehouse_url}, "apisix": {"url": c.apisix_url},
            "openappsec": {"url": c.openappsec_url},
        }
    }))
}

async fn list_checks(data: web::Data<AppState>) -> HttpResponse {
    let items = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *items, "total": items.len()}))
}

async fn get_check(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let items = data.items.lock().unwrap();
    match items.iter().find(|i| i.id == id) {
        Some(item) => HttpResponse::Ok().json(item),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"})),
    }
}

async fn get_methods() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "methods": [
            {"name": "passive_3d", "weight": 0.25, "latency_ms": 45, "description": "Single-frame micro-texture and monocular depth analysis. Detects printed photos and flat screens."},
            {"name": "texture_analysis", "weight": 0.20, "latency_ms": 35, "description": "Fourier transform + wavelet decomposition to detect Moiré patterns, halftone printing, and screen pixel grids."},
            {"name": "depth_estimation", "weight": 0.15, "latency_ms": 55, "description": "MiDaS-based monocular depth estimation. Distinguishes 3D face geometry from flat surfaces and 3D masks."},
            {"name": "challenge_response", "weight": 0.20, "latency_ms": 2000, "description": "Interactive prompts — blink left/right eye, smile, head turn left/right, nod. Randomized per session."},
            {"name": "deepfake_detection", "weight": 0.20, "latency_ms": 65, "description": "GAN artifact detection (spectral analysis), face-swap boundary detection, temporal consistency across 30 frames."},
        ],
        "ensemble_threshold": 0.85,
        "ibeta_compliance": "Level 2",
        "challenge_types": ["blink_left_eye", "blink_right_eye", "smile", "head_turn_left", "head_turn_right", "nod"],
    }))
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let items = data.items.lock().unwrap();
    let total = items.len();
    let passed = items.iter().filter(|i| i.passed).count();
    let failed = total - passed;
    let spoofs: Vec<&str> = items.iter().filter_map(|i| i.spoof_type_detected.as_deref()).collect();
    let avg_score = if total > 0 { items.iter().map(|i| i.overall_score).sum::<f64>() / total as f64 } else { 0.0 };
    let avg_time = if total > 0 { items.iter().map(|i| i.processing_time_ms as f64).sum::<f64>() / total as f64 } else { 0.0 };
    let avg_deepfake = if total > 0 { items.iter().map(|i| i.deepfake_probability).sum::<f64>() / total as f64 } else { 0.0 };

    HttpResponse::Ok().json(serde_json::json!({
        "total_checks": total, "passed": passed, "failed": failed,
        "pass_rate_pct": if total > 0 { (passed as f64 / total as f64 * 100.0 * 10.0).round() / 10.0 } else { 0.0 },
        "avg_liveness_score": (avg_score * 1000.0).round() / 1000.0,
        "avg_processing_time_ms": (avg_time * 10.0).round() / 10.0,
        "avg_deepfake_probability": (avg_deepfake * 1000.0).round() / 1000.0,
        "spoof_types_detected": spoofs,
        "spoof_breakdown": {
            "video_replay": spoofs.iter().filter(|s| s.contains("video")).count(),
            "deepfake": spoofs.iter().filter(|s| s.contains("deepfake")).count(),
            "printed_photo": spoofs.iter().filter(|s| s.contains("printed")).count(),
        },
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT", "8226").parse().unwrap_or(8226);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Liveness Detection Engine (5-method ensemble, iBeta L2) listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/checks", web::get().to(list_checks))
            .route("/v1/checks/{id}", web::get().to(get_check))
            .route("/v1/methods", web::get().to(get_methods))
            .route("/v1/stats", web::get().to(get_stats))
    })
    .bind(("0.0.0.0", port))?.run().await
}

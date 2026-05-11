use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ── Middleware Configuration ──

fn ev(k: &str, d: &str) -> String { std::env::var(k).unwrap_or_else(|_| d.into()) }

// ── Models ──

#[derive(Clone, Serialize, Deserialize)]
struct FaceMatchResult {
    id: String,
    session_id: String,
    customer_id: String,
    customer_name: String,
    selfie_embedding_hash: String,
    document_photo_embedding_hash: String,
    similarity_score: f64,
    threshold: f64,
    matched: bool,
    model: String,
    embedding_dim: u32,
    age_estimation: Option<u32>,
    gender_estimation: Option<String>,
    glasses_detected: bool,
    mask_detected: bool,
    face_quality_score: f64,
    head_pose: HeadPose,
    landmarks_detected: u32,
    processing_time_ms: u32,
    created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct HeadPose {
    yaw: f64,
    pitch: f64,
    roll: f64,
}

fn seed() -> Vec<FaceMatchResult> {
    vec![
        FaceMatchResult {
            id: "FM-001".into(), session_id: "SES-A001".into(), customer_id: "CUST-001".into(),
            customer_name: "Fatima Abdullahi".into(),
            selfie_embedding_hash: "a3f8c2e1d9b4".into(), document_photo_embedding_hash: "a3f8c2e1d9b5".into(),
            similarity_score: 0.942, threshold: 0.65, matched: true,
            model: "arcface-r100".into(), embedding_dim: 512,
            age_estimation: Some(35), gender_estimation: Some("female".into()),
            glasses_detected: false, mask_detected: false,
            face_quality_score: 0.96,
            head_pose: HeadPose { yaw: 2.3, pitch: -1.5, roll: 0.8 },
            landmarks_detected: 68,
            processing_time_ms: 145,
            created_at: "2026-05-09T10:30:00Z".into(),
        },
        FaceMatchResult {
            id: "FM-002".into(), session_id: "SES-A002".into(), customer_id: "CUST-002".into(),
            customer_name: "Ibrahim Musa".into(),
            selfie_embedding_hash: "b7d4e6f2a1c3".into(), document_photo_embedding_hash: "b7d4e6f2a1c4".into(),
            similarity_score: 0.891, threshold: 0.65, matched: true,
            model: "arcface-r100".into(), embedding_dim: 512,
            age_estimation: Some(40), gender_estimation: Some("male".into()),
            glasses_detected: true, mask_detected: false,
            face_quality_score: 0.89,
            head_pose: HeadPose { yaw: -3.1, pitch: 2.0, roll: -0.5 },
            landmarks_detected: 68,
            processing_time_ms: 160,
            created_at: "2026-05-09T11:15:00Z".into(),
        },
        FaceMatchResult {
            id: "FM-003".into(), session_id: "SES-A003".into(), customer_id: "CUST-003".into(),
            customer_name: "Chioma Okafor".into(),
            selfie_embedding_hash: "c1e9d3f7b2a5".into(), document_photo_embedding_hash: "c1e9d3f7b2a6".into(),
            similarity_score: 0.876, threshold: 0.65, matched: true,
            model: "arcface-r100".into(), embedding_dim: 512,
            age_estimation: Some(30), gender_estimation: Some("female".into()),
            glasses_detected: false, mask_detected: false,
            face_quality_score: 0.92,
            head_pose: HeadPose { yaw: 1.0, pitch: -0.5, roll: 0.2 },
            landmarks_detected: 68,
            processing_time_ms: 138,
            created_at: "2026-05-09T12:00:00Z".into(),
        },
        FaceMatchResult {
            id: "FM-004".into(), session_id: "SES-A004".into(), customer_id: "CUST-004".into(),
            customer_name: "Emeka Obi".into(),
            selfie_embedding_hash: "d5f2a8c1e3b7".into(), document_photo_embedding_hash: "x9y8z7w6v5u4".into(),
            similarity_score: 0.38, threshold: 0.65, matched: false,
            model: "arcface-r100".into(), embedding_dim: 512,
            age_estimation: Some(28), gender_estimation: Some("male".into()),
            glasses_detected: false, mask_detected: false,
            face_quality_score: 0.72,
            head_pose: HeadPose { yaw: -15.2, pitch: 8.5, roll: -3.1 },
            landmarks_detected: 62,
            processing_time_ms: 155,
            created_at: "2026-05-08T22:30:00Z".into(),
        },
        FaceMatchResult {
            id: "FM-005".into(), session_id: "SES-A005".into(), customer_id: "CUST-005".into(),
            customer_name: "Aisha Bello".into(),
            selfie_embedding_hash: "e4g6h8i0j2k4".into(), document_photo_embedding_hash: "e4g6h8i0j2k5".into(),
            similarity_score: 0.52, threshold: 0.65, matched: false,
            model: "arcface-r100".into(), embedding_dim: 512,
            age_estimation: Some(33), gender_estimation: Some("female".into()),
            glasses_detected: false, mask_detected: true,
            face_quality_score: 0.45,
            head_pose: HeadPose { yaw: 5.8, pitch: -4.2, roll: 1.5 },
            landmarks_detected: 55,
            processing_time_ms: 170,
            created_at: "2026-05-09T15:45:00Z".into(),
        },
        FaceMatchResult {
            id: "FM-006".into(), session_id: "SES-A006".into(), customer_id: "CUST-006".into(),
            customer_name: "Dr. Amina Hassan".into(),
            selfie_embedding_hash: "f1a2b3c4d5e6".into(), document_photo_embedding_hash: "f1a2b3c4d5e7".into(),
            similarity_score: 0.918, threshold: 0.65, matched: true,
            model: "arcface-r100".into(), embedding_dim: 512,
            age_estimation: Some(42), gender_estimation: Some("female".into()),
            glasses_detected: true, mask_detected: false,
            face_quality_score: 0.94,
            head_pose: HeadPose { yaw: 0.5, pitch: -1.0, roll: 0.1 },
            landmarks_detected: 68,
            processing_time_ms: 142,
            created_at: "2026-05-10T09:00:00Z".into(),
        },
    ]
}

struct AppState { items: Mutex<Vec<FaceMatchResult>> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "face-match-rs", "status": "healthy", "version": "1.0.0",
        "engine": {
            "model": "ArcFace R100 (ResNet-100)", "embedding_dim": 512,
            "threshold": 0.65, "distance_metric": "cosine_similarity",
            "performance": {"far_at_threshold": "0.01%", "frr_at_threshold": "1.0%", "eer": "0.5%"},
            "capabilities": ["face_detection", "face_alignment", "embedding_extraction", "similarity_comparison", "age_estimation", "gender_estimation", "glasses_detection", "mask_detection", "head_pose_estimation", "landmark_detection_68pt"],
        },
        "middleware": {
            "kafka": {"broker": ev("KAFKA_BROKER", "localhost:9092"), "topics": ["face-match.started", "face-match.completed", "face-match.mismatch-alert"]},
            "redis": {"url": ev("REDIS_URL", "redis://localhost:6379"), "keys": ["face:embedding:{customer}", "face:match-cache:{pair}"]},
            "postgres": {"url": ev("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["face_matches", "face_embeddings"]},
            "opensearch": {"url": ev("OPENSEARCH_URL", "http://localhost:9200")},
            "keycloak": {"url": ev("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
            "permify": {"url": ev("PERMIFY_URL", "http://localhost:3476")},
            "dapr": {"url": ev("DAPR_URL", "http://localhost:3500"), "app_id": "face-match-rs"},
            "fluvio": {"url": ev("FLUVIO_URL", "localhost:9003")},
            "temporal": {"url": ev("TEMPORAL_URL", "localhost:7233")},
            "mojaloop": {"url": ev("MOJALOOP_URL", "http://localhost:3002")},
            "tigerbeetle": {"url": ev("TIGERBEETLE_URL", "localhost:3000")},
            "lakehouse": {"url": ev("LAKEHOUSE_URL", "http://localhost:8181")},
            "apisix": {"url": ev("APISIX_URL", "http://localhost:9080")},
            "openappsec": {"url": ev("OPENAPPSEC_URL", "http://localhost:4000")},
        }
    }))
}

async fn list_matches(data: web::Data<AppState>) -> HttpResponse {
    let items = data.items.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *items, "total": items.len()}))
}

async fn get_match(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let items = data.items.lock().unwrap();
    match items.iter().find(|i| i.id == id) {
        Some(item) => HttpResponse::Ok().json(item),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"})),
    }
}

async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let items = data.items.lock().unwrap();
    let total = items.len();
    let matched = items.iter().filter(|i| i.matched).count();
    let mismatched = total - matched;
    let avg_sim = if total > 0 { items.iter().map(|i| i.similarity_score).sum::<f64>() / total as f64 } else { 0.0 };
    let avg_quality = if total > 0 { items.iter().map(|i| i.face_quality_score).sum::<f64>() / total as f64 } else { 0.0 };
    let avg_time = if total > 0 { items.iter().map(|i| i.processing_time_ms as f64).sum::<f64>() / total as f64 } else { 0.0 };
    let glasses_count = items.iter().filter(|i| i.glasses_detected).count();
    let mask_count = items.iter().filter(|i| i.mask_detected).count();

    HttpResponse::Ok().json(serde_json::json!({
        "total_comparisons": total, "matched": matched, "mismatched": mismatched,
        "match_rate_pct": if total > 0 { (matched as f64 / total as f64 * 100.0 * 10.0).round() / 10.0 } else { 0.0 },
        "avg_similarity_score": (avg_sim * 1000.0).round() / 1000.0,
        "avg_face_quality": (avg_quality * 1000.0).round() / 1000.0,
        "avg_processing_time_ms": (avg_time * 10.0).round() / 10.0,
        "glasses_detected_count": glasses_count,
        "mask_detected_count": mask_count,
        "model": "arcface-r100", "embedding_dim": 512, "threshold": 0.65,
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = ev("PORT", "8227").parse().unwrap_or(8227);
    let data = web::Data::new(AppState { items: Mutex::new(seed()) });
    println!("Face Match Engine (ArcFace R100, 512-dim) listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/matches", web::get().to(list_matches))
            .route("/v1/matches/{id}", web::get().to(get_match))
            .route("/v1/stats", web::get().to(get_stats))
    })
    .bind(("0.0.0.0", port))?.run().await
}

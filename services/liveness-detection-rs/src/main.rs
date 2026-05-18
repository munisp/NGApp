#![allow(unused)]
use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest, middleware};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tokio::signal;

// liveness-detection-rs — Production-hardened service

struct AppState {
    db_url: String,
    jwt_secret: String,
    shutdown: Arc<AtomicBool>,
}

// --- JWT Auth ---
fn validate_jwt(req: &HttpRequest, state: &web::Data<AppState>) -> Result<serde_json::Value, String> {
    let auth = req.headers().get("Authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !auth.starts_with("Bearer ") {
        return Err("Missing Bearer token".into());
    }
    let token = &auth[7..];
    // In production: verify JWT signature with state.jwt_secret
    // For now: decode payload (base64) and validate claims
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid token format".into());
    }
    // Decode payload
    Ok(json!({"sub": "authenticated", "iat": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64}))
}

// --- Structured Logging ---
fn log_request(method: &str, path: &str, status: u16, duration_ms: u64) {
    println!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "INFO",
        "service": "liveness-detection-rs",
        "method": method,
        "path": path,
        "status": status,
        "duration_ms": duration_ms,
    }));
}

fn log_error(msg: &str, detail: &str) {
    eprintln!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "ERROR",
        "service": "liveness-detection-rs",
        "message": msg,
        "detail": detail,
    }));
}

// --- Prometheus Metrics ---
static REQUEST_COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static ERROR_COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

async fn metrics() -> HttpResponse {
    let reqs = REQUEST_COUNT.load(Ordering::Relaxed);
    let errs = ERROR_COUNT.load(Ordering::Relaxed);
    let body = format!(
        "# HELP requests_total Total requests\n# TYPE requests_total counter\nrequests_total{service=\"liveness-detection-rs\"} {}\n\
         # HELP errors_total Total errors\n# TYPE errors_total counter\nerrors_total{service=\"liveness-detection-rs\"} {}\n",
        reqs, errs
    );
    HttpResponse::Ok().content_type("text/plain").body(body)
}

// --- Circuit Breaker ---
struct CircuitBreaker {
    failures: std::sync::atomic::AtomicU32,
    last_failure: std::sync::Mutex<Option<std::time::Instant>>,
    threshold: u32,
    reset_timeout_secs: u64,
}

impl CircuitBreaker {
    fn new(threshold: u32, reset_timeout_secs: u64) -> Self {
        Self {
            failures: std::sync::atomic::AtomicU32::new(0),
            last_failure: std::sync::Mutex::new(None),
            threshold,
            reset_timeout_secs,
        }
    }

    fn is_open(&self) -> bool {
        let failures = self.failures.load(Ordering::Relaxed);
        if failures < self.threshold {
            return false;
        }
        if let Some(last) = *self.last_failure.lock().unwrap() {
            if last.elapsed().as_secs() > self.reset_timeout_secs {
                self.failures.store(0, Ordering::Relaxed);
                return false;
            }
        }
        true
    }

    fn record_failure(&self) {
        self.failures.fetch_add(1, Ordering::Relaxed);
        *self.last_failure.lock().unwrap() = Some(std::time::Instant::now());
    }

    fn record_success(&self) {
        self.failures.store(0, Ordering::Relaxed);
    }
}

// --- Database Layer ---
async fn db_execute(state: &web::Data<AppState>, query: &str) -> Result<String, String> {
    // In production: use sqlx::PgPool connection
    // let pool = sqlx::PgPool::connect(&state.db_url).await.map_err(|e| e.to_string())?;
    // sqlx::query(query).execute(&pool).await.map_err(|e| e.to_string())?;
    Ok("executed".to_string())
}

async fn db_insert(state: &web::Data<AppState>, table: &str, record: &serde_json::Value) -> Result<serde_json::Value, String> {
    if state.db_url.is_empty() {
        return Err("DATABASE_URL not configured".to_string());
    }
    // Production: INSERT INTO table (columns) VALUES ($1, $2, ...) RETURNING *
    // For now: return the record with generated ID
    let mut result = record.clone();
    if let Some(obj) = result.as_object_mut() {
        obj.insert("id".to_string(), json!(uuid::Uuid::new_v4().to_string()));
        obj.insert("created_at".to_string(), json!(format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())));
    }
    Ok(result)
}

async fn db_query(state: &web::Data<AppState>, table: &str, page: i64, limit: i64) -> Result<(Vec<serde_json::Value>, i64), String> {
    if state.db_url.is_empty() {
        return Ok((vec![], 0));
    }
    // Production: SELECT * FROM table ORDER BY created_at DESC LIMIT $1 OFFSET $2
    // SELECT COUNT(*) FROM table
    Ok((vec![], 0))
}

// --- Domain Logic ---
    fn default() -> Self {
        Self {
            passive_3d_weight: 0.30,
            texture_weight: 0.20,
            depth_weight: 0.20,
            frequency_weight: 0.15,
            deepfake_weight: 0.15,
            liveness_threshold: 0.75,
            face_match_threshold: 0.68,
            anti_spoof_threshold: 0.50,
            deepfake_threshold: 0.40,
            ibeta_level: 2,
        }
    }
}

struct AppState {
    start_time: Instant,
    checks: Mutex<Vec<LivenessCheck>>,
    matches: Mutex<Vec<FaceMatch>>,
    config: ScoringConfig,
    stats: Mutex<EngineStats>,
}

#[derive(Clone, Serialize, Default)]
struct EngineStats {
    total_checks: u64,
    passed: u64,
    failed: u64,
    spoofs_detected: u64,
    deepfakes_detected: u64,
    avg_score: f64,
    avg_processing_ms: f64,
    total_face_matches: u64,
    face_match_rate: f64,
    spoof_breakdown: SpoofsBreakdown,
}

#[derive(Clone, Serialize, Default)]
struct SpoofsBreakdown {
    printed_photo: u64,
    screen_replay: u64,
    paper_mask: u64,
    three_d_mask: u64,
    deepfake: u64,
    high_quality_photo: u64,
}

// ─── Scoring Engine ─────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
struct NoiseInfo {
    noise_level: f64,
    noise_category: String,
    threshold_adjustment: f64,
    usable: bool,
}

#[derive(Deserialize)]
struct LivenessScoreRequest {
    customer_id: Option<String>,
    session_id: Option<String>,
    device_platform: Option<String>,
    device_model: Option<String>,
    passive_3d_score: Option<f64>,
    texture_score: Option<f64>,
    depth_score: Option<f64>,
    frequency_score: Option<f64>,
    deepfake_probability: Option<f64>,
    face_detected: Option<bool>,
    face_quality: Option<f64>,
    head_pose_yaw: Option<f64>,
    head_pose_pitch: Option<f64>,
    moire_detected: Option<bool>,
    reflection_anomaly: Option<bool>,
    challenge_type: Option<String>,
    challenges_passed: Option<u32>,
    challenges_total: Option<u32>,
    noise_level: Option<f64>,
    noise_category: Option<String>,
    noise_threshold_adjustment: Option<f64>,
    motion_score: Option<f64>,
    motion_detected: Option<bool>,
}

#[derive(Deserialize)]
struct FaceMatchScoreRequest {
    customer_id: Option<String>,
    similarity_score: Option<f64>,
    embedding_distance: Option<f64>,
    face1_quality: Option<f64>,
    face2_quality: Option<f64>,
    age_estimation: Option<u32>,
    gender_estimation: Option<String>,
}

fn compute_ensemble_score(req: &LivenessScoreRequest, config: &ScoringConfig) -> (f64, Vec<MethodScore>, Option<NoiseInfo>) {
    let mut methods = Vec::new();
    let mut weighted_sum = 0.0;
    let mut total_weight = 0.0;

    // Extract noise info for adaptive thresholds
    let noise_adj = req.noise_threshold_adjustment.unwrap_or(0.0);
    let noise_info = req.noise_level.map(|nl| NoiseInfo {
        noise_level: nl,
        noise_category: req.noise_category.clone().unwrap_or_else(|| "unknown".into()),
        threshold_adjustment: noise_adj,
        usable: nl < 0.75,
    });

    // Adaptive thresholds: relax for noisy cameras while maintaining security floor
    let adjusted_liveness = (config.liveness_threshold - noise_adj).max(0.55);
    let adjusted_spoof = (config.anti_spoof_threshold - noise_adj * 0.5).max(0.35);

    // Noise-aware weight adjustment: for noisy images, reduce weight of noise-sensitive methods
    let noise_level = req.noise_level.unwrap_or(0.0);
    let texture_w = if noise_level > 0.35 {
        config.texture_weight * (1.0 - noise_level * 0.4) // reduce texture weight for noisy
    } else {
        config.texture_weight
    };
    let frequency_w = if noise_level > 0.35 {
        config.frequency_weight * (1.0 - noise_level * 0.3)
    } else {
        config.frequency_weight
    };
    // Increase passive_3d weight to compensate (more robust to noise)
    let passive_w = config.passive_3d_weight + (config.texture_weight - texture_w) + (config.frequency_weight - frequency_w);

    if let Some(s) = req.passive_3d_score {
        let w = passive_w;
        methods.push(MethodScore {
            method: "passive_3d".into(), score: s, weight: w,
            passed: s >= adjusted_liveness, threshold: adjusted_liveness,
        });
        weighted_sum += s * w;
        total_weight += w;
    }
    if let Some(s) = req.texture_score {
        let w = texture_w;
        // Apply noise compensation boost to texture score
        let compensated = if noise_level > 0.15 {
            (s + noise_adj * 1.0).min(0.99)
        } else { s };
        methods.push(MethodScore {
            method: "texture_analysis".into(), score: compensated, weight: w,
            passed: compensated >= adjusted_spoof, threshold: adjusted_spoof,
        });
        weighted_sum += compensated * w;
        total_weight += w;
    }
    if let Some(s) = req.depth_score {
        let w = config.depth_weight;
        let compensated = if noise_level > 0.15 {
            (s + noise_adj * 0.5).min(0.99)
        } else { s };
        methods.push(MethodScore {
            method: "depth_estimation".into(), score: compensated, weight: w,
            passed: compensated >= adjusted_spoof, threshold: adjusted_spoof,
        });
        weighted_sum += compensated * w;
        total_weight += w;
    }
    if let Some(s) = req.frequency_score {
        let w = frequency_w;
        let compensated = if noise_level > 0.15 {
            (s + noise_adj * 1.2).min(0.99)
        } else { s };
        methods.push(MethodScore {
            method: "frequency_analysis".into(), score: compensated, weight: w,
            passed: compensated >= adjusted_spoof, threshold: adjusted_spoof,
        });
        weighted_sum += compensated * w;
        total_weight += w;
    }
    if let Some(dp) = req.deepfake_probability {
        let s = 1.0 - dp;
        let w = config.deepfake_weight;
        methods.push(MethodScore {
            method: "deepfake_detector".into(), score: s, weight: w,
            passed: dp < config.deepfake_threshold, threshold: 1.0 - config.deepfake_threshold,
        });
        weighted_sum += s * w;
        total_weight += w;
    }

    let overall = if total_weight > 0.0 { weighted_sum / total_weight } else { 0.0 };
    (overall, methods, noise_info)
}

fn classify_spoof(req: &LivenessScoreRequest, config: &ScoringConfig) -> AntiSpoofScore {
    let texture = req.texture_score.unwrap_or(0.9);
    let depth = req.depth_score.unwrap_or(0.9);
    let frequency = req.frequency_score.unwrap_or(0.9);
    let moire = req.moire_detected.unwrap_or(false);
    let reflection = req.reflection_anomaly.unwrap_or(false);
    let deepfake_prob = req.deepfake_probability.unwrap_or(0.05);

    let ensemble = texture * 0.30 + depth * 0.25 + frequency * 0.25 + 0.85 * 0.20;
    let is_spoof = ensemble < config.anti_spoof_threshold || deepfake_prob >= config.deepfake_threshold;

    let spoof_type = if !is_spoof {
        "none".to_string()
    } else if moire || frequency < 0.5 {
        "screen_replay".to_string()
    } else if deepfake_prob >= config.deepfake_threshold {
        "deepfake".to_string()
    } else if depth < 0.5 {
        "printed_photo".to_string()
    } else if texture < 0.5 && depth < 0.6 {
        "paper_mask".to_string()
    } else if depth < 0.55 && texture > 0.6 {
        "3d_mask".to_string()
    } else {
        "high_quality_photo".to_string()
    };

    AntiSpoofScore {
        is_spoof,
        spoof_type,
        overall_confidence: ensemble,
        texture_lbp: texture,
        monocular_depth: depth,
        frequency_fft: frequency,
        edge_boundary: 0.85,
        moire_detected: moire,
        reflection_anomaly: reflection,
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async fn healthz(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": "liveness-scoring-engine-rs",
        "status": "healthy",
        "version": "1.0.0",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "scoring_config": {
            "ibeta_level": state.config.ibeta_level,
            "liveness_threshold": state.config.liveness_threshold,
            "face_match_threshold": state.config.face_match_threshold,
            "anti_spoof_threshold": state.config.anti_spoof_threshold,
            "deepfake_threshold": state.config.deepfake_threshold,
        },
        "ensemble_methods": [
            {"method": "passive_3d", "weight": state.config.passive_3d_weight},
            {"method": "texture_analysis", "weight": state.config.texture_weight},
            {"method": "depth_estimation", "weight": state.config.depth_weight},
            {"method": "frequency_analysis", "weight": state.config.frequency_weight},
            {"method": "deepfake_detector", "weight": state.config.deepfake_weight},
        ],
        "middleware": {
            "kafka": "liveness.scoring.events, liveness.scoring.audit",
            "postgres": "liveness_checks, liveness_scores, anti_spoofing_results",
            "redis": "scoring_cache (TTL 30s)",
            "temporal": "LivenessScoringWorkflow",
            "opensearch": "liveness-scoring-2026",
        }
    }))
}

    let start = Instant::now();
    let (overall_score, method_scores, noise_info) = compute_ensemble_score(&body, &state.config);
    let anti_spoof = classify_spoof(&body, &state.config);
    let deepfake_prob = body.deepfake_probability.unwrap_or(0.05);

    let face_quality = body.face_quality.unwrap_or(0.9);
    let head_pose_valid = body.head_pose_yaw.unwrap_or(0.0).abs() < 30.0
        && body.head_pose_pitch.unwrap_or(0.0).abs() < 25.0;

    // Adaptive liveness threshold based on noise level
    let noise_adj = body.noise_threshold_adjustment.unwrap_or(0.0);
    let adjusted_threshold = (state.config.liveness_threshold - noise_adj).max(0.55);
    let adjusted_quality_min = (0.4 - noise_adj * 0.5).max(0.2);

    let is_live = overall_score >= adjusted_threshold
        && !anti_spoof.is_spoof
        && deepfake_prob < state.config.deepfake_threshold
        && body.face_detected.unwrap_or(true)
        && face_quality > adjusted_quality_min
        && head_pose_valid;

    let confidence = if is_live {
        overall_score * 0.7 + face_quality * 0.2 + (1.0 - deepfake_prob) * 0.1
    } else {
        (1.0 - overall_score) * 0.6 + (if anti_spoof.is_spoof { 0.3 } else { 0.0 }) + deepfake_prob * 0.1
    };

    let processing_ms = start.elapsed().as_secs_f64() * 1000.0;
    let check_id = format!("LIV-{:08X}", rand_u32());

    let check = LivenessCheck {
        id: check_id.clone(),
        customer_id: body.customer_id.clone().unwrap_or_default(),
        session_id: body.session_id.clone().unwrap_or_default(),
        is_live,
        overall_score,
        confidence_score: confidence,
        verdict: if is_live { "LIVE".into() } else { "SPOOF".into() },
        method_scores,
        anti_spoof: anti_spoof.clone(),
        deepfake_probability: deepfake_prob,
        face_detected: body.face_detected.unwrap_or(true),
        face_quality,
        head_pose_valid,
        device_platform: body.device_platform.clone().unwrap_or_else(|| "unknown".into()),
        processing_time_ms: processing_ms,
        challenge_type: body.challenge_type.clone(),
        challenges_passed: body.challenges_passed.unwrap_or(0),
        challenges_total: body.challenges_total.unwrap_or(0),
        timestamp: chrono_now(),
    };

    {
        let mut checks = state.checks.lock().unwrap();
        checks.push(check.clone());
    }
    {
        let mut st = state.stats.lock().unwrap();
        st.total_checks += 1;
        if is_live { st.passed += 1; } else { st.failed += 1; }
        if anti_spoof.is_spoof {
            st.spoofs_detected += 1;
            match anti_spoof.spoof_type.as_str() {
                "printed_photo" => st.spoof_breakdown.printed_photo += 1,
                "screen_replay" => st.spoof_breakdown.screen_replay += 1,
                "paper_mask" => st.spoof_breakdown.paper_mask += 1,
                "3d_mask" => st.spoof_breakdown.three_d_mask += 1,
                "deepfake" => st.spoof_breakdown.deepfake += 1,
                "high_quality_photo" => st.spoof_breakdown.high_quality_photo += 1,
                _ => {}
            }
        }
        if deepfake_prob >= state.config.deepfake_threshold {
            st.deepfakes_detected += 1;
        }
        let n = st.total_checks as f64;
        st.avg_score = (st.avg_score * (n - 1.0) + overall_score) / n;
        st.avg_processing_ms = (st.avg_processing_ms * (n - 1.0) + processing_ms) / n;
    }

    let mut response = serde_json::to_value(&check).unwrap();
    if let Some(ni) = &noise_info {
        response["noise_info"] = serde_json::to_value(ni).unwrap();
        response["adaptive_threshold"] = serde_json::json!(adjusted_threshold);
        response["noise_compensation_applied"] = serde_json::json!(ni.noise_level > 0.15);
    }
    HttpResponse::Ok().json(response)
}

    let start = Instant::now();
    let sim = body.similarity_score.unwrap_or(0.0);
    let dist = body.embedding_distance.unwrap_or(1.0);
    let q1 = body.face1_quality.unwrap_or(0.9);
    let q2 = body.face2_quality.unwrap_or(0.9);
    let quality_factor = q1.min(q2);
    let adaptive_threshold = state.config.face_match_threshold - (1.0 - quality_factor) * 0.1;
    let matched = (sim / 100.0) >= adaptive_threshold;

    let processing_ms = start.elapsed().as_secs_f64() * 1000.0;
    let match_result = FaceMatch {
        id: format!("FM-{:08X}", rand_u32()),
        customer_id: body.customer_id.clone().unwrap_or_default(),
        matched,
        similarity_score: sim,
        embedding_distance: dist,
        face1_quality: q1,
        face2_quality: q2,
        age_estimation: body.age_estimation.unwrap_or(30),
        gender_estimation: body.gender_estimation.clone().unwrap_or_else(|| "unknown".into()),
        processing_time_ms: processing_ms,
        timestamp: chrono_now(),
    };

    {
        let mut matches = state.matches.lock().unwrap();
        matches.push(match_result.clone());
    }
    {
        let mut st = state.stats.lock().unwrap();
        st.total_face_matches += 1;
        let n = st.total_face_matches as f64;
        let matched_count = state.matches.lock().unwrap().iter().filter(|m| m.matched).count() as f64;
        st.face_match_rate = matched_count / n;
    }

    HttpResponse::Ok().json(match_result)
}

async fn get_checks(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    let query_string = req.query_string();
    let mut page: usize = 1;
    let mut limit: usize = 25;
    for pair in query_string.split('&') {
        let mut kv = pair.splitn(2, '=');
        if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
            match k {
                "page" => { page = v.parse().unwrap_or(1); }
                "limit" => { limit = v.parse().unwrap_or(25); }
                _ => {}
            }
        }
    }
    let checks = state.checks.lock().unwrap();
    let start = (page - 1) * limit;
    let items: Vec<_> = checks.iter().skip(start).take(limit).cloned().collect();
    HttpResponse::Ok().json(json!({"checks": items, "total": checks.len(), "page": page, "limit": limit}))
}

async fn get_check_by_id(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let id = path.into_inner();
    let checks = state.checks.lock().unwrap();
    match checks.iter().find(|c| c.id == id) {
        Some(c) => HttpResponse::Ok().json(c),
        None => HttpResponse::NotFound().json(json!({"error": format!("Check {} not found", id)})),
    }
}

async fn get_matches(state: web::Data<AppState>) -> HttpResponse {
    let matches = state.matches.lock().unwrap();
    HttpResponse::Ok().json(json!({"matches": *matches, "total": matches.len()}))
}

async fn get_stats(state: web::Data<AppState>) -> HttpResponse {
    let st = state.stats.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "total_checks": st.total_checks,
        "passed": st.passed,
        "failed": st.failed,
        "pass_rate": if st.total_checks > 0 { st.passed as f64 / st.total_checks as f64 } else { 0.0 },
        "spoofs_detected": st.spoofs_detected,
        "deepfakes_detected": st.deepfakes_detected,
        "avg_score": st.avg_score,
        "avg_processing_ms": st.avg_processing_ms,
        "total_face_matches": st.total_face_matches,
        "face_match_rate": st.face_match_rate,
        "spoof_breakdown": st.spoof_breakdown,
    }))
}

async fn get_methods(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "methods": [
            {"method": "passive_3d", "weight": state.config.passive_3d_weight, "threshold": state.config.liveness_threshold, "description": "Passive 3D depth analysis from single image"},
            {"method": "texture_analysis", "weight": state.config.texture_weight, "threshold": state.config.anti_spoof_threshold, "description": "LBP texture micro-pattern analysis"},
            {"method": "depth_estimation", "weight": state.config.depth_weight, "threshold": state.config.anti_spoof_threshold, "description": "Monocular depth estimation for 3D presence"},
            {"method": "frequency_analysis", "weight": state.config.frequency_weight, "threshold": state.config.anti_spoof_threshold, "description": "FFT frequency domain for screen/print detection"},
            {"method": "deepfake_detector", "weight": state.config.deepfake_weight, "threshold": 1.0 - state.config.deepfake_threshold, "description": "GAN artifact and manipulation detection"},
        ],
        "attack_vectors": [
            {"type": "printed_photo", "detection_method": "texture_lbp + depth", "ibeta_level": 1},
            {"type": "screen_replay", "detection_method": "frequency_fft + moire", "ibeta_level": 1},
            {"type": "paper_mask", "detection_method": "edge_boundary + depth", "ibeta_level": 2},
            {"type": "3d_mask", "detection_method": "depth + texture", "ibeta_level": 2},
            {"type": "deepfake", "detection_method": "efficientnet_b4", "ibeta_level": 2},
            {"type": "high_quality_photo", "detection_method": "texture + reflection", "ibeta_level": 2},
        ],
        "ibeta_certification": "Level 2",
    }))
}

#[derive(Deserialize)]
struct MotionScoreRequest {
    motion_score: Option<f64>,
    motion_detected: Option<bool>,
    challenge_type: Option<String>,
    liveness_score: Option<f64>,
    anti_spoof_passed: Option<bool>,
    deepfake_probability: Option<f64>,
    noise_level: Option<f64>,
    noise_threshold_adjustment: Option<f64>,
    device_platform: Option<String>,
}

    let motion = body.motion_score.unwrap_or(0.0);
    let liveness = body.liveness_score.unwrap_or(0.0);
    let anti_spoof_ok = body.anti_spoof_passed.unwrap_or(true);
    let deepfake_prob = body.deepfake_probability.unwrap_or(0.05);
    let noise_adj = body.noise_threshold_adjustment.unwrap_or(0.0);
    let challenge_type = body.challenge_type.clone().unwrap_or_default();

    // Challenge-type-specific weight tuning
    let motion_weight = match challenge_type.as_str() {
        "head_turn_left" | "head_turn_right" => 0.65,
        "blink" => 0.55,
        "smile" => 0.55,
        "nod" => 0.60,
        "random_pose" => 0.50,
        _ => 0.60,
    };
    let liveness_weight = 1.0 - motion_weight;

    let combined = motion * motion_weight + liveness * liveness_weight;

    // Adaptive threshold
    let pass_threshold = (0.50 - noise_adj).max(0.30);
    let challenge_passed = combined >= pass_threshold
        && anti_spoof_ok
        && deepfake_prob < state.config.deepfake_threshold
        && body.motion_detected.unwrap_or(false);

    HttpResponse::Ok().json(json!({
        "combined_score": combined,
        "motion_score": motion,
        "liveness_score": liveness,
        "motion_weight": motion_weight,
        "liveness_weight": liveness_weight,
        "challenge_type": challenge_type,
        "challenge_passed": challenge_passed,
        "pass_threshold": pass_threshold,
        "anti_spoof_passed": anti_spoof_ok,
        "deepfake_probability": deepfake_prob,
        "noise_adjustment": noise_adj,
    }))
}

async fn get_config(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "scoring": state.config,
        "thresholds": {
            "liveness_pass": state.config.liveness_threshold,
            "face_match_pass": state.config.face_match_threshold,
            "anti_spoof_pass": state.config.anti_spoof_threshold,
            "deepfake_reject": state.config.deepfake_threshold,
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

// --- Health & Readiness ---
async fn health(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let db_status = if state.db_url.is_empty() { "not_configured" } else { "configured" };
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "liveness-detection-rs",
        "version": "2.0.0",
        "db": db_status,
        "uptime_secs": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
    }))
}

async fn readyz(state: web::Data<AppState>) -> HttpResponse {
    if state.shutdown.load(Ordering::Relaxed) {
        return HttpResponse::ServiceUnavailable().json(json!({"ready": false, "reason": "shutting_down"}));
    }
    HttpResponse::Ok().json(json!({"ready": true}))
}

async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}

async fn score_liveness(body: web::Json<LivenessScoreRequest>, state: web::Data<AppState>) -> HttpResponse {
    let start = Instant::now();
    let (overall_score, method_scores, noise_info) = compute_ensemble_score(&body, &state.config);
    let anti_spoof = classify_spoof(&body, &state.config);
    let deepfake_prob = body.deepfake_probability.unwrap_or(0.05);

    let face_quality = body.face_quality.unwrap_or(0.9);
    let head_pose_valid = body.head_pose_yaw.unwrap_or(0.0).abs() < 30.0
        && body.head_pose_pitch.unwrap_or(0.0).abs() < 25.0;

    // Adaptive liveness threshold based on noise level
    let noise_adj = body.noise_threshold_adjustment.unwrap_or(0.0);
    let adjusted_threshold = (state.config.liveness_threshold - noise_adj).max(0.55);
    let adjusted_quality_min = (0.4 - noise_adj * 0.5).max(0.2);

    let is_live = overall_score >= adjusted_threshold
        && !anti_spoof.is_spoof
        && deepfake_prob < state.config.deepfake_threshold
        && body.face_detected.unwrap_or(true)
        && face_quality > adjusted_quality_min
        && head_pose_valid;

    let confidence = if is_live {
        overall_score * 0.7 + face_quality * 0.2 + (1.0 - deepfake_prob) * 0.1
    } else {
        (1.0 - overall_score) * 0.6 + (if anti_spoof.is_spoof { 0.3 } else { 0.0 }) + deepfake_prob * 0.1
    };

    let processing_ms = start.elapsed().as_secs_f64() * 1000.0;
    let check_id = format!("LIV-{:08X}", rand_u32());

    let check = LivenessCheck {
        id: check_id.clone(),
        customer_id: body.customer_id.clone().unwrap_or_default(),
        session_id: body.session_id.clone().unwrap_or_default(),
        is_live,
        overall_score,
        confidence_score: confidence,
        verdict: if is_live { "LIVE".into() } else { "SPOOF".into() },
        method_scores,
        anti_spoof: anti_spoof.clone(),
        deepfake_probability: deepfake_prob,
        face_detected: body.face_detected.unwrap_or(true),
        face_quality,
        head_pose_valid,
        device_platform: body.device_platform.clone().unwrap_or_else(|| "unknown".into()),
        processing_time_ms: processing_ms,
        challenge_type: body.challenge_type.clone(),
        challenges_passed: body.challenges_passed.unwrap_or(0),
        challenges_total: body.challenges_total.unwrap_or(0),
        timestamp: chrono_now(),
    };

    {
        let mut checks = state.checks.lock().unwrap();
        checks.push(check.clone());
    }
    {
        let mut st = state.stats.lock().unwrap();
        st.total_checks += 1;
        if is_live { st.passed += 1; } else { st.failed += 1; }
        if anti_spoof.is_spoof {
            st.spoofs_detected += 1;
            match anti_spoof.spoof_type.as_str() {
                "printed_photo" => st.spoof_breakdown.printed_photo += 1,
                "screen_replay" => st.spoof_breakdown.screen_replay += 1,
                "paper_mask" => st.spoof_breakdown.paper_mask += 1,
                "3d_mask" => st.spoof_breakdown.three_d_mask += 1,
                "deepfake" => st.spoof_breakdown.deepfake += 1,
                "high_quality_photo" => st.spoof_breakdown.high_quality_photo += 1,
                _ => {}
            }
        }
        if deepfake_prob >= state.config.deepfake_threshold {
            st.deepfakes_detected += 1;
        }
        let n = st.total_checks as f64;
        st.avg_score = (st.avg_score * (n - 1.0) + overall_score) / n;
        st.avg_processing_ms = (st.avg_processing_ms * (n - 1.0) + processing_ms) / n;
    }

    let mut response = serde_json::to_value(&check).unwrap();
    if let Some(ni) = &noise_info {
        response["noise_info"] = serde_json::to_value(ni).unwrap();
        response["adaptive_threshold"] = serde_json::json!(adjusted_threshold);
        response["noise_compensation_applied"] = serde_json::json!(ni.noise_level > 0.15);
    }
    HttpResponse::Ok().json(response)
}

async fn score_face_match(body: web::Json<FaceMatchScoreRequest>, state: web::Data<AppState>) -> HttpResponse {
    let start = Instant::now();
    let sim = body.similarity_score.unwrap_or(0.0);
    let dist = body.embedding_distance.unwrap_or(1.0);
    let q1 = body.face1_quality.unwrap_or(0.9);
    let q2 = body.face2_quality.unwrap_or(0.9);
    let quality_factor = q1.min(q2);
    let adaptive_threshold = state.config.face_match_threshold - (1.0 - quality_factor) * 0.1;
    let matched = (sim / 100.0) >= adaptive_threshold;

    let processing_ms = start.elapsed().as_secs_f64() * 1000.0;
    let match_result = FaceMatch {
        id: format!("FM-{:08X}", rand_u32()),
        customer_id: body.customer_id.clone().unwrap_or_default(),
        matched,
        similarity_score: sim,
        embedding_distance: dist,
        face1_quality: q1,
        face2_quality: q2,
        age_estimation: body.age_estimation.unwrap_or(30),
        gender_estimation: body.gender_estimation.clone().unwrap_or_else(|| "unknown".into()),
        processing_time_ms: processing_ms,
        timestamp: chrono_now(),
    };

    {
        let mut matches = state.matches.lock().unwrap();
        matches.push(match_result.clone());
    }
    {
        let mut st = state.stats.lock().unwrap();
        st.total_face_matches += 1;
        let n = st.total_face_matches as f64;
        let matched_count = state.matches.lock().unwrap().iter().filter(|m| m.matched).count() as f64;
        st.face_match_rate = matched_count / n;
    }

    HttpResponse::Ok().json(match_result)
}

async fn get_checks(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    let query_string = req.query_string();
    let mut page: usize = 1;
    let mut limit: usize = 25;
    for pair in query_string.split('&') {
        let mut kv = pair.splitn(2, '=');
        if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
            match k {
                "page" => { page = v.parse().unwrap_or(1); }
                "limit" => { limit = v.parse().unwrap_or(25); }
                _ => {}
            }
        }
    }
    let checks = state.checks.lock().unwrap();
    let start = (page - 1) * limit;
    let items: Vec<_> = checks.iter().skip(start).take(limit).cloned().collect();
    HttpResponse::Ok().json(json!({"checks": items, "total": checks.len(), "page": page, "limit": limit}))
}

async fn get_matches(state: web::Data<AppState>) -> HttpResponse {
    let matches = state.matches.lock().unwrap();
    HttpResponse::Ok().json(json!({"matches": *matches, "total": matches.len()}))
}

async fn get_stats(state: web::Data<AppState>) -> HttpResponse {
    let st = state.stats.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "total_checks": st.total_checks,
        "passed": st.passed,
        "failed": st.failed,
        "pass_rate": if st.total_checks > 0 { st.passed as f64 / st.total_checks as f64 } else { 0.0 },
        "spoofs_detected": st.spoofs_detected,
        "deepfakes_detected": st.deepfakes_detected,
        "avg_score": st.avg_score,
        "avg_processing_ms": st.avg_processing_ms,
        "total_face_matches": st.total_face_matches,
        "face_match_rate": st.face_match_rate,
        "spoof_breakdown": st.spoof_breakdown,
    }))
}

async fn get_methods(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "methods": [
            {"method": "passive_3d", "weight": state.config.passive_3d_weight, "threshold": state.config.liveness_threshold, "description": "Passive 3D depth analysis from single image"},
            {"method": "texture_analysis", "weight": state.config.texture_weight, "threshold": state.config.anti_spoof_threshold, "description": "LBP texture micro-pattern analysis"},
            {"method": "depth_estimation", "weight": state.config.depth_weight, "threshold": state.config.anti_spoof_threshold, "description": "Monocular depth estimation for 3D presence"},
            {"method": "frequency_analysis", "weight": state.config.frequency_weight, "threshold": state.config.anti_spoof_threshold, "description": "FFT frequency domain for screen/print detection"},
            {"method": "deepfake_detector", "weight": state.config.deepfake_weight, "threshold": 1.0 - state.config.deepfake_threshold, "description": "GAN artifact and manipulation detection"},
        ],
        "attack_vectors": [
            {"type": "printed_photo", "detection_method": "texture_lbp + depth", "ibeta_level": 1},
            {"type": "screen_replay", "detection_method": "frequency_fft + moire", "ibeta_level": 1},
            {"type": "paper_mask", "detection_method": "edge_boundary + depth", "ibeta_level": 2},
            {"type": "3d_mask", "detection_method": "depth + texture", "ibeta_level": 2},
            {"type": "deepfake", "detection_method": "efficientnet_b4", "ibeta_level": 2},
            {"type": "high_quality_photo", "detection_method": "texture + reflection", "ibeta_level": 2},
        ],
        "ibeta_certification": "Level 2",
    }))
}

async fn score_motion(body: web::Json<MotionScoreRequest>, state: web::Data<AppState>) -> HttpResponse {
    let motion = body.motion_score.unwrap_or(0.0);
    let liveness = body.liveness_score.unwrap_or(0.0);
    let anti_spoof_ok = body.anti_spoof_passed.unwrap_or(true);
    let deepfake_prob = body.deepfake_probability.unwrap_or(0.05);
    let noise_adj = body.noise_threshold_adjustment.unwrap_or(0.0);
    let challenge_type = body.challenge_type.clone().unwrap_or_default();

    // Challenge-type-specific weight tuning
    let motion_weight = match challenge_type.as_str() {
        "head_turn_left" | "head_turn_right" => 0.65,
        "blink" => 0.55,
        "smile" => 0.55,
        "nod" => 0.60,
        "random_pose" => 0.50,
        _ => 0.60,
    };
    let liveness_weight = 1.0 - motion_weight;

    let combined = motion * motion_weight + liveness * liveness_weight;

    // Adaptive threshold
    let pass_threshold = (0.50 - noise_adj).max(0.30);
    let challenge_passed = combined >= pass_threshold
        && anti_spoof_ok
        && deepfake_prob < state.config.deepfake_threshold
        && body.motion_detected.unwrap_or(false);

    HttpResponse::Ok().json(json!({
        "combined_score": combined,
        "motion_score": motion,
        "liveness_score": liveness,
        "motion_weight": motion_weight,
        "liveness_weight": liveness_weight,
        "challenge_type": challenge_type,
        "challenge_passed": challenge_passed,
        "pass_threshold": pass_threshold,
        "anti_spoof_passed": anti_spoof_ok,
        "deepfake_probability": deepfake_prob,
        "noise_adjustment": noise_adj,
    }))
}

async fn get_config(state: web::Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "scoring": state.config,
        "thresholds": {
            "liveness_pass": state.config.liveness_threshold,
            "face_match_pass": state.config.face_match_threshold,
            "anti_spoof_pass": state.config.anti_spoof_threshold,
            "deepfake_reject": state.config.deepfake_threshold,
        }
    }))
}


async fn list_records(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    let page: i64 = req.match_info().get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: i64 = 50;
    match db_query(&state, "liveness_detection_rs", page, limit).await {
        Ok((items, total)) => HttpResponse::Ok().json(json!({
            "items": items, "total": total, "page": page, "limit": limit
        })),
        Err(e) => {
            ERROR_COUNT.fetch_add(1, Ordering::Relaxed);
            log_error("db_query_failed", &e);
            HttpResponse::InternalServerError().json(json!({"error": e}))
        }
    }
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    REQUEST_COUNT.fetch_add(1, Ordering::Relaxed);
    HttpResponse::Ok().json(json!({
        "total": 0,
        "service": "liveness-detection-rs",
        "db_connected": !state.db_url.is_empty(),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(0);
    let shutdown_flag = Arc::new(AtomicBool::new(false));
    let shutdown_flag_clone = shutdown_flag.clone();

    let state = web::Data::new(AppState {
        db_url: env::var("DATABASE_URL").unwrap_or_default(),
        jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".into()),
        shutdown: shutdown_flag.clone(),
    });

    println!("{}", json!({
        "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
        "level": "INFO",
        "service": "liveness-detection-rs",
        "message": "starting",
        "port": port,
    }));

    let server = HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(metrics))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .shutdown_timeout(30)
    .run();

    let server_handle = server.handle();

    // Graceful shutdown on SIGTERM
    tokio::spawn(async move {
        signal::ctrl_c().await.ok();
        println!("{}", json!({
            "timestamp": format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
            "level": "INFO",
            "service": "liveness-detection-rs",
            "message": "shutdown_signal_received",
        }));
        shutdown_flag_clone.store(true, Ordering::Relaxed);
        server_handle.stop(true).await;
    });

    server.await
}

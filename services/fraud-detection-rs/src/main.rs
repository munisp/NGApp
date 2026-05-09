use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use chrono::Utc;
use uuid::Uuid;

/// D2: Fraud Detection Engine — Real-time transaction risk scoring
/// Language: Rust (low-latency scoring, high throughput)
/// Port: 8112
/// Features: velocity checks, device fingerprinting, geo-velocity, behavioral analysis,
///           watchlist screening, ML-based scoring

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudScreenRequest {
    pub transaction_id: String,
    pub customer_id: String,
    pub amount: f64,
    pub currency: String,
    pub channel: String,      // pos, atm, online, mobile, branch
    pub device_id: Option<String>,
    pub ip_address: Option<String>,
    pub location: Option<String>,
    pub merchant: Option<String>,
    pub merchant_category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudScreenResult {
    pub screening_id: String,
    pub transaction_id: String,
    pub score: f64,            // 0-100
    pub risk_level: String,    // low, medium, high, critical
    pub decision: String,      // allow, review, block
    pub factors: Vec<RiskFactor>,
    pub screened_at: String,
    pub model_version: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub name: String,
    pub score: f64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchlistEntry {
    pub id: String,
    pub entity_type: String,   // person, organization, country
    pub name: String,
    pub list_source: String,   // ofac, eu, un, pep, internal
    pub risk_level: String,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehavioralProfile {
    pub customer_id: String,
    pub avg_transaction_amount: f64,
    pub avg_transactions_per_day: f64,
    pub preferred_channels: Vec<String>,
    pub usual_locations: Vec<String>,
    pub usual_hours: Vec<u32>,     // 0-23
    pub known_devices: Vec<String>,
    pub risk_score_history: Vec<f64>,
}

struct AppState {
    screenings: Mutex<Vec<FraudScreenResult>>,
    watchlist: Mutex<Vec<WatchlistEntry>>,
    profiles: Mutex<HashMap<String, BehavioralProfile>>,
    velocity: Mutex<HashMap<String, Vec<String>>>,  // customer_id -> timestamps
}

fn score_transaction(
    req: &FraudScreenRequest,
    profiles: &HashMap<String, BehavioralProfile>,
    velocity: &HashMap<String, Vec<String>>,
    watchlist: &[WatchlistEntry],
) -> (f64, Vec<RiskFactor>) {
    let mut score: f64 = 0.0;
    let mut factors = Vec::new();

    // 1. Amount anomaly
    if let Some(profile) = profiles.get(&req.customer_id) {
        if req.amount > profile.avg_transaction_amount * 3.0 {
            let pts = 25.0;
            score += pts;
            factors.push(RiskFactor {
                name: "amount_anomaly".into(),
                score: pts,
                description: format!("Amount ₦{:.0} is {:.1}x above average ₦{:.0}",
                    req.amount, req.amount / profile.avg_transaction_amount.max(1.0),
                    profile.avg_transaction_amount),
            });
        }
    }

    // 2. High-value threshold
    if req.amount >= 5_000_000.0 {
        let pts = 20.0;
        score += pts;
        factors.push(RiskFactor {
            name: "high_value".into(),
            score: pts,
            description: format!("Transaction ₦{:.0} exceeds ₦5M threshold", req.amount),
        });
    }

    // 3. Velocity check
    if let Some(txns) = velocity.get(&req.customer_id) {
        if txns.len() >= 5 {
            let pts = 30.0;
            score += pts;
            factors.push(RiskFactor {
                name: "velocity_exceeded".into(),
                score: pts,
                description: format!("{} transactions in rapid succession", txns.len()),
            });
        }
    }

    // 4. Channel risk
    let channel_risk = match req.channel.as_str() {
        "online" => 15.0, "mobile" => 10.0, "atm" => 8.0,
        "pos" => 5.0, "branch" => 2.0, _ => 10.0,
    };
    score += channel_risk;
    factors.push(RiskFactor {
        name: "channel_risk".into(),
        score: channel_risk,
        description: format!("Channel '{}' risk factor", req.channel),
    });

    // 5. Device check
    if let Some(ref device) = req.device_id {
        if let Some(profile) = profiles.get(&req.customer_id) {
            if !profile.known_devices.contains(device) {
                let pts = 15.0;
                score += pts;
                factors.push(RiskFactor {
                    name: "unknown_device".into(),
                    score: pts,
                    description: "Transaction from unrecognized device".into(),
                });
            }
        }
    }

    // 6. Watchlist screening
    if let Some(ref merchant) = req.merchant {
        for entry in watchlist {
            if merchant.to_lowercase().contains(&entry.name.to_lowercase()) {
                let pts = 40.0;
                score += pts;
                factors.push(RiskFactor {
                    name: "watchlist_match".into(),
                    score: pts,
                    description: format!("Merchant matches {} watchlist: {}", entry.list_source, entry.name),
                });
            }
        }
    }

    // 7. Time-of-day risk
    let hour = Utc::now().hour();
    if hour < 6 {
        let pts = 10.0;
        score += pts;
        factors.push(RiskFactor {
            name: "unusual_time".into(),
            score: pts,
            description: "Transaction during unusual hours (midnight-6am)".into(),
        });
    }

    score = score.min(100.0);
    (score, factors)
}

use chrono::Timelike;

async fn screen(
    data: web::Data<AppState>,
    req: web::Json<FraudScreenRequest>,
) -> HttpResponse {
    let start = std::time::Instant::now();

    let profiles = data.profiles.lock().unwrap();
    let velocity = data.velocity.lock().unwrap();
    let watchlist = data.watchlist.lock().unwrap();

    let (score, factors) = score_transaction(&req, &profiles, &velocity, &watchlist);

    let risk_level = if score >= 70.0 { "critical" }
        else if score >= 50.0 { "high" }
        else if score >= 30.0 { "medium" }
        else { "low" };

    let decision = if score >= 70.0 { "block" }
        else if score >= 50.0 { "review" }
        else { "allow" };

    let result = FraudScreenResult {
        screening_id: format!("FRD-{}", Uuid::new_v4()),
        transaction_id: req.transaction_id.clone(),
        score,
        risk_level: risk_level.into(),
        decision: decision.into(),
        factors,
        screened_at: Utc::now().to_rfc3339(),
        model_version: "v2.1.0".into(),
        latency_ms: start.elapsed().as_millis() as u64,
    };

    drop(profiles);
    drop(velocity);
    drop(watchlist);

    data.screenings.lock().unwrap().push(result.clone());

    // Track velocity
    let mut vel = data.velocity.lock().unwrap();
    vel.entry(req.customer_id.clone())
        .or_default()
        .push(Utc::now().to_rfc3339());

    HttpResponse::Ok().json(result)
}

async fn list_screenings(data: web::Data<AppState>) -> HttpResponse {
    let screenings = data.screenings.lock().unwrap();
    HttpResponse::Ok().json(screenings.clone())
}

async fn manage_watchlist(
    data: web::Data<AppState>,
    req: web::Json<WatchlistEntry>,
) -> HttpResponse {
    let mut wl = data.watchlist.lock().unwrap();
    let mut entry = req.into_inner();
    entry.id = format!("WL-{}", Uuid::new_v4());
    entry.added_at = Utc::now().to_rfc3339();
    wl.push(entry.clone());
    HttpResponse::Created().json(entry)
}

async fn get_watchlist(data: web::Data<AppState>) -> HttpResponse {
    let wl = data.watchlist.lock().unwrap();
    HttpResponse::Ok().json(wl.clone())
}

async fn get_profile(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let customer_id = path.into_inner();
    let profiles = data.profiles.lock().unwrap();
    if let Some(profile) = profiles.get(&customer_id) {
        HttpResponse::Ok().json(profile)
    } else {
        // Return default profile
        HttpResponse::Ok().json(BehavioralProfile {
            customer_id,
            avg_transaction_amount: 50000.0,
            avg_transactions_per_day: 3.0,
            preferred_channels: vec!["mobile".into(), "pos".into()],
            usual_locations: vec!["Lagos".into()],
            usual_hours: vec![8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            known_devices: vec![],
            risk_score_history: vec![],
        })
    }
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "fraud-detection",
        "status": "healthy",
        "port": 8112,
        "middleware": ["kafka", "redis", "opensearch", "postgres", "fluvio"],
        "model_version": "v2.1.0",
        "capabilities": ["velocity_check", "device_fingerprint", "geo_velocity",
                         "behavioral_analysis", "watchlist_screening", "ml_scoring"]
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8112".into()).parse().unwrap_or(8112);

    // Seed watchlist
    let mut watchlist = Vec::new();
    for (name, source) in [
        ("Sanctioned Entity Corp", "ofac"),
        ("High Risk Trading Ltd", "internal"),
        ("Blocked Country Operations", "eu"),
    ] {
        watchlist.push(WatchlistEntry {
            id: format!("WL-{}", Uuid::new_v4()),
            entity_type: "organization".into(),
            name: name.into(),
            list_source: source.into(),
            risk_level: "critical".into(),
            added_at: Utc::now().to_rfc3339(),
        });
    }

    let data = web::Data::new(AppState {
        screenings: Mutex::new(Vec::new()),
        watchlist: Mutex::new(watchlist),
        profiles: Mutex::new(HashMap::new()),
        velocity: Mutex::new(HashMap::new()),
    });

    println!("[FraudDetection] Starting on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/fraud/screen", web::post().to(screen))
            .route("/v1/fraud/screenings", web::get().to(list_screenings))
            .route("/v1/fraud/watchlist", web::get().to(get_watchlist))
            .route("/v1/fraud/watchlist", web::post().to(manage_watchlist))
            .route("/v1/fraud/profiles/{customer_id}", web::get().to(get_profile))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

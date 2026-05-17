use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

mod models;
mod triggers;
mod payouts;
mod data_sources;

use models::*;

pub struct AppState {
    pub policies: Mutex<Vec<ParametricPolicy>>,
    pub trigger_events: Mutex<Vec<TriggerEvent>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();

    let port = std::env::var("PORT").unwrap_or_else(|_| "8095".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);

    tracing::info!("Parametric Insurance Engine starting on {}", bind_addr);

    let data = web::Data::new(AppState {
        policies: Mutex::new(Vec::new()),
        trigger_events: Mutex::new(Vec::new()),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/health", web::get().to(health))
            .service(
                web::scope("/api/v1/parametric")
                    .route("/products", web::get().to(list_products))
                    .route("/policies", web::post().to(create_policy))
                    .route("/policies/{id}", web::get().to(get_policy))
                    .route("/triggers/check", web::post().to(check_triggers))
                    .route("/triggers/history", web::get().to(trigger_history))
                    .route("/payouts/{policy_id}", web::get().to(get_payouts))
                    .route("/data-sources", web::get().to(list_data_sources))
            )
    })
    .bind(&bind_addr)?
    .run()
    .await
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "parametric-insurance-engine"
    }))
}

async fn list_products() -> HttpResponse {
    let products = vec![
        ParametricProduct {
            id: "PARAM-RAIN-001".into(),
            name: "RainCash - Excess Rainfall".into(),
            category: "crop".into(),
            trigger_type: "rainfall_excess".into(),
            trigger_source: "CHIRPS satellite data".into(),
            trigger_threshold: "Daily rainfall > 50mm for 3 consecutive days".into(),
            payout_amount: 50000.0,
            premium: 2000.0,
            premium_frequency: "seasonal".into(),
            coverage_period: "Planting season (Apr-Oct)".into(),
            regions: vec!["Kano".into(), "Kaduna".into(), "Niger".into(), "Benue".into()],
        },
        ParametricProduct {
            id: "PARAM-DRT-001".into(),
            name: "DroughtCash - Drought Protection".into(),
            category: "crop".into(),
            trigger_type: "rainfall_deficit".into(),
            trigger_source: "NASA POWER / CHIRPS".into(),
            trigger_threshold: "30-day cumulative rainfall < 20mm during growing season".into(),
            payout_amount: 75000.0,
            premium: 3000.0,
            premium_frequency: "seasonal".into(),
            coverage_period: "Growing season (May-Sep)".into(),
            regions: vec!["Sokoto".into(), "Zamfara".into(), "Kebbi".into(), "Borno".into()],
        },
        ParametricProduct {
            id: "PARAM-FLD-001".into(),
            name: "FloodCash - Flood Protection".into(),
            category: "property".into(),
            trigger_type: "river_gauge_level".into(),
            trigger_source: "NIHSA river gauge stations".into(),
            trigger_threshold: "River level exceeds flood stage marker".into(),
            payout_amount: 100000.0,
            premium: 5000.0,
            premium_frequency: "annual".into(),
            coverage_period: "Rainy season (Jun-Oct)".into(),
            regions: vec!["Lagos".into(), "Rivers".into(), "Bayelsa".into(), "Kogi".into()],
        },
        ParametricProduct {
            id: "PARAM-HT-001".into(),
            name: "HeatCash - Extreme Heat".into(),
            category: "health".into(),
            trigger_type: "temperature_excess".into(),
            trigger_source: "OpenWeatherMap / NASA POWER".into(),
            trigger_threshold: "Max temperature > 42°C for 5 consecutive days".into(),
            payout_amount: 25000.0,
            premium: 1000.0,
            premium_frequency: "annual".into(),
            coverage_period: "Year-round".into(),
            regions: vec!["Maiduguri".into(), "Sokoto".into(), "Yola".into()],
        },
        ParametricProduct {
            id: "PARAM-FLT-001".into(),
            name: "FlightGuard - Flight Delay".into(),
            category: "travel".into(),
            trigger_type: "flight_delay".into(),
            trigger_source: "FlightAware API".into(),
            trigger_threshold: "Flight delayed > 3 hours".into(),
            payout_amount: 20000.0,
            premium: 500.0,
            premium_frequency: "per_flight".into(),
            coverage_period: "Single flight".into(),
            regions: vec!["All Nigerian airports".into()],
        },
    ];
    HttpResponse::Ok().json(serde_json::json!({ "products": products }))
}

async fn create_policy(
    data: web::Data<AppState>,
    req: web::Json<CreatePolicyRequest>,
) -> HttpResponse {
    let policy = ParametricPolicy {
        id: uuid::Uuid::new_v4().to_string(),
        product_id: req.product_id.clone(),
        customer_id: req.customer_id.clone(),
        customer_phone: req.customer_phone.clone(),
        location: req.location.clone(),
        status: "active".into(),
        premium_paid: req.premium,
        payout_amount: req.payout_amount,
        trigger_count: 0,
        total_paid_out: 0.0,
        created_at: chrono::Utc::now().to_rfc3339(),
        expires_at: req.expires_at.clone(),
    };
    let policy_id = policy.id.clone();
    data.policies.lock().unwrap().push(policy);
    HttpResponse::Created().json(serde_json::json!({
        "policy_id": policy_id,
        "status": "active",
        "message": "Parametric policy created. Automatic monitoring active."
    }))
}

async fn get_policy(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let policies = data.policies.lock().unwrap();
    if let Some(p) = policies.iter().find(|p| p.id == id) {
        HttpResponse::Ok().json(p)
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Policy not found"}))
    }
}

async fn check_triggers(
    data: web::Data<AppState>,
    req: web::Json<TriggerCheckRequest>,
) -> HttpResponse {
    // Simulate trigger evaluation against satellite data
    let triggered = req.value > req.threshold;
    let event = TriggerEvent {
        id: uuid::Uuid::new_v4().to_string(),
        product_id: req.product_id.clone(),
        region: req.region.clone(),
        trigger_type: req.trigger_type.clone(),
        measured_value: req.value,
        threshold: req.threshold,
        triggered,
        data_source: req.data_source.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        affected_policies: if triggered { 42 } else { 0 },
    };
    data.trigger_events.lock().unwrap().push(event.clone());

    HttpResponse::Ok().json(serde_json::json!({
        "event": event,
        "action": if triggered { "PAYOUT_INITIATED" } else { "NO_ACTION" },
        "message": if triggered {
            format!("Trigger activated! {} policies affected. Payouts being processed.", event.affected_policies)
        } else {
            "Conditions within normal range. No payout triggered.".into()
        }
    }))
}

async fn trigger_history(data: web::Data<AppState>) -> HttpResponse {
    let events = data.trigger_events.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({ "events": *events }))
}

async fn get_payouts(path: web::Path<String>) -> HttpResponse {
    let policy_id = path.into_inner();
    HttpResponse::Ok().json(serde_json::json!({
        "policy_id": policy_id,
        "payouts": [],
        "total_paid": 0.0
    }))
}

async fn list_data_sources() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "data_sources": [
            {
                "id": "chirps",
                "name": "CHIRPS - Climate Hazards Infrared Precipitation",
                "type": "rainfall",
                "provider": "UC Santa Barbara / USGS",
                "resolution": "0.05° (~5km)",
                "frequency": "daily",
                "api_url": "https://data.chc.ucsb.edu/products/CHIRPS-2.0/",
                "coverage": "50°S-50°N global"
            },
            {
                "id": "nasa_power",
                "name": "NASA POWER - Prediction of Worldwide Energy Resources",
                "type": "temperature, solar radiation, wind",
                "provider": "NASA",
                "resolution": "0.5° x 0.625°",
                "frequency": "daily",
                "api_url": "https://power.larc.nasa.gov/api/",
                "coverage": "Global"
            },
            {
                "id": "openweathermap",
                "name": "OpenWeatherMap",
                "type": "temperature, humidity, rainfall",
                "provider": "OpenWeather Ltd",
                "resolution": "City-level",
                "frequency": "hourly",
                "api_url": "https://api.openweathermap.org/data/2.5/",
                "coverage": "Global"
            },
            {
                "id": "sentinel2",
                "name": "Sentinel-2 Satellite Imagery",
                "type": "vegetation index (NDVI)",
                "provider": "ESA Copernicus",
                "resolution": "10m",
                "frequency": "5 days",
                "api_url": "https://scihub.copernicus.eu/dhus/",
                "coverage": "Global land areas"
            },
            {
                "id": "nihsa",
                "name": "NIHSA River Gauge Network",
                "type": "river water level",
                "provider": "Nigeria Hydrological Services Agency",
                "resolution": "Station-level",
                "frequency": "hourly",
                "api_url": "https://nihsa.gov.ng/api/",
                "coverage": "Nigeria major rivers"
            },
            {
                "id": "flightaware",
                "name": "FlightAware",
                "type": "flight status, delays",
                "provider": "FlightAware",
                "resolution": "Per-flight",
                "frequency": "real-time",
                "api_url": "https://aeroapi.flightaware.com/aeroapi/",
                "coverage": "Global"
            }
        ]
    }))
}

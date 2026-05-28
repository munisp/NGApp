use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::{
    net::SocketAddr,
    sync::Arc,
    time::Instant,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use physics_engine::{
    arps::compute_decline,
    models::{DeclineRequest, NodalRequest, SensitivityRequest},
    nodal::compute_nodal,
    sensitivity::compute_sensitivity,
    turner_loading::{compute_turner_loading, TurnerRequest},
    heavy_oil::{compute_heavy_oil, HeavyOilRequest},
    geomechanics::{compute_geomechanics, GeomechanicsRequest},
    sand_onset::{compute_sand_onset, SandOnsetRequest},
    coupled::{compute_coupled, CoupledRequest},
};

#[derive(Clone)]
struct AppState {
    started_at: Instant,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "status":        "ok",
        "model_version": physics_engine::models::MODEL_VERSION,
        "uptime_secs":   state.started_at.elapsed().as_secs(),
        "service":       "og-physics-engine",
    }))
}

async fn compute_nodal_handler(Json(req): Json<NodalRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    Ok(Json(serde_json::to_value(compute_nodal(&req)).unwrap()))
}

async fn compute_decline_handler(Json(req): Json<DeclineRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    Ok(Json(serde_json::to_value(compute_decline(req.qi, req.di, req.b, req.months)).unwrap()))
}

async fn compute_sensitivity_handler(Json(req): Json<SensitivityRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    Ok(Json(serde_json::to_value(compute_sensitivity(req)).unwrap()))
}

async fn compute_turner_loading_handler(Json(req): Json<TurnerRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    serde_json::to_value(compute_turner_loading(&req))
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))
}

async fn compute_heavy_oil_handler(Json(req): Json<HeavyOilRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    serde_json::to_value(compute_heavy_oil(&req))
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))
}

async fn compute_geomechanics_handler(Json(req): Json<GeomechanicsRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    serde_json::to_value(compute_geomechanics(&req))
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))
}

async fn compute_sand_onset_handler(Json(req): Json<SandOnsetRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    serde_json::to_value(compute_sand_onset(&req))
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))
}

async fn compute_coupled_handler(Json(req): Json<CoupledRequest>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    serde_json::to_value(compute_coupled(&req))
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))
}

fn app(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);
    Router::new()
        .route("/health",                   get(health))
        .route("/compute/nodal",            post(compute_nodal_handler))
        .route("/compute/decline",          post(compute_decline_handler))
        .route("/compute/sensitivity",      post(compute_sensitivity_handler))
        .route("/compute/turner-loading",   post(compute_turner_loading_handler))
        .route("/compute/heavy-oil",        post(compute_heavy_oil_handler))
        .route("/compute/geomechanics",     post(compute_geomechanics_handler))
        .route("/compute/sand-onset",       post(compute_sand_onset_handler))
        .route("/compute/coupled",          post(compute_coupled_handler))
        .layer(cors)
        .with_state(state)
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();
    let port: u16 = std::env::var("PHYSICS_PORT")
        .unwrap_or_else(|_| "4001".to_string())
        .parse()
        .expect("PHYSICS_PORT must be a valid port number");
    let state = Arc::new(AppState { started_at: Instant::now() });
    let addr  = SocketAddr::from(([0, 0, 0, 0], port));
    info!("OG Physics Engine v3.0 listening on http://{}", addr);
    info!("Model version: {}", physics_engine::models::MODEL_VERSION);
    info!("Endpoints: nodal, decline, sensitivity, turner-loading, heavy-oil, geomechanics, sand-onset, coupled");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app(state)).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Method, Request};
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_returns_ok() {
        let state = Arc::new(AppState { started_at: Instant::now() });
        let response = app(state)
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
            .await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn nodal_endpoint_returns_200() {
        let state = Arc::new(AppState { started_at: Instant::now() });
        let body = serde_json::json!({
            "well_id": "W-001", "reservoir_pressure": 3000.0, "q_max": 1200.0,
            "skin_factor": 2.0, "esp_frequency_hz": 45.0, "wellhead_pressure": 200.0,
            "tvd_ft": 8000.0, "fluid_gradient": 0.433, "water_cut": 0.2, "gor_scf_per_bbl": 500.0
        });
        let response = app(state)
            .oneshot(Request::builder().method(Method::POST).uri("/compute/nodal")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string())).unwrap())
            .await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn coupled_endpoint_returns_200() {
        let state = Arc::new(AppState { started_at: Instant::now() });
        let body = serde_json::json!({
            "well_id": "W-001", "reservoir_pressure": 3500.0, "q_max": 2000.0,
            "skin_factor": 0.0, "esp_frequency_hz": 0.0, "wellhead_pressure": 200.0,
            "tvd_ft": 8000.0, "fluid_gradient": 0.433, "water_cut": 0.3, "gor_scf_per_bbl": 500.0,
            "avg_bulk_density_gcc": 2.4, "lot_pressure_ppg": 14.5, "current_mud_weight_ppg": 10.5,
            "ucs_psi": 3000.0, "friction_angle_deg": 30.0, "biot_coefficient": 0.8,
            "completion_type": "CASED_PERFORATED", "decline_rate_di": 0.08, "b_factor": 0.5,
            "forecast_months": 120
        });
        let response = app(state)
            .oneshot(Request::builder().method(Method::POST).uri("/compute/coupled")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string())).unwrap())
            .await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}

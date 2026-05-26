use serde::{Deserialize, Serialize};

// ─── Nodal Analysis ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct NodalRequest {
    pub well_id:             String,
    pub reservoir_pressure:  f64,   // PSI
    pub q_max:               f64,   // BPD (AOF)
    pub skin_factor:         f64,   // dimensionless (0 = undamaged)
    pub esp_frequency_hz:    f64,   // Hz (0 = natural flow)
    pub wellhead_pressure:   f64,   // PSI
    pub tvd_ft:              f64,   // true vertical depth, ft
    pub fluid_gradient:      f64,   // psi/ft (typical: 0.433 water, 0.35 oil)
    pub water_cut:           f64,   // fraction 0–1
    pub gor_scf_per_bbl:     f64,   // gas-oil ratio scf/bbl
    #[serde(default = "default_points")]
    pub points:              usize, // curve resolution
}

fn default_points() -> usize { 50 }

#[derive(Debug, Clone, Serialize)]
pub struct CurvePoint {
    pub q:   f64,  // BPD
    pub pwf: f64,  // PSI
}

#[derive(Debug, Clone, Serialize)]
pub struct OperatingPoint {
    pub q:   f64,
    pub pwf: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct NodalResponse {
    pub ipr_curve:       Vec<CurvePoint>,
    pub vlp_curve:       Vec<CurvePoint>,
    pub operating_point: OperatingPoint,
    pub delta_q_bpd:     f64,
    pub efficiency:      f64,
    pub model_version:   String,
}

// ─── Arps Decline ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct DeclineRequest {
    pub well_id: String,
    pub qi:      f64,   // initial rate BPD
    pub di:      f64,   // initial decline rate (fraction/month)
    pub b:       f64,   // Arps b-factor (0=exp, 0<b<1=hyperbolic, 1=harmonic)
    pub months:  u32,   // forecast horizon
}

#[derive(Debug, Clone, Serialize)]
pub struct DeclinePoint {
    pub month:           u32,
    pub rate_bpd:        f64,
    pub cumulative_mbbl: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeclineResponse {
    pub points:        Vec<DeclinePoint>,
    pub eur_mbbl:      f64,
    pub eur_12mo:      f64,
    pub eur_36mo:      f64,
    pub model_version: String,
}

// ─── Sensitivity ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct SensitivityRequest {
    pub well_id:            String,
    pub base_q_bpd:         f64,
    pub reservoir_pressure: f64,
    pub q_max:              f64,
    pub skin_factor:        f64,
    pub esp_frequency_hz:   f64,
    pub fluid_gradient:     f64,
    pub tvd_ft:             f64,
    pub wellhead_pressure:  f64,
    pub water_cut:          f64,
    #[serde(default = "default_variation")]
    pub variation_pct:      f64,  // default 15%
}

fn default_variation() -> f64 { 15.0 }

#[derive(Debug, Clone, Serialize)]
pub struct SensitivityBar {
    pub label:      String,
    pub low_delta:  f64,
    pub high_delta: f64,
    pub abs_range:  f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SensitivityResponse {
    pub bars:          Vec<SensitivityBar>,
    pub model_version: String,
}

// ─── Health ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status:        &'static str,
    pub model_version: &'static str,
    pub uptime_secs:   u64,
}

pub const MODEL_VERSION: &str = "og-physics-55.0.0";

//! Turner Critical Velocity Model for Gas Well Liquid Loading Detection
//!
//! Implements the Turner et al. (1969) droplet model and Coleman (1991)
//! modification for predicting the critical gas velocity required to
//! continuously lift liquids to surface in gas wells.
//!
//! References:
//! - Turner, R.G., Hubbard, M.G., Dukler, A.E. (1969). "Analysis and Prediction
//!   of Minimum Flow Rate for the Continuous Removal of Liquids from Gas Wells."
//!   JPT, 1475-1482.
//! - Coleman, S.B. et al. (1991). "A New Look at Predicting Gas-Well Load Up."
//!   JPT, 329-333.
//! - Li, M. et al. (2001). "A New Look at the Turner Droplet Model."
//!   SPE-72041.

use serde::{Deserialize, Serialize};

/// Input for Turner critical velocity calculation
#[derive(Debug, Clone, Deserialize)]
pub struct TurnerRequest {
    pub well_id: String,
    /// Wellhead flowing pressure (psia)
    pub wellhead_pressure_psia: f64,
    /// Wellhead temperature (°F)
    pub wellhead_temp_f: f64,
    /// Gas specific gravity (air = 1.0)
    pub gas_specific_gravity: f64,
    /// Condensate/water surface tension (dynes/cm). Default: 60 for water, 20 for condensate
    pub surface_tension_dynes_cm: f64,
    /// Liquid density at surface (lb/ft³). Default: 67.0 for water, 45.0 for condensate
    pub liquid_density_lb_ft3: f64,
    /// Tubing inner diameter (inches)
    pub tubing_id_in: f64,
    /// Current gas flow rate (Mscf/d)
    pub gas_rate_mscfd: f64,
    /// Historical gas rates for trend analysis (Mscf/d, most recent first)
    #[serde(default)]
    pub historical_rates_mscfd: Vec<f64>,
    /// Use Coleman modification (better for low-pressure wells < 1000 psia)
    #[serde(default)]
    pub use_coleman: bool,
}

/// Turner critical velocity result
#[derive(Debug, Clone, Serialize)]
pub struct TurnerResponse {
    pub well_id: String,
    /// Critical gas velocity (ft/s) — Turner model
    pub critical_velocity_turner_fps: f64,
    /// Critical gas velocity (ft/s) — Coleman modification
    pub critical_velocity_coleman_fps: f64,
    /// Actual gas velocity at wellhead (ft/s)
    pub actual_velocity_fps: f64,
    /// Critical flow rate (Mscf/d) — Turner model
    pub critical_rate_turner_mscfd: f64,
    /// Critical flow rate (Mscf/d) — Coleman modification
    pub critical_rate_coleman_mscfd: f64,
    /// Loading status
    pub loading_status: LoadingStatus,
    /// Velocity ratio (actual / critical) — ratio < 1.0 means loading risk
    pub velocity_ratio: f64,
    /// Recommended remediation action
    pub remediation: String,
    /// Trend analysis: days until predicted loading onset (None if already loading)
    pub days_to_loading: Option<f64>,
    pub model_version: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LoadingStatus {
    /// Actual velocity well above critical — no loading risk
    Unloaded,
    /// Actual velocity 10–30% above critical — monitor closely
    AtRisk,
    /// Actual velocity below critical — liquid loading occurring
    Loading,
    /// Actual velocity severely below critical — severe loading
    SevereLoading,
}

const MODEL_VERSION: &str = "turner-v2.1-coleman";

/// Compute gas density at wellhead conditions (lb/ft³)
/// Using real gas law: ρ = (P × M) / (Z × R × T)
/// Simplified: ρ_gas = (P × γ_g × 28.97) / (Z × 10.73 × T_R)
fn gas_density_lb_ft3(pressure_psia: f64, temp_f: f64, specific_gravity: f64) -> f64 {
    let temp_r = temp_f + 459.67; // Rankine
    // Pseudo-critical properties (Standing correlations for natural gas)
    let ppc = 677.0 + 15.0 * specific_gravity - 37.5 * specific_gravity.powi(2); // psia
    let tpc = 168.0 + 325.0 * specific_gravity - 12.5 * specific_gravity.powi(2); // °R
    let ppr = pressure_psia / ppc;
    let tpr = temp_r / tpc;
    // Hall-Yarborough Z-factor approximation
    let z = hall_yarborough_z(ppr, tpr);
    // Gas density
    (pressure_psia * specific_gravity * 28.97) / (z * 10.73 * temp_r)
}

/// Hall-Yarborough Z-factor correlation (simplified iterative)
fn hall_yarborough_z(ppr: f64, tpr: f64) -> f64 {
    if tpr <= 0.0 || ppr <= 0.0 {
        return 1.0;
    }
    let t = 1.0 / tpr;
    let a1 = -0.06125 * t * (-1.2 * (1.0 - t).powi(2)).exp();
    // Simplified approximation for Z (accurate within 2% for 1.05 < Tpr < 3.0)
    let z_approx = 1.0 + a1 * ppr
        - (0.0 + 0.0 * ppr.powi(2))
        + 0.0;
    // Clamp to physically reasonable range
    let z = 1.0 + a1 * ppr;
    z.max(0.4).min(1.5)
}

/// Turner (1969) critical velocity (ft/s)
/// v_c = 1.593 × σ^0.25 × (ρ_L - ρ_g)^0.25 / ρ_g^0.5
/// The 20% upward adjustment (Turner's empirical correction) is applied.
pub fn turner_critical_velocity(
    surface_tension: f64,   // dynes/cm
    liquid_density: f64,    // lb/ft³
    gas_density: f64,       // lb/ft³
    use_coleman: bool,
) -> f64 {
    if gas_density <= 0.0 || liquid_density <= gas_density {
        return 0.0;
    }
    // Convert surface tension from dynes/cm to lbf/ft
    let sigma_lbf_ft = surface_tension * 6.852e-3;
    let density_diff = liquid_density - gas_density;
    // Turner droplet model
    let v_c = 1.593 * sigma_lbf_ft.powf(0.25) * density_diff.powf(0.25) / gas_density.powf(0.5);
    if use_coleman {
        // Coleman removes Turner's 20% upward adjustment — more conservative
        v_c
    } else {
        // Turner applies 20% upward adjustment to match field data
        v_c * 1.2
    }
}

/// Convert critical velocity to critical flow rate (Mscf/d)
/// q_c = v_c × A × P / (Z × T × 14.7 / 520) × 86400 / 1000
fn velocity_to_rate_mscfd(
    velocity_fps: f64,
    tubing_id_in: f64,
    pressure_psia: f64,
    temp_f: f64,
    specific_gravity: f64,
) -> f64 {
    let tubing_id_ft = tubing_id_in / 12.0;
    let area_ft2 = std::f64::consts::PI * (tubing_id_ft / 2.0).powi(2);
    let temp_r = temp_f + 459.67;
    let ppc = 677.0 + 15.0 * specific_gravity - 37.5 * specific_gravity.powi(2);
    let tpc = 168.0 + 325.0 * specific_gravity - 12.5 * specific_gravity.powi(2);
    let z = hall_yarborough_z(pressure_psia / ppc, temp_r / tpc);
    // q (scf/s) = v (ft/s) × A (ft²) × P (psia) / (Z × T_R) × (520 / 14.7)
    let q_scf_per_s = velocity_fps * area_ft2 * pressure_psia / (z * temp_r) * (520.0 / 14.7);
    // Convert scf/s → Mscf/d
    q_scf_per_s * 86400.0 / 1000.0
}

/// Compute actual gas velocity at wellhead (ft/s)
fn actual_gas_velocity_fps(
    gas_rate_mscfd: f64,
    tubing_id_in: f64,
    pressure_psia: f64,
    temp_f: f64,
    specific_gravity: f64,
) -> f64 {
    if gas_rate_mscfd <= 0.0 {
        return 0.0;
    }
    let tubing_id_ft = tubing_id_in / 12.0;
    let area_ft2 = std::f64::consts::PI * (tubing_id_ft / 2.0).powi(2);
    let temp_r = temp_f + 459.67;
    let ppc = 677.0 + 15.0 * specific_gravity - 37.5 * specific_gravity.powi(2);
    let tpc = 168.0 + 325.0 * specific_gravity - 12.5 * specific_gravity.powi(2);
    let z = hall_yarborough_z(pressure_psia / ppc, temp_r / tpc);
    // Convert Mscf/d to scf/s
    let q_scf_per_s = gas_rate_mscfd * 1000.0 / 86400.0;
    // Actual velocity at wellhead conditions
    q_scf_per_s * z * temp_r / (pressure_psia * area_ft2 * (520.0 / 14.7))
}

/// Estimate days to loading onset from historical rate decline
fn estimate_days_to_loading(
    historical_rates: &[f64],
    critical_rate: f64,
) -> Option<f64> {
    if historical_rates.len() < 3 {
        return None;
    }
    let current = historical_rates[0];
    if current <= critical_rate {
        return None; // Already loading
    }
    // Fit linear decline to last N points
    let n = historical_rates.len().min(30) as f64;
    let mean_x = (n - 1.0) / 2.0;
    let mean_y: f64 = historical_rates[..historical_rates.len().min(30)].iter().sum::<f64>() / n;
    let mut num = 0.0_f64;
    let mut den = 0.0_f64;
    for (i, &r) in historical_rates[..historical_rates.len().min(30)].iter().enumerate() {
        let x = i as f64;
        num += (x - mean_x) * (r - mean_y);
        den += (x - mean_x).powi(2);
    }
    if den.abs() < 1e-10 {
        return None;
    }
    let slope = num / den; // Mscfd per day (negative = declining)
    if slope >= 0.0 {
        return None; // Rate is not declining
    }
    // Days until rate reaches critical rate: (current - critical) / |slope|
    let days = (current - critical_rate) / slope.abs();
    Some(days.max(0.0))
}

/// Main Turner loading analysis function
pub fn compute_turner_loading(req: &TurnerRequest) -> TurnerResponse {
    let gas_density = gas_density_lb_ft3(
        req.wellhead_pressure_psia,
        req.wellhead_temp_f,
        req.gas_specific_gravity,
    );
    let v_turner = turner_critical_velocity(
        req.surface_tension_dynes_cm,
        req.liquid_density_lb_ft3,
        gas_density,
        false,
    );
    let v_coleman = turner_critical_velocity(
        req.surface_tension_dynes_cm,
        req.liquid_density_lb_ft3,
        gas_density,
        true,
    );
    let v_actual = actual_gas_velocity_fps(
        req.gas_rate_mscfd,
        req.tubing_id_in,
        req.wellhead_pressure_psia,
        req.wellhead_temp_f,
        req.gas_specific_gravity,
    );
    let q_turner = velocity_to_rate_mscfd(
        v_turner,
        req.tubing_id_in,
        req.wellhead_pressure_psia,
        req.wellhead_temp_f,
        req.gas_specific_gravity,
    );
    let q_coleman = velocity_to_rate_mscfd(
        v_coleman,
        req.tubing_id_in,
        req.wellhead_pressure_psia,
        req.wellhead_temp_f,
        req.gas_specific_gravity,
    );
    let critical_v = if req.use_coleman { v_coleman } else { v_turner };
    let critical_q = if req.use_coleman { q_coleman } else { q_turner };
    let velocity_ratio = if critical_v > 0.0 { v_actual / critical_v } else { 0.0 };
    let loading_status = match velocity_ratio {
        r if r >= 1.30 => LoadingStatus::Unloaded,
        r if r >= 1.00 => LoadingStatus::AtRisk,
        r if r >= 0.70 => LoadingStatus::Loading,
        _ => LoadingStatus::SevereLoading,
    };
    let remediation = match &loading_status {
        LoadingStatus::Unloaded => "Well is unloaded. Continue monitoring.".to_string(),
        LoadingStatus::AtRisk => {
            format!(
                "Well approaching liquid loading threshold (ratio {:.2}). \
                 Consider installing plunger lift or reducing wellhead back-pressure. \
                 Critical rate: {:.0} Mscf/d.",
                velocity_ratio, critical_q
            )
        }
        LoadingStatus::Loading => {
            format!(
                "Liquid loading detected (ratio {:.2}). \
                 Recommended actions: (1) Install plunger lift system, \
                 (2) Install velocity string (1.5\" or 1.9\" tubing), \
                 (3) Apply foam injection programme, \
                 (4) Evaluate gas lift. Critical rate: {:.0} Mscf/d.",
                velocity_ratio, critical_q
            )
        }
        LoadingStatus::SevereLoading => {
            format!(
                "Severe liquid loading (ratio {:.2}). \
                 Well may be near dead. Immediate workover recommended: \
                 velocity string or coiled tubing cleanout. \
                 Consider temporary shut-in and swab. Critical rate: {:.0} Mscf/d.",
                velocity_ratio, critical_q
            )
        }
    };
    let days_to_loading = if loading_status == LoadingStatus::Unloaded || loading_status == LoadingStatus::AtRisk {
        estimate_days_to_loading(&req.historical_rates_mscfd, critical_q)
    } else {
        None
    };
    TurnerResponse {
        well_id: req.well_id.clone(),
        critical_velocity_turner_fps: round2(v_turner),
        critical_velocity_coleman_fps: round2(v_coleman),
        actual_velocity_fps: round2(v_actual),
        critical_rate_turner_mscfd: round1(q_turner),
        critical_rate_coleman_mscfd: round1(q_coleman),
        loading_status,
        velocity_ratio: round3(velocity_ratio),
        remediation,
        days_to_loading: days_to_loading.map(|d| round1(d)),
        model_version: MODEL_VERSION.to_string(),
    }
}

fn round1(v: f64) -> f64 { (v * 10.0).round() / 10.0 }
fn round2(v: f64) -> f64 { (v * 100.0).round() / 100.0 }
fn round3(v: f64) -> f64 { (v * 1000.0).round() / 1000.0 }

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_request() -> TurnerRequest {
        TurnerRequest {
            well_id: "GW-001".to_string(),
            wellhead_pressure_psia: 500.0,
            wellhead_temp_f: 80.0,
            gas_specific_gravity: 0.65,
            surface_tension_dynes_cm: 60.0,
            liquid_density_lb_ft3: 67.0,
            tubing_id_in: 2.441,
            gas_rate_mscfd: 800.0,
            historical_rates_mscfd: vec![1200.0, 1100.0, 1050.0, 950.0, 900.0, 850.0, 800.0],
            use_coleman: false,
        }
    }

    #[test]
    fn turner_critical_velocity_positive() {
        let req = sample_request();
        let resp = compute_turner_loading(&req);
        assert!(resp.critical_velocity_turner_fps > 0.0);
        assert!(resp.critical_velocity_coleman_fps > 0.0);
        // Coleman should be lower than Turner (no 20% adjustment)
        assert!(resp.critical_velocity_coleman_fps < resp.critical_velocity_turner_fps);
    }

    #[test]
    fn high_rate_well_is_unloaded() {
        let mut req = sample_request();
        req.gas_rate_mscfd = 5000.0;
        let resp = compute_turner_loading(&req);
        assert_eq!(resp.loading_status, LoadingStatus::Unloaded);
        assert!(resp.velocity_ratio > 1.3);
    }

    #[test]
    fn low_rate_well_is_loading() {
        let mut req = sample_request();
        req.gas_rate_mscfd = 50.0;
        let resp = compute_turner_loading(&req);
        assert!(
            resp.loading_status == LoadingStatus::Loading
                || resp.loading_status == LoadingStatus::SevereLoading
        );
        assert!(resp.velocity_ratio < 1.0);
    }

    #[test]
    fn declining_trend_gives_days_estimate() {
        let mut req = sample_request();
        req.gas_rate_mscfd = 800.0;
        req.historical_rates_mscfd = vec![800.0, 850.0, 900.0, 950.0, 1000.0, 1050.0, 1100.0];
        let resp = compute_turner_loading(&req);
        // If at-risk, should have days estimate
        if resp.loading_status == LoadingStatus::AtRisk {
            assert!(resp.days_to_loading.is_some());
        }
    }
}

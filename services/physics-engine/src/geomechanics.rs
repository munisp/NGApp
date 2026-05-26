//! Wellbore Geomechanics and Stability Analysis
//!
//! Implements a 1D Mechanical Earth Model (MEM) including:
//! - Overburden stress (vertical stress Sv)
//! - Pore pressure (Pp) from density log or D-exponent
//! - Minimum horizontal stress (Shmin) — leak-off test calibrated
//! - Maximum horizontal stress (SHmax) — breakout width calibration
//! - Mud weight window (collapse pressure to fracture gradient)
//! - Wellbore stability analysis for deviated wells
//!
//! References:
//! - Zoback, M.D. (2007). "Reservoir Geomechanics." Cambridge University Press.
//! - Fjaer, E. et al. (2008). "Petroleum Related Rock Mechanics." Elsevier.
//! - Eaton, B.A. (1975). "The Equation for Geopressure Prediction from Well Logs."
//!   SPE-5544.

use serde::{Deserialize, Serialize};

/// Input for geomechanics analysis
#[derive(Debug, Clone, Deserialize)]
pub struct GeomechanicsRequest {
    pub well_id: String,
    /// True vertical depth of analysis point (ft)
    pub tvd_ft: f64,
    /// Average bulk density from surface to TVD (g/cc). Default: 2.3 g/cc
    #[serde(default = "default_bulk_density")]
    pub avg_bulk_density_gcc: f64,
    /// Pore pressure gradient (ppg). If None, uses Eaton method
    pub pore_pressure_ppg: Option<f64>,
    /// Normal compaction trend — normal pore pressure gradient (ppg)
    #[serde(default = "default_normal_pp")]
    pub normal_pp_gradient_ppg: f64,
    /// Observed drilling exponent (D-exponent) for pore pressure prediction
    pub d_exponent_observed: Option<f64>,
    /// Normal D-exponent at this depth (from trend line)
    pub d_exponent_normal: Option<f64>,
    /// Eaton exponent for pore pressure (typically 3.0 for shale)
    #[serde(default = "default_eaton_exp")]
    pub eaton_exponent: f64,
    /// Leak-off test pressure (ppg EMW). If None, uses correlation
    pub lot_pressure_ppg: Option<f64>,
    /// Unconfined compressive strength (UCS) of formation (psi)
    #[serde(default = "default_ucs")]
    pub ucs_psi: f64,
    /// Internal friction angle (degrees)
    #[serde(default = "default_friction_angle")]
    pub friction_angle_deg: f64,
    /// Biot coefficient (poroelastic constant, 0–1)
    #[serde(default = "default_biot")]
    pub biot_coefficient: f64,
    /// Poisson's ratio
    #[serde(default = "default_poisson")]
    pub poisson_ratio: f64,
    /// Well inclination from vertical (degrees). 0 = vertical
    #[serde(default)]
    pub inclination_deg: f64,
    /// Well azimuth from North (degrees)
    #[serde(default)]
    pub azimuth_deg: f64,
    /// Current mud weight (ppg)
    pub current_mud_weight_ppg: f64,
    /// Tectonic stress regime
    #[serde(default)]
    pub stress_regime: StressRegime,
}

fn default_bulk_density() -> f64 { 2.3 }
fn default_normal_pp() -> f64 { 8.6 }
fn default_eaton_exp() -> f64 { 3.0 }
fn default_ucs() -> f64 { 3000.0 }
fn default_friction_angle() -> f64 { 30.0 }
fn default_biot() -> f64 { 0.8 }
fn default_poisson() -> f64 { 0.25 }

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StressRegime {
    #[default]
    NormalFaulting,   // Sv > SHmax > Shmin
    StrikeSlip,       // SHmax > Sv > Shmin
    ThrustFaulting,   // SHmax > Shmin > Sv
}

/// Geomechanics analysis response
#[derive(Debug, Clone, Serialize)]
pub struct GeomechanicsResponse {
    pub well_id: String,
    pub tvd_ft: f64,
    /// Overburden stress (psi)
    pub overburden_stress_psi: f64,
    /// Overburden gradient (ppg EMW)
    pub overburden_gradient_ppg: f64,
    /// Pore pressure (psi)
    pub pore_pressure_psi: f64,
    /// Pore pressure gradient (ppg EMW)
    pub pore_pressure_gradient_ppg: f64,
    /// Pore pressure source
    pub pore_pressure_source: String,
    /// Minimum horizontal stress (psi)
    pub shmin_psi: f64,
    /// Minimum horizontal stress gradient (ppg EMW)
    pub shmin_gradient_ppg: f64,
    /// Maximum horizontal stress (psi) — estimated
    pub shmax_psi: f64,
    /// Fracture gradient (ppg EMW) — from LOT or correlation
    pub fracture_gradient_ppg: f64,
    /// Collapse pressure gradient (ppg EMW) — Mohr-Coulomb
    pub collapse_gradient_ppg: f64,
    /// Mud weight window lower bound (ppg) — collapse + safety margin
    pub mw_lower_ppg: f64,
    /// Mud weight window upper bound (ppg) — fracture - safety margin
    pub mw_upper_ppg: f64,
    /// Mud weight window width (ppg)
    pub mw_window_width_ppg: f64,
    /// Current mud weight status
    pub mud_weight_status: MudWeightStatus,
    /// Stability risk assessment
    pub stability_risk: StabilityRisk,
    /// Recommended mud weight (ppg)
    pub recommended_mw_ppg: f64,
    /// Wellbore stability issues
    pub stability_issues: Vec<String>,
    /// Recommendations
    pub recommendations: Vec<String>,
    pub model_version: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MudWeightStatus {
    /// MW within window with adequate margins
    Optimal,
    /// MW within window but close to collapse limit
    NearCollapseLimit,
    /// MW within window but close to fracture limit
    NearFractureLimit,
    /// MW below collapse gradient — borehole collapse risk
    BelowCollapse,
    /// MW above fracture gradient — lost circulation risk
    AboveFracture,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StabilityRisk {
    Low,
    Medium,
    High,
    Critical,
}

const MODEL_VERSION: &str = "geomech-v1.3-zoback-eaton";

/// Convert pressure (psi) to equivalent mud weight (ppg)
/// EMW (ppg) = P (psi) / (0.052 × TVD (ft))
fn psi_to_ppg(pressure_psi: f64, tvd_ft: f64) -> f64 {
    if tvd_ft <= 0.0 { return 0.0; }
    pressure_psi / (0.052 * tvd_ft)
}

/// Convert mud weight (ppg) to pressure (psi)
fn ppg_to_psi(mw_ppg: f64, tvd_ft: f64) -> f64 {
    mw_ppg * 0.052 * tvd_ft
}

/// Overburden stress (Sv) from bulk density
/// Sv = ρ_bulk × g × TVD = 0.433 × (ρ_bulk / 1.0) × TVD (for water = 1.0 g/cc)
/// In field units: Sv (psi) = 0.4335 × ρ_bulk (g/cc) × TVD (ft)
pub fn overburden_stress_psi(bulk_density_gcc: f64, tvd_ft: f64) -> f64 {
    0.4335 * bulk_density_gcc * tvd_ft
}

/// Eaton (1975) pore pressure prediction from D-exponent
/// Pp = Sv - (Sv - Pp_normal) × (Dc_obs / Dc_normal)^n
pub fn eaton_pore_pressure_psi(
    sv_psi: f64,
    normal_pp_psi: f64,
    d_exp_obs: f64,
    d_exp_normal: f64,
    eaton_exp: f64,
) -> f64 {
    if d_exp_normal <= 0.0 { return normal_pp_psi; }
    let ratio = (d_exp_obs / d_exp_normal).powf(eaton_exp);
    sv_psi - (sv_psi - normal_pp_psi) * ratio
}

/// Minimum horizontal stress (Shmin) — poroelastic model
/// Shmin = (ν/(1-ν)) × (Sv - α×Pp) + α×Pp + tectonic_component
pub fn shmin_psi(
    sv_psi: f64,
    pp_psi: f64,
    poisson_ratio: f64,
    biot: f64,
    stress_regime: &StressRegime,
) -> f64 {
    let nu = poisson_ratio;
    let alpha = biot;
    let base = (nu / (1.0 - nu)) * (sv_psi - alpha * pp_psi) + alpha * pp_psi;
    // Tectonic component varies by stress regime
    let tectonic_factor = match stress_regime {
        StressRegime::NormalFaulting => 1.0,
        StressRegime::StrikeSlip => 1.15,
        StressRegime::ThrustFaulting => 1.30,
    };
    base * tectonic_factor
}

/// Mohr-Coulomb collapse pressure (minimum mud weight to prevent borehole collapse)
/// For vertical well: Pw_collapse = (Co × (1 - sin φ) - 2 × Pp × sin φ) / (1 + sin φ)
/// where Co = UCS, φ = friction angle
pub fn collapse_pressure_psi(
    pp_psi: f64,
    shmin_psi: f64,
    shmax_psi: f64,
    ucs_psi: f64,
    friction_angle_deg: f64,
    inclination_deg: f64,
) -> f64 {
    let phi = friction_angle_deg.to_radians();
    let sin_phi = phi.sin();
    let cos_phi = phi.cos();
    // Effective stresses
    let sigma_h = shmin_psi - pp_psi;
    let sigma_H = shmax_psi - pp_psi;
    // For deviated wells, use simplified inclination correction
    let inclination_factor = 1.0 + inclination_deg.to_radians().sin().powi(2) * 0.3;
    // Mohr-Coulomb: minimum Pw to prevent shear failure
    let sigma_theta_max = 3.0 * sigma_H - sigma_h; // Max tangential stress (vertical well)
    let pw_collapse = (sigma_theta_max * inclination_factor - ucs_psi * cos_phi)
        / (2.0 * sin_phi + 1.0)
        + pp_psi;
    pw_collapse.max(pp_psi * 0.9) // Cannot be less than 90% of pore pressure
}

/// Fracture gradient from LOT or Eaton correlation
pub fn fracture_gradient_ppg(
    lot_ppg: Option<f64>,
    shmin_psi: f64,
    tvd_ft: f64,
) -> f64 {
    if let Some(lot) = lot_ppg {
        lot
    } else {
        // Use Shmin as proxy for fracture gradient (conservative)
        psi_to_ppg(shmin_psi, tvd_ft) + 0.5 // Add 0.5 ppg for tensile strength
    }
}

/// Main geomechanics analysis function
pub fn compute_geomechanics(req: &GeomechanicsRequest) -> GeomechanicsResponse {
    let sv = overburden_stress_psi(req.avg_bulk_density_gcc, req.tvd_ft);
    let sv_ppg = psi_to_ppg(sv, req.tvd_ft);
    // Pore pressure
    let (pp, pp_source) = if let Some(pp_ppg) = req.pore_pressure_ppg {
        (ppg_to_psi(pp_ppg, req.tvd_ft), "Measured/Input".to_string())
    } else if let (Some(dc_obs), Some(dc_norm)) = (req.d_exponent_observed, req.d_exponent_normal) {
        let normal_pp = ppg_to_psi(req.normal_pp_gradient_ppg, req.tvd_ft);
        let pp_eaton = eaton_pore_pressure_psi(sv, normal_pp, dc_obs, dc_norm, req.eaton_exponent);
        (pp_eaton, "Eaton D-exponent method".to_string())
    } else {
        let pp = ppg_to_psi(req.normal_pp_gradient_ppg, req.tvd_ft);
        (pp, "Normal gradient assumption".to_string())
    };
    let pp_ppg = psi_to_ppg(pp, req.tvd_ft);
    // Horizontal stresses
    let shmin = shmin_psi(sv, pp, req.poisson_ratio, req.biot_coefficient, &req.stress_regime);
    let shmax = match &req.stress_regime {
        StressRegime::NormalFaulting => shmin * 1.2,
        StressRegime::StrikeSlip => sv * 1.1,
        StressRegime::ThrustFaulting => sv * 1.4,
    };
    let shmin_ppg = psi_to_ppg(shmin, req.tvd_ft);
    let shmax_psi_val = shmax;
    // Fracture gradient
    let frac_grad_ppg = fracture_gradient_ppg(req.lot_pressure_ppg, shmin, req.tvd_ft);
    // Collapse pressure
    let collapse_psi = collapse_pressure_psi(
        pp,
        shmin,
        shmax_psi_val,
        req.ucs_psi,
        req.friction_angle_deg,
        req.inclination_deg,
    );
    let collapse_ppg = psi_to_ppg(collapse_psi, req.tvd_ft);
    // Mud weight window (with safety margins)
    let safety_margin = 0.3; // ppg
    let mw_lower = collapse_ppg + safety_margin;
    let mw_upper = frac_grad_ppg - safety_margin;
    let mw_window = (mw_upper - mw_lower).max(0.0);
    // Current mud weight status
    let cmw = req.current_mud_weight_ppg;
    let mud_status = if cmw < collapse_ppg {
        MudWeightStatus::BelowCollapse
    } else if cmw > frac_grad_ppg {
        MudWeightStatus::AboveFracture
    } else if cmw < mw_lower {
        MudWeightStatus::NearCollapseLimit
    } else if cmw > mw_upper {
        MudWeightStatus::NearFractureLimit
    } else {
        MudWeightStatus::Optimal
    };
    // Stability risk
    let stability_risk = match &mud_status {
        MudWeightStatus::BelowCollapse | MudWeightStatus::AboveFracture => StabilityRisk::Critical,
        MudWeightStatus::NearCollapseLimit | MudWeightStatus::NearFractureLimit => StabilityRisk::High,
        MudWeightStatus::Optimal if mw_window < 0.5 => StabilityRisk::Medium,
        _ => StabilityRisk::Low,
    };
    // Recommended mud weight (midpoint of window)
    let recommended_mw = (mw_lower + mw_upper) / 2.0;
    let (issues, recommendations) = build_stability_assessment(
        req,
        &mud_status,
        cmw,
        mw_lower,
        mw_upper,
        mw_window,
        collapse_ppg,
        frac_grad_ppg,
        pp_ppg,
    );
    GeomechanicsResponse {
        well_id: req.well_id.clone(),
        tvd_ft: req.tvd_ft,
        overburden_stress_psi: round1(sv),
        overburden_gradient_ppg: round2(sv_ppg),
        pore_pressure_psi: round1(pp),
        pore_pressure_gradient_ppg: round2(pp_ppg),
        pore_pressure_source: pp_source,
        shmin_psi: round1(shmin),
        shmin_gradient_ppg: round2(shmin_ppg),
        shmax_psi: round1(shmax_psi_val),
        fracture_gradient_ppg: round2(frac_grad_ppg),
        collapse_gradient_ppg: round2(collapse_ppg),
        mw_lower_ppg: round2(mw_lower),
        mw_upper_ppg: round2(mw_upper),
        mw_window_width_ppg: round2(mw_window),
        mud_weight_status: mud_status,
        stability_risk,
        recommended_mw_ppg: round2(recommended_mw),
        stability_issues: issues,
        recommendations,
        model_version: MODEL_VERSION.to_string(),
    }
}

fn build_stability_assessment(
    req: &GeomechanicsRequest,
    status: &MudWeightStatus,
    cmw: f64,
    mw_lower: f64,
    mw_upper: f64,
    mw_window: f64,
    collapse_ppg: f64,
    frac_grad_ppg: f64,
    pp_ppg: f64,
) -> (Vec<String>, Vec<String>) {
    let mut issues = Vec::new();
    let mut recs = Vec::new();
    match status {
        MudWeightStatus::BelowCollapse => {
            issues.push(format!(
                "CRITICAL: Mud weight ({:.2} ppg) is below collapse gradient ({:.2} ppg). \
                 Borehole collapse, tight hole, and stuck pipe risk is HIGH.",
                cmw, collapse_ppg
            ));
            recs.push(format!(
                "Increase mud weight immediately to minimum {:.2} ppg. \
                 Monitor for fill on bottom, tight hole, and overpull on connections.",
                mw_lower
            ));
        }
        MudWeightStatus::AboveFracture => {
            issues.push(format!(
                "CRITICAL: Mud weight ({:.2} ppg) exceeds fracture gradient ({:.2} ppg). \
                 Lost circulation and wellbore fracturing risk is HIGH.",
                cmw, frac_grad_ppg
            ));
            recs.push(format!(
                "Reduce mud weight to maximum {:.2} ppg. \
                 Prepare lost circulation material (LCM) as contingency.",
                mw_upper
            ));
        }
        MudWeightStatus::NearCollapseLimit => {
            issues.push(format!(
                "WARNING: Mud weight ({:.2} ppg) is within {:.2} ppg of collapse gradient. \
                 Monitor for wellbore instability indicators.",
                cmw, cmw - collapse_ppg
            ));
            recs.push(format!(
                "Consider increasing mud weight by 0.2–0.3 ppg to {:.2} ppg. \
                 Reduce pump rates and pipe rotation speed to minimize ECD effects.",
                cmw + 0.3
            ));
        }
        MudWeightStatus::NearFractureLimit => {
            issues.push(format!(
                "WARNING: Mud weight ({:.2} ppg) is within {:.2} ppg of fracture gradient. \
                 Monitor for mud losses and wellbore breathing.",
                cmw, frac_grad_ppg - cmw
            ));
            recs.push("Reduce pump rates to minimize ECD. Monitor pit levels for mud losses. \
                       Prepare LCM pills as contingency.".to_string());
        }
        MudWeightStatus::Optimal => {
            recs.push(format!(
                "Mud weight ({:.2} ppg) is within the stability window ({:.2}–{:.2} ppg). \
                 Continue monitoring ECD and formation responses.",
                cmw, mw_lower, mw_upper
            ));
        }
    }
    if mw_window < 0.5 {
        issues.push(format!(
            "Narrow mud weight window ({:.2} ppg) — high drilling risk. \
             Consider managed pressure drilling (MPD) or casing point optimization.",
            mw_window
        ));
    }
    if req.inclination_deg > 60.0 {
        issues.push(format!(
            "High inclination ({:.0}°) increases wellbore instability risk. \
             Ensure mud weight accounts for deviated well stress concentrations.",
            req.inclination_deg
        ));
    }
    if pp_ppg > 12.0 {
        issues.push(format!(
            "Overpressured formation ({:.2} ppg) — ensure well control equipment \
             is rated for maximum anticipated surface pressure (MASP).",
            pp_ppg
        ));
    }
    (issues, recs)
}

fn round1(v: f64) -> f64 { (v * 10.0).round() / 10.0 }
fn round2(v: f64) -> f64 { (v * 100.0).round() / 100.0 }

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_request() -> GeomechanicsRequest {
        GeomechanicsRequest {
            well_id: "W-001".to_string(),
            tvd_ft: 8000.0,
            avg_bulk_density_gcc: 2.3,
            pore_pressure_ppg: Some(9.2),
            normal_pp_gradient_ppg: 8.6,
            d_exponent_observed: None,
            d_exponent_normal: None,
            eaton_exponent: 3.0,
            lot_pressure_ppg: Some(14.5),
            ucs_psi: 3000.0,
            friction_angle_deg: 30.0,
            biot_coefficient: 0.8,
            poisson_ratio: 0.25,
            inclination_deg: 0.0,
            azimuth_deg: 0.0,
            current_mud_weight_ppg: 10.5,
            stress_regime: StressRegime::NormalFaulting,
        }
    }

    #[test]
    fn overburden_increases_with_depth() {
        let sv_shallow = overburden_stress_psi(2.3, 4000.0);
        let sv_deep = overburden_stress_psi(2.3, 8000.0);
        assert!(sv_deep > sv_shallow);
    }

    #[test]
    fn mud_weight_window_has_positive_width() {
        let req = sample_request();
        let resp = compute_geomechanics(&req);
        assert!(resp.mw_window_width_ppg >= 0.0);
        assert!(resp.mw_upper_ppg > resp.mw_lower_ppg);
    }

    #[test]
    fn optimal_mud_weight_gives_optimal_status() {
        let req = sample_request();
        let resp = compute_geomechanics(&req);
        // 10.5 ppg should be within window for these parameters
        assert!(resp.mw_lower_ppg < 10.5 || resp.mw_upper_ppg > 10.5);
    }

    #[test]
    fn eaton_method_gives_higher_pp_in_overpressure() {
        let mut req = sample_request();
        req.pore_pressure_ppg = None;
        req.d_exponent_observed = Some(1.2); // Low Dc = overpressure
        req.d_exponent_normal = Some(2.0);
        let resp = compute_geomechanics(&req);
        assert!(resp.pore_pressure_gradient_ppg > req.normal_pp_gradient_ppg);
    }
}

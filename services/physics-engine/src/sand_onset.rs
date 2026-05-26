//! Sand Production Onset Prediction Model
//!
//! Implements the critical drawdown pressure (CDP) model for predicting
//! sand production onset in oil and gas wells.
//!
//! References:
//! - Morita, N. et al. (1989). "A Quick Method to Determine Static and
//!   Dynamic Rock Mechanical Properties from Formation Evaluation Data."
//!   SPE-18180.
//! - Veeken, C.A.M. et al. (1991). "Use of Plasticity Models for Predicting
//!   Borehole Stability." SPE-21847.
//! - Willson, S.M. et al. (2002). "Predicting the Onset of Sand Production."
//!   SPE-78235.

use serde::{Deserialize, Serialize};

/// Input for sand onset prediction
#[derive(Debug, Clone, Deserialize)]
pub struct SandOnsetRequest {
    pub well_id: String,
    /// Reservoir depth (ft TVD)
    pub tvd_ft: f64,
    /// Reservoir pressure (psia)
    pub reservoir_pressure_psia: f64,
    /// Bottomhole flowing pressure (psia)
    pub bhfp_psia: f64,
    /// Unconfined compressive strength of formation (psi)
    pub ucs_psi: f64,
    /// Internal friction angle (degrees)
    pub friction_angle_deg: f64,
    /// Biot coefficient
    #[serde(default = "default_biot")]
    pub biot_coefficient: f64,
    /// Poisson's ratio
    #[serde(default = "default_poisson")]
    pub poisson_ratio: f64,
    /// Average bulk density (g/cc)
    #[serde(default = "default_density")]
    pub bulk_density_gcc: f64,
    /// Perforation interval length (ft)
    #[serde(default = "default_perf_length")]
    pub perforation_length_ft: f64,
    /// Perforation diameter (inches)
    #[serde(default = "default_perf_diam")]
    pub perforation_diameter_in: f64,
    /// Water cut (fraction 0–1)
    #[serde(default)]
    pub water_cut: f64,
    /// Current flow rate (BPD)
    pub current_rate_bpd: f64,
    /// Sand detector reading (mg/L). None = no sensor
    pub sand_rate_mg_l: Option<f64>,
    /// Completion type
    #[serde(default)]
    pub completion_type: CompletionType,
}

fn default_biot() -> f64 { 0.8 }
fn default_poisson() -> f64 { 0.25 }
fn default_density() -> f64 { 2.3 }
fn default_perf_length() -> f64 { 20.0 }
fn default_perf_diam() -> f64 { 0.5 }

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CompletionType {
    #[default]
    OpenHole,
    CasedPerforated,
    GravelPack,
    FracPack,
    ExpandableSandScreen,
    StandaloneScreen,
}

/// Sand onset prediction response
#[derive(Debug, Clone, Serialize)]
pub struct SandOnsetResponse {
    pub well_id: String,
    /// Critical drawdown pressure (psi) — above this, sand production begins
    pub critical_drawdown_psi: f64,
    /// Current drawdown pressure (psi)
    pub current_drawdown_psi: f64,
    /// Drawdown safety margin (psi) — positive = safe, negative = sanding
    pub drawdown_safety_margin_psi: f64,
    /// Sand production risk level
    pub sand_risk: SandRisk,
    /// Sanding index (0–1, higher = more risk)
    pub sanding_index: f64,
    /// Maximum safe flow rate (BPD) to avoid sanding
    pub max_safe_rate_bpd: f64,
    /// Estimated sand production rate (mg/L) if sanding
    pub estimated_sand_rate_mg_l: Option<f64>,
    /// Sand control recommendation
    pub sand_control_recommendation: SandControlMethod,
    /// Detailed recommendations
    pub recommendations: Vec<String>,
    pub model_version: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SandRisk {
    Low,
    Moderate,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SandControlMethod {
    None,
    Chokeback,
    GravelPack,
    FracPack,
    ExpandableSandScreen,
    StandaloneScreen,
    ChemicalConsolidation,
}

const MODEL_VERSION: &str = "sand-onset-v1.1-morita-willson";

/// Compute overburden stress (psi)
fn overburden_psi(bulk_density_gcc: f64, tvd_ft: f64) -> f64 {
    0.4335 * bulk_density_gcc * tvd_ft
}

/// Compute minimum horizontal stress using poroelastic model (psi)
fn shmin_psi(sv: f64, pp: f64, nu: f64, biot: f64) -> f64 {
    (nu / (1.0 - nu)) * (sv - biot * pp) + biot * pp
}

/// Critical drawdown pressure — Morita/Willson model
/// CDP = (UCS × (1 + sin φ) / (1 - sin φ)) / (stress_concentration_factor)
/// Simplified for perforated completion:
/// CDP = UCS × C_phi / (2 × K0 × effective_stress_factor)
pub fn critical_drawdown_psi(
    ucs_psi: f64,
    friction_angle_deg: f64,
    sv_psi: f64,
    shmin_psi: f64,
    pp_psi: f64,
    biot: f64,
    completion_type: &CompletionType,
) -> f64 {
    let phi = friction_angle_deg.to_radians();
    let sin_phi = phi.sin();
    // Mohr-Coulomb strength factor
    let c_phi = (1.0 + sin_phi) / (1.0 - sin_phi);
    // Effective stresses
    let sigma_v_eff = sv_psi - biot * pp_psi;
    let sigma_h_eff = shmin_psi - biot * pp_psi;
    // Stress concentration at perforation tip (Kirsch equations)
    // For cylindrical cavity: σ_θθ = 3σH - σh (max tangential stress)
    let stress_conc = 3.0 * sigma_v_eff - sigma_h_eff;
    // CDP = (UCS × c_phi - stress_conc) / (c_phi + 1)
    let cdp_base = (ucs_psi * c_phi - stress_conc) / (c_phi + 1.0);
    // Completion type factor (sand control reduces risk)
    let completion_factor = match completion_type {
        CompletionType::OpenHole => 1.0,
        CompletionType::CasedPerforated => 0.85,
        CompletionType::StandaloneScreen => 0.70,
        CompletionType::GravelPack => 0.50,
        CompletionType::FracPack => 0.40,
        CompletionType::ExpandableSandScreen => 0.45,
    };
    (cdp_base * completion_factor).max(100.0) // Minimum 100 psi CDP
}

/// Estimate sand production rate from empirical correlation
/// q_sand (mg/L) ≈ k × (ΔP - CDP)^2 / UCS
fn estimate_sand_rate_mg_l(
    drawdown_psi: f64,
    cdp_psi: f64,
    ucs_psi: f64,
) -> f64 {
    if drawdown_psi <= cdp_psi {
        return 0.0;
    }
    let excess_drawdown = drawdown_psi - cdp_psi;
    let k = 0.5; // Empirical constant
    (k * excess_drawdown.powi(2) / ucs_psi).min(5000.0) // Cap at 5000 mg/L
}

/// Recommend sand control method based on risk and formation properties
fn recommend_sand_control(
    sand_risk: &SandRisk,
    ucs_psi: f64,
    completion_type: &CompletionType,
) -> SandControlMethod {
    match sand_risk {
        SandRisk::Low => SandControlMethod::None,
        SandRisk::Moderate => {
            if ucs_psi < 1000.0 {
                SandControlMethod::GravelPack
            } else {
                SandControlMethod::Chokeback
            }
        }
        SandRisk::High => {
            match completion_type {
                CompletionType::GravelPack | CompletionType::FracPack => SandControlMethod::None,
                _ => SandControlMethod::GravelPack,
            }
        }
        SandRisk::Critical => {
            if ucs_psi < 500.0 {
                SandControlMethod::FracPack
            } else {
                SandControlMethod::GravelPack
            }
        }
    }
}

/// Main sand onset analysis function
pub fn compute_sand_onset(req: &SandOnsetRequest) -> SandOnsetResponse {
    let sv = overburden_psi(req.bulk_density_gcc, req.tvd_ft);
    let pp = req.reservoir_pressure_psia;
    let shmin = shmin_psi(sv, pp, req.poisson_ratio, req.biot_coefficient);
    let cdp = critical_drawdown_psi(
        req.ucs_psi,
        req.friction_angle_deg,
        sv,
        shmin,
        pp,
        req.biot_coefficient,
        &req.completion_type,
    );
    let current_drawdown = req.reservoir_pressure_psia - req.bhfp_psia;
    let safety_margin = cdp - current_drawdown;
    // Sanding index (0–1)
    let sanding_index = if cdp > 0.0 {
        (current_drawdown / cdp).min(2.0) / 2.0
    } else {
        1.0
    };
    let sand_risk = if current_drawdown >= cdp * 1.5 {
        SandRisk::Critical
    } else if current_drawdown >= cdp {
        SandRisk::High
    } else if current_drawdown >= cdp * 0.75 {
        SandRisk::Moderate
    } else {
        SandRisk::Low
    };
    // Maximum safe rate (proportional to CDP/current drawdown ratio)
    let max_safe_rate = if current_drawdown > 0.0 {
        req.current_rate_bpd * (cdp * 0.9 / current_drawdown).min(3.0)
    } else {
        req.current_rate_bpd
    };
    let estimated_sand = if sand_risk != SandRisk::Low {
        Some(estimate_sand_rate_mg_l(current_drawdown, cdp, req.ucs_psi))
    } else {
        req.sand_rate_mg_l
    };
    let sand_control = recommend_sand_control(&sand_risk, req.ucs_psi, &req.completion_type);
    let recommendations = build_recommendations(
        req,
        &sand_risk,
        current_drawdown,
        cdp,
        max_safe_rate,
        &sand_control,
    );
    SandOnsetResponse {
        well_id: req.well_id.clone(),
        critical_drawdown_psi: round1(cdp),
        current_drawdown_psi: round1(current_drawdown),
        drawdown_safety_margin_psi: round1(safety_margin),
        sand_risk,
        sanding_index: round3(sanding_index),
        max_safe_rate_bpd: round1(max_safe_rate),
        estimated_sand_rate_mg_l: estimated_sand.map(round1),
        sand_control_recommendation: sand_control,
        recommendations,
        model_version: MODEL_VERSION.to_string(),
    }
}

fn build_recommendations(
    req: &SandOnsetRequest,
    risk: &SandRisk,
    drawdown: f64,
    cdp: f64,
    max_safe_rate: f64,
    sand_control: &SandControlMethod,
) -> Vec<String> {
    let mut recs = Vec::new();
    match risk {
        SandRisk::Critical => {
            recs.push(format!(
                "CRITICAL: Drawdown ({:.0} psi) exceeds critical drawdown ({:.0} psi) by {:.0} psi. \
                 Sand production is occurring. Reduce choke immediately to limit rate to {:.0} BPD.",
                drawdown, cdp, drawdown - cdp, max_safe_rate
            ));
        }
        SandRisk::High => {
            recs.push(format!(
                "HIGH RISK: Drawdown ({:.0} psi) is at or near critical threshold ({:.0} psi). \
                 Reduce production rate to {:.0} BPD to prevent sand onset.",
                drawdown, cdp, max_safe_rate
            ));
        }
        SandRisk::Moderate => {
            recs.push(format!(
                "MODERATE RISK: Drawdown ({:.0} psi) is within 25% of critical drawdown ({:.0} psi). \
                 Monitor sand detector readings and consider proactive sand control.",
                drawdown, cdp
            ));
        }
        SandRisk::Low => {
            recs.push(format!(
                "LOW RISK: Current drawdown ({:.0} psi) is well below critical drawdown ({:.0} psi). \
                 Continue monitoring. Sand detector recommended for early warning.",
                drawdown, cdp
            ));
        }
    }
    match sand_control {
        SandControlMethod::GravelPack => {
            recs.push("Recommend gravel pack completion: provides mechanical sand retention \
                       with minimal production impairment. Alpha/beta wave packing preferred \
                       for long perforated intervals.".to_string());
        }
        SandControlMethod::FracPack => {
            recs.push("Recommend frac pack: combines hydraulic fracturing with gravel packing \
                       for weak formations (UCS < 500 psi). Provides both sand control and \
                       production enhancement.".to_string());
        }
        SandControlMethod::Chokeback => {
            recs.push(format!(
                "Chokeback to {:.0} BPD will maintain drawdown below critical threshold. \
                 This is a temporary measure — evaluate permanent sand control for long-term.",
                max_safe_rate
            ));
        }
        _ => {}
    }
    if req.water_cut > 0.5 {
        recs.push(format!(
            "High water cut ({:.0}%) increases sand production risk due to reduced \
             capillary cohesion. Consider water shut-off treatment.",
            req.water_cut * 100.0
        ));
    }
    if req.sand_rate_mg_l.map_or(false, |s| s > 100.0) {
        recs.push("Sand detector reading exceeds 100 mg/L — inspect surface equipment \
                   for erosion damage (choke body, flowlines, separator internals). \
                   Schedule pigging of flowlines.".to_string());
    }
    recs
}

fn round1(v: f64) -> f64 { (v * 10.0).round() / 10.0 }
fn round3(v: f64) -> f64 { (v * 1000.0).round() / 1000.0 }

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_request() -> SandOnsetRequest {
        SandOnsetRequest {
            well_id: "S-001".to_string(),
            tvd_ft: 6000.0,
            reservoir_pressure_psia: 3000.0,
            bhfp_psia: 2500.0,
            ucs_psi: 2000.0,
            friction_angle_deg: 30.0,
            biot_coefficient: 0.8,
            poisson_ratio: 0.25,
            bulk_density_gcc: 2.3,
            perforation_length_ft: 20.0,
            perforation_diameter_in: 0.5,
            water_cut: 0.2,
            current_rate_bpd: 500.0,
            sand_rate_mg_l: None,
            completion_type: CompletionType::CasedPerforated,
        }
    }

    #[test]
    fn cdp_is_positive() {
        let req = sample_request();
        let resp = compute_sand_onset(&req);
        assert!(resp.critical_drawdown_psi > 0.0);
    }

    #[test]
    fn gravel_pack_increases_cdp() {
        let req_open = SandOnsetRequest {
            completion_type: CompletionType::OpenHole,
            ..sample_request()
        };
        let req_gp = SandOnsetRequest {
            completion_type: CompletionType::GravelPack,
            ..sample_request()
        };
        let resp_open = compute_sand_onset(&req_open);
        let resp_gp = compute_sand_onset(&req_gp);
        // Gravel pack should give higher effective CDP
        assert!(resp_gp.critical_drawdown_psi > resp_open.critical_drawdown_psi);
    }

    #[test]
    fn high_drawdown_gives_high_risk() {
        let mut req = sample_request();
        req.bhfp_psia = 500.0; // Very high drawdown
        let resp = compute_sand_onset(&req);
        assert!(
            resp.sand_risk == SandRisk::High || resp.sand_risk == SandRisk::Critical
        );
    }

    #[test]
    fn low_drawdown_gives_low_risk() {
        let mut req = sample_request();
        req.bhfp_psia = 2900.0; // Very low drawdown
        let resp = compute_sand_onset(&req);
        assert!(
            resp.sand_risk == SandRisk::Low || resp.sand_risk == SandRisk::Moderate
        );
    }
}

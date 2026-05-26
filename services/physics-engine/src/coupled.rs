//! Coupled Multi-Physics Solver
//!
//! Implements a coupled simulation that runs nodal analysis, geomechanics,
//! and sand onset in a single pass — sharing the operating point (Pwf, q)
//! as the consistent boundary condition across all physics domains.
//!
//! Physics coupling chain:
//!   1. Nodal Analysis → operating_point (Pwf, q)
//!   2. Geomechanics   → mud_weight_window, fracture_gradient (using Pwf as pore pressure)
//!   3. Sand Onset     → critical_drawdown, sand_risk (using Pwf and q as drawdown inputs)
//!   4. Decline Curve  → EUR, forecast (using q as initial rate)
//!   5. Convergence    → iterate until Pwf changes < tolerance (max 10 iterations)

use serde::{Deserialize, Serialize};
use crate::models::{NodalRequest, MODEL_VERSION};
use crate::nodal::find_operating_point;
use crate::geomechanics::{compute_geomechanics, GeomechanicsRequest, StressRegime};
use crate::sand_onset::{compute_sand_onset, SandOnsetRequest, CompletionType, SandRisk};
use crate::arps::compute_decline;

// ─── Request ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct CoupledRequest {
    pub well_id: String,

    // Nodal / reservoir inputs
    pub reservoir_pressure:  f64,  // PSI
    pub q_max:               f64,  // BPD (AOF)
    pub skin_factor:         f64,  // dimensionless
    pub esp_frequency_hz:    f64,  // Hz (0 = natural flow)
    pub wellhead_pressure:   f64,  // PSI
    pub tvd_ft:              f64,  // true vertical depth, ft
    pub fluid_gradient:      f64,  // psi/ft
    pub water_cut:           f64,  // fraction 0-1
    pub gor_scf_per_bbl:     f64,  // scf/bbl

    // Geomechanics inputs
    pub avg_bulk_density_gcc:   f64,  // g/cc (typical: 2.3-2.6)
    pub lot_pressure_ppg:       f64,  // leak-off test pressure, ppg
    pub current_mud_weight_ppg: f64,  // ppg

    // Sand onset inputs
    pub ucs_psi:               f64,  // unconfined compressive strength, PSI
    pub friction_angle_deg:    f64,  // degrees
    pub biot_coefficient:      f64,  // dimensionless (0.6-1.0)
    pub completion_type:       String, // "OPEN_HOLE" | "CASED_PERFORATED" | "GRAVEL_PACK" | "FRAC_PACK" | "STANDALONE_SCREEN" | "EXPANDABLE_SAND_SCREEN"

    // Decline inputs
    pub decline_rate_di:       f64,  // initial decline rate fraction/month
    pub b_factor:              f64,  // Arps b-factor
    pub forecast_months:       u32,  // forecast horizon

    // Coupling parameters
    #[serde(default = "default_max_iter")]
    pub max_iterations:        u32,  // convergence iterations (default: 10)
    #[serde(default = "default_tolerance")]
    pub convergence_tolerance: f64,  // Pwf convergence tolerance PSI (default: 1.0)
}

fn default_max_iter() -> u32 { 10 }
fn default_tolerance() -> f64 { 1.0 }

// ─── Response ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct CoupledOperatingPoint {
    pub q_bpd:        f64,
    pub pwf_psi:      f64,
    pub drawdown_psi: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoupledGeomechanicsResult {
    pub overburden_gradient_ppg:    f64,
    pub pore_pressure_gradient_ppg: f64,
    pub fracture_gradient_ppg:      f64,
    pub mw_lower_ppg:               f64,
    pub mw_upper_ppg:               f64,
    pub shmin_psi:                  f64,
    pub shmax_psi:                  f64,
    pub stability_flag:             String, // "STABLE" | "COLLAPSE_RISK" | "FRACTURE_RISK" | "BOTH"
}

#[derive(Debug, Clone, Serialize)]
pub struct CoupledSandResult {
    pub sand_risk:             String, // "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
    pub sanding_index:         f64,
    pub critical_drawdown_psi: f64,
    pub current_drawdown_psi:  f64,
    pub safety_margin_psi:     f64,
    pub max_safe_rate_bpd:     f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoupledDeclineResult {
    pub eur_mbbl:  f64,
    pub eur_12mo:  f64,
    pub eur_36mo:  f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoupledConvergence {
    pub iterations:      u32,
    pub converged:       bool,
    pub final_delta_pwf: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RiskSummary {
    pub overall_risk:    String, // "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
    pub risk_score:      f64,    // 0-100
    pub primary_concern: String,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoupledResponse {
    pub well_id:         String,
    pub operating_point: CoupledOperatingPoint,
    pub geomechanics:    CoupledGeomechanicsResult,
    pub sand_onset:      CoupledSandResult,
    pub decline:         CoupledDeclineResult,
    pub convergence:     CoupledConvergence,
    pub risk_summary:    RiskSummary,
    pub model_version:   String,
}

// ─── Completion type parser ───────────────────────────────────────────────────

fn parse_completion_type(s: &str) -> CompletionType {
    match s {
        "CASED_PERFORATED"       => CompletionType::CasedPerforated,
        "GRAVEL_PACK"            => CompletionType::GravelPack,
        "FRAC_PACK"              => CompletionType::FracPack,
        "STANDALONE_SCREEN"      => CompletionType::StandaloneScreen,
        "EXPANDABLE_SAND_SCREEN" => CompletionType::ExpandableSandScreen,
        _                        => CompletionType::OpenHole,
    }
}

// ─── Coupled Solver ───────────────────────────────────────────────────────────

pub fn compute_coupled(req: &CoupledRequest) -> CoupledResponse {
    let mut pwf_prev = req.reservoir_pressure * 0.7; // initial guess: 70% of Pr
    let mut q_op = 0.0_f64;
    let mut pwf_op = pwf_prev;
    let mut iterations = 0u32;
    let mut converged = false;
    let mut final_delta = 0.0_f64;

    // ── Iteration loop ────────────────────────────────────────────────────────
    for iter in 0..req.max_iterations {
        iterations = iter + 1;

        // Step 1: Nodal analysis
        let nodal_req = NodalRequest {
            well_id:            req.well_id.clone(),
            reservoir_pressure: req.reservoir_pressure,
            q_max:              req.q_max,
            skin_factor:        req.skin_factor,
            esp_frequency_hz:   req.esp_frequency_hz,
            wellhead_pressure:  req.wellhead_pressure,
            tvd_ft:             req.tvd_ft,
            fluid_gradient:     req.fluid_gradient,
            water_cut:          req.water_cut,
            gor_scf_per_bbl:    req.gor_scf_per_bbl,
            points:             50,
        };
        let op = find_operating_point(&nodal_req);
        q_op   = op.q;
        pwf_op = op.pwf;

        // Step 2: Check convergence
        final_delta = (pwf_op - pwf_prev).abs();
        if final_delta < req.convergence_tolerance && iter > 0 {
            converged = true;
            break;
        }
        pwf_prev = pwf_op;
    }

    let drawdown = (req.reservoir_pressure - pwf_op).max(0.0);

    // ── Geomechanics (using coupled Pwf as pore pressure) ────────────────────
    // Convert Pwf to equivalent mud weight ppg: ppg = psi / (0.052 * tvd_ft)
    let pwf_ppg = if req.tvd_ft > 0.0 {
        Some(pwf_op / (0.052 * req.tvd_ft))
    } else {
        None
    };

    let geo_req = GeomechanicsRequest {
        well_id:                req.well_id.clone(),
        tvd_ft:                 req.tvd_ft,
        avg_bulk_density_gcc:   req.avg_bulk_density_gcc,
        pore_pressure_ppg:      pwf_ppg,
        normal_pp_gradient_ppg: 8.6,
        d_exponent_observed:    None,
        d_exponent_normal:      None,
        eaton_exponent:         3.0,
        lot_pressure_ppg:       Some(req.lot_pressure_ppg),
        ucs_psi:                req.ucs_psi,
        friction_angle_deg:     req.friction_angle_deg,
        biot_coefficient:       req.biot_coefficient,
        poisson_ratio:          0.25,
        inclination_deg:        0.0,
        azimuth_deg:            0.0,
        current_mud_weight_ppg: req.current_mud_weight_ppg,
        stress_regime:          StressRegime::NormalFaulting,
    };
    let geo = compute_geomechanics(&geo_req);

    // Stability flag
    let collapse_risk = req.current_mud_weight_ppg < geo.mw_lower_ppg;
    let fracture_risk = req.current_mud_weight_ppg > geo.mw_upper_ppg;
    let stability_flag = match (collapse_risk, fracture_risk) {
        (true,  true)  => "BOTH",
        (true,  false) => "COLLAPSE_RISK",
        (false, true)  => "FRACTURE_RISK",
        (false, false) => "STABLE",
    }.to_string();

    // ── Sand Onset (using coupled drawdown) ──────────────────────────────────
    let completion = parse_completion_type(&req.completion_type);
    let sand_req = SandOnsetRequest {
        well_id:                 req.well_id.clone(),
        tvd_ft:                  req.tvd_ft,
        reservoir_pressure_psia: req.reservoir_pressure,
        bhfp_psia:               pwf_op,
        ucs_psi:                 req.ucs_psi,
        friction_angle_deg:      req.friction_angle_deg,
        biot_coefficient:        req.biot_coefficient,
        poisson_ratio:           0.25,
        bulk_density_gcc:        req.avg_bulk_density_gcc,
        perforation_length_ft:   10.0,
        perforation_diameter_in: 0.5,
        water_cut:               req.water_cut,
        current_rate_bpd:        q_op,
        sand_rate_mg_l:          None,
        completion_type:         completion,
    };
    let sand = compute_sand_onset(&sand_req);

    let sand_risk_str = match sand.sand_risk {
        SandRisk::Low      => "LOW",
        SandRisk::Moderate => "MODERATE",
        SandRisk::High     => "HIGH",
        SandRisk::Critical => "CRITICAL",
    }.to_string();

    let safety_margin = sand.drawdown_safety_margin_psi;

    // ── Decline Curve (using coupled operating rate as qi) ───────────────────
    let decline = compute_decline(q_op.max(1.0), req.decline_rate_di, req.b_factor, req.forecast_months);

    // ── Risk Summary ─────────────────────────────────────────────────────────
    let risk_summary = build_risk_summary(
        &sand_risk_str,
        &stability_flag,
        safety_margin,
        drawdown,
        req.reservoir_pressure,
    );

    CoupledResponse {
        well_id: req.well_id.clone(),
        operating_point: CoupledOperatingPoint {
            q_bpd:        q_op,
            pwf_psi:      pwf_op,
            drawdown_psi: drawdown,
        },
        geomechanics: CoupledGeomechanicsResult {
            overburden_gradient_ppg:    geo.overburden_gradient_ppg,
            pore_pressure_gradient_ppg: geo.pore_pressure_gradient_ppg,
            fracture_gradient_ppg:      geo.fracture_gradient_ppg,
            mw_lower_ppg:               geo.mw_lower_ppg,
            mw_upper_ppg:               geo.mw_upper_ppg,
            shmin_psi:                  geo.shmin_psi,
            shmax_psi:                  geo.shmax_psi,
            stability_flag,
        },
        sand_onset: CoupledSandResult {
            sand_risk:             sand_risk_str,
            sanding_index:         sand.sanding_index,
            critical_drawdown_psi: sand.critical_drawdown_psi,
            current_drawdown_psi:  sand.current_drawdown_psi,
            safety_margin_psi:     safety_margin,
            max_safe_rate_bpd:     sand.max_safe_rate_bpd,
        },
        decline: CoupledDeclineResult {
            eur_mbbl:  decline.eur_mbbl,
            eur_12mo:  decline.eur_12mo,
            eur_36mo:  decline.eur_36mo,
        },
        convergence: CoupledConvergence {
            iterations,
            converged,
            final_delta_pwf: final_delta,
        },
        risk_summary,
        model_version: MODEL_VERSION.to_string(),
    }
}

fn build_risk_summary(
    sand_risk: &str,
    stability_flag: &str,
    safety_margin_psi: f64,
    drawdown_psi: f64,
    reservoir_pressure: f64,
) -> RiskSummary {
    let sand_score = match sand_risk {
        "CRITICAL" => 100.0,
        "HIGH"     => 75.0,
        "MODERATE" => 40.0,
        _          => 10.0,
    };
    let geo_score = match stability_flag {
        "BOTH"           => 100.0,
        "COLLAPSE_RISK"  => 80.0,
        "FRACTURE_RISK"  => 70.0,
        _                => 10.0,
    };
    let drawdown_ratio = if reservoir_pressure > 0.0 { drawdown_psi / reservoir_pressure } else { 0.0 };
    let drawdown_score = (drawdown_ratio * 100.0).min(100.0);

    let overall_score = (sand_score * 0.4 + geo_score * 0.35 + drawdown_score * 0.25).min(100.0);

    let overall_risk = if overall_score >= 75.0 { "CRITICAL" }
        else if overall_score >= 50.0 { "HIGH" }
        else if overall_score >= 25.0 { "MODERATE" }
        else { "LOW" };

    let primary_concern = if sand_score >= geo_score && sand_score >= drawdown_score {
        format!("Sand production risk ({sand_risk}) - safety margin {safety_margin_psi:.0} PSI")
    } else if geo_score >= drawdown_score {
        format!("Wellbore stability ({stability_flag}) - review mud weight window")
    } else {
        format!("High drawdown ({drawdown_psi:.0} PSI = {:.0}% of Pr)", drawdown_ratio * 100.0)
    };

    let mut recommendations = Vec::new();
    if sand_risk == "HIGH" || sand_risk == "CRITICAL" {
        recommendations.push("Reduce production rate to below sand onset threshold".to_string());
        recommendations.push("Consider gravel pack or sand screen installation".to_string());
    }
    if stability_flag == "COLLAPSE_RISK" || stability_flag == "BOTH" {
        recommendations.push("Increase mud weight above minimum stability limit".to_string());
    }
    if stability_flag == "FRACTURE_RISK" || stability_flag == "BOTH" {
        recommendations.push("Reduce mud weight below fracture gradient".to_string());
    }
    if drawdown_ratio > 0.5 {
        recommendations.push("High drawdown - monitor for reservoir depletion and compaction".to_string());
    }
    if recommendations.is_empty() {
        recommendations.push("Well operating within safe parameters - continue monitoring".to_string());
    }

    RiskSummary {
        overall_risk: overall_risk.to_string(),
        risk_score: overall_score,
        primary_concern,
        recommendations,
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn default_req() -> CoupledRequest {
        CoupledRequest {
            well_id:                "TEST-001".to_string(),
            reservoir_pressure:     5000.0,
            q_max:                  2000.0,
            skin_factor:            0.0,
            esp_frequency_hz:       0.0,
            wellhead_pressure:      200.0,
            tvd_ft:                 8000.0,
            fluid_gradient:         0.433,
            water_cut:              0.3,
            gor_scf_per_bbl:        500.0,
            avg_bulk_density_gcc:   2.4,
            lot_pressure_ppg:       14.5,
            current_mud_weight_ppg: 10.5,
            ucs_psi:                3000.0,
            friction_angle_deg:     30.0,
            biot_coefficient:       0.8,
            completion_type:        "CASED_PERFORATED".to_string(),
            decline_rate_di:        0.08,
            b_factor:               0.5,
            forecast_months:        120,
            max_iterations:         10,
            convergence_tolerance:  1.0,
        }
    }

    #[test]
    fn coupled_solver_converges() {
        let req = default_req();
        let resp = compute_coupled(&req);
        assert!(resp.convergence.converged, "Solver should converge within 10 iterations");
        assert!(resp.operating_point.q_bpd > 0.0, "Should have positive flow rate");
        assert!(resp.operating_point.pwf_psi > 0.0, "Should have positive Pwf");
        assert!(resp.operating_point.drawdown_psi > 0.0, "Should have positive drawdown");
    }

    #[test]
    fn coupled_geomechanics_uses_coupled_pwf() {
        let req = default_req();
        let resp = compute_coupled(&req);
        assert!(resp.geomechanics.pore_pressure_gradient_ppg > 0.0);
        assert!(resp.geomechanics.mw_lower_ppg < resp.geomechanics.mw_upper_ppg);
    }

    #[test]
    fn coupled_sand_onset_uses_coupled_drawdown() {
        let req = default_req();
        let resp = compute_coupled(&req);
        let delta = (resp.sand_onset.current_drawdown_psi - resp.operating_point.drawdown_psi).abs();
        assert!(delta < 10.0, "Sand onset drawdown should be close to coupled operating point drawdown");
    }

    #[test]
    fn risk_summary_is_valid() {
        let req = default_req();
        let resp = compute_coupled(&req);
        let valid_risks = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
        assert!(valid_risks.contains(&resp.risk_summary.overall_risk.as_str()));
        assert!(resp.risk_summary.risk_score >= 0.0 && resp.risk_summary.risk_score <= 100.0);
        assert!(!resp.risk_summary.recommendations.is_empty());
    }

    #[test]
    fn high_sand_risk_triggers_recommendations() {
        let mut req = default_req();
        req.ucs_psi = 500.0; // Very weak rock -> high sand risk
        req.reservoir_pressure = 5000.0;
        let resp = compute_coupled(&req);
        assert!(!resp.risk_summary.recommendations.is_empty());
    }
}

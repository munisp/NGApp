//! Heavy Oil Reservoir Physics Models
//!
//! Implements viscosity-temperature correlations and thermal recovery
//! calculations for heavy oil (API < 20°) and extra-heavy oil (API < 10°).
//!
//! References:
//! - Beggs, H.D. & Robinson, J.R. (1975). "Estimating the Viscosity of
//!   Crude Oil Systems." JPT, 1140-1141.
//! - Glaso, O. (1980). "Generalized Pressure-Volume-Temperature Correlations."
//!   JPT, 785-795.
//! - Butler, R.M. (1991). "Thermal Recovery of Oil and Bitumen."
//!   Prentice Hall.
//! - Farouq Ali, S.M. (1982). "Steam Injection Theories."
//!   SPE-10746.

use serde::{Deserialize, Serialize};

/// Heavy oil characterization input
#[derive(Debug, Clone, Deserialize)]
pub struct HeavyOilRequest {
    pub well_id: String,
    /// API gravity of crude oil
    pub api_gravity: f64,
    /// Reservoir temperature (°F)
    pub reservoir_temp_f: f64,
    /// Reservoir pressure (psia)
    pub reservoir_pressure_psia: f64,
    /// Current production rate (BPD)
    pub current_rate_bpd: f64,
    /// Water cut (fraction 0–1)
    pub water_cut: f64,
    /// Gas-oil ratio (scf/bbl)
    pub gor_scf_per_bbl: f64,
    /// Steam injection rate (cold water equivalent, BPD). 0 = no steam injection
    #[serde(default)]
    pub steam_injection_cwe_bpd: f64,
    /// Steam quality (fraction 0–1, 0.8 = 80% steam quality)
    #[serde(default = "default_steam_quality")]
    pub steam_quality: f64,
    /// Reservoir thickness (ft)
    pub net_pay_ft: f64,
    /// Porosity (fraction)
    pub porosity_fraction: f64,
    /// Oil saturation (fraction)
    #[serde(default = "default_oil_saturation")]
    pub oil_saturation: f64,
    /// Recovery method
    #[serde(default)]
    pub recovery_method: RecoveryMethod,
}

fn default_steam_quality() -> f64 { 0.8 }
fn default_oil_saturation() -> f64 { 0.75 }

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecoveryMethod {
    #[default]
    PrimaryDepletion,
    CyclicSteamStimulation,
    SteamFlood,
    Sagd,
    InSituCombustion,
    PolymerFlood,
    SolventInjection,
}

/// Heavy oil analysis response
#[derive(Debug, Clone, Serialize)]
pub struct HeavyOilResponse {
    pub well_id: String,
    pub oil_classification: OilClassification,
    /// Dead oil viscosity at reservoir temperature (cP) — Beggs-Robinson
    pub dead_oil_viscosity_cp: f64,
    /// Live oil viscosity at reservoir conditions (cP) — Beggs-Robinson
    pub live_oil_viscosity_cp: f64,
    /// Viscosity at 60°F (surface conditions, cP)
    pub surface_viscosity_cp: f64,
    /// Steam-to-oil ratio (SOR) — barrels steam CWE per barrel oil
    pub steam_to_oil_ratio: Option<f64>,
    /// Estimated SAGD chamber temperature (°F)
    pub sagd_chamber_temp_f: Option<f64>,
    /// Estimated thermal efficiency (fraction)
    pub thermal_efficiency: Option<f64>,
    /// Original oil in place (OOIP) estimate (MSTB)
    pub ooip_mstb: f64,
    /// Recovery factor estimate for current method (fraction)
    pub recovery_factor: f64,
    /// Estimated ultimate recovery (EUR) (MSTB)
    pub eur_mstb: f64,
    /// Viscosity reduction needed for economic production (%)
    pub viscosity_reduction_needed_pct: f64,
    /// Recommended production optimization actions
    pub recommendations: Vec<String>,
    pub model_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OilClassification {
    /// API > 31.1°
    LightOil,
    /// 22.3° < API ≤ 31.1°
    MediumOil,
    /// 10° < API ≤ 22.3°
    HeavyOil,
    /// API ≤ 10°
    ExtraHeavyOilBitumen,
}

const MODEL_VERSION: &str = "heavy-oil-v1.2-beggs-robinson";

/// Beggs-Robinson (1975) dead oil viscosity correlation
/// μ_od = 10^X - 1  where X = 10^Y / T^1.163  and Y = 3.0324 - 0.02023 × API
pub fn beggs_robinson_dead_oil_viscosity(api: f64, temp_f: f64) -> f64 {
    if temp_f <= 0.0 { return 1e6; }
    let y = 3.0324 - 0.02023 * api;
    let x = 10_f64.powf(y) / temp_f.powf(1.163);
    let mu_od = 10_f64.powf(x) - 1.0;
    mu_od.max(0.01)
}

/// Beggs-Robinson live oil viscosity (with dissolved gas)
/// μ_o = A × μ_od^B  where A = 10.715 × (Rs + 100)^-0.515
///                         B = 5.44 × (Rs + 150)^-0.338
pub fn beggs_robinson_live_oil_viscosity(
    dead_oil_viscosity: f64,
    gor_scf_per_bbl: f64,
) -> f64 {
    let rs = gor_scf_per_bbl; // Solution GOR ≈ producing GOR for heavy oil
    let a = 10.715 * (rs + 100.0).powf(-0.515);
    let b = 5.44 * (rs + 150.0).powf(-0.338);
    (a * dead_oil_viscosity.powf(b)).max(0.01)
}

/// Classify oil by API gravity
fn classify_oil(api: f64) -> OilClassification {
    if api > 31.1 {
        OilClassification::LightOil
    } else if api > 22.3 {
        OilClassification::MediumOil
    } else if api > 10.0 {
        OilClassification::HeavyOil
    } else {
        OilClassification::ExtraHeavyOilBitumen
    }
}

/// Estimate OOIP using volumetric method (MSTB)
/// OOIP = 7758 × A × h × φ × So / Bo
/// Simplified: assume drainage area = 40 acres, Bo = 1.05 RB/STB for heavy oil
fn estimate_ooip_mstb(
    net_pay_ft: f64,
    porosity: f64,
    oil_saturation: f64,
) -> f64 {
    let drainage_area_acres = 40.0; // Standard 40-acre spacing
    let bo = 1.05; // Heavy oil FVF (low gas in solution)
    (7758.0 * drainage_area_acres * net_pay_ft * porosity * oil_saturation / bo) / 1000.0
}

/// Recovery factor by method (fraction of OOIP)
fn recovery_factor_by_method(method: &RecoveryMethod, api: f64) -> f64 {
    match method {
        RecoveryMethod::PrimaryDepletion => {
            if api < 10.0 { 0.05 } else if api < 15.0 { 0.08 } else { 0.12 }
        }
        RecoveryMethod::CyclicSteamStimulation => {
            if api < 10.0 { 0.15 } else { 0.20 }
        }
        RecoveryMethod::SteamFlood => {
            if api < 10.0 { 0.35 } else { 0.45 }
        }
        RecoveryMethod::Sagd => {
            if api < 10.0 { 0.55 } else { 0.60 }
        }
        RecoveryMethod::InSituCombustion => 0.40,
        RecoveryMethod::PolymerFlood => {
            if api < 15.0 { 0.18 } else { 0.25 }
        }
        RecoveryMethod::SolventInjection => {
            if api < 10.0 { 0.45 } else { 0.50 }
        }
    }
}

/// Steam-to-oil ratio (SOR) for steam injection methods
/// SOR = steam injected (CWE bbl) / oil produced (bbl)
fn compute_sor(
    steam_cwe_bpd: f64,
    oil_rate_bpd: f64,
) -> Option<f64> {
    if steam_cwe_bpd <= 0.0 || oil_rate_bpd <= 0.0 {
        return None;
    }
    Some((steam_cwe_bpd / oil_rate_bpd * 10.0).round() / 10.0)
}

/// SAGD chamber temperature estimate (°F)
/// Based on steam saturation temperature at injection pressure
/// T_sat ≈ 115.2 × P^0.225 (approximate for P in psia)
fn sagd_chamber_temp(reservoir_pressure_psia: f64, steam_quality: f64) -> f64 {
    // Injection pressure typically 80–90% of fracture gradient
    let injection_pressure = reservoir_pressure_psia * 0.85;
    let t_sat = 115.2 * injection_pressure.powf(0.225);
    // Effective temperature accounts for steam quality
    t_sat * (0.9 + 0.1 * steam_quality)
}

/// Thermal efficiency (fraction of injected heat that goes to heating oil)
fn thermal_efficiency(steam_quality: f64, sor: f64) -> f64 {
    // Higher SOR = lower efficiency
    let base_efficiency = 0.35 * steam_quality;
    let sor_penalty = (sor - 2.0).max(0.0) * 0.02;
    (base_efficiency - sor_penalty).max(0.05).min(0.60)
}

/// Minimum economic viscosity for pump-lifted production (~500 cP for ESP)
const MAX_ECONOMIC_VISCOSITY_CP: f64 = 500.0;

/// Main heavy oil analysis function
pub fn compute_heavy_oil(req: &HeavyOilRequest) -> HeavyOilResponse {
    let classification = classify_oil(req.api_gravity);
    let dead_oil_visc = beggs_robinson_dead_oil_viscosity(req.api_gravity, req.reservoir_temp_f);
    let live_oil_visc = beggs_robinson_live_oil_viscosity(dead_oil_visc, req.gor_scf_per_bbl);
    let surface_visc = beggs_robinson_dead_oil_viscosity(req.api_gravity, 60.0);
    let oil_rate_bpd = req.current_rate_bpd * (1.0 - req.water_cut);
    let sor = compute_sor(req.steam_injection_cwe_bpd, oil_rate_bpd);
    let sagd_temp = match &req.recovery_method {
        RecoveryMethod::Sagd | RecoveryMethod::SteamFlood | RecoveryMethod::CyclicSteamStimulation => {
            Some(sagd_chamber_temp(req.reservoir_pressure_psia, req.steam_quality))
        }
        _ => None,
    };
    let thermal_eff = sor.map(|s| thermal_efficiency(req.steam_quality, s));
    let ooip = estimate_ooip_mstb(req.net_pay_ft, req.porosity_fraction, req.oil_saturation);
    let rf = recovery_factor_by_method(&req.recovery_method, req.api_gravity);
    let eur = ooip * rf;
    let viscosity_reduction_needed = if live_oil_visc > MAX_ECONOMIC_VISCOSITY_CP {
        ((live_oil_visc - MAX_ECONOMIC_VISCOSITY_CP) / live_oil_visc * 100.0).round()
    } else {
        0.0
    };
    let recommendations = build_recommendations(
        req,
        live_oil_visc,
        &classification,
        sor.as_ref(),
        thermal_eff.as_ref(),
    );
    HeavyOilResponse {
        well_id: req.well_id.clone(),
        oil_classification: classification,
        dead_oil_viscosity_cp: round1(dead_oil_visc),
        live_oil_viscosity_cp: round1(live_oil_visc),
        surface_viscosity_cp: round1(surface_visc),
        steam_to_oil_ratio: sor,
        sagd_chamber_temp_f: sagd_temp.map(round1),
        thermal_efficiency: thermal_eff,
        ooip_mstb: round1(ooip),
        recovery_factor: rf,
        eur_mstb: round1(eur),
        viscosity_reduction_needed_pct: viscosity_reduction_needed,
        recommendations,
        model_version: MODEL_VERSION.to_string(),
    }
}

fn build_recommendations(
    req: &HeavyOilRequest,
    live_visc: f64,
    classification: &OilClassification,
    sor: Option<&f64>,
    thermal_eff: Option<&f64>,
) -> Vec<String> {
    let mut recs = Vec::new();
    // Viscosity management
    if live_visc > 10_000.0 {
        recs.push("Viscosity exceeds 10,000 cP — thermal recovery (SAGD or CSS) is the only \
                   economically viable production method. Consider steam injection programme.".to_string());
    } else if live_visc > 1_000.0 {
        recs.push(format!(
            "High viscosity ({:.0} cP) — evaluate downhole diluent injection (naphtha/condensate) \
             or ESP with viscosity-rated motor to maintain economic production rates.", live_visc
        ));
    } else if live_visc > 500.0 {
        recs.push(format!(
            "Viscosity ({:.0} cP) above ESP economic limit — consider progressive cavity pump (PCP) \
             or beam pump with viscosity-rated rod string.", live_visc
        ));
    }
    // Steam injection efficiency
    if let (Some(sor_val), Some(eff)) = (sor, thermal_eff) {
        if *sor_val > 5.0 {
            recs.push(format!(
                "Steam-to-oil ratio ({:.1}) is above economic threshold of 5.0. \
                 Evaluate steam conformance improvement (steam diverters, foam injection) \
                 to reduce SOR and improve thermal efficiency.", sor_val
            ));
        }
        if *eff < 0.20 {
            recs.push(format!(
                "Thermal efficiency ({:.0}%) is low. Review wellbore heat loss, \
                 insulate tubing string, and optimize steam quality at surface.", eff * 100.0
            ));
        }
    }
    // Recovery method recommendations
    match classification {
        OilClassification::ExtraHeavyOilBitumen => {
            recs.push("Extra-heavy oil/bitumen: SAGD is the preferred recovery method \
                       (recovery factor 50–65%). Ensure reservoir continuity and \
                       cap rock integrity before SAGD implementation.".to_string());
        }
        OilClassification::HeavyOil => {
            if req.steam_injection_cwe_bpd == 0.0 {
                recs.push("Heavy oil without thermal recovery: evaluate cyclic steam \
                           stimulation (CSS) as near-term uplift, transitioning to \
                           steam flood for long-term recovery improvement.".to_string());
            }
        }
        _ => {}
    }
    // Water cut management
    if req.water_cut > 0.7 {
        recs.push(format!(
            "High water cut ({:.0}%) — evaluate downhole oil-water separation (DOWS) \
             to reduce surface water handling costs and improve thermal efficiency.", req.water_cut * 100.0
        ));
    }
    if recs.is_empty() {
        recs.push("Well is operating within acceptable heavy oil parameters. \
                   Continue monitoring viscosity and SOR trends monthly.".to_string());
    }
    recs
}

fn round1(v: f64) -> f64 { (v * 10.0).round() / 10.0 }

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_request() -> HeavyOilRequest {
        HeavyOilRequest {
            well_id: "HO-001".to_string(),
            api_gravity: 14.0,
            reservoir_temp_f: 180.0,
            reservoir_pressure_psia: 800.0,
            current_rate_bpd: 200.0,
            water_cut: 0.3,
            gor_scf_per_bbl: 50.0,
            steam_injection_cwe_bpd: 0.0,
            steam_quality: 0.8,
            net_pay_ft: 50.0,
            porosity_fraction: 0.30,
            oil_saturation: 0.75,
            recovery_method: RecoveryMethod::PrimaryDepletion,
        }
    }

    #[test]
    fn heavy_oil_classified_correctly() {
        let req = sample_request();
        let resp = compute_heavy_oil(&req);
        assert!(matches!(resp.oil_classification, OilClassification::HeavyOil));
    }

    #[test]
    fn viscosity_positive_and_decreases_with_temperature() {
        let req = sample_request();
        let visc_hot = beggs_robinson_dead_oil_viscosity(14.0, 200.0);
        let visc_cold = beggs_robinson_dead_oil_viscosity(14.0, 100.0);
        assert!(visc_hot > 0.0);
        assert!(visc_cold > visc_hot, "Viscosity should decrease with temperature");
    }

    #[test]
    fn sagd_method_gives_higher_recovery_than_primary() {
        let mut req = sample_request();
        req.recovery_method = RecoveryMethod::Sagd;
        req.steam_injection_cwe_bpd = 400.0;
        let resp_sagd = compute_heavy_oil(&req);
        req.recovery_method = RecoveryMethod::PrimaryDepletion;
        req.steam_injection_cwe_bpd = 0.0;
        let resp_primary = compute_heavy_oil(&req);
        assert!(resp_sagd.recovery_factor > resp_primary.recovery_factor);
        assert!(resp_sagd.eur_mstb > resp_primary.eur_mstb);
    }

    #[test]
    fn sor_computed_when_steam_injected() {
        let mut req = sample_request();
        req.steam_injection_cwe_bpd = 400.0;
        req.recovery_method = RecoveryMethod::Sagd;
        let resp = compute_heavy_oil(&req);
        assert!(resp.steam_to_oil_ratio.is_some());
        assert!(resp.sagd_chamber_temp_f.is_some());
    }
}

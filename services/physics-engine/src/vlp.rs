//! Vertical Lift Performance (VLP) — Beggs-Brill Simplified
//!
//! Computes the wellhead-to-bottomhole pressure relationship as a function
//! of flow rate, accounting for hydrostatic, friction, and acceleration
//! pressure gradients in multiphase flow.
//!
//! This implementation uses the Beggs-Brill (1973) simplified correlation
//! for vertical upward flow with the Griffith correction for bubble flow.
//!
//! Reference: Beggs, H.D. & Brill, J.P. (1973). "A Study of Two-Phase Flow
//! in Inclined Pipes." JPT, 607-617.

use crate::models::CurvePoint;

/// Physical constants
const G: f64 = 32.174;   // ft/s²
const GC: f64 = 32.174;  // lbm·ft/(lbf·s²)

/// Fluid properties derived from inputs
pub struct FluidProps {
    pub oil_density:    f64,  // lbm/ft³
    pub water_density:  f64,  // lbm/ft³
    pub gas_density:    f64,  // lbm/ft³ (at average conditions)
    pub mixture_viscosity: f64, // cp
}

impl FluidProps {
    /// Construct from water cut and GOR with typical Gulf-region fluid properties.
    pub fn from_wc_gor(water_cut: f64, gor: f64) -> Self {
        // Typical Middle East crude: 35° API → ~52 lbm/ft³
        let oil_density   = 52.0;
        let water_density = 64.4;
        let gas_density   = 0.8;  // lbm/ft³ at ~2000 PSI average

        // Mixture viscosity: weighted by volume fraction
        let liquid_fraction = 1.0 - (gor / (gor + 5.615)).min(0.8);
        let oil_vis  = 2.0;   // cp (light crude)
        let water_vis = 0.5;  // cp
        let gas_vis   = 0.02; // cp
        let liq_vis = oil_vis * (1.0 - water_cut) + water_vis * water_cut;
        let mixture_viscosity = liq_vis * liquid_fraction + gas_vis * (1.0 - liquid_fraction);

        FluidProps { oil_density, water_density, gas_density, mixture_viscosity }
    }

    /// Liquid mixture density (lbm/ft³)
    pub fn liquid_density(&self, water_cut: f64) -> f64 {
        self.oil_density * (1.0 - water_cut) + self.water_density * water_cut
    }
}

/// Compute the flowing bottomhole pressure (Pwf) for a given surface flow rate.
///
/// Uses a simplified Beggs-Brill approach:
///   1. Compute in-situ liquid holdup (Hl) from flow regime
///   2. Compute mixture density
///   3. Integrate pressure gradient from wellhead to TD
pub fn beggs_brill_pwf(
    q_bpd:           f64,  // surface liquid rate
    wellhead_pressure: f64, // PSI
    tvd_ft:          f64,
    fluid_gradient:  f64,  // psi/ft (base hydrostatic gradient)
    water_cut:       f64,
    gor:             f64,  // scf/bbl
    esp_frequency:   f64,  // Hz (0 = natural flow, >0 = ESP boost)
) -> f64 {
    if q_bpd <= 0.0 {
        return wellhead_pressure + fluid_gradient * tvd_ft;
    }

    let props = FluidProps::from_wc_gor(water_cut, gor);
    let liq_density = props.liquid_density(water_cut);

    // Superficial velocities (ft/s) — pipe ID assumed 2.992" (2⅞" tubing)
    let pipe_id_ft = 2.992 / 12.0;
    let pipe_area  = std::f64::consts::PI * pipe_id_ft * pipe_id_ft / 4.0;
    let q_ft3_per_s = q_bpd * 5.615 / 86400.0;  // bbl/day → ft³/s
    let vsl = q_ft3_per_s / pipe_area;           // superficial liquid velocity

    // Gas superficial velocity
    let q_gas_ft3_per_s = q_bpd * gor / 5.615 / 86400.0;
    let vsg = q_gas_ft3_per_s / pipe_area;
    let vm  = vsl + vsg;  // mixture velocity

    // Froude number for flow regime determination
    let froude = vm * vm / (G * pipe_id_ft);

    // Liquid holdup (Hl) — Beggs-Brill correlation
    let lambda_l = vsl / vm.max(1e-6);
    let hl = liquid_holdup(lambda_l, froude);

    // Mixture density
    let rho_m = liq_density * hl + props.gas_density * (1.0 - hl);

    // Hydrostatic gradient (psi/ft)
    let hydrostatic_gradient = rho_m / 144.0;

    // Friction pressure gradient (psi/ft)
    let re = rho_m * vm * pipe_id_ft / (props.mixture_viscosity * 6.72e-4);
    let f_friction = moody_friction(re, pipe_id_ft);
    let friction_gradient = f_friction * rho_m * vm * vm / (2.0 * GC * pipe_id_ft * 144.0);

    // Total pressure gradient
    let total_gradient = hydrostatic_gradient + friction_gradient;

    // Pwf = Pwh + ΔP_hydrostatic + ΔP_friction - ESP_boost
    let dp = total_gradient * tvd_ft;
    let esp_boost = if esp_frequency > 0.0 {
        // ESP head: ~0.8 psi per Hz per 100 ft of pump stages (empirical)
        esp_frequency * 0.8 * (tvd_ft / 100.0).min(30.0)
    } else {
        0.0
    };

    (wellhead_pressure + dp - esp_boost).max(0.0)
}

/// Beggs-Brill liquid holdup correlation.
fn liquid_holdup(lambda_l: f64, froude: f64) -> f64 {
    // Segregated, intermittent, distributed flow regimes
    let (a, b, c) = if froude < 0.1 {
        (0.98, 0.4846, 0.0868)   // segregated
    } else if froude < 0.4 {
        (0.845, 0.5351, 0.0173)  // transition
    } else {
        (1.065, 0.5824, 0.0609)  // distributed
    };
    let hl_raw = a * lambda_l.powf(b) / froude.powf(c);
    hl_raw.clamp(lambda_l, 1.0)
}

/// Moody friction factor (Churchill approximation).
fn moody_friction(re: f64, d: f64) -> f64 {
    if re < 2100.0 {
        return 64.0 / re.max(1.0);
    }
    let roughness = 0.00015 / d;  // relative roughness (steel tubing)
    let a = (-2.457 * libm::log((7.0 / re).powf(0.9) + 0.27 * roughness)).exp();
    let b = (37530.0 / re).powi(16);
    let f = 8.0 * ((8.0 / re).powi(12) + 1.0 / (a + b).powf(1.5)).powf(1.0 / 12.0);
    f
}

/// Generate the full VLP curve: Pwf as a function of q.
pub fn vlp_curve(
    q_max:             f64,
    wellhead_pressure: f64,
    tvd_ft:            f64,
    fluid_gradient:    f64,
    water_cut:         f64,
    gor:               f64,
    esp_frequency:     f64,
    n:                 usize,
) -> Vec<CurvePoint> {
    (0..=n)
        .map(|i| {
            let q = q_max * (i as f64) / (n as f64);
            let pwf = beggs_brill_pwf(q, wellhead_pressure, tvd_ft, fluid_gradient, water_cut, gor, esp_frequency);
            CurvePoint { q, pwf }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn pwf_at_zero_rate_equals_hydrostatic() {
        let pwf = beggs_brill_pwf(0.0, 100.0, 5000.0, 0.433, 0.0, 500.0, 0.0);
        let expected = 100.0 + 0.433 * 5000.0;
        assert_relative_eq!(pwf, expected, epsilon = 50.0);
    }

    #[test]
    fn esp_boost_reduces_pwf() {
        let pwf_no_esp  = beggs_brill_pwf(500.0, 100.0, 5000.0, 0.433, 0.2, 500.0, 0.0);
        let pwf_with_esp = beggs_brill_pwf(500.0, 100.0, 5000.0, 0.433, 0.2, 500.0, 45.0);
        assert!(pwf_with_esp < pwf_no_esp, "ESP must reduce required Pwf");
    }

    #[test]
    fn vlp_curve_has_correct_length() {
        let curve = vlp_curve(1000.0, 100.0, 5000.0, 0.433, 0.2, 500.0, 0.0, 50);
        assert_eq!(curve.len(), 51);
    }
}

//! Sensitivity / Tornado Analysis
//!
//! Varies each input parameter by ±N% independently while holding all others
//! at their base values, then computes the resulting change in operating rate.
//! Results are sorted by absolute range (largest impact first) to produce the
//! classic "tornado chart" ordering.

use crate::models::{SensitivityBar, SensitivityRequest, SensitivityResponse, MODEL_VERSION};
use crate::nodal::find_operating_point;

struct Param {
    label: &'static str,
    get:   fn(&SensitivityRequest) -> f64,
    set:   fn(SensitivityRequest, f64) -> SensitivityRequest,
}

macro_rules! param {
    ($label:expr, $field:ident) => {
        Param {
            label: $label,
            get:   |r| r.$field,
            set:   |mut r, v| { r.$field = v; r },
        }
    };
}

fn all_params() -> Vec<Param> {
    vec![
        param!("Reservoir Pressure (PSI)", reservoir_pressure),
        param!("AOF / Qmax (BPD)",         q_max),
        param!("Skin Factor",              skin_factor),
        param!("ESP Frequency (Hz)",       esp_frequency_hz),
        param!("Fluid Gradient (psi/ft)",  fluid_gradient),
        param!("TVD (ft)",                 tvd_ft),
        param!("Wellhead Pressure (PSI)",  wellhead_pressure),
        param!("Water Cut",                water_cut),
    ]
}

/// Compute the operating rate for a given request configuration.
fn operating_rate(req: &SensitivityRequest) -> f64 {
    let nodal_req = crate::models::NodalRequest {
        well_id:            req.well_id.clone(),
        reservoir_pressure: req.reservoir_pressure,
        q_max:              req.q_max,
        skin_factor:        req.skin_factor,
        esp_frequency_hz:   req.esp_frequency_hz,
        wellhead_pressure:  req.wellhead_pressure,
        tvd_ft:             req.tvd_ft,
        fluid_gradient:     req.fluid_gradient,
        water_cut:          req.water_cut,
        gor_scf_per_bbl:    500.0,  // default GOR for sensitivity
        points:             50,
    };
    find_operating_point(&nodal_req).q
}

/// Run the full tornado analysis.
pub fn compute_sensitivity(req: SensitivityRequest) -> SensitivityResponse {
    let base_q = req.base_q_bpd;
    let v = req.variation_pct / 100.0;
    let params = all_params();

    let mut bars: Vec<SensitivityBar> = params
        .iter()
        .map(|p| {
            let base_val = (p.get)(&req);
            let low_val  = base_val * (1.0 - v);
            let high_val = base_val * (1.0 + v);

            let low_req  = (p.set)(req.clone(), low_val);
            let high_req = (p.set)(req.clone(), high_val);

            let low_q  = operating_rate(&low_req);
            let high_q = operating_rate(&high_req);

            let low_delta  = low_q  - base_q;
            let high_delta = high_q - base_q;
            let abs_range  = (high_delta - low_delta).abs();

            SensitivityBar {
                label: p.label.to_string(),
                low_delta,
                high_delta,
                abs_range,
            }
        })
        .collect();

    // Sort by absolute range descending (tornado ordering)
    bars.sort_by(|a, b| b.abs_range.partial_cmp(&a.abs_range).unwrap_or(std::cmp::Ordering::Equal));

    SensitivityResponse {
        bars,
        model_version: MODEL_VERSION.to_string(),
    }
}

// SensitivityRequest derives Clone via #[derive(Clone)] in models.rs

#[cfg(test)]
mod tests {
    use super::*;

    fn base_req() -> SensitivityRequest {
        SensitivityRequest {
            well_id:            "W-001".to_string(),
            base_q_bpd:         800.0,
            reservoir_pressure: 3000.0,
            q_max:              1200.0,
            skin_factor:        2.0,
            esp_frequency_hz:   45.0,
            fluid_gradient:     0.433,
            tvd_ft:             8000.0,
            wellhead_pressure:  200.0,
            water_cut:          0.3,
            variation_pct:      15.0,
        }
    }

    #[test]
    fn sensitivity_returns_eight_bars() {
        let resp = compute_sensitivity(base_req());
        assert_eq!(resp.bars.len(), 8);
    }

    #[test]
    fn bars_sorted_by_abs_range_descending() {
        let resp = compute_sensitivity(base_req());
        for w in resp.bars.windows(2) {
            assert!(w[0].abs_range >= w[1].abs_range, "Bars must be sorted by abs_range desc");
        }
    }

    #[test]
    fn reservoir_pressure_is_dominant_factor() {
        let resp = compute_sensitivity(base_req());
        // Reservoir pressure should be in the top 3 most impactful parameters
        let top3: Vec<&str> = resp.bars.iter().take(3).map(|b| b.label.as_str()).collect();
        assert!(
            top3.contains(&"Reservoir Pressure (PSI)") || top3.contains(&"AOF / Qmax (BPD)"),
            "Reservoir pressure or AOF must be in top 3: {:?}", top3
        );
    }
}

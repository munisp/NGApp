//! Nodal Analysis — IPR/VLP Intersection Solver
//!
//! Finds the operating point where the IPR and VLP curves intersect using
//! the bisection method on the pressure difference function:
//!
//!   f(q) = Pwf_IPR(q) - Pwf_VLP(q)
//!
//! The operating point is where f(q) = 0.

use crate::ipr::{effective_q_max, vogel_pwf};
use crate::vlp::beggs_brill_pwf;
use crate::models::{NodalRequest, NodalResponse, OperatingPoint, MODEL_VERSION};

/// Find the operating point (q, Pwf) where IPR and VLP intersect.
pub fn find_operating_point(req: &NodalRequest) -> OperatingPoint {
    let q_eff = effective_q_max(req.q_max, req.skin_factor);
    if q_eff <= 0.0 {
        return OperatingPoint { q: 0.0, pwf: req.reservoir_pressure };
    }

    // f(q) = Pwf_IPR(q) - Pwf_VLP(q)
    let f = |q: f64| -> f64 {
        let pwf_ipr = vogel_pwf(q, q_eff, req.reservoir_pressure).unwrap_or(0.0);
        let pwf_vlp = beggs_brill_pwf(
            q,
            req.wellhead_pressure,
            req.tvd_ft,
            req.fluid_gradient,
            req.water_cut,
            req.gor_scf_per_bbl,
            req.esp_frequency_hz,
        );
        pwf_ipr - pwf_vlp
    };

    // Check if the well can flow at all (VLP > IPR at q=0 means no flow)
    let f0 = f(0.0);
    if f0 < 0.0 {
        // VLP exceeds IPR even at zero rate — well cannot flow
        return OperatingPoint { q: 0.0, pwf: req.reservoir_pressure };
    }

    // Bisection method to find root of f(q) = 0
    let mut lo = 0.0_f64;
    let mut hi = q_eff;
    let tolerance = 0.1;  // BPD
    let max_iter  = 100;

    for _ in 0..max_iter {
        let mid = (lo + hi) / 2.0;
        if (hi - lo) < tolerance {
            let pwf = vogel_pwf(mid, q_eff, req.reservoir_pressure).unwrap_or(0.0);
            return OperatingPoint { q: mid, pwf };
        }
        if f(mid) > 0.0 {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    let q_op = (lo + hi) / 2.0;
    let pwf_op = vogel_pwf(q_op, q_eff, req.reservoir_pressure).unwrap_or(0.0);
    OperatingPoint { q: q_op, pwf: pwf_op }
}

/// Compute the full nodal analysis response.
pub fn compute_nodal(req: &NodalRequest) -> NodalResponse {
    use crate::ipr::ipr_curve;
    use crate::vlp::vlp_curve;

    let n = req.points.max(10).min(200);
    let q_eff = effective_q_max(req.q_max, req.skin_factor);

    let ipr = ipr_curve(req.q_max, req.skin_factor, req.reservoir_pressure, n);
    let vlp = vlp_curve(
        q_eff,
        req.wellhead_pressure,
        req.tvd_ft,
        req.fluid_gradient,
        req.water_cut,
        req.gor_scf_per_bbl,
        req.esp_frequency_hz,
        n,
    );

    let op = find_operating_point(req);

    // Baseline: same well with no ESP (frequency = 0)
    let baseline_req = NodalRequest {
        esp_frequency_hz: 0.0,
        ..req.clone()
    };
    let baseline_op = find_operating_point(&baseline_req);
    let delta_q = op.q - baseline_op.q;

    // Efficiency: operating rate / AOF
    let efficiency = if q_eff > 0.0 { (op.q / q_eff).min(1.0) } else { 0.0 };

    NodalResponse {
        ipr_curve:       ipr,
        vlp_curve:       vlp,
        operating_point: op,
        delta_q_bpd:     delta_q,
        efficiency,
        model_version:   MODEL_VERSION.to_string(),
    }
}

// NodalRequest derives Clone via #[derive(Clone)] in models.rs

#[cfg(test)]
mod tests {
    use super::*;

    fn test_req() -> NodalRequest {
        NodalRequest {
            well_id:            "W-001".to_string(),
            reservoir_pressure: 3000.0,
            q_max:              1200.0,
            skin_factor:        2.0,
            esp_frequency_hz:   45.0,
            wellhead_pressure:  200.0,
            tvd_ft:             8000.0,
            fluid_gradient:     0.433,
            water_cut:          0.2,
            gor_scf_per_bbl:    500.0,
            points:             50,
        }
    }

    #[test]
    fn operating_point_is_within_bounds() {
        let req = test_req();
        let op  = find_operating_point(&req);
        let q_eff = effective_q_max(req.q_max, req.skin_factor);
        assert!(op.q >= 0.0 && op.q <= q_eff, "Operating rate must be within [0, qmax_eff]");
        assert!(op.pwf >= 0.0 && op.pwf <= req.reservoir_pressure, "Pwf must be within [0, Pr]");
    }

    #[test]
    fn esp_increases_operating_rate() {
        let req_esp = test_req();
        let mut req_no_esp = test_req();
        req_no_esp.esp_frequency_hz = 0.0;

        let op_esp    = find_operating_point(&req_esp);
        let op_no_esp = find_operating_point(&req_no_esp);
        assert!(op_esp.q >= op_no_esp.q, "ESP must increase or maintain operating rate");
    }

    #[test]
    fn nodal_response_curves_have_correct_length() {
        let req  = test_req();
        let resp = compute_nodal(&req);
        assert_eq!(resp.ipr_curve.len(), 51);
        assert_eq!(resp.vlp_curve.len(), 51);
    }

    #[test]
    fn efficiency_is_between_zero_and_one() {
        let resp = compute_nodal(&test_req());
        assert!(resp.efficiency >= 0.0 && resp.efficiency <= 1.0);
    }
}

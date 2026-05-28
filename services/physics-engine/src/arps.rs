//! Arps Decline Curve Analysis
//!
//! Implements all three Arps (1945) decline types:
//!   - Exponential (b = 0):   q(t) = qi * exp(-Di * t)
//!   - Hyperbolic (0 < b < 1): q(t) = qi * (1 + b*Di*t)^(-1/b)
//!   - Harmonic (b = 1):      q(t) = qi / (1 + Di * t)
//!
//! Cumulative production is integrated analytically for each case.
//!
//! Reference: Arps, J.J. (1945). "Analysis of Decline Curves."
//! Trans. AIME, 160, 228-247.

use crate::models::{DeclinePoint, DeclineResponse, MODEL_VERSION};

/// Compute flow rate at time t (months) using Arps decline.
pub fn arps_rate(qi: f64, di: f64, b: f64, t: f64) -> f64 {
    if b.abs() < 1e-6 {
        // Exponential
        qi * libm::exp(-di * t)
    } else if (b - 1.0).abs() < 1e-6 {
        // Harmonic
        qi / (1.0 + di * t)
    } else {
        // Hyperbolic
        qi * (1.0 + b * di * t).powf(-1.0 / b)
    }
}

/// Compute cumulative production from t=0 to t (months) in BBL.
pub fn arps_cumulative(qi: f64, di: f64, b: f64, t: f64) -> f64 {
    if di <= 0.0 {
        return qi * t * 30.44;  // flat production
    }
    // Convert monthly rate to daily for cumulative in BBL
    let days = t * 30.44;
    let di_daily = di / 30.44;

    if b.abs() < 1e-6 {
        // Exponential: Np = qi/Di * (1 - exp(-Di*t))
        qi / di_daily * (1.0 - libm::exp(-di_daily * days))
    } else if (b - 1.0).abs() < 1e-6 {
        // Harmonic: Np = qi/Di * ln(1 + Di*t)
        qi / di_daily * libm::log(1.0 + di_daily * days)
    } else {
        // Hyperbolic: Np = qi^b / ((1-b)*Di) * (qi^(1-b) - q(t)^(1-b))
        let qt = arps_rate(qi, di, b, t);
        (qi.powf(b) / ((1.0 - b) * di_daily)) * (qi.powf(1.0 - b) - qt.powf(1.0 - b))
    }
}

/// Generate the full decline forecast.
pub fn compute_decline(qi: f64, di: f64, b: f64, months: u32) -> DeclineResponse {
    let b_clamped = b.clamp(0.0, 2.0);
    let di_safe   = di.max(0.0);

    let points: Vec<DeclinePoint> = (0..=months)
        .map(|m| {
            let t = m as f64;
            let rate = arps_rate(qi, di_safe, b_clamped, t);
            let cum  = arps_cumulative(qi, di_safe, b_clamped, t);
            DeclinePoint {
                month:           m,
                rate_bpd:        rate.max(0.0),
                cumulative_mbbl: cum / 1000.0,
            }
        })
        .collect();

    let eur_mbbl  = arps_cumulative(qi, di_safe, b_clamped, months as f64) / 1000.0;
    let eur_12mo  = arps_cumulative(qi, di_safe, b_clamped, 12.0) / 1000.0;
    let eur_36mo  = arps_cumulative(qi, di_safe, b_clamped, 36.0) / 1000.0;

    DeclineResponse {
        points,
        eur_mbbl,
        eur_12mo,
        eur_36mo,
        model_version: MODEL_VERSION.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn exponential_rate_at_t0_equals_qi() {
        assert_relative_eq!(arps_rate(1000.0, 0.1, 0.0, 0.0), 1000.0, epsilon = 0.01);
    }

    #[test]
    fn exponential_rate_decreases_monotonically() {
        let rates: Vec<f64> = (0..24).map(|m| arps_rate(1000.0, 0.1, 0.0, m as f64)).collect();
        for w in rates.windows(2) {
            assert!(w[0] >= w[1], "Exponential rate must decrease");
        }
    }

    #[test]
    fn hyperbolic_eur_greater_than_exponential() {
        let eur_exp  = arps_cumulative(1000.0, 0.1, 0.0, 60.0);
        let eur_hyp  = arps_cumulative(1000.0, 0.1, 0.5, 60.0);
        assert!(eur_hyp > eur_exp, "Hyperbolic EUR must exceed exponential");
    }

    #[test]
    fn harmonic_eur_greater_than_hyperbolic() {
        let eur_hyp  = arps_cumulative(1000.0, 0.1, 0.5, 60.0);
        let eur_harm = arps_cumulative(1000.0, 0.1, 1.0, 60.0);
        assert!(eur_harm > eur_hyp, "Harmonic EUR must exceed hyperbolic");
    }

    #[test]
    fn cumulative_at_t0_is_zero() {
        assert_relative_eq!(arps_cumulative(1000.0, 0.1, 0.5, 0.0), 0.0, epsilon = 0.01);
    }

    #[test]
    fn decline_response_has_correct_length() {
        let resp = compute_decline(1000.0, 0.1, 0.5, 24);
        assert_eq!(resp.points.len(), 25); // 0..=24
    }
}

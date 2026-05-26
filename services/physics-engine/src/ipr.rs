//! Inflow Performance Relationship (IPR)
//!
//! Implements the Vogel (1968) correlation for solution-gas drive reservoirs:
//!
//!   q/qmax = 1 - 0.2*(Pwf/Pr) - 0.8*(Pwf/Pr)²
//!
//! With skin-factor correction applied to qmax:
//!
//!   qmax_eff = qmax / (1 + S * D)   where D is a damage factor constant
//!
//! Reference: Vogel, J.V. (1968). "Inflow Performance Relationships for
//! Solution-Gas Drive Wells." JPT, 83-92.

use crate::models::CurvePoint;

/// Effective AOF after skin correction.
/// Uses a simplified Hawkins formula: skin reduces productivity by a factor
/// proportional to the skin value. Negative skin (stimulation) increases AOF.
pub fn effective_q_max(q_max: f64, skin: f64) -> f64 {
    // Skin factor damage: each unit of skin reduces AOF by ~5% (empirical)
    let damage = 1.0 + skin * 0.05;
    (q_max / damage).max(0.0)
}

/// Compute Pwf for a given flow rate using the Vogel equation (inverted).
/// Returns None if q > q_max_eff (physically impossible).
pub fn vogel_pwf(q: f64, q_max_eff: f64, p_r: f64) -> Option<f64> {
    if q > q_max_eff || q_max_eff <= 0.0 || p_r <= 0.0 {
        return None;
    }
    let ratio = q / q_max_eff;
    // Vogel: q/qmax = 1 - 0.2*(Pwf/Pr) - 0.8*(Pwf/Pr)²
    // Rearranged: 0.8x² + 0.2x + (ratio - 1) = 0  where x = Pwf/Pr
    // Quadratic: a=0.8, b=0.2, c=(ratio-1)
    let a = 0.8_f64;
    let b = 0.2_f64;
    let c = ratio - 1.0;
    let discriminant = b * b - 4.0 * a * c;
    if discriminant < 0.0 {
        return None;
    }
    let x = (-b + libm::sqrt(discriminant)) / (2.0 * a);
    Some((x * p_r).max(0.0))
}

/// Generate the full IPR curve: n evenly-spaced q values from 0 to q_max_eff.
pub fn ipr_curve(q_max: f64, skin: f64, p_r: f64, n: usize) -> Vec<CurvePoint> {
    let q_eff = effective_q_max(q_max, skin);
    (0..=n)
        .map(|i| {
            let q = q_eff * (i as f64) / (n as f64);
            let pwf = vogel_pwf(q, q_eff, p_r).unwrap_or(0.0);
            CurvePoint { q, pwf }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn vogel_at_zero_rate_equals_reservoir_pressure() {
        let pwf = vogel_pwf(0.0, 1000.0, 3000.0).unwrap();
        assert_relative_eq!(pwf, 3000.0, epsilon = 1.0);
    }

    #[test]
    fn vogel_at_max_rate_gives_zero_pwf() {
        let pwf = vogel_pwf(1000.0, 1000.0, 3000.0).unwrap();
        assert_relative_eq!(pwf, 0.0, epsilon = 1.0);
    }

    #[test]
    fn skin_reduces_q_max() {
        let q_no_skin   = effective_q_max(1000.0, 0.0);
        let q_with_skin = effective_q_max(1000.0, 5.0);
        assert!(q_with_skin < q_no_skin);
    }

    #[test]
    fn negative_skin_increases_q_max() {
        let q_no_skin   = effective_q_max(1000.0, 0.0);
        let q_stimulated = effective_q_max(1000.0, -3.0);
        assert!(q_stimulated > q_no_skin);
    }

    #[test]
    fn ipr_curve_has_correct_length() {
        let curve = ipr_curve(1000.0, 0.0, 3000.0, 50);
        assert_eq!(curve.len(), 51); // 0..=50
    }

    #[test]
    fn ipr_curve_is_monotonically_decreasing_pwf() {
        let curve = ipr_curve(1000.0, 0.0, 3000.0, 50);
        for w in curve.windows(2) {
            assert!(w[0].pwf >= w[1].pwf, "IPR must be monotonically decreasing");
        }
    }
}

use crate::models::*;

/// Evaluates whether a parametric trigger condition has been met
pub fn evaluate_trigger(
    trigger_type: &str,
    measured_value: f64,
    threshold: f64,
) -> bool {
    match trigger_type {
        "rainfall_excess" => measured_value > threshold,
        "rainfall_deficit" => measured_value < threshold,
        "river_gauge_level" => measured_value > threshold,
        "temperature_excess" => measured_value > threshold,
        "flight_delay" => measured_value > threshold,
        "earthquake_magnitude" => measured_value > threshold,
        "wind_speed" => measured_value > threshold,
        _ => false,
    }
}

/// Calculate payout amount based on trigger severity
pub fn calculate_payout(
    base_payout: f64,
    measured_value: f64,
    threshold: f64,
    trigger_type: &str,
) -> f64 {
    let severity = match trigger_type {
        "rainfall_excess" | "temperature_excess" | "river_gauge_level" | "wind_speed" => {
            let excess = (measured_value - threshold) / threshold;
            (1.0 + excess).min(2.0) // Up to 2x payout for severe events
        }
        "rainfall_deficit" => {
            let deficit = (threshold - measured_value) / threshold;
            (1.0 + deficit).min(2.0)
        }
        "flight_delay" => {
            if measured_value > threshold * 2.0 { 1.5 }
            else { 1.0 }
        }
        _ => 1.0,
    };
    (base_payout * severity * 100.0).round() / 100.0
}

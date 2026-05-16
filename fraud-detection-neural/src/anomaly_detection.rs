use crate::FraudCheckRequest;

/// Anomaly detection using statistical methods and autoencoder
pub fn score(request: &FraudCheckRequest) -> f64 {
    let mut anomaly_score = 0.0;

    // Amount anomaly: compare against distribution for this entity type
    let amount = request.amount;
    if amount > 500000.0 {
        anomaly_score += 0.2;
    }
    if amount > 1000000.0 {
        anomaly_score += 0.3;
    }

    // Time-based anomaly: claims filed at unusual hours, weekends
    // (would use chrono in production)

    // Pattern anomaly: unusual claim type for this customer profile
    // (would use autoencoder reconstruction error in production)

    anomaly_score.min(1.0)
}

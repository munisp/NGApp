use fluvio_smartmodule::{smartmodule, Record, RecordData, Result};
use serde::{Deserialize, Serialize};
use serde_json;

#[derive(Debug, Deserialize, Serialize)]
struct POSTransaction {
    transaction_id: String,
    terminal_id: String,
    merchant_id: String,
    card_number: String,
    amount: i64,
    currency: String,
    timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    location: Option<Location>,
    #[serde(skip_serializing_if = "Option::is_none")]
    enriched: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fraud_score: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bank_code: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct Location {
    latitude: f64,
    longitude: f64,
    city: String,
    state: String,
}

#[derive(Debug, Serialize)]
struct ProcessedTransaction {
    transaction_id: String,
    terminal_id: String,
    merchant_id: String,
    card_number_masked: String,
    amount: i64,
    currency: String,
    timestamp: String,
    location: Option<Location>,
    fraud_score: f32,
    risk_level: String,
    bank_code: String,
    enriched: bool,
    validation_status: String,
}

/// SmartModule for processing POS transactions
/// Performs validation, enrichment, and fraud scoring
#[smartmodule(map)]
pub fn process_transaction(record: &Record) -> Result<(Option<RecordData>, RecordData)> {
    let input = std::str::from_utf8(record.value.as_ref())?;
    
    // Parse the incoming transaction
    let mut transaction: POSTransaction = match serde_json::from_str(input) {
        Ok(t) => t,
        Err(e) => {
            // Return error record for invalid JSON
            let error_msg = format!(r#"{{"error": "Invalid JSON", "details": "{}"}}"#, e);
            return Ok((None, RecordData::from(error_msg.as_bytes())));
        }
    };

    // Validation
    if !validate_transaction(&transaction) {
        let error_msg = format!(
            r#"{{"error": "Validation failed", "transaction_id": "{}"}}"#,
            transaction.transaction_id
        );
        return Ok((None, RecordData::from(error_msg.as_bytes())));
    }

    // Enrichment
    enrich_transaction(&mut transaction);

    // Fraud scoring
    let fraud_score = calculate_fraud_score(&transaction);
    let risk_level = determine_risk_level(fraud_score);

    // Determine bank code from card number (first 6 digits - BIN)
    let bank_code = determine_bank_code(&transaction.card_number);

    // Mask card number (show only last 4 digits)
    let card_number_masked = mask_card_number(&transaction.card_number);

    // Create processed transaction
    let processed = ProcessedTransaction {
        transaction_id: transaction.transaction_id.clone(),
        terminal_id: transaction.terminal_id.clone(),
        merchant_id: transaction.merchant_id.clone(),
        card_number_masked,
        amount: transaction.amount,
        currency: transaction.currency.clone(),
        timestamp: transaction.timestamp.clone(),
        location: transaction.location.clone(),
        fraud_score,
        risk_level,
        bank_code,
        enriched: true,
        validation_status: "valid".to_string(),
    };

    // Serialize the processed transaction
    let output = serde_json::to_string(&processed)?;
    
    Ok((None, RecordData::from(output.as_bytes())))
}

/// Validate transaction data
fn validate_transaction(transaction: &POSTransaction) -> bool {
    // Check transaction ID is not empty
    if transaction.transaction_id.is_empty() {
        return false;
    }

    // Check terminal ID is valid
    if transaction.terminal_id.is_empty() || transaction.terminal_id.len() < 8 {
        return false;
    }

    // Check merchant ID is valid
    if transaction.merchant_id.is_empty() {
        return false;
    }

    // Check card number is valid (should be 16 digits)
    if transaction.card_number.len() != 16 || !transaction.card_number.chars().all(|c| c.is_digit(10)) {
        return false;
    }

    // Check amount is positive
    if transaction.amount <= 0 {
        return false;
    }

    // Check currency is valid
    if transaction.currency != "NGN" && transaction.currency != "USD" && transaction.currency != "EUR" {
        return false;
    }

    true
}

/// Enrich transaction with additional data
fn enrich_transaction(transaction: &mut POSTransaction) {
    // If location is not provided, add a default location based on terminal ID
    if transaction.location.is_none() {
        transaction.location = Some(Location {
            latitude: 6.5244,
            longitude: 3.3792,
            city: "Lagos".to_string(),
            state: "Lagos".to_string(),
        });
    }

    transaction.enriched = Some(true);
}

/// Calculate fraud score based on transaction characteristics
fn calculate_fraud_score(transaction: &POSTransaction) -> f32 {
    let mut score: f32 = 0.0;

    // High amount transactions have higher risk
    if transaction.amount > 100000 { // > 1000 NGN
        score += 0.3;
    }

    // Transactions outside business hours (10 PM - 6 AM) are riskier
    // In a real implementation, we would parse the timestamp
    score += 0.1;

    // Check for suspicious patterns (simplified)
    // In production, this would use ML models
    if transaction.amount % 10000 == 0 { // Round amounts are suspicious
        score += 0.2;
    }

    // Ensure score is between 0 and 1
    score.min(1.0)
}

/// Determine risk level from fraud score
fn determine_risk_level(score: f32) -> String {
    if score >= 0.7 {
        "high".to_string()
    } else if score >= 0.4 {
        "medium".to_string()
    } else {
        "low".to_string()
    }
}

/// Determine bank code from card BIN (Bank Identification Number)
fn determine_bank_code(card_number: &str) -> String {
    if card_number.len() < 6 {
        return "UNKNOWN".to_string();
    }

    let bin = &card_number[0..6];

    // Map BINs to Nigerian banks (simplified mapping)
    match bin {
        "539941" | "539942" => "ACCESS".to_string(),
        "539923" | "539924" => "GTB".to_string(),
        "539925" | "539926" => "ZENITH".to_string(),
        "539927" | "539928" => "UBA".to_string(),
        "539929" | "539930" => "FIRSTBANK".to_string(),
        "539931" | "539932" => "ECOBANK".to_string(),
        "539933" | "539934" => "FCMB".to_string(),
        "539935" | "539936" => "UNION".to_string(),
        "539937" | "539938" => "STANBIC".to_string(),
        "539939" | "539940" => "STERLING".to_string(),
        _ => "UNKNOWN".to_string(),
    }
}

/// Mask card number for security
fn mask_card_number(card_number: &str) -> String {
    if card_number.len() < 4 {
        return "****".to_string();
    }

    let last_four = &card_number[card_number.len() - 4..];
    format!("************{}", last_four)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_transaction() {
        let valid_transaction = POSTransaction {
            transaction_id: "txn-123".to_string(),
            terminal_id: "TERM-12345678".to_string(),
            merchant_id: "MERCH-001".to_string(),
            card_number: "5399410000000001".to_string(),
            amount: 50000,
            currency: "NGN".to_string(),
            timestamp: "2024-01-15T10:00:00Z".to_string(),
            location: None,
            enriched: None,
            fraud_score: None,
            bank_code: None,
        };

        assert!(validate_transaction(&valid_transaction));
    }

    #[test]
    fn test_mask_card_number() {
        let card_number = "5399410000000001";
        let masked = mask_card_number(card_number);
        assert_eq!(masked, "************0001");
    }

    #[test]
    fn test_determine_bank_code() {
        let card_number = "5399410000000001";
        let bank_code = determine_bank_code(card_number);
        assert_eq!(bank_code, "ACCESS");
    }

    #[test]
    fn test_fraud_score_calculation() {
        let transaction = POSTransaction {
            transaction_id: "txn-123".to_string(),
            terminal_id: "TERM-12345678".to_string(),
            merchant_id: "MERCH-001".to_string(),
            card_number: "5399410000000001".to_string(),
            amount: 150000, // High amount
            currency: "NGN".to_string(),
            timestamp: "2024-01-15T10:00:00Z".to_string(),
            location: None,
            enriched: None,
            fraud_score: None,
            bank_code: None,
        };

        let score = calculate_fraud_score(&transaction);
        assert!(score > 0.0 && score <= 1.0);
    }
}

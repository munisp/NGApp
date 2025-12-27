//! Cryptographic utilities for webhook signing and verification

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Generate HMAC-SHA256 signature for webhook payloads
pub fn sign_payload(payload: &[u8], secret: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret)
        .expect("HMAC can take key of any size");
    mac.update(payload);
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// Verify HMAC-SHA256 signature
pub fn verify_signature(payload: &[u8], secret: &[u8], signature: &str) -> bool {
    let expected = sign_payload(payload, secret);
    constant_time_compare(expected.as_bytes(), signature.as_bytes())
}

/// Constant-time comparison to prevent timing attacks
fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}

/// Generate a webhook signature header value
pub fn generate_webhook_signature(
    payload: &[u8],
    secret: &[u8],
    timestamp: i64,
) -> String {
    let signed_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));
    let signature = sign_payload(signed_payload.as_bytes(), secret);
    format!("t={},v1={}", timestamp, signature)
}

/// Parse and verify a webhook signature header
pub fn verify_webhook_signature(
    payload: &[u8],
    secret: &[u8],
    signature_header: &str,
    tolerance_secs: i64,
) -> Result<bool, &'static str> {
    let parts: Vec<&str> = signature_header.split(',').collect();
    
    let mut timestamp: Option<i64> = None;
    let mut signature: Option<&str> = None;
    
    for part in parts {
        if let Some(t) = part.strip_prefix("t=") {
            timestamp = t.parse().ok();
        } else if let Some(s) = part.strip_prefix("v1=") {
            signature = Some(s);
        }
    }
    
    let timestamp = timestamp.ok_or("Missing timestamp")?;
    let signature = signature.ok_or("Missing signature")?;
    
    let now = chrono::Utc::now().timestamp();
    if (now - timestamp).abs() > tolerance_secs {
        return Err("Timestamp outside tolerance");
    }
    
    let signed_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));
    Ok(verify_signature(signed_payload.as_bytes(), secret, signature))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify() {
        let payload = b"test payload";
        let secret = b"test secret";
        
        let signature = sign_payload(payload, secret);
        assert!(verify_signature(payload, secret, &signature));
        assert!(!verify_signature(payload, secret, "wrong signature"));
    }

    #[test]
    fn test_webhook_signature() {
        let payload = b"{\"event\":\"test\"}";
        let secret = b"webhook_secret";
        let timestamp = 1234567890;
        
        let header = generate_webhook_signature(payload, secret, timestamp);
        assert!(header.starts_with("t=1234567890,v1="));
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParametricProduct {
    pub id: String,
    pub name: String,
    pub category: String,
    pub trigger_type: String,
    pub trigger_source: String,
    pub trigger_threshold: String,
    pub payout_amount: f64,
    pub premium: f64,
    pub premium_frequency: String,
    pub coverage_period: String,
    pub regions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParametricPolicy {
    pub id: String,
    pub product_id: String,
    pub customer_id: String,
    pub customer_phone: String,
    pub location: GeoLocation,
    pub status: String,
    pub premium_paid: f64,
    pub payout_amount: f64,
    pub trigger_count: i32,
    pub total_paid_out: f64,
    pub created_at: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub region: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePolicyRequest {
    pub product_id: String,
    pub customer_id: String,
    pub customer_phone: String,
    pub location: GeoLocation,
    pub premium: f64,
    pub payout_amount: f64,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerEvent {
    pub id: String,
    pub product_id: String,
    pub region: String,
    pub trigger_type: String,
    pub measured_value: f64,
    pub threshold: f64,
    pub triggered: bool,
    pub data_source: String,
    pub timestamp: String,
    pub affected_policies: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerCheckRequest {
    pub product_id: String,
    pub region: String,
    pub trigger_type: String,
    pub value: f64,
    pub threshold: f64,
    pub data_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payout {
    pub id: String,
    pub policy_id: String,
    pub trigger_event_id: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub payment_method: String,
    pub mobile_number: String,
    pub initiated_at: String,
    pub completed_at: Option<String>,
}

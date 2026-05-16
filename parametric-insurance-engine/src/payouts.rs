use crate::models::*;

/// Process automatic payout for triggered policies
pub fn create_payout(
    policy: &ParametricPolicy,
    trigger_event: &TriggerEvent,
    amount: f64,
) -> Payout {
    Payout {
        id: uuid::Uuid::new_v4().to_string(),
        policy_id: policy.id.clone(),
        trigger_event_id: trigger_event.id.clone(),
        amount,
        currency: "NGN".into(),
        status: "initiated".into(),
        payment_method: "mobile_money".into(),
        mobile_number: policy.customer_phone.clone(),
        initiated_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
    }
}

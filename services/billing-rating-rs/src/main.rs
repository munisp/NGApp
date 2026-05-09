use std::collections::HashMap;

#[derive(Debug, Clone)]
struct UsageEvent {
    usage_event_id: String,
    meter_key: String,
    product_key: String,
    quantity: i64,
}

#[derive(Debug, Clone)]
struct RateCardLine {
    meter_key: String,
    product_key: String,
    included_units: i64,
    unit_price: f64,
}

fn rate_event(event: &UsageEvent, line: &RateCardLine) -> HashMap<&'static str, String> {
    let mut payload = HashMap::new();
    let billable_units = (event.quantity - line.included_units).max(0);
    let amount = billable_units as f64 * line.unit_price;
    payload.insert("usageEventId", event.usage_event_id.clone());
    payload.insert("meterKey", event.meter_key.clone());
    payload.insert("productKey", event.product_key.clone());
    payload.insert("billableUnits", billable_units.to_string());
    payload.insert("amountAccrued", format!("{amount:.2}"));
    payload
}

fn main() {
    let line = RateCardLine {
        meter_key: "transfer_posted".to_string(),
        product_key: "payments".to_string(),
        included_units: 10_000,
        unit_price: 25.0,
    };

    let event = UsageEvent {
        usage_event_id: "BUE-DEMO-001".to_string(),
        meter_key: "transfer_posted".to_string(),
        product_key: "payments".to_string(),
        quantity: 12_500,
    };

    let rated = rate_event(&event, &line);
    println!("billing-rating-worker ready");
    println!("example rated payload: {:?}", rated);
    println!("intended integrations: Kafka/Fluvio consumer, Redis cache, Postgres write, Temporal trigger");
}

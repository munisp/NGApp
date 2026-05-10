use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

fn get_env(key: &str, default: &str) -> String { env::var(key).unwrap_or_else(|_| default.to_string()) }

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "pricing.profile-updated,pricing.exception-requested,pricing.tier-changed"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "pricing-profile-cache"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "pricing_profiles,pricing_tiers,rate_exceptions"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "pricing-analytics"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "relationship-manager,pricing-officer"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "pricing:view,pricing:override,pricing:approve-exception"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "pricing-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "pricing-changes"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "PricingExceptionWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "payment-volume-data"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "balance-aggregation"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "pricing_history,revenue_impact"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/pricing/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "pricing-protection"}
    })
}

fn seed_data() -> serde_json::Value {
    serde_json::json!({
        "profiles": [
            {"id": "PRC-001", "customerId": "CIF-001", "customerName": "Dangote Industries Ltd", "segment": "platinum",
             "portfolio": {"totalDeposits": 48000000000.0, "totalLoans": 32000000000.0, "fxVolumeMTD": 45000000.0, "tradeFinance": 9000000000.0, "feeIncome": 125000000.0},
             "score": 98, "tier": "platinum", "pricing": {"loanSpread": -0.50, "depositPremium": 0.25, "fxMargin": -0.05, "feeDiscount": 15.0, "cotWaiver": true},
             "annualRevenue": 8500000000.0, "costToServe": 250000000.0, "netRevenue": 8250000000.0},
            {"id": "PRC-002", "customerId": "CIF-002", "customerName": "BUA Group", "segment": "gold",
             "portfolio": {"totalDeposits": 14200000000.0, "totalLoans": 20000000000.0, "fxVolumeMTD": 12000000.0, "tradeFinance": 0.0, "feeIncome": 45000000.0},
             "score": 82, "tier": "gold", "pricing": {"loanSpread": -0.25, "depositPremium": 0.15, "fxMargin": -0.03, "feeDiscount": 10.0, "cotWaiver": false},
             "annualRevenue": 3200000000.0, "costToServe": 120000000.0, "netRevenue": 3080000000.0},
            {"id": "PRC-003", "customerId": "CIF-003", "customerName": "Zenith Plastics Nig Ltd", "segment": "silver",
             "portfolio": {"totalDeposits": 250000000.0, "totalLoans": 480000000.0, "fxVolumeMTD": 0.0, "tradeFinance": 0.0, "feeIncome": 3500000.0},
             "score": 45, "tier": "silver", "pricing": {"loanSpread": 0.0, "depositPremium": 0.0, "fxMargin": 0.0, "feeDiscount": 0.0, "cotWaiver": false},
             "annualRevenue": 120000000.0, "costToServe": 25000000.0, "netRevenue": 95000000.0},
            {"id": "PRC-004", "customerId": "CIF-100", "customerName": "Adebayo Olumide", "segment": "mass-affluent",
             "portfolio": {"totalDeposits": 4100000.0, "totalLoans": 0.0, "fxVolumeMTD": 0.0, "tradeFinance": 0.0, "feeIncome": 4250.0},
             "score": 22, "tier": "standard", "pricing": {"loanSpread": 2.0, "depositPremium": 0.0, "fxMargin": 0.10, "feeDiscount": 0.0, "cotWaiver": false},
             "annualRevenue": 215000.0, "costToServe": 48000.0, "netRevenue": 167000.0},
        ],
        "tiers": [
            {"name": "platinum", "minScore": 90, "loanSpreadAdj": -0.50, "depositPremium": 0.25, "fxMarginAdj": -0.05, "feeDiscount": 15.0, "cotWaiver": true, "dedicatedRM": true},
            {"name": "gold", "minScore": 70, "loanSpreadAdj": -0.25, "depositPremium": 0.15, "fxMarginAdj": -0.03, "feeDiscount": 10.0, "cotWaiver": false, "dedicatedRM": true},
            {"name": "silver", "minScore": 40, "loanSpreadAdj": 0.0, "depositPremium": 0.0, "fxMarginAdj": 0.0, "feeDiscount": 0.0, "cotWaiver": false, "dedicatedRM": false},
            {"name": "standard", "minScore": 0, "loanSpreadAdj": 2.0, "depositPremium": 0.0, "fxMarginAdj": 0.10, "feeDiscount": 0.0, "cotWaiver": false, "dedicatedRM": false},
        ],
        "stats": {
            "totalProfiles": 4, "byTier": {"platinum": 1, "gold": 1, "silver": 1, "standard": 1},
            "totalPortfolioDeposits": 62454100000.0, "totalPortfolioLoans": 52480000000.0,
            "totalAnnualRevenue": 11820215000.0, "totalCostToServe": 443048000.0,
            "avgRelationshipScore": 61.75, "revenueConcentration": {"top1": 71.9, "top5": 100.0}
        }
    })
}

fn handle_request(request: &str, data: &Arc<RwLock<serde_json::Value>>) -> (u16, String) {
    let first_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return (400, r#"{"error":"Bad request"}"#.to_string()); }
    let path = parts[1];
    let d = data.read().unwrap();

    if path == "/healthz" {
        return (200, serde_json::json!({"status": "healthy", "service": "relationship-pricing",
            "profiles": d["stats"]["totalProfiles"], "tiers": 4, "middleware": middleware_config()}).to_string());
    }
    if path == "/v1/profiles" { return (200, serde_json::json!({"items": d["profiles"], "total": d["profiles"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/tiers" { return (200, serde_json::json!({"items": d["tiers"], "total": d["tiers"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/stats" { return (200, d["stats"].to_string()); }
    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8218");
    let data = Arc::new(RwLock::new(seed_data()));
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    eprintln!("[relationship-pricing] Listening on :{} with 4 profiles, 4 tiers", port);
    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let data = Arc::clone(&data);
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                let (status, body) = handle_request(&req, &data);
                let st = match status { 200 => "OK", _ => "Error" };
                let resp = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, st, body.len(), body);
                let _ = stream.write_all(resp.as_bytes());
            });
        }
    }
}

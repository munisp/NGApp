use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

fn get_env(key: &str, default: &str) -> String { env::var(key).unwrap_or_else(|_| default.to_string()) }

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "rate.benchmark-changed,rate.cascade-completed,rate.customer-notified"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "rate-cache,cascade-progress"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "benchmark_rates,rate_links,cascade_history"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "rate-cascade-history"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "treasury-officer,alco-member"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "rate:change,rate:approve-cascade,rate:override"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "rate-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "rate-changes"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "RateCascadeWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "settlement-rate-feed"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "interest-accrual-adjustment"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "rate_history,impact_analysis"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/rates/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "rate-management-protection"}
    })
}

fn seed_data() -> serde_json::Value {
    serde_json::json!({
        "benchmarks": [
            {"code": "CBN-MPR", "name": "CBN Monetary Policy Rate", "currentRate": 27.50, "previousRate": 27.25, "effectiveDate": "2026-05-01", "source": "CBN", "linkedProducts": 45, "linkedAccounts": 890000},
            {"code": "NIBOR-ON", "name": "NIBOR Overnight", "currentRate": 28.10, "previousRate": 27.80, "effectiveDate": "2026-05-10", "source": "FMDQ", "linkedProducts": 12, "linkedAccounts": 23000},
            {"code": "NIBOR-1M", "name": "NIBOR 1-Month", "currentRate": 29.50, "previousRate": 29.20, "effectiveDate": "2026-05-10", "source": "FMDQ", "linkedProducts": 8, "linkedAccounts": 15000},
            {"code": "NIBOR-3M", "name": "NIBOR 3-Month", "currentRate": 30.20, "previousRate": 29.80, "effectiveDate": "2026-05-10", "source": "FMDQ", "linkedProducts": 6, "linkedAccounts": 8000},
            {"code": "SOFR", "name": "Secured Overnight Financing Rate", "currentRate": 5.33, "previousRate": 5.31, "effectiveDate": "2026-05-10", "source": "Federal Reserve", "linkedProducts": 3, "linkedAccounts": 450},
            {"code": "54BANK-PLR", "name": "54Bank Prime Lending Rate", "currentRate": 30.00, "previousRate": 29.75, "effectiveDate": "2026-05-01", "source": "ALCO", "linkedProducts": 22, "linkedAccounts": 456000},
        ],
        "cascadeRuns": [
            {"id": "CASCADE-001", "benchmark": "CBN-MPR", "oldRate": 27.25, "newRate": 27.50, "changeBps": 25, "triggeredAt": "2026-05-01T10:00:00Z", "completedAt": "2026-05-01T10:15:00Z", "status": "completed",
             "impact": {"productsAffected": 45, "accountsAffected": 890000, "estimatedAnnualImpact": 2250000000, "notifications": 890000},
             "breakdown": [
                 {"product": "Personal Loan", "accounts": 456000, "oldEffective": 29.75, "newEffective": 30.00, "impactNGN": 1250000000},
                 {"product": "SME Overdraft", "accounts": 234000, "oldEffective": 31.25, "newEffective": 31.50, "impactNGN": 680000000},
                 {"product": "Corporate Term Loan", "accounts": 200000, "oldEffective": 28.00, "newEffective": 28.25, "impactNGN": 320000000}
             ]},
            {"id": "CASCADE-002", "benchmark": "NIBOR-3M", "oldRate": 29.80, "newRate": 30.20, "changeBps": 40, "triggeredAt": "2026-05-10T09:00:00Z", "completedAt": "2026-05-10T09:08:00Z", "status": "completed",
             "impact": {"productsAffected": 6, "accountsAffected": 8000, "estimatedAnnualImpact": 450000000, "notifications": 8000}},
        ],
        "stats": {
            "totalBenchmarks": 6, "totalLinkedProducts": 96, "totalLinkedAccounts": 1392450,
            "cascadesYTD": 8, "avgCascadeTimeMinutes": 12.5,
            "totalImpactYTD": 18500000000, "notificationsSentYTD": 4200000
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
        return (200, serde_json::json!({"status": "healthy", "service": "rate-cascade",
            "benchmarks": d["stats"]["totalBenchmarks"], "linkedAccounts": d["stats"]["totalLinkedAccounts"],
            "middleware": middleware_config()}).to_string());
    }
    if path == "/v1/benchmarks" { return (200, serde_json::json!({"items": d["benchmarks"], "total": d["benchmarks"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/cascade-runs" { return (200, serde_json::json!({"items": d["cascadeRuns"], "total": d["cascadeRuns"].as_array().map_or(0, |a| a.len())}).to_string()); }
    if path == "/v1/stats" { return (200, d["stats"].to_string()); }
    (404, r#"{"error":"Not found"}"#.to_string())
}

fn main() {
    let port = get_env("PORT", "8216");
    let data = Arc::new(RwLock::new(seed_data()));
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("Failed to bind");
    eprintln!("[rate-cascade] Listening on :{} with 6 benchmarks, 2 cascade runs", port);
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

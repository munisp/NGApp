use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, RwLock};

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "recon.runs,recon.mismatches,recon.alerts"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "recon-cache,balance-snapshots"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "recon_runs,recon_mismatches,recon_rules"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "balance-source-of-truth"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "reconciliation-*"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "reconciliation-officer"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "recon:run,recon:approve"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "recon-events"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "reconciliation-stream"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "ReconciliationWorkflow"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "purpose": "settlement-recon"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/reconciliation/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "recon-protection"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "recon_history,balance_snapshots"}
    })
}

fn seed_runs() -> Vec<serde_json::Value> {
    vec![
        serde_json::json!({"id": "RECON-001", "type": "eod", "scope": "All customer accounts (Ledger 1)", "status": "completed", "tigerbeetleTotal": 8945200000000000_i64, "postgresTotal": 8945200000000000_i64, "variance": 0, "accountsChecked": 2500000, "matchedAccounts": 2500000, "mismatchedAccounts": 0, "durationMs": 1200000}),
        serde_json::json!({"id": "RECON-002", "type": "eod", "scope": "GL accounts (Ledger 3)", "status": "completed", "tigerbeetleTotal": 125000000000000000_i64, "postgresTotal": 125000000000000000_i64, "variance": 0, "accountsChecked": 4500, "matchedAccounts": 4500, "mismatchedAccounts": 0, "durationMs": 300000}),
        serde_json::json!({"id": "RECON-003", "type": "intraday", "scope": "High-value accounts (>NGN 1B)", "status": "completed", "accountsChecked": 850, "matchedAccounts": 850, "mismatchedAccounts": 0, "durationMs": 60000}),
        serde_json::json!({"id": "RECON-004", "type": "eod", "scope": "Loan portfolio (Ledger 2)", "status": "mismatches_found", "accountsChecked": 320000, "matchedAccounts": 319997, "mismatchedAccounts": 3, "autoCorrections": 2, "manualReviewRequired": 1, "durationMs": 1800000}),
        serde_json::json!({"id": "RECON-005", "type": "regulatory", "scope": "CBN statutory reserve verification", "status": "completed", "accountsChecked": 12, "matchedAccounts": 12, "mismatchedAccounts": 0, "durationMs": 300000}),
    ]
}

fn seed_rules() -> Vec<serde_json::Value> {
    vec![
        serde_json::json!({"id": "RRULE-001", "name": "Customer Balance Parity", "type": "balance_check", "tolerance": 0, "frequency": "EOD 22:00", "autoCorrect": false, "escalateOnFail": true}),
        serde_json::json!({"id": "RRULE-002", "name": "GL Trial Balance Zero-Sum", "type": "gl_balance", "tolerance": 0, "frequency": "EOD 22:00", "autoCorrect": false, "escalateOnFail": true}),
        serde_json::json!({"id": "RRULE-003", "name": "Transaction Count Match", "type": "transaction_count", "tolerance": 0, "frequency": "Every 4h", "autoCorrect": false, "escalateOnFail": true}),
        serde_json::json!({"id": "RRULE-004", "name": "Settlement Net Position", "type": "settlement", "tolerance": 100, "frequency": "EOD 18:00", "autoCorrect": true, "escalateOnFail": false}),
        serde_json::json!({"id": "RRULE-005", "name": "Nostro Account Balance", "type": "nostro", "tolerance": 0.001, "frequency": "Every 6h", "autoCorrect": false, "escalateOnFail": true}),
    ]
}

fn handle_request(path: &str, runs: &[serde_json::Value], rules: &[serde_json::Value]) -> (u16, String) {
    match path {
        "/healthz" => (200, serde_json::json!({"status": "ok", "service": "reconciliation-engine-rs", "port": 8264, "middleware": middleware_config()}).to_string()),
        "/v1/reconciliation/runs" => (200, serde_json::json!({"items": runs, "total": runs.len()}).to_string()),
        "/v1/reconciliation/rules" => (200, serde_json::json!({"items": rules, "total": rules.len()}).to_string()),
        _ => (404, r#"{"error": "not found"}"#.to_string()),
    }
}

fn main() {
    let port = get_env("PORT", "8264");
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("Failed to bind");
    println!("Reconciliation Engine (Rust) listening on {}", addr);

    let runs = Arc::new(RwLock::new(seed_runs()));
    let rules = Arc::new(RwLock::new(seed_rules()));

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let mut buf = [0u8; 4096];
            if let Ok(n) = stream.read(&mut buf) {
                let req = String::from_utf8_lossy(&buf[..n]);
                let path = req.split_whitespace().nth(1).unwrap_or("/");
                let r = runs.read().unwrap();
                let ru = rules.read().unwrap();
                let (status, body) = handle_request(path, &r, &ru);
                let response = format!("HTTP/1.1 {} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, body.len(), body);
                let _ = stream.write_all(response.as_bytes());
            }
        }
    }
}

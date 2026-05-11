use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn middleware_config() -> serde_json::Value {
    serde_json::json!({
        "kafka": {"broker": get_env("KAFKA_BROKER", "localhost:9092"), "topics": "mojaloop.callbacks.parties,mojaloop.callbacks.quotes,mojaloop.callbacks.transfers"},
        "redis": {"url": get_env("REDIS_URL", "redis://localhost:6379"), "purpose": "ilp-condition-cache,callback-dedup"},
        "postgres": {"url": get_env("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "fspiop_callbacks,ilp_packets,callback_endpoints"},
        "tigerbeetle": {"url": get_env("TIGERBEETLE_URL", "localhost:3000"), "purpose": "transfer-posting-on-callback"},
        "dapr": {"url": get_env("DAPR_URL", "http://localhost:3500"), "pubsub": "mojaloop-callbacks"},
        "temporal": {"url": get_env("TEMPORAL_URL", "localhost:7233"), "workflow": "FSPIOPCallbackWorkflow"},
        "opensearch": {"url": get_env("OPENSEARCH_URL", "http://localhost:9200"), "index": "mojaloop-callbacks-*"},
        "keycloak": {"url": get_env("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
        "permify": {"url": get_env("PERMIFY_URL", "http://localhost:3476"), "schema": "mojaloop:callback"},
        "fluvio": {"url": get_env("FLUVIO_URL", "localhost:9003"), "topic": "fspiop-callbacks"},
        "mojaloop": {"url": get_env("MOJALOOP_URL", "http://localhost:4000"), "role": "callback-handler"},
        "apisix": {"url": get_env("APISIX_URL", "http://localhost:9080"), "route": "/mojaloop/callbacks/*"},
        "openappsec": {"url": get_env("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "mojaloop-callback-protection"},
        "lakehouse": {"url": get_env("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "mojaloop_callback_events,ilp_verification_log"}
    })
}

fn handle_request(path: &str) -> (u16, String) {
    match path {
        "/healthz" => (200, serde_json::json!({"status": "ok", "service": "mojaloop-fspiop-callbacks-rs", "port": 8267, "middleware": middleware_config()}).to_string()),
        "/v1/callbacks" => (200, serde_json::json!({"items": [], "total": 0, "description": "FSPIOP async callback handler — processes PUT /parties, PUT /quotes, PUT /transfers"}).to_string()),
        "/v1/ilp/verify" => (200, serde_json::json!({"status": "ready", "description": "ILP condition/fulfilment verification — SHA-256 preimage check"}).to_string()),
        _ => (404, r#"{"error": "not found"}"#.to_string()),
    }
}

fn main() {
    let port = get_env("PORT", "8267");
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("Failed to bind");
    println!("Mojaloop FSPIOP Callbacks + ILP (Rust) listening on {}", addr);
    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let mut buf = [0u8; 4096];
            if let Ok(n) = stream.read(&mut buf) {
                let req = String::from_utf8_lossy(&buf[..n]);
                let path = req.split_whitespace().nth(1).unwrap_or("/");
                let (status, body) = handle_request(path);
                let response = format!("HTTP/1.1 {} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", status, body.len(), body);
                let _ = stream.write_all(response.as_bytes());
            }
        }
    }
}

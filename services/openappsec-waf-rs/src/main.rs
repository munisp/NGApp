use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

fn get_env(key: &str, default: &str) -> String { env::var(key).unwrap_or_else(|_| default.to_string()) }
fn middleware_config() -> serde_json::Value {
    serde_json::json!({"kafka":{"broker":get_env("KAFKA_BROKER","localhost:9092")},"redis":{"url":get_env("REDIS_URL","redis://localhost:6379")},"postgres":{"url":get_env("DATABASE_URL","postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},"tigerbeetle":{"url":get_env("TIGERBEETLE_URL","localhost:3000")},"dapr":{"url":get_env("DAPR_URL","http://localhost:3500")},"temporal":{"url":get_env("TEMPORAL_URL","localhost:7233")},"opensearch":{"url":get_env("OPENSEARCH_URL","http://localhost:9200")},"keycloak":{"url":get_env("KEYCLOAK_URL","http://localhost:8080")},"permify":{"url":get_env("PERMIFY_URL","http://localhost:3476")},"fluvio":{"url":get_env("FLUVIO_URL","localhost:9003")},"mojaloop":{"url":get_env("MOJALOOP_URL","http://localhost:4000")},"apisix":{"url":get_env("APISIX_URL","http://localhost:9080")},"openappsec":{"url":get_env("OPENAPPSEC_URL","http://localhost:8090"),"role":"waf-engine"},"lakehouse":{"url":get_env("LAKEHOUSE_URL","http://localhost:8206")}})
}
fn handle_request(path: &str) -> (u16, String) {
    match path {
        "/healthz" => (200, serde_json::json!({"status":"ok","service":"openappsec-waf-rs","port":8276,"middleware":middleware_config()}).to_string()),
        _ => (404, r#"{"error":"not found"}"#.to_string()),
    }
}
fn main() {
    let port = get_env("PORT", "8276");
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("bind");
    println!("OpenAppSec WAF Engine (Rust) listening on {}", addr);
    for stream in listener.incoming() {
        if let Ok(mut s) = stream { let mut buf=[0u8;4096]; if let Ok(n)=s.read(&mut buf) { let req=String::from_utf8_lossy(&buf[..n]); let path=req.split_whitespace().nth(1).unwrap_or("/"); let(st,body)=handle_request(path); let r=format!("HTTP/1.1 {} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",st,body.len(),body); let _=s.write_all(r.as_bytes()); } }
    }
}

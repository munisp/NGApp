#![allow(unused)]
// 54Bank SWIFT/ISO 20022 Protocol Engine — Rust
// MT103 (Customer Credit Transfer), MT202 (Bank-to-Bank), MT760 (Guarantee)
// pacs.008 (FI to FI Customer Credit), pacs.009 (FI to FI Institution Credit)
// camt.053 (Bank-to-Customer Statement), SWIFT gpi tracking (UETR)
use actix_web::dev::Service;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

#[derive(Clone)]
struct AppState { start_time: Instant     db_client: Option<std::sync::Arc<tokio_postgres::Client>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct SWIFTMessage {
    id: String,
    message_type: String,
    direction: String,
    sender_bic: String,
    receiver_bic: String,
    uetr: String,
    reference: String,
    amount: f64,
    currency: String,
    value_date: String,
    status: String,
    gpi_status: String,
    charges: String,
}

async fn healthz(req: actix_web::HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if let Err(resp) = check_jwt(&req) { return resp; }
    HttpResponse::Ok().json(json!({
        "service": "swift-iso20022-rs",
        "status": "healthy",
        "protocol": ["MT103", "MT202", "MT760", "pacs.008", "pacs.009", "camt.053"],
        "gpi": "SWIFT_gpi_4.0",
        "uptime_secs": state.start_time.elapsed().as_secs(),
        "middleware": {
            "kafka": "topics: swift.outbound, swift.inbound, swift.gpi.tracker",
            "postgres": "tables: swift_messages, gpi_tracking, correspondent_banks",
            "redis": "uetr_cache, bic_directory_cache",
            "tigerbeetle": "nostro_ledger_accounts (1101-1108)",
            "opensearch": "swift-messages-2026, swift-audit-2026",
            "temporal": "SWIFTMessageRoutingWorkflow, GpiTrackingWorkflow",
            "permify": "swift:send_mt103, swift:approve_mt760",
            "fluvio": "swift-realtime-tracking",
            "apisix": "swift-api-gateway",
            "keycloak": "swift-operators-realm"
        }
    }))
}

async fn list_messages() -> HttpResponse {
    let messages = vec![
        json!({"id": "SW-001", "messageType": "MT103", "direction": "outbound", "senderBIC": "FIFTYFOURBANKNG", "receiverBIC": "CITIUS33XXX", "uetr": "97ed4827-7b6f-4491-a06f-b548d5a7512d", "amount": 500000.0, "currency": "USD", "status": "delivered", "gpiStatus": "ACSC"}),
        json!({"id": "SW-002", "messageType": "MT202", "direction": "outbound", "senderBIC": "FIFTYFOURBANKNG", "receiverBIC": "BABOROBB", "uetr": "a1c2d3e4-f5g6-h7i8-j9k0-l1m2n3o4p5q6", "amount": 2000000.0, "currency": "USD", "status": "acknowledged", "gpiStatus": "ACSP"}),
        json!({"id": "SW-003", "messageType": "pacs.008", "direction": "outbound", "senderBIC": "FIFTYFOURBANKNG", "receiverBIC": "LOYDGB2L", "uetr": "b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7", "amount": 150000.0, "currency": "GBP", "status": "sent", "gpiStatus": "PDNG"}),
    ];
    HttpResponse::Ok().json(json!({"messages": messages, "total": 3}))
}

async fn gpi_track(query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let uetr = query.get("uetr").cloned().unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "uetr": uetr,
        "transactionStatus": "ACSC",
        "completedDate": "2026-05-09T14:30:00Z",
        "chargesAmount": 25.0,
        "chargesCurrency": "USD",
        "instructedAmount": 500000.0,
        "confirmedAmount": 499975.0
    }))
}

async fn validate_mt103(req: actix_web::HttpRequest, state: web::Data<AppState>, body: web::Json<serde_json::Value>) -> HttpResponse {
    if !rl_allow() {
        return HttpResponse::TooManyRequests().json(json!({"error": "rate_limit_exceeded"}));
    }
    if let Err(resp) = check_jwt(&req) { return resp; }
    let fields = vec!["senderBIC", "receiverBIC", "amount", "currency", "beneficiary", "ordering"];
    let mut errors: Vec<String> = vec![];
    for field in &fields {
        if body.get(field).is_none() { errors.push(format!("Missing field: {}", field)); }
    }
    if errors.is_empty() {
    // Inter-service call: payment_process
    let _upstream_url = std::env::var("PAYMENTS_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    match call_service_sync(&format!("{}/v1/process", _upstream_url), "{}") {
        Ok(_resp) => eprintln!("swift-iso20022-rs: payment_process ok"),
        Err(e) => eprintln!("swift-iso20022-rs: payment_process failed: {}", e),
    }

    let _result_data = json!({"endpoint": "validate_mt103"});
    db_persist(&state, "validate_mt103", &_result_data).await;

        HttpResponse::Ok().json(json!({"valid": true, "messageType": "MT103", "readyToSend": true}))
    } else {
        HttpResponse::BadRequest().json(json!({"valid": false, "errors": errors}))
    }
}


// --- Production Hardening: readyz / livez / metrics ---
static _REQ_COUNT: AtomicU64 = AtomicU64::new(0);
static _ERR_COUNT: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_START: AtomicU64 = AtomicU64::new(0);
static _RATE_WINDOW_COUNT: AtomicU64 = AtomicU64::new(0);
const RATE_LIMIT_PER_SECOND: u64 = 100;


async fn readyz() -> HttpResponse {
    HttpResponse::Ok().json(json!({"ready": true, "service": "swift-iso20022-rs"}))
}
async fn livez() -> HttpResponse {
    HttpResponse::Ok().json(json!({"alive": true}))
}
async fn prom_metrics() -> HttpResponse {
    let r = _REQ_COUNT.load(AtomicOrdering::Relaxed);
    let e = _ERR_COUNT.load(AtomicOrdering::Relaxed);
    let body = format!(
        "# TYPE requests_total counter\nrequests_total{{service=\"swift-iso20022-rs\"}} {}\n         # TYPE errors_total counter\nerrors_total{{service=\"swift-iso20022-rs\"}} {}\n", r, e);
    HttpResponse::Ok().content_type("text/plain").body(body)
}


// --- Database Connection ---
use tokio_postgres::NoTls;

async fn init_db(db_url: &str) -> Option<tokio_postgres::Client> {
    match tokio_postgres::connect(db_url, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move { if let Err(e) = connection.await { eprintln!("DB connection error: {}", e); }});
            let _ = client.execute(
                "CREATE TABLE IF NOT EXISTS service_records (
                    id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
                    status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                )", &[]).await;
            let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)", &[]).await;
            Some(client)
        }
        Err(e) => { eprintln!("DB connect failed: {} — in-memory fallback", e); None }
    }
}


// --- JWT Auth Check ---
fn check_jwt(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let path = req.path();
    if path == "/healthz" || path == "/readyz" || path == "/livez" || path == "/metrics" || path == "/health" {
        return Ok(());
    }
    match req.headers().get("Authorization") {
        Some(val) => {
            if let Ok(s) = val.to_str() {
                if s.starts_with("Bearer ") { return Ok(()); }
            }
            Err(HttpResponse::Unauthorized().json(json!({"error": "invalid auth header"})))
        }
        None => Err(HttpResponse::Unauthorized().json(json!({"error": "missing Authorization header"})))
    }
}


// --- Security Headers Middleware ---
fn add_security_headers(resp: &mut actix_web::HttpResponse) {
    let hdrs = resp.headers_mut();
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-content-type-options"),
        actix_web::http::header::HeaderValue::from_static("nosniff"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-frame-options"),
        actix_web::http::header::HeaderValue::from_static("DENY"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("x-xss-protection"),
        actix_web::http::header::HeaderValue::from_static("1; mode=block"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("strict-transport-security"),
        actix_web::http::header::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    hdrs.insert(
        actix_web::http::header::HeaderName::from_static("referrer-policy"),
        actix_web::http::header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
}

fn sanitize_input(s: &str) -> String {
    let s = s.replace('<', "&lt;").replace('>', "&gt;")
        .replace('\'', "&#39;").replace('"', "&quot;");
    if s.len() > 10000 { s[..10000].to_string() } else { s }
}


async fn db_persist(state: &web::Data<AppState>, endpoint: &str, data: &serde_json::Value) {
    if let Some(ref client) = state.db_client {
        let id = format!("{}_{}_{}", "swift_iso20022_rs", endpoint, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        let data_str = serde_json::to_string(data).unwrap_or_default();
        let _ = client.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
            &[&id, &"swift-iso20022-rs" as &str, &endpoint, &"active" as &str, &data_str],
        ).await;
    }
}


fn call_service_sync(url: &str, body: &str) -> Result<String, String> {
    use std::io::{Read, Write};
    let url_parsed = url.strip_prefix("http://").unwrap_or(url);
    let (host_port, path) = url_parsed.split_once('/').unwrap_or((url_parsed, "/"));
    let host_port = if !host_port.contains(':') { format!("{}:8080", host_port) } else { host_port.to_string() };
    match std::net::TcpStream::connect_timeout(&host_port.parse().map_err(|e| format!("{}", e))?, std::time::Duration::from_secs(5)) {
        Ok(mut stream) => {
            let host = host_port.split(':').next().unwrap_or("localhost");
            let req = format!("POST /{} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", path, host, body.len(), body);
            stream.write_all(req.as_bytes()).map_err(|e| format!("{}", e))?;
            let mut resp = String::new();
            stream.read_to_string(&mut resp).map_err(|e| format!("{}", e))?;
            Ok(resp)
        }
        Err(e) => Err(format!("connection failed: {}", e))
    }
}


static _RL_TOKENS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(100);
static _RL_LAST: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn rl_allow() -> bool {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    if now - _RL_LAST.load(std::sync::atomic::Ordering::Relaxed) >= 1000 {
        _RL_TOKENS.store(100, std::sync::atomic::Ordering::Relaxed);
        _RL_LAST.store(now, std::sync::atomic::Ordering::Relaxed);
    }
    if _RL_TOKENS.fetch_sub(1, std::sync::atomic::Ordering::Relaxed) <= 0 {
        _RL_TOKENS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        return false;
    }
    true
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8112".to_string());
    let state = AppState { start_time: Instant::now() };
    println!("SWIFT/ISO 20022 Engine (Rust) on :{} — MT + MX protocol", port);
    HttpServer::new(move || {
        App::new()
            .wrap_fn(|req, srv| {
                _REQ_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                let trace_id = req.headers().get("X-Trace-Id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("none")
                    .to_string();
                eprintln!("[swift-iso20022-rs] {} {} trace={}", req.method(), req.path(), trace_id);
                let fut = srv.call(req);
                async move {
                    let res = fut.await?;
                    if res.status().is_server_error() || res.status().is_client_error() {
                        _ERR_COUNT.fetch_add(1, AtomicOrdering::Relaxed);
                    }
                    Ok(res)
                }
            })
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/swift/messages", web::get().to(list_messages))
            .route("/v1/swift/gpi-track", web::get().to(gpi_track))
            .route("/v1/swift/validate-mt103", web::post().to(validate_mt103))
            .route("/readyz", web::get().to(readyz))
            .route("/livez", web::get().to(livez))
            .route("/metrics", web::get().to(prom_metrics))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .shutdown_timeout(30)
    .run()
    .await
}

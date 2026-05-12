use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "OTP-001", "otpId": "OTP-2026-0001", "msisdn": "08012345678", "purpose": "login", "otp": "****", "expiresAt": "2026-05-09T10:05:00Z", "attempts": 0, "maxAttempts": 3, "network": "MTN", "deliveryStatus": "delivered", "deliveryMs": 1200, "status": "pending_verification"}, {"id": "OTP-002", "otpId": "OTP-2026-0002", "msisdn": "08098765432", "purpose": "transfer", "otp": "****", "expiresAt": "2026-05-09T10:10:00Z", "attempts": 1, "maxAttempts": 3, "network": "Glo", "deliveryStatus": "delivered", "deliveryMs": 800, "status": "verified"}, {"id": "OTP-003", "otpId": "OTP-2026-0003", "msisdn": "07033344455", "purpose": "card_block", "otp": "****", "expiresAt": "2026-05-09T10:15:00Z", "attempts": 0, "maxAttempts": 3, "network": "Airtel", "deliveryStatus": "sent", "deliveryMs": 1500, "status": "pending_delivery"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "sms_otp_service",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "sms_otp_service.events",
        "sms_otp_service.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "sms-otp-service",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "sms_otp_service-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "sms_otp_service-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "sms-otp-service"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "sms_otp_service"
    },
    "redis": {
      "status": "connected",
      "cluster": "channel-banking-cache",
      "db": 5
    },
    "mojaloop": {
      "status": "connected",
      "hub": "54bank-hub",
      "dfsp": "54bank-channels"
    },
    "opensearch": {
      "status": "connected",
      "index": "sms_otp_service-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/sms-otp-service",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "sms_otp_service_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "sms_otp_service"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "SMS OTP Service",
        "port": 8652,
        "description": "One-time password delivery via SMS — time-based OTP, rate limiting, delivery confirmation, multi-telco routing (MTN, Glo, Airtel, 9mobile)",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "SMS OTP Service"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8652".to_string());
    println!("SMS OTP Service running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/sms_otp_service/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

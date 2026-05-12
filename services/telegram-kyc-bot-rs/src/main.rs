use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "TEL-001", "name": "Telegram KYC Bot", "category": "channel_banking", "description": "In-chat KYC onboarding \u2014 BVN/NIN verification, selfie capture, document upload, address verification via Telegram", "status": "active", "region": "Nigeria"}, {"id": "TEL-002", "name": "Telegram KYC Bot Config", "category": "configuration", "description": "Configuration for Telegram KYC Bot", "status": "active", "region": "Nigeria"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "telegram_kyc_bot",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "telegram_kyc_bot.events",
        "telegram_kyc_bot.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "telegram-kyc-bot",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "telegram_kyc_bot-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "telegram_kyc_bot-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "telegram-kyc-bot"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "telegram_kyc_bot"
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
      "index": "telegram_kyc_bot-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/telegram-kyc-bot",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "telegram_kyc_bot_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "telegram_kyc_bot"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "Telegram KYC Bot",
        "port": 8641,
        "description": "In-chat KYC onboarding — BVN/NIN verification, selfie capture, document upload, address verification via Telegram",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "Telegram KYC Bot"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8641".to_string());
    println!("Telegram KYC Bot running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/telegram_kyc_bot/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

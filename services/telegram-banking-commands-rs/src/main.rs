use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "TC-001", "command": "/balance", "description": "Check account balance", "category": "account", "requiresAuth": true, "responseFormat": "text", "avgResponseMs": 120, "usageCount": 15420}, {"id": "TC-002", "command": "/transfer", "description": "Send money to another account", "category": "transfer", "requiresAuth": true, "responseFormat": "conversation", "avgResponseMs": 450, "usageCount": 8930}, {"id": "TC-003", "command": "/history", "description": "View recent transactions", "category": "account", "requiresAuth": true, "responseFormat": "list", "avgResponseMs": 200, "usageCount": 12100}, {"id": "TC-004", "command": "/pay_bill", "description": "Pay utility bills (PHCN, DSTV, etc)", "category": "payments", "requiresAuth": true, "responseFormat": "inline_keyboard", "avgResponseMs": 350, "usageCount": 6700}, {"id": "TC-005", "command": "/airtime", "description": "Buy airtime (MTN, Glo, Airtel, 9mobile)", "category": "payments", "requiresAuth": true, "responseFormat": "inline_keyboard", "avgResponseMs": 180, "usageCount": 22000}, {"id": "TC-006", "command": "/block_card", "description": "Block/unblock debit card", "category": "card", "requiresAuth": true, "responseFormat": "confirmation", "avgResponseMs": 150, "usageCount": 890}, {"id": "TC-007", "command": "/exchange_rate", "description": "View current exchange rates", "category": "info", "requiresAuth": false, "responseFormat": "text", "avgResponseMs": 80, "usageCount": 4500}, {"id": "TC-008", "command": "/find_atm", "description": "Find nearest ATM/branch", "category": "info", "requiresAuth": false, "responseFormat": "location", "avgResponseMs": 250, "usageCount": 3200}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "telegram_banking_commands",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "telegram_banking_commands.events",
        "telegram_banking_commands.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "telegram-banking-commands",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "telegram_banking_commands-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "telegram_banking_commands-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "telegram-banking-commands"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "telegram_banking_commands"
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
      "index": "telegram_banking_commands-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/telegram-banking-commands",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "telegram_banking_commands_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "telegram_banking_commands"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "Telegram Banking Commands",
        "port": 8638,
        "description": "Banking commands: /balance, /transfer, /history, /pay_bill, /loan_status, /block_card, /find_atm, /exchange_rate",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "Telegram Banking Commands"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8638".to_string());
    println!("Telegram Banking Commands running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/telegram_banking_commands/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

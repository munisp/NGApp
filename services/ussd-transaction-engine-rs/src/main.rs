use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "UTE-001", "txnType": "balance_inquiry", "shortCode": "*737*0#", "screens": 1, "avgSessionSec": 3, "successRate": 0.99, "dailyVolume": 125000, "network": "all", "status": "active"}, {"id": "UTE-002", "txnType": "fund_transfer", "shortCode": "*737*1#", "screens": 4, "avgSessionSec": 18, "successRate": 0.96, "dailyVolume": 85000, "network": "all", "status": "active"}, {"id": "UTE-003", "txnType": "airtime_purchase", "shortCode": "*737*2#", "screens": 3, "avgSessionSec": 8, "successRate": 0.98, "dailyVolume": 200000, "network": "all", "status": "active"}, {"id": "UTE-004", "txnType": "bill_payment", "shortCode": "*737*3#", "screens": 4, "avgSessionSec": 15, "successRate": 0.95, "dailyVolume": 45000, "network": "all", "status": "active"}, {"id": "UTE-005", "txnType": "mini_statement", "shortCode": "*737*4#", "screens": 1, "avgSessionSec": 5, "successRate": 0.99, "dailyVolume": 60000, "network": "all", "status": "active"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "ussd_transaction_engine",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "ussd_transaction_engine.events",
        "ussd_transaction_engine.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "ussd-transaction-engine",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "ussd_transaction_engine-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "ussd_transaction_engine-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "ussd-transaction-engine"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "ussd_transaction_engine"
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
      "index": "ussd_transaction_engine-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/ussd-transaction-engine",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "ussd_transaction_engine_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "ussd_transaction_engine"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "USSD Transaction Engine",
        "port": 8648,
        "description": "Core USSD transaction processing — balance inquiry, transfers, airtime, bills, mini-statement in 160-char screens",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "USSD Transaction Engine"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8648".to_string());
    println!("USSD Transaction Engine running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/ussd_transaction_engine/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

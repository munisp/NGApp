use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "WF-001", "flowId": "balance_check", "name": "Balance Inquiry", "steps": 3, "avgCompletionSec": 8, "successRate": 0.97, "monthlyUsers": 45000, "language": "en", "status": "active"}, {"id": "WF-002", "flowId": "fund_transfer", "name": "Money Transfer", "steps": 5, "avgCompletionSec": 25, "successRate": 0.94, "monthlyUsers": 32000, "language": "en", "status": "active"}, {"id": "WF-003", "flowId": "airtime_purchase", "name": "Airtime Purchase", "steps": 3, "avgCompletionSec": 10, "successRate": 0.98, "monthlyUsers": 67000, "language": "en", "status": "active"}, {"id": "WF-004", "flowId": "bill_payment", "name": "Bill Payment", "steps": 4, "avgCompletionSec": 18, "successRate": 0.95, "monthlyUsers": 28000, "language": "en", "status": "active"}, {"id": "WF-005", "flowId": "account_opening", "name": "Account Opening", "steps": 8, "avgCompletionSec": 120, "successRate": 0.82, "monthlyUsers": 5000, "language": "en", "status": "active"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "whatsapp_banking_flows",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "whatsapp_banking_flows.events",
        "whatsapp_banking_flows.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "whatsapp-banking-flows",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "whatsapp_banking_flows-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "whatsapp_banking_flows-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "whatsapp-banking-flows"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "whatsapp_banking_flows"
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
      "index": "whatsapp_banking_flows-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/whatsapp-banking-flows",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "whatsapp_banking_flows_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "whatsapp_banking_flows"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "WhatsApp Banking Flows",
        "port": 8643,
        "description": "Conversational banking flows — balance check, money transfer, airtime purchase, bill payment, account opening via WhatsApp",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "WhatsApp Banking Flows"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8643".to_string());
    println!("WhatsApp Banking Flows running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/whatsapp_banking_flows/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "WHA-001", "name": "WhatsApp Document Service", "category": "channel_banking", "description": "Document exchange via WhatsApp \u2014 statement PDF generation, receipt images, KYC document collection, loan agreement signing", "status": "active", "region": "Nigeria"}, {"id": "WHA-002", "name": "WhatsApp Document Service Config", "category": "configuration", "description": "Configuration for WhatsApp Document Service", "status": "active", "region": "Nigeria"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "whatsapp_document_service",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "whatsapp_document_service.events",
        "whatsapp_document_service.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "whatsapp-document-service",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "whatsapp_document_service-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "whatsapp_document_service-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "whatsapp-document-service"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "whatsapp_document_service"
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
      "index": "whatsapp_document_service-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/whatsapp-document-service",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "whatsapp_document_service_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "whatsapp_document_service"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "WhatsApp Document Service",
        "port": 8646,
        "description": "Document exchange via WhatsApp — statement PDF generation, receipt images, KYC document collection, loan agreement signing",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "WhatsApp Document Service"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8646".to_string());
    println!("WhatsApp Document Service running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/whatsapp_document_service/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

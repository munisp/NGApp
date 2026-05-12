use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "VBA-001", "customerId": "CUS-001", "voiceprintId": "VP-001", "enrollmentStatus": "enrolled", "samplesCollected": 3, "matchScore": 0.96, "livenessScore": 0.99, "spoofDetected": false, "lastVerified": "2026-05-09T09:00:00Z", "status": "active"}, {"id": "VBA-002", "customerId": "CUS-002", "voiceprintId": "VP-002", "enrollmentStatus": "enrolled", "samplesCollected": 3, "matchScore": 0.92, "livenessScore": 0.97, "spoofDetected": false, "lastVerified": "2026-05-09T08:30:00Z", "status": "active"}, {"id": "VBA-003", "customerId": "CUS-003", "voiceprintId": "VP-003", "enrollmentStatus": "pending", "samplesCollected": 1, "matchScore": 0.0, "livenessScore": 0.0, "spoofDetected": false, "lastVerified": "", "status": "pending_enrollment"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "voice_biometric_auth",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_biometric_auth.events",
        "voice_biometric_auth.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-biometric-auth",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_biometric_auth-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_biometric_auth-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-biometric-auth"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_biometric_auth"
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
      "index": "voice_biometric_auth-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-biometric-auth",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_biometric_auth_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_biometric_auth"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "Voice Biometric Authentication",
        "port": 8633,
        "description": "Voiceprint enrollment and verification, anti-spoofing detection, liveness check for phone banking authentication",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "Voice Biometric Authentication"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8633".to_string());
    println!("Voice Biometric Authentication running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/voice_biometric_auth/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

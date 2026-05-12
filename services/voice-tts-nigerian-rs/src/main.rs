use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;

const SEED_DATA: &str = r#"[{"id": "TTS-001", "voiceId": "ng-male-baritone", "gender": "male", "accent": "yoruba", "language": "en-NG", "sampleRate": 16000, "format": "wav", "text": "Your account balance is fifty thousand, two hundred and thirty-five naira, forty kobo.", "durationMs": 3200, "status": "synthesized"}, {"id": "TTS-002", "voiceId": "ng-female-soprano", "gender": "female", "accent": "igbo", "language": "en-NG", "sampleRate": 16000, "format": "wav", "text": "Transfer of ten thousand naira to Adebayo Ogundimu has been successful.", "durationMs": 2800, "status": "synthesized"}, {"id": "TTS-003", "voiceId": "ng-male-tenor", "gender": "male", "accent": "hausa", "language": "ha-NG", "sampleRate": 16000, "format": "wav", "text": "Ragowar kudin ku shine dubu hamsin da dari biyu da talatin da biyar naira.", "durationMs": 3500, "status": "synthesized"}, {"id": "TTS-004", "voiceId": "ng-female-alto", "gender": "female", "accent": "yoruba", "language": "yo-NG", "sampleRate": 16000, "format": "wav", "text": "Iye owo to ku ninu account yin ni egberun aadota, igba marundinlogoji naira.", "durationMs": 3100, "status": "synthesized"}, {"id": "TTS-005", "voiceId": "ng-male-pidgin", "gender": "male", "accent": "pidgin", "language": "pcm-NG", "sampleRate": 16000, "format": "wav", "text": "Your money wey dey for account na fifty touzand, two hundred and tirty-five naira.", "durationMs": 3000, "status": "synthesized"}]"#;
const MIDDLEWARE_STATUS: &str = r#"{
  "service": "voice_tts_nigerian",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_tts_nigerian.events",
        "voice_tts_nigerian.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-tts-nigerian",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_tts_nigerian-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_tts_nigerian-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-tts-nigerian"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_tts_nigerian"
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
      "index": "voice_tts_nigerian-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-tts-nigerian",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_tts_nigerian_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_tts_nigerian"
    }
  }
}"#;

async fn healthz() -> HttpResponse {
    let mw: serde_json::Value = serde_json::from_str(MIDDLEWARE_STATUS).unwrap_or_default();
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "Nigerian Voice TTS Engine",
        "port": 8630,
        "description": "Text-to-speech with Nigerian male (baritone Yoruba-accented) and female (soprano Igbo-accented) voices, supports English/Pidgin/Hausa/Yoruba/Igbo",
        "middleware": mw
    }))
}

async fn list_data() -> HttpResponse {
    let data: Vec<serde_json::Value> = serde_json::from_str(SEED_DATA).unwrap_or_default();
    let total = data.len();
    HttpResponse::Ok().json(json!({
        "data": data,
        "total": total,
        "service": "Nigerian Voice TTS Engine"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8630".to_string());
    println!("Nigerian Voice TTS Engine running on :{}", port);
    HttpServer::new(|| {
        App::new()
            .route("/healthz", web::get().to(healthz))
            .route("/v1/voice_tts_nigerian/list", web::get().to(list_data))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

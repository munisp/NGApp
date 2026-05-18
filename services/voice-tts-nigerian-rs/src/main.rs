use tokio_postgres;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

// voice-tts-nigerian-rs — Nigerian-accented text-to-speech engine

struct AppState {
    records: Mutex<Vec<serde_json::Value>>,
    db_url: Option<String>,
}


fn select_voice(language: &str, gender: &str) -> &str {
    match (language, gender) { ("en-NG", "male") => "ng-en-male-1", ("en-NG", "female") => "ng-en-female-1",
        ("yo", _) => "ng-yo-1", ("ig", _) => "ng-ig-1", ("ha", _) => "ng-ha-1", ("pcm", _) => "ng-pcm-1", _ => "ng-en-male-1" }
}
fn estimate_duration_ms(text: &str) -> u64 { (text.split_whitespace().count() as u64) * 400 }
fn phoneme_replace_nigerian(text: &str) -> String { text.replace("the", "de").replace("this", "dis") }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "voice-tts-nigerian-rs",
        "version": "1.0.0",
        "description": "Nigerian-accented text-to-speech engine",
    }))
}


async fn synthesize(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "voice-tts-nigerian-rs",
        "endpoint": "synthesize",
        "description": "Convert text to speech with Nigerian accent",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn available_voices(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "voice-tts-nigerian-rs",
        "endpoint": "available_voices",
        "description": "List available Nigerian voice models",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn ssml_parse(body: web::Json<serde_json::Value>, state: web::Data<AppState>) -> HttpResponse {
    let input = body.into_inner();
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "service": "voice-tts-nigerian-rs",
        "endpoint": "ssml_parse",
        "description": "Parse SSML markup for synthesis",
        "input": input,
        "records_count": records.len(),
        "status": "processed",
    }))
}

async fn list_records(state: web::Data<AppState>, query: web::Query<std::collections::HashMap<String, String>>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let total = records.len();
    let start = (page - 1) * limit;
    let items: Vec<&serde_json::Value> = records.iter().skip(start).take(limit).collect();
    HttpResponse::Ok().json(json!({"items": items, "total": total, "page": page, "limit": limit}))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let records = state.records.lock().unwrap();
    HttpResponse::Ok().json(json!({"total": records.len(), "service": env!("CARGO_PKG_NAME")}))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8137);
    let state = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url: std::env::var("DATABASE_URL").ok(),
    });
    println!("voice-tts-nigerian-rs listening on port {}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/healthz", web::get().to(health))
            .route("/v1/tts", web::post().to(synthesize))
            .route("/v1/voices", web::post().to(available_voices))
            .route("/v1/ssml", web::post().to(ssml_parse))
            .route("/v1/records", web::get().to(list_records))
            .route("/v1/stats", web::get().to(stats))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}

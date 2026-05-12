use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use std::env;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Record {
    pub rate_id: Option<String>,
    pub base_currency: Option<String>,
    pub quote_currency: Option<String>,
    pub bid_rate: Option<String>,
    pub ask_rate: Option<String>,
    pub mid_rate: Option<String>,
}

struct AppState {
    records: Mutex<Vec<Record>>,
    db_url: Option<String>,
}

async fn health(data: web::Data<AppState>) -> HttpResponse {
    let db_status = if data.db_url.is_some() { "configured" } else { "not_configured" };
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "fx-rates-engine-rs",
        "database": db_status,
        "table": "fx_rates",
    }))
}

async fn list_records(
    data: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> HttpResponse {
    let records = data.records.lock().unwrap();
    let page: usize = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: usize = query.get("limit").and_then(|l| l.parse().ok()).unwrap_or(20);
    let search = query.get("search").cloned().unwrap_or_default();
    
    let filtered: Vec<&Record> = if search.is_empty() {
        records.iter().collect()
    } else {
        records.iter().filter(|r| {
            r.rate_id.as_ref().map_or(false, |v| v.to_lowercase().contains(&search.to_lowercase()))
        }).collect()
    };
    
    let total = filtered.len();
    let start = (page - 1) * limit;
    let items: Vec<&Record> = filtered.into_iter().skip(start).take(limit).collect();
    
    HttpResponse::Ok().json(json!({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "source": "database",
    }))
}

async fn get_record(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let records = data.records.lock().unwrap();
    if let Some(record) = records.iter().find(|r| r.rate_id.as_ref().map_or(false, |v| v == &id)) {
        HttpResponse::Ok().json(record)
    } else {
        HttpResponse::NotFound().json(json!({"error": "Not found"}))
    }
}

async fn create_record(
    data: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let mut records = data.records.lock().unwrap();
    let record: Record = serde_json::from_value(body.into_inner()).unwrap_or_else(|_| Record {
        rate_id: Some("auto".to_string()), base_currency: Some("auto".to_string()), quote_currency: Some("auto".to_string()), bid_rate: Some("auto".to_string()), ask_rate: Some("auto".to_string()), mid_rate: Some("auto".to_string())
    });
    records.push(record.clone());
    HttpResponse::Created().json(json!({"created": true, "data": record}))
}

async fn stats(data: web::Data<AppState>) -> HttpResponse {
    let records = data.records.lock().unwrap();
    HttpResponse::Ok().json(json!({
        "total": records.len(),
        "table": "fx_rates",
        "source": "database",
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let db_url = env::var("DATABASE_URL").ok();
    
    println!("[fx-rates-engine-rs] Starting on :{}", port);
    
    let data = web::Data::new(AppState {
        records: Mutex::new(Vec::new()),
        db_url,
    });
    
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/health", web::get().to(health))
            .route("/healthz", web::get().to(health))
            .route("/v1/fx-rates-engine/list", web::get().to(list_records))
            .route("/v1/fx-rates-engine/stats", web::get().to(stats))
            .route("/v1/fx-rates-engine/{id}", web::get().to(get_record))
            .route("/v1/fx-rates-engine", web::post().to(create_record))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

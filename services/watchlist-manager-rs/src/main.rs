use actix_web::{web, App, HttpServer, HttpResponse};
use serde_json::json;
use std::sync::RwLock;

struct AppState { data: RwLock<serde_json::Value> }

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(json!({ "service": "watchlist-manager", "status": "healthy", "version": "1.0.0", "middleware": {"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "watchlist-manager-rs", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "watchlist-manager-rs", "route": "/v1/watchlist-manager"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}} }))
}

async fn list(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    HttpResponse::Ok().json(json!({ "total": d.as_array().map(|a| a.len()).unwrap_or(0), "watchlists": *d }))
}

async fn stats(state: web::Data<AppState>) -> HttpResponse {
    let d = state.data.read().unwrap();
    let total = d.as_array().map(|a| a.len()).unwrap_or(0);
    HttpResponse::Ok().json(json!({ "total": total, "active": total, "service": "Global Watchlist Manager" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::var("PORT").unwrap_or("8578".into()).parse().unwrap();
    let seed: serde_json::Value = serde_json::from_str(r#"[{"id": "WL-OFAC", "name": "OFAC SDN List", "source": "US Treasury", "url": "https://www.treasury.gov/ofac/downloads/sdnlist.xml", "format": "XML", "entries": 12847, "lastSync": "2026-05-13T06:00:00Z", "syncFrequency": "every_6h", "autoSync": true, "deltaUpdatesEnabled": true, "status": "active"}, {"id": "WL-UN", "name": "UN Security Council", "source": "United Nations", "url": "https://scsanctions.un.org/resources/xml/en/consolidated.xml", "format": "XML", "entries": 764, "lastSync": "2026-05-13T00:00:00Z", "syncFrequency": "daily", "autoSync": true, "deltaUpdatesEnabled": true, "status": "active"}, {"id": "WL-EU", "name": "EU Financial Sanctions", "source": "European Commission", "url": "https://webgate.ec.europa.eu/fsd/fsf", "format": "XML", "entries": 2156, "lastSync": "2026-05-13T06:00:00Z", "syncFrequency": "every_6h", "autoSync": true, "deltaUpdatesEnabled": true, "status": "active"}, {"id": "WL-CBN", "name": "CBN Internal Watchlist", "source": "Central Bank of Nigeria", "url": "internal://cbn-api", "format": "JSON", "entries": 892, "lastSync": "2026-05-13T12:00:00Z", "syncFrequency": "real_time", "autoSync": true, "deltaUpdatesEnabled": true, "status": "active"}, {"id": "WL-EFCC", "name": "EFCC Watchlist", "source": "EFCC", "url": "internal://efcc-api", "format": "JSON", "entries": 1245, "lastSync": "2026-05-13T08:00:00Z", "syncFrequency": "every_6h", "autoSync": true, "deltaUpdatesEnabled": true, "status": "active"}, {"id": "WL-FATF", "name": "FATF Grey/Black Lists", "source": "FATF", "url": "https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html", "format": "HTML_SCRAPE", "entries": 43, "lastSync": "2026-05-12T00:00:00Z", "syncFrequency": "weekly", "autoSync": true, "deltaUpdatesEnabled": false, "status": "active"}]"#).unwrap();
    let state = web::Data::new(AppState { data: RwLock::new(seed) });
    println!("Global Watchlist Manager on :{}", port);
    HttpServer::new(move || {
        App::new().app_data(state.clone())
            .route("/healthz", web::get().to(healthz))
            .route("/v1/watchlist-manager/list", web::get().to(list))
            .route("/v1/watchlist-manager/stats", web::get().to(stats))
    }).bind(("0.0.0.0", port))?.run().await
}

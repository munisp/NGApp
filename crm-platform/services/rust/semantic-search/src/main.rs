use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SearchQuery {
    query: String,
    tenant_id: String,
    limit: Option<usize>,
    filters: Option<SearchFilters>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SearchFilters {
    vertical: Option<String>,     // banking, telco, commodity, cpaas
    entity_type: Option<String>,  // customer, deal, subscriber, trade
    date_from: Option<String>,
    date_to: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SearchResult {
    id: String,
    entity_type: String,
    title: String,
    snippet: String,
    relevance_score: f64,
    metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResponse {
    results: Vec<SearchResult>,
    total: usize,
    query: String,
    took_ms: u64,
}

/// Simple in-memory vector store (production: use pgvector or Qdrant)
struct VectorStore {
    documents: Vec<(String, Vec<f32>, serde_json::Value)>, // (text, embedding, metadata)
}

impl VectorStore {
    fn new() -> Self {
        VectorStore { documents: Vec::new() }
    }

    fn search(&self, _query_embedding: &[f32], limit: usize) -> Vec<SearchResult> {
        // Simplified: return mock results. Production would compute cosine similarity.
        self.documents.iter().take(limit).enumerate().map(|(i, (text, _, meta))| {
            SearchResult {
                id: format!("doc-{}", i),
                entity_type: meta.get("type").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                title: text.chars().take(50).collect(),
                snippet: text.chars().take(200).collect(),
                relevance_score: 1.0 - (i as f64 * 0.1),
                metadata: meta.clone(),
            }
        }).collect()
    }
}

type AppState = web::Data<Mutex<VectorStore>>;

async fn semantic_search(
    query: web::Json<SearchQuery>,
    _state: AppState,
) -> HttpResponse {
    let limit = query.limit.unwrap_or(10);

    // In production: embed query via Ollama, then vector search
    let results = vec![
        SearchResult {
            id: "cust-001".into(),
            entity_type: "customer".into(),
            title: "Dangote Industries — Enterprise Account".into(),
            snippet: "Large enterprise customer in manufacturing sector. Active since 2023. Uses core banking + agent banking modules.".into(),
            relevance_score: 0.95,
            metadata: serde_json::json!({"segment": "enterprise", "vertical": "banking", "health_score": 82}),
        },
        SearchResult {
            id: "sub-042".into(),
            entity_type: "subscriber".into(),
            title: "MSISDN +234-801-XXX-XXXX — High ARPU Subscriber".into(),
            snippet: "Postpaid subscriber on Premium Unlimited plan. $45/month ARPU. Low churn risk.".into(),
            relevance_score: 0.87,
            metadata: serde_json::json!({"plan": "premium_unlimited", "vertical": "telco", "churn_risk": 0.12}),
        },
    ];

    HttpResponse::Ok().json(SearchResponse {
        total: results.len(),
        results: results.into_iter().take(limit).collect(),
        query: query.query.clone(),
        took_ms: 23,
    })
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "healthy", "service": "semantic-search"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Semantic Search Engine starting on :8094");
    let store = web::Data::new(Mutex::new(VectorStore::new()));

    HttpServer::new(move || {
        App::new()
            .app_data(store.clone())
            .route("/api/v1/search/semantic", web::post().to(semantic_search))
            .route("/health", web::get().to(health))
    })
    .bind("0.0.0.0:8094")?
    .run()
    .await
}

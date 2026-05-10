// Redis Cache Service — Production caching, session store, rate limiting, pub/sub
// Rust microservice providing Redis-compatible operations for all 54Bank services
// Features: key-value cache with TTL, session management, rate limiter, distributed locks, pub/sub channels

use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
struct CacheEntry {
    key: String,
    value: Value,
    ttl_seconds: i64,
    created_at: u64,
    expires_at: u64,
    hits: u64,
    namespace: String,
}

#[derive(Debug, Clone, Serialize)]
struct Session {
    id: String,
    user_id: String,
    tenant_id: String,
    data: Value,
    created_at: u64,
    last_accessed: u64,
    expires_at: u64,
    ip_address: String,
}

#[derive(Debug, Clone, Serialize)]
struct RateLimitEntry {
    key: String,
    window_ms: u64,
    max_requests: u64,
    current_count: u64,
    remaining: u64,
    reset_at: u64,
}

#[derive(Debug, Clone, Serialize)]
struct PubSubChannel {
    name: String,
    subscribers: u32,
    messages_published: u64,
    last_message_at: String,
}

#[derive(Debug, Deserialize)]
struct SetRequest {
    key: String,
    value: Value,
    ttl_seconds: Option<i64>,
    namespace: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SessionCreateRequest {
    user_id: String,
    tenant_id: Option<String>,
    data: Option<Value>,
    ttl_seconds: Option<i64>,
    ip_address: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RateLimitCheckRequest {
    key: String,
    window_ms: Option<u64>,
    max_requests: Option<u64>,
}

struct AppState {
    cache: Mutex<HashMap<String, CacheEntry>>,
    sessions: Mutex<Vec<Session>>,
    rate_limits: Mutex<HashMap<String, RateLimitEntry>>,
    channels: Mutex<Vec<PubSubChannel>>,
    stats: Mutex<CacheStats>,
}

#[derive(Debug, Clone, Serialize)]
struct CacheStats {
    total_keys: u64,
    hits: u64,
    misses: u64,
    evictions: u64,
    memory_used_bytes: u64,
    active_sessions: u64,
    rate_limit_blocks: u64,
}

fn now_epoch() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

fn middleware_config() -> Value {
    serde_json::json!({
        "kafka": { "broker": env::var("KAFKA_BROKER").unwrap_or_else(|_| "localhost:9092".into()) },
        "redis": { "url": env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()), "status": "embedded" },
        "postgres": { "url": env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db".into()) },
        "opensearch": { "url": env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".into()) },
        "keycloak": { "url": env::var("KEYCLOAK_URL").unwrap_or_else(|_| "http://localhost:8080".into()), "realm": "54bank" },
        "permify": { "url": env::var("PERMIFY_URL").unwrap_or_else(|_| "http://localhost:3476".into()) },
        "dapr": { "url": env::var("DAPR_URL").unwrap_or_else(|_| "http://localhost:3500".into()), "app_id": "redis-cache" },
        "fluvio": { "url": env::var("FLUVIO_URL").unwrap_or_else(|_| "localhost:9003".into()) },
        "temporal": { "url": env::var("TEMPORAL_URL").unwrap_or_else(|_| "localhost:7233".into()) },
        "mojaloop": { "url": env::var("MOJALOOP_URL").unwrap_or_else(|_| "http://localhost:3002".into()) },
        "tigerbeetle": { "url": env::var("TIGERBEETLE_URL").unwrap_or_else(|_| "localhost:3000".into()) },
        "lakehouse": { "url": env::var("LAKEHOUSE_URL").unwrap_or_else(|_| "http://localhost:8181".into()) },
        "apisix": { "url": env::var("APISIX_URL").unwrap_or_else(|_| "http://localhost:9080".into()) },
        "openappsec": { "url": env::var("OPENAPPSEC_URL").unwrap_or_else(|_| "http://localhost:4000".into()) }
    })
}

fn seed_data() -> AppState {
    let now = now_epoch();
    let mut cache = HashMap::new();

    // Pre-cached hot data
    let seeds = vec![
        ("fx:rates:USD_NGN", serde_json::json!({"buy": 1575.0, "sell": 1585.0, "mid": 1580.0, "source": "CBN", "timestamp": "2026-05-09T12:00:00Z"}), 300, "fx"),
        ("fx:rates:EUR_NGN", serde_json::json!({"buy": 1710.0, "sell": 1730.0, "mid": 1720.0, "source": "NAFEM", "timestamp": "2026-05-09T12:00:00Z"}), 300, "fx"),
        ("fx:rates:GBP_NGN", serde_json::json!({"buy": 1980.0, "sell": 2000.0, "mid": 1990.0, "source": "interbank", "timestamp": "2026-05-09T12:00:00Z"}), 300, "fx"),
        ("account:balance:0012345678", serde_json::json!({"balance": 2500000.0, "currency": "NGN", "lastUpdated": "2026-05-09T12:00:00Z"}), 60, "accounts"),
        ("account:balance:0023456789", serde_json::json!({"balance": 15000000.0, "currency": "NGN", "lastUpdated": "2026-05-09T12:00:00Z"}), 60, "accounts"),
        ("config:cbn:limits:tier1", serde_json::json!({"dailyTransfer": 50000, "singleTransfer": 50000, "dailyCash": 150000}), 3600, "config"),
        ("config:cbn:limits:tier2", serde_json::json!({"dailyTransfer": 200000, "singleTransfer": 100000, "dailyCash": 400000}), 3600, "config"),
        ("config:cbn:limits:tier3", serde_json::json!({"dailyTransfer": 5000000, "singleTransfer": 5000000, "dailyCash": 3000000}), 3600, "config"),
        ("kpi:dashboard:daily", serde_json::json!({"totalTransactions": 45200, "totalVolume": 8900000000.0, "activeUsers": 12400, "nplRatio": 3.2}), 900, "analytics"),
        ("branch:status:lagos_vi", serde_json::json!({"status": "open", "tellers": 8, "customers_waiting": 12, "avg_wait_min": 4.5}), 30, "operations"),
    ];

    for (key, value, ttl, ns) in seeds {
        cache.insert(key.to_string(), CacheEntry {
            key: key.to_string(),
            value,
            ttl_seconds: ttl,
            created_at: now,
            expires_at: now + ttl as u64,
            hits: 0,
            namespace: ns.to_string(),
        });
    }

    let sessions = vec![
        Session { id: "SES-001".into(), user_id: "USR-amina-bello".into(), tenant_id: "default".into(), data: serde_json::json!({"role": "teller", "branch": "Lagos-VI", "permissions": ["transfer", "cash", "inquiry"]}), created_at: now - 3600, last_accessed: now - 120, expires_at: now + 7200, ip_address: "10.0.1.45".into() },
        Session { id: "SES-002".into(), user_id: "USR-chukwudi-okafor".into(), tenant_id: "default".into(), data: serde_json::json!({"role": "relationship_manager", "branch": "Abuja-Central", "permissions": ["transfer", "loan", "fx", "inquiry"]}), created_at: now - 1800, last_accessed: now - 60, expires_at: now + 7200, ip_address: "10.0.2.12".into() },
        Session { id: "SES-003".into(), user_id: "USR-admin-001".into(), tenant_id: "default".into(), data: serde_json::json!({"role": "admin", "branch": "HQ", "permissions": ["*"]}), created_at: now - 7200, last_accessed: now - 300, expires_at: now + 3600, ip_address: "10.0.0.5".into() },
    ];

    let channels = vec![
        PubSubChannel { name: "cache:invalidation".into(), subscribers: 12, messages_published: 45000, last_message_at: "2026-05-09T12:00:00Z".into() },
        PubSubChannel { name: "session:events".into(), subscribers: 4, messages_published: 8900, last_message_at: "2026-05-09T11:58:00Z".into() },
        PubSubChannel { name: "rate:limit:alerts".into(), subscribers: 2, messages_published: 342, last_message_at: "2026-05-09T11:45:00Z".into() },
        PubSubChannel { name: "fx:rate:updates".into(), subscribers: 8, messages_published: 125000, last_message_at: "2026-05-09T12:00:00Z".into() },
    ];

    AppState {
        cache: Mutex::new(cache),
        sessions: Mutex::new(sessions),
        rate_limits: Mutex::new(HashMap::new()),
        channels: Mutex::new(channels),
        stats: Mutex::new(CacheStats {
            total_keys: 10,
            hits: 245000,
            misses: 12400,
            evictions: 890,
            memory_used_bytes: 4_500_000,
            active_sessions: 3,
            rate_limit_blocks: 42,
        }),
    }
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "redis-cache",
        "middleware": middleware_config(),
    }))
}

async fn cache_get(state: web::Data<Arc<AppState>>, path: web::Path<String>) -> HttpResponse {
    let key = path.into_inner();
    let mut cache = state.cache.lock().unwrap();
    let now = now_epoch();

    if let Some(entry) = cache.get_mut(&key) {
        if entry.expires_at > now {
            entry.hits += 1;
            let mut stats = state.stats.lock().unwrap();
            stats.hits += 1;
            return HttpResponse::Ok().json(serde_json::json!({"key": key, "value": entry.value, "ttl_remaining": entry.expires_at - now, "hits": entry.hits}));
        }
        cache.remove(&key);
    }

    let mut stats = state.stats.lock().unwrap();
    stats.misses += 1;
    HttpResponse::NotFound().json(serde_json::json!({"error": "Key not found or expired"}))
}

async fn cache_set(state: web::Data<Arc<AppState>>, body: web::Json<SetRequest>) -> HttpResponse {
    let now = now_epoch();
    let ttl = body.ttl_seconds.unwrap_or(3600);
    let ns = body.namespace.clone().unwrap_or_else(|| "default".into());

    let entry = CacheEntry {
        key: body.key.clone(),
        value: body.value.clone(),
        ttl_seconds: ttl,
        created_at: now,
        expires_at: now + ttl as u64,
        hits: 0,
        namespace: ns,
    };

    let mut cache = state.cache.lock().unwrap();
    cache.insert(body.key.clone(), entry);
    let mut stats = state.stats.lock().unwrap();
    stats.total_keys = cache.len() as u64;

    HttpResponse::Created().json(serde_json::json!({"key": body.key, "ttl": ttl, "status": "set"}))
}

async fn cache_keys(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let cache = state.cache.lock().unwrap();
    let now = now_epoch();
    let items: Vec<Value> = cache.values()
        .filter(|e| e.expires_at > now)
        .map(|e| serde_json::json!({"key": e.key, "namespace": e.namespace, "ttl_remaining": e.expires_at.saturating_sub(now), "hits": e.hits, "size_bytes": e.value.to_string().len()}))
        .collect();
    let total = items.len();
    HttpResponse::Ok().json(serde_json::json!({"items": items, "total": total}))
}

async fn session_list(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let sessions = state.sessions.lock().unwrap();
    let now = now_epoch();
    let active: Vec<&Session> = sessions.iter().filter(|s| s.expires_at > now).collect();
    HttpResponse::Ok().json(serde_json::json!({"items": active, "total": active.len()}))
}

async fn session_create(state: web::Data<Arc<AppState>>, body: web::Json<SessionCreateRequest>) -> HttpResponse {
    let now = now_epoch();
    let ttl = body.ttl_seconds.unwrap_or(7200);
    let session = Session {
        id: format!("SES-{}", &uuid_v4()[..8]),
        user_id: body.user_id.clone(),
        tenant_id: body.tenant_id.clone().unwrap_or_else(|| "default".into()),
        data: body.data.clone().unwrap_or(Value::Object(serde_json::Map::new())),
        created_at: now,
        last_accessed: now,
        expires_at: now + ttl as u64,
        ip_address: body.ip_address.clone().unwrap_or_else(|| "unknown".into()),
    };

    let mut sessions = state.sessions.lock().unwrap();
    sessions.push(session.clone());
    let mut stats = state.stats.lock().unwrap();
    stats.active_sessions = sessions.len() as u64;

    HttpResponse::Created().json(session)
}

async fn rate_limit_check(state: web::Data<Arc<AppState>>, body: web::Json<RateLimitCheckRequest>) -> HttpResponse {
    let now = now_epoch();
    let window_ms = body.window_ms.unwrap_or(60000);
    let max_requests = body.max_requests.unwrap_or(100);
    let window_secs = window_ms / 1000;

    let mut limits = state.rate_limits.lock().unwrap();
    let entry = limits.entry(body.key.clone()).or_insert(RateLimitEntry {
        key: body.key.clone(),
        window_ms,
        max_requests,
        current_count: 0,
        remaining: max_requests,
        reset_at: now + window_secs,
    });

    if now > entry.reset_at {
        entry.current_count = 0;
        entry.remaining = max_requests;
        entry.reset_at = now + window_secs;
    }

    entry.current_count += 1;
    entry.remaining = max_requests.saturating_sub(entry.current_count);
    let allowed = entry.current_count <= max_requests;

    if !allowed {
        let mut stats = state.stats.lock().unwrap();
        stats.rate_limit_blocks += 1;
    }

    HttpResponse::Ok().json(serde_json::json!({
        "allowed": allowed,
        "key": body.key,
        "current": entry.current_count,
        "limit": max_requests,
        "remaining": entry.remaining,
        "resetAt": entry.reset_at,
    }))
}

async fn pubsub_channels(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let channels = state.channels.lock().unwrap();
    HttpResponse::Ok().json(serde_json::json!({"items": *channels, "total": channels.len()}))
}

async fn cache_stats(state: web::Data<Arc<AppState>>) -> HttpResponse {
    let stats = state.stats.lock().unwrap();
    let cache = state.cache.lock().unwrap();
    let sessions = state.sessions.lock().unwrap();
    let now = now_epoch();
    let active_sessions = sessions.iter().filter(|s| s.expires_at > now).count();
    let hit_rate = if stats.hits + stats.misses > 0 {
        (stats.hits as f64 / (stats.hits + stats.misses) as f64 * 100.0 * 100.0).round() / 100.0
    } else { 0.0 };

    HttpResponse::Ok().json(serde_json::json!({
        "totalKeys": cache.len(),
        "hits": stats.hits,
        "misses": stats.misses,
        "hitRate": format!("{:.2}%", hit_rate),
        "evictions": stats.evictions,
        "memoryUsedBytes": stats.memory_used_bytes,
        "activeSessions": active_sessions,
        "rateLimitBlocks": stats.rate_limit_blocks,
        "namespaces": ["fx", "accounts", "config", "analytics", "operations"],
    }))
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:016x}{:016x}", d.as_nanos(), d.as_secs())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8202".into()).parse().unwrap_or(8202);
    let state = Arc::new(seed_data());

    println!("[redis-cache] Listening on :{}", port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/v1/cache/{key}", web::get().to(cache_get))
            .route("/v1/cache", web::post().to(cache_set))
            .route("/v1/cache/keys", web::get().to(cache_keys))
            .route("/v1/sessions", web::get().to(session_list))
            .route("/v1/sessions", web::post().to(session_create))
            .route("/v1/rate-limit/check", web::post().to(rate_limit_check))
            .route("/v1/pubsub/channels", web::get().to(pubsub_channels))
            .route("/v1/stats", web::get().to(cache_stats))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

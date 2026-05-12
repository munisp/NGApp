use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde_json::json;
use std::env;

async fn healthz() -> impl Responder {
    HttpResponse::Ok().json(json!({"status": "healthy", "service": "fraudfusion-ensemble-rs", "port": 8303}))
}

async fn ensemble_models() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "ensemble": "FraudFusion v2.0",
        "models": [
            {"id": "FF-XGB", "name": "XGBoost-Tabular", "type": "gradient_boosting", "weight": 0.30,
             "auc_roc": 0.981, "features": 47, "training_samples": 12000000,
             "specialization": "structured_transaction_features"},
            {"id": "FF-GNN", "name": "GraphSAGE-Network", "type": "graph_neural_network", "weight": 0.25,
             "auc_roc": 0.967, "graph_layers": 3, "specialization": "network_topology_fraud"},
            {"id": "FF-LSTM", "name": "BiLSTM-Sequence", "type": "recurrent_neural_network", "weight": 0.20,
             "auc_roc": 0.959, "sequence_length": 50, "specialization": "temporal_behavior_anomaly"},
            {"id": "FF-AE", "name": "VAE-Anomaly", "type": "variational_autoencoder", "weight": 0.15,
             "auc_roc": 0.948, "latent_dim": 32, "specialization": "unsupervised_anomaly_detection"},
            {"id": "FF-ISO", "name": "IsolationForest-OOD", "type": "isolation_forest", "weight": 0.10,
             "auc_roc": 0.923, "n_estimators": 500, "specialization": "out_of_distribution_detection"}
        ],
        "fusion_strategy": "stacking_meta_learner",
        "meta_learner": "logistic_regression",
        "ensemble_auc_roc": 0.993,
        "ensemble_precision": 0.968,
        "ensemble_recall": 0.971,
        "latency_p99_ms": 45,
        "daily_predictions": 8500000
    }))
}

async fn fraud_alerts() -> impl Responder {
    HttpResponse::Ok().json(json!([
        {"id": "FA-001", "ensemble_score": 0.97, "model_votes": {"XGB": 0.95, "GNN": 0.98, "LSTM": 0.96, "VAE": 0.99, "ISO": 0.94},
         "fraud_type": "account_takeover", "amount_ngn": 2500000, "customer": "CUST-4421",
         "triggered_rules": ["velocity_spike", "new_device", "unusual_geo"], "status": "confirmed"},
        {"id": "FA-002", "ensemble_score": 0.91, "model_votes": {"XGB": 0.88, "GNN": 0.94, "LSTM": 0.90, "VAE": 0.92, "ISO": 0.87},
         "fraud_type": "synthetic_identity", "amount_ngn": 15000000, "customer": "CUST-8832",
         "triggered_rules": ["identity_cluster", "rapid_onboarding", "shared_device"], "status": "investigating"},
        {"id": "FA-003", "ensemble_score": 0.89, "model_votes": {"XGB": 0.92, "GNN": 0.87, "LSTM": 0.85, "VAE": 0.91, "ISO": 0.90},
         "fraud_type": "card_not_present", "amount_ngn": 890000, "customer": "CUST-1123",
         "triggered_rules": ["high_risk_merchant", "amount_outlier"], "status": "blocked"}
    ]))
}

async fn model_performance() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "daily_stats": {"total_predictions": 8500000, "fraud_detected": 12400, "false_positives": 380,
                        "false_negatives": 45, "precision": 0.970, "recall": 0.996, "f1": 0.983},
        "model_drift": {"xgb_drift": 0.02, "gnn_drift": 0.01, "lstm_drift": 0.03, "vae_drift": 0.01},
        "retrain_schedule": "weekly", "last_retrained": "2026-05-07T02:00:00Z"
    }))
}

async fn middleware_config() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "kafka": {"topics": ["fraudfusion.predictions", "fraudfusion.alerts", "fraudfusion.model.drift"]},
        "dapr": {"stateStore": "fraudfusion-state"}, "fluvio": {"topics": ["ff-realtime-scoring"]},
        "temporal": {"workflows": ["ff-ensemble-train", "ff-model-retrain", "ff-alert-investigation"]},
        "postgres": {"tables": ["ff_predictions", "ff_alerts", "ff_model_versions"]},
        "keycloak": {"roles": ["ff-admin", "ff-analyst"]}, "permify": {"relations": ["ff:can_score"]},
        "redis": {"keys": ["ff:model:weights", "ff:prediction:cache", "ff:drift:metrics"]},
        "mojaloop": {"oracle": "ff-fraud-oracle"}, "opensearch": {"indices": ["ff-alerts", "ff-predictions"]},
        "openappsec": {"policy": "ff-api-protection"}, "apisix": {"route": "/api/fraudfusion/*"},
        "tigerbeetle": {"accounts": ["ff_frozen_funds"]}, "lakehouse": {"tables": ["ff_predictions_lake"]}
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8303".into()).parse().unwrap_or(8303);
    println!("FraudFusion Ensemble on :{}", port);
    HttpServer::new(|| App::new()
        .route("/healthz", web::get().to(healthz))
        .route("/api/fraudfusion/models", web::get().to(ensemble_models))
        .route("/api/fraudfusion/alerts", web::get().to(fraud_alerts))
        .route("/api/fraudfusion/performance", web::get().to(model_performance))
        .route("/api/fraudfusion/middleware", web::get().to(middleware_config))
    ).bind(("0.0.0.0", port))?.run().await
}

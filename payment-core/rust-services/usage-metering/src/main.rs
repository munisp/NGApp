use chrono::{DateTime, Utc, Duration, Datelike};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

/// Represents a metered API call record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub id: String,
    pub tenant_id: String,
    pub api_key_id: String,
    pub endpoint: String,
    pub method: String,
    pub status_code: u16,
    pub response_time_ms: u64,
    pub request_size_bytes: u64,
    pub response_size_bytes: u64,
    pub timestamp: DateTime<Utc>,
    pub environment: Environment,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Production,
    Sandbox,
}

/// Quota configuration per subscription tier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaConfig {
    pub tier: String,
    pub monthly_api_calls: u64,
    pub daily_api_calls: u64,
    pub requests_per_second: u64,
    pub max_bandwidth_gb: f64,
    pub max_webhooks: u32,
    pub max_api_keys: u32,
    pub data_retention_days: u32,
    pub price_per_month_usd: f64,
    pub overage_rate_per_1000: f64,
}

/// Per-tenant usage summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSummary {
    pub tenant_id: String,
    pub tenant_name: String,
    pub period: String,
    pub tier: String,
    pub api_calls: UsageMetric,
    pub bandwidth: BandwidthMetric,
    pub endpoints: Vec<EndpointUsage>,
    pub daily_breakdown: Vec<DailyUsage>,
    pub status_distribution: HashMap<String, u64>,
    pub avg_response_time_ms: f64,
    pub estimated_cost_usd: f64,
    pub quota_utilization_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageMetric {
    pub total: u64,
    pub limit: u64,
    pub remaining: u64,
    pub utilization_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthMetric {
    pub ingress_gb: f64,
    pub egress_gb: f64,
    pub total_gb: f64,
    pub limit_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointUsage {
    pub endpoint: String,
    pub method: String,
    pub calls: u64,
    pub avg_response_ms: f64,
    pub error_rate_pct: f64,
    pub bandwidth_mb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyUsage {
    pub date: String,
    pub calls: u64,
    pub errors: u64,
    pub bandwidth_mb: f64,
    pub avg_latency_ms: f64,
}

/// Quota enforcement result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaCheckResult {
    pub allowed: bool,
    pub tenant_id: String,
    pub reason: Option<String>,
    pub current_usage: u64,
    pub limit: u64,
    pub remaining: u64,
    pub reset_at: DateTime<Utc>,
}

/// Billing invoice
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: String,
    pub tenant_id: String,
    pub tenant_name: String,
    pub period: String,
    pub tier: String,
    pub base_cost_usd: f64,
    pub overage_calls: u64,
    pub overage_cost_usd: f64,
    pub total_cost_usd: f64,
    pub line_items: Vec<InvoiceLineItem>,
    pub status: InvoiceStatus,
    pub issued_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineItem {
    pub description: String,
    pub quantity: u64,
    pub unit_price_usd: f64,
    pub total_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InvoiceStatus {
    Draft,
    Issued,
    Paid,
    Overdue,
}

/// Usage metering service with in-memory storage
pub struct MeteringService {
    records: Arc<RwLock<Vec<UsageRecord>>>,
    quotas: HashMap<String, QuotaConfig>,
}

impl MeteringService {
    pub fn new() -> Self {
        let mut quotas = HashMap::new();
        quotas.insert("trial".to_string(), QuotaConfig {
            tier: "trial".to_string(),
            monthly_api_calls: 10_000,
            daily_api_calls: 500,
            requests_per_second: 10,
            max_bandwidth_gb: 1.0,
            max_webhooks: 2,
            max_api_keys: 1,
            data_retention_days: 7,
            price_per_month_usd: 0.0,
            overage_rate_per_1000: 0.0,
        });
        quotas.insert("growth".to_string(), QuotaConfig {
            tier: "growth".to_string(),
            monthly_api_calls: 500_000,
            daily_api_calls: 25_000,
            requests_per_second: 100,
            max_bandwidth_gb: 50.0,
            max_webhooks: 10,
            max_api_keys: 5,
            data_retention_days: 30,
            price_per_month_usd: 299.0,
            overage_rate_per_1000: 0.50,
        });
        quotas.insert("enterprise".to_string(), QuotaConfig {
            tier: "enterprise".to_string(),
            monthly_api_calls: 10_000_000,
            daily_api_calls: 500_000,
            requests_per_second: 1000,
            max_bandwidth_gb: 500.0,
            max_webhooks: 50,
            max_api_keys: 25,
            data_retention_days: 90,
            price_per_month_usd: 1_499.0,
            overage_rate_per_1000: 0.25,
        });

        let svc = MeteringService {
            records: Arc::new(RwLock::new(Vec::new())),
            quotas,
        };
        svc.seed_records();
        svc
    }

    fn seed_records(&self) {
        let now = Utc::now();
        let tenants = vec![
            ("tenant-acme-bank", "enterprise"),
            ("tenant-quickcash", "growth"),
            ("tenant-swiftremit", "enterprise"),
            ("tenant-nextgen-mfb", "trial"),
        ];
        let endpoints = vec![
            ("/v1/customers", "GET", 45),
            ("/v1/customers", "POST", 120),
            ("/v1/banking/transactions", "GET", 35),
            ("/v1/banking/transactions", "POST", 85),
            ("/v1/agents", "GET", 25),
            ("/v1/agents/transactions", "POST", 65),
            ("/v1/remittance/corridors", "GET", 15),
            ("/v1/remittance/transfers", "POST", 150),
            ("/v1/campaigns", "GET", 20),
            ("/v1/analytics/dashboard", "GET", 55),
        ];

        let mut records = self.records.write().unwrap();
        for day_offset in 0..30 {
            for (tenant_id, _tier) in &tenants {
                let base_calls = match *tenant_id {
                    "tenant-acme-bank" => 8500,
                    "tenant-quickcash" => 3200,
                    "tenant-swiftremit" => 5100,
                    "tenant-nextgen-mfb" => 120,
                    _ => 100,
                };
                let day_variation = ((day_offset as f64 * 0.7).sin() * 0.15 + 1.0) as u64;
                let daily_calls = base_calls * day_variation;

                for call_idx in 0..daily_calls.min(50) {
                    let (endpoint, method, avg_latency) = &endpoints[(call_idx as usize) % endpoints.len()];
                    let latency_jitter = (*avg_latency as f64 * (1.0 + (call_idx as f64 * 0.3).sin() * 0.4)) as u64;
                    let status = if call_idx % 47 == 0 { 500 } else if call_idx % 23 == 0 { 429 } else { 200 };

                    records.push(UsageRecord {
                        id: Uuid::new_v4().to_string(),
                        tenant_id: tenant_id.to_string(),
                        api_key_id: format!("key-{}-prod", tenant_id.replace("tenant-", "")),
                        endpoint: endpoint.to_string(),
                        method: method.to_string(),
                        status_code: status,
                        response_time_ms: latency_jitter,
                        request_size_bytes: 512 + (call_idx * 128) as u64,
                        response_size_bytes: 2048 + (call_idx * 256) as u64,
                        timestamp: now - Duration::days(day_offset as i64) + Duration::seconds(call_idx as i64 * 17),
                        environment: if call_idx % 10 == 0 { Environment::Sandbox } else { Environment::Production },
                    });
                }
            }
        }
    }

    /// Check if a tenant has remaining quota
    pub fn check_quota(&self, tenant_id: &str, tier: &str) -> QuotaCheckResult {
        let quota = self.quotas.get(tier).unwrap_or(self.quotas.get("trial").unwrap());
        let records = self.records.read().unwrap();
        let now = Utc::now();
        let month_start = now.with_day(1).unwrap().date_naive();

        let monthly_usage: u64 = records.iter()
            .filter(|r| r.tenant_id == tenant_id && r.timestamp.date_naive() >= month_start)
            .count() as u64;

        let remaining = quota.monthly_api_calls.saturating_sub(monthly_usage);
        let next_month = if now.month() == 12 {
            now.with_month(1).unwrap().with_year(now.year() + 1).unwrap()
        } else {
            now.with_month(now.month() + 1).unwrap()
        };

        QuotaCheckResult {
            allowed: remaining > 0,
            tenant_id: tenant_id.to_string(),
            reason: if remaining == 0 { Some("Monthly quota exceeded".to_string()) } else { None },
            current_usage: monthly_usage,
            limit: quota.monthly_api_calls,
            remaining,
            reset_at: next_month.with_day(1).unwrap(),
        }
    }

    /// Get usage summary for a tenant
    pub fn get_usage_summary(&self, tenant_id: &str, tier: &str, tenant_name: &str) -> UsageSummary {
        let quota = self.quotas.get(tier).unwrap_or(self.quotas.get("trial").unwrap());
        let records = self.records.read().unwrap();
        let now = Utc::now();
        let month_start = now.with_day(1).unwrap().date_naive();

        let monthly_records: Vec<&UsageRecord> = records.iter()
            .filter(|r| r.tenant_id == tenant_id && r.timestamp.date_naive() >= month_start)
            .collect();

        let total_calls = monthly_records.len() as u64;
        let total_ingress: f64 = monthly_records.iter().map(|r| r.request_size_bytes as f64).sum::<f64>() / 1_073_741_824.0;
        let total_egress: f64 = monthly_records.iter().map(|r| r.response_size_bytes as f64).sum::<f64>() / 1_073_741_824.0;
        let avg_response: f64 = if !monthly_records.is_empty() {
            monthly_records.iter().map(|r| r.response_time_ms as f64).sum::<f64>() / monthly_records.len() as f64
        } else { 0.0 };

        // Status distribution
        let mut status_dist: HashMap<String, u64> = HashMap::new();
        for r in &monthly_records {
            let key = format!("{}xx", r.status_code / 100);
            *status_dist.entry(key).or_insert(0) += 1;
        }

        // Endpoint breakdown
        let mut endpoint_map: HashMap<(String, String), Vec<&UsageRecord>> = HashMap::new();
        for r in &monthly_records {
            endpoint_map.entry((r.endpoint.clone(), r.method.clone())).or_default().push(r);
        }
        let endpoints: Vec<EndpointUsage> = endpoint_map.iter().map(|((ep, method), recs)| {
            let errors = recs.iter().filter(|r| r.status_code >= 400).count() as f64;
            EndpointUsage {
                endpoint: ep.clone(),
                method: method.clone(),
                calls: recs.len() as u64,
                avg_response_ms: recs.iter().map(|r| r.response_time_ms as f64).sum::<f64>() / recs.len() as f64,
                error_rate_pct: (errors / recs.len() as f64) * 100.0,
                bandwidth_mb: recs.iter().map(|r| (r.request_size_bytes + r.response_size_bytes) as f64).sum::<f64>() / 1_048_576.0,
            }
        }).collect();

        // Daily breakdown
        let mut daily_map: HashMap<String, (u64, u64, f64, f64)> = HashMap::new();
        for r in &monthly_records {
            let date = r.timestamp.format("%Y-%m-%d").to_string();
            let entry = daily_map.entry(date).or_insert((0, 0, 0.0, 0.0));
            entry.0 += 1;
            if r.status_code >= 400 { entry.1 += 1; }
            entry.2 += (r.request_size_bytes + r.response_size_bytes) as f64 / 1_048_576.0;
            entry.3 += r.response_time_ms as f64;
        }
        let mut daily_breakdown: Vec<DailyUsage> = daily_map.into_iter().map(|(date, (calls, errors, bw, lat))| {
            DailyUsage {
                date,
                calls,
                errors,
                bandwidth_mb: bw,
                avg_latency_ms: if calls > 0 { lat / calls as f64 } else { 0.0 },
            }
        }).collect();
        daily_breakdown.sort_by(|a, b| a.date.cmp(&b.date));

        let remaining = quota.monthly_api_calls.saturating_sub(total_calls);
        let utilization = (total_calls as f64 / quota.monthly_api_calls as f64) * 100.0;
        let overage = total_calls.saturating_sub(quota.monthly_api_calls);
        let overage_cost = (overage as f64 / 1000.0) * quota.overage_rate_per_1000;

        UsageSummary {
            tenant_id: tenant_id.to_string(),
            tenant_name: tenant_name.to_string(),
            period: format!("{}", now.format("%Y-%m")),
            tier: tier.to_string(),
            api_calls: UsageMetric {
                total: total_calls,
                limit: quota.monthly_api_calls,
                remaining,
                utilization_pct: utilization,
            },
            bandwidth: BandwidthMetric {
                ingress_gb: total_ingress,
                egress_gb: total_egress,
                total_gb: total_ingress + total_egress,
                limit_gb: quota.max_bandwidth_gb,
            },
            endpoints,
            daily_breakdown,
            status_distribution: status_dist,
            avg_response_time_ms: avg_response,
            estimated_cost_usd: quota.price_per_month_usd + overage_cost,
            quota_utilization_pct: utilization,
        }
    }

    /// Generate invoice for a tenant
    pub fn generate_invoice(&self, tenant_id: &str, tier: &str, tenant_name: &str) -> Invoice {
        let summary = self.get_usage_summary(tenant_id, tier, tenant_name);
        let quota = self.quotas.get(tier).unwrap_or(self.quotas.get("trial").unwrap());
        let now = Utc::now();
        let overage = summary.api_calls.total.saturating_sub(quota.monthly_api_calls);
        let overage_cost = (overage as f64 / 1000.0) * quota.overage_rate_per_1000;

        let mut line_items = vec![
            InvoiceLineItem {
                description: format!("{} Plan - Monthly Subscription", capitalize(&tier)),
                quantity: 1,
                unit_price_usd: quota.price_per_month_usd,
                total_usd: quota.price_per_month_usd,
            },
            InvoiceLineItem {
                description: format!("API Calls ({} included)", format_number(quota.monthly_api_calls)),
                quantity: summary.api_calls.total.min(quota.monthly_api_calls),
                unit_price_usd: 0.0,
                total_usd: 0.0,
            },
        ];

        if overage > 0 {
            line_items.push(InvoiceLineItem {
                description: format!("Overage API Calls (${:.2}/1,000)", quota.overage_rate_per_1000),
                quantity: overage,
                unit_price_usd: quota.overage_rate_per_1000 / 1000.0,
                total_usd: overage_cost,
            });
        }

        Invoice {
            id: format!("INV-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
            tenant_id: tenant_id.to_string(),
            tenant_name: tenant_name.to_string(),
            period: summary.period,
            tier: tier.to_string(),
            base_cost_usd: quota.price_per_month_usd,
            overage_calls: overage,
            overage_cost_usd: overage_cost,
            total_cost_usd: quota.price_per_month_usd + overage_cost,
            line_items,
            status: InvoiceStatus::Draft,
            issued_at: now,
            due_at: now + Duration::days(30),
        }
    }

    /// Get all quota configurations
    pub fn get_quota_tiers(&self) -> Vec<&QuotaConfig> {
        let mut tiers: Vec<&QuotaConfig> = self.quotas.values().collect();
        tiers.sort_by(|a, b| a.price_per_month_usd.partial_cmp(&b.price_per_month_usd).unwrap());
        tiers
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

fn format_number(n: u64) -> String {
    if n >= 1_000_000 { format!("{}M", n / 1_000_000) }
    else if n >= 1_000 { format!("{}K", n / 1_000) }
    else { n.to_string() }
}

fn main() {
    let service = MeteringService::new();

    // Demo: print usage summary for each tenant
    let tenants = vec![
        ("tenant-acme-bank", "enterprise", "Acme Microfinance Bank"),
        ("tenant-quickcash", "growth", "QuickCash Mobile Money"),
        ("tenant-swiftremit", "enterprise", "SwiftRemit International"),
        ("tenant-nextgen-mfb", "trial", "NextGen MFB"),
    ];

    for (id, tier, name) in &tenants {
        let summary = service.get_usage_summary(id, tier, name);
        println!("{}: {}/{} calls ({:.1}% used), est. ${:.2}",
            name, summary.api_calls.total, summary.api_calls.limit,
            summary.quota_utilization_pct, summary.estimated_cost_usd);

        let quota_check = service.check_quota(id, tier);
        println!("  Quota: {} remaining, allowed={}", quota_check.remaining, quota_check.allowed);
    }
}

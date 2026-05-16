use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct LatencyHistogram {
    pub p50: f64,
    pub p90: f64,
    pub p95: f64,
    pub p99: f64,
    pub max: f64,
    pub count: u64,
}

impl LatencyHistogram {
    pub fn new() -> Self {
        LatencyHistogram { p50: 0.0, p90: 0.0, p95: 0.0, p99: 0.0, max: 0.0, count: 0 }
    }
}

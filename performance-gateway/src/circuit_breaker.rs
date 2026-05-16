use chrono::Utc;

pub struct CircuitBreaker {
    failure_threshold: u32,
    reset_timeout_sec: u64,
    failure_count: u32,
    state: String,
    last_failure: String,
}

impl CircuitBreaker {
    pub fn new(threshold: u32, timeout: u64) -> Self {
        CircuitBreaker {
            failure_threshold: threshold,
            reset_timeout_sec: timeout,
            failure_count: 0,
            state: "closed".to_string(),
            last_failure: "".to_string(),
        }
    }

    pub fn state(&self) -> &str { &self.state }
    pub fn failure_count(&self) -> u32 { self.failure_count }
    pub fn last_failure(&self) -> &str { &self.last_failure }

    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure = Utc::now().to_rfc3339();
        if self.failure_count >= self.failure_threshold {
            self.state = "open".to_string();
        }
    }

    pub fn record_success(&mut self) {
        self.failure_count = 0;
        self.state = "closed".to_string();
    }

    pub fn is_allowed(&self) -> bool {
        self.state != "open"
    }
}

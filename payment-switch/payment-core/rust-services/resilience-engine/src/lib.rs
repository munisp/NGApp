use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Circuit breaker states
#[derive(Debug, Clone, PartialEq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker for resilient service calls
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    pub name: String,
    pub state: CircuitState,
    pub failure_count: u32,
    pub success_count: u32,
    pub failure_threshold: u32,
    pub recovery_timeout: Duration,
    pub last_failure: Option<Instant>,
    pub half_open_max_calls: u32,
}

impl CircuitBreaker {
    pub fn new(name: &str, failure_threshold: u32, recovery_timeout_secs: u64) -> Self {
        CircuitBreaker {
            name: name.to_string(),
            state: CircuitState::Closed,
            failure_count: 0,
            success_count: 0,
            failure_threshold,
            recovery_timeout: Duration::from_secs(recovery_timeout_secs),
            last_failure: None,
            half_open_max_calls: 3,
        }
    }

    pub fn can_execute(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if let Some(last_failure) = self.last_failure {
                    if last_failure.elapsed() >= self.recovery_timeout {
                        self.state = CircuitState::HalfOpen;
                        self.success_count = 0;
                        return true;
                    }
                }
                false
            }
            CircuitState::HalfOpen => self.success_count < self.half_open_max_calls,
        }
    }

    pub fn record_success(&mut self) {
        match self.state {
            CircuitState::HalfOpen => {
                self.success_count += 1;
                if self.success_count >= self.half_open_max_calls {
                    self.state = CircuitState::Closed;
                    self.failure_count = 0;
                }
            }
            CircuitState::Closed => {
                self.failure_count = 0;
            }
            _ => {}
        }
    }

    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure = Some(Instant::now());
        match self.state {
            CircuitState::Closed if self.failure_count >= self.failure_threshold => {
                self.state = CircuitState::Open;
            }
            CircuitState::HalfOpen => {
                self.state = CircuitState::Open;
            }
            _ => {}
        }
    }
}

/// Rate limiter using token bucket algorithm
#[derive(Debug)]
pub struct RateLimiter {
    pub tokens: f64,
    pub max_tokens: f64,
    pub refill_rate: f64,
    pub last_refill: Instant,
}

impl RateLimiter {
    pub fn new(max_tokens: f64, refill_rate_per_sec: f64) -> Self {
        RateLimiter {
            tokens: max_tokens,
            max_tokens,
            refill_rate: refill_rate_per_sec,
            last_refill: Instant::now(),
        }
    }

    pub fn try_acquire(&mut self, tokens: f64) -> bool {
        self.refill();
        if self.tokens >= tokens {
            self.tokens -= tokens;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let elapsed = self.last_refill.elapsed().as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = Instant::now();
    }
}

/// DDoS mitigation with request tracking and automatic blocking
#[derive(Debug)]
pub struct DDoSMitigation {
    request_counts: HashMap<String, Vec<u64>>,
    blocked_ips: HashMap<String, u64>,
    threshold_per_second: u32,
    threshold_per_minute: u32,
    block_duration_secs: u64,
}

impl DDoSMitigation {
    pub fn new(threshold_per_second: u32, threshold_per_minute: u32, block_duration_secs: u64) -> Self {
        DDoSMitigation {
            request_counts: HashMap::new(),
            blocked_ips: HashMap::new(),
            threshold_per_second,
            threshold_per_minute,
            block_duration_secs,
        }
    }

    pub fn check_request(&mut self, ip: &str) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Check if IP is blocked
        if let Some(&unblock_time) = self.blocked_ips.get(ip) {
            if now < unblock_time {
                return false;
            }
            self.blocked_ips.remove(ip);
        }

        let timestamps = self.request_counts.entry(ip.to_string()).or_insert_with(Vec::new);
        timestamps.push(now);

        // Cleanup old timestamps (> 60 seconds)
        timestamps.retain(|&t| now - t < 60);

        // Check per-second threshold
        let last_second_count = timestamps.iter().filter(|&&t| now - t < 1).count() as u32;
        if last_second_count > self.threshold_per_second {
            self.blocked_ips.insert(ip.to_string(), now + self.block_duration_secs);
            return false;
        }

        // Check per-minute threshold
        if timestamps.len() as u32 > self.threshold_per_minute {
            self.blocked_ips.insert(ip.to_string(), now + self.block_duration_secs);
            return false;
        }

        true
    }

    pub fn is_blocked(&self, ip: &str) -> bool {
        if let Some(&unblock_time) = self.blocked_ips.get(ip) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            return now < unblock_time;
        }
        false
    }

    pub fn manually_block(&mut self, ip: &str, duration_secs: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        self.blocked_ips.insert(ip.to_string(), now + duration_secs);
    }

    pub fn unblock(&mut self, ip: &str) {
        self.blocked_ips.remove(ip);
    }

    pub fn get_blocked_count(&self) -> usize {
        self.blocked_ips.len()
    }
}

/// Resilience manager combining circuit breakers, rate limiters, and DDoS protection
pub struct ResilienceManager {
    circuit_breakers: Arc<Mutex<HashMap<String, CircuitBreaker>>>,
    rate_limiters: Arc<Mutex<HashMap<String, RateLimiter>>>,
    ddos: Arc<Mutex<DDoSMitigation>>,
}

impl ResilienceManager {
    pub fn new() -> Self {
        ResilienceManager {
            circuit_breakers: Arc::new(Mutex::new(HashMap::new())),
            rate_limiters: Arc::new(Mutex::new(HashMap::new())),
            ddos: Arc::new(Mutex::new(DDoSMitigation::new(100, 1000, 300))),
        }
    }

    pub fn register_circuit_breaker(&self, name: &str, failure_threshold: u32, recovery_timeout_secs: u64) {
        let cb = CircuitBreaker::new(name, failure_threshold, recovery_timeout_secs);
        self.circuit_breakers.lock().unwrap().insert(name.to_string(), cb);
    }

    pub fn register_rate_limiter(&self, name: &str, max_tokens: f64, refill_rate: f64) {
        let rl = RateLimiter::new(max_tokens, refill_rate);
        self.rate_limiters.lock().unwrap().insert(name.to_string(), rl);
    }

    pub fn check_request(&self, service: &str, ip: &str) -> Result<(), String> {
        // DDoS check
        if !self.ddos.lock().unwrap().check_request(ip) {
            return Err(format!("IP {} is blocked by DDoS protection", ip));
        }
        // Rate limit check
        if let Some(rl) = self.rate_limiters.lock().unwrap().get_mut(service) {
            if !rl.try_acquire(1.0) {
                return Err(format!("Rate limit exceeded for service {}", service));
            }
        }
        // Circuit breaker check
        if let Some(cb) = self.circuit_breakers.lock().unwrap().get_mut(service) {
            if !cb.can_execute() {
                return Err(format!("Circuit breaker open for service {}", service));
            }
        }
        Ok(())
    }
}

impl Default for ResilienceManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_breaker_opens_on_threshold() {
        let mut cb = CircuitBreaker::new("test", 3, 30);
        assert_eq!(cb.state, CircuitState::Closed);
        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.state, CircuitState::Closed);
        cb.record_failure();
        assert_eq!(cb.state, CircuitState::Open);
        assert!(!cb.can_execute());
    }

    #[test]
    fn test_rate_limiter() {
        let mut rl = RateLimiter::new(10.0, 1.0);
        for _ in 0..10 {
            assert!(rl.try_acquire(1.0));
        }
        assert!(!rl.try_acquire(1.0));
    }

    #[test]
    fn test_ddos_blocks_excessive_requests() {
        let mut ddos = DDoSMitigation::new(5, 100, 300);
        for _ in 0..5 {
            assert!(ddos.check_request("1.2.3.4"));
        }
        assert!(!ddos.check_request("1.2.3.4"));
        assert!(ddos.is_blocked("1.2.3.4"));
    }
}

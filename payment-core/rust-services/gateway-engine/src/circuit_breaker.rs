//! Lock-free circuit breaker with atomic state transitions
//! Provides fail-fast behavior for downstream service calls.
//! All operations are O(1) with no allocations.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Circuit breaker states (fits in 2 bits)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum State {
    Closed = 0,    // Normal operation
    Open = 1,      // Failing fast
    HalfOpen = 2,  // Testing recovery
}

/// Circuit breaker configuration
#[derive(Debug, Clone, Copy)]
pub struct CircuitBreakerConfig {
    /// Number of failures before opening
    pub failure_threshold: u32,
    /// Number of successes in half-open to close
    pub success_threshold: u32,
    /// Seconds to wait before transitioning from open to half-open
    pub recovery_timeout_secs: u32,
    /// Maximum concurrent requests allowed in half-open state
    pub half_open_max_requests: u32,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            success_threshold: 3,
            recovery_timeout_secs: 30,
            half_open_max_requests: 3,
        }
    }
}

/// Lock-free circuit breaker
/// Packed state for single-word atomic operations:
/// - Bits 0-1: State (Closed/Open/HalfOpen)
/// - Bits 2-15: Consecutive failure count (max 16383)
/// - Bits 16-29: Consecutive success count (max 16383)
/// - Bits 30-31: Half-open request count
#[repr(align(64))]
pub struct CircuitBreaker {
    /// Packed state word
    state: AtomicU32,
    /// Timestamp when circuit opened (seconds since epoch, truncated to u32)
    opened_at: AtomicU32,
    /// Configuration
    config: CircuitBreakerConfig,
    /// Stats
    total_requests: AtomicU64,
    total_allowed: AtomicU64,
    total_rejected: AtomicU64,
    total_failures: AtomicU64,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            state: AtomicU32::new(0), // Closed, 0 failures, 0 successes
            opened_at: AtomicU32::new(0),
            config,
            total_requests: AtomicU64::new(0),
            total_allowed: AtomicU64::new(0),
            total_rejected: AtomicU64::new(0),
            total_failures: AtomicU64::new(0),
        }
    }

    /// Check if a request should be allowed through.
    /// Returns true if allowed, false if circuit is open.
    /// Performance: single atomic load + comparison, <50ns.
    #[inline(always)]
    pub fn can_execute(&self) -> bool {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        let packed = self.state.load(Ordering::Acquire);
        let current_state = Self::unpack_state(packed);

        match current_state {
            State::Closed => {
                self.total_allowed.fetch_add(1, Ordering::Relaxed);
                true
            }
            State::Open => {
                // Check if recovery timeout has elapsed
                let opened = self.opened_at.load(Ordering::Relaxed);
                let now = now_secs();
                if now.saturating_sub(opened) >= self.config.recovery_timeout_secs {
                    // Transition to half-open
                    self.transition_to_half_open();
                    self.total_allowed.fetch_add(1, Ordering::Relaxed);
                    true
                } else {
                    self.total_rejected.fetch_add(1, Ordering::Relaxed);
                    false
                }
            }
            State::HalfOpen => {
                let ho_count = Self::unpack_half_open_count(packed);
                if ho_count < self.config.half_open_max_requests {
                    // Increment half-open counter
                    self.increment_half_open_count();
                    self.total_allowed.fetch_add(1, Ordering::Relaxed);
                    true
                } else {
                    self.total_rejected.fetch_add(1, Ordering::Relaxed);
                    false
                }
            }
        }
    }

    /// Record a successful request
    #[inline(always)]
    pub fn record_success(&self) {
        let packed = self.state.load(Ordering::Acquire);
        let current_state = Self::unpack_state(packed);

        match current_state {
            State::Closed => {
                // Reset failure count
                self.reset_failures();
            }
            State::HalfOpen => {
                let success_count = Self::unpack_success_count(packed) + 1;
                if success_count >= self.config.success_threshold {
                    self.transition_to_closed();
                } else {
                    self.increment_success_count();
                }
            }
            State::Open => {} // Shouldn't happen but ignore
        }
    }

    /// Record a failed request
    #[inline(always)]
    pub fn record_failure(&self) {
        self.total_failures.fetch_add(1, Ordering::Relaxed);

        let packed = self.state.load(Ordering::Acquire);
        let current_state = Self::unpack_state(packed);

        match current_state {
            State::Closed => {
                let failure_count = Self::unpack_failure_count(packed) + 1;
                if failure_count >= self.config.failure_threshold {
                    self.transition_to_open();
                } else {
                    self.increment_failure_count();
                }
            }
            State::HalfOpen => {
                // Any failure in half-open immediately re-opens
                self.transition_to_open();
            }
            State::Open => {} // Already open
        }
    }

    /// Get current state
    pub fn current_state(&self) -> State {
        let packed = self.state.load(Ordering::Relaxed);
        Self::unpack_state(packed)
    }

    /// Get stats
    pub fn stats(&self) -> CircuitBreakerStats {
        let packed = self.state.load(Ordering::Relaxed);
        CircuitBreakerStats {
            state: Self::unpack_state(packed),
            failure_count: Self::unpack_failure_count(packed),
            success_count: Self::unpack_success_count(packed),
            total_requests: self.total_requests.load(Ordering::Relaxed),
            total_allowed: self.total_allowed.load(Ordering::Relaxed),
            total_rejected: self.total_rejected.load(Ordering::Relaxed),
            total_failures: self.total_failures.load(Ordering::Relaxed),
        }
    }

    // State transition helpers
    fn transition_to_open(&self) {
        let new_packed = Self::pack(State::Open, 0, 0, 0);
        self.state.store(new_packed, Ordering::Release);
        self.opened_at.store(now_secs(), Ordering::Relaxed);
    }

    fn transition_to_half_open(&self) {
        let new_packed = Self::pack(State::HalfOpen, 0, 0, 1);
        self.state.store(new_packed, Ordering::Release);
    }

    fn transition_to_closed(&self) {
        let new_packed = Self::pack(State::Closed, 0, 0, 0);
        self.state.store(new_packed, Ordering::Release);
    }

    fn increment_failure_count(&self) {
        loop {
            let current = self.state.load(Ordering::Relaxed);
            let failures = Self::unpack_failure_count(current) + 1;
            let new_packed = Self::pack(State::Closed, failures, 0, 0);
            if self.state.compare_exchange_weak(current, new_packed, Ordering::Release, Ordering::Relaxed).is_ok() {
                break;
            }
        }
    }

    fn increment_success_count(&self) {
        loop {
            let current = self.state.load(Ordering::Relaxed);
            let successes = Self::unpack_success_count(current) + 1;
            let ho_count = Self::unpack_half_open_count(current);
            let new_packed = Self::pack(State::HalfOpen, 0, successes, ho_count);
            if self.state.compare_exchange_weak(current, new_packed, Ordering::Release, Ordering::Relaxed).is_ok() {
                break;
            }
        }
    }

    fn increment_half_open_count(&self) {
        loop {
            let current = self.state.load(Ordering::Relaxed);
            let successes = Self::unpack_success_count(current);
            let ho_count = Self::unpack_half_open_count(current) + 1;
            let new_packed = Self::pack(State::HalfOpen, 0, successes, ho_count);
            if self.state.compare_exchange_weak(current, new_packed, Ordering::Release, Ordering::Relaxed).is_ok() {
                break;
            }
        }
    }

    fn reset_failures(&self) {
        self.state.store(Self::pack(State::Closed, 0, 0, 0), Ordering::Relaxed);
    }

    // Packing/unpacking helpers
    #[inline(always)]
    fn pack(state: State, failures: u32, successes: u32, ho_count: u32) -> u32 {
        (state as u32) | ((failures & 0x3FFF) << 2) | ((successes & 0x3FFF) << 16) | ((ho_count & 0x3) << 30)
    }

    #[inline(always)]
    fn unpack_state(packed: u32) -> State {
        match packed & 0x3 {
            0 => State::Closed,
            1 => State::Open,
            2 => State::HalfOpen,
            _ => State::Closed,
        }
    }

    #[inline(always)]
    fn unpack_failure_count(packed: u32) -> u32 {
        (packed >> 2) & 0x3FFF
    }

    #[inline(always)]
    fn unpack_success_count(packed: u32) -> u32 {
        (packed >> 16) & 0x3FFF
    }

    #[inline(always)]
    fn unpack_half_open_count(packed: u32) -> u32 {
        (packed >> 30) & 0x3
    }
}

#[derive(Debug)]
pub struct CircuitBreakerStats {
    pub state: State,
    pub failure_count: u32,
    pub success_count: u32,
    pub total_requests: u64,
    pub total_allowed: u64,
    pub total_rejected: u64,
    pub total_failures: u64,
}

/// Registry for managing multiple circuit breakers by service name
pub struct CircuitBreakerRegistry {
    breakers: dashmap::DashMap<String, CircuitBreaker>,
    default_config: CircuitBreakerConfig,
}

impl CircuitBreakerRegistry {
    pub fn new(default_config: CircuitBreakerConfig) -> Self {
        Self {
            breakers: dashmap::DashMap::new(),
            default_config,
        }
    }

    pub fn get_or_create(&self, service: &str) -> dashmap::mapref::one::Ref<'_, String, CircuitBreaker> {
        if !self.breakers.contains_key(service) {
            self.breakers.insert(service.to_string(), CircuitBreaker::new(self.default_config));
        }
        self.breakers.get(service).unwrap()
    }

    pub fn register(&self, service: &str, config: CircuitBreakerConfig) {
        self.breakers.insert(service.to_string(), CircuitBreaker::new(config));
    }
}

#[inline(always)]
fn now_secs() -> u32 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_closed_allows_requests() {
        let cb = CircuitBreaker::new(CircuitBreakerConfig::default());
        assert!(cb.can_execute());
        assert_eq!(cb.current_state(), State::Closed);
    }

    #[test]
    fn test_opens_after_threshold() {
        let config = CircuitBreakerConfig { failure_threshold: 3, ..Default::default() };
        let cb = CircuitBreaker::new(config);
        for _ in 0..3 {
            assert!(cb.can_execute());
            cb.record_failure();
        }
        assert_eq!(cb.current_state(), State::Open);
        assert!(!cb.can_execute());
    }

    #[test]
    fn test_success_resets_failures() {
        let config = CircuitBreakerConfig { failure_threshold: 3, ..Default::default() };
        let cb = CircuitBreaker::new(config);
        cb.record_failure();
        cb.record_failure();
        cb.record_success(); // Should reset
        cb.record_failure();
        cb.record_failure();
        // Should NOT be open (was reset)
        assert_eq!(cb.current_state(), State::Closed);
    }
}

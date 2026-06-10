//! Payment Switch Gateway Engine
//! Ultra-low-latency request pipeline for financial transactions.
//! 
//! Architecture:
//! Request → Rate Limit (<1μs) → JWT Validate (<10μs) → Circuit Break (<50ns) → Route
//!
//! All operations are lock-free and zero-allocation on the hot path.

pub mod rate_limiter;
pub mod jwt_validator;
pub mod circuit_breaker;

pub use rate_limiter::{RateLimiter, RateLimitTier, RateLimitResult, hash_ip};
pub use jwt_validator::{JwtValidator, JwtValidatorConfig, JwtClaims, JwtError};
pub use circuit_breaker::{CircuitBreaker, CircuitBreakerConfig, CircuitBreakerRegistry, State};

/// Gateway pipeline — combines all checks into a single fast path
pub struct GatewayPipeline {
    pub rate_limiter: RateLimiter,
    pub jwt_validator: JwtValidator,
    pub circuit_breakers: CircuitBreakerRegistry,
}

/// Result of processing a request through the gateway
#[derive(Debug)]
pub enum GatewayResult {
    /// Request is allowed, contains validated claims
    Allowed(JwtClaims),
    /// Rate limited
    RateLimited,
    /// JWT validation failed
    Unauthorized(JwtError),
    /// Downstream service circuit is open
    CircuitOpen(String),
}

impl GatewayPipeline {
    pub fn new(config: GatewayConfig) -> Self {
        Self {
            rate_limiter: RateLimiter::new(config.default_rate_tier),
            jwt_validator: JwtValidator::new(config.jwt_config),
            circuit_breakers: CircuitBreakerRegistry::new(config.circuit_breaker_config),
        }
    }

    /// Process a request through the full pipeline.
    /// Total latency: <15μs typical.
    #[inline]
    pub fn process_request(
        &self,
        ip_hash: u64,
        api_key_hash: Option<u64>,
        tier: &RateLimitTier,
        token: &str,
        target_service: &str,
    ) -> GatewayResult {
        // Step 1: Rate limit check (<1μs)
        let rate_result = self.rate_limiter.check_request(ip_hash, api_key_hash, tier);
        if rate_result != RateLimitResult::Allowed {
            return GatewayResult::RateLimited;
        }

        // Step 2: JWT validation (<10μs with cached keys)
        let claims = match self.jwt_validator.validate(token) {
            Ok(c) => c,
            Err(e) => return GatewayResult::Unauthorized(e),
        };

        // Step 3: Circuit breaker check (<50ns)
        let cb = self.circuit_breakers.get_or_create(target_service);
        if !cb.can_execute() {
            return GatewayResult::CircuitOpen(target_service.to_string());
        }

        GatewayResult::Allowed(claims)
    }

    /// Record outcome for circuit breaker
    pub fn record_outcome(&self, service: &str, success: bool) {
        let cb = self.circuit_breakers.get_or_create(service);
        if success {
            cb.record_success();
        } else {
            cb.record_failure();
        }
    }
}

/// Gateway configuration
pub struct GatewayConfig {
    pub default_rate_tier: RateLimitTier,
    pub jwt_config: JwtValidatorConfig,
    pub circuit_breaker_config: CircuitBreakerConfig,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            default_rate_tier: RateLimitTier::BASIC,
            jwt_config: JwtValidatorConfig::default(),
            circuit_breaker_config: CircuitBreakerConfig::default(),
        }
    }
}

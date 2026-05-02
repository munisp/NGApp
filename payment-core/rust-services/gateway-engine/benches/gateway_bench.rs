use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId, black_box};
use gateway_engine::{
    RateLimiter, RateLimitTier, hash_ip,
    JwtValidator, JwtValidatorConfig,
    CircuitBreaker, CircuitBreakerConfig, CircuitBreakerRegistry,
    GatewayPipeline, GatewayConfig,
};

fn bench_rate_limiter(c: &mut Criterion) {
    let mut group = c.benchmark_group("rate_limiter");

    let limiter = RateLimiter::new(RateLimitTier::ENTERPRISE);
    let ip = hash_ip(b"192.168.1.1");

    group.bench_function("single_check", |b| {
        b.iter(|| limiter.check_ip(black_box(ip)))
    });

    // Bench with different tiers
    for tier in &[RateLimitTier::BASIC, RateLimitTier::STANDARD, RateLimitTier::ENTERPRISE] {
        let limiter = RateLimiter::new(*tier);
        group.bench_with_input(
            BenchmarkId::new("check_tier", format!("{:?}", tier)),
            tier,
            |b, _| b.iter(|| limiter.check_ip(black_box(ip))),
        );
    }

    // Bench with many different IPs (cache pressure)
    group.bench_function("varied_ips_1000", |b| {
        let ips: Vec<u64> = (0..1000).map(|i| hash_ip(format!("10.0.{}.{}", i / 256, i % 256).as_bytes())).collect();
        let mut idx = 0;
        b.iter(|| {
            let result = limiter.check_ip(black_box(ips[idx % 1000]));
            idx += 1;
            result
        })
    });

    group.finish();
}

fn bench_circuit_breaker(c: &mut Criterion) {
    let mut group = c.benchmark_group("circuit_breaker");

    let config = CircuitBreakerConfig::default();
    let cb = CircuitBreaker::new(config.clone());

    group.bench_function("can_execute_closed", |b| {
        b.iter(|| cb.can_execute())
    });

    group.bench_function("record_success", |b| {
        b.iter(|| cb.record_success())
    });

    // Registry lookup
    let registry = CircuitBreakerRegistry::new(config);
    registry.get_or_create("payment-service");

    group.bench_function("registry_lookup_existing", |b| {
        b.iter(|| registry.get_or_create(black_box("payment-service")))
    });

    group.bench_function("registry_lookup_new", |b| {
        let mut i = 0u64;
        b.iter(|| {
            i += 1;
            registry.get_or_create(black_box(&format!("svc-{}", i % 100)))
        })
    });

    group.finish();
}

fn bench_jwt_validator(c: &mut Criterion) {
    let mut group = c.benchmark_group("jwt_validator");

    let config = JwtValidatorConfig::default();
    let validator = JwtValidator::new(config);

    // Bench token validation (will fail with invalid token, but measures parsing speed)
    let sample_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

    group.bench_function("validate_token", |b| {
        b.iter(|| validator.validate(black_box(sample_token)))
    });

    group.finish();
}

fn bench_full_pipeline(c: &mut Criterion) {
    let mut group = c.benchmark_group("gateway_pipeline");

    let config = GatewayConfig::default();
    let pipeline = GatewayPipeline::new(config);
    let ip_hash = hash_ip(b"192.168.1.100");
    let token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.abc123";

    group.bench_function("full_request_processing", |b| {
        b.iter(|| {
            pipeline.process_request(
                black_box(ip_hash),
                black_box(Some(12345)),
                black_box(&RateLimitTier::STANDARD),
                black_box(token),
                black_box("payment-service"),
            )
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_rate_limiter,
    bench_circuit_breaker,
    bench_jwt_validator,
    bench_full_pipeline,
);
criterion_main!(benches);

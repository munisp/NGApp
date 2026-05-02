use criterion::{criterion_group, criterion_main, Criterion};
use gateway_engine::{RateLimiter, RateLimitTier, hash_ip};

fn bench_rate_limiter(c: &mut Criterion) {
    let limiter = RateLimiter::new(RateLimitTier::ENTERPRISE);
    let ip = hash_ip(b"192.168.1.1");
    c.bench_function("rate_limit_check", |b| {
        b.iter(|| limiter.check_ip(ip))
    });
}

criterion_group!(benches, bench_rate_limiter);
criterion_main!(benches);

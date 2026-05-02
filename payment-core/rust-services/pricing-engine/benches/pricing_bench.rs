use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId, black_box};
use pricing_engine::{
    FeeCalculator, FeeTier, FeeConfig,
    FxCache, CurrencyPair,
    SpreadEngine, SpreadConfig,
};

fn bench_fee_calculation(c: &mut Criterion) {
    let mut group = c.benchmark_group("fee_calculator");

    let calc = FeeCalculator::new();

    // Standard fee calculation
    group.bench_function("calculate_standard", |b| {
        b.iter(|| calc.calculate(black_box(10_000_000), black_box(0), black_box(FeeTier::Standard)))
    });

    // Different amounts
    for amount in &[100_00u64, 1_000_00, 10_000_00, 100_000_00, 1_000_000_00] {
        group.bench_with_input(
            BenchmarkId::new("amount", amount),
            amount,
            |b, &amt| b.iter(|| calc.calculate(black_box(amt), black_box(0), black_box(FeeTier::Standard))),
        );
    }

    // Different tiers
    for tier in &[FeeTier::Basic, FeeTier::Standard, FeeTier::Premium, FeeTier::Enterprise] {
        group.bench_with_input(
            BenchmarkId::new("tier", format!("{:?}", tier)),
            tier,
            |b, tier| b.iter(|| calc.calculate(black_box(50_000_00), black_box(0), black_box(*tier))),
        );
    }

    group.finish();
}

fn bench_fx_cache(c: &mut Criterion) {
    let mut group = c.benchmark_group("fx_cache");

    let cache = FxCache::new();
    // Pre-populate cache
    let pairs = vec![
        CurrencyPair::new("NGN", "USD"),
        CurrencyPair::new("NGN", "GBP"),
        CurrencyPair::new("NGN", "EUR"),
        CurrencyPair::new("USD", "GBP"),
        CurrencyPair::new("USD", "EUR"),
    ];
    for pair in &pairs {
        cache.update_rate(pair.clone(), 1_500_000); // Fixed-point rate
    }

    // Lookup existing pair
    group.bench_function("lookup_existing", |b| {
        b.iter(|| cache.get_rate(black_box(&pairs[0])))
    });

    // Lookup non-existing pair
    let missing = CurrencyPair::new("JPY", "CHF");
    group.bench_function("lookup_missing", |b| {
        b.iter(|| cache.get_rate(black_box(&missing)))
    });

    // Update rate (write path)
    group.bench_function("update_rate", |b| {
        let pair = CurrencyPair::new("NGN", "USD");
        let mut rate = 1_500_000u64;
        b.iter(|| {
            rate += 1;
            cache.update_rate(black_box(pair.clone()), black_box(rate))
        })
    });

    // Concurrent read pattern (simulated)
    group.bench_function("burst_reads_100", |b| {
        b.iter(|| {
            for i in 0..100 {
                cache.get_rate(black_box(&pairs[i % pairs.len()]));
            }
        })
    });

    group.finish();
}

fn bench_spread_engine(c: &mut Criterion) {
    let mut group = c.benchmark_group("spread_engine");

    let config = SpreadConfig::default();
    let engine = SpreadEngine::new(config);

    group.bench_function("calculate_spread", |b| {
        b.iter(|| engine.calculate_spread(
            black_box(1_500_000),  // mid rate
            black_box(50_000_00),  // amount
            black_box(0.02),       // volatility
        ))
    });

    // Full quote generation
    group.bench_function("generate_quote", |b| {
        b.iter(|| engine.generate_quote(
            black_box("NGN"),
            black_box("USD"),
            black_box(1_000_000_00), // 1M NGN
            black_box(1_500_000),     // rate
        ))
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_fee_calculation,
    bench_fx_cache,
    bench_spread_engine,
);
criterion_main!(benches);

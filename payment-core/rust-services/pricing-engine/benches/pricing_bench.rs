use criterion::{criterion_group, criterion_main, Criterion};
use pricing_engine::{FeeCalculator, FeeTier};

fn bench_fee_calculation(c: &mut Criterion) {
    let calc = FeeCalculator::new();
    c.bench_function("fee_calculate", |b| {
        b.iter(|| calc.calculate(10_000_000, 0, FeeTier::Standard))
    });
}

criterion_group!(benches, bench_fee_calculation);
criterion_main!(benches);

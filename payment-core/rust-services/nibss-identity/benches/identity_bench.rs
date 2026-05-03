use criterion::{criterion_group, criterion_main, Criterion};
use nibss_identity::*;

fn bench_bvn_lookup(c: &mut Criterion) {
    let service = IdentityService::new();
    c.bench_function("bvn_lookup_hit", |b| {
        b.iter(|| service.verify(IdentityType::BVN, "22345678901"))
    });
    c.bench_function("bvn_lookup_miss", |b| {
        b.iter(|| service.verify(IdentityType::BVN, "99999999999"))
    });
}

fn bench_name_enquiry(c: &mut Criterion) {
    let service = NameEnquiryService::new();
    c.bench_function("name_enquiry_hit", |b| {
        b.iter(|| service.enquire("0044100001", "044"))
    });
}

fn bench_tsq(c: &mut Criterion) {
    let service = TSQService::new();
    c.bench_function("tsq_lookup", |b| {
        b.iter(|| service.query("NIP-D-001"))
    });
}

criterion_group!(benches, bench_bvn_lookup, bench_name_enquiry, bench_tsq);
criterion_main!(benches);

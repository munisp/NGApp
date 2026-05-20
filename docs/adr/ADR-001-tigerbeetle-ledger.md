# Adr 001 Tigerbeetle Ledger

**Status:** Accepted
**Date:** 2024-06-15

## Context

The 54Link POS Shell platform requires double-entry ledger for financial transactions to support agent banking operations across Nigeria and West Africa.

## Decision

We will use TigerBeetle as a core component of our infrastructure because it provides the reliability, performance, and scalability requirements for our fintech platform.

## Consequences

### Positive

- Production-grade TigerBeetle integration ensures reliability
- Reduced development time through proven infrastructure
- Better observability and monitoring capabilities

### Negative

- Additional operational complexity
- Team needs training on TigerBeetle
- Vendor lock-in considerations

### Risks

- TigerBeetle service availability dependency
- Migration complexity if we need to switch later

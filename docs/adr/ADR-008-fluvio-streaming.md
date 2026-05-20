# Adr 008 Fluvio Streaming

**Status:** Accepted
**Date:** 2024-06-15

## Context

The 54Link POS Shell platform requires real-time event streaming for telemetry to support agent banking operations across Nigeria and West Africa.

## Decision

We will use Fluvio as a core component of our infrastructure because it provides the reliability, performance, and scalability requirements for our fintech platform.

## Consequences

### Positive

- Production-grade Fluvio integration ensures reliability
- Reduced development time through proven infrastructure
- Better observability and monitoring capabilities

### Negative

- Additional operational complexity
- Team needs training on Fluvio
- Vendor lock-in considerations

### Risks

- Fluvio service availability dependency
- Migration complexity if we need to switch later

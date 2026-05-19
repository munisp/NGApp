# Adr 002 Temporal Workflows

**Status:** Accepted
**Date:** 2024-06-15

## Context

The 54Link POS Shell platform requires workflow orchestration for long-running processes to support agent banking operations across Nigeria and West Africa.

## Decision

We will use Temporal as a core component of our infrastructure because it provides the reliability, performance, and scalability requirements for our fintech platform.

## Consequences

### Positive
- Production-grade Temporal integration ensures reliability
- Reduced development time through proven infrastructure
- Better observability and monitoring capabilities

### Negative
- Additional operational complexity
- Team needs training on Temporal
- Vendor lock-in considerations

### Risks
- Temporal service availability dependency
- Migration complexity if we need to switch later

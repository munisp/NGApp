# Adr 009 Mojaloop Interop

**Status:** Accepted
**Date:** 2024-06-15

## Context

The 54Link POS Shell platform requires interoperability layer for mobile money to support agent banking operations across Nigeria and West Africa.

## Decision

We will use Mojaloop as a core component of our infrastructure because it provides the reliability, performance, and scalability requirements for our fintech platform.

## Consequences

### Positive

- Production-grade Mojaloop integration ensures reliability
- Reduced development time through proven infrastructure
- Better observability and monitoring capabilities

### Negative

- Additional operational complexity
- Team needs training on Mojaloop
- Vendor lock-in considerations

### Risks

- Mojaloop service availability dependency
- Migration complexity if we need to switch later

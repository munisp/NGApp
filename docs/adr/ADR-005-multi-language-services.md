# Adr 005 Multi Language Services

**Status:** Accepted
**Date:** 2024-06-15

## Context

The 54Link POS Shell platform requires multi-language microservice architecture (go, rust, python, typescript) to support agent banking operations across Nigeria and West Africa.

## Decision

We will use Polyglot as a core component of our infrastructure because it provides the reliability, performance, and scalability requirements for our fintech platform.

## Consequences

### Positive

- Production-grade Polyglot integration ensures reliability
- Reduced development time through proven infrastructure
- Better observability and monitoring capabilities

### Negative

- Additional operational complexity
- Team needs training on Polyglot
- Vendor lock-in considerations

### Risks

- Polyglot service availability dependency
- Migration complexity if we need to switch later

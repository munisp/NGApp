# Adr 003 Permify Rbac

**Status:** Accepted
**Date:** 2024-06-15

## Context

The 54Link POS Shell platform requires fine-grained rbac and pbac authorization to support agent banking operations across Nigeria and West Africa.

## Decision

We will use Permify as a core component of our infrastructure because it provides the reliability, performance, and scalability requirements for our fintech platform.

## Consequences

### Positive
- Production-grade Permify integration ensures reliability
- Reduced development time through proven infrastructure
- Better observability and monitoring capabilities

### Negative
- Additional operational complexity
- Team needs training on Permify
- Vendor lock-in considerations

### Risks
- Permify service availability dependency
- Migration complexity if we need to switch later

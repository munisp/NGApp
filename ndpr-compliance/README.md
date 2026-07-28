# NDPR Compliance Module

Nigeria Data Protection Regulation (NDPR) compliance service for the Unified Insurance Platform.

## Architecture

```
ndpr-compliance/
├── cmd/        # Main entry points (server, worker, cli)
├── internal/   # Internal packages (handlers, middleware, services)
├── k8s/        # Kubernetes deployment manifests
└── pkg/        # Shared packages (models, utils, validators)
```

## Features

- **Data Subject Rights**: Access, erasure, portability, rectification, restriction
- **Consent Management**: Granular consent tracking with audit trail
- **Data Breach Notification**: 72-hour NDPR breach notification workflow
- **Data Retention**: Automated retention policy enforcement
- **PII Detection**: Automated PII scanning and masking
- **DPIA**: Data Protection Impact Assessment templates

## Integration Points

- **GDPR Service**: `services/gdpr-compliance/` (shared compliance logic)
- **tRPC Router**: `compliance` router in `customer-portal-full/server/routers.ts`
- **K8s Service**: Port 8107 (gdpr-compliance service covers both GDPR & NDPR)

## Regulatory References

- NDPR 2019 (Nigeria Data Protection Regulation)
- NDPR Implementation Framework 2020
- NITDA Guidelines on Data Protection

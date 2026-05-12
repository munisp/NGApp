# Changelog

All notable changes to 54Bank Platform are documented here.

## [2.5.0] - 2026-05-12

### Added
- MFA/TOTP authentication (RFC 6238) with backup codes
- API key management (generate, rotate, revoke)
- Password complexity policy (uppercase, lowercase, digit, special char)
- CORS origin whitelist (environment-specific)
- 51 behavioral tests (core banking, payments, lending, KYC/AML, security, agriculture)
- Terraform IaC for AWS (EKS, RDS, ElastiCache)
- Kubernetes network policies
- Log aggregation config (Loki + Promtail + Prometheus)
- Security scanning in CI pipeline
- CD pipeline (deploy-staging on merge to main)
- SECURITY.md, CONTRIBUTING.md
- Expanded DATA_DICTIONARY.md (15+ key tables)

### Changed
- Auth module: brute force protection (5 attempts → 15-min lockout)
- Auth module: token blacklisting on logout
- 20 services upgraded with real SQL queries (Go, Rust, Python)
- Kafka + Redis middleware with real connection initialization
- Vitest coverage config (v8 provider)

### Fixed
- core-banking-go: removed lib/pq external dependency
- 5 Rust Cargo.toml: consolidated duplicate [dependencies]
- 45 Python services: added missing requirements.txt
- CI workflow: corrected job dependency references

## [2.0.0] - 2026-05-11

### Added
- 267 Drizzle tables with Postgres seeding (2,142 rows)
- 501 CrudWorkspace pages wired to /api/db/ endpoints
- JWT authentication with 8 RBAC roles
- 7 OWASP security headers
- Input validation with Nigerian-specific validators
- Secrets management (AES-256-GCM)
- Helm charts (deployment, HPA, external-secrets)
- DB backup/restore scripts
- README.md, ARCHITECTURE.md, DATA_DICTIONARY.md, RUNBOOK.md

## [1.0.0] - 2026-05-09

### Added
- Initial 425 microservices (180 Go, 139 Rust, 106 Python)
- 554 PWA pages, 555 Flutter screens
- 14 middleware integration (Kafka, Redis, Keycloak, etc.)
- 7-check CI pipeline
- Docker build for all services

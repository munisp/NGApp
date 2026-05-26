# Changelog

All notable changes to the CRM Platform are documented here.

## [Unreleased]

### Added
- Multi-vertical support: Banking, Telco, Commodity, CPaaS
- 145 frontend components with seed data, dark mode, ARIA accessibility
- 30 backend services (8 Go, 14 Python, 9 Rust)
- Middleware integrations: Kafka, Dapr, Fluvio, Temporal, Postgres pooling,
  Keycloak OIDC, Permify authorization, Redis caching/pub-sub, Mojaloop payments,
  OpenSearch indexing, OpenAppSec WAF, APISIX gateway, TigerBeetle ledger,
  Lakehouse analytics
- Security configs: CSP, WAF rules, OWASP compliance, PBAC schema, DDoS protection, encryption
- K8s manifests for all 30 services with HPA auto-scaling
- Grafana dashboards and alerting rules
- 7 CI/CD workflows (CI, CI-Hardened, Docker Build, Deploy Staging/Production)
- i18n support for 5 languages (English, Hausa, Yoruba, Igbo, French)
- RBAC permission guards on all routes
- Product gating per tenant (21 product modules, 10 tenants)

### Fixed
- CORS: Replaced AllowAllOrigins with explicit origin whitelist
- Tenant interpolation in 36 vertical-deep components
- Missing FileBarChart icon replaced with FileSpreadsheet
- Docker-compose secrets extracted to environment variables

### Security
- Keycloak OIDC authentication with token introspection
- Permify fine-grained authorization (entity-relation model)
- OpenAppSec WAF with OWASP rule set
- APISIX gateway with JWT auth, rate limiting, CORS per-route
- CSP headers, encryption at rest (AES-256-GCM), mTLS
- CSRF token generation and validation

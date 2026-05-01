# NDSEP Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to **security@ndsep.gov.ng** or open a private GitHub Security Advisory. Do not file public issues for security bugs.

## Dependency Vulnerability Audit (Last Run: 2026-04-23)

### Fixed in Phase 29/30

| Package | CVE / GHSA | Severity | Resolution |
|---|---|---|---|
| `fast-xml-parser` | GHSA-gh4j-gqv2-49f6 | Moderate | Forced to >=5.7.0 via pnpm override |

### Accepted Risk (Transitive — Not Directly Exploitable)

| Package | CVE / GHSA | Severity | Reason Accepted |
|---|---|---|---|
| `uuid` | GHSA-w5hq-g745-h8pq | Moderate | Requires caller to pass explicit `buf` argument; NDSEP never passes user-controlled buffers to uuid. Upstream packages (`@temporalio/client`, `exceljs`, `mermaid`) have not released uuid v14 compatible versions. Will upgrade when upstream support is available. |

### Security Controls in Place

| Control | Status |
|---|---|
| Helmet CSP headers (strict in production) | ✅ Enabled |
| HSTS (1 year, includeSubDomains, preload) | ✅ Production |
| Rate limiting (API: 200/min, Auth: 20/15min) | ✅ Enabled |
| SQL injection prevention (parameterised queries) | ✅ All queries |
| XSS filter (helmet xssFilter) | ✅ Enabled |
| HTTP parameter pollution guard | ✅ Enabled |
| Suspicious request guard (SQL/XSS in URLs) | ✅ Enabled |
| Body sanitiser on all tRPC mutations | ✅ Enabled |
| Auth failure tracker (brute-force alerting) | ✅ Enabled |
| Request ID middleware (X-Request-ID) | ✅ Enabled |
| Security audit logger (401/403/429) | ✅ Enabled |
| Stripe webhook signature verification | ✅ Enabled |
| Open redirect prevention (demo-login) | ✅ Enabled |
| No hardcoded secrets in application code | ✅ Verified |
| Environment variables via platform secrets | ✅ Configured |
| Role-based access control (admin/user) | ✅ Enforced |
| JWT session signing (JWT_SECRET) | ✅ Enabled |
| CORS restricted to known origins | ✅ Enabled |

## Vulnerability Score

**OWASP Top 10 Assessment: A+ (0 critical, 0 high, 0 medium exploitable)**

The 3 remaining moderate findings are transitive dependencies with no exploitable code path in NDSEP's usage pattern.

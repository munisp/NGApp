# UAE Post-Quantum Cryptography Roadmap
## OG RMM Platform — Cryptographic Inventory and Migration Plan

**Document Reference:** OG-RMM-PQC-001  
**Version:** 1.0  
**Date:** March 2026  
**Classification:** Confidential  
**Applicable Standards:** UAE Cybersecurity Council PQC Directive (2025), NIST FIPS 203/204/205, ETSI TR 103 619  
**Prepared by:** Manus AI — Security Architecture

---

## 1. Executive Summary

The UAE Cybersecurity Council issued a Post-Quantum Cryptography (PQC) preparedness directive in 2025, requiring all critical infrastructure operators — including oil and gas SCADA systems — to complete a cryptographic inventory and submit a migration roadmap by Q4 2026. This document fulfils that requirement for the OG RMM Platform, cataloguing all cryptographic primitives in use, assessing quantum vulnerability, and providing a phased migration plan to NIST-standardised post-quantum algorithms (FIPS 203 ML-KEM, FIPS 204 ML-DSA, FIPS 205 SLH-DSA).

The platform's current cryptographic posture is **Amber** — all classical algorithms in use are quantum-vulnerable over a 10–15 year horizon, but no immediate threat exists. The migration plan targets **Green** status by Q2 2028 through a hybrid classical/PQC approach that maintains backward compatibility throughout the transition.

---

## 2. Cryptographic Inventory

### 2.1 Transport Layer Cryptography

| Component | Protocol | Algorithm | Key Size | Quantum Vulnerability | Migration Priority |
|---|---|---|---|---|---|
| API Gateway ↔ Frontend | TLS 1.3 | X25519 + AES-256-GCM | 256-bit | High (ECDH) | P1 — Hybrid X25519Kyber768 |
| Edge Agent ↔ Stream Processor | mTLS 1.3 | X25519 + AES-256-GCM | 256-bit | High (ECDH) | P1 — Hybrid X25519Kyber768 |
| API Gateway ↔ Microservices | TLS 1.3 | X25519 + AES-256-GCM | 256-bit | High (ECDH) | P2 — Internal migration |
| Redpanda inter-broker | TLS 1.3 | X25519 + AES-256-GCM | 256-bit | High (ECDH) | P2 |
| PostgreSQL client ↔ server | TLS 1.3 | X25519 + AES-256-GCM | 256-bit | High (ECDH) | P2 |
| MQTT (Mosquitto) | TLS 1.3 | X25519 + AES-256-GCM | 256-bit | High (ECDH) | P1 — Field device exposure |

### 2.2 Authentication and Digital Signatures

| Component | Algorithm | Key Size | Quantum Vulnerability | Migration Priority |
|---|---|---|---|---|
| JWT tokens (API Gateway) | HMAC-SHA256 | 256-bit | Low (symmetric) | P3 — Increase to SHA-512 |
| JWT tokens (refresh) | RSA-4096 | 4096-bit | High (RSA) | P1 — Migrate to ML-DSA-65 |
| Keycloak SAML assertions | RSA-2048 | 2048-bit | High (RSA) | P1 — Migrate to ML-DSA-44 |
| Temporal workflow signatures | ECDSA P-256 | 256-bit | High (ECDSA) | P1 — Migrate to ML-DSA-44 |
| TLS certificates (CA) | RSA-4096 | 4096-bit | High (RSA) | P1 — Migrate to ML-DSA-87 |
| TLS certificates (leaf) | ECDSA P-256 | 256-bit | High (ECDSA) | P1 — Migrate to ML-DSA-44 |
| Code signing (Docker images) | ECDSA P-256 | 256-bit | High (ECDSA) | P2 — Migrate to SLH-DSA-128s |
| Git commit signatures | ECDSA P-256 | 256-bit | High (ECDSA) | P3 |

### 2.3 Data-at-Rest Encryption

| Component | Algorithm | Key Size | Quantum Vulnerability | Migration Priority |
|---|---|---|---|---|
| PostgreSQL tablespace encryption | AES-256-CBC | 256-bit | Low (symmetric) | P3 — Migrate to AES-256-GCM |
| MinIO/S3 server-side encryption | AES-256-GCM | 256-bit | Low (symmetric) | None required |
| Redis AOF encryption | AES-256-GCM | 256-bit | Low (symmetric) | None required |
| InfluxDB data files | AES-256-GCM | 256-bit | Low (symmetric) | None required |
| Kubernetes Secrets (etcd) | AES-256-GCM | 256-bit | Low (symmetric) | None required |
| Key Management (Vault) | AES-256-GCM + RSA-4096 | 256/4096-bit | High (RSA wrapping) | P1 — Migrate to ML-KEM-768 |

### 2.4 Key Exchange / Key Encapsulation

| Component | Algorithm | Quantum Vulnerability | Migration Target |
|---|---|---|---|
| TLS key exchange | X25519 ECDH | High | ML-KEM-768 (FIPS 203) hybrid |
| Vault key wrapping | RSA-OAEP-4096 | High | ML-KEM-1024 (FIPS 203) |
| MQTT session keys | X25519 ECDH | High | ML-KEM-768 hybrid |
| Keycloak token encryption | RSA-OAEP-2048 | High | ML-KEM-768 |

---

## 3. Risk Assessment

### 3.1 Harvest-Now-Decrypt-Later (HNDL) Risk

The most immediate quantum threat to the OG RMM Platform is the HNDL attack vector, where adversaries record encrypted OT traffic today with the intention of decrypting it once cryptographically relevant quantum computers (CRQCs) become available. Given that:

- NIST estimates CRQCs capable of breaking RSA-2048 and ECDH-256 will emerge between 2030 and 2035.
- The OG RMM Platform handles production data, financial transactions, and safety system configurations with a 10–30 year operational lifespan.
- Kuwait and UAE are geopolitically significant energy producers with state-level adversary interest.

The HNDL risk is classified as **High** for financial ledger data and **Medium** for operational telemetry.

### 3.2 Algorithm Vulnerability Timeline

| Algorithm | Classical Security | Quantum Security | Estimated Break Year |
|---|---|---|---|
| RSA-2048 | 112-bit | 0-bit (Shor's) | 2030–2035 |
| RSA-4096 | 140-bit | 0-bit (Shor's) | 2033–2038 |
| ECDSA P-256 | 128-bit | 0-bit (Shor's) | 2030–2035 |
| X25519 ECDH | 128-bit | 0-bit (Shor's) | 2030–2035 |
| AES-256-GCM | 256-bit | 128-bit (Grover's) | Never (sufficient) |
| HMAC-SHA256 | 256-bit | 128-bit (Grover's) | Never (sufficient) |
| SHA-256 | 256-bit | 128-bit (Grover's) | Never (sufficient) |

---

## 4. Migration Plan

### Phase 1: Hybrid PQC Deployment (Q3 2026 – Q1 2027)

The hybrid approach deploys PQC algorithms alongside classical algorithms, ensuring backward compatibility with all existing clients while providing quantum resistance for new connections.

**P1 Actions:**

| Action | Algorithm | Component | Effort | Owner |
|---|---|---|---|---|
| Deploy hybrid TLS (X25519Kyber768) on API Gateway | ML-KEM-768 + X25519 | Go API Gateway | 3 weeks | Security Eng. |
| Deploy hybrid TLS on edge agent mTLS | ML-KEM-768 + X25519 | Rust Edge Agent | 2 weeks | Security Eng. |
| Migrate JWT refresh tokens to ML-DSA-65 | ML-DSA-65 (FIPS 204) | Go API Gateway | 2 weeks | Security Eng. |
| Migrate Keycloak SAML to ML-DSA-44 | ML-DSA-44 (FIPS 204) | Keycloak | 1 week | IAM Eng. |
| Migrate Vault key wrapping to ML-KEM-1024 | ML-KEM-1024 (FIPS 203) | HashiCorp Vault | 2 weeks | Infra Eng. |
| Migrate TLS certificates to ML-DSA-87 | ML-DSA-87 (FIPS 204) | PKI / cert-manager | 4 weeks | Infra Eng. |

### Phase 2: Internal Service Migration (Q2 2027 – Q4 2027)

**P2 Actions:**

| Action | Algorithm | Component | Effort |
|---|---|---|---|
| Migrate inter-service TLS to hybrid PQC | ML-KEM-768 + X25519 | All Go/Rust services | 4 weeks |
| Migrate Redpanda broker TLS | ML-KEM-768 + X25519 | Redpanda | 1 week |
| Migrate PostgreSQL client TLS | ML-KEM-768 + X25519 | All DB clients | 2 weeks |
| Migrate Docker image signing to SLH-DSA | SLH-DSA-128s (FIPS 205) | CI/CD pipeline | 2 weeks |

### Phase 3: Legacy Removal and Full PQC (Q1 2028 – Q2 2028)

**P3 Actions:**

| Action | Component | Effort |
|---|---|---|
| Remove classical fallback from hybrid TLS | API Gateway, Edge Agent | 1 week |
| Upgrade JWT HMAC-SHA256 to HMAC-SHA512 | API Gateway | 1 week |
| Migrate Git commit signing to SLH-DSA | Developer workstations | 2 weeks |
| Final cryptographic audit and UAE Cybersecurity Council submission | All | 3 weeks |

---

## 5. NIST PQC Algorithm Reference

| NIST Standard | Algorithm | Type | Security Level | Use Case |
|---|---|---|---|---|
| FIPS 203 | ML-KEM (Kyber) | Key Encapsulation | 128/192/256-bit | Key exchange, TLS |
| FIPS 204 | ML-DSA (Dilithium) | Digital Signature | 128/192/256-bit | Authentication, JWT, TLS certs |
| FIPS 205 | SLH-DSA (SPHINCS+) | Digital Signature | 128/192/256-bit | Code signing, long-lived certs |

---

## 6. UAE Cybersecurity Council Submission Checklist

| Requirement | Status | Evidence |
|---|---|---|
| Cryptographic inventory complete | Complete | Section 2 of this document |
| Quantum vulnerability assessment | Complete | Section 3 of this document |
| Migration roadmap with timeline | Complete | Section 4 of this document |
| NIST FIPS 203/204/205 adoption plan | Complete | Section 4, Phase 1–3 |
| Hybrid PQC deployment timeline | Q3 2026 | Phase 1 plan |
| Full PQC deployment timeline | Q2 2028 | Phase 3 plan |
| Responsible officer signature | Pending | CISO sign-off required |

---

*This document must be reviewed by the CISO and submitted to the UAE Cybersecurity Council by Q4 2026 as required by the PQC Preparedness Directive.*

# 54Bank Platform Architecture

## System Overview

54Bank follows a microservices architecture with a unified frontend gateway pattern.

### Request Flow

```
Client → APISIX Gateway → Express Server → Microservice (Go/Rust/Python)
                ↓                  ↓                    ↓
           Rate Limit        JWT Verify           Postgres DB
           WAF Check         RBAC Check           Kafka Event
           Auth Plugin       Audit Log            Redis Cache
```

### Data Flow

```
User Action → Express API → Drizzle ORM → PostgreSQL
                   ↓              ↓
              Kafka Event    TigerBeetle Ledger
                   ↓              ↓
            OpenSearch Index  Lakehouse (Iceberg)
```

## Service Architecture

### Express Gateway (Port 3000)
The main Express server acts as an API gateway and serves the React SPA. It handles:
- Static file serving (React PWA build)
- 259 Drizzle-backed CRUD route sets (1,554 endpoints)
- 415 proxy routes to microservices
- JWT authentication and RBAC
- Input validation (Zod schemas)
- OWASP security headers
- Rate limiting and brute force protection

### Microservices (Ports 8080-8700+)
426 microservices organized by language:
- **Go (180)**: Core banking, payments, agent banking, agriculture
- **Rust (139)**: AML engine, fraud detection, performance-critical paths
- **Python (106)**: Analytics, ML models, compliance reporting

Each service:
- Connects to PostgreSQL directly
- Publishes events to Kafka
- Caches hot data in Redis
- Registers Temporal workflows
- Exposes /healthz endpoint

### Database Layer
- **PostgreSQL**: 267 tables, primary OLTP database
- **TigerBeetle**: Double-entry financial ledger for transfers
- **Redis**: Session cache, rate limiting, OTP storage
- **OpenSearch**: Full-text search, audit log indexing

## Security Architecture

### Authentication Flow
```
Login Request → Express /api/auth/login
     → Verify credentials against DB
     → Generate JWT (access + refresh tokens)
     → Set HttpOnly secure cookies
     → Return user profile + role
```

### RBAC Roles
| Role | Permissions |
|------|------------|
| admin | Full platform access |
| operations | Transaction management, operations |
| compliance | AML, KYC, regulatory reports |
| treasury | FX, money market, investments |
| branch | Branch-level operations |
| teller | Counter transactions only |

### Security Layers
1. **Network**: APISIX rate limiting, DDoS protection
2. **Application**: OWASP headers, CSP, HSTS, X-Frame-Options
3. **Authentication**: JWT with short-lived tokens, refresh rotation
4. **Authorization**: Role-based + policy-based (Permify)
5. **Data**: AES-256-GCM encryption at rest, TLS in transit
6. **Compliance**: NDPR data protection, PCI-DSS card handling

## Deployment Architecture

### Production
```
                    ┌─── Load Balancer (Nginx/HAProxy)
                    │
                    ├─── APISIX Gateway Cluster (3 nodes)
                    │
                    ├─── Express App Cluster (2-10 pods, HPA)
                    │
                    ├─── Microservice Pods (per-service scaling)
                    │
                    ├─── PostgreSQL (Primary + 2 Replicas)
                    │
                    ├─── Redis Sentinel (3 nodes)
                    │
                    ├─── Kafka Cluster (3 brokers)
                    │
                    └─── TigerBeetle Cluster (3 replicas)
```

## Monitoring

- **Health**: /api/health, /api/ready, /api/live
- **Metrics**: Prometheus endpoint at /api/metrics/prometheus
- **Logging**: Structured JSON logs with correlation IDs
- **Tracing**: OpenTelemetry distributed tracing
- **Alerting**: Prometheus AlertManager rules

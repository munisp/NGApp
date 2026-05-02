# Unified Payment Switch Platform Architecture

## Overview

The Unified Payment Switch Platform integrates two complementary systems into a cohesive microservices architecture:

1. **Web-Checkout Portal** (Node.js/TypeScript) - Participant onboarding, management, and monitoring
2. **NEXTGEN Payment Core** (Go/Python) - High-performance payment processing, fraud detection, and analytics

## System Components

### Frontend Layer
- **Web Portal** (React 19 + TypeScript)
  - Participant onboarding workflow
  - Admin dashboard
  - Real-time monitoring
  - API key management
  - Webhook configuration
  - Rate alerts & remittance tracking

### API Gateway (Nginx)
- **Request Routing**
  - `/api/onboarding/*` → Web-Checkout Portal
  - `/api/payment/*` → Go Ledger Service
  - `/api/fraud/*` → Python Fraud Detection
  - `/api/analytics/*` → Python Data Pipelines
- **SSL/TLS Termination**
- **Rate Limiting**
- **CORS Configuration**
- **Load Balancing**

### Application Services

#### Web-Checkout Portal (Node.js/Express/tRPC)
**Port:** 3000  
**Database:** MySQL  
**Cache:** Redis  

**Responsibilities:**
- Participant registration and KYC
- Technical onboarding (API credentials, webhooks, sandbox)
- Testing and certification
- Production go-live approval
- Admin dashboard and monitoring
- User authentication (OAuth + 2FA)
- Notification management
- Rate alerts
- Remittance tracking

**Key Features:**
- 54 database tables
- 17 tRPC routers
- Complete 2FA system with TOTP, backup codes, trusted devices
- Account recovery (email, SMS, admin approval)
- Webhook management with retry logic
- API key management with usage tracking
- Email/SMS notifications (SendGrid, Resend, Twilio)
- Real-time rate alerts
- Export functionality (CSV, Excel, PDF)

#### Go Ledger Service
**Port:** 8080  
**Database:** TigerBeetle (high-performance financial ledger)  

**Responsibilities:**
- Double-entry accounting
- Transaction processing
- Balance management
- Settlement operations
- Instant settlement
- Ledger integrity

**Key Features:**
- TigerBeetle integration for ACID compliance
- High-throughput transaction processing
- Real-time balance updates
- Atomic multi-party transfers

#### Python Fraud Detection Service
**Port:** 8081  
**Database:** PostgreSQL  

**Responsibilities:**
- Real-time fraud scoring
- Graph Neural Network (GNN) fraud detection
- Traditional ML models (Random Forest, XGBoost)
- Rule-based fraud detection
- Hybrid detection (GNN + ML + Rules)

**Key Features:**
- Transaction graph analysis
- Behavioral pattern detection
- Anomaly detection
- Real-time scoring API
- Model training pipelines

#### Python Data Pipeline Service
**Port:** 8082  
**Database:** PostgreSQL + Lakehouse (Iceberg/Delta)  

**Responsibilities:**
- Transaction analytics
- Data aggregation
- Reporting and insights
- ML model training
- Business intelligence

**Key Features:**
- Apache Spark for batch processing
- Ray for distributed ML training
- Kafka integration for real-time data
- Lakehouse architecture for analytics

#### POS Services
**Port:** 8083  
**Message Broker:** Fluvio  

**Responsibilities:**
- Point-of-sale transaction processing
- Workflow orchestration
- Real-time transaction verification

### Data Layer

#### MySQL Database
**Port:** 3306  
**Used By:** Web-Checkout Portal  

**Schema:**
- Users and authentication
- Participant applications
- Technical configurations
- Webhooks and API keys
- Monitoring and alerts
- Audit logs

#### TigerBeetle Database
**Port:** 3001  
**Used By:** Go Ledger Service  

**Purpose:**
- Financial ledger (accounts, transfers)
- ACID-compliant transaction processing
- High-performance balance tracking

#### PostgreSQL Database
**Port:** 5432  
**Used By:** Fraud Detection, Data Pipelines  

**Schema:**
- Transaction history
- Fraud scores and alerts
- Analytics aggregations
- ML model metadata

#### Redis Cache
**Port:** 6379  
**Used By:** All services  

**Purpose:**
- Session management
- Rate limiting
- Caching frequently accessed data
- Real-time rate alerts

### Message Broker

#### Apache Kafka
**Port:** 9092  
**Used By:** All services  

**Topics:**
- `payment.transactions` - Transaction events
- `fraud.alerts` - Fraud detection alerts
- `ledger.updates` - Balance updates
- `webhook.events` - Webhook deliveries
- `analytics.events` - Analytics data

#### Fluvio
**Port:** 9003  
**Used By:** POS Services  

**Purpose:**
- Real-time POS transaction streaming
- Low-latency event processing

### Monitoring & Observability

#### Prometheus
**Port:** 9090  

**Metrics:**
- Service health and uptime
- Request rates and latency
- Error rates
- Database performance
- Cache hit rates

#### Grafana
**Port:** 3001  

**Dashboards:**
- System overview
- Transaction monitoring
- Fraud detection metrics
- Service performance
- Business KPIs

### External Integrations

#### Payment Providers
- **NIBSS** - Nigerian Interbank Settlement System
- **Coinbase Commerce** - Cryptocurrency payments
- **Circle** - USDC stablecoin

#### Identity Verification
- **Smile Identity** - KYC and identity verification

#### Communication
- **SendGrid** - Transactional emails
- **Resend** - Alternative email service
- **Twilio** - SMS notifications

## Data Flow

### Participant Onboarding Flow
```
User → Web Portal → MySQL
  ↓
Smile Identity (KYC)
  ↓
Admin Approval → MySQL
  ↓
API Credentials Generated
  ↓
Sandbox Environment Provisioned
```

### Payment Processing Flow
```
Merchant API Request → API Gateway
  ↓
Authentication Check (Web Portal)
  ↓
Fraud Detection (Python Service)
  ↓
Payment Processing (Go Ledger)
  ↓
TigerBeetle Transaction
  ↓
Webhook Delivery (Web Portal)
  ↓
Analytics Pipeline (Kafka → Python)
```

### Fraud Detection Flow
```
Transaction Event → Kafka
  ↓
Fraud Detection Service
  ├─ GNN Model Analysis
  ├─ ML Model Scoring
  └─ Rule Engine Check
  ↓
Fraud Score → PostgreSQL
  ↓
Alert (if high risk) → Kafka → Web Portal
```

## Authentication & Authorization

### Shared JWT Authentication
- **Issuer:** Web-Checkout Portal
- **Algorithm:** RS256 (RSA signatures)
- **Token Lifetime:** 24 hours
- **Refresh Token:** 30 days

### Token Claims
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "admin|merchant|user",
  "openId": "manus_oauth_id",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Service-to-Service Authentication
- **API Keys:** Managed by Web Portal
- **Validation:** Each service validates API keys via shared Redis cache
- **Rate Limiting:** Per API key, enforced at gateway level

## Deployment Architecture

### Development Environment
```
docker-compose up
```
- All services run locally
- Shared network: `payment-switch-network`
- Persistent volumes for databases
- Hot reload for development

### Staging Environment
```
docker-compose -f docker-compose.staging.yml up
```
- Production-like configuration
- Separate databases
- SSL certificates
- Monitoring enabled

### Production Environment
```
docker-compose -f docker-compose.prod.yml up
```
- High availability configuration
- Database replication
- Load balancing
- Auto-scaling
- Comprehensive monitoring
- Automated backups

## Service Dependencies

### Startup Order
1. Databases (MySQL, PostgreSQL, TigerBeetle, Redis)
2. Message Brokers (Kafka, Fluvio)
3. Core Services (Go Ledger, Python Fraud Detection)
4. Web Portal
5. API Gateway (Nginx)
6. Monitoring (Prometheus, Grafana)

### Health Checks
All services expose `/health` endpoints:
- `GET /health` - Returns 200 OK if service is healthy
- Includes dependency checks (database, cache, message broker)

## Scalability

### Horizontal Scaling
- **Web Portal:** Multiple instances behind load balancer
- **Go Ledger:** Stateless, can scale horizontally
- **Python Services:** Can scale based on CPU/memory usage
- **Databases:** Read replicas for MySQL and PostgreSQL

### Vertical Scaling
- **TigerBeetle:** Single instance, scale vertically for performance
- **Kafka:** Add more brokers for higher throughput

## Security

### Network Security
- All services in private network
- Only API Gateway exposed publicly
- TLS 1.3 for external communication
- mTLS for service-to-service communication

### Data Security
- Encryption at rest (database level)
- Encryption in transit (TLS)
- API key hashing (SHA-256)
- Sensitive data masking in logs

### Access Control
- Role-based access control (RBAC)
- API key permissions
- IP whitelisting for admin endpoints
- Rate limiting per user/API key

## Monitoring & Alerting

### Key Metrics
- **Availability:** 99.9% uptime SLA
- **Latency:** P50, P95, P99 response times
- **Error Rate:** 4xx and 5xx errors
- **Throughput:** Requests per second
- **Fraud Detection:** False positive/negative rates

### Alerts
- Service down
- High error rate (>1%)
- High latency (P95 > 500ms)
- Database connection issues
- Fraud detection anomalies
- Webhook delivery failures

## Disaster Recovery

### Backup Strategy
- **MySQL:** Daily full backup + hourly incremental
- **PostgreSQL:** Daily full backup + WAL archiving
- **TigerBeetle:** Snapshot-based backups
- **Retention:** 30 days

### Recovery Procedures
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour
- Automated failover for databases
- Blue-green deployment for zero-downtime updates

## Performance Benchmarks

### Expected Throughput
- **Payment Processing:** 10,000 TPS
- **Fraud Detection:** 5,000 TPS
- **Web Portal API:** 1,000 RPS
- **Webhook Delivery:** 500 RPS

### Latency Targets
- **Payment Processing:** P95 < 100ms
- **Fraud Detection:** P95 < 200ms
- **Web Portal API:** P95 < 300ms
- **Database Queries:** P95 < 50ms

## Future Enhancements

### Planned Features
1. **GraphQL API** - Unified API layer
2. **WebSocket Support** - Real-time updates
3. **Mobile SDKs** - iOS and Android
4. **Advanced Analytics** - ML-powered insights
5. **Multi-currency Support** - Beyond NGN
6. **Blockchain Integration** - Cryptocurrency settlements

### Scalability Roadmap
1. **Kubernetes Migration** - Container orchestration
2. **Service Mesh** - Istio for advanced networking
3. **Event Sourcing** - CQRS pattern for audit trail
4. **Multi-region Deployment** - Global availability

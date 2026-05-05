# Customer Management Service

A production-ready microservice for comprehensive customer management in the Enterprise CRM system. Built with Go, PostgreSQL, Redis, and designed for cloud-native deployment on Kubernetes.

## 🏗️ Architecture

The Customer Management Service follows clean architecture principles with clear separation of concerns:

```
├── cmd/                    # Application entry points
├── internal/
│   ├── config/            # Configuration management
│   ├── handlers/          # HTTP handlers (REST API)
│   ├── models/            # Domain models and entities
│   ├── repository/        # Data access layer
│   └── service/           # Business logic layer
├── pkg/                   # Public packages (if any)
├── api/                   # API documentation
├── deployments/           # Deployment configurations
└── docs/                  # Additional documentation
```

## 🚀 Features

### Core Customer Management
- **Complete CRUD Operations** - Create, read, update, delete customers
- **Customer Profiles** - Detailed profile management with KYC integration
- **Multi-Address Support** - Home, work, billing, shipping addresses
- **Customer Segmentation** - Dynamic customer grouping and analytics
- **Interaction Tracking** - Complete interaction history across all channels
- **Preferences Management** - Communication and service preferences

### Advanced Capabilities
- **Search & Filtering** - Full-text search with advanced filtering options
- **Bulk Operations** - Efficient bulk create, update, delete operations
- **Event-Driven Architecture** - Real-time event publishing for system integration
- **Caching Layer** - Redis-based caching for optimal performance
- **Analytics & Reporting** - Customer lifecycle, value, and churn analytics

### Enterprise Features
- **Multi-Tier Classification** - Bronze, Silver, Gold, Platinum, Diamond tiers
- **KYC Compliance** - Know Your Customer status tracking
- **Risk Assessment** - Customer risk scoring and credit assessment
- **Audit Trails** - Comprehensive event logging and audit trails
- **Geospatial Support** - Address geocoding and location-based features

## 🛠️ Technology Stack

- **Language**: Go 1.21
- **Database**: PostgreSQL 15+ with JSONB support
- **Cache**: Redis 7+
- **Message Queue**: Apache Kafka
- **Service Mesh**: Dapr
- **Workflow Engine**: Temporal
- **Monitoring**: Prometheus + Grafana
- **Documentation**: Swagger/OpenAPI 3.0

## 📋 Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose
- Kubernetes cluster (for production deployment)

## 🏃‍♂️ Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd customer-service
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Set up environment variables**
   ```bash
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_USER=postgres
   export DB_PASSWORD=postgres
   export DB_NAME=customer_service
   export REDIS_HOST=localhost
   export REDIS_PORT=6379
   ```

4. **Run database migrations**
   ```bash
   # The service will auto-migrate on startup
   go run cmd/main.go
   ```

5. **Start the service**
   ```bash
   go run cmd/main.go
   ```

The service will be available at `http://localhost:8080`

### Using Docker Compose

1. **Start all dependencies**
   ```bash
   docker-compose up -d postgres redis
   ```

2. **Build and run the service**
   ```bash
   docker-compose up --build customer-service
   ```

## 🔧 Configuration

The service supports configuration through:

1. **Environment Variables** (highest priority)
2. **Configuration Files** (`config.yaml`)
3. **Default Values** (lowest priority)

### Key Configuration Options

```yaml
server:
  port: 8080
  host: "0.0.0.0"
  environment: "development"

database:
  host: "localhost"
  port: 5432
  user: "postgres"
  password: "postgres"
  dbname: "customer_service"
  sslmode: "disable"

redis:
  host: "localhost"
  port: 6379
  password: ""
  db: 0

kafka:
  brokers: ["localhost:9092"]
  consumer_group: "customer-service-group"

dapr:
  app_id: "customer-service"
  app_port: 8080
```

## 📚 API Documentation

### REST Endpoints

The service exposes a comprehensive REST API:

#### Customer Operations
- `GET /api/v1/customers` - List customers with filtering and pagination
- `POST /api/v1/customers` - Create a new customer
- `GET /api/v1/customers/{id}` - Get customer by ID
- `PUT /api/v1/customers/{id}` - Update customer
- `DELETE /api/v1/customers/{id}` - Delete customer

#### Profile Management
- `GET /api/v1/customers/{id}/profile` - Get customer profile
- `PUT /api/v1/customers/{id}/profile` - Update customer profile

#### Interaction Tracking
- `GET /api/v1/customers/{id}/interactions` - Get customer interactions
- `POST /api/v1/customers/{id}/interactions` - Create interaction

#### Search & Analytics
- `GET /api/v1/search/customers` - Search customers
- `POST /api/v1/search/customers/advanced` - Advanced search
- `GET /api/v1/analytics/segments` - Segment analytics
- `GET /api/v1/analytics/lifecycle` - Lifecycle analytics

#### Health & Monitoring
- `GET /health` - Comprehensive health check
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe
- `GET /metrics` - Prometheus metrics

### Swagger Documentation

Interactive API documentation is available at:
- **Local**: `http://localhost:8080/swagger/index.html`
- **Production**: `https://api.enterprise-crm.com/customer-service/swagger/index.html`

## 🚀 Deployment

### Kubernetes Deployment

1. **Apply the Kubernetes manifests**
   ```bash
   kubectl apply -f deployments/kubernetes.yaml
   ```

2. **Verify deployment**
   ```bash
   kubectl get pods -n enterprise-crm -l app=customer-service
   kubectl get svc -n enterprise-crm customer-service
   ```

3. **Check health**
   ```bash
   kubectl port-forward svc/customer-service 8080:80 -n enterprise-crm
   curl http://localhost:8080/health
   ```

### Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -t enterprise-crm/customer-service:latest .
   ```

2. **Run with Docker**
   ```bash
   docker run -p 8080:8080 \
     -e DB_HOST=host.docker.internal \
     -e REDIS_HOST=host.docker.internal \
     enterprise-crm/customer-service:latest
   ```

## 🔍 Monitoring & Observability

### Health Checks
- **Health**: `/health` - Overall service health
- **Readiness**: `/ready` - Ready to accept traffic
- **Liveness**: `/live` - Service is alive

### Metrics
- **Prometheus metrics**: `/metrics`
- **Custom business metrics**: Customer creation rate, interaction volume, etc.
- **Infrastructure metrics**: Database connections, Redis performance, etc.

### Logging
- **Structured JSON logging** with configurable levels
- **Request/response logging** with correlation IDs
- **Error tracking** with stack traces
- **Business event logging** for audit trails

## 🧪 Testing

### Unit Tests
```bash
go test ./internal/...
```

### Integration Tests
```bash
go test -tags=integration ./tests/...
```

### Load Testing
```bash
# Using k6 or similar tools
k6 run tests/load/customer-load-test.js
```

## 🔒 Security

### Authentication & Authorization
- **JWT-based authentication** via API Gateway
- **Role-based access control** (RBAC)
- **Service-to-service authentication** via Dapr

### Data Protection
- **Encryption at rest** for sensitive data
- **Encryption in transit** via TLS
- **PII data masking** in logs
- **Input validation** and sanitization

### Compliance
- **GDPR compliance** with data deletion capabilities
- **KYC/AML integration** for regulatory compliance
- **Audit logging** for compliance reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow Go best practices and conventions
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure all CI/CD checks pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Documentation**: Check the `/docs` directory
- **Issues**: Create an issue in the repository
- **Slack**: #enterprise-crm-support
- **Email**: support@enterprise-crm.com

## 🗺️ Roadmap

### Upcoming Features
- [ ] GraphQL API support
- [ ] Real-time notifications via WebSocket
- [ ] Advanced ML-based customer insights
- [ ] Multi-tenant support
- [ ] Enhanced geospatial analytics
- [ ] Integration with external CRM systems

### Performance Improvements
- [ ] Database query optimization
- [ ] Advanced caching strategies
- [ ] Connection pooling enhancements
- [ ] Async processing for bulk operations

---

**Built with ❤️ by the Enterprise CRM Team**


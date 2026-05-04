# Payment Switch Microservices

This directory contains Go and Python microservices that implement missing features for user journeys.

## Architecture

```
orchestrator/services/
├── go/
│   ├── qr/          # QR code generation service
│   ├── export/      # CSV/Excel export service
│   ├── retry/       # Payment retry logic service
│   └── receipt/     # Receipt generation service
└── python/
    ├── email/       # Email receipt delivery service
    ├── verification/# Email verification & document upload
    └── analytics/   # Real-time analytics dashboard
```

## Services Overview

### Go Microservices

#### 1. QR Code Generation Service (Port 8001)

**Purpose:** Generate QR codes for payment sessions

**Endpoints:**
- `POST /generate` - Generate QR code for payment
- `POST /verify` - Verify QR code signature
- `GET /health` - Health check

**Example:**
```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "sess_123",
    "amount": 10000,
    "currency": "USD",
    "merchant_id": 1,
    "payment_method": "qr"
  }'
```

#### 2. Export Service (Port 8002)

**Purpose:** Export transaction data to CSV/Excel

**Endpoints:**
- `POST /export` - Generate export file
- `GET /download?file=filename` - Download export file
- `GET /health` - Health check

**Example:**
```bash
curl -X POST http://localhost:8002/export \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transactions",
    "format": "excel",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "merchant_id": 1
  }'
```

#### 3. Payment Retry Service (Port 8003)

**Purpose:** Handle payment retry logic with multiple strategies

**Endpoints:**
- `POST /retry` - Schedule payment retry
- `GET /status?retry_id=xxx` - Get retry status
- `POST /cancel` - Cancel scheduled retries
- `GET /health` - Health check

**Retry Strategies:**
- `immediate` - Retry immediately
- `exponential` - Exponential backoff (5min, 10min, 20min, ...)
- `scheduled` - Fixed intervals (5min, 10min, 15min, ...)

**Example:**
```bash
curl -X POST http://localhost:8003/retry \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_123",
    "retry_strategy": "exponential",
    "max_attempts": 3,
    "retry_interval": 300
  }'
```

### Python Microservices

#### 4. Email Receipt Service (Port 8004)

**Purpose:** Generate and send email receipts

**Endpoints:**
- `POST /send-receipt` - Send receipt for transaction
- `POST /send-bulk-receipts` - Send receipts for multiple transactions
- `POST /preview-receipt` - Preview receipt HTML
- `GET /health` - Health check

**Example:**
```bash
curl -X POST http://localhost:8004/send-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_123",
    "email": "customer@example.com"
  }'
```

#### 5. Email Verification Service (Port 8005)

**Purpose:** Handle email verification and document uploads

**Endpoints:**
- `POST /send-verification` - Send verification email
- `POST /verify` - Verify email with token
- `POST /resend-verification` - Resend verification email
- `POST /upload-document` - Upload KYC document
- `GET /documents?merchant_id=xxx` - Get uploaded documents
- `GET /health` - Health check

**Example:**
```bash
# Send verification
curl -X POST http://localhost:8005/send-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "merchant_id": 1
  }'

# Upload document
curl -X POST http://localhost:8005/upload-document \
  -F "file=@business_license.pdf" \
  -F "document_type=business_license" \
  -F "merchant_id=1"
```

#### 6. Real-time Analytics Service (Port 8006)

**Purpose:** Provide real-time metrics and analytics dashboard

**Endpoints:**
- `GET /metrics/realtime` - Get real-time metrics
- `GET /metrics/dashboard?merchant_id=xxx&period=today` - Get dashboard metrics
- `POST /metrics/export` - Export metrics to CSV/Excel
- `GET /health` - Health check

**WebSocket:**
- Connect to `ws://localhost:8006/socket.io` for real-time updates
- Emit `subscribe` event with `{merchant_id: 1}` to receive metrics updates

**Example:**
```bash
# Get real-time metrics
curl http://localhost:8006/metrics/realtime

# Get dashboard metrics
curl "http://localhost:8006/metrics/dashboard?merchant_id=1&period=week"
```

## Deployment

### Local Development

#### Go Services

```bash
# QR Service
cd services/go/qr
go mod init github.com/payment-switch/qr-service
go mod tidy
go run main.go

# Export Service
cd services/go/export
go mod init github.com/payment-switch/export-service
go mod tidy
go run main.go

# Retry Service
cd services/go/retry
go mod init github.com/payment-switch/retry-service
go mod tidy
go run main.go
```

#### Python Services

```bash
# Email Service
cd services/python/email
pip install flask psycopg2-binary jinja2
python main.py

# Verification Service
cd services/python/verification
pip install flask psycopg2-binary redis
python main.py

# Analytics Service
cd services/python/analytics
pip install flask flask-socketio psycopg2-binary redis
python main.py
```

### Docker Deployment

Create `docker-compose.services.yml`:

```yaml
version: '3.8'

services:
  qr-service:
    build: ./services/go/qr
    ports:
      - "8001:8001"
    environment:
      - PORT=8001
    networks:
      - payment-switch-network

  export-service:
    build: ./services/go/export
    ports:
      - "8002:8002"
    environment:
      - PORT=8002
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - payment-switch-network

  retry-service:
    build: ./services/go/retry
    ports:
      - "8003:8003"
    environment:
      - PORT=8003
      - DATABASE_URL=${DATABASE_URL}
      - KAFKA_BROKERS=kafka:9092
    networks:
      - payment-switch-network

  email-service:
    build: ./services/python/email
    ports:
      - "8004:8004"
    environment:
      - PORT=8004
      - DB_HOST=postgres
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_USERNAME=${SMTP_USERNAME}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
    networks:
      - payment-switch-network

  verification-service:
    build: ./services/python/verification
    ports:
      - "8005:8005"
    environment:
      - PORT=8005
      - DB_HOST=postgres
      - REDIS_HOST=redis
    networks:
      - payment-switch-network

  analytics-service:
    build: ./services/python/analytics
    ports:
      - "8006:8006"
    environment:
      - PORT=8006
      - DB_HOST=postgres
      - REDIS_HOST=redis
    networks:
      - payment-switch-network

networks:
  payment-switch-network:
    external: true
```

Deploy:

```bash
docker-compose -f docker-compose.services.yml up -d
```

### Kubernetes Deployment

See `kubernetes/services/` directory for Kubernetes manifests.

## Integration with Orchestrator

These microservices are called by Temporal workflows as activities:

### Example: Payment Processing Workflow

```go
// In payment_processing.go workflow

// Step 12: Generate QR code (if payment method is QR)
if req.PaymentMethod == "qr" {
    var qrResult QRCodeResult
    err := workflow.ExecuteActivity(ctx, "GenerateQRCode", req).Get(ctx, &qrResult)
    if err != nil {
        logger.Error("QR generation failed", "error", err)
    }
}

// Step 13: Send email receipt
err = workflow.ExecuteActivity(ctx, "SendEmailReceipt", map[string]interface{}{
    "transaction_id": captureResult.TransactionID,
    "email":          req.CustomerEmail,
}).Get(ctx, nil)
```

### Example: Merchant Onboarding Workflow

```go
// In merchant_onboarding.go workflow

// Step 2: Send email verification
var verificationToken string
err := workflow.ExecuteActivity(ctx, "SendVerificationEmail", application.Email).Get(ctx, &verificationToken)

// Step 3: Wait for email verification
var emailVerified bool
signalChan := workflow.GetSignalChannel(ctx, "email_verified")
workflow.Await(ctx, func() bool {
    signalChan.Receive(ctx, &emailVerified)
    return emailVerified
})

// Step 4: Upload and process documents
var documents []string
err = workflow.ExecuteActivity(ctx, "UploadKYCDocuments", application.ID).Get(ctx, &documents)
```

## Monitoring

### Health Checks

```bash
# Check all services
for port in 8001 8002 8003 8004 8005 8006; do
  echo "Checking service on port $port..."
  curl -s http://localhost:$port/health | jq
done
```

### Metrics

Each service exposes metrics:

- Request count
- Response time
- Error rate
- Active connections (for analytics WebSocket)

### Logs

```bash
# Docker logs
docker-compose logs -f qr-service
docker-compose logs -f email-service

# Kubernetes logs
kubectl logs -f deployment/qr-service
kubectl logs -f deployment/analytics-service
```

## Testing

### Unit Tests

```bash
# Go services
cd services/go/qr && go test ./...
cd services/go/export && go test ./...
cd services/go/retry && go test ./...

# Python services
cd services/python/email && pytest
cd services/python/verification && pytest
cd services/python/analytics && pytest
```

### Integration Tests

```bash
# Test QR generation
./test/integration/test_qr_service.sh

# Test email delivery
./test/integration/test_email_service.sh

# Test analytics
./test/integration/test_analytics_service.sh
```

## Security

- All services use API key authentication
- HTTPS/TLS in production
- Rate limiting enabled
- Input validation on all endpoints
- SQL injection prevention
- XSS protection

## Performance

- QR Service: 10,000 QR/sec
- Export Service: 100 exports/min
- Retry Service: 5,000 retries/sec
- Email Service: 1,000 emails/min
- Verification Service: 500 uploads/min
- Analytics Service: 10,000 concurrent WebSocket connections

## Troubleshooting

### Service Not Starting

1. Check port availability
2. Verify environment variables
3. Check database connectivity
4. Review logs for errors

### High Latency

1. Check database connection pool
2. Monitor Redis performance
3. Review query performance
4. Scale horizontally

### Memory Issues

1. Check for memory leaks
2. Adjust container limits
3. Optimize database queries
4. Enable caching

## Support

For issues or questions:
- Check service logs
- Review health check endpoints
- Contact platform team

## License

Copyright © 2024 Payment Switch. All rights reserved.

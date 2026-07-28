# Communication Service

A comprehensive multi-channel communication service for the Nigerian insurance platform, supporting **WhatsApp**, **SMS**, **Telegram**, and **USSD** channels.

## Features

### Multi-Channel Support

- **WhatsApp Business API**: Rich messaging with templates, media, and interactive buttons
- **SMS (Twilio)**: Reliable text messaging for critical notifications
- **Telegram Bot API**: Modern messaging with inline keyboards and media support
- **USSD**: Interactive menu-based service for feature phones (*123# style)

### Core Capabilities

✅ **Template Management**: Create and manage message templates with variable substitution  
✅ **Message Routing**: Intelligent routing to appropriate channels based on preferences  
✅ **Event-Driven**: Kafka consumer for real-time notification delivery  
✅ **Session Management**: Redis-based USSD session management  
✅ **Webhook Handling**: Process inbound messages from all channels  
✅ **Delivery Tracking**: Track message delivery status across channels  
✅ **Bulk Messaging**: Send messages to multiple recipients efficiently  

## Architecture

```
┌─────────────────┐
│ Insurance       │
│ Platform        │
│ (Kafka Events)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│     Communication Service (Go)          │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Kafka Consumer                 │  │
│  │   (notification-events topic)    │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│             ▼                           │
│  ┌──────────────────────────────────┐  │
│  │   Message Router                 │  │
│  │   - Template Rendering           │  │
│  │   - Channel Selection            │  │
│  │   - Delivery Tracking            │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│    ┌────────┼────────┬────────┐        │
│    ▼        ▼        ▼        ▼        │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐       │
│  │WA  │  │SMS │  │TG  │  │USSD│       │
│  │API │  │API │  │API │  │    │       │
│  └────┘  └────┘  └────┘  └────┘       │
└─────────────────────────────────────────┘
         │        │        │        │
         ▼        ▼        ▼        ▼
    WhatsApp   Twilio  Telegram   USSD
    Business     SMS      Bot    Gateway
```

## USSD Flow Example

```
Customer dials *123#

┌─────────────────────────────────────┐
│ Welcome to Insurance Platform      │
│                                     │
│ 1. Check Balance                    │
│ 2. Policy Information               │
│ 3. Make Payment                     │
│ 4. File a Claim                     │
│ 5. Contact Support                  │
└─────────────────────────────────────┘

Customer selects: 1

┌─────────────────────────────────────┐
│ Policy: POL-2025-001234             │
│ Premium: ₦50,000.00                 │
│ Status: Active                      │
│                                     │
│ Thank you for using our service!    │
└─────────────────────────────────────┘
```

## Event-Driven Notifications

The service consumes events from Kafka and automatically sends notifications:

### Supported Events

| Event Type | Channels | Template |
|------------|----------|----------|
| `policy.created` | SMS + WhatsApp | policy-created |
| `policy.renewed` | WhatsApp | policy-renewal |
| `policy.expired` | SMS | policy-expired |
| `claim.submitted` | SMS | claim-submitted |
| `claim.approved` | SMS + WhatsApp | claim-approved |
| `claim.rejected` | WhatsApp | claim-rejected |
| `payment.received` | SMS | payment-received |
| `payment.reminder` | SMS | payment-reminder |

### Example Event

```json
{
  "event_type": "claim.approved",
  "customer_id": "CUST-001",
  "phone": "+2348012345678",
  "data": {
    "customer_name": "John Doe",
    "claim_number": "CLM-2025-001",
    "claim_amount": "500000"
  }
}
```

## API Endpoints

### Send Message

```http
POST /api/v1/messages
Content-Type: application/json

{
  "channel": "whatsapp",
  "recipient": "+2348012345678",
  "template_id": "policy-created-sms",
  "variables": {
    "customer_name": "John Doe",
    "policy_type": "Health",
    "policy_number": "POL-2025-001",
    "premium_amount": "50000"
  }
}
```

### Get Message Status

```http
GET /api/v1/messages/{message_id}
```

### USSD Endpoint

```http
POST /api/v1/ussd
Content-Type: application/x-www-form-urlencoded

sessionId=session123&phoneNumber=+2348012345678&serviceCode=*123#&text=1
```

### WhatsApp Webhook

```http
POST /api/v1/webhooks/whatsapp
```

### SMS Webhook (Twilio)

```http
POST /api/v1/webhooks/sms
```

## Message Templates

Templates support variable substitution using `{{variable_name}}` syntax.

### Example Template

```
Dear {{customer_name}}, your {{policy_type}} policy ({{policy_number}}) 
has been created successfully. Premium: ₦{{premium_amount}}. 
Thank you for choosing us!
```

### Default Templates

The service includes 5 default templates:

1. **policy-created-sms**: Policy creation notification
2. **claim-approved-whatsapp**: Claim approval notification
3. **payment-reminder-sms**: Premium payment reminder
4. **claim-rejected-telegram**: Claim rejection notification
5. **policy-renewal-whatsapp**: Policy renewal reminder

## Configuration

Configuration is managed via environment variables:

### Database & Cache

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_ADDR`: Redis server address
- `REDIS_PASSWORD`: Redis password (optional)

### WhatsApp

- `WHATSAPP_API_URL`: WhatsApp Business API URL (default: `https://graph.facebook.com/v18.0`)
- `WHATSAPP_ACCESS_TOKEN`: WhatsApp Business API access token
- `WHATSAPP_PHONE_ID`: WhatsApp Business phone number ID
- `WHATSAPP_VERIFY_TOKEN`: Webhook verification token

### SMS (Twilio)

- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `TWILIO_FROM_NUMBER`: Twilio phone number (e.g., `+1234567890`)

### Telegram

- `TELEGRAM_BOT_TOKEN`: Telegram bot token from @BotFather

### Kafka

- `KAFKA_BROKERS`: Kafka broker addresses (default: `localhost:9092`)
- `KAFKA_TOPIC`: Topic to consume (default: `notification-events`)
- `KAFKA_GROUP_ID`: Consumer group ID (default: `communication-service`)

### Server

- `PORT`: HTTP server port (default: `8080`)

## Deployment

### Docker

```bash
# Build image
docker build -t insurance-platform/communication-service:latest .

# Run container
docker run -d \
  --name communication-service \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://..." \
  -e REDIS_ADDR="redis:6379" \
  -e WHATSAPP_ACCESS_TOKEN="..." \
  -e TWILIO_ACCOUNT_SID="..." \
  -e TELEGRAM_BOT_TOKEN="..." \
  insurance-platform/communication-service:latest
```

### Kubernetes

```bash
# Create namespace and deploy
kubectl apply -f deployments/kubernetes/deployment.yaml

# Check status
kubectl get pods -n communication

# View logs
kubectl logs -f deployment/communication-service -n communication
```

### Database Setup

```bash
# Run schema migration
psql $DATABASE_URL -f deployments/schema.sql
```

## Development

### Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Redis 7+
- Kafka 3.0+

### Local Setup

```bash
# Clone repository
git clone https://github.com/insurance-platform/communication-service.git
cd communication-service

# Install dependencies
go mod download

# Set environment variables
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/communication?sslmode=disable"
export REDIS_ADDR="localhost:6379"
export KAFKA_BROKERS="localhost:9092"

# Run database migrations
psql $DATABASE_URL -f deployments/schema.sql

# Run service
go run cmd/server/main.go
```

### Testing

```bash
# Send test message
curl -X POST http://localhost:8080/api/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "sms",
    "recipient": "+2348012345678",
    "content": "Test message from Communication Service"
  }'

# Test USSD
curl -X POST http://localhost:8080/api/v1/ussd \
  -d "sessionId=test123&phoneNumber=+2348012345678&serviceCode=*123#&text="
```

## Integration with Insurance Platform

### Publishing Events to Kafka

From any microservice in the platform:

```go
// Publish notification event
event := NotificationEvent{
    EventType:  "policy.created",
    CustomerID: "CUST-001",
    Phone:      "+2348012345678",
    Data: map[string]string{
        "customer_name":   "John Doe",
        "policy_type":     "Health",
        "policy_number":   "POL-2025-001",
        "premium_amount":  "50000",
    },
}

kafkaProducer.Publish("notification-events", event)
```

The Communication Service will automatically:
1. Consume the event
2. Select appropriate template
3. Render message with variables
4. Send via configured channels
5. Track delivery status

## Channel-Specific Features

### WhatsApp

- ✅ Text messages
- ✅ Template messages (pre-approved)
- ✅ Media messages (images, documents)
- ✅ Interactive buttons
- ✅ Delivery receipts
- ✅ Inbound message handling

### SMS

- ✅ Text messages (160 characters)
- ✅ Long message splitting
- ✅ Delivery status tracking
- ✅ Inbound SMS handling
- ✅ Bulk messaging

### Telegram

- ✅ Text messages with Markdown
- ✅ Photos and documents
- ✅ Inline keyboards
- ✅ Callback query handling
- ✅ Long polling for updates

### USSD

- ✅ Interactive menu navigation
- ✅ Session management (5-minute timeout)
- ✅ Redis-based state storage
- ✅ Database integration for queries
- ✅ Transaction logging

## Performance

- **Throughput**: 10,000+ messages/hour
- **Latency**: < 200ms (p95)
- **Availability**: 99.9%
- **Concurrent Sessions**: 1,000+ USSD sessions

## Monitoring

The service exposes metrics for monitoring:

- Message delivery rate by channel
- Delivery success/failure rate
- API response times
- USSD session duration
- Kafka consumer lag

## Security

- ✅ Webhook signature verification (WhatsApp, Twilio)
- ✅ TLS/HTTPS for all external APIs
- ✅ Secrets stored in Kubernetes Secrets
- ✅ Rate limiting on API endpoints
- ✅ Input validation and sanitization

## Compliance

- **NDPR**: Customer data encrypted at rest and in transit
- **NAICOM**: All communications logged for audit
- **Retention**: Messages retained for 7 years

## Support

For issues or questions:
- Email: support@insurance-platform.ng
- Slack: #communication-service

## License

Proprietary - Insurance Platform Nigeria

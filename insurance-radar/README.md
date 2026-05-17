# Insurance Radar

Real-time fraud detection service for the Unified Insurance Platform, inspired by [Stripe Radar](https://stripe.com/blog/how-we-built-it-stripe-radar).

## Overview

Insurance Radar provides intelligent fraud detection for insurance operations including:
- **Claims Fraud Detection** - Identify fraudulent insurance claims
- **Policy Application Fraud** - Detect fraudulent policy applications
- **Agent Fraud Detection** - Monitor agent behavior for suspicious patterns
- **Payment Fraud** - Detect fraudulent premium payments
- **Identity Fraud** - Verify customer identities
- **Document Fraud** - Detect tampered or forged documents

## Key Features

### 1. 1000+ Feature Engineering
Inspired by Stripe Radar's approach of assessing 1000+ characteristics per transaction:

- **Device Features** (100+): Device fingerprinting, browser analysis, OS detection
- **Location Features** (50+): Geolocation, VPN/proxy detection, country risk
- **Behavior Features** (200+): Time patterns, amount analysis, session behavior
- **Velocity Features** (100+): Request frequency, claim patterns, device changes
- **Network Features** (150+): Cross-company fraud signals, graph analysis
- **Document Features** (100+): OCR confidence, tampering detection, metadata analysis
- **Claim Features** (150+): Claim patterns, timing, amount vs coverage
- **Policy Features** (100+): Policy age, modifications, beneficiary changes
- **Agent Features** (100+): Agent tenure, fraud rate, commission patterns
- **Historical Features** (200+): Customer history, payment patterns, KYC scores

### 2. Deep Neural Network Model
Following Stripe's evolution from Wide & Deep to pure DNN:

- **Architecture**: 4 hidden layers (512 → 256 → 128 → 64)
- **Activation**: ReLU with sigmoid output
- **Target Latency**: <100ms inference time
- **Continuous Learning**: Model retraining pipeline

### 3. Dynamic Rules Engine
AI-generated and static rules for fraud detection:

- **Static Rules**: Predefined fraud patterns
- **Velocity Rules**: Rate-based detection
- **Blacklist/Whitelist**: Entity-based rules
- **AI-Generated Rules**: Automatically discovered patterns

### 4. Explainable AI
Human-readable explanations for fraud decisions:

- **Top Contributing Factors**: What triggered the fraud score
- **Mitigating Factors**: Positive signals that reduce risk
- **Suggested Actions**: Recommended next steps
- **Compliance Notes**: Regulatory requirements (NAICOM, NDPR, AML)

### 5. Network Effects
Cross-company fraud signals inspired by Stripe's network advantage:

- Integration with cross-company fraud database
- Industry-wide fraud pattern sharing
- Blacklist/whitelist management
- Graph-based entity analysis

## API Endpoints

### Fraud Scoring
```
POST /api/v1/radar/score
POST /api/v1/radar/score/batch
```

### Rules Management
```
GET    /api/v1/radar/rules
POST   /api/v1/radar/rules
GET    /api/v1/radar/rules/{id}
PUT    /api/v1/radar/rules/{id}
DELETE /api/v1/radar/rules/{id}
POST   /api/v1/radar/rules/{id}/enable
POST   /api/v1/radar/rules/{id}/disable
```

### Analytics
```
GET /api/v1/radar/analytics/summary
GET /api/v1/radar/analytics/trends
```

### Health
```
GET /api/v1/radar/health
```

## Example Request

```json
{
  "fraud_type": "claim",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "550e8400-e29b-41d4-a716-446655440001",
  "policy_id": "550e8400-e29b-41d4-a716-446655440002",
  "claim_id": "550e8400-e29b-41d4-a716-446655440003",
  "amount": 500000,
  "currency": "NGN",
  "device_info": {
    "device_type": "mobile",
    "browser": "Chrome",
    "os": "Android",
    "ip_address": "102.89.23.45"
  },
  "location_info": {
    "country_code": "NG",
    "city": "Lagos",
    "is_vpn": false
  }
}
```

## Example Response

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440004",
  "score": 0.72,
  "risk_level": "high",
  "decision": "review",
  "confidence": 0.85,
  "processing_time_ms": 45,
  "signals": [
    {
      "signal_id": "claim_amount",
      "category": "Claim",
      "name": "High Claim Amount",
      "value": 500000,
      "is_anomaly": true
    }
  ],
  "risk_factors": [
    {
      "factor_id": "rule_high_amount_claim",
      "name": "High Amount Claim",
      "impact": "high",
      "evidence": "Claim amount exceeds threshold"
    }
  ],
  "matched_rules": [
    {
      "rule_id": "rule_high_amount_claim",
      "rule_name": "High Amount Claim",
      "action": "review",
      "severity": "high"
    }
  ],
  "explanation": {
    "summary": "This transaction has been flagged as HIGH RISK with a fraud score of 72.00%.",
    "top_factors": [
      "High claim amount: ₦500,000.00"
    ],
    "suggested_actions": [
      "Place transaction on hold pending manual review",
      "Request additional documentation from the customer"
    ],
    "compliance_notes": [
      "NAICOM Guideline: High-risk transactions must be reported within 24 hours"
    ]
  }
}
```

## Performance Targets

| Metric | Target | Inspired By |
|--------|--------|-------------|
| Inference Latency | <100ms | Stripe Radar |
| False Positive Rate | <0.1% | Stripe Radar |
| Feature Count | 1000+ | Stripe Radar |
| Model Architecture | Pure DNN | Stripe Radar 2022 Migration |

## Configuration

Environment variables:
- `PORT` - Server port (default: 8090)
- `MODEL_PATH` - Path to trained model weights
- `REDIS_URL` - Redis connection for caching
- `KAFKA_BROKERS` - Kafka brokers for event streaming
- `CROSS_COMPANY_DB_URL` - Cross-company fraud database URL

## References

- [How we built it: Stripe Radar](https://stripe.com/blog/how-we-built-it-stripe-radar)
- [Using AI to create dynamic, risk-based Radar rules](https://stripe.com/blog/using-ai-dynamic-radar-rules)
- [Stripe Payments Foundation Model](https://stripe.com/sessions)

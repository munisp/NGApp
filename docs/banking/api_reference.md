# Banking-CRM Integration System: API Reference

This comprehensive API reference documents all endpoints, request/response formats, and authentication mechanisms for the Banking-CRM Integration System. The system provides a secure, scalable, and feature-rich API for integrating banking platforms with CRM systems.

## Table of Contents

1. [Authentication](#authentication)
2. [API Gateway](#api-gateway)
3. [Banking Service API](#banking-service-api)
4. [CRM Service API](#crm-service-api)
5. [AI Service API](#ai-service-api)
6. [Event Streaming API](#event-streaming-api)
7. [Workflow API](#workflow-api)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Versioning](#versioning)

## Authentication

The Banking-CRM Integration System uses OAuth 2.0 with OpenID Connect (OIDC) for authentication and authorization. All API requests must include a valid JWT token in the Authorization header.

### Obtaining Access Tokens

#### Client Credentials Flow

```bash
curl -X POST \
  https://auth.example.com/realms/banking-crm/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=your-client-id&client_secret=your-client-secret'
```

#### Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJfT3B2QW...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJf...",
  "token_type": "bearer",
  "not-before-policy": 0,
  "scope": "profile email"
}
```

### Using Access Tokens

Include the access token in the Authorization header of all API requests:

```bash
curl -X GET \
  https://api.example.com/banking/v1/customers \
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJfT3B2QW...'
```

### Role-Based Access Control

The system uses role-based access control (RBAC) to restrict access to API endpoints. The following roles are available:

- **banking:admin** - Full access to all banking APIs
- **banking:read** - Read-only access to banking APIs
- **banking:write** - Write access to banking APIs
- **crm:admin** - Full access to all CRM APIs
- **crm:read** - Read-only access to CRM APIs
- **crm:write** - Write access to CRM APIs
- **ai:admin** - Full access to all AI APIs
- **ai:read** - Read-only access to AI APIs
- **ai:write** - Write access to AI APIs

## API Gateway

The Banking-CRM Integration System uses APISIX as the API gateway. The gateway provides the following features:

- **Authentication** - JWT validation and OIDC integration
- **Authorization** - Role-based access control
- **Rate Limiting** - Request rate limiting
- **Request Validation** - JSON schema validation
- **Logging** - Request/response logging
- **Monitoring** - Prometheus metrics
- **Caching** - Response caching
- **Routing** - Request routing to backend services

### API Gateway Endpoints

| Endpoint | Description |
|----------|-------------|
| `/banking/*` | Banking Service API |
| `/crm/*` | CRM Service API |
| `/ai/*` | AI Service API |
| `/events/*` | Event Streaming API |
| `/workflows/*` | Workflow API |
| `/health` | Health check endpoint |
| `/metrics` | Prometheus metrics endpoint |

## Banking Service API

The Banking Service API provides endpoints for integrating with banking platforms, including Agent Banking, NeoBank, Core Banking, and Payment Processing.

### Customer Endpoints

#### Get Customer

```
GET /banking/v1/customers/{customer_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `customer_id` | string | path | Customer ID |
| `include` | string | query | Optional. Comma-separated list of related resources to include (e.g., `accounts,transactions`) |

**Response**

```json
{
  "customer_id": "cust123456",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2341234567890",
  "date_of_birth": "1980-01-01",
  "address": {
    "street": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "postal_code": "100001",
    "country": "Nigeria"
  },
  "kyc_status": "verified",
  "risk_score": 0.12,
  "segment": "premium",
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-06-01T14:30:00Z",
  "accounts": [
    {
      "account_id": "acc789012",
      "account_type": "savings",
      "account_number": "1234567890",
      "balance": 5000.00,
      "currency": "NGN",
      "status": "active"
    }
  ]
}
```

#### List Customers

```
GET /banking/v1/customers
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `page` | integer | query | Page number (default: 1) |
| `limit` | integer | query | Page size (default: 20, max: 100) |
| `sort` | string | query | Sort field and direction (e.g., `created_at:desc`) |
| `filter` | string | query | Filter criteria (e.g., `segment:premium`) |

**Response**

```json
{
  "data": [
    {
      "customer_id": "cust123456",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+2341234567890",
      "kyc_status": "verified",
      "segment": "premium"
    },
    {
      "customer_id": "cust123457",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "phone": "+2341234567891",
      "kyc_status": "pending",
      "segment": "standard"
    }
  ],
  "pagination": {
    "total": 125,
    "page": 1,
    "limit": 20,
    "pages": 7
  }
}
```

#### Create Customer

```
POST /banking/v1/customers
```

**Request Body**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2341234567890",
  "date_of_birth": "1980-01-01",
  "address": {
    "street": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "postal_code": "100001",
    "country": "Nigeria"
  },
  "id_type": "national_id",
  "id_number": "12345678901"
}
```

**Response**

```json
{
  "customer_id": "cust123456",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2341234567890",
  "date_of_birth": "1980-01-01",
  "address": {
    "street": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "postal_code": "100001",
    "country": "Nigeria"
  },
  "kyc_status": "pending",
  "risk_score": 0.50,
  "segment": "standard",
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-01-01T12:00:00Z"
}
```

### Transaction Endpoints

#### Get Transaction

```
GET /banking/v1/transactions/{transaction_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `transaction_id` | string | path | Transaction ID |

**Response**

```json
{
  "transaction_id": "tx123456",
  "customer_id": "cust123456",
  "account_id": "acc789012",
  "type": "transfer",
  "amount": 1000.00,
  "currency": "NGN",
  "description": "Transfer to Jane Smith",
  "status": "completed",
  "reference": "REF123456",
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-01T14:30:05Z",
  "metadata": {
    "recipient_name": "Jane Smith",
    "recipient_account": "0987654321",
    "recipient_bank": "Example Bank"
  }
}
```

#### List Transactions

```
GET /banking/v1/transactions
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `customer_id` | string | query | Filter by customer ID |
| `account_id` | string | query | Filter by account ID |
| `type` | string | query | Filter by transaction type |
| `status` | string | query | Filter by transaction status |
| `start_date` | string | query | Filter by start date (ISO 8601) |
| `end_date` | string | query | Filter by end date (ISO 8601) |
| `page` | integer | query | Page number (default: 1) |
| `limit` | integer | query | Page size (default: 20, max: 100) |

**Response**

```json
{
  "data": [
    {
      "transaction_id": "tx123456",
      "customer_id": "cust123456",
      "account_id": "acc789012",
      "type": "transfer",
      "amount": 1000.00,
      "currency": "NGN",
      "description": "Transfer to Jane Smith",
      "status": "completed",
      "created_at": "2023-06-01T14:30:00Z"
    },
    {
      "transaction_id": "tx123457",
      "customer_id": "cust123456",
      "account_id": "acc789012",
      "type": "deposit",
      "amount": 5000.00,
      "currency": "NGN",
      "description": "Salary deposit",
      "status": "completed",
      "created_at": "2023-06-01T10:15:00Z"
    }
  ],
  "pagination": {
    "total": 57,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

#### Create Transaction

```
POST /banking/v1/transactions
```

**Request Body**

```json
{
  "customer_id": "cust123456",
  "account_id": "acc789012",
  "type": "transfer",
  "amount": 1000.00,
  "currency": "NGN",
  "description": "Transfer to Jane Smith",
  "recipient": {
    "name": "Jane Smith",
    "account": "0987654321",
    "bank": "Example Bank"
  }
}
```

**Response**

```json
{
  "transaction_id": "tx123456",
  "customer_id": "cust123456",
  "account_id": "acc789012",
  "type": "transfer",
  "amount": 1000.00,
  "currency": "NGN",
  "description": "Transfer to Jane Smith",
  "status": "pending",
  "reference": "REF123456",
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-01T14:30:00Z",
  "metadata": {
    "recipient_name": "Jane Smith",
    "recipient_account": "0987654321",
    "recipient_bank": "Example Bank"
  }
}
```

### Fraud Detection Endpoints

#### Check Transaction Risk

```
POST /banking/v1/fraud/check
```

**Request Body**

```json
{
  "customer_id": "cust123456",
  "transaction_type": "transfer",
  "amount": 1000.00,
  "currency": "NGN",
  "recipient": {
    "name": "Jane Smith",
    "account": "0987654321",
    "bank": "Example Bank"
  },
  "device_info": {
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "device_id": "device123"
  },
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}
```

**Response**

```json
{
  "risk_score": 0.12,
  "risk_level": "low",
  "recommendation": "approve",
  "rules_triggered": [
    {
      "rule_id": "rule123",
      "description": "Transaction amount within normal range",
      "score": 0.05
    },
    {
      "rule_id": "rule456",
      "description": "Transaction location matches customer profile",
      "score": 0.07
    }
  ],
  "additional_verification": false
}
```

## CRM Service API

The CRM Service API provides endpoints for customer relationship management, including leads, opportunities, and customer interactions.

### Lead Endpoints

#### Get Lead

```
GET /crm/v1/leads/{lead_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `lead_id` | string | path | Lead ID |

**Response**

```json
{
  "lead_id": "lead123456",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2341234567890",
  "source": "website",
  "status": "qualified",
  "score": 85,
  "product_interest": "savings_account",
  "assigned_to": "agent123",
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-06-01T14:30:00Z",
  "notes": "Interested in premium savings account with high interest rate"
}
```

#### List Leads

```
GET /crm/v1/leads
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `status` | string | query | Filter by lead status |
| `source` | string | query | Filter by lead source |
| `assigned_to` | string | query | Filter by assigned agent |
| `min_score` | integer | query | Filter by minimum score |
| `page` | integer | query | Page number (default: 1) |
| `limit` | integer | query | Page size (default: 20, max: 100) |

**Response**

```json
{
  "data": [
    {
      "lead_id": "lead123456",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+2341234567890",
      "source": "website",
      "status": "qualified",
      "score": 85,
      "product_interest": "savings_account",
      "assigned_to": "agent123",
      "created_at": "2023-01-01T12:00:00Z"
    },
    {
      "lead_id": "lead123457",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "phone": "+2341234567891",
      "source": "referral",
      "status": "new",
      "score": 65,
      "product_interest": "loan",
      "assigned_to": "agent456",
      "created_at": "2023-01-02T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

#### Create Lead

```
POST /crm/v1/leads
```

**Request Body**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2341234567890",
  "source": "website",
  "product_interest": "savings_account",
  "notes": "Interested in premium savings account with high interest rate"
}
```

**Response**

```json
{
  "lead_id": "lead123456",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2341234567890",
  "source": "website",
  "status": "new",
  "score": 50,
  "product_interest": "savings_account",
  "assigned_to": null,
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-01T14:30:00Z",
  "notes": "Interested in premium savings account with high interest rate"
}
```

### Opportunity Endpoints

#### Get Opportunity

```
GET /crm/v1/opportunities/{opportunity_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `opportunity_id` | string | path | Opportunity ID |

**Response**

```json
{
  "opportunity_id": "opp123456",
  "customer_id": "cust123456",
  "lead_id": "lead123456",
  "product": "savings_account",
  "stage": "proposal",
  "amount": 5000.00,
  "currency": "NGN",
  "probability": 0.75,
  "expected_close_date": "2023-07-15",
  "assigned_to": "agent123",
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-10T09:15:00Z",
  "notes": "Customer is interested in premium savings account with high interest rate"
}
```

#### List Opportunities

```
GET /crm/v1/opportunities
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `customer_id` | string | query | Filter by customer ID |
| `lead_id` | string | query | Filter by lead ID |
| `stage` | string | query | Filter by opportunity stage |
| `product` | string | query | Filter by product |
| `assigned_to` | string | query | Filter by assigned agent |
| `min_probability` | number | query | Filter by minimum probability |
| `page` | integer | query | Page number (default: 1) |
| `limit` | integer | query | Page size (default: 20, max: 100) |

**Response**

```json
{
  "data": [
    {
      "opportunity_id": "opp123456",
      "customer_id": "cust123456",
      "lead_id": "lead123456",
      "product": "savings_account",
      "stage": "proposal",
      "amount": 5000.00,
      "currency": "NGN",
      "probability": 0.75,
      "expected_close_date": "2023-07-15",
      "assigned_to": "agent123",
      "created_at": "2023-06-01T14:30:00Z"
    },
    {
      "opportunity_id": "opp123457",
      "customer_id": "cust123457",
      "lead_id": "lead123457",
      "product": "loan",
      "stage": "qualification",
      "amount": 10000.00,
      "currency": "NGN",
      "probability": 0.50,
      "expected_close_date": "2023-08-01",
      "assigned_to": "agent456",
      "created_at": "2023-06-02T10:15:00Z"
    }
  ],
  "pagination": {
    "total": 35,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

#### Create Opportunity

```
POST /crm/v1/opportunities
```

**Request Body**

```json
{
  "customer_id": "cust123456",
  "lead_id": "lead123456",
  "product": "savings_account",
  "amount": 5000.00,
  "currency": "NGN",
  "expected_close_date": "2023-07-15",
  "notes": "Customer is interested in premium savings account with high interest rate"
}
```

**Response**

```json
{
  "opportunity_id": "opp123456",
  "customer_id": "cust123456",
  "lead_id": "lead123456",
  "product": "savings_account",
  "stage": "prospecting",
  "amount": 5000.00,
  "currency": "NGN",
  "probability": 0.25,
  "expected_close_date": "2023-07-15",
  "assigned_to": "agent123",
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-01T14:30:00Z",
  "notes": "Customer is interested in premium savings account with high interest rate"
}
```

### Interaction Endpoints

#### Get Interaction

```
GET /crm/v1/interactions/{interaction_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `interaction_id` | string | path | Interaction ID |

**Response**

```json
{
  "interaction_id": "int123456",
  "customer_id": "cust123456",
  "lead_id": "lead123456",
  "opportunity_id": "opp123456",
  "type": "call",
  "direction": "outbound",
  "channel": "phone",
  "agent_id": "agent123",
  "duration": 300,
  "status": "completed",
  "notes": "Discussed premium savings account features and benefits",
  "sentiment": "positive",
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-01T14:35:00Z",
  "metadata": {
    "call_recording_url": "https://example.com/recordings/call123456.mp3",
    "call_transcript": "https://example.com/transcripts/call123456.txt"
  }
}
```

#### List Interactions

```
GET /crm/v1/interactions
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `customer_id` | string | query | Filter by customer ID |
| `lead_id` | string | query | Filter by lead ID |
| `opportunity_id` | string | query | Filter by opportunity ID |
| `type` | string | query | Filter by interaction type |
| `channel` | string | query | Filter by interaction channel |
| `agent_id` | string | query | Filter by agent ID |
| `start_date` | string | query | Filter by start date (ISO 8601) |
| `end_date` | string | query | Filter by end date (ISO 8601) |
| `page` | integer | query | Page number (default: 1) |
| `limit` | integer | query | Page size (default: 20, max: 100) |

**Response**

```json
{
  "data": [
    {
      "interaction_id": "int123456",
      "customer_id": "cust123456",
      "lead_id": "lead123456",
      "opportunity_id": "opp123456",
      "type": "call",
      "direction": "outbound",
      "channel": "phone",
      "agent_id": "agent123",
      "duration": 300,
      "status": "completed",
      "sentiment": "positive",
      "created_at": "2023-06-01T14:30:00Z"
    },
    {
      "interaction_id": "int123457",
      "customer_id": "cust123456",
      "lead_id": "lead123456",
      "opportunity_id": "opp123456",
      "type": "email",
      "direction": "outbound",
      "channel": "email",
      "agent_id": "agent123",
      "status": "completed",
      "sentiment": "neutral",
      "created_at": "2023-06-02T10:15:00Z"
    }
  ],
  "pagination": {
    "total": 28,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

#### Create Interaction

```
POST /crm/v1/interactions
```

**Request Body**

```json
{
  "customer_id": "cust123456",
  "lead_id": "lead123456",
  "opportunity_id": "opp123456",
  "type": "call",
  "direction": "outbound",
  "channel": "phone",
  "agent_id": "agent123",
  "duration": 300,
  "notes": "Discussed premium savings account features and benefits",
  "metadata": {
    "call_recording_url": "https://example.com/recordings/call123456.mp3",
    "call_transcript": "https://example.com/transcripts/call123456.txt"
  }
}
```

**Response**

```json
{
  "interaction_id": "int123456",
  "customer_id": "cust123456",
  "lead_id": "lead123456",
  "opportunity_id": "opp123456",
  "type": "call",
  "direction": "outbound",
  "channel": "phone",
  "agent_id": "agent123",
  "duration": 300,
  "status": "completed",
  "notes": "Discussed premium savings account features and benefits",
  "sentiment": "positive",
  "created_at": "2023-06-01T14:30:00Z",
  "updated_at": "2023-06-01T14:30:00Z",
  "metadata": {
    "call_recording_url": "https://example.com/recordings/call123456.mp3",
    "call_transcript": "https://example.com/transcripts/call123456.txt"
  }
}
```

## AI Service API

The AI Service API provides endpoints for advanced AI/ML capabilities, including fraud detection, customer insights, and knowledge graph question answering.

### Fraud Detection Endpoints

#### Detect Fraud

```
POST /ai/v1/fraud/detect
```

**Request Body**

```json
{
  "transaction": {
    "transaction_id": "tx123456",
    "customer_id": "cust123456",
    "account_id": "acc789012",
    "type": "transfer",
    "amount": 1000.00,
    "currency": "NGN",
    "recipient": {
      "name": "Jane Smith",
      "account": "0987654321",
      "bank": "Example Bank"
    }
  },
  "context": {
    "device_info": {
      "ip": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "device_id": "device123"
    },
    "location": {
      "latitude": 6.5244,
      "longitude": 3.3792
    },
    "timestamp": "2023-06-01T14:30:00Z"
  }
}
```

**Response**

```json
{
  "fraud_score": 0.12,
  "risk_level": "low",
  "recommendation": "approve",
  "explanation": [
    {
      "feature": "transaction_amount",
      "importance": 0.25,
      "description": "Transaction amount is within normal range for this customer"
    },
    {
      "feature": "location",
      "importance": 0.35,
      "description": "Transaction location matches customer's usual location"
    },
    {
      "feature": "recipient",
      "importance": 0.20,
      "description": "Recipient has been used before by this customer"
    },
    {
      "feature": "time_of_day",
      "importance": 0.10,
      "description": "Transaction time is consistent with customer's usual activity"
    },
    {
      "feature": "device",
      "importance": 0.10,
      "description": "Device has been used before by this customer"
    }
  ],
  "additional_verification_required": false
}
```

### Customer Insights Endpoints

#### Get Customer Insights

```
GET /ai/v1/insights/customers/{customer_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `customer_id` | string | path | Customer ID |

**Response**

```json
{
  "customer_id": "cust123456",
  "insights": {
    "lifetime_value": {
      "value": 15000.00,
      "currency": "NGN",
      "confidence": 0.85
    },
    "churn_risk": {
      "score": 0.15,
      "level": "low",
      "factors": [
        {
          "factor": "account_activity",
          "importance": 0.40,
          "description": "Regular account activity in the last 30 days"
        },
        {
          "factor": "product_usage",
          "importance": 0.30,
          "description": "Uses multiple banking products"
        },
        {
          "factor": "customer_service",
          "importance": 0.20,
          "description": "Positive interactions with customer service"
        },
        {
          "factor": "demographic",
          "importance": 0.10,
          "description": "Demographic factors indicate low churn risk"
        }
      ]
    },
    "next_best_offer": {
      "product": "investment_account",
      "confidence": 0.78,
      "reasoning": "Customer has maintained high savings balance for 6+ months"
    },
    "segment": {
      "name": "premium",
      "confidence": 0.92,
      "description": "High-value customer with multiple products"
    }
  }
}
```

#### Get Customer Segmentation

```
POST /ai/v1/insights/segmentation
```

**Request Body**

```json
{
  "customers": ["cust123456", "cust123457", "cust123458"],
  "features": ["transaction_history", "product_usage", "demographic", "behavioral"],
  "num_segments": 5
}
```

**Response**

```json
{
  "segments": [
    {
      "segment_id": 1,
      "name": "premium",
      "size": 1,
      "percentage": 33.33,
      "characteristics": [
        {
          "feature": "transaction_volume",
          "value": "high",
          "importance": 0.35
        },
        {
          "feature": "product_count",
          "value": "multiple",
          "importance": 0.30
        },
        {
          "feature": "account_balance",
          "value": "high",
          "importance": 0.25
        },
        {
          "feature": "age",
          "value": "35-50",
          "importance": 0.10
        }
      ],
      "customers": ["cust123456"]
    },
    {
      "segment_id": 2,
      "name": "standard",
      "size": 2,
      "percentage": 66.67,
      "characteristics": [
        {
          "feature": "transaction_volume",
          "value": "medium",
          "importance": 0.35
        },
        {
          "feature": "product_count",
          "value": "single",
          "importance": 0.30
        },
        {
          "feature": "account_balance",
          "value": "medium",
          "importance": 0.25
        },
        {
          "feature": "age",
          "value": "25-35",
          "importance": 0.10
        }
      ],
      "customers": ["cust123457", "cust123458"]
    }
  ]
}
```

### Knowledge Graph Endpoints

#### Query Knowledge Graph

```
POST /ai/v1/knowledge/query
```

**Request Body**

```json
{
  "query": "Which customers in Lagos have both savings and investment accounts?",
  "context": {
    "user_role": "banking_agent",
    "purpose": "customer_analysis"
  }
}
```

**Response**

```json
{
  "answer": "There are 15 customers in Lagos who have both savings and investment accounts.",
  "confidence": 0.92,
  "entities": [
    {
      "type": "customer",
      "count": 15,
      "sample": ["cust123456", "cust123457", "cust123458"]
    }
  ],
  "query_translation": {
    "cypher": "MATCH (c:Customer)-[:HAS_ACCOUNT]->(a1:Account {type: 'savings'}), (c)-[:HAS_ACCOUNT]->(a2:Account {type: 'investment'}) WHERE c.city = 'Lagos' RETURN c",
    "natural_language": "Find customers located in Lagos who have at least one savings account and at least one investment account"
  },
  "execution_time_ms": 120
}
```

#### Get Entity Relationships

```
GET /ai/v1/knowledge/entities/{entity_id}/relationships
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `entity_id` | string | path | Entity ID (e.g., customer ID, account ID) |
| `depth` | integer | query | Relationship depth (default: 1, max: 3) |
| `types` | string | query | Comma-separated list of relationship types to include |

**Response**

```json
{
  "entity": {
    "id": "cust123456",
    "type": "customer",
    "properties": {
      "name": "John Doe",
      "city": "Lagos",
      "segment": "premium"
    }
  },
  "relationships": [
    {
      "type": "HAS_ACCOUNT",
      "direction": "outgoing",
      "target": {
        "id": "acc789012",
        "type": "account",
        "properties": {
          "type": "savings",
          "balance": 5000.00,
          "currency": "NGN"
        }
      },
      "properties": {
        "since": "2022-01-15",
        "primary": true
      }
    },
    {
      "type": "HAS_ACCOUNT",
      "direction": "outgoing",
      "target": {
        "id": "acc789013",
        "type": "account",
        "properties": {
          "type": "investment",
          "balance": 10000.00,
          "currency": "NGN"
        }
      },
      "properties": {
        "since": "2022-03-20",
        "primary": false
      }
    },
    {
      "type": "REFERRED_BY",
      "direction": "incoming",
      "target": {
        "id": "cust123457",
        "type": "customer",
        "properties": {
          "name": "Jane Smith",
          "city": "Lagos",
          "segment": "standard"
        }
      },
      "properties": {
        "date": "2022-02-10",
        "program": "friend_referral"
      }
    }
  ]
}
```

## Event Streaming API

The Event Streaming API provides endpoints for real-time event streaming using Fluvio.

### Topic Endpoints

#### List Topics

```
GET /events/v1/topics
```

**Response**

```json
{
  "topics": [
    {
      "name": "banking.transactions",
      "partitions": 3,
      "replicas": 2,
      "retention_time": 604800,
      "retention_bytes": 1073741824
    },
    {
      "name": "banking.customers",
      "partitions": 3,
      "replicas": 2,
      "retention_time": 604800,
      "retention_bytes": 1073741824
    },
    {
      "name": "crm.leads",
      "partitions": 3,
      "replicas": 2,
      "retention_time": 604800,
      "retention_bytes": 1073741824
    },
    {
      "name": "crm.opportunities",
      "partitions": 3,
      "replicas": 2,
      "retention_time": 604800,
      "retention_bytes": 1073741824
    }
  ]
}
```

#### Create Topic

```
POST /events/v1/topics
```

**Request Body**

```json
{
  "name": "banking.accounts",
  "partitions": 3,
  "replicas": 2,
  "retention_time": 604800,
  "retention_bytes": 1073741824
}
```

**Response**

```json
{
  "name": "banking.accounts",
  "partitions": 3,
  "replicas": 2,
  "retention_time": 604800,
  "retention_bytes": 1073741824,
  "created_at": "2023-06-01T14:30:00Z"
}
```

### Producer Endpoints

#### Produce Event

```
POST /events/v1/topics/{topic}/produce
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `topic` | string | path | Topic name |

**Request Body**

```json
{
  "key": "cust123456",
  "value": {
    "event_type": "customer_updated",
    "customer_id": "cust123456",
    "timestamp": "2023-06-01T14:30:00Z",
    "data": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+2341234567890"
    }
  },
  "headers": {
    "source": "banking_service",
    "version": "1.0"
  }
}
```

**Response**

```json
{
  "topic": "banking.customers",
  "partition": 1,
  "offset": 1234,
  "timestamp": "2023-06-01T14:30:00Z"
}
```

#### Produce Batch Events

```
POST /events/v1/topics/{topic}/produce-batch
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `topic` | string | path | Topic name |

**Request Body**

```json
{
  "events": [
    {
      "key": "cust123456",
      "value": {
        "event_type": "customer_updated",
        "customer_id": "cust123456",
        "timestamp": "2023-06-01T14:30:00Z",
        "data": {
          "first_name": "John",
          "last_name": "Doe",
          "email": "john.doe@example.com",
          "phone": "+2341234567890"
        }
      },
      "headers": {
        "source": "banking_service",
        "version": "1.0"
      }
    },
    {
      "key": "cust123457",
      "value": {
        "event_type": "customer_updated",
        "customer_id": "cust123457",
        "timestamp": "2023-06-01T14:35:00Z",
        "data": {
          "first_name": "Jane",
          "last_name": "Smith",
          "email": "jane.smith@example.com",
          "phone": "+2341234567891"
        }
      },
      "headers": {
        "source": "banking_service",
        "version": "1.0"
      }
    }
  ]
}
```

**Response**

```json
{
  "topic": "banking.customers",
  "results": [
    {
      "partition": 1,
      "offset": 1234,
      "timestamp": "2023-06-01T14:30:00Z"
    },
    {
      "partition": 2,
      "offset": 5678,
      "timestamp": "2023-06-01T14:35:00Z"
    }
  ]
}
```

### Consumer Endpoints

#### Consume Events

```
GET /events/v1/topics/{topic}/consume
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `topic` | string | path | Topic name |
| `partition` | integer | query | Partition to consume from (default: 0) |
| `offset` | integer | query | Offset to start consuming from (default: -1 for latest) |
| `limit` | integer | query | Maximum number of events to consume (default: 100, max: 1000) |

**Response**

```json
{
  "topic": "banking.customers",
  "partition": 1,
  "events": [
    {
      "offset": 1234,
      "key": "cust123456",
      "value": {
        "event_type": "customer_updated",
        "customer_id": "cust123456",
        "timestamp": "2023-06-01T14:30:00Z",
        "data": {
          "first_name": "John",
          "last_name": "Doe",
          "email": "john.doe@example.com",
          "phone": "+2341234567890"
        }
      },
      "headers": {
        "source": "banking_service",
        "version": "1.0"
      },
      "timestamp": "2023-06-01T14:30:00Z"
    },
    {
      "offset": 1235,
      "key": "cust123457",
      "value": {
        "event_type": "customer_updated",
        "customer_id": "cust123457",
        "timestamp": "2023-06-01T14:35:00Z",
        "data": {
          "first_name": "Jane",
          "last_name": "Smith",
          "email": "jane.smith@example.com",
          "phone": "+2341234567891"
        }
      },
      "headers": {
        "source": "banking_service",
        "version": "1.0"
      },
      "timestamp": "2023-06-01T14:35:00Z"
    }
  ],
  "next_offset": 1236
}
```

## Workflow API

The Workflow API provides endpoints for workflow orchestration using Temporal.

### Workflow Endpoints

#### List Workflows

```
GET /workflows/v1/workflows
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `type` | string | query | Filter by workflow type |
| `status` | string | query | Filter by workflow status |
| `page` | integer | query | Page number (default: 1) |
| `limit` | integer | query | Page size (default: 20, max: 100) |

**Response**

```json
{
  "workflows": [
    {
      "workflow_id": "wf123456",
      "type": "customer_onboarding",
      "status": "running",
      "start_time": "2023-06-01T14:30:00Z",
      "execution_time": 300,
      "progress": 0.5,
      "current_step": "kyc_verification"
    },
    {
      "workflow_id": "wf123457",
      "type": "loan_application",
      "status": "completed",
      "start_time": "2023-06-01T10:15:00Z",
      "end_time": "2023-06-01T10:30:00Z",
      "execution_time": 900,
      "progress": 1.0,
      "current_step": null
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

#### Get Workflow

```
GET /workflows/v1/workflows/{workflow_id}
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `workflow_id` | string | path | Workflow ID |

**Response**

```json
{
  "workflow_id": "wf123456",
  "type": "customer_onboarding",
  "status": "running",
  "start_time": "2023-06-01T14:30:00Z",
  "execution_time": 300,
  "progress": 0.5,
  "current_step": "kyc_verification",
  "steps": [
    {
      "name": "account_creation",
      "status": "completed",
      "start_time": "2023-06-01T14:30:00Z",
      "end_time": "2023-06-01T14:31:00Z",
      "execution_time": 60
    },
    {
      "name": "kyc_verification",
      "status": "running",
      "start_time": "2023-06-01T14:31:00Z",
      "execution_time": 240
    },
    {
      "name": "card_issuance",
      "status": "pending",
      "start_time": null,
      "execution_time": 0
    }
  ],
  "input": {
    "customer_id": "cust123456",
    "account_type": "savings",
    "kyc_level": "full"
  },
  "output": {
    "account_id": "acc789012"
  }
}
```

#### Start Workflow

```
POST /workflows/v1/workflows
```

**Request Body**

```json
{
  "type": "customer_onboarding",
  "workflow_id": "wf123456",
  "input": {
    "customer_id": "cust123456",
    "account_type": "savings",
    "kyc_level": "full"
  },
  "options": {
    "task_queue": "customer_onboarding",
    "execution_timeout": 3600,
    "retry_policy": {
      "initial_interval": 1,
      "maximum_interval": 100,
      "backoff_coefficient": 2.0,
      "maximum_attempts": 5
    }
  }
}
```

**Response**

```json
{
  "workflow_id": "wf123456",
  "run_id": "run789012",
  "type": "customer_onboarding",
  "status": "running",
  "start_time": "2023-06-01T14:30:00Z"
}
```

#### Signal Workflow

```
POST /workflows/v1/workflows/{workflow_id}/signal
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `workflow_id` | string | path | Workflow ID |

**Request Body**

```json
{
  "signal_name": "update_kyc_status",
  "input": {
    "kyc_status": "verified",
    "verification_id": "ver123456"
  }
}
```

**Response**

```json
{
  "workflow_id": "wf123456",
  "signal_name": "update_kyc_status",
  "timestamp": "2023-06-01T14:35:00Z"
}
```

#### Query Workflow

```
POST /workflows/v1/workflows/{workflow_id}/query
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `workflow_id` | string | path | Workflow ID |

**Request Body**

```json
{
  "query_name": "get_kyc_status"
}
```

**Response**

```json
{
  "workflow_id": "wf123456",
  "query_name": "get_kyc_status",
  "result": {
    "status": "verified",
    "verification_id": "ver123456",
    "verification_time": "2023-06-01T14:35:00Z"
  }
}
```

#### Cancel Workflow

```
POST /workflows/v1/workflows/{workflow_id}/cancel
```

**Parameters**

| Name | Type | In | Description |
|------|------|-------|------------|
| `workflow_id` | string | path | Workflow ID |

**Request Body**

```json
{
  "reason": "Customer requested cancellation"
}
```

**Response**

```json
{
  "workflow_id": "wf123456",
  "status": "cancelled",
  "cancel_time": "2023-06-01T14:40:00Z"
}
```

## Error Handling

The Banking-CRM Integration System uses standard HTTP status codes and a consistent error response format.

### Error Response Format

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0"
      }
    ],
    "request_id": "req123456",
    "timestamp": "2023-06-01T14:30:00Z"
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `invalid_request` | Invalid request parameters |
| 401 | `unauthorized` | Authentication required |
| 403 | `forbidden` | Insufficient permissions |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource conflict |
| 422 | `validation_error` | Validation error |
| 429 | `rate_limit_exceeded` | Rate limit exceeded |
| 500 | `internal_error` | Internal server error |
| 503 | `service_unavailable` | Service unavailable |

## Rate Limiting

The Banking-CRM Integration System implements rate limiting to protect the API from abuse. Rate limits are applied per client and per endpoint.

### Rate Limit Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum number of requests allowed in the current time window |
| `X-RateLimit-Remaining` | Number of requests remaining in the current time window |
| `X-RateLimit-Reset` | Time when the current rate limit window resets (Unix timestamp) |

### Rate Limit Response

When a rate limit is exceeded, the API returns a 429 Too Many Requests response:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset": 1622557800
    },
    "request_id": "req123456",
    "timestamp": "2023-06-01T14:30:00Z"
  }
}
```

## Versioning

The Banking-CRM Integration System uses semantic versioning for the API. The version is included in the URL path.

### Version Format

```
/api/{service}/v{major_version}/{resource}
```

Example:

```
/banking/v1/customers
```

### Version Compatibility

- **Major Version**: Breaking changes that are not backward compatible
- **Minor Version**: New features that are backward compatible
- **Patch Version**: Bug fixes that are backward compatible

The API supports the current major version and one previous major version. When a new major version is released, the previous version is deprecated and will be supported for 6 months before being removed.


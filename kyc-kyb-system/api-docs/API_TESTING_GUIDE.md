# KYC/KYB API Testing Guide

## Overview

This guide provides comprehensive instructions for testing all 27 API endpoints across the three KYC/KYB microservices.

## Prerequisites

- Docker Compose or Kubernetes deployment running
- Postman installed (or curl for command-line testing)
- Test images and videos for liveness detection

## Quick Start

### 1. Import Postman Collection

```bash
# Import the collection file
File > Import > KYC-KYB-API-Collection.json
```

### 2. Set Collection Variables

Go to Collection > Variables and set:
- `base_url`: http://localhost
- `keycloak_url`: http://localhost:8080
- `realm`: kyc-kyb-system
- `username`: kyc_analyst
- `password`: kyc123
- `client_id`: liveness-service

### 3. Get Authentication Token

Run the "Get Auth Token (KYC Analyst)" request in the Authentication folder. The token will be automatically saved to the `access_token` variable.

## Testing Each Service

### Liveness Detection Service (9 endpoints)

#### 1. Health Check
```bash
curl http://localhost:8002/health
```

Expected: `{"status": "healthy"}`

#### 2. Passive Liveness Check
```bash
curl -X POST http://localhost:8002/api/v1/liveness/check \
  -H "Authorization: Bearer $TOKEN" \
  -F "customer_id=CUST-001" \
  -F "liveness_type=passive" \
  -F "file=@selfie.jpg"
```

Expected Response:
```json
{
  "check_id": "LC-20260129-001",
  "customer_id": "CUST-001",
  "liveness_type": "passive",
  "is_live": true,
  "confidence_score": 0.95,
  "status": "approved"
}
```

#### 3. Active Liveness Check
```bash
curl -X POST http://localhost:8002/api/v1/liveness/check \
  -H "Authorization: Bearer $TOKEN" \
  -F "customer_id=CUST-002" \
  -F "liveness_type=active" \
  -F "file=@video.mp4"
```

#### 4. Liveness with Face Matching
```bash
curl -X POST http://localhost:8002/api/v1/liveness/check \
  -H "Authorization: Bearer $TOKEN" \
  -F "customer_id=CUST-003" \
  -F "liveness_type=passive" \
  -F "file=@selfie.jpg" \
  -F "reference_image=@id_photo.jpg"
```

#### 5. Get Liveness Check Result
```bash
curl http://localhost:8002/api/v1/liveness/check/LC-20260129-001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Get Customer Liveness Checks
```bash
curl "http://localhost:8002/api/v1/liveness/customer/CUST-001?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

### AML Screening Service (12 endpoints)

#### 1. Health Check
```bash
curl http://localhost:8003/health
```

#### 2. Sanctions Screening - Individual
```bash
curl -X POST http://localhost:8003/api/v1/aml/sanctions/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-001",
    "entity_type": "individual",
    "full_name": "John Smith",
    "date_of_birth": "1980-05-15",
    "nationality": "NG"
  }'
```

Expected Response:
```json
{
  "screening_id": "SS-20260129-001",
  "customer_id": "CUST-001",
  "matches_found": false,
  "total_matches": 0,
  "risk_level": "low"
}
```

#### 3. Sanctions Screening - Entity
```bash
curl -X POST http://localhost:8003/api/v1/aml/sanctions/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CORP-001",
    "entity_type": "entity",
    "full_name": "Acme Corporation Ltd",
    "registration_number": "RC123456",
    "country": "NG"
  }'
```

#### 4. PEP Check
```bash
curl -X POST http://localhost:8003/api/v1/aml/pep/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-003",
    "full_name": "Maria Santos",
    "date_of_birth": "1970-08-25",
    "nationality": "NG",
    "position": "CEO"
  }'
```

Expected Response:
```json
{
  "check_id": "PEP-20260129-001",
  "customer_id": "CUST-003",
  "is_pep": false,
  "risk_level": "low"
}
```

#### 5. Adverse Media Check - Basic
```bash
curl -X POST http://localhost:8003/api/v1/aml/adverse-media/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-004",
    "entity_type": "individual",
    "full_name": "David Johnson",
    "search_depth": "basic"
  }'
```

#### 6. Adverse Media Check - Comprehensive
```bash
curl -X POST http://localhost:8003/api/v1/aml/adverse-media/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-005",
    "entity_type": "individual",
    "full_name": "Sarah Williams",
    "search_depth": "comprehensive"
  }'
```

#### 7. Comprehensive AML Screening
```bash
curl -X POST http://localhost:8003/api/v1/aml/comprehensive/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-006",
    "entity_type": "individual",
    "full_name": "Michael Brown",
    "date_of_birth": "1985-03-10",
    "nationality": "NG",
    "include_sanctions": true,
    "include_pep": true,
    "include_adverse_media": true
  }'
```

Expected Response:
```json
{
  "screening_id": "CS-20260129-001",
  "customer_id": "CUST-006",
  "sanctions": {"matches_found": false, "risk_level": "low"},
  "pep": {"is_pep": false, "risk_level": "low"},
  "adverse_media": {"mentions_found": false, "risk_level": "low"},
  "overall_risk_level": "low",
  "status": "approved"
}
```

#### 8. Get Screening Result
```bash
curl http://localhost:8003/api/v1/aml/screening/CS-20260129-001 \
  -H "Authorization: Bearer $TOKEN"
```

### Risk Scoring Service (6 endpoints)

#### 1. Health Check
```bash
curl http://localhost:8004/health
```

#### 2. Calculate Risk Score - Low Risk
```bash
curl -X POST http://localhost:8004/api/v1/risk/score \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-001",
    "identity_data": {
      "verification_status": "verified",
      "document_authenticity": 0.95,
      "liveness_score": 0.92,
      "face_match_score": 0.91
    },
    "aml_data": {
      "sanctions_match": false,
      "is_pep": false,
      "adverse_media_found": false
    },
    "behavioral_data": {
      "account_age_days": 180,
      "transaction_count": 45,
      "average_transaction_amount": 50000,
      "failed_login_attempts": 1
    },
    "geographic_data": {
      "country": "NG",
      "region": "Lagos",
      "ip_country": "NG",
      "vpn_detected": false
    },
    "transaction_data": {
      "amount": 100000,
      "currency": "NGN",
      "transaction_type": "policy_purchase",
      "payment_method": "bank_transfer"
    }
  }'
```

Expected Response:
```json
{
  "score_id": "RS-20260129-001",
  "customer_id": "CUST-001",
  "overall_score": 25,
  "risk_level": "low",
  "status": "approved"
}
```

#### 3. Calculate Risk Score - High Risk
```bash
curl -X POST http://localhost:8004/api/v1/risk/score \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-002",
    "identity_data": {
      "verification_status": "pending",
      "document_authenticity": 0.65,
      "liveness_score": 0.70,
      "face_match_score": 0.68
    },
    "aml_data": {
      "sanctions_match": false,
      "is_pep": true,
      "adverse_media_found": true
    },
    "behavioral_data": {
      "account_age_days": 10,
      "transaction_count": 2,
      "average_transaction_amount": 500000,
      "failed_login_attempts": 5
    },
    "geographic_data": {
      "country": "NG",
      "region": "Unknown",
      "ip_country": "US",
      "vpn_detected": true
    },
    "transaction_data": {
      "amount": 5000000,
      "currency": "NGN",
      "transaction_type": "policy_purchase",
      "payment_method": "crypto"
    }
  }'
```

Expected Response:
```json
{
  "score_id": "RS-20260129-002",
  "customer_id": "CUST-002",
  "overall_score": 75,
  "risk_level": "high",
  "status": "review_required"
}
```

#### 4. Get Risk Score
```bash
curl http://localhost:8004/api/v1/risk/score/RS-20260129-001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Get Customer Risk Scores
```bash
curl "http://localhost:8004/api/v1/risk/customer/CUST-001?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Comprehensive Risk Assessment
```bash
curl -X POST http://localhost:8004/api/v1/risk/assess \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-003",
    "include_identity": true,
    "include_document": true,
    "include_aml": true,
    "include_behavioral": true,
    "include_geographic": true,
    "include_transaction": true
  }'
```

Expected Response:
```json
{
  "assessment_id": "RA-20260129-001",
  "customer_id": "CUST-003",
  "overall_risk_score": 30,
  "overall_risk_level": "low",
  "status": "approved"
}
```

## Test Scenarios

### Scenario 1: Complete KYC Flow for Low-Risk Customer

1. **Liveness Check**: Perform passive liveness check
2. **AML Screening**: Run comprehensive screening
3. **Risk Scoring**: Calculate overall risk score

Expected: All checks pass, customer approved

### Scenario 2: High-Risk Customer Detection

1. **Liveness Check**: Pass
2. **AML Screening**: PEP detected + adverse media found
3. **Risk Scoring**: High risk score (75+)

Expected: Status = "review_required"

### Scenario 3: Spoofing Attack Detection

1. **Liveness Check**: Submit photo of a photo
2. Expected: `is_live: false`, `is_photo: true`, status = "rejected"

### Scenario 4: Sanctions Match

1. **AML Screening**: Screen name on sanctions list
2. Expected: `matches_found: true`, `risk_level: critical`

## Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 401 | Unauthorized | Get new auth token |
| 403 | Forbidden | Check user role permissions |
| 400 | Bad Request | Validate request payload |
| 404 | Not Found | Check resource ID |
| 500 | Internal Server Error | Check service logs |

## Performance Benchmarks

| Endpoint | Expected Latency (p95) |
|----------|------------------------|
| Liveness Check | < 2000ms |
| Sanctions Screening | < 500ms |
| PEP Check | < 300ms |
| Adverse Media Check | < 1000ms |
| Risk Scoring | < 200ms |

## Troubleshooting

### Token Expired
```bash
# Get new token
curl -X POST "http://localhost:8080/realms/kyc-kyb-system/protocol/openid-connect/token" \
  -d "username=kyc_analyst" \
  -d "password=kyc123" \
  -d "grant_type=password" \
  -d "client_id=liveness-service"
```

### Service Unavailable
```bash
# Check service health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

### Permission Denied
Use the appropriate user for each service:
- **Liveness**: kyc_analyst, kyc_operator
- **AML**: compliance_officer
- **Risk**: risk_manager

## Test Data

### Test Users
| Username | Password | Role | Use For |
|----------|----------|------|---------|
| kyc_analyst | kyc123 | kyc_analyst | Liveness checks |
| compliance | compliance123 | compliance_officer | AML screening |
| risk_manager | risk123 | risk_manager | Risk scoring |
| admin | admin123 | system_administrator | All services |

### Test Customer IDs
- `CUST-001` to `CUST-010`: Individual customers
- `CORP-001` to `CORP-005`: Corporate entities

## Automated Testing

### Run All Tests with Postman CLI
```bash
newman run KYC-KYB-API-Collection.json \
  --environment production.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

### CI/CD Integration
```yaml
# .github/workflows/api-tests.yml
name: API Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run API Tests
        run: newman run api-docs/postman/KYC-KYB-API-Collection.json
```

## Support

For issues or questions:
- Check service logs: `docker-compose logs <service-name>`
- Review OpenAPI specs in `api-docs/openapi/`
- Contact: support@insurance.com

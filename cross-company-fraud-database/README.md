# Cross-Company Fraud Database

Centralized fraud database shared across Nigerian insurance companies to detect customers filing fraudulent claims with multiple insurers.

## Business Requirement

**BR-FRAUD-004: Cross-Company Fraud Database**
- Shared database across insurance companies
- Detect repeat offenders across multiple insurers
- Real-time fraud alerts
- Industry-wide blacklist
- Fraud analytics and reporting

## Features

- **Fraud Reporting**: Companies can report suspected/confirmed fraud cases
- **Fraud Checking**: Real-time check if customer has fraud history across companies
- **Blacklist Management**: Industry-wide blacklist of confirmed fraudsters
- **Real-time Alerts**: Automatic alerts when repeat offenders are detected
- **Analytics Dashboard**: Industry and company-specific fraud statistics
- **API-First Design**: RESTful API with authentication

## API Endpoints

### Fraud Records
- `POST /api/v1/fraud/report` - Report new fraud case
- `GET /api/v1/fraud/check` - Check customer fraud history
- `GET /api/v1/fraud/records` - List fraud records (with filters)
- `GET /api/v1/fraud/records/{id}` - Get specific fraud record
- `PATCH /api/v1/fraud/records/{id}` - Update fraud record
- `GET /api/v1/fraud/blacklist` - Get blacklisted customers
- `POST /api/v1/fraud/blacklist/{id}` - Add customer to blacklist

### Companies
- `GET /api/v1/companies/list` - List participating companies
- `GET /api/v1/companies/{company_id}` - Get company details

### Analytics
- `GET /api/v1/analytics/industry` - Industry-wide fraud statistics
- `GET /api/v1/analytics/company/{company_id}` - Company-specific statistics

## Data Model

### Fraud Record
- Customer identification (NIN, name, phone, email)
- Reporting company details
- Fraud type and category
- Severity (LOW, MEDIUM, HIGH, CRITICAL)
- Status (SUSPECTED, CONFIRMED, DISMISSED, UNDER_INVESTIGATION)
- Financial impact (claimed amount, actual loss)
- Related policy/claim numbers
- Evidence and investigation notes
- Cross-company tracking
- Risk score (0-100)

### Fraud Severity Levels
- **LOW**: Minor discrepancies, first-time offense
- **MEDIUM**: Suspicious patterns, requires investigation
- **HIGH**: Strong evidence of fraud, significant financial impact
- **CRITICAL**: Confirmed fraud, repeat offender, blacklisted

## Usage Example

```python
import httpx

API_KEY = "YOUR_COMPANY_API_KEY"
headers = {"X-API-Key": API_KEY}

# Report fraud
response = httpx.post(
    "http://localhost:8011/api/v1/fraud/report",
    headers=headers,
    json={
        "customer_nin": "12345678901",
        "customer_name": "John Doe",
        "customer_phone": "08012345678",
        "reporting_company_id": "COMPANY_A",
        "reporting_company_name": "Company A Insurance",
        "fraud_type": "Multiple Claims",
        "fraud_category": "Claim",
        "severity": "HIGH",
        "claimed_amount": 500000.0,
        "description": "Customer filed identical claims with multiple companies",
        "claim_number": "CLM-2026-001"
    }
)

# Check customer fraud history
response = httpx.get(
    "http://localhost:8011/api/v1/fraud/check",
    headers=headers,
    params={"customer_nin": "12345678901"}
)

fraud_check = response.json()
if fraud_check["is_flagged"]:
    print(f"WARNING: Customer has {fraud_check['fraud_count']} fraud records")
    print(f"Risk Level: {fraud_check['risk_level']}")
    print(f"Blacklisted: {fraud_check['blacklisted']}")
```

## Integration with Insurance Platform

```python
# In claim-service, before processing claim
from httpx import AsyncClient

async def check_fraud_before_claim(customer_nin: str, customer_phone: str):
    async with AsyncClient() as client:
        response = await client.get(
            "http://cross-company-fraud-database:8011/api/v1/fraud/check",
            headers={"X-API-Key": os.getenv("FRAUD_DB_API_KEY")},
            params={
                "customer_nin": customer_nin,
                "customer_phone": customer_phone
            }
        )
        fraud_check = response.json()
        
        if fraud_check["blacklisted"]:
            raise Exception("Customer is blacklisted - claim rejected")
        
        if fraud_check["risk_level"] in ["HIGH", "CRITICAL"]:
            # Flag for manual review
            return {"auto_approve": False, "reason": "High fraud risk"}
        
        return {"auto_approve": True}
```

## Security

- **API Key Authentication**: Each company has unique API key
- **Data Privacy**: Companies can only see aggregated data, not competitor details
- **Audit Trail**: All access and modifications are logged
- **Encryption**: Data encrypted in transit (TLS) and at rest

## Running the Service

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python -m app.main

# Or with Docker
docker build -t cross-company-fraud-database .
docker run -p 8011:8011 cross-company-fraud-database
```

## Production Deployment

1. Use PostgreSQL instead of SQLite
2. Configure real API keys for each company
3. Set up monitoring and alerting
4. Enable rate limiting
5. Configure backup and disaster recovery
6. Implement audit logging
7. Set up HTTPS/TLS

## Governance

- Managed by NAICOM (Nigerian insurance regulator)
- All licensed insurance companies can participate
- Data retention: 10 years
- Regular audits and compliance checks
- Industry steering committee for policy decisions

## Benefits

- **Fraud Detection**: Identify repeat offenders across companies
- **Cost Savings**: Reduce fraud losses industry-wide
- **Risk Assessment**: Better underwriting with fraud history
- **Collaboration**: Industry-wide cooperation against fraud
- **Compliance**: Meet regulatory requirements for fraud prevention

# AML Screening Python SDK

Official Python client library for the AML Screening Service API.

## Features

- ✅ **Complete API Coverage** - All 12 AML Screening endpoints
- ✅ **OAuth2 Authentication** - Keycloak integration with automatic token management
- ✅ **Type Safety** - Full Pydantic models with type hints
- ✅ **Error Handling** - Comprehensive exception hierarchy
- ✅ **Retry Logic** - Automatic retry for failed requests
- ✅ **Context Manager** - Clean resource management
- ✅ **Comprehensive Screening** - Sanctions + PEP + Adverse Media in one call

## Installation

```bash
pip install aml-screening-client
```

Or install from source:

```bash
git clone https://github.com/insurance/aml-screening-python-sdk.git
cd aml-screening-python-sdk
pip install -e .
```

## Quick Start

```python
from aml_client import AMLScreeningClient, EntityType

# Initialize client
client = AMLScreeningClient(
    base_url="http://localhost:8003",
    keycloak_url="http://localhost:8080",
    realm="kyc-kyb-system",
    client_id="aml-screening-service",
    username="compliance_officer",
    password="compliance123",
)

# Perform comprehensive AML screening
result = client.comprehensive_screening(
    customer_id="CUST-001",
    entity_type=EntityType.INDIVIDUAL,
    name="John Doe",
    date_of_birth="1980-01-15",
    nationality="Nigerian",
)

print(f"Risk Level: {result.overall_risk_level}")
print(f"Risk Score: {result.risk_score}/100")
print(f"Recommendation: {result.recommendation}")

# Clean up
client.close()
```

## Usage Examples

### 1. Sanctions Screening

```python
from aml_client import AMLScreeningClient

with AMLScreeningClient(...) as client:
    # Screen individual
    result = client.screen_sanctions_individual(
        name="John Doe",
        date_of_birth="1980-01-15",
        nationality="Nigerian",
    )
    
    if result.matches_found:
        print(f"⚠️  Sanctions matches: {result.total_matches}")
        for match in result.matches:
            print(f"  - {match.list_name}: {match.match_name}")
```

### 2. PEP (Politically Exposed Person) Check

```python
result = client.check_pep(
    name="Jane Smith",
    nationality="Nigerian",
    position="Minister of Finance",
)

if result.is_pep:
    print(f"⚠️  Individual is a PEP (Level: {result.pep_level})")
```

### 3. Adverse Media Check

```python
result = client.check_adverse_media_individual(
    name="Ahmed Hassan",
    comprehensive=True,  # Deep search
)

if result.mentions_found:
    print(f"⚠️  Adverse media mentions: {result.total_mentions}")
```

### 4. Comprehensive AML Screening (Recommended)

```python
result = client.comprehensive_screening(
    customer_id="CUST-001",
    entity_type=EntityType.INDIVIDUAL,
    name="Fatima Abdul",
    date_of_birth="1985-09-15",
    nationality="Nigerian",
)

# All-in-one results
print(f"Sanctions: {result.sanctions_matches} matches")
print(f"PEP: {result.is_pep}")
print(f"Adverse Media: {result.adverse_media_mentions} mentions")
print(f"Overall Risk: {result.overall_risk_level}")
```

### 5. Retrieve Screening by ID

```python
screening = client.get_screening("SCREEN-12345")
print(f"Status: {screening.status}")
```

### 6. Get Customer History

```python
history = client.get_customer_screenings(
    customer_id="CUST-001",
    limit=10,
)

for screening in history.screenings:
    print(f"{screening.screened_at}: {screening.overall_risk_level}")
```

## API Reference

### AMLScreeningClient

Main client class for interacting with the AML Screening Service.

#### Constructor

```python
AMLScreeningClient(
    base_url: str,
    keycloak_url: str,
    realm: str,
    client_id: str,
    username: Optional[str] = None,
    password: Optional[str] = None,
    client_secret: Optional[str] = None,
    timeout: int = 30,
    max_retries: int = 3,
)
```

#### Methods

##### screen_sanctions_individual()

```python
screen_sanctions_individual(
    name: str,
    date_of_birth: Optional[str] = None,
    nationality: Optional[str] = None,
    country: Optional[str] = None,
    identification_number: Optional[str] = None,
) -> SanctionsScreeningResponse
```

Screen individual against sanctions lists (UN, OFAC, EU, UK).

##### screen_sanctions_entity()

```python
screen_sanctions_entity(
    name: str,
    country: Optional[str] = None,
    identification_number: Optional[str] = None,
) -> SanctionsScreeningResponse
```

Screen entity/organization against sanctions lists.

##### check_pep()

```python
check_pep(
    name: str,
    date_of_birth: Optional[str] = None,
    nationality: Optional[str] = None,
    position: Optional[str] = None,
) -> PEPCheckResponse
```

Check if individual is a Politically Exposed Person (PEP).

##### check_adverse_media_individual()

```python
check_adverse_media_individual(
    name: str,
    date_of_birth: Optional[str] = None,
    country: Optional[str] = None,
    comprehensive: bool = False,
) -> AdverseMediaCheckResponse
```

Check individual for adverse media mentions.

##### check_adverse_media_entity()

```python
check_adverse_media_entity(
    name: str,
    country: Optional[str] = None,
    comprehensive: bool = False,
) -> AdverseMediaCheckResponse
```

Check entity for adverse media mentions.

##### comprehensive_screening()

```python
comprehensive_screening(
    customer_id: str,
    entity_type: EntityType,
    name: str,
    date_of_birth: Optional[str] = None,
    nationality: Optional[str] = None,
    country: Optional[str] = None,
    identification_number: Optional[str] = None,
) -> ComprehensiveScreeningResponse
```

Perform comprehensive AML screening (sanctions + PEP + adverse media).

##### get_screening()

```python
get_screening(screening_id: str) -> ComprehensiveScreeningResponse
```

Get screening result by ID.

##### get_customer_screenings()

```python
get_customer_screenings(
    customer_id: str,
    limit: int = 10,
    offset: int = 0,
) -> ScreeningListResponse
```

Get all screenings for a customer.

##### health_check()

```python
health_check() -> HealthCheckResponse
```

Check service health status.

## Models

### ComprehensiveScreeningResponse

```python
class ComprehensiveScreeningResponse(BaseModel):
    screening_id: str
    customer_id: str
    entity_type: str
    name: str
    
    # Sanctions screening
    sanctions_matches: int
    sanctions_risk: RiskLevel
    
    # PEP check
    is_pep: bool
    pep_level: Optional[PEPLevel]
    pep_risk: RiskLevel
    
    # Adverse media
    adverse_media_mentions: int
    adverse_media_risk: RiskLevel
    
    # Overall assessment
    overall_risk_level: RiskLevel
    risk_score: float  # 0-100
    recommendation: str  # "approve", "review", "reject"
    status: ScreeningStatus
```

### RiskLevel

```python
class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
```

### PEPLevel

```python
class PEPLevel(str, Enum):
    NOT_PEP = "not_pep"
    PEP_LEVEL_1 = "pep_level_1"  # Direct PEP
    PEP_LEVEL_2 = "pep_level_2"  # Family member
    PEP_LEVEL_3 = "pep_level_3"  # Close associate
```

## Exceptions

```python
from aml_client import (
    AMLScreeningError,      # Base exception
    APIError,               # API request error
    ValidationError,        # Request validation error
    NotFoundError,          # Resource not found
    UnauthorizedError,      # Authentication error
    ForbiddenError,         # Authorization error
    RateLimitError,         # Rate limit exceeded
    ServerError,            # Server error (5xx)
    TimeoutError,           # Request timeout
    ConnectionError,        # Connection error
)
```

## Error Handling

```python
from aml_client import (
    AMLScreeningClient,
    ValidationError,
    APIError,
)

try:
    result = client.comprehensive_screening(
        customer_id="CUST-001",
        entity_type=EntityType.INDIVIDUAL,
        name="John Doe",
    )
except ValidationError as e:
    print(f"Validation error: {e.message}")
except APIError as e:
    print(f"API error: {e.message}")
```

## Configuration

### Environment Variables

```bash
export AML_BASE_URL="http://localhost:8003"
export KEYCLOAK_URL="http://localhost:8080"
export KEYCLOAK_REALM="kyc-kyb-system"
export KEYCLOAK_CLIENT_ID="aml-screening-service"
export KEYCLOAK_USERNAME="compliance_officer"
export KEYCLOAK_PASSWORD="compliance123"
```

## Examples

Complete examples are available in the `examples/` directory:

- `sanctions_screening.py` - Sanctions list screening
- `pep_check.py` - PEP (Politically Exposed Person) check
- `adverse_media_check.py` - Adverse media monitoring
- `comprehensive_screening.py` - All-in-one AML screening
- `batch_screening.py` - Batch processing multiple customers

Run an example:

```bash
cd examples
python comprehensive_screening.py
```

## Requirements

- Python 3.8+
- requests >= 2.28.0
- python-jose[cryptography] >= 3.3.0
- pydantic >= 2.0.0
- python-dateutil >= 2.8.2

## License

MIT License

## Support

For issues and questions:
- GitHub Issues: https://github.com/insurance/aml-screening-python-sdk/issues
- Email: support@insurance.com

## Changelog

### 1.0.0 (2026-01-29)
- Initial release
- Complete API coverage for all 12 endpoints
- OAuth2 authentication with Keycloak
- Comprehensive error handling
- Full type safety with Pydantic
- Context manager support
- Automatic retry logic
- Sanctions screening (UN, OFAC, EU, UK)
- PEP (Politically Exposed Person) checks
- Adverse media monitoring
- Comprehensive AML screening

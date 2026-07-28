# Liveness Detection Python SDK

Official Python client library for the Liveness Detection Service API.

## Features

- ✅ **Complete API Coverage** - All 9 Liveness Detection endpoints
- ✅ **OAuth2 Authentication** - Keycloak integration with automatic token management
- ✅ **Type Safety** - Full Pydantic models with type hints
- ✅ **Error Handling** - Comprehensive exception hierarchy
- ✅ **Retry Logic** - Automatic retry for failed requests
- ✅ **Context Manager** - Clean resource management
- ✅ **File Upload** - Support for file paths and file objects
- ✅ **Async Support** - (Coming soon)

## Installation

```bash
pip install liveness-detection-client
```

Or install from source:

```bash
git clone https://github.com/insurance/liveness-detection-python-sdk.git
cd liveness-detection-python-sdk
pip install -e .
```

## Quick Start

```python
from liveness_client import LivenessDetectionClient

# Initialize client
client = LivenessDetectionClient(
    base_url="http://localhost:8002",
    keycloak_url="http://localhost:8080",
    realm="kyc-kyb-system",
    client_id="liveness-service",
    username="kyc_analyst",
    password="kyc123",
)

# Perform passive liveness check
result = client.perform_passive_liveness_check(
    customer_id="CUST-001",
    image_file="selfie.jpg",
)

print(f"Is Live: {result.is_live}")
print(f"Confidence: {result.confidence_score:.2%}")
print(f"Status: {result.status}")

# Clean up
client.close()
```

## Usage Examples

### 1. Passive Liveness Detection

```python
from liveness_client import LivenessDetectionClient

with LivenessDetectionClient(...) as client:
    result = client.perform_passive_liveness_check(
        customer_id="CUST-001",
        image_file="selfie.jpg",
    )
    
    if result.is_live and result.status == "approved":
        print("✓ Liveness check passed!")
    else:
        print("✗ Liveness check failed")
```

### 2. Passive Liveness with Face Matching

```python
result = client.perform_passive_liveness_check(
    customer_id="CUST-002",
    image_file="selfie.jpg",
    reference_image="id_card_photo.jpg",  # Photo from ID card
)

if result.face_matching and result.face_matching.match_found:
    print(f"Face match: {result.face_matching.similarity_score:.2%}")
```

### 3. Active Liveness Detection

```python
result = client.perform_active_liveness_check(
    customer_id="CUST-003",
    video_file="liveness_video.mp4",
)

print(f"Active liveness: {result.is_live}")
```

### 4. Retrieve Check by ID

```python
check = client.get_liveness_check("CHECK-12345")
print(f"Status: {check.status}")
print(f"Confidence: {check.confidence_score:.2%}")
```

### 5. Get Customer History

```python
history = client.get_customer_liveness_checks(
    customer_id="CUST-001",
    limit=10,
    offset=0,
)

print(f"Total checks: {history.total}")
for check in history.checks:
    print(f"- {check.checked_at}: {check.status}")
```

### 6. Health Check

```python
health = client.health_check()
print(f"Service status: {health.status}")
```

## API Reference

### LivenessDetectionClient

Main client class for interacting with the Liveness Detection Service.

#### Constructor

```python
LivenessDetectionClient(
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

**Parameters:**
- `base_url`: Base URL of Liveness Detection Service
- `keycloak_url`: Keycloak server URL
- `realm`: Keycloak realm name
- `client_id`: Keycloak client ID
- `username`: Username for password grant (optional)
- `password`: Password for password grant (optional)
- `client_secret`: Client secret for client credentials grant (optional)
- `timeout`: Request timeout in seconds (default: 30)
- `max_retries`: Maximum retries for failed requests (default: 3)

#### Methods

##### perform_liveness_check()

```python
perform_liveness_check(
    customer_id: str,
    liveness_type: Union[LivenessType, str],
    file: Union[str, Path, BinaryIO],
    reference_image: Optional[Union[str, Path, BinaryIO]] = None,
) -> LivenessCheckResponse
```

Perform liveness detection check.

##### perform_passive_liveness_check()

```python
perform_passive_liveness_check(
    customer_id: str,
    image_file: Union[str, Path, BinaryIO],
    reference_image: Optional[Union[str, Path, BinaryIO]] = None,
) -> LivenessCheckResponse
```

Perform passive liveness detection on an image.

##### perform_active_liveness_check()

```python
perform_active_liveness_check(
    customer_id: str,
    video_file: Union[str, Path, BinaryIO],
) -> LivenessCheckResponse
```

Perform active liveness detection on a video.

##### get_liveness_check()

```python
get_liveness_check(check_id: str) -> LivenessCheckResponse
```

Get liveness check result by ID.

##### get_customer_liveness_checks()

```python
get_customer_liveness_checks(
    customer_id: str,
    limit: int = 10,
    offset: int = 0,
) -> LivenessCheckListResponse
```

Get all liveness checks for a customer.

##### health_check()

```python
health_check() -> HealthCheckResponse
```

Check service health status.

## Models

### LivenessCheckResponse

```python
class LivenessCheckResponse(BaseModel):
    check_id: str
    customer_id: str
    liveness_type: str
    is_live: bool
    confidence_score: float  # 0.0 to 1.0
    anti_spoofing: AntiSpoofingResult
    face_quality: FaceQuality
    face_matching: Optional[FaceMatching]
    status: LivenessStatus
    checked_at: datetime
    checked_by: str
    notes: Optional[str]
```

### AntiSpoofingResult

```python
class AntiSpoofingResult(BaseModel):
    is_photo: bool
    is_video: bool
    is_mask: bool
    is_deepfake: bool
    texture_score: float
    color_score: float
    reflection_score: float
    depth_score: float
```

### FaceQuality

```python
class FaceQuality(BaseModel):
    brightness: float
    sharpness: float
    frontal_score: float
```

### FaceMatching

```python
class FaceMatching(BaseModel):
    match_found: bool
    similarity_score: float
    match_confidence: str  # "low", "medium", "high"
```

## Exceptions

```python
from liveness_client import (
    LivenessDetectionError,  # Base exception
    APIError,                # API request error
    ValidationError,         # Request validation error
    NotFoundError,           # Resource not found
    UnauthorizedError,       # Authentication error
    ForbiddenError,          # Authorization error
    RateLimitError,          # Rate limit exceeded
    ServerError,             # Server error (5xx)
    TimeoutError,            # Request timeout
    ConnectionError,         # Connection error
)
```

## Error Handling

```python
from liveness_client import (
    LivenessDetectionClient,
    ValidationError,
    APIError,
    UnauthorizedError,
)

try:
    result = client.perform_passive_liveness_check(
        customer_id="CUST-001",
        image_file="selfie.jpg",
    )
except ValidationError as e:
    print(f"Validation error: {e.message}")
    print(f"Details: {e.details}")
except UnauthorizedError as e:
    print(f"Authentication failed: {e.message}")
except APIError as e:
    print(f"API error: {e.message}")
    print(f"Status code: {e.status_code}")
```

## Configuration

### Environment Variables

```bash
export LIVENESS_BASE_URL="http://localhost:8002"
export KEYCLOAK_URL="http://localhost:8080"
export KEYCLOAK_REALM="kyc-kyb-system"
export KEYCLOAK_CLIENT_ID="liveness-service"
export KEYCLOAK_USERNAME="kyc_analyst"
export KEYCLOAK_PASSWORD="kyc123"
```

### Using Environment Variables

```python
import os
from liveness_client import LivenessDetectionClient

client = LivenessDetectionClient(
    base_url=os.getenv("LIVENESS_BASE_URL"),
    keycloak_url=os.getenv("KEYCLOAK_URL"),
    realm=os.getenv("KEYCLOAK_REALM"),
    client_id=os.getenv("KEYCLOAK_CLIENT_ID"),
    username=os.getenv("KEYCLOAK_USERNAME"),
    password=os.getenv("KEYCLOAK_PASSWORD"),
)
```

## Examples

Complete examples are available in the `examples/` directory:

- `passive_liveness_check.py` - Passive liveness detection
- `passive_with_face_matching.py` - Passive liveness with face matching
- `active_liveness_check.py` - Active liveness detection
- `batch_processing.py` - Batch processing multiple customers

Run an example:

```bash
cd examples
python passive_liveness_check.py
```

## Development

### Install Development Dependencies

```bash
pip install -e ".[dev]"
```

### Run Tests

```bash
pytest tests/ -v --cov=liveness_client
```

### Code Formatting

```bash
black liveness_client/ examples/ tests/
```

### Type Checking

```bash
mypy liveness_client/
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
- GitHub Issues: https://github.com/insurance/liveness-detection-python-sdk/issues
- Email: support@insurance.com

## Changelog

### 1.0.0 (2026-01-29)
- Initial release
- Complete API coverage for all 9 endpoints
- OAuth2 authentication with Keycloak
- Comprehensive error handling
- Full type safety with Pydantic
- Context manager support
- Automatic retry logic

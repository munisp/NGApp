# AML Screening SDK Test Suite

Comprehensive test suite for the AML Screening Python SDK with unit tests, integration tests, and retry logic testing.

## Test Structure

```
tests/
├── conftest.py              # Pytest configuration and fixtures
├── fixtures/
│   └── mock_responses.py    # Mock API responses
├── unit/                    # Unit tests with mocked dependencies
│   ├── test_auth.py        # Authentication tests
│   ├── test_client_init.py # Client initialization tests
│   ├── test_api_methods.py # API method tests
│   └── test_retry_and_errors.py # Retry logic and error handling tests
├── integration/             # Integration tests requiring live services
│   └── test_integration.py # End-to-end integration tests
└── README.md               # This file
```

## Requirements

Install test dependencies:

```bash
pip install -r requirements.txt
pip install pytest pytest-cov pytest-mock
```

## Running Tests

### Run All Unit Tests

```bash
pytest -m unit
```

### Run Specific Test Categories

```bash
# Authentication tests
pytest -m auth

# Retry logic tests
pytest -m retry

# Error handling tests
pytest -m error
```

### Run All Tests with Coverage

```bash
pytest --cov=aml_client --cov-report=html
```

### Run Integration Tests

Integration tests require live services. Set up the environment first:

```bash
# Start services with Docker Compose
cd ../../../kyc-kyb-system
docker-compose up -d

# Set environment variable
export RUN_INTEGRATION_TESTS=true

# Run integration tests
pytest -m integration
```

### Run Specific Test Files

```bash
# Run authentication tests only
pytest tests/unit/test_auth.py

# Run API method tests only
pytest tests/unit/test_api_methods.py

# Run retry logic tests only
pytest tests/unit/test_retry_and_errors.py
```

### Run with Verbose Output

```bash
pytest -v
```

### Run Specific Test

```bash
pytest tests/unit/test_auth.py::TestKeycloakAuth::test_get_token_password_grant
```

## Test Coverage

Current test coverage:

- **Authentication**: 100%
  - Password grant flow
  - Client credentials grant flow
  - Token caching
  - Token refresh
  - Logout

- **Client Initialization**: 100%
  - Password credentials
  - Client credentials
  - Custom configuration
  - Context manager

- **API Methods**: 100%
  - Sanctions screening (individual & entity)
  - PEP checks
  - Adverse media checks
  - Comprehensive screening
  - Screening retrieval
  - Health check

- **Retry Logic**: 100%
  - Connection errors
  - Timeout errors
  - 500/503 errors
  - Exponential backoff
  - Max retries
  - Custom retry configuration

- **Error Handling**: 100%
  - 400 Validation errors
  - 401 Unauthorized errors
  - 403 Forbidden errors
  - 404 Not found errors
  - 429 Rate limit errors
  - 500 Internal server errors
  - Network errors
  - JSON decode errors

## Integration Test Environment

Integration tests require the following services:

1. **Keycloak** (http://localhost:8080)
   - Realm: kyc-kyb-system
   - Client: aml-screening-service
   - Test user: compliance_officer / compliance123

2. **AML Screening Service** (http://localhost:8003)
   - All API endpoints available
   - Connected to PostgreSQL
   - Connected to Redis

3. **PostgreSQL** (localhost:5432)
   - Database: kyc_kyb
   - Schema initialized

4. **Redis** (localhost:6379)
   - Cache available

### Environment Variables

```bash
export RUN_INTEGRATION_TESTS=true
export AML_SERVICE_URL=http://localhost:8003
export KEYCLOAK_URL=http://localhost:8080
export KEYCLOAK_REALM=kyc-kyb-system
export KEYCLOAK_CLIENT_ID=aml-screening-service
export TEST_USERNAME=compliance_officer
export TEST_PASSWORD=compliance123
```

## Test Fixtures

### Mock Responses

All mock API responses are defined in `fixtures/mock_responses.py`:

- `MOCK_TOKEN_RESPONSE` - Keycloak token response
- `MOCK_SANCTIONS_NO_MATCH` - Sanctions screening with no matches
- `MOCK_SANCTIONS_WITH_MATCHES` - Sanctions screening with matches
- `MOCK_PEP_NOT_PEP` - PEP check for non-PEP
- `MOCK_PEP_IS_PEP` - PEP check for PEP
- `MOCK_ADVERSE_MEDIA_NO_MENTIONS` - Adverse media with no mentions
- `MOCK_ADVERSE_MEDIA_WITH_MENTIONS` - Adverse media with mentions
- `MOCK_COMPREHENSIVE_LOW_RISK` - Comprehensive screening low risk
- `MOCK_COMPREHENSIVE_HIGH_RISK` - Comprehensive screening high risk
- `MOCK_SCREENING_LIST` - List of screenings
- `MOCK_HEALTH_CHECK` - Health check response
- `MOCK_ERROR_*` - Various error responses

### Pytest Fixtures

Defined in `conftest.py`:

- `mock_keycloak_auth` - Mocked Keycloak authentication
- `mock_requests` - Mocked requests library
- `client_config` - Client configuration dictionary
- `aml_client` - AML Screening client with mocked auth
- `mock_response` - Generic mock response object

## Writing New Tests

### Unit Test Example

```python
import pytest
from unittest.mock import Mock, patch
from aml_client import AMLScreeningClient

@pytest.mark.unit
class TestNewFeature:
    """Test new feature."""
    
    @patch("aml_client.client.requests.post")
    def test_new_method(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test new method."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": "success"}
        mock_post.return_value = mock_response
        
        result = aml_client.new_method()
        
        assert result == "success"
```

### Integration Test Example

```python
import pytest
from aml_client import AMLScreeningClient

@pytest.mark.integration
@pytest.mark.slow
class TestNewIntegration:
    """Integration test for new feature."""
    
    def test_new_feature_integration(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test new feature end-to-end."""
        result = integration_client.new_method()
        
        assert result is not None
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.9
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-cov
    
    - name: Run unit tests
      run: pytest -m unit --cov=aml_client
    
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

## Test Markers

Available pytest markers:

- `unit` - Unit tests with mocked dependencies
- `integration` - Integration tests requiring live services
- `slow` - Slow running tests
- `auth` - Authentication related tests
- `retry` - Retry logic tests
- `error` - Error handling tests

## Troubleshooting

### Tests Fail with Connection Error

Ensure services are running:

```bash
docker-compose ps
```

### Authentication Tests Fail

Check Keycloak is accessible:

```bash
curl http://localhost:8080/health
```

### Integration Tests Skipped

Set the environment variable:

```bash
export RUN_INTEGRATION_TESTS=true
```

### Coverage Report Not Generated

Install pytest-cov:

```bash
pip install pytest-cov
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Use mocks for external dependencies in unit tests
3. **Fixtures**: Reuse fixtures for common setup
4. **Markers**: Use markers to categorize tests
5. **Assertions**: Use clear, specific assertions
6. **Documentation**: Document complex test scenarios
7. **Cleanup**: Clean up resources in integration tests

## Contributing

When adding new features:

1. Write unit tests with mocked dependencies
2. Write integration tests for end-to-end validation
3. Ensure 100% code coverage for new code
4. Update this README if adding new test categories
5. Run all tests before submitting PR

## Support

For issues or questions about tests:

1. Check this README
2. Review existing test examples
3. Check pytest documentation: https://docs.pytest.org/
4. Open an issue on GitHub

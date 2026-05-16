"""Unit tests for retry logic and error handling."""

import pytest
from unittest.mock import Mock, patch, call
from requests.exceptions import ConnectionError, Timeout, RequestException

from aml_client import AMLScreeningClient, EntityType
from aml_client.exceptions import (
    APIError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from tests.fixtures.mock_responses import (
    MOCK_COMPREHENSIVE_LOW_RISK,
    MOCK_ERROR_400,
    MOCK_ERROR_401,
    MOCK_ERROR_403,
    MOCK_ERROR_404,
    MOCK_ERROR_429,
    MOCK_ERROR_500,
)


@pytest.mark.unit
@pytest.mark.retry
class TestRetryLogic:
    """Test retry logic for transient errors."""
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_retry_on_connection_error(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test retry on connection error."""
        # First two calls fail, third succeeds
        mock_post.side_effect = [
            ConnectionError("Connection refused"),
            ConnectionError("Connection refused"),
            Mock(status_code=200, json=lambda: MOCK_COMPREHENSIVE_LOW_RISK),
        ]
        
        result = aml_client.comprehensive_screening(
            customer_id="CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Test User",
        )
        
        # Verify retries occurred
        assert mock_post.call_count == 3
        assert mock_sleep.call_count == 2
        assert result.screening_id == "COMP-001"
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_retry_on_timeout(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test retry on timeout."""
        # First call times out, second succeeds
        mock_post.side_effect = [
            Timeout("Request timed out"),
            Mock(status_code=200, json=lambda: MOCK_COMPREHENSIVE_LOW_RISK),
        ]
        
        result = aml_client.comprehensive_screening(
            customer_id="CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Test User",
        )
        
        assert mock_post.call_count == 2
        assert mock_sleep.call_count == 1
        assert result.screening_id == "COMP-001"
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_retry_on_500_error(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test retry on 500 internal server error."""
        # First call returns 500, second succeeds
        mock_500 = Mock()
        mock_500.status_code = 500
        mock_500.json.return_value = MOCK_ERROR_500
        
        mock_200 = Mock()
        mock_200.status_code = 200
        mock_200.json.return_value = MOCK_COMPREHENSIVE_LOW_RISK
        
        mock_post.side_effect = [mock_500, mock_200]
        
        result = aml_client.comprehensive_screening(
            customer_id="CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Test User",
        )
        
        assert mock_post.call_count == 2
        assert mock_sleep.call_count == 1
        assert result.screening_id == "COMP-001"
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_retry_on_503_error(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test retry on 503 service unavailable."""
        mock_503 = Mock()
        mock_503.status_code = 503
        mock_503.json.return_value = {"error": "service_unavailable"}
        
        mock_200 = Mock()
        mock_200.status_code = 200
        mock_200.json.return_value = MOCK_COMPREHENSIVE_LOW_RISK
        
        mock_post.side_effect = [mock_503, mock_200]
        
        result = aml_client.comprehensive_screening(
            customer_id="CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Test User",
        )
        
        assert mock_post.call_count == 2
        assert result.screening_id == "COMP-001"
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_max_retries_exceeded(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test max retries exceeded."""
        # All attempts fail
        mock_post.side_effect = ConnectionError("Connection refused")
        
        with pytest.raises(ConnectionError):
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        # Should retry max_retries times (3 by default)
        assert mock_post.call_count == 3
        assert mock_sleep.call_count == 2
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_exponential_backoff(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test exponential backoff between retries."""
        mock_post.side_effect = [
            ConnectionError("Connection refused"),
            ConnectionError("Connection refused"),
            Mock(status_code=200, json=lambda: MOCK_COMPREHENSIVE_LOW_RISK),
        ]
        
        aml_client.comprehensive_screening(
            customer_id="CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Test User",
        )
        
        # Verify exponential backoff: 1s, 2s
        sleep_calls = [call(1), call(2)]
        mock_sleep.assert_has_calls(sleep_calls)
    
    @patch("aml_client.client.requests.post")
    def test_no_retry_on_4xx_errors(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test no retry on 4xx client errors."""
        mock_400 = Mock()
        mock_400.status_code = 400
        mock_400.json.return_value = MOCK_ERROR_400
        mock_post.return_value = mock_400
        
        with pytest.raises(ValidationError):
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="",  # Invalid empty name
            )
        
        # Should not retry on 400
        assert mock_post.call_count == 1


@pytest.mark.unit
@pytest.mark.error
class TestErrorHandling:
    """Test error handling for various HTTP status codes."""
    
    @patch("aml_client.client.requests.post")
    def test_400_validation_error(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test 400 validation error."""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = MOCK_ERROR_400
        mock_post.return_value = mock_response
        
        with pytest.raises(ValidationError) as exc_info:
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="",
            )
        
        assert "Invalid request parameters" in str(exc_info.value)
    
    @patch("aml_client.client.requests.post")
    def test_401_unauthorized_error(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test 401 unauthorized error."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = MOCK_ERROR_401
        mock_post.return_value = mock_response
        
        with pytest.raises(UnauthorizedError) as exc_info:
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        assert "Authentication required" in str(exc_info.value)
    
    @patch("aml_client.client.requests.post")
    def test_403_forbidden_error(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test 403 forbidden error."""
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.json.return_value = MOCK_ERROR_403
        mock_post.return_value = mock_response
        
        with pytest.raises(ForbiddenError) as exc_info:
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        assert "Insufficient permissions" in str(exc_info.value)
    
    @patch("aml_client.client.requests.get")
    def test_404_not_found_error(
        self,
        mock_get: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test 404 not found error."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.json.return_value = MOCK_ERROR_404
        mock_get.return_value = mock_response
        
        with pytest.raises(NotFoundError) as exc_info:
            aml_client.get_screening("INVALID-ID")
        
        assert "Screening not found" in str(exc_info.value)
    
    @patch("aml_client.client.requests.post")
    def test_429_rate_limit_error(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test 429 rate limit error."""
        mock_response = Mock()
        mock_response.status_code = 429
        mock_response.json.return_value = MOCK_ERROR_429
        mock_response.headers = {"Retry-After": "60"}
        mock_post.return_value = mock_response
        
        with pytest.raises(RateLimitError) as exc_info:
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        assert "Too many requests" in str(exc_info.value)
        assert exc_info.value.retry_after == 60
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_500_internal_server_error_with_retries(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test 500 internal server error with retries."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = MOCK_ERROR_500
        mock_post.return_value = mock_response
        
        with pytest.raises(APIError) as exc_info:
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        # Should retry 3 times
        assert mock_post.call_count == 3
        assert "An internal error occurred" in str(exc_info.value)
    
    @patch("aml_client.client.requests.post")
    def test_network_error(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test network error."""
        mock_post.side_effect = RequestException("Network error")
        
        with pytest.raises(RequestException):
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
    
    @patch("aml_client.client.requests.post")
    def test_json_decode_error(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test JSON decode error."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_post.return_value = mock_response
        
        with pytest.raises(ValueError):
            aml_client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )


@pytest.mark.unit
@pytest.mark.retry
class TestRetryConfiguration:
    """Test retry configuration."""
    
    @patch("aml_client.client.requests.post")
    @patch("aml_client.client.time.sleep")
    def test_custom_max_retries(
        self,
        mock_sleep: Mock,
        mock_post: Mock,
        mock_keycloak_auth: Mock,
    ):
        """Test custom max retries configuration."""
        mock_post.side_effect = ConnectionError("Connection refused")
        
        # Create client with custom max_retries
        client = AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
            max_retries=5,
        )
        
        with pytest.raises(ConnectionError):
            client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        # Should retry 5 times
        assert mock_post.call_count == 5
    
    @patch("aml_client.client.requests.post")
    def test_no_retries(
        self,
        mock_post: Mock,
        mock_keycloak_auth: Mock,
    ):
        """Test disabling retries."""
        mock_post.side_effect = ConnectionError("Connection refused")
        
        # Create client with no retries
        client = AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
            max_retries=0,
        )
        
        with pytest.raises(ConnectionError):
            client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Test User",
            )
        
        # Should not retry
        assert mock_post.call_count == 1

"""Unit tests for client initialization."""

import pytest
from unittest.mock import Mock, patch

from aml_client import AMLScreeningClient
from aml_client.exceptions import ValidationError


@pytest.mark.unit
class TestClientInitialization:
    """Test AML Screening client initialization."""
    
    @patch("aml_client.client.KeycloakAuth")
    def test_init_with_password(self, mock_auth_class: Mock):
        """Test client initialization with password credentials."""
        mock_auth = Mock()
        mock_auth_class.return_value = mock_auth
        
        client = AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        assert client.base_url == "http://localhost:8003"
        assert client.timeout == 30
        assert client.max_retries == 3
        mock_auth_class.assert_called_once()
    
    @patch("aml_client.client.KeycloakAuth")
    def test_init_with_client_secret(self, mock_auth_class: Mock):
        """Test client initialization with client credentials."""
        mock_auth = Mock()
        mock_auth_class.return_value = mock_auth
        
        client = AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            client_secret="test_secret",
        )
        
        assert client.base_url == "http://localhost:8003"
        mock_auth_class.assert_called_once()
    
    @patch("aml_client.client.KeycloakAuth")
    def test_init_custom_timeout_and_retries(self, mock_auth_class: Mock):
        """Test client initialization with custom timeout and retries."""
        mock_auth = Mock()
        mock_auth_class.return_value = mock_auth
        
        client = AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
            timeout=60,
            max_retries=5,
        )
        
        assert client.timeout == 60
        assert client.max_retries == 5
    
    @patch("aml_client.client.KeycloakAuth")
    def test_context_manager(self, mock_auth_class: Mock):
        """Test client as context manager."""
        mock_auth = Mock()
        mock_auth_class.return_value = mock_auth
        
        with AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        ) as client:
            assert client is not None
        
        # Verify close was called
        mock_auth.logout.assert_called_once()
    
    @patch("aml_client.client.KeycloakAuth")
    def test_close(self, mock_auth_class: Mock):
        """Test client close method."""
        mock_auth = Mock()
        mock_auth_class.return_value = mock_auth
        
        client = AMLScreeningClient(
            base_url="http://localhost:8003",
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        client.close()
        mock_auth.logout.assert_called_once()

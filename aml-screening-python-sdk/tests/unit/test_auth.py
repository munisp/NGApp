"""Unit tests for authentication module."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import jwt

from aml_client.auth import KeycloakAuth
from aml_client.exceptions import UnauthorizedError
from tests.fixtures.mock_responses import MOCK_TOKEN_RESPONSE


@pytest.mark.unit
@pytest.mark.auth
class TestKeycloakAuth:
    """Test Keycloak authentication."""
    
    def test_init_with_password(self):
        """Test initialization with password grant."""
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        assert auth.keycloak_url == "http://localhost:8080"
        assert auth.realm == "test-realm"
        assert auth.client_id == "test-client"
        assert auth.username == "test_user"
        assert auth.password == "test_password"
        assert auth.client_secret is None
    
    def test_init_with_client_credentials(self):
        """Test initialization with client credentials grant."""
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            client_secret="test_secret",
        )
        
        assert auth.client_secret == "test_secret"
        assert auth.username is None
        assert auth.password is None
    
    @patch("aml_client.auth.requests.post")
    def test_get_token_password_grant(self, mock_post: Mock):
        """Test getting token with password grant."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_TOKEN_RESPONSE
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        token = auth._get_token()
        
        assert token == MOCK_TOKEN_RESPONSE["access_token"]
        mock_post.assert_called_once()
        
        # Verify request payload
        call_args = mock_post.call_args
        assert call_args[1]["data"]["grant_type"] == "password"
        assert call_args[1]["data"]["username"] == "test_user"
        assert call_args[1]["data"]["password"] == "test_password"
    
    @patch("aml_client.auth.requests.post")
    def test_get_token_client_credentials_grant(self, mock_post: Mock):
        """Test getting token with client credentials grant."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_TOKEN_RESPONSE
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            client_secret="test_secret",
        )
        
        token = auth._get_token()
        
        assert token == MOCK_TOKEN_RESPONSE["access_token"]
        
        # Verify request payload
        call_args = mock_post.call_args
        assert call_args[1]["data"]["grant_type"] == "client_credentials"
        assert call_args[1]["data"]["client_secret"] == "test_secret"
    
    @patch("aml_client.auth.requests.post")
    def test_get_token_failure(self, mock_post: Mock):
        """Test token retrieval failure."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": "invalid_grant"}
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="wrong_password",
        )
        
        with pytest.raises(UnauthorizedError):
            auth._get_token()
    
    @patch("aml_client.auth.requests.post")
    def test_get_access_token_caching(self, mock_post: Mock):
        """Test access token caching."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_TOKEN_RESPONSE
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        # First call should fetch token
        token1 = auth.get_access_token()
        assert mock_post.call_count == 1
        
        # Second call should use cached token
        token2 = auth.get_access_token()
        assert mock_post.call_count == 1
        assert token1 == token2
    
    @patch("aml_client.auth.requests.post")
    def test_token_refresh_on_expiration(self, mock_post: Mock):
        """Test token refresh when expired."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_TOKEN_RESPONSE
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        # Get initial token
        auth.get_access_token()
        assert mock_post.call_count == 1
        
        # Simulate token expiration
        auth._token_expires_at = datetime.utcnow() - timedelta(seconds=1)
        
        # Should fetch new token
        auth.get_access_token()
        assert mock_post.call_count == 2
    
    def test_is_token_valid_no_token(self):
        """Test token validation when no token exists."""
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        assert not auth.is_token_valid()
    
    @patch("aml_client.auth.requests.post")
    def test_is_token_valid_valid_token(self, mock_post: Mock):
        """Test token validation with valid token."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_TOKEN_RESPONSE
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        auth.get_access_token()
        assert auth.is_token_valid()
    
    @patch("aml_client.auth.requests.post")
    def test_is_token_valid_expired_token(self, mock_post: Mock):
        """Test token validation with expired token."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_TOKEN_RESPONSE
        mock_post.return_value = mock_response
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        auth.get_access_token()
        
        # Simulate expiration
        auth._token_expires_at = datetime.utcnow() - timedelta(seconds=1)
        
        assert not auth.is_token_valid()
    
    @patch("aml_client.auth.requests.post")
    def test_logout(self, mock_post: Mock):
        """Test logout functionality."""
        # Mock token response
        mock_token_response = Mock()
        mock_token_response.status_code = 200
        mock_token_response.json.return_value = MOCK_TOKEN_RESPONSE
        
        # Mock logout response
        mock_logout_response = Mock()
        mock_logout_response.status_code = 204
        
        mock_post.side_effect = [mock_token_response, mock_logout_response]
        
        auth = KeycloakAuth(
            keycloak_url="http://localhost:8080",
            realm="test-realm",
            client_id="test-client",
            username="test_user",
            password="test_password",
        )
        
        # Get token
        auth.get_access_token()
        assert auth._access_token is not None
        
        # Logout
        auth.logout()
        
        # Verify token is cleared
        assert auth._access_token is None
        assert auth._refresh_token is None
        assert mock_post.call_count == 2

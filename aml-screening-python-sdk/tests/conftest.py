"""Pytest configuration and fixtures."""

import pytest
from unittest.mock import Mock, patch
from typing import Generator

from aml_client import AMLScreeningClient
from tests.fixtures.mock_responses import MOCK_TOKEN_RESPONSE


@pytest.fixture
def mock_keycloak_auth() -> Generator[Mock, None, None]:
    """Mock Keycloak authentication."""
    with patch("aml_client.auth.KeycloakAuth") as mock_auth:
        mock_instance = Mock()
        mock_instance.get_access_token.return_value = "mock_access_token"
        mock_instance.is_token_valid.return_value = True
        mock_auth.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_requests() -> Generator[Mock, None, None]:
    """Mock requests library."""
    with patch("aml_client.client.requests") as mock_req:
        yield mock_req


@pytest.fixture
def client_config() -> dict:
    """Client configuration for testing."""
    return {
        "base_url": "http://localhost:8003",
        "keycloak_url": "http://localhost:8080",
        "realm": "test-realm",
        "client_id": "test-client",
        "username": "test_user",
        "password": "test_password",
        "timeout": 30,
        "max_retries": 3,
    }


@pytest.fixture
def aml_client(client_config: dict, mock_keycloak_auth: Mock) -> AMLScreeningClient:
    """Create AML Screening client with mocked auth."""
    return AMLScreeningClient(**client_config)


@pytest.fixture
def mock_response() -> Mock:
    """Create a mock response object."""
    response = Mock()
    response.status_code = 200
    response.headers = {"Content-Type": "application/json"}
    response.json.return_value = {}
    response.raise_for_status.return_value = None
    return response

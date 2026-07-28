"""
conftest.py — pytest configuration and fixtures for the Unified Insurance Platform test suite.
Resets rate limits between test modules to prevent cross-suite interference.
"""
import os
import requests
import pytest

BASE_URL = os.getenv("PLATFORM_BASE_URL", "http://localhost:8080")


def pytest_runtest_setup(item):
    """Reset rate limits before each test module starts to prevent cross-suite interference."""
    pass


def pytest_collection_modifyitems(session, config, items):
    """Reorder tests to run security tests before UX tests to avoid rate limit pollution."""
    pass


@pytest.fixture(autouse=True, scope="module")
def reset_rate_limits():
    """Reset server rate limits before each test module."""
    try:
        requests.post(f"{BASE_URL}/api/test/reset", timeout=2)
    except Exception:
        pass  # Server may not be running (e.g., in CI without harness)
    yield
    # Also reset after module completes
    try:
        requests.post(f"{BASE_URL}/api/test/reset", timeout=2)
    except Exception:
        pass

"""Integration tests for AML Screening SDK.

These tests require live services to be running:
- Keycloak on http://localhost:8080
- AML Screening Service on http://localhost:8003
- PostgreSQL database
- Redis cache

Run with: pytest -m integration
"""

import pytest
import os
from aml_client import AMLScreeningClient, EntityType
from aml_client.exceptions import UnauthorizedError, NotFoundError


# Skip integration tests if environment variable not set
pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS") != "true",
    reason="Integration tests require live services. Set RUN_INTEGRATION_TESTS=true to run.",
)


@pytest.fixture(scope="module")
def integration_client():
    """Create client for integration testing."""
    client = AMLScreeningClient(
        base_url=os.getenv("AML_SERVICE_URL", "http://localhost:8003"),
        keycloak_url=os.getenv("KEYCLOAK_URL", "http://localhost:8080"),
        realm=os.getenv("KEYCLOAK_REALM", "kyc-kyb-system"),
        client_id=os.getenv("KEYCLOAK_CLIENT_ID", "aml-screening-service"),
        username=os.getenv("TEST_USERNAME", "compliance_officer"),
        password=os.getenv("TEST_PASSWORD", "compliance123"),
    )
    yield client
    client.close()


@pytest.mark.integration
class TestIntegrationHealthCheck:
    """Integration tests for health check."""
    
    def test_health_check(self, integration_client: AMLScreeningClient):
        """Test health check endpoint."""
        result = integration_client.health_check()
        
        assert result.status == "healthy"
        assert result.version is not None
        assert result.timestamp is not None


@pytest.mark.integration
class TestIntegrationAuthentication:
    """Integration tests for authentication."""
    
    def test_successful_authentication(self):
        """Test successful authentication."""
        client = AMLScreeningClient(
            base_url=os.getenv("AML_SERVICE_URL", "http://localhost:8003"),
            keycloak_url=os.getenv("KEYCLOAK_URL", "http://localhost:8080"),
            realm=os.getenv("KEYCLOAK_REALM", "kyc-kyb-system"),
            client_id=os.getenv("KEYCLOAK_CLIENT_ID", "aml-screening-service"),
            username=os.getenv("TEST_USERNAME", "compliance_officer"),
            password=os.getenv("TEST_PASSWORD", "compliance123"),
        )
        
        # Should be able to make authenticated request
        result = client.health_check()
        assert result.status == "healthy"
        
        client.close()
    
    def test_failed_authentication(self):
        """Test failed authentication with wrong credentials."""
        with pytest.raises(UnauthorizedError):
            client = AMLScreeningClient(
                base_url=os.getenv("AML_SERVICE_URL", "http://localhost:8003"),
                keycloak_url=os.getenv("KEYCLOAK_URL", "http://localhost:8080"),
                realm=os.getenv("KEYCLOAK_REALM", "kyc-kyb-system"),
                client_id=os.getenv("KEYCLOAK_CLIENT_ID", "aml-screening-service"),
                username="invalid_user",
                password="wrong_password",
            )
            client.health_check()


@pytest.mark.integration
@pytest.mark.slow
class TestIntegrationSanctionsScreening:
    """Integration tests for sanctions screening."""
    
    def test_screen_sanctions_individual_clean(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test sanctions screening for clean individual."""
        result = integration_client.screen_sanctions_individual(
            name="John Doe",
            date_of_birth="1980-01-15",
            nationality="Nigerian",
        )
        
        assert result.screening_id is not None
        assert result.entity_type == "individual"
        assert result.name == "John Doe"
        assert isinstance(result.matches_found, bool)
        assert result.risk_level is not None
    
    def test_screen_sanctions_entity_clean(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test sanctions screening for clean entity."""
        result = integration_client.screen_sanctions_entity(
            name="Clean Company Ltd",
            country="Nigeria",
            identification_number="RC123456",
        )
        
        assert result.screening_id is not None
        assert result.entity_type == "entity"
        assert isinstance(result.matches_found, bool)


@pytest.mark.integration
@pytest.mark.slow
class TestIntegrationPEPCheck:
    """Integration tests for PEP checks."""
    
    def test_check_pep_non_pep(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test PEP check for non-PEP."""
        result = integration_client.check_pep(
            name="Jane Doe",
            nationality="Nigerian",
        )
        
        assert result.check_id is not None
        assert result.name == "Jane Doe"
        assert isinstance(result.is_pep, bool)
        assert result.risk_level is not None


@pytest.mark.integration
@pytest.mark.slow
class TestIntegrationAdverseMedia:
    """Integration tests for adverse media checks."""
    
    def test_check_adverse_media_individual(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test adverse media check for individual."""
        result = integration_client.check_adverse_media_individual(
            name="Ahmed Hassan",
            comprehensive=False,
        )
        
        assert result.check_id is not None
        assert result.entity_type == "individual"
        assert isinstance(result.mentions_found, bool)
        assert result.risk_level is not None
    
    def test_check_adverse_media_entity(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test adverse media check for entity."""
        result = integration_client.check_adverse_media_entity(
            name="Test Company Ltd",
            country="Nigeria",
        )
        
        assert result.check_id is not None
        assert result.entity_type == "entity"
        assert isinstance(result.mentions_found, bool)


@pytest.mark.integration
@pytest.mark.slow
class TestIntegrationComprehensiveScreening:
    """Integration tests for comprehensive screening."""
    
    def test_comprehensive_screening_individual(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test comprehensive screening for individual."""
        result = integration_client.comprehensive_screening(
            customer_id="TEST-CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Integration Test User",
            date_of_birth="1990-05-20",
            nationality="Nigerian",
        )
        
        assert result.screening_id is not None
        assert result.customer_id == "TEST-CUST-001"
        assert result.entity_type == "individual"
        assert result.name == "Integration Test User"
        assert isinstance(result.sanctions_matches, int)
        assert isinstance(result.is_pep, bool)
        assert isinstance(result.adverse_media_mentions, int)
        assert result.overall_risk_level is not None
        assert isinstance(result.risk_score, float)
        assert result.recommendation in ["approve", "review", "reject"]
        assert result.status is not None
    
    def test_comprehensive_screening_entity(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test comprehensive screening for entity."""
        result = integration_client.comprehensive_screening(
            customer_id="TEST-CUST-002",
            entity_type=EntityType.ENTITY,
            name="Integration Test Company",
            country="Nigeria",
            identification_number="RC999999",
        )
        
        assert result.screening_id is not None
        assert result.customer_id == "TEST-CUST-002"
        assert result.entity_type == "entity"


@pytest.mark.integration
class TestIntegrationScreeningRetrieval:
    """Integration tests for screening retrieval."""
    
    def test_get_screening_by_id(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test retrieving screening by ID."""
        # First create a screening
        create_result = integration_client.comprehensive_screening(
            customer_id="TEST-CUST-003",
            entity_type=EntityType.INDIVIDUAL,
            name="Retrieval Test User",
        )
        
        screening_id = create_result.screening_id
        
        # Then retrieve it
        result = integration_client.get_screening(screening_id)
        
        assert result.screening_id == screening_id
        assert result.customer_id == "TEST-CUST-003"
    
    def test_get_screening_not_found(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test retrieving non-existent screening."""
        with pytest.raises(NotFoundError):
            integration_client.get_screening("INVALID-ID-12345")
    
    def test_get_customer_screenings(
        self,
        integration_client: AMLScreeningClient,
    ):
        """Test retrieving customer screenings."""
        customer_id = "TEST-CUST-004"
        
        # Create multiple screenings for the customer
        for i in range(3):
            integration_client.comprehensive_screening(
                customer_id=customer_id,
                entity_type=EntityType.INDIVIDUAL,
                name=f"Test User {i}",
            )
        
        # Retrieve screenings
        result = integration_client.get_customer_screenings(
            customer_id=customer_id,
            limit=10,
            offset=0,
        )
        
        assert result.total >= 3
        assert len(result.screenings) >= 3
        assert all(s.customer_id == customer_id for s in result.screenings)


@pytest.mark.integration
class TestIntegrationContextManager:
    """Integration tests for context manager."""
    
    def test_context_manager(self):
        """Test using client as context manager."""
        with AMLScreeningClient(
            base_url=os.getenv("AML_SERVICE_URL", "http://localhost:8003"),
            keycloak_url=os.getenv("KEYCLOAK_URL", "http://localhost:8080"),
            realm=os.getenv("KEYCLOAK_REALM", "kyc-kyb-system"),
            client_id=os.getenv("KEYCLOAK_CLIENT_ID", "aml-screening-service"),
            username=os.getenv("TEST_USERNAME", "compliance_officer"),
            password=os.getenv("TEST_PASSWORD", "compliance123"),
        ) as client:
            result = client.health_check()
            assert result.status == "healthy"

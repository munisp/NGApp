"""Unit tests for API methods with mocked responses."""

import pytest
from unittest.mock import Mock, patch
from aml_client import AMLScreeningClient, EntityType
from aml_client.exceptions import NotFoundError, APIError
from tests.fixtures.mock_responses import (
    MOCK_SANCTIONS_NO_MATCH,
    MOCK_SANCTIONS_WITH_MATCHES,
    MOCK_PEP_NOT_PEP,
    MOCK_PEP_IS_PEP,
    MOCK_ADVERSE_MEDIA_NO_MENTIONS,
    MOCK_ADVERSE_MEDIA_WITH_MENTIONS,
    MOCK_COMPREHENSIVE_LOW_RISK,
    MOCK_COMPREHENSIVE_HIGH_RISK,
    MOCK_SCREENING_LIST,
    MOCK_HEALTH_CHECK,
)


@pytest.mark.unit
class TestSanctionsScreening:
    """Test sanctions screening methods."""
    
    @patch("aml_client.client.requests.post")
    def test_screen_sanctions_individual_no_match(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test sanctions screening for individual with no matches."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_SANCTIONS_NO_MATCH
        mock_post.return_value = mock_response
        
        result = aml_client.screen_sanctions_individual(
            name="John Doe",
            date_of_birth="1980-01-15",
            nationality="Nigerian",
        )
        
        assert result.screening_id == "SANC-001"
        assert result.entity_type == "individual"
        assert result.name == "John Doe"
        assert not result.matches_found
        assert result.total_matches == 0
        assert result.risk_level.value == "low"
        assert len(result.matches) == 0
    
    @patch("aml_client.client.requests.post")
    def test_screen_sanctions_individual_with_matches(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test sanctions screening for individual with matches."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_SANCTIONS_WITH_MATCHES
        mock_post.return_value = mock_response
        
        result = aml_client.screen_sanctions_individual(
            name="John Smith",
            date_of_birth="1975-03-15",
            nationality="Nigerian",
        )
        
        assert result.screening_id == "SANC-002"
        assert result.matches_found
        assert result.total_matches == 2
        assert result.risk_level.value == "high"
        assert len(result.matches) == 2
        
        # Check first match
        match = result.matches[0]
        assert match.list_name == "OFAC SDN"
        assert match.match_name == "John Smith"
        assert match.match_score == 0.95
        assert match.reason == "Narcotics trafficking"
    
    @patch("aml_client.client.requests.post")
    def test_screen_sanctions_entity(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test sanctions screening for entity."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_SANCTIONS_NO_MATCH
        mock_post.return_value = mock_response
        
        result = aml_client.screen_sanctions_entity(
            name="Acme Corporation",
            country="Nigeria",
            identification_number="RC123456",
        )
        
        assert result.screening_id == "SANC-001"
        assert not result.matches_found


@pytest.mark.unit
class TestPEPCheck:
    """Test PEP check methods."""
    
    @patch("aml_client.client.requests.post")
    def test_check_pep_not_pep(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test PEP check for non-PEP."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_PEP_NOT_PEP
        mock_post.return_value = mock_response
        
        result = aml_client.check_pep(
            name="Jane Doe",
            nationality="Nigerian",
        )
        
        assert result.check_id == "PEP-001"
        assert result.name == "Jane Doe"
        assert not result.is_pep
        assert result.pep_level is None
        assert result.risk_level.value == "low"
        assert len(result.matches) == 0
    
    @patch("aml_client.client.requests.post")
    def test_check_pep_is_pep(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test PEP check for PEP."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_PEP_IS_PEP
        mock_post.return_value = mock_response
        
        result = aml_client.check_pep(
            name="Aisha Mohammed",
            position="Minister of Finance",
        )
        
        assert result.check_id == "PEP-002"
        assert result.is_pep
        assert result.pep_level.value == "pep_level_1"
        assert result.risk_level.value == "high"
        assert len(result.matches) == 1
        
        # Check match details
        match = result.matches[0]
        assert match.name == "Aisha Mohammed"
        assert match.match_score == 0.98
        assert match.position == "Minister of Finance"
        assert match.is_current


@pytest.mark.unit
class TestAdverseMediaCheck:
    """Test adverse media check methods."""
    
    @patch("aml_client.client.requests.post")
    def test_check_adverse_media_individual_no_mentions(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test adverse media check with no mentions."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_ADVERSE_MEDIA_NO_MENTIONS
        mock_post.return_value = mock_response
        
        result = aml_client.check_adverse_media_individual(
            name="Ahmed Hassan",
            comprehensive=False,
        )
        
        assert result.check_id == "ADV-001"
        assert result.entity_type == "individual"
        assert not result.mentions_found
        assert result.total_mentions == 0
        assert result.risk_level.value == "low"
    
    @patch("aml_client.client.requests.post")
    def test_check_adverse_media_individual_with_mentions(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test adverse media check with mentions."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_ADVERSE_MEDIA_WITH_MENTIONS
        mock_post.return_value = mock_response
        
        result = aml_client.check_adverse_media_individual(
            name="Ibrahim Musa",
            comprehensive=True,
        )
        
        assert result.check_id == "ADV-002"
        assert result.mentions_found
        assert result.total_mentions == 3
        assert result.risk_level.value == "medium"
        assert len(result.mentions) == 3
        
        # Check first mention
        mention = result.mentions[0]
        assert mention.title == "Corruption Investigation Launched"
        assert mention.source == "Daily News"
        assert mention.media_type.value == "corruption"
        assert mention.severity == "high"
        assert mention.relevance_score == 0.92
    
    @patch("aml_client.client.requests.post")
    def test_check_adverse_media_entity(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test adverse media check for entity."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_ADVERSE_MEDIA_NO_MENTIONS
        mock_post.return_value = mock_response
        
        result = aml_client.check_adverse_media_entity(
            name="Global Trading Company",
            country="Nigeria",
        )
        
        assert result.check_id == "ADV-001"
        assert not result.mentions_found


@pytest.mark.unit
class TestComprehensiveScreening:
    """Test comprehensive screening methods."""
    
    @patch("aml_client.client.requests.post")
    def test_comprehensive_screening_low_risk(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test comprehensive screening with low risk."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_COMPREHENSIVE_LOW_RISK
        mock_post.return_value = mock_response
        
        result = aml_client.comprehensive_screening(
            customer_id="CUST-001",
            entity_type=EntityType.INDIVIDUAL,
            name="Fatima Abdul",
            date_of_birth="1985-09-15",
            nationality="Nigerian",
        )
        
        assert result.screening_id == "COMP-001"
        assert result.customer_id == "CUST-001"
        assert result.entity_type == "individual"
        assert result.sanctions_matches == 0
        assert result.sanctions_risk.value == "low"
        assert not result.is_pep
        assert result.pep_risk.value == "low"
        assert result.adverse_media_mentions == 0
        assert result.overall_risk_level.value == "low"
        assert result.risk_score == 15.0
        assert result.recommendation == "approve"
        assert result.status.value == "approved"
    
    @patch("aml_client.client.requests.post")
    def test_comprehensive_screening_high_risk(
        self,
        mock_post: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test comprehensive screening with high risk."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_COMPREHENSIVE_HIGH_RISK
        mock_post.return_value = mock_response
        
        result = aml_client.comprehensive_screening(
            customer_id="CUST-002",
            entity_type=EntityType.INDIVIDUAL,
            name="Suspicious Person",
        )
        
        assert result.screening_id == "COMP-002"
        assert result.sanctions_matches == 1
        assert result.sanctions_risk.value == "high"
        assert result.is_pep
        assert result.pep_level.value == "pep_level_1"
        assert result.adverse_media_mentions == 5
        assert result.overall_risk_level.value == "critical"
        assert result.risk_score == 92.5
        assert result.recommendation == "reject"
        assert result.status.value == "rejected"


@pytest.mark.unit
class TestScreeningRetrieval:
    """Test screening retrieval methods."""
    
    @patch("aml_client.client.requests.get")
    def test_get_screening(
        self,
        mock_get: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test get screening by ID."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_COMPREHENSIVE_LOW_RISK
        mock_get.return_value = mock_response
        
        result = aml_client.get_screening("COMP-001")
        
        assert result.screening_id == "COMP-001"
        assert result.customer_id == "CUST-001"
    
    @patch("aml_client.client.requests.get")
    def test_get_screening_not_found(
        self,
        mock_get: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test get screening with non-existent ID."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.json.return_value = {"error": "not_found"}
        mock_get.return_value = mock_response
        
        with pytest.raises(NotFoundError):
            aml_client.get_screening("INVALID-ID")
    
    @patch("aml_client.client.requests.get")
    def test_get_customer_screenings(
        self,
        mock_get: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test get customer screenings."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_SCREENING_LIST
        mock_get.return_value = mock_response
        
        result = aml_client.get_customer_screenings(
            customer_id="CUST-001",
            limit=10,
            offset=0,
        )
        
        assert result.total == 3
        assert result.limit == 10
        assert result.offset == 0
        assert len(result.screenings) == 3
        
        # Check first screening
        screening = result.screenings[0]
        assert screening.screening_id == "COMP-001"
        assert screening.customer_id == "CUST-001"
        assert screening.overall_risk_level.value == "low"


@pytest.mark.unit
class TestHealthCheck:
    """Test health check method."""
    
    @patch("aml_client.client.requests.get")
    def test_health_check(
        self,
        mock_get: Mock,
        aml_client: AMLScreeningClient,
    ):
        """Test health check."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = MOCK_HEALTH_CHECK
        mock_get.return_value = mock_response
        
        result = aml_client.health_check()
        
        assert result.status == "healthy"
        assert result.version == "1.0.0"
        assert result.timestamp is not None

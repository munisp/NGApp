"""Mock API responses for testing."""

from datetime import datetime
from typing import Dict, Any


# Mock Keycloak token response
MOCK_TOKEN_RESPONSE: Dict[str, Any] = {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "expires_in": 300,
    "refresh_expires_in": 1800,
    "refresh_token": "refresh_token_value",
    "token_type": "Bearer",
    "session_state": "session_state_value",
    "scope": "profile email",
}


# Mock sanctions screening response - no matches
MOCK_SANCTIONS_NO_MATCH: Dict[str, Any] = {
    "screening_id": "SANC-001",
    "entity_type": "individual",
    "name": "John Doe",
    "matches_found": False,
    "total_matches": 0,
    "risk_level": "low",
    "matches": [],
    "screened_at": datetime.utcnow().isoformat(),
    "screened_by": "compliance_officer",
}


# Mock sanctions screening response - with matches
MOCK_SANCTIONS_WITH_MATCHES: Dict[str, Any] = {
    "screening_id": "SANC-002",
    "entity_type": "individual",
    "name": "John Smith",
    "matches_found": True,
    "total_matches": 2,
    "risk_level": "high",
    "matches": [
        {
            "list_name": "OFAC SDN",
            "match_name": "John Smith",
            "match_score": 0.95,
            "reason": "Narcotics trafficking",
            "nationality": "Nigerian",
            "date_of_birth": "1975-03-15",
            "listed_date": "2020-05-10",
        },
        {
            "list_name": "UN Sanctions",
            "match_name": "John A. Smith",
            "match_score": 0.88,
            "reason": "Terrorism financing",
            "nationality": "Nigerian",
            "date_of_birth": "1975-03-15",
            "listed_date": "2019-11-22",
        },
    ],
    "screened_at": datetime.utcnow().isoformat(),
    "screened_by": "compliance_officer",
}


# Mock PEP check response - not a PEP
MOCK_PEP_NOT_PEP: Dict[str, Any] = {
    "check_id": "PEP-001",
    "name": "Jane Doe",
    "is_pep": False,
    "pep_level": None,
    "risk_level": "low",
    "matches": [],
    "checked_at": datetime.utcnow().isoformat(),
    "checked_by": "compliance_officer",
}


# Mock PEP check response - is a PEP
MOCK_PEP_IS_PEP: Dict[str, Any] = {
    "check_id": "PEP-002",
    "name": "Aisha Mohammed",
    "is_pep": True,
    "pep_level": "pep_level_1",
    "risk_level": "high",
    "matches": [
        {
            "name": "Aisha Mohammed",
            "match_score": 0.98,
            "position": "Minister of Finance",
            "country": "Nigeria",
            "is_current": True,
            "start_date": "2020-01-15",
            "end_date": None,
            "source": "Government Records",
        },
    ],
    "checked_at": datetime.utcnow().isoformat(),
    "checked_by": "compliance_officer",
}


# Mock adverse media response - no mentions
MOCK_ADVERSE_MEDIA_NO_MENTIONS: Dict[str, Any] = {
    "check_id": "ADV-001",
    "entity_type": "individual",
    "name": "Ahmed Hassan",
    "mentions_found": False,
    "total_mentions": 0,
    "risk_level": "low",
    "mentions": [],
    "checked_at": datetime.utcnow().isoformat(),
    "checked_by": "compliance_officer",
}


# Mock adverse media response - with mentions
MOCK_ADVERSE_MEDIA_WITH_MENTIONS: Dict[str, Any] = {
    "check_id": "ADV-002",
    "entity_type": "individual",
    "name": "Ibrahim Musa",
    "mentions_found": True,
    "total_mentions": 3,
    "risk_level": "medium",
    "mentions": [
        {
            "title": "Corruption Investigation Launched",
            "source": "Daily News",
            "published_date": "2023-06-15",
            "media_type": "corruption",
            "severity": "high",
            "relevance_score": 0.92,
            "snippet": "Authorities have launched an investigation into alleged corruption...",
            "url": "https://example.com/news/corruption-investigation",
        },
        {
            "title": "Fraud Allegations Surface",
            "source": "Business Times",
            "published_date": "2023-05-10",
            "media_type": "fraud",
            "severity": "medium",
            "relevance_score": 0.85,
            "snippet": "New fraud allegations have emerged against...",
            "url": "https://example.com/news/fraud-allegations",
        },
        {
            "title": "Financial Misconduct Probe",
            "source": "Economic Review",
            "published_date": "2023-04-20",
            "media_type": "financial_crime",
            "severity": "high",
            "relevance_score": 0.88,
            "snippet": "Financial misconduct probe reveals...",
            "url": "https://example.com/news/financial-misconduct",
        },
    ],
    "checked_at": datetime.utcnow().isoformat(),
    "checked_by": "compliance_officer",
}


# Mock comprehensive screening response - low risk
MOCK_COMPREHENSIVE_LOW_RISK: Dict[str, Any] = {
    "screening_id": "COMP-001",
    "customer_id": "CUST-001",
    "entity_type": "individual",
    "name": "Fatima Abdul",
    "sanctions_matches": 0,
    "sanctions_risk": "low",
    "is_pep": False,
    "pep_level": None,
    "pep_risk": "low",
    "adverse_media_mentions": 0,
    "adverse_media_risk": "low",
    "overall_risk_level": "low",
    "risk_score": 15.0,
    "recommendation": "approve",
    "status": "approved",
    "notes": None,
    "screened_at": datetime.utcnow().isoformat(),
    "screened_by": "compliance_officer",
}


# Mock comprehensive screening response - high risk
MOCK_COMPREHENSIVE_HIGH_RISK: Dict[str, Any] = {
    "screening_id": "COMP-002",
    "customer_id": "CUST-002",
    "entity_type": "individual",
    "name": "Suspicious Person",
    "sanctions_matches": 1,
    "sanctions_risk": "high",
    "is_pep": True,
    "pep_level": "pep_level_1",
    "pep_risk": "high",
    "adverse_media_mentions": 5,
    "adverse_media_risk": "high",
    "overall_risk_level": "critical",
    "risk_score": 92.5,
    "recommendation": "reject",
    "status": "rejected",
    "notes": "Multiple high-risk indicators detected",
    "screened_at": datetime.utcnow().isoformat(),
    "screened_by": "compliance_officer",
}


# Mock screening list response
MOCK_SCREENING_LIST: Dict[str, Any] = {
    "total": 3,
    "limit": 10,
    "offset": 0,
    "screenings": [
        {
            "screening_id": "COMP-001",
            "customer_id": "CUST-001",
            "overall_risk_level": "low",
            "risk_score": 15.0,
            "recommendation": "approve",
            "status": "approved",
            "screened_at": "2024-01-28T10:00:00Z",
        },
        {
            "screening_id": "COMP-002",
            "customer_id": "CUST-001",
            "overall_risk_level": "low",
            "risk_score": 18.0,
            "recommendation": "approve",
            "status": "approved",
            "screened_at": "2024-01-15T14:30:00Z",
        },
        {
            "screening_id": "COMP-003",
            "customer_id": "CUST-001",
            "overall_risk_level": "medium",
            "risk_score": 45.0,
            "recommendation": "review",
            "status": "pending_review",
            "screened_at": "2024-01-01T09:15:00Z",
        },
    ],
}


# Mock health check response
MOCK_HEALTH_CHECK: Dict[str, Any] = {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": datetime.utcnow().isoformat(),
}


# Mock error responses
MOCK_ERROR_400: Dict[str, Any] = {
    "error": "validation_error",
    "message": "Invalid request parameters",
    "details": {"field": "name", "error": "Name is required"},
}

MOCK_ERROR_401: Dict[str, Any] = {
    "error": "unauthorized",
    "message": "Authentication required",
}

MOCK_ERROR_403: Dict[str, Any] = {
    "error": "forbidden",
    "message": "Insufficient permissions",
}

MOCK_ERROR_404: Dict[str, Any] = {
    "error": "not_found",
    "message": "Screening not found",
}

MOCK_ERROR_429: Dict[str, Any] = {
    "error": "rate_limit_exceeded",
    "message": "Too many requests",
    "retry_after": 60,
}

MOCK_ERROR_500: Dict[str, Any] = {
    "error": "internal_server_error",
    "message": "An internal error occurred",
}

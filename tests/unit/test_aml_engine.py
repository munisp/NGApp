"""Unit tests for AML engine domain logic."""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/aml-engine-py'))

def test_aml_risk_score_range():
    """AML risk score must be 0-100."""
    from main import aml_risk_score
    score = aml_risk_score({
        "amount": 5000000,
        "customer_type": "individual",
        "country": "NG",
        "pep": False,
        "transaction_count_30d": 10,
    })
    assert 0 <= score <= 100, f"AML score {score} out of range"

def test_aml_high_risk_pep():
    """PEP customers should have higher risk scores."""
    from main import aml_risk_score
    normal = aml_risk_score({
        "amount": 1000000, "customer_type": "individual",
        "country": "NG", "pep": False, "transaction_count_30d": 5,
    })
    pep = aml_risk_score({
        "amount": 1000000, "customer_type": "individual",
        "country": "NG", "pep": True, "transaction_count_30d": 5,
    })
    assert pep > normal, f"PEP ({pep}) should have higher risk than normal ({normal})"

def test_suspicious_pattern_detection():
    """Structuring (splitting transactions) should be detected."""
    from main import detect_structuring
    result = detect_structuring([
        {"amount": 900000, "timestamp": "2024-01-01T10:00:00"},
        {"amount": 850000, "timestamp": "2024-01-01T10:30:00"},
        {"amount": 950000, "timestamp": "2024-01-01T11:00:00"},
    ])
    assert result["suspicious"] == True, "Multiple just-under-threshold transactions should be flagged"

"""Tests for AI Claims ML Engine."""
import pytest
from app.models import ClaimRequest
from app.ml_engine import ClaimsMLEngine


@pytest.fixture
def engine():
    return ClaimsMLEngine()


def test_engine_loaded(engine):
    assert engine.is_loaded() is True


def test_assess_low_risk(engine):
    req = ClaimRequest(
        claim_id="CLM-TEST-001",
        policy_id="POL-001",
        claimant_id="USR-001",
        amount=50000,
        category="health",
        evidence_count=3,
        days_since_policy_start=180,
        previous_claims=0,
    )
    result = engine.assess(req)
    assert result.claim_id == "CLM-TEST-001"
    assert 0 <= result.fraud_score <= 1
    assert 0 <= result.validity_score <= 1
    assert result.recommendation in ("auto_approve", "manual_review", "auto_reject")
    assert result.processing_time_ms >= 0


def test_assess_high_risk(engine):
    req = ClaimRequest(
        claim_id="CLM-TEST-002",
        policy_id="POL-002",
        claimant_id="USR-002",
        amount=900000,
        category="auto",
        evidence_count=0,
        days_since_policy_start=5,
        previous_claims=4,
    )
    result = engine.assess(req)
    assert result.fraud_score > 0.3
    assert len(result.risk_flags) > 0


def test_decide_auto_approve(engine):
    from app.models import ClaimAssessment
    assessment = ClaimAssessment(
        claim_id="CLM-001",
        fraud_score=0.05,
        validity_score=0.95,
        complexity="simple",
        estimated_payout=50000,
        risk_flags=[],
        recommendation="auto_approve",
        confidence=0.90,
        processing_time_ms=5,
    )
    decision = engine.decide("CLM-001", assessment)
    assert decision.decision == "approved"
    assert decision.amount_approved == 50000


def test_decide_auto_reject(engine):
    from app.models import ClaimAssessment
    assessment = ClaimAssessment(
        claim_id="CLM-002",
        fraud_score=0.85,
        validity_score=0.15,
        complexity="complex",
        estimated_payout=0,
        risk_flags=["elevated_fraud_risk"],
        recommendation="auto_reject",
        confidence=0.12,
        processing_time_ms=5,
    )
    decision = engine.decide("CLM-002", assessment)
    assert decision.decision == "rejected"
    assert decision.amount_approved == 0


def test_get_metrics(engine):
    metrics = engine.get_metrics()
    assert "accuracy" in metrics
    assert metrics["accuracy"] > 0.9

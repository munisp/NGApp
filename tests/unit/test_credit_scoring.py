"""Unit tests for credit scoring domain logic."""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/credit-scoring-py'))

def test_cbn_credit_score_range():
    """CBN credit score must be 300-850."""
    from main import cbn_credit_score
    score = cbn_credit_score({"monthly_income": 500000, "monthly_expenses": 200000,
                               "existing_loans": 1, "loan_defaults": 0,
                               "years_employed": 5, "age": 35})
    assert 300 <= score <= 850, f"Score {score} out of range"

def test_cbn_credit_score_defaults():
    """Defaults should lower score."""
    from main import cbn_credit_score
    good = cbn_credit_score({"monthly_income": 500000, "monthly_expenses": 200000,
                              "existing_loans": 0, "loan_defaults": 0,
                              "years_employed": 10, "age": 40})
    bad = cbn_credit_score({"monthly_income": 100000, "monthly_expenses": 90000,
                             "existing_loans": 5, "loan_defaults": 3,
                             "years_employed": 1, "age": 22})
    assert good > bad, f"Good profile ({good}) should score higher than bad ({bad})"

def test_debt_service_ratio():
    """DSR = total_debt_payments / gross_income."""
    from main import debt_service_ratio
    dsr = debt_service_ratio(50000, 200000)
    assert dsr == pytest.approx(0.25, abs=0.01)
    
def test_debt_service_ratio_zero_income():
    """Zero income should return max DSR."""
    from main import debt_service_ratio
    dsr = debt_service_ratio(50000, 0)
    assert dsr >= 1.0

"""Unit tests for KYC verification domain logic."""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/kyc-verification-py'))

def test_bvn_validation():
    """BVN must be 11 digits."""
    from main import validate_bvn
    assert validate_bvn("12345678901") == True
    assert validate_bvn("1234") == False
    assert validate_bvn("") == False
    assert validate_bvn("abcdefghijk") == False

def test_nin_validation():
    """NIN must be 11 digits."""
    from main import validate_nin
    assert validate_nin("12345678901") == True
    assert validate_nin("short") == False

def test_kyc_tier_determination():
    """KYC tier based on documents provided."""
    from main import determine_kyc_tier
    tier = determine_kyc_tier({"bvn": True, "nin": False, "utility_bill": False})
    assert tier in (1, 2, 3), f"Unexpected tier: {tier}"
    
    tier_full = determine_kyc_tier({"bvn": True, "nin": True, "utility_bill": True})
    assert tier_full >= tier, "More documents should yield equal or higher tier"

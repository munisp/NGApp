#!/usr/bin/env python3
"""
Example: Comprehensive AML Screening

This example demonstrates how to perform comprehensive AML screening that includes:
- Sanctions screening (UN, OFAC, EU, UK)
- PEP (Politically Exposed Person) check
- Adverse media monitoring

This is the recommended approach for onboarding new customers.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from aml_client import AMLScreeningClient, APIError, EntityType, RiskLevel


def main():
    """Main function demonstrating comprehensive AML screening."""
    
    # Configuration
    BASE_URL = "http://localhost:8003"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "aml-screening-service"
    USERNAME = "compliance_officer"
    PASSWORD = "compliance123"
    
    print("=" * 70)
    print("Comprehensive AML Screening Example")
    print("=" * 70)
    print()
    
    with AMLScreeningClient(
        base_url=BASE_URL,
        keycloak_url=KEYCLOAK_URL,
        realm=REALM,
        client_id=CLIENT_ID,
        username=USERNAME,
        password=PASSWORD,
    ) as client:
        
        print("Performing Comprehensive AML Screening for New Customer...")
        print()
        
        try:
            result = client.comprehensive_screening(
                customer_id="CUST-001",
                entity_type=EntityType.INDIVIDUAL,
                name="Fatima Abdul",
                date_of_birth="1985-09-15",
                nationality="Nigerian",
                country="Nigeria",
                identification_number="12345678901",
            )
            
            print(f"   Screening ID:  {result.screening_id}")
            print(f"   Customer ID:   {result.customer_id}")
            print(f"   Name:          {result.name}")
            print(f"   Entity Type:   {result.entity_type}")
            print()
            
            print("=" * 70)
            print("SCREENING RESULTS")
            print("=" * 70)
            print()
            
            # Sanctions Screening Results
            print("1. SANCTIONS SCREENING")
            print(f"   Matches Found: {result.sanctions_matches}")
            print(f"   Risk Level:    {result.sanctions_risk.upper()}")
            if result.sanctions_matches > 0:
                print(f"   ⚠️  WARNING: Sanctions matches found!")
            else:
                print(f"   ✓ No sanctions matches")
            print()
            
            # PEP Check Results
            print("2. PEP (POLITICALLY EXPOSED PERSON) CHECK")
            print(f"   Is PEP:        {result.is_pep}")
            if result.pep_level:
                print(f"   PEP Level:     {result.pep_level.value}")
            print(f"   Risk Level:    {result.pep_risk.upper()}")
            if result.is_pep:
                print(f"   ⚠️  WARNING: Individual is a PEP!")
            else:
                print(f"   ✓ Not a PEP")
            print()
            
            # Adverse Media Results
            print("3. ADVERSE MEDIA MONITORING")
            print(f"   Mentions:      {result.adverse_media_mentions}")
            print(f"   Risk Level:    {result.adverse_media_risk.upper()}")
            if result.adverse_media_mentions > 0:
                print(f"   ⚠️  WARNING: Adverse media mentions found!")
            else:
                print(f"   ✓ No adverse media mentions")
            print()
            
            # Overall Assessment
            print("=" * 70)
            print("OVERALL ASSESSMENT")
            print("=" * 70)
            print()
            print(f"   Risk Level:      {result.overall_risk_level.upper()}")
            print(f"   Risk Score:      {result.risk_score:.2f}/100")
            print(f"   Recommendation:  {result.recommendation.upper()}")
            print(f"   Status:          {result.status.upper()}")
            print()
            
            # Decision logic
            if result.overall_risk_level == RiskLevel.LOW:
                print("   ✓ DECISION: APPROVE")
                print("   - Low risk customer")
                print("   - Standard Due Diligence (SDD) sufficient")
                print("   - Proceed with onboarding")
            
            elif result.overall_risk_level == RiskLevel.MEDIUM:
                print("   ⚠️  DECISION: REVIEW REQUIRED")
                print("   - Medium risk customer")
                print("   - Enhanced Due Diligence (EDD) recommended")
                print("   - Additional documentation required")
                print("   - Manual review by compliance officer")
            
            elif result.overall_risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                print("   ✗ DECISION: REJECT OR ESCALATE")
                print("   - High/Critical risk customer")
                print("   - Enhanced Due Diligence (EDD) mandatory")
                print("   - Senior management approval required")
                print("   - Consider rejection if risk cannot be mitigated")
            
            print()
            
            # Additional notes
            if result.notes:
                print(f"   Notes: {result.notes}")
                print()
            
            print(f"   Screened At: {result.screened_at}")
            print(f"   Screened By: {result.screened_by}")
            
        except APIError as e:
            print(f"   ✗ Comprehensive screening failed: {e.message}")
        
        print()
        print("=" * 70)
        print("COMPREHENSIVE AML SCREENING COMPLETED")
        print("=" * 70)
        print()
        
        return 0


if __name__ == "__main__":
    sys.exit(main())

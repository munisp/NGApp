#!/usr/bin/env python3
"""
Example: PEP (Politically Exposed Person) Check

This example demonstrates how to check if an individual is a Politically
Exposed Person (PEP), including direct PEPs, family members, and close associates.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from aml_client import AMLScreeningClient, APIError, PEPLevel


def main():
    """Main function demonstrating PEP check."""
    
    # Configuration
    BASE_URL = "http://localhost:8003"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "aml-screening-service"
    USERNAME = "compliance_officer"
    PASSWORD = "compliance123"
    
    print("=" * 70)
    print("PEP (Politically Exposed Person) Check Example")
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
        
        print("Checking if Individual is a Politically Exposed Person...")
        print()
        
        try:
            result = client.check_pep(
                name="Aisha Mohammed",
                date_of_birth="1968-07-22",
                nationality="Nigerian",
                position="Minister of Finance",
            )
            
            print(f"   Check ID:    {result.check_id}")
            print(f"   Name:        {result.name}")
            print(f"   Is PEP:      {result.is_pep}")
            print()
            
            if result.is_pep:
                print(f"   ⚠️  INDIVIDUAL IS A PEP")
                print(f"   PEP Level:   {result.pep_level.value if result.pep_level else 'N/A'}")
                print(f"   Risk Level:  {result.risk_level.upper()}")
                print()
                
                # Display PEP level explanation
                if result.pep_level == PEPLevel.PEP_LEVEL_1:
                    print(f"   ℹ️  PEP Level 1: Direct PEP (holds or held prominent public position)")
                elif result.pep_level == PEPLevel.PEP_LEVEL_2:
                    print(f"   ℹ️  PEP Level 2: Family member of PEP")
                elif result.pep_level == PEPLevel.PEP_LEVEL_3:
                    print(f"   ℹ️  PEP Level 3: Close associate of PEP")
                print()
                
                # Display matches
                if result.matches:
                    print(f"   PEP Matches Found: {len(result.matches)}")
                    print()
                    
                    for i, match in enumerate(result.matches, 1):
                        print(f"   Match {i}:")
                        print(f"     Name:         {match.name}")
                        print(f"     Score:        {match.match_score:.2%}")
                        print(f"     Position:     {match.position}")
                        print(f"     Country:      {match.country}")
                        print(f"     Current:      {'Yes' if match.is_current else 'No'}")
                        if match.start_date:
                            print(f"     Start Date:   {match.start_date}")
                        if match.end_date:
                            print(f"     End Date:     {match.end_date}")
                        print(f"     Source:       {match.source}")
                        print()
                
                # Enhanced Due Diligence recommendation
                print("   📋 RECOMMENDATION:")
                print("   - Enhanced Due Diligence (EDD) required")
                print("   - Additional documentation needed")
                print("   - Source of wealth verification")
                print("   - Ongoing monitoring required")
                
            else:
                print(f"   ✓ INDIVIDUAL IS NOT A PEP")
                print(f"   Risk Level: {result.risk_level.upper()}")
                print()
                print("   📋 RECOMMENDATION:")
                print("   - Standard Due Diligence (SDD) sufficient")
            
        except APIError as e:
            print(f"   ✗ PEP check failed: {e.message}")
        
        print()
        print("=" * 70)
        print("PEP CHECK COMPLETED")
        print("=" * 70)
        print()
        
        return 0


if __name__ == "__main__":
    sys.exit(main())

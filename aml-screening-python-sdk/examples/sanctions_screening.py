#!/usr/bin/env python3
"""
Example: Sanctions Screening

This example demonstrates how to screen individuals and entities against
international sanctions lists (UN, OFAC, EU, UK).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from aml_client import AMLScreeningClient, APIError


def main():
    """Main function demonstrating sanctions screening."""
    
    # Configuration
    BASE_URL = "http://localhost:8003"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "aml-screening-service"
    USERNAME = "compliance_officer"
    PASSWORD = "compliance123"
    
    print("=" * 70)
    print("Sanctions Screening Example")
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
        
        # 1. Screen individual
        print("1. Screening Individual Against Sanctions Lists...")
        print()
        
        try:
            result = client.screen_sanctions_individual(
                name="John Smith",
                date_of_birth="1975-03-15",
                nationality="Nigerian",
                country="Nigeria",
                identification_number="12345678901",
            )
            
            print(f"   Screening ID: {result.screening_id}")
            print(f"   Entity Name:  {result.name}")
            print(f"   Entity Type:  {result.entity_type}")
            print()
            
            if result.matches_found:
                print(f"   ⚠️  SANCTIONS MATCHES FOUND: {result.total_matches}")
                print(f"   Risk Level: {result.risk_level.upper()}")
                print()
                
                for i, match in enumerate(result.matches, 1):
                    print(f"   Match {i}:")
                    print(f"     List:        {match.list_name}")
                    print(f"     Name:        {match.match_name}")
                    print(f"     Score:       {match.match_score:.2%}")
                    print(f"     Reason:      {match.reason}")
                    if match.nationality:
                        print(f"     Nationality: {match.nationality}")
                    if match.listed_date:
                        print(f"     Listed:      {match.listed_date}")
                    print()
            else:
                print(f"   ✓ NO SANCTIONS MATCHES FOUND")
                print(f"   Risk Level: {result.risk_level.upper()}")
            
        except APIError as e:
            print(f"   ✗ Sanctions screening failed: {e.message}")
        
        print()
        print("-" * 70)
        print()
        
        # 2. Screen entity/organization
        print("2. Screening Entity/Organization Against Sanctions Lists...")
        print()
        
        try:
            result = client.screen_sanctions_entity(
                name="Acme Corporation Ltd",
                country="Nigeria",
                identification_number="RC123456",
            )
            
            print(f"   Screening ID: {result.screening_id}")
            print(f"   Entity Name:  {result.name}")
            print(f"   Entity Type:  {result.entity_type}")
            print()
            
            if result.matches_found:
                print(f"   ⚠️  SANCTIONS MATCHES FOUND: {result.total_matches}")
                print(f"   Risk Level: {result.risk_level.upper()}")
                print()
                
                for i, match in enumerate(result.matches, 1):
                    print(f"   Match {i}:")
                    print(f"     List:   {match.list_name}")
                    print(f"     Name:   {match.match_name}")
                    print(f"     Score:  {match.match_score:.2%}")
                    print(f"     Reason: {match.reason}")
                    print()
            else:
                print(f"   ✓ NO SANCTIONS MATCHES FOUND")
                print(f"   Risk Level: {result.risk_level.upper()}")
            
        except APIError as e:
            print(f"   ✗ Sanctions screening failed: {e.message}")
        
        print()
        print("=" * 70)
        print("SANCTIONS SCREENING COMPLETED")
        print("=" * 70)
        print()
        
        return 0


if __name__ == "__main__":
    sys.exit(main())

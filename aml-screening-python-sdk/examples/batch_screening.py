#!/usr/bin/env python3
"""
Example: Batch AML Screening

This example demonstrates how to perform AML screening for multiple customers
and retrieve historical screening results.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from aml_client import AMLScreeningClient, APIError, EntityType, RiskLevel


def main():
    """Main function demonstrating batch AML screening."""
    
    # Configuration
    BASE_URL = "http://localhost:8003"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "aml-screening-service"
    USERNAME = "compliance_officer"
    PASSWORD = "compliance123"
    
    # Multiple customers to screen
    customers = [
        {
            "customer_id": "CUST-001",
            "name": "John Doe",
            "dob": "1980-01-15",
            "nationality": "Nigerian",
        },
        {
            "customer_id": "CUST-002",
            "name": "Jane Smith",
            "dob": "1975-06-22",
            "nationality": "Nigerian",
        },
        {
            "customer_id": "CUST-003",
            "name": "Ahmed Hassan",
            "dob": "1990-12-05",
            "nationality": "Nigerian",
        },
    ]
    
    print("=" * 70)
    print("Batch AML Screening Example")
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
        
        # Process multiple customers
        print(f"1. Screening {len(customers)} customers...")
        print()
        
        results = []
        for i, customer in enumerate(customers, 1):
            print(f"   [{i}/{len(customers)}] Screening {customer['name']} ({customer['customer_id']})...")
            
            try:
                result = client.comprehensive_screening(
                    customer_id=customer['customer_id'],
                    entity_type=EntityType.INDIVIDUAL,
                    name=customer['name'],
                    date_of_birth=customer['dob'],
                    nationality=customer['nationality'],
                    country="Nigeria",
                )
                results.append(result)
                
                # Display quick summary
                risk_icon = "✓" if result.overall_risk_level == RiskLevel.LOW else "⚠️" if result.overall_risk_level == RiskLevel.MEDIUM else "✗"
                print(f"       {risk_icon} {result.overall_risk_level.upper()} risk (score: {result.risk_score:.1f}/100)")
                
            except APIError as e:
                print(f"       ✗ Failed: {e.message}")
        
        print()
        
        # Summary statistics
        print("=" * 70)
        print("BATCH SCREENING SUMMARY")
        print("=" * 70)
        print()
        
        total = len(results)
        low_risk = sum(1 for r in results if r.overall_risk_level == RiskLevel.LOW)
        medium_risk = sum(1 for r in results if r.overall_risk_level == RiskLevel.MEDIUM)
        high_risk = sum(1 for r in results if r.overall_risk_level == RiskLevel.HIGH)
        critical_risk = sum(1 for r in results if r.overall_risk_level == RiskLevel.CRITICAL)
        
        print(f"Total Screened:    {total}")
        print(f"Low Risk:          {low_risk} ({low_risk/total*100:.1f}%)")
        print(f"Medium Risk:       {medium_risk} ({medium_risk/total*100:.1f}%)")
        print(f"High Risk:         {high_risk} ({high_risk/total*100:.1f}%)")
        print(f"Critical Risk:     {critical_risk} ({critical_risk/total*100:.1f}%)")
        print()
        
        # Sanctions matches
        sanctions_matches = sum(r.sanctions_matches for r in results)
        pep_count = sum(1 for r in results if r.is_pep)
        adverse_media = sum(r.adverse_media_mentions for r in results)
        
        print(f"Sanctions Matches: {sanctions_matches}")
        print(f"PEPs Identified:   {pep_count}")
        print(f"Adverse Media:     {adverse_media}")
        print()
        
        # Retrieve historical screenings for a customer
        print("-" * 70)
        print()
        print("2. Retrieving historical screenings for CUST-001...")
        print()
        
        try:
            history = client.get_customer_screenings(
                customer_id="CUST-001",
                limit=10,
                offset=0,
            )
            
            print(f"   Total screenings: {history.total}")
            print()
            
            if history.screenings:
                print("   Recent screenings:")
                for screening in history.screenings[:5]:
                    print(f"   - {screening.screened_at}: {screening.overall_risk_level.upper()} risk")
            
        except APIError as e:
            print(f"   ✗ Failed to retrieve history: {e.message}")
        
        print()
        print("=" * 70)
        print("BATCH SCREENING COMPLETED")
        print("=" * 70)
        print()
        
        return 0


if __name__ == "__main__":
    sys.exit(main())

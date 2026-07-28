#!/usr/bin/env python3
"""
Example: Batch Processing Multiple Customers

This example demonstrates how to process liveness checks for multiple customers
and retrieve historical checks.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from liveness_client import LivenessDetectionClient, APIError


def main():
    """Main function demonstrating batch processing."""
    
    # Configuration
    BASE_URL = "http://localhost:8002"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "liveness-service"
    USERNAME = "kyc_analyst"
    PASSWORD = "kyc123"
    
    # Multiple customers to process
    customers = [
        {"id": "CUST-001", "image": "customer1_selfie.jpg"},
        {"id": "CUST-002", "image": "customer2_selfie.jpg"},
        {"id": "CUST-003", "image": "customer3_selfie.jpg"},
    ]
    
    print("=" * 60)
    print("Batch Processing Example")
    print("=" * 60)
    print()
    
    with LivenessDetectionClient(
        base_url=BASE_URL,
        keycloak_url=KEYCLOAK_URL,
        realm=REALM,
        client_id=CLIENT_ID,
        username=USERNAME,
        password=PASSWORD,
    ) as client:
        
        # Process multiple customers
        print(f"1. Processing {len(customers)} customers...")
        print()
        
        results = []
        for i, customer in enumerate(customers, 1):
            print(f"   [{i}/{len(customers)}] Processing {customer['id']}...")
            
            try:
                result = client.perform_passive_liveness_check(
                    customer_id=customer['id'],
                    image_file=customer['image'],
                )
                results.append(result)
                
                status_icon = "✓" if result.is_live else "✗"
                print(f"       {status_icon} {result.status} (confidence: {result.confidence_score:.2%})")
                
            except APIError as e:
                print(f"       ✗ Failed: {e.message}")
        
        print()
        
        # Summary
        print("=" * 60)
        print("BATCH PROCESSING SUMMARY")
        print("=" * 60)
        print()
        
        approved = sum(1 for r in results if r.status == "approved")
        rejected = sum(1 for r in results if r.status == "rejected")
        review = sum(1 for r in results if r.status == "review_required")
        
        print(f"Total Processed:   {len(results)}")
        print(f"Approved:          {approved}")
        print(f"Rejected:          {rejected}")
        print(f"Review Required:   {review}")
        print()
        
        # Retrieve historical checks for a customer
        print("2. Retrieving historical checks for CUST-001...")
        print()
        
        try:
            history = client.get_customer_liveness_checks(
                customer_id="CUST-001",
                limit=10,
                offset=0,
            )
            
            print(f"   Found {history.total} total checks")
            print()
            
            if history.checks:
                print("   Recent checks:")
                for check in history.checks[:5]:
                    print(f"   - {check.checked_at}: {check.status} ({check.confidence_score:.2%})")
            
        except APIError as e:
            print(f"   ✗ Failed to retrieve history: {e.message}")
        
        print()
        return 0


if __name__ == "__main__":
    sys.exit(main())

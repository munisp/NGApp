#!/usr/bin/env python3
"""
Example: Passive Liveness Detection with Face Matching

This example demonstrates how to perform passive liveness detection
with face matching against a reference image (e.g., ID card photo).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from liveness_client import LivenessDetectionClient, ValidationError, APIError


def main():
    """Main function demonstrating passive liveness with face matching."""
    
    # Configuration
    BASE_URL = "http://localhost:8002"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "liveness-service"
    USERNAME = "kyc_analyst"
    PASSWORD = "kyc123"
    
    # Customer and file information
    CUSTOMER_ID = "CUST-002"
    SELFIE_IMAGE = "selfie.jpg"  # Current selfie
    ID_CARD_IMAGE = "id_card_photo.jpg"  # Photo from ID card
    
    print("=" * 60)
    print("Passive Liveness with Face Matching Example")
    print("=" * 60)
    print()
    
    # Initialize client with context manager
    with LivenessDetectionClient(
        base_url=BASE_URL,
        keycloak_url=KEYCLOAK_URL,
        realm=REALM,
        client_id=CLIENT_ID,
        username=USERNAME,
        password=PASSWORD,
    ) as client:
        
        print("1. Performing liveness check with face matching...")
        print(f"   Customer ID: {CUSTOMER_ID}")
        print(f"   Selfie: {SELFIE_IMAGE}")
        print(f"   Reference: {ID_CARD_IMAGE}")
        print()
        
        try:
            # Perform check with face matching
            result = client.perform_passive_liveness_check(
                customer_id=CUSTOMER_ID,
                image_file=SELFIE_IMAGE,
                reference_image=ID_CARD_IMAGE,
            )
            
            print("   ✓ Check completed!")
            print()
            
            # Display results
            print("=" * 60)
            print("RESULTS")
            print("=" * 60)
            print()
            
            print(f"Check ID:          {result.check_id}")
            print(f"Is Live:           {result.is_live}")
            print(f"Confidence:        {result.confidence_score:.2%}")
            print(f"Status:            {result.status}")
            print()
            
            # Face matching results
            if result.face_matching:
                print("Face Matching Results:")
                print(f"  Match Found:     {result.face_matching.match_found}")
                print(f"  Similarity:      {result.face_matching.similarity_score:.2%}")
                print(f"  Confidence:      {result.face_matching.match_confidence}")
                print()
                
                # Decision
                print("=" * 60)
                if result.is_live and result.face_matching.match_found:
                    print("✓ VERIFICATION PASSED")
                    print("  - Liveness confirmed")
                    print("  - Face matches reference image")
                    print(f"  - Similarity: {result.face_matching.similarity_score:.2%}")
                elif not result.is_live:
                    print("✗ VERIFICATION FAILED")
                    print("  Reason: Liveness check failed")
                else:
                    print("✗ VERIFICATION FAILED")
                    print("  Reason: Face does not match reference")
                    print(f"  Similarity: {result.face_matching.similarity_score:.2%}")
                print("=" * 60)
            else:
                print("⚠ No face matching results available")
            
            print()
            return 0
            
        except ValidationError as e:
            print(f"   ✗ Validation error: {e.message}")
            return 1
            
        except APIError as e:
            print(f"   ✗ API error: {e.message}")
            return 1


if __name__ == "__main__":
    sys.exit(main())

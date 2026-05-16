#!/usr/bin/env python3
"""
Example: Passive Liveness Detection Check

This example demonstrates how to perform a passive liveness detection check
on a selfie image using the Liveness Detection Python SDK.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from liveness_client import (
    LivenessDetectionClient,
    LivenessType,
    ValidationError,
    APIError,
    UnauthorizedError,
)


def main():
    """Main function demonstrating passive liveness check."""
    
    # Configuration
    BASE_URL = "http://localhost:8002"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "liveness-service"
    USERNAME = "kyc_analyst"
    PASSWORD = "kyc123"
    
    # Customer and file information
    CUSTOMER_ID = "CUST-001"
    IMAGE_FILE = "selfie.jpg"  # Path to selfie image
    
    print("=" * 60)
    print("Passive Liveness Detection Example")
    print("=" * 60)
    print()
    
    # Initialize client
    print("1. Initializing Liveness Detection Client...")
    try:
        client = LivenessDetectionClient(
            base_url=BASE_URL,
            keycloak_url=KEYCLOAK_URL,
            realm=REALM,
            client_id=CLIENT_ID,
            username=USERNAME,
            password=PASSWORD,
            timeout=30,
            max_retries=3,
        )
        print("   ✓ Client initialized successfully")
        print()
    except Exception as e:
        print(f"   ✗ Failed to initialize client: {e}")
        return 1
    
    try:
        # Check service health
        print("2. Checking service health...")
        try:
            health = client.health_check()
            print(f"   ✓ Service is healthy: {health.status}")
            print()
        except APIError as e:
            print(f"   ⚠ Service health check failed: {e}")
            print("   Continuing anyway...")
            print()
        
        # Perform passive liveness check
        print("3. Performing passive liveness detection...")
        print(f"   Customer ID: {CUSTOMER_ID}")
        print(f"   Image file: {IMAGE_FILE}")
        print()
        
        try:
            result = client.perform_passive_liveness_check(
                customer_id=CUSTOMER_ID,
                image_file=IMAGE_FILE,
            )
            
            print("   ✓ Liveness check completed!")
            print()
            print("=" * 60)
            print("RESULTS")
            print("=" * 60)
            print()
            
            # Display results
            print(f"Check ID:          {result.check_id}")
            print(f"Customer ID:       {result.customer_id}")
            print(f"Liveness Type:     {result.liveness_type}")
            print(f"Is Live:           {result.is_live}")
            print(f"Confidence Score:  {result.confidence_score:.2%}")
            print(f"Status:            {result.status}")
            print(f"Checked At:        {result.checked_at}")
            print(f"Checked By:        {result.checked_by}")
            print()
            
            # Anti-spoofing results
            print("Anti-Spoofing Detection:")
            print(f"  Photo Attack:    {result.anti_spoofing.is_photo}")
            print(f"  Video Attack:    {result.anti_spoofing.is_video}")
            print(f"  Mask Attack:     {result.anti_spoofing.is_mask}")
            print(f"  Deepfake:        {result.anti_spoofing.is_deepfake}")
            print(f"  Texture Score:   {result.anti_spoofing.texture_score:.2%}")
            print(f"  Color Score:     {result.anti_spoofing.color_score:.2%}")
            print(f"  Reflection:      {result.anti_spoofing.reflection_score:.2%}")
            print(f"  Depth Score:     {result.anti_spoofing.depth_score:.2%}")
            print()
            
            # Face quality
            print("Face Quality:")
            print(f"  Brightness:      {result.face_quality.brightness:.2%}")
            print(f"  Sharpness:       {result.face_quality.sharpness:.2%}")
            print(f"  Frontal Score:   {result.face_quality.frontal_score:.2%}")
            print()
            
            # Face matching (if performed)
            if result.face_matching:
                print("Face Matching:")
                print(f"  Match Found:     {result.face_matching.match_found}")
                print(f"  Similarity:      {result.face_matching.similarity_score:.2%}")
                print(f"  Confidence:      {result.face_matching.match_confidence}")
                print()
            
            # Notes
            if result.notes:
                print(f"Notes: {result.notes}")
                print()
            
            # Decision
            print("=" * 60)
            if result.is_live and result.status == "approved":
                print("✓ LIVENESS CHECK PASSED")
                print(f"  Confidence: {result.confidence_score:.2%}")
            else:
                print("✗ LIVENESS CHECK FAILED")
                if result.anti_spoofing.is_photo:
                    print("  Reason: Photo attack detected")
                elif result.anti_spoofing.is_video:
                    print("  Reason: Video replay attack detected")
                elif result.anti_spoofing.is_mask:
                    print("  Reason: Mask detected")
                elif result.anti_spoofing.is_deepfake:
                    print("  Reason: Deepfake detected")
                else:
                    print(f"  Reason: Low confidence ({result.confidence_score:.2%})")
            print("=" * 60)
            print()
            
            # Get check by ID (demonstrating retrieval)
            print("4. Retrieving check by ID...")
            retrieved = client.get_liveness_check(result.check_id)
            print(f"   ✓ Retrieved check: {retrieved.check_id}")
            print(f"   Status: {retrieved.status}")
            print()
            
            return 0
            
        except ValidationError as e:
            print(f"   ✗ Validation error: {e.message}")
            if e.details:
                print(f"   Details: {e.details}")
            return 1
            
        except APIError as e:
            print(f"   ✗ API error: {e.message}")
            if e.status_code:
                print(f"   Status code: {e.status_code}")
            return 1
    
    except UnauthorizedError as e:
        print(f"   ✗ Authentication failed: {e.message}")
        print("   Please check your credentials")
        return 1
    
    except Exception as e:
        print(f"   ✗ Unexpected error: {e}")
        return 1
    
    finally:
        # Clean up
        print("5. Closing client...")
        client.close()
        print("   ✓ Client closed")
        print()


if __name__ == "__main__":
    sys.exit(main())

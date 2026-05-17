#!/usr/bin/env python3
"""
Example: Active Liveness Detection Check

This example demonstrates how to perform an active liveness detection check
on a video recording using the Liveness Detection Python SDK.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from liveness_client import LivenessDetectionClient, APIError


def main():
    """Main function demonstrating active liveness check."""
    
    # Configuration
    BASE_URL = "http://localhost:8002"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "liveness-service"
    USERNAME = "kyc_analyst"
    PASSWORD = "kyc123"
    
    # Customer and file information
    CUSTOMER_ID = "CUST-003"
    VIDEO_FILE = "liveness_video.mp4"  # Video recording
    
    print("=" * 60)
    print("Active Liveness Detection Example")
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
        
        print("1. Performing active liveness detection...")
        print(f"   Customer ID: {CUSTOMER_ID}")
        print(f"   Video file: {VIDEO_FILE}")
        print()
        
        try:
            result = client.perform_active_liveness_check(
                customer_id=CUSTOMER_ID,
                video_file=VIDEO_FILE,
            )
            
            print("   ✓ Check completed!")
            print()
            
            # Display results
            print("=" * 60)
            print("RESULTS")
            print("=" * 60)
            print()
            
            print(f"Check ID:          {result.check_id}")
            print(f"Liveness Type:     {result.liveness_type}")
            print(f"Is Live:           {result.is_live}")
            print(f"Confidence:        {result.confidence_score:.2%}")
            print(f"Status:            {result.status}")
            print()
            
            # Anti-spoofing
            print("Anti-Spoofing Detection:")
            print(f"  Video Replay:    {result.anti_spoofing.is_video}")
            print(f"  Deepfake:        {result.anti_spoofing.is_deepfake}")
            print()
            
            # Decision
            print("=" * 60)
            if result.is_live and result.status == "approved":
                print("✓ ACTIVE LIVENESS CHECK PASSED")
            else:
                print("✗ ACTIVE LIVENESS CHECK FAILED")
                if result.anti_spoofing.is_video:
                    print("  Reason: Video replay attack detected")
                elif result.anti_spoofing.is_deepfake:
                    print("  Reason: Deepfake detected")
            print("=" * 60)
            print()
            
            return 0
            
        except APIError as e:
            print(f"   ✗ API error: {e.message}")
            return 1


if __name__ == "__main__":
    sys.exit(main())

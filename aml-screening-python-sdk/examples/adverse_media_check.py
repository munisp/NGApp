#!/usr/bin/env python3
"""
Example: Adverse Media Check

This example demonstrates how to check for adverse media mentions related to
financial crime, corruption, fraud, money laundering, and other criminal activities.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from aml_client import AMLScreeningClient, APIError


def main():
    """Main function demonstrating adverse media check."""
    
    # Configuration
    BASE_URL = "http://localhost:8003"
    KEYCLOAK_URL = "http://localhost:8080"
    REALM = "kyc-kyb-system"
    CLIENT_ID = "aml-screening-service"
    USERNAME = "compliance_officer"
    PASSWORD = "compliance123"
    
    print("=" * 70)
    print("Adverse Media Check Example")
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
        
        # 1. Check individual for adverse media
        print("1. Checking Individual for Adverse Media...")
        print()
        
        try:
            result = client.check_adverse_media_individual(
                name="Ibrahim Musa",
                date_of_birth="1980-05-10",
                country="Nigeria",
                comprehensive=True,  # Comprehensive search
            )
            
            print(f"   Check ID:     {result.check_id}")
            print(f"   Name:         {result.name}")
            print(f"   Entity Type:  {result.entity_type}")
            print()
            
            if result.mentions_found:
                print(f"   ⚠️  ADVERSE MEDIA MENTIONS FOUND: {result.total_mentions}")
                print(f"   Risk Level: {result.risk_level.upper()}")
                print()
                
                for i, mention in enumerate(result.mentions, 1):
                    print(f"   Mention {i}:")
                    print(f"     Title:      {mention.title}")
                    print(f"     Source:     {mention.source}")
                    print(f"     Published:  {mention.published_date}")
                    print(f"     Type:       {mention.media_type.value}")
                    print(f"     Severity:   {mention.severity.upper()}")
                    print(f"     Relevance:  {mention.relevance_score:.2%}")
                    print(f"     Snippet:    {mention.snippet[:100]}...")
                    if mention.url:
                        print(f"     URL:        {mention.url}")
                    print()
            else:
                print(f"   ✓ NO ADVERSE MEDIA MENTIONS FOUND")
                print(f"   Risk Level: {result.risk_level.upper()}")
            
        except APIError as e:
            print(f"   ✗ Adverse media check failed: {e.message}")
        
        print()
        print("-" * 70)
        print()
        
        # 2. Check entity for adverse media
        print("2. Checking Entity/Organization for Adverse Media...")
        print()
        
        try:
            result = client.check_adverse_media_entity(
                name="Global Trading Company",
                country="Nigeria",
                comprehensive=False,  # Standard search
            )
            
            print(f"   Check ID:     {result.check_id}")
            print(f"   Name:         {result.name}")
            print(f"   Entity Type:  {result.entity_type}")
            print()
            
            if result.mentions_found:
                print(f"   ⚠️  ADVERSE MEDIA MENTIONS FOUND: {result.total_mentions}")
                print(f"   Risk Level: {result.risk_level.upper()}")
                print()
                
                # Group mentions by type
                mentions_by_type = {}
                for mention in result.mentions:
                    media_type = mention.media_type.value
                    if media_type not in mentions_by_type:
                        mentions_by_type[media_type] = []
                    mentions_by_type[media_type].append(mention)
                
                print("   Mentions by Type:")
                for media_type, mentions in mentions_by_type.items():
                    print(f"     {media_type}: {len(mentions)}")
                print()
                
                # Show top 3 mentions
                print("   Top 3 Mentions:")
                for i, mention in enumerate(result.mentions[:3], 1):
                    print(f"     {i}. {mention.title}")
                    print(f"        {mention.source} - {mention.published_date}")
                    print()
            else:
                print(f"   ✓ NO ADVERSE MEDIA MENTIONS FOUND")
                print(f"   Risk Level: {result.risk_level.upper()}")
            
        except APIError as e:
            print(f"   ✗ Adverse media check failed: {e.message}")
        
        print()
        print("=" * 70)
        print("ADVERSE MEDIA CHECK COMPLETED")
        print("=" * 70)
        print()
        
        return 0


if __name__ == "__main__":
    sys.exit(main())

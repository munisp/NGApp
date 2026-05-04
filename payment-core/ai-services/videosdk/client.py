#!/usr/bin/env python3
"""
VideoSDK Client for AI Telephony Service
"""

import os
import json
import time
import logging
import asyncio
import hmac
import hashlib
import base64
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime, timedelta
import aiohttp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("videosdk_client")

class VideoSDKClient:
    """Client for interacting with VideoSDK API"""
    
    def __init__(self, api_key: str, api_secret: str):
        """Initialize the VideoSDK client"""
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = "https://api.videosdk.live/v2"
        self.session = None
    
    async def initialize(self):
        """Initialize the client"""
        self.session = aiohttp.ClientSession()
        
        # Check if API key and secret are valid
        try:
            await self.get_account_details()
            logger.info("VideoSDK client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize VideoSDK client: {e}")
            raise
    
    async def close(self):
        """Close the client session"""
        if self.session:
            await self.session.close()
    
    async def get_account_details(self) -> Dict[str, Any]:
        """Get account details"""
        endpoint = "/account"
        
        response = await self._make_request("GET", endpoint)
        return response
    
    async def initiate_call(
        self,
        phone_number: str,
        webhook_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Initiate an outbound call"""
        endpoint = "/telephony/calls"
        
        # Format phone number to E.164 format if not already
        if not phone_number.startswith("+"):
            # Assume Nigerian number if no country code
            if phone_number.startswith("0"):
                phone_number = "+234" + phone_number[1:]
            else:
                phone_number = "+234" + phone_number
        
        payload = {
            "to": phone_number,
            "record": True,
            "mode": "ai-agent"  # Use AI agent mode
        }
        
        if webhook_url:
            payload["webhookUrl"] = webhook_url
        
        if metadata:
            payload["metadata"] = metadata
        
        response = await self._make_request("POST", endpoint, payload)
        return response
    
    async def get_call_status(self, call_id: str) -> Dict[str, Any]:
        """Get status of a call"""
        endpoint = f"/telephony/calls/{call_id}"
        
        response = await self._make_request("GET", endpoint)
        return response
    
    async def end_call(self, call_id: str) -> Dict[str, Any]:
        """End an active call"""
        endpoint = f"/telephony/calls/{call_id}/end"
        
        response = await self._make_request("POST", endpoint)
        return response
    
    async def list_calls(
        self,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        page: int = 1,
        per_page: int = 10
    ) -> Dict[str, Any]:
        """List calls with optional filters"""
        endpoint = "/telephony/calls"
        params = {"page": page, "per_page": per_page}
        
        if status:
            params["status"] = status
        
        if from_date:
            params["from"] = from_date
        
        if to_date:
            params["to"] = to_date
        
        response = await self._make_request("GET", endpoint, params=params)
        return response
    
    async def get_call_recording(self, call_id: str) -> Dict[str, Any]:
        """Get recording URL for a call"""
        endpoint = f"/telephony/calls/{call_id}/recordings"
        
        response = await self._make_request("GET", endpoint)
        return response
    
    async def create_ai_agent(
        self,
        name: str,
        description: str,
        prompt: str,
        voice: str = "male",
        language: str = "en-US"
    ) -> Dict[str, Any]:
        """Create an AI agent for telephony"""
        endpoint = "/telephony/ai-agents"
        
        payload = {
            "name": name,
            "description": description,
            "prompt": prompt,
            "voice": voice,
            "language": language
        }
        
        response = await self._make_request("POST", endpoint, payload)
        return response
    
    async def list_ai_agents(self) -> Dict[str, Any]:
        """List all AI agents"""
        endpoint = "/telephony/ai-agents"
        
        response = await self._make_request("GET", endpoint)
        return response
    
    async def get_ai_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get details of an AI agent"""
        endpoint = f"/telephony/ai-agents/{agent_id}"
        
        response = await self._make_request("GET", endpoint)
        return response
    
    async def update_ai_agent(
        self,
        agent_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        prompt: Optional[str] = None,
        voice: Optional[str] = None,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update an AI agent"""
        endpoint = f"/telephony/ai-agents/{agent_id}"
        
        payload = {}
        if name:
            payload["name"] = name
        if description:
            payload["description"] = description
        if prompt:
            payload["prompt"] = prompt
        if voice:
            payload["voice"] = voice
        if language:
            payload["language"] = language
        
        response = await self._make_request("PATCH", endpoint, payload)
        return response
    
    async def delete_ai_agent(self, agent_id: str) -> Dict[str, Any]:
        """Delete an AI agent"""
        endpoint = f"/telephony/ai-agents/{agent_id}"
        
        response = await self._make_request("DELETE", endpoint)
        return response
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make a request to the VideoSDK API"""
        url = f"{self.base_url}{endpoint}"
        
        # Generate JWT token for authentication
        token = self._generate_token()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            if method == "GET":
                async with self.session.get(url, headers=headers, params=params) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise Exception(f"VideoSDK API error: {response.status} - {text}")
                    return await response.json()
            elif method == "POST":
                async with self.session.post(url, headers=headers, json=payload) as response:
                    if response.status not in [200, 201]:
                        text = await response.text()
                        raise Exception(f"VideoSDK API error: {response.status} - {text}")
                    return await response.json()
            elif method == "PATCH":
                async with self.session.patch(url, headers=headers, json=payload) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise Exception(f"VideoSDK API error: {response.status} - {text}")
                    return await response.json()
            elif method == "DELETE":
                async with self.session.delete(url, headers=headers) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise Exception(f"VideoSDK API error: {response.status} - {text}")
                    return await response.json()
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
        except aiohttp.ClientError as e:
            logger.error(f"VideoSDK API request failed: {e}")
            raise
    
    def _generate_token(self, expires_in: int = 3600) -> str:
        """Generate JWT token for VideoSDK API authentication"""
        # Create payload
        payload = {
            "apikey": self.api_key,
            "permissions": ["allow_join", "allow_mod"],  # Permissions for the token
            "exp": int(time.time()) + expires_in  # Token expiration time
        }
        
        # Convert payload to JSON string
        payload_str = json.dumps(payload)
        
        # Create signature
        signature = hmac.new(
            self.api_secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).digest()
        
        # Encode payload and signature
        payload_base64 = base64.urlsafe_b64encode(payload_str.encode()).decode().rstrip("=")
        signature_base64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
        
        # Create JWT token
        token = f"{payload_base64}.{signature_base64}"
        
        return token

# Example usage
async def main():
    client = VideoSDKClient(
        api_key=os.getenv("VIDEOSDK_API_KEY"),
        api_secret=os.getenv("VIDEOSDK_API_SECRET")
    )
    await client.initialize()
    
    # Get account details
    account = await client.get_account_details()
    print(f"Account details: {account}")
    
    # List AI agents
    agents = await client.list_ai_agents()
    print(f"AI agents: {agents}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(main())


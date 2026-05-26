"""
Keycloak Authentication Adapter for Payment Switch Platform

Provides OIDC authentication using Keycloak, replacing Manus OAuth.
"""

import httpx
import jwt
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import asyncio
from functools import lru_cache

logger = logging.getLogger(__name__)


@dataclass
class KeycloakConfig:
    """Keycloak connection configuration"""
    url: str
    realm: str
    client_id: str
    client_secret: Optional[str] = None
    verify_ssl: bool = True


@dataclass
class TokenResponse:
    """Keycloak token endpoint response"""
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None
    refresh_expires_in: Optional[int] = None
    scope: str = ""
    id_token: Optional[str] = None
    session_state: Optional[str] = None


@dataclass
class UserInfo:
    """Keycloak userinfo endpoint response"""
    sub: str
    name: Optional[str] = None
    preferred_username: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    email: Optional[str] = None
    email_verified: bool = False
    realm_access: Optional[Dict[str, List[str]]] = None
    resource_access: Optional[Dict[str, Dict[str, List[str]]]] = None

    def get_roles(self) -> List[str]:
        """Get realm-level roles"""
        if self.realm_access and "roles" in self.realm_access:
            return self.realm_access["roles"]
        return []

    def has_role(self, role: str) -> bool:
        """Check if user has a specific role"""
        return role in self.get_roles()

    def get_client_roles(self, client_id: str) -> List[str]:
        """Get roles for a specific client"""
        if self.resource_access and client_id in self.resource_access:
            return self.resource_access[client_id].get("roles", [])
        return []


@dataclass
class IntrospectResponse:
    """Token introspection response"""
    active: bool
    sub: Optional[str] = None
    client_id: Optional[str] = None
    username: Optional[str] = None
    token_type: Optional[str] = None
    exp: Optional[int] = None
    iat: Optional[int] = None
    aud: Optional[List[str]] = None
    iss: Optional[str] = None
    realm_access: Optional[Dict[str, List[str]]] = None


class KeycloakAdapter:
    """Keycloak authentication adapter"""

    def __init__(self, config: KeycloakConfig):
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None
        self._jwks_cache: Dict[str, Any] = {}
        self._jwks_expires_at: Optional[datetime] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                verify=self.config.verify_ssl
            )
        return self._client

    async def close(self):
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _get_base_url(self) -> str:
        return f"{self.config.url}/realms/{self.config.realm}/protocol/openid-connect"

    def get_authorization_url(
        self,
        redirect_uri: str,
        state: str,
        nonce: Optional[str] = None,
        scope: str = "openid profile email"
    ) -> str:
        """Get the Keycloak authorization URL"""
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "state": state,
        }
        if nonce:
            params["nonce"] = nonce

        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self._get_base_url()}/auth?{query}"

    async def exchange_code(
        self,
        code: str,
        redirect_uri: str
    ) -> TokenResponse:
        """Exchange authorization code for tokens"""
        url = f"{self._get_base_url()}/token"

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.config.client_id,
        }
        if self.config.client_secret:
            data["client_secret"] = self.config.client_secret

        response = await self.client.post(
            url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.text}")
            raise Exception(f"Token exchange failed: {response.status_code}")

        result = response.json()
        return TokenResponse(
            access_token=result["access_token"],
            token_type=result["token_type"],
            expires_in=result["expires_in"],
            refresh_token=result.get("refresh_token"),
            refresh_expires_in=result.get("refresh_expires_in"),
            scope=result.get("scope", ""),
            id_token=result.get("id_token"),
            session_state=result.get("session_state"),
        )

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Refresh an access token"""
        url = f"{self._get_base_url()}/token"

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.config.client_id,
        }
        if self.config.client_secret:
            data["client_secret"] = self.config.client_secret

        response = await self.client.post(
            url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        if response.status_code != 200:
            logger.error(f"Token refresh failed: {response.text}")
            raise Exception(f"Token refresh failed: {response.status_code}")

        result = response.json()
        return TokenResponse(
            access_token=result["access_token"],
            token_type=result["token_type"],
            expires_in=result["expires_in"],
            refresh_token=result.get("refresh_token"),
            refresh_expires_in=result.get("refresh_expires_in"),
            scope=result.get("scope", ""),
            id_token=result.get("id_token"),
            session_state=result.get("session_state"),
        )

    async def get_user_info(self, access_token: str) -> UserInfo:
        """Get user information using access token"""
        url = f"{self._get_base_url()}/userinfo"

        response = await self.client.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if response.status_code != 200:
            logger.error(f"Userinfo request failed: {response.text}")
            raise Exception(f"Userinfo request failed: {response.status_code}")

        result = response.json()
        return UserInfo(
            sub=result["sub"],
            name=result.get("name"),
            preferred_username=result.get("preferred_username"),
            given_name=result.get("given_name"),
            family_name=result.get("family_name"),
            email=result.get("email"),
            email_verified=result.get("email_verified", False),
            realm_access=result.get("realm_access"),
            resource_access=result.get("resource_access"),
        )

    async def introspect_token(self, token: str) -> IntrospectResponse:
        """Introspect a token"""
        url = f"{self._get_base_url()}/token/introspect"

        data = {
            "token": token,
            "client_id": self.config.client_id,
            "token_type_hint": "access_token",
        }
        if self.config.client_secret:
            data["client_secret"] = self.config.client_secret

        response = await self.client.post(
            url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        if response.status_code != 200:
            logger.error(f"Token introspection failed: {response.text}")
            raise Exception(f"Token introspection failed: {response.status_code}")

        result = response.json()
        return IntrospectResponse(
            active=result["active"],
            sub=result.get("sub"),
            client_id=result.get("client_id"),
            username=result.get("username"),
            token_type=result.get("token_type"),
            exp=result.get("exp"),
            iat=result.get("iat"),
            aud=result.get("aud"),
            iss=result.get("iss"),
            realm_access=result.get("realm_access"),
        )

    async def logout(self, refresh_token: str) -> None:
        """Logout a user"""
        url = f"{self._get_base_url()}/logout"

        data = {
            "refresh_token": refresh_token,
            "client_id": self.config.client_id,
        }
        if self.config.client_secret:
            data["client_secret"] = self.config.client_secret

        response = await self.client.post(
            url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        if response.status_code not in (200, 204):
            logger.error(f"Logout failed: {response.text}")
            raise Exception(f"Logout failed: {response.status_code}")

    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate a JWT token locally"""
        try:
            # First, try to introspect the token
            introspect_result = await self.introspect_token(token)
            if not introspect_result.active:
                return None

            # Decode the token (without verification for claims extraction)
            # In production, you should verify the signature using JWKS
            decoded = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            return decoded
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return None

    async def get_jwks(self) -> Dict[str, Any]:
        """Get JWKS from Keycloak"""
        if self._jwks_cache and self._jwks_expires_at and datetime.now() < self._jwks_expires_at:
            return self._jwks_cache

        url = f"{self._get_base_url()}/certs"
        response = await self.client.get(url)

        if response.status_code != 200:
            raise Exception(f"Failed to fetch JWKS: {response.status_code}")

        self._jwks_cache = response.json()
        self._jwks_expires_at = datetime.now() + timedelta(hours=1)
        return self._jwks_cache


# Singleton instance for convenience
_keycloak_adapter: Optional[KeycloakAdapter] = None


def get_keycloak_adapter() -> KeycloakAdapter:
    """Get the global Keycloak adapter instance"""
    global _keycloak_adapter
    if _keycloak_adapter is None:
        import os
        config = KeycloakConfig(
            url=os.getenv("KEYCLOAK_URL", "http://keycloak:8080"),
            realm=os.getenv("KEYCLOAK_REALM", "payment-switch"),
            client_id=os.getenv("KEYCLOAK_CLIENT_ID", "payment-switch-api"),
            client_secret=os.getenv("KEYCLOAK_CLIENT_SECRET"),
        )
        _keycloak_adapter = KeycloakAdapter(config)
    return _keycloak_adapter


def init_keycloak_adapter(config: KeycloakConfig) -> KeycloakAdapter:
    """Initialize the global Keycloak adapter with custom config"""
    global _keycloak_adapter
    _keycloak_adapter = KeycloakAdapter(config)
    return _keycloak_adapter

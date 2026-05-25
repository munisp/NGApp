"""Keycloak async client with token validation, caching, KYC attributes, and RBAC."""

from __future__ import annotations

import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger("ngapp.infra.keycloak")


class KeycloakClient:
    def __init__(self, realm_url: str, client_id: str, client_secret: str, admin_url: str):
        self._realm_url = realm_url
        self._client_id = client_id
        self._client_secret = client_secret
        self._admin_url = admin_url
        self._http = httpx.AsyncClient(timeout=10.0)
        self._token_cache: dict[str, tuple[dict, float]] = {}

    async def ping(self):
        resp = await self._http.get(f"{self._realm_url}/.well-known/openid-configuration")
        if resp.status_code != 200:
            raise ConnectionError(f"Keycloak unhealthy: {resp.status_code}")

    async def validate_token(self, token: str) -> dict:
        now = time.time()
        if token in self._token_cache:
            claims, expires = self._token_cache[token]
            if now < expires:
                return claims
        resp = await self._http.get(
            f"{self._realm_url}/protocol/openid-connect/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise ValueError(f"Invalid token: status {resp.status_code}")
        claims = resp.json()
        self._token_cache[token] = (claims, now + 300)
        return claims

    async def get_kyc_level(self, token: str) -> int:
        claims = await self.validate_token(token)
        level = claims.get("kyc_level", 0)
        if isinstance(level, str):
            return int(level) if level.isdigit() else 0
        return int(level)

    async def get_service_token(self) -> str:
        resp = await self._http.post(
            f"{self._realm_url}/protocol/openid-connect/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    async def update_user_kyc_level(self, user_id: str, kyc_level: int, kyc_status: str):
        admin_token = await self.get_service_token()
        realm = self._realm_url.split("/realms/")[-1] if "/realms/" in self._realm_url else "insurance"
        resp = await self._http.put(
            f"{self._admin_url}/admin/realms/{realm}/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json={"attributes": {"kyc_level": [str(kyc_level)], "kyc_status": [kyc_status]}},
        )
        if resp.status_code >= 400:
            logger.warning("update_user_kyc_failed: %s: %s", user_id, resp.text)

    def invalidate_token_cache(self, token: str):
        self._token_cache.pop(token, None)

"""Authentication module for Keycloak OAuth2."""

import time
from typing import Optional
from datetime import datetime, timedelta
import requests
from jose import jwt, JWTError


class KeycloakAuth:
    """Keycloak OAuth2 authentication handler."""
    
    def __init__(
        self,
        keycloak_url: str,
        realm: str,
        client_id: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        """
        Initialize Keycloak authentication.
        
        Args:
            keycloak_url: Keycloak server URL (e.g., http://localhost:8080)
            realm: Keycloak realm name
            client_id: Client ID
            username: Username for password grant (optional)
            password: Password for password grant (optional)
            client_secret: Client secret for client credentials grant (optional)
        """
        self.keycloak_url = keycloak_url.rstrip('/')
        self.realm = realm
        self.client_id = client_id
        self.username = username
        self.password = password
        self.client_secret = client_secret
        
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
    
    @property
    def token_url(self) -> str:
        """Get token endpoint URL."""
        return f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/token"
    
    def get_access_token(self) -> str:
        """
        Get valid access token, refreshing if necessary.
        
        Returns:
            Valid access token
            
        Raises:
            AuthenticationError: If authentication fails
        """
        # Check if current token is still valid
        if self._access_token and self._token_expires_at:
            if datetime.utcnow() < self._token_expires_at - timedelta(seconds=30):
                return self._access_token
        
        # Try to refresh token if available
        if self._refresh_token:
            try:
                return self._refresh_access_token()
            except Exception:
                # Refresh failed, get new token
                pass
        
        # Get new token
        return self._get_new_token()
    
    def _get_new_token(self) -> str:
        """
        Get new access token from Keycloak.
        
        Returns:
            New access token
            
        Raises:
            AuthenticationError: If authentication fails
        """
        data = {
            "client_id": self.client_id,
        }
        
        # Use password grant if username/password provided
        if self.username and self.password:
            data.update({
                "grant_type": "password",
                "username": self.username,
                "password": self.password,
            })
        # Use client credentials grant if client secret provided
        elif self.client_secret:
            data.update({
                "grant_type": "client_credentials",
                "client_secret": self.client_secret,
            })
        else:
            raise AuthenticationError(
                "Either username/password or client_secret must be provided"
            )
        
        try:
            response = requests.post(self.token_url, data=data, timeout=10)
            response.raise_for_status()
            
            token_data = response.json()
            self._access_token = token_data["access_token"]
            self._refresh_token = token_data.get("refresh_token")
            
            # Calculate token expiration time
            expires_in = token_data.get("expires_in", 300)
            self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return self._access_token
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to get access token: {str(e)}")
    
    def _refresh_access_token(self) -> str:
        """
        Refresh access token using refresh token.
        
        Returns:
            Refreshed access token
            
        Raises:
            AuthenticationError: If refresh fails
        """
        if not self._refresh_token:
            raise AuthenticationError("No refresh token available")
        
        data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "refresh_token": self._refresh_token,
        }
        
        if self.client_secret:
            data["client_secret"] = self.client_secret
        
        try:
            response = requests.post(self.token_url, data=data, timeout=10)
            response.raise_for_status()
            
            token_data = response.json()
            self._access_token = token_data["access_token"]
            self._refresh_token = token_data.get("refresh_token")
            
            # Calculate token expiration time
            expires_in = token_data.get("expires_in", 300)
            self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            return self._access_token
            
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"Failed to refresh access token: {str(e)}")
    
    def decode_token(self, token: Optional[str] = None) -> dict:
        """
        Decode JWT token (without verification).
        
        Args:
            token: Token to decode (uses current token if not provided)
            
        Returns:
            Decoded token payload
            
        Raises:
            AuthenticationError: If token decode fails
        """
        if token is None:
            token = self.get_access_token()
        
        try:
            # Decode without verification (for inspection only)
            return jwt.get_unverified_claims(token)
        except JWTError as e:
            raise AuthenticationError(f"Failed to decode token: {str(e)}")
    
    def get_user_roles(self) -> list[str]:
        """
        Get user roles from current token.
        
        Returns:
            List of user roles
        """
        try:
            payload = self.decode_token()
            realm_access = payload.get("realm_access", {})
            return realm_access.get("roles", [])
        except Exception:
            return []
    
    def logout(self):
        """Logout and clear tokens."""
        if self._refresh_token:
            data = {
                "client_id": self.client_id,
                "refresh_token": self._refresh_token,
            }
            
            if self.client_secret:
                data["client_secret"] = self.client_secret
            
            logout_url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/logout"
            
            try:
                requests.post(logout_url, data=data, timeout=10)
            except Exception:
                pass  # Ignore logout errors
        
        # Clear tokens
        self._access_token = None
        self._refresh_token = None
        self._token_expires_at = None


class AuthenticationError(Exception):
    """Authentication error exception."""
    pass

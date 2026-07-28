"""Main API client for Liveness Detection Service."""

import os
from typing import Optional, BinaryIO, Union
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .auth import KeycloakAuth, AuthenticationError
from .models import (
    LivenessCheckRequest,
    LivenessCheckResponse,
    LivenessCheckListResponse,
    HealthCheckResponse,
    ErrorResponse,
    LivenessType,
)
from .exceptions import (
    LivenessDetectionError,
    APIError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
)


class LivenessDetectionClient:
    """Client for Liveness Detection Service API."""
    
    def __init__(
        self,
        base_url: str,
        keycloak_url: str,
        realm: str,
        client_id: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        client_secret: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 3,
    ):
        """
        Initialize Liveness Detection client.
        
        Args:
            base_url: Base URL of Liveness Detection Service (e.g., http://localhost:8002)
            keycloak_url: Keycloak server URL
            realm: Keycloak realm name
            client_id: Keycloak client ID
            username: Username for authentication (optional)
            password: Password for authentication (optional)
            client_secret: Client secret for authentication (optional)
            timeout: Request timeout in seconds (default: 30)
            max_retries: Maximum number of retries for failed requests (default: 3)
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        
        # Initialize authentication
        self.auth = KeycloakAuth(
            keycloak_url=keycloak_url,
            realm=realm,
            client_id=client_id,
            username=username,
            password=password,
            client_secret=client_secret,
        )
        
        # Initialize HTTP session with retry logic
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def _get_headers(self) -> dict:
        """Get request headers with authentication token."""
        try:
            token = self.auth.get_access_token()
            return {
                "Authorization": f"Bearer {token}",
            }
        except AuthenticationError as e:
            raise UnauthorizedError(f"Authentication failed: {str(e)}")
    
    def _handle_response(self, response: requests.Response) -> dict:
        """
        Handle API response and raise appropriate exceptions.
        
        Args:
            response: HTTP response object
            
        Returns:
            Response JSON data
            
        Raises:
            APIError: For various API errors
        """
        try:
            data = response.json()
        except ValueError:
            data = {"message": response.text}
        
        if response.status_code == 200 or response.status_code == 201:
            return data
        elif response.status_code == 400:
            raise ValidationError(data.get("message", "Validation error"), details=data)
        elif response.status_code == 401:
            raise UnauthorizedError(data.get("message", "Unauthorized"))
        elif response.status_code == 403:
            raise ForbiddenError(data.get("message", "Forbidden"))
        elif response.status_code == 404:
            raise NotFoundError(data.get("message", "Resource not found"))
        elif response.status_code >= 500:
            raise APIError(
                f"Server error: {data.get('message', 'Internal server error')}",
                status_code=response.status_code,
            )
        else:
            raise APIError(
                f"API error: {data.get('message', 'Unknown error')}",
                status_code=response.status_code,
            )
    
    def health_check(self) -> HealthCheckResponse:
        """
        Check service health status.
        
        Returns:
            Health check response
            
        Raises:
            APIError: If health check fails
        """
        url = f"{self.base_url}/health"
        
        try:
            response = self.session.get(url, timeout=self.timeout)
            data = self._handle_response(response)
            return HealthCheckResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Health check failed: {str(e)}")
    
    def perform_liveness_check(
        self,
        customer_id: str,
        liveness_type: Union[LivenessType, str],
        file: Union[str, Path, BinaryIO],
        reference_image: Optional[Union[str, Path, BinaryIO]] = None,
    ) -> LivenessCheckResponse:
        """
        Perform liveness detection check.
        
        Args:
            customer_id: Customer ID
            liveness_type: Type of liveness check ('passive' or 'active')
            file: Image file (for passive) or video file (for active) - can be file path or file object
            reference_image: Reference image for face matching (optional) - can be file path or file object
            
        Returns:
            Liveness check response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/liveness/check"
        headers = self._get_headers()
        
        # Prepare form data
        data = {
            "customer_id": customer_id,
            "liveness_type": liveness_type.value if isinstance(liveness_type, LivenessType) else liveness_type,
        }
        
        # Prepare files
        files = {}
        
        # Handle main file
        if isinstance(file, (str, Path)):
            file_path = Path(file)
            if not file_path.exists():
                raise ValidationError(f"File not found: {file}")
            files["file"] = (file_path.name, open(file_path, "rb"))
        else:
            files["file"] = file
        
        # Handle reference image if provided
        if reference_image is not None:
            if isinstance(reference_image, (str, Path)):
                ref_path = Path(reference_image)
                if not ref_path.exists():
                    raise ValidationError(f"Reference image not found: {reference_image}")
                files["reference_image"] = (ref_path.name, open(ref_path, "rb"))
            else:
                files["reference_image"] = reference_image
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                data=data,
                files=files,
                timeout=self.timeout,
            )
            response_data = self._handle_response(response)
            return LivenessCheckResponse(**response_data)
            
        except requests.exceptions.RequestException as e:
            raise APIError(f"Liveness check failed: {str(e)}")
        finally:
            # Close file handles if we opened them
            for file_obj in files.values():
                if hasattr(file_obj[1], 'close'):
                    file_obj[1].close()
    
    def get_liveness_check(self, check_id: str) -> LivenessCheckResponse:
        """
        Get liveness check result by ID.
        
        Args:
            check_id: Liveness check ID
            
        Returns:
            Liveness check response
            
        Raises:
            NotFoundError: If check not found
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/liveness/check/{check_id}"
        headers = self._get_headers()
        
        try:
            response = self.session.get(url, headers=headers, timeout=self.timeout)
            data = self._handle_response(response)
            return LivenessCheckResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Failed to get liveness check: {str(e)}")
    
    def get_customer_liveness_checks(
        self,
        customer_id: str,
        limit: int = 10,
        offset: int = 0,
    ) -> LivenessCheckListResponse:
        """
        Get all liveness checks for a customer.
        
        Args:
            customer_id: Customer ID
            limit: Number of results to return (default: 10)
            offset: Offset for pagination (default: 0)
            
        Returns:
            List of liveness checks
            
        Raises:
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/liveness/customer/{customer_id}"
        headers = self._get_headers()
        params = {
            "limit": limit,
            "offset": offset,
        }
        
        try:
            response = self.session.get(
                url,
                headers=headers,
                params=params,
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return LivenessCheckListResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Failed to get customer liveness checks: {str(e)}")
    
    def perform_passive_liveness_check(
        self,
        customer_id: str,
        image_file: Union[str, Path, BinaryIO],
        reference_image: Optional[Union[str, Path, BinaryIO]] = None,
    ) -> LivenessCheckResponse:
        """
        Perform passive liveness detection on an image.
        
        Args:
            customer_id: Customer ID
            image_file: Image file path or file object
            reference_image: Reference image for face matching (optional)
            
        Returns:
            Liveness check response
        """
        return self.perform_liveness_check(
            customer_id=customer_id,
            liveness_type=LivenessType.PASSIVE,
            file=image_file,
            reference_image=reference_image,
        )
    
    def perform_active_liveness_check(
        self,
        customer_id: str,
        video_file: Union[str, Path, BinaryIO],
    ) -> LivenessCheckResponse:
        """
        Perform active liveness detection on a video.
        
        Args:
            customer_id: Customer ID
            video_file: Video file path or file object
            
        Returns:
            Liveness check response
        """
        return self.perform_liveness_check(
            customer_id=customer_id,
            liveness_type=LivenessType.ACTIVE,
            file=video_file,
        )
    
    def close(self):
        """Close the client session."""
        self.session.close()
        self.auth.logout()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

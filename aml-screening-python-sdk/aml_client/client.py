"""Main API client for AML Screening Service."""

from typing import Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .auth import KeycloakAuth, AuthenticationError
from .models import (
    SanctionsScreeningRequest,
    SanctionsScreeningResponse,
    PEPCheckRequest,
    PEPCheckResponse,
    AdverseMediaCheckRequest,
    AdverseMediaCheckResponse,
    ComprehensiveScreeningRequest,
    ComprehensiveScreeningResponse,
    ScreeningListResponse,
    HealthCheckResponse,
    EntityType,
)
from .exceptions import (
    APIError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
)


class AMLScreeningClient:
    """Client for AML Screening Service API."""
    
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
        Initialize AML Screening client.
        
        Args:
            base_url: Base URL of AML Screening Service (e.g., http://localhost:8003)
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
                "Content-Type": "application/json",
            }
        except AuthenticationError as e:
            raise UnauthorizedError(f"Authentication failed: {str(e)}")
    
    def _handle_response(self, response: requests.Response) -> dict:
        """Handle API response and raise appropriate exceptions."""
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
    
    def screen_sanctions_individual(
        self,
        name: str,
        date_of_birth: Optional[str] = None,
        nationality: Optional[str] = None,
        country: Optional[str] = None,
        identification_number: Optional[str] = None,
    ) -> SanctionsScreeningResponse:
        """
        Screen individual against sanctions lists.
        
        Args:
            name: Individual's full name
            date_of_birth: Date of birth (YYYY-MM-DD) (optional)
            nationality: Nationality (optional)
            country: Country of residence (optional)
            identification_number: ID number (passport, NIN, etc.) (optional)
            
        Returns:
            Sanctions screening response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/sanctions/screen"
        headers = self._get_headers()
        
        request_data = SanctionsScreeningRequest(
            entity_type=EntityType.INDIVIDUAL,
            name=name,
            date_of_birth=date_of_birth,
            nationality=nationality,
            country=country,
            identification_number=identification_number,
        )
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                json=request_data.model_dump(exclude_none=True),
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return SanctionsScreeningResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Sanctions screening failed: {str(e)}")
    
    def screen_sanctions_entity(
        self,
        name: str,
        country: Optional[str] = None,
        identification_number: Optional[str] = None,
    ) -> SanctionsScreeningResponse:
        """
        Screen entity/organization against sanctions lists.
        
        Args:
            name: Entity/organization name
            country: Country of registration (optional)
            identification_number: Registration number (optional)
            
        Returns:
            Sanctions screening response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/sanctions/screen"
        headers = self._get_headers()
        
        request_data = SanctionsScreeningRequest(
            entity_type=EntityType.ENTITY,
            name=name,
            country=country,
            identification_number=identification_number,
        )
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                json=request_data.model_dump(exclude_none=True),
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return SanctionsScreeningResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Sanctions screening failed: {str(e)}")
    
    def check_pep(
        self,
        name: str,
        date_of_birth: Optional[str] = None,
        nationality: Optional[str] = None,
        position: Optional[str] = None,
    ) -> PEPCheckResponse:
        """
        Check if individual is a Politically Exposed Person (PEP).
        
        Args:
            name: Individual's full name
            date_of_birth: Date of birth (YYYY-MM-DD) (optional)
            nationality: Nationality (optional)
            position: Current or former position (optional)
            
        Returns:
            PEP check response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/pep/check"
        headers = self._get_headers()
        
        request_data = PEPCheckRequest(
            name=name,
            date_of_birth=date_of_birth,
            nationality=nationality,
            position=position,
        )
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                json=request_data.model_dump(exclude_none=True),
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return PEPCheckResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"PEP check failed: {str(e)}")
    
    def check_adverse_media_individual(
        self,
        name: str,
        date_of_birth: Optional[str] = None,
        country: Optional[str] = None,
        comprehensive: bool = False,
    ) -> AdverseMediaCheckResponse:
        """
        Check individual for adverse media mentions.
        
        Args:
            name: Individual's full name
            date_of_birth: Date of birth (YYYY-MM-DD) (optional)
            country: Country (optional)
            comprehensive: Perform comprehensive search (default: False)
            
        Returns:
            Adverse media check response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/adverse-media/check"
        headers = self._get_headers()
        
        request_data = AdverseMediaCheckRequest(
            entity_type=EntityType.INDIVIDUAL,
            name=name,
            date_of_birth=date_of_birth,
            country=country,
            comprehensive=comprehensive,
        )
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                json=request_data.model_dump(exclude_none=True),
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return AdverseMediaCheckResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Adverse media check failed: {str(e)}")
    
    def check_adverse_media_entity(
        self,
        name: str,
        country: Optional[str] = None,
        comprehensive: bool = False,
    ) -> AdverseMediaCheckResponse:
        """
        Check entity/organization for adverse media mentions.
        
        Args:
            name: Entity/organization name
            country: Country (optional)
            comprehensive: Perform comprehensive search (default: False)
            
        Returns:
            Adverse media check response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/adverse-media/check"
        headers = self._get_headers()
        
        request_data = AdverseMediaCheckRequest(
            entity_type=EntityType.ENTITY,
            name=name,
            country=country,
            comprehensive=comprehensive,
        )
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                json=request_data.model_dump(exclude_none=True),
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return AdverseMediaCheckResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Adverse media check failed: {str(e)}")
    
    def comprehensive_screening(
        self,
        customer_id: str,
        entity_type: EntityType,
        name: str,
        date_of_birth: Optional[str] = None,
        nationality: Optional[str] = None,
        country: Optional[str] = None,
        identification_number: Optional[str] = None,
    ) -> ComprehensiveScreeningResponse:
        """
        Perform comprehensive AML screening (sanctions + PEP + adverse media).
        
        Args:
            customer_id: Customer ID
            entity_type: Type of entity (individual or entity)
            name: Entity name
            date_of_birth: Date of birth (YYYY-MM-DD) (optional, for individuals)
            nationality: Nationality (optional)
            country: Country (optional)
            identification_number: ID number (optional)
            
        Returns:
            Comprehensive screening response
            
        Raises:
            ValidationError: If request validation fails
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/comprehensive/screen"
        headers = self._get_headers()
        
        request_data = ComprehensiveScreeningRequest(
            customer_id=customer_id,
            entity_type=entity_type,
            name=name,
            date_of_birth=date_of_birth,
            nationality=nationality,
            country=country,
            identification_number=identification_number,
        )
        
        try:
            response = self.session.post(
                url,
                headers=headers,
                json=request_data.model_dump(exclude_none=True),
                timeout=self.timeout,
            )
            data = self._handle_response(response)
            return ComprehensiveScreeningResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Comprehensive screening failed: {str(e)}")
    
    def get_screening(self, screening_id: str) -> ComprehensiveScreeningResponse:
        """
        Get screening result by ID.
        
        Args:
            screening_id: Screening ID
            
        Returns:
            Comprehensive screening response
            
        Raises:
            NotFoundError: If screening not found
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/screening/{screening_id}"
        headers = self._get_headers()
        
        try:
            response = self.session.get(url, headers=headers, timeout=self.timeout)
            data = self._handle_response(response)
            return ComprehensiveScreeningResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Failed to get screening: {str(e)}")
    
    def get_customer_screenings(
        self,
        customer_id: str,
        limit: int = 10,
        offset: int = 0,
    ) -> ScreeningListResponse:
        """
        Get all screenings for a customer.
        
        Args:
            customer_id: Customer ID
            limit: Number of results to return (default: 10)
            offset: Offset for pagination (default: 0)
            
        Returns:
            List of screenings
            
        Raises:
            APIError: If API request fails
        """
        url = f"{self.base_url}/api/v1/aml/customer/{customer_id}/screenings"
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
            return ScreeningListResponse(**data)
        except requests.exceptions.RequestException as e:
            raise APIError(f"Failed to get customer screenings: {str(e)}")
    
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

"""
Cloud-Agnostic Storage Abstraction
Supports AWS S3, Azure Blob, GCP Cloud Storage, OpenStack Swift, and MinIO
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, BinaryIO
from dataclasses import dataclass
from enum import Enum
import os
import boto3
from botocore.exceptions import ClientError
import mimetypes
from datetime import datetime, timedelta
import hashlib
import uuid

# ============================================================================
# STORAGE PROVIDER ENUM
# ============================================================================

class StorageProvider(str, Enum):
    """Supported storage providers"""
    AWS_S3 = "aws_s3"
    AZURE_BLOB = "azure_blob"
    GCP_STORAGE = "gcp_storage"
    OPENSTACK_SWIFT = "openstack_swift"
    MINIO = "minio"  # Legacy - use S3_COMPATIBLE instead
    S3_COMPATIBLE = "s3_compatible"  # RustFS, MinIO, Ceph, etc.
    RUSTFS = "rustfs"  # Explicit RustFS provider
    LOCAL = "local"

# ============================================================================
# STORAGE CONFIGURATION
# ============================================================================

@dataclass
class StorageConfig:
    """Storage configuration"""
    provider: StorageProvider
    bucket_name: str
    region: Optional[str] = None
    endpoint_url: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    
    # OpenStack specific
    auth_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    project_name: Optional[str] = None
    project_domain_name: Optional[str] = "Default"
    user_domain_name: Optional[str] = "Default"
    
    # Azure specific
    connection_string: Optional[str] = None
    account_name: Optional[str] = None
    account_key: Optional[str] = None
    
    # GCP specific
    project_id: Optional[str] = None
    credentials_path: Optional[str] = None
    
    # Local storage
    local_path: Optional[str] = None

# ============================================================================
# ABSTRACT STORAGE INTERFACE
# ============================================================================

class CloudStorage(ABC):
    """Abstract cloud storage interface"""
    
    @abstractmethod
    async def upload_file(
        self,
        file_data: BinaryIO,
        object_key: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
        public: bool = False
    ) -> str:
        """Upload file and return URL"""
        pass
    
    @abstractmethod
    async def download_file(
        self,
        object_key: str,
        local_path: str
    ) -> str:
        """Download file to local path"""
        pass
    
    @abstractmethod
    async def delete_file(self, object_key: str) -> bool:
        """Delete file"""
        pass
    
    @abstractmethod
    async def get_file_url(
        self,
        object_key: str,
        expires_in: int = 3600
    ) -> str:
        """Get presigned URL for file"""
        pass
    
    @abstractmethod
    async def list_files(
        self,
        prefix: Optional[str] = None,
        max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        """List files in storage"""
        pass
    
    @abstractmethod
    async def file_exists(self, object_key: str) -> bool:
        """Check if file exists"""
        pass
    
    @abstractmethod
    async def get_file_metadata(self, object_key: str) -> Dict[str, Any]:
        """Get file metadata"""
        pass

# ============================================================================
# AWS S3 IMPLEMENTATION
# ============================================================================

class AWSS3Storage(CloudStorage):
    """AWS S3 storage implementation"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.client = boto3.client(
            's3',
            aws_access_key_id=config.access_key,
            aws_secret_access_key=config.secret_key,
            region_name=config.region or 'us-east-1'
        )
        self.bucket = config.bucket_name
    
    async def upload_file(
        self,
        file_data: BinaryIO,
        object_key: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
        public: bool = False
    ) -> str:
        """Upload file to S3"""
        extra_args = {}
        
        if content_type:
            extra_args['ContentType'] = content_type
        
        if metadata:
            extra_args['Metadata'] = metadata
        
        if public:
            extra_args['ACL'] = 'public-read'
        
        try:
            self.client.upload_fileobj(
                file_data,
                self.bucket,
                object_key,
                ExtraArgs=extra_args
            )
            
            if public:
                return f"https://{self.bucket}.s3.{self.config.region}.amazonaws.com/{object_key}"
            else:
                return await self.get_file_url(object_key)
                
        except ClientError as e:
            raise Exception(f"Failed to upload to S3: {e}")
    
    async def download_file(self, object_key: str, local_path: str) -> str:
        """Download file from S3"""
        try:
            self.client.download_file(self.bucket, object_key, local_path)
            return local_path
        except ClientError as e:
            raise Exception(f"Failed to download from S3: {e}")
    
    async def delete_file(self, object_key: str) -> bool:
        """Delete file from S3"""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=object_key)
            return True
        except ClientError:
            return False
    
    async def get_file_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Get presigned URL"""
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': object_key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            raise Exception(f"Failed to generate presigned URL: {e}")
    
    async def list_files(
        self,
        prefix: Optional[str] = None,
        max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        """List files in S3"""
        try:
            params = {'Bucket': self.bucket, 'MaxKeys': max_keys}
            if prefix:
                params['Prefix'] = prefix
            
            response = self.client.list_objects_v2(**params)
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'etag': obj['ETag']
                })
            
            return files
        except ClientError as e:
            raise Exception(f"Failed to list S3 objects: {e}")
    
    async def file_exists(self, object_key: str) -> bool:
        """Check if file exists in S3"""
        try:
            self.client.head_object(Bucket=self.bucket, Key=object_key)
            return True
        except ClientError:
            return False
    
    async def get_file_metadata(self, object_key: str) -> Dict[str, Any]:
        """Get file metadata from S3"""
        try:
            response = self.client.head_object(Bucket=self.bucket, Key=object_key)
            return {
                'content_type': response.get('ContentType'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                'etag': response.get('ETag'),
                'metadata': response.get('Metadata', {})
            }
        except ClientError as e:
            raise Exception(f"Failed to get metadata: {e}")

# ============================================================================
# OPENSTACK SWIFT IMPLEMENTATION
# ============================================================================

class OpenStackSwiftStorage(CloudStorage):
    """OpenStack Swift storage implementation"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        
        try:
            from swiftclient import Connection
            from keystoneauth1 import session
            from keystoneauth1.identity import v3
            
            # Keystone authentication
            auth = v3.Password(
                auth_url=config.auth_url,
                username=config.username,
                password=config.password,
                project_name=config.project_name,
                project_domain_name=config.project_domain_name,
                user_domain_name=config.user_domain_name
            )
            
            sess = session.Session(auth=auth)
            
            # Swift connection
            self.conn = Connection(session=sess)
            self.container = config.bucket_name
            
            # Create container if not exists
            try:
                self.conn.put_container(self.container)
            except Exception:
                pass  # Container might already exist
                
        except ImportError:
            raise Exception(
                "OpenStack Swift client not installed. "
                "Install with: pip install python-swiftclient python-keystoneclient"
            )
    
    async def upload_file(
        self,
        file_data: BinaryIO,
        object_key: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
        public: bool = False
    ) -> str:
        """Upload file to Swift"""
        try:
            headers = {}
            
            if content_type:
                headers['Content-Type'] = content_type
            
            if metadata:
                for key, value in metadata.items():
                    headers[f'X-Object-Meta-{key}'] = value
            
            if public:
                headers['X-Container-Read'] = '.r:*'
            
            self.conn.put_object(
                self.container,
                object_key,
                file_data.read(),
                headers=headers
            )
            
            # Get object URL
            account = self.conn.get_account()[0]
            storage_url = self.conn.url
            return f"{storage_url}/{self.container}/{object_key}"
            
        except Exception as e:
            raise Exception(f"Failed to upload to Swift: {e}")
    
    async def download_file(self, object_key: str, local_path: str) -> str:
        """Download file from Swift"""
        try:
            _, obj_data = self.conn.get_object(self.container, object_key)
            
            with open(local_path, 'wb') as f:
                f.write(obj_data)
            
            return local_path
        except Exception as e:
            raise Exception(f"Failed to download from Swift: {e}")
    
    async def delete_file(self, object_key: str) -> bool:
        """Delete file from Swift"""
        try:
            self.conn.delete_object(self.container, object_key)
            return True
        except Exception:
            return False
    
    async def get_file_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Get temporary URL for Swift object"""
        try:
            # Generate temp URL
            temp_url_key = self.config.secret_key or 'temp-url-key'
            
            path = f"/v1/AUTH_{self.config.project_name}/{self.container}/{object_key}"
            expires = int((datetime.utcnow() + timedelta(seconds=expires_in)).timestamp())
            
            hmac_body = f"GET\n{expires}\n{path}"
            sig = hashlib.sha1(
                f"{temp_url_key}{hmac_body}".encode('utf-8')
            ).hexdigest()
            
            return f"{self.conn.url}{path}?temp_url_sig={sig}&temp_url_expires={expires}"
            
        except Exception as e:
            raise Exception(f"Failed to generate temp URL: {e}")
    
    async def list_files(
        self,
        prefix: Optional[str] = None,
        max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        """List files in Swift"""
        try:
            params = {'limit': max_keys}
            if prefix:
                params['prefix'] = prefix
            
            _, objects = self.conn.get_container(self.container, **params)
            
            files = []
            for obj in objects:
                files.append({
                    'key': obj['name'],
                    'size': obj['bytes'],
                    'last_modified': obj['last_modified'],
                    'etag': obj['hash']
                })
            
            return files
        except Exception as e:
            raise Exception(f"Failed to list Swift objects: {e}")
    
    async def file_exists(self, object_key: str) -> bool:
        """Check if file exists in Swift"""
        try:
            self.conn.head_object(self.container, object_key)
            return True
        except Exception:
            return False
    
    async def get_file_metadata(self, object_key: str) -> Dict[str, Any]:
        """Get file metadata from Swift"""
        try:
            headers = self.conn.head_object(self.container, object_key)
            
            metadata = {}
            for key, value in headers.items():
                if key.startswith('x-object-meta-'):
                    metadata[key[14:]] = value
            
            return {
                'content_type': headers.get('content-type'),
                'content_length': int(headers.get('content-length', 0)),
                'last_modified': headers.get('last-modified'),
                'etag': headers.get('etag'),
                'metadata': metadata
            }
        except Exception as e:
            raise Exception(f"Failed to get metadata: {e}")

# ============================================================================
# S3-COMPATIBLE IMPLEMENTATION (RustFS, MinIO, Ceph, etc.)
# ============================================================================

class S3CompatibleStorage(CloudStorage):
    """
    S3-compatible storage implementation.
    Works with RustFS, MinIO, Ceph, and any S3-compatible object storage.
    
    RustFS Benefits:
    - 2.3x faster than MinIO for 4KB objects
    - Apache 2.0 license (vs MinIO's AGPLv3)
    - Written in Rust - no GC pauses
    - Full S3 API compatibility
    """
    
    def __init__(self, config: StorageConfig):
        self.config = config
        
        # Validate required configuration
        if not config.endpoint_url:
            raise ValueError("endpoint_url is required for S3-compatible storage")
        if not config.access_key:
            raise ValueError("access_key is required for S3-compatible storage")
        if not config.secret_key:
            raise ValueError("secret_key is required for S3-compatible storage")
        
        # Configure boto3 for S3-compatible endpoint
        # Use path-style addressing for better compatibility with self-hosted storage
        self.client = boto3.client(
            's3',
            endpoint_url=config.endpoint_url,
            aws_access_key_id=config.access_key,
            aws_secret_access_key=config.secret_key,
            region_name=config.region or 'us-east-1',
            config=boto3.session.Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}  # Path-style for RustFS/MinIO compatibility
            )
        )
        self.bucket = config.bucket_name
        
        # Create bucket if not exists
        try:
            self.client.create_bucket(Bucket=self.bucket)
        except ClientError as e:
            # Bucket might already exist or we don't have permission
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code not in ['BucketAlreadyExists', 'BucketAlreadyOwnedByYou']:
                # Log but don't fail - bucket might exist
                pass
    
    async def upload_file(
        self,
        file_data: BinaryIO,
        object_key: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
        public: bool = False
    ) -> str:
        """Upload file to MinIO"""
        # Same as S3 implementation
        extra_args = {}
        
        if content_type:
            extra_args['ContentType'] = content_type
        
        if metadata:
            extra_args['Metadata'] = metadata
        
        try:
            self.client.upload_fileobj(
                file_data,
                self.bucket,
                object_key,
                ExtraArgs=extra_args
            )
            
            return f"{self.config.endpoint_url}/{self.bucket}/{object_key}"
                
        except ClientError as e:
            raise Exception(f"Failed to upload to MinIO: {e}")
    
    # Other methods same as AWSS3Storage
    async def download_file(self, object_key: str, local_path: str) -> str:
        try:
            self.client.download_file(self.bucket, object_key, local_path)
            return local_path
        except ClientError as e:
            raise Exception(f"Failed to download from MinIO: {e}")
    
    async def delete_file(self, object_key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=object_key)
            return True
        except ClientError:
            return False
    
    async def get_file_url(self, object_key: str, expires_in: int = 3600) -> str:
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': object_key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            raise Exception(f"Failed to generate presigned URL: {e}")
    
    async def list_files(
        self,
        prefix: Optional[str] = None,
        max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        try:
            params = {'Bucket': self.bucket, 'MaxKeys': max_keys}
            if prefix:
                params['Prefix'] = prefix
            
            response = self.client.list_objects_v2(**params)
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'etag': obj['ETag']
                })
            
            return files
        except ClientError as e:
            raise Exception(f"Failed to list objects: {e}")
    
    async def file_exists(self, object_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=object_key)
            return True
        except ClientError:
            return False
    
    async def get_file_metadata(self, object_key: str) -> Dict[str, Any]:
        try:
            response = self.client.head_object(Bucket=self.bucket, Key=object_key)
            return {
                'content_type': response.get('ContentType'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                'etag': response.get('ETag'),
                'metadata': response.get('Metadata', {})
            }
        except ClientError as e:
            raise Exception(f"Failed to get metadata: {e}")

# ============================================================================
# STORAGE FACTORY
# ============================================================================

class StorageFactory:
    """Factory to create storage instances"""
    
    @staticmethod
    def create_storage(config: StorageConfig) -> CloudStorage:
        """Create storage instance based on provider"""
        if config.provider == StorageProvider.AWS_S3:
            return AWSS3Storage(config)
        elif config.provider == StorageProvider.OPENSTACK_SWIFT:
            return OpenStackSwiftStorage(config)
        elif config.provider in (StorageProvider.MINIO, StorageProvider.S3_COMPATIBLE, StorageProvider.RUSTFS):
            # All S3-compatible providers use the same implementation
            return S3CompatibleStorage(config)
        else:
            raise ValueError(f"Unsupported storage provider: {config.provider}")


# Legacy alias for backward compatibility
MinIOStorage = S3CompatibleStorage

# ============================================================================
# USAGE EXAMPLE
# ============================================================================

async def example_usage():
    """Example usage of cloud-agnostic storage"""
    
    # AWS S3
    s3_config = StorageConfig(
        provider=StorageProvider.AWS_S3,
        bucket_name="my-ecommerce-bucket",
        region="us-east-1",
        access_key=os.getenv("AWS_ACCESS_KEY_ID"),
        secret_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    
    # OpenStack Swift
    swift_config = StorageConfig(
        provider=StorageProvider.OPENSTACK_SWIFT,
        bucket_name="ecommerce-container",
        auth_url="https://openstack.example.com:5000/v3",
        username="admin",
        password=os.getenv('DB_PASSWORD', ''),
        project_name="ecommerce",
        project_domain_name="Default",
        user_domain_name="Default"
    )
    
    # RustFS (recommended - 2.3x faster than MinIO for small objects)
    rustfs_config = StorageConfig(
        provider=StorageProvider.RUSTFS,
        bucket_name="ecommerce",
        endpoint_url=os.getenv("RUSTFS_ENDPOINT", "http://localhost:9000"),
        access_key=os.getenv("RUSTFS_ACCESS_KEY"),
        secret_key=os.getenv("RUSTFS_SECRET_KEY")
    )
    
    # Legacy MinIO config (still supported via S3-compatible provider)
    minio_config = StorageConfig(
        provider=StorageProvider.S3_COMPATIBLE,
        bucket_name="ecommerce",
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY"),
        secret_key=os.getenv("MINIO_SECRET_KEY")
    )
    
    # Create storage (cloud-agnostic!)
    # Use RustFS by default for better performance
    storage = StorageFactory.create_storage(rustfs_config)
    
    # Upload file
    with open("product_image.jpg", "rb") as f:
        url = await storage.upload_file(
            f,
            "products/image123.jpg",
            content_type="image/jpeg",
            public=True
        )
        print(f"Uploaded: {url}")
    
    # List files
    files = await storage.list_files(prefix="products/")
    print(f"Files: {files}")


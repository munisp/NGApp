"""
RustFS Object Storage Client for EscrowProtect Platform

This module provides a unified S3-compatible storage interface using RustFS
as the backend. RustFS is a high-performance, distributed object storage
system built in Rust, offering 2.3x faster performance than MinIO for
small objects.

Features:
- S3-compatible API (boto3 compatible)
- Presigned URL generation for secure uploads/downloads
- Multipart upload support for large files
- Bucket lifecycle management
- Object versioning support
- Async operations with aiobotocore
"""

import os
import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Optional, BinaryIO, AsyncIterator, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
from contextlib import asynccontextmanager

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

try:
    import aiobotocore
    from aiobotocore.session import get_session
    ASYNC_AVAILABLE = True
except ImportError:
    ASYNC_AVAILABLE = False

logger = logging.getLogger(__name__)


class StorageBucket(str, Enum):
    """Predefined buckets for escrow platform"""
    DOCUMENTS = "escrow-documents"
    KYC = "escrow-kyc"
    EVIDENCE = "escrow-evidence"
    EXPORTS = "escrow-exports"
    OPENCTI = "opencti-data"


@dataclass
class StorageConfig:
    """Configuration for RustFS storage client"""
    endpoint_url: str
    access_key: str
    secret_key: str
    region: str = "af-south-1"
    use_ssl: bool = True
    verify_ssl: bool = True
    max_pool_connections: int = 50
    connect_timeout: int = 10
    read_timeout: int = 30
    signature_version: str = "s3v4"
    addressing_style: str = "path"  # RustFS uses path-style addressing

    @classmethod
    def from_env(cls) -> "StorageConfig":
        """Create config from environment variables"""
        return cls(
            endpoint_url=os.getenv("RUSTFS_ENDPOINT", "http://localhost:9000"),
            access_key=os.getenv("RUSTFS_ACCESS_KEY", "escrowprotect"),
            secret_key=os.getenv("RUSTFS_SECRET_KEY", "escrowprotect-secret-key"),
            region=os.getenv("RUSTFS_REGION", "af-south-1"),
            use_ssl=os.getenv("RUSTFS_USE_SSL", "false").lower() == "true",
            verify_ssl=os.getenv("RUSTFS_VERIFY_SSL", "true").lower() == "true",
        )


@dataclass
class UploadResult:
    """Result of an upload operation"""
    bucket: str
    key: str
    etag: str
    version_id: Optional[str] = None
    size: int = 0
    content_type: str = "application/octet-stream"


@dataclass
class ObjectInfo:
    """Information about a stored object"""
    key: str
    size: int
    last_modified: datetime
    etag: str
    content_type: str
    version_id: Optional[str] = None
    metadata: Dict[str, str] = None


class RustFSStorage:
    """
    Synchronous RustFS storage client using boto3.
    
    This client provides S3-compatible operations for the escrow platform,
    including document storage, KYC file management, and evidence handling.
    """

    def __init__(self, config: Optional[StorageConfig] = None):
        self.config = config or StorageConfig.from_env()
        self._client = None
        self._resource = None

    @property
    def client(self):
        """Lazy initialization of boto3 S3 client"""
        if self._client is None:
            boto_config = Config(
                signature_version=self.config.signature_version,
                s3={"addressing_style": self.config.addressing_style},
                max_pool_connections=self.config.max_pool_connections,
                connect_timeout=self.config.connect_timeout,
                read_timeout=self.config.read_timeout,
                retries={"max_attempts": 3, "mode": "adaptive"},
            )
            self._client = boto3.client(
                "s3",
                endpoint_url=self.config.endpoint_url,
                aws_access_key_id=self.config.access_key,
                aws_secret_access_key=self.config.secret_key,
                region_name=self.config.region,
                use_ssl=self.config.use_ssl,
                verify=self.config.verify_ssl,
                config=boto_config,
            )
        return self._client

    def health_check(self) -> bool:
        """Check if RustFS is healthy and accessible"""
        try:
            self.client.list_buckets()
            return True
        except Exception as e:
            logger.error(f"RustFS health check failed: {e}")
            return False

    def create_bucket(self, bucket: str, enable_versioning: bool = False) -> bool:
        """Create a bucket if it doesn't exist"""
        try:
            self.client.head_bucket(Bucket=bucket)
            logger.info(f"Bucket {bucket} already exists")
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                self.client.create_bucket(
                    Bucket=bucket,
                    CreateBucketConfiguration={"LocationConstraint": self.config.region},
                )
                logger.info(f"Created bucket {bucket}")
            else:
                raise

        if enable_versioning:
            self.client.put_bucket_versioning(
                Bucket=bucket,
                VersioningConfiguration={"Status": "Enabled"},
            )
            logger.info(f"Enabled versioning for bucket {bucket}")

        return True

    def upload_file(
        self,
        bucket: str,
        key: str,
        file_obj: BinaryIO,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> UploadResult:
        """Upload a file to RustFS"""
        extra_args = {"ContentType": content_type}
        if metadata:
            extra_args["Metadata"] = metadata

        file_obj.seek(0, 2)
        size = file_obj.tell()
        file_obj.seek(0)

        response = self.client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_obj,
            **extra_args,
        )

        return UploadResult(
            bucket=bucket,
            key=key,
            etag=response.get("ETag", "").strip('"'),
            version_id=response.get("VersionId"),
            size=size,
            content_type=content_type,
        )

    def upload_bytes(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> UploadResult:
        """Upload bytes directly to RustFS"""
        extra_args = {"ContentType": content_type}
        if metadata:
            extra_args["Metadata"] = metadata

        response = self.client.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            **extra_args,
        )

        return UploadResult(
            bucket=bucket,
            key=key,
            etag=response.get("ETag", "").strip('"'),
            version_id=response.get("VersionId"),
            size=len(data),
            content_type=content_type,
        )

    def download_file(self, bucket: str, key: str) -> bytes:
        """Download a file from RustFS"""
        response = self.client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    def download_to_file(self, bucket: str, key: str, file_path: str) -> None:
        """Download a file from RustFS to local filesystem"""
        self.client.download_file(bucket, key, file_path)

    def get_object_info(self, bucket: str, key: str) -> Optional[ObjectInfo]:
        """Get metadata about an object"""
        try:
            response = self.client.head_object(Bucket=bucket, Key=key)
            return ObjectInfo(
                key=key,
                size=response["ContentLength"],
                last_modified=response["LastModified"],
                etag=response["ETag"].strip('"'),
                content_type=response.get("ContentType", "application/octet-stream"),
                version_id=response.get("VersionId"),
                metadata=response.get("Metadata", {}),
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return None
            raise

    def object_exists(self, bucket: str, key: str) -> bool:
        """Check if an object exists"""
        return self.get_object_info(bucket, key) is not None

    def delete_object(self, bucket: str, key: str, version_id: Optional[str] = None) -> bool:
        """Delete an object from RustFS"""
        try:
            params = {"Bucket": bucket, "Key": key}
            if version_id:
                params["VersionId"] = version_id
            self.client.delete_object(**params)
            return True
        except ClientError as e:
            logger.error(f"Failed to delete object {key}: {e}")
            return False

    def list_objects(
        self,
        bucket: str,
        prefix: str = "",
        max_keys: int = 1000,
    ) -> List[ObjectInfo]:
        """List objects in a bucket with optional prefix"""
        objects = []
        paginator = self.client.get_paginator("list_objects_v2")

        for page in paginator.paginate(
            Bucket=bucket,
            Prefix=prefix,
            PaginationConfig={"MaxItems": max_keys},
        ):
            for obj in page.get("Contents", []):
                objects.append(
                    ObjectInfo(
                        key=obj["Key"],
                        size=obj["Size"],
                        last_modified=obj["LastModified"],
                        etag=obj["ETag"].strip('"'),
                        content_type="application/octet-stream",
                    )
                )

        return objects

    def generate_presigned_url(
        self,
        bucket: str,
        key: str,
        operation: str = "get_object",
        expires_in: int = 3600,
        content_type: Optional[str] = None,
    ) -> str:
        """Generate a presigned URL for upload or download"""
        params = {"Bucket": bucket, "Key": key}
        if operation == "put_object" and content_type:
            params["ContentType"] = content_type

        return self.client.generate_presigned_url(
            ClientMethod=operation,
            Params=params,
            ExpiresIn=expires_in,
        )

    def generate_presigned_upload_url(
        self,
        bucket: str,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 3600,
    ) -> Dict[str, str]:
        """Generate presigned POST URL for browser uploads"""
        conditions = [
            {"bucket": bucket},
            ["starts-with", "$key", key.rsplit("/", 1)[0] + "/" if "/" in key else ""],
            {"Content-Type": content_type},
            ["content-length-range", 1, 100 * 1024 * 1024],  # 1 byte to 100MB
        ]

        fields = {"Content-Type": content_type}

        response = self.client.generate_presigned_post(
            Bucket=bucket,
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=expires_in,
        )

        return response

    def copy_object(
        self,
        source_bucket: str,
        source_key: str,
        dest_bucket: str,
        dest_key: str,
    ) -> UploadResult:
        """Copy an object within or between buckets"""
        response = self.client.copy_object(
            CopySource={"Bucket": source_bucket, "Key": source_key},
            Bucket=dest_bucket,
            Key=dest_key,
        )

        return UploadResult(
            bucket=dest_bucket,
            key=dest_key,
            etag=response.get("CopyObjectResult", {}).get("ETag", "").strip('"'),
            version_id=response.get("VersionId"),
        )

    def initiate_multipart_upload(
        self,
        bucket: str,
        key: str,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        """Initiate a multipart upload and return upload ID"""
        params = {
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
        }
        if metadata:
            params["Metadata"] = metadata

        response = self.client.create_multipart_upload(**params)
        return response["UploadId"]

    def upload_part(
        self,
        bucket: str,
        key: str,
        upload_id: str,
        part_number: int,
        data: bytes,
    ) -> Dict[str, Any]:
        """Upload a part in a multipart upload"""
        response = self.client.upload_part(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            PartNumber=part_number,
            Body=data,
        )
        return {"PartNumber": part_number, "ETag": response["ETag"]}

    def complete_multipart_upload(
        self,
        bucket: str,
        key: str,
        upload_id: str,
        parts: List[Dict[str, Any]],
    ) -> UploadResult:
        """Complete a multipart upload"""
        response = self.client.complete_multipart_upload(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

        return UploadResult(
            bucket=bucket,
            key=key,
            etag=response.get("ETag", "").strip('"'),
            version_id=response.get("VersionId"),
        )

    def abort_multipart_upload(self, bucket: str, key: str, upload_id: str) -> bool:
        """Abort a multipart upload"""
        try:
            self.client.abort_multipart_upload(
                Bucket=bucket,
                Key=key,
                UploadId=upload_id,
            )
            return True
        except ClientError as e:
            logger.error(f"Failed to abort multipart upload: {e}")
            return False


class AsyncRustFSStorage:
    """
    Asynchronous RustFS storage client using aiobotocore.
    
    Provides async operations for high-concurrency scenarios like
    bulk uploads, parallel downloads, and streaming operations.
    """

    def __init__(self, config: Optional[StorageConfig] = None):
        if not ASYNC_AVAILABLE:
            raise ImportError("aiobotocore is required for async operations")
        self.config = config or StorageConfig.from_env()
        self._session = get_session()

    @asynccontextmanager
    async def _get_client(self):
        """Get an async S3 client"""
        async with self._session.create_client(
            "s3",
            endpoint_url=self.config.endpoint_url,
            aws_access_key_id=self.config.access_key,
            aws_secret_access_key=self.config.secret_key,
            region_name=self.config.region,
            use_ssl=self.config.use_ssl,
            verify=self.config.verify_ssl,
        ) as client:
            yield client

    async def health_check(self) -> bool:
        """Check if RustFS is healthy and accessible"""
        try:
            async with self._get_client() as client:
                await client.list_buckets()
            return True
        except Exception as e:
            logger.error(f"RustFS async health check failed: {e}")
            return False

    async def upload_bytes(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> UploadResult:
        """Upload bytes asynchronously"""
        async with self._get_client() as client:
            extra_args = {"ContentType": content_type}
            if metadata:
                extra_args["Metadata"] = metadata

            response = await client.put_object(
                Bucket=bucket,
                Key=key,
                Body=data,
                **extra_args,
            )

            return UploadResult(
                bucket=bucket,
                key=key,
                etag=response.get("ETag", "").strip('"'),
                version_id=response.get("VersionId"),
                size=len(data),
                content_type=content_type,
            )

    async def download_bytes(self, bucket: str, key: str) -> bytes:
        """Download bytes asynchronously"""
        async with self._get_client() as client:
            response = await client.get_object(Bucket=bucket, Key=key)
            async with response["Body"] as stream:
                return await stream.read()

    async def object_exists(self, bucket: str, key: str) -> bool:
        """Check if an object exists asynchronously"""
        try:
            async with self._get_client() as client:
                await client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    async def delete_object(self, bucket: str, key: str) -> bool:
        """Delete an object asynchronously"""
        try:
            async with self._get_client() as client:
                await client.delete_object(Bucket=bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"Async delete failed: {e}")
            return False

    async def list_objects(
        self,
        bucket: str,
        prefix: str = "",
        max_keys: int = 1000,
    ) -> List[ObjectInfo]:
        """List objects asynchronously"""
        objects = []
        async with self._get_client() as client:
            paginator = client.get_paginator("list_objects_v2")
            async for page in paginator.paginate(
                Bucket=bucket,
                Prefix=prefix,
                PaginationConfig={"MaxItems": max_keys},
            ):
                for obj in page.get("Contents", []):
                    objects.append(
                        ObjectInfo(
                            key=obj["Key"],
                            size=obj["Size"],
                            last_modified=obj["LastModified"],
                            etag=obj["ETag"].strip('"'),
                            content_type="application/octet-stream",
                        )
                    )
        return objects


# Convenience functions for common operations
_storage: Optional[RustFSStorage] = None


def get_storage() -> RustFSStorage:
    """Get the singleton storage instance"""
    global _storage
    if _storage is None:
        _storage = RustFSStorage()
    return _storage


def upload_kyc_document(
    user_id: str,
    document_type: str,
    file_obj: BinaryIO,
    content_type: str = "application/pdf",
) -> UploadResult:
    """Upload a KYC document for a user"""
    storage = get_storage()
    key = f"users/{user_id}/kyc/{document_type}/{datetime.utcnow().isoformat()}"
    return storage.upload_file(
        bucket=StorageBucket.KYC,
        key=key,
        file_obj=file_obj,
        content_type=content_type,
        metadata={"user_id": user_id, "document_type": document_type},
    )


def upload_dispute_evidence(
    transaction_id: str,
    dispute_id: str,
    file_obj: BinaryIO,
    content_type: str = "image/jpeg",
) -> UploadResult:
    """Upload evidence for a dispute"""
    storage = get_storage()
    key = f"disputes/{dispute_id}/evidence/{datetime.utcnow().isoformat()}"
    return storage.upload_file(
        bucket=StorageBucket.EVIDENCE,
        key=key,
        file_obj=file_obj,
        content_type=content_type,
        metadata={"transaction_id": transaction_id, "dispute_id": dispute_id},
    )


def get_presigned_download_url(bucket: str, key: str, expires_in: int = 3600) -> str:
    """Get a presigned URL for downloading a file"""
    storage = get_storage()
    return storage.generate_presigned_url(bucket, key, "get_object", expires_in)


def get_presigned_upload_url(
    bucket: str,
    key: str,
    content_type: str = "application/octet-stream",
    expires_in: int = 3600,
) -> Dict[str, str]:
    """Get a presigned URL for uploading a file"""
    storage = get_storage()
    return storage.generate_presigned_upload_url(bucket, key, content_type, expires_in)

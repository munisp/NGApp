"""
S3 Contract Tests for RustFS Storage

These tests verify S3 API compatibility between RustFS and the escrow platform.
They can be run against both MinIO and RustFS to ensure compatibility.

Test Categories:
1. Bucket Operations - create, delete, list, head
2. Object Operations - put, get, delete, head, list
3. Multipart Uploads - initiate, upload parts, complete, abort
4. Presigned URLs - generate and verify
5. Metadata and Headers - content-type, custom metadata
6. Error Handling - 404s, access denied, etc.
"""

import io
import os
import hashlib
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


RUSTFS_ENDPOINT = os.getenv("RUSTFS_ENDPOINT", "http://localhost:9000")
RUSTFS_ACCESS_KEY = os.getenv("RUSTFS_ACCESS_KEY", "escrowprotect")
RUSTFS_SECRET_KEY = os.getenv("RUSTFS_SECRET_KEY", "escrowprotect-secret-key")
RUSTFS_REGION = os.getenv("RUSTFS_REGION", "af-south-1")
TEST_BUCKET = "escrow-test-bucket"


@pytest.fixture(scope="module")
def s3_client():
    """Create S3 client configured for RustFS"""
    config = Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"},
        retries={"max_attempts": 3},
    )
    client = boto3.client(
        "s3",
        endpoint_url=RUSTFS_ENDPOINT,
        aws_access_key_id=RUSTFS_ACCESS_KEY,
        aws_secret_access_key=RUSTFS_SECRET_KEY,
        region_name=RUSTFS_REGION,
        config=config,
    )
    return client


@pytest.fixture(scope="module")
def test_bucket(s3_client):
    """Create and cleanup test bucket"""
    try:
        s3_client.create_bucket(
            Bucket=TEST_BUCKET,
            CreateBucketConfiguration={"LocationConstraint": RUSTFS_REGION},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "BucketAlreadyOwnedByYou":
            raise

    yield TEST_BUCKET

    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=TEST_BUCKET):
            for obj in page.get("Contents", []):
                s3_client.delete_object(Bucket=TEST_BUCKET, Key=obj["Key"])
        s3_client.delete_bucket(Bucket=TEST_BUCKET)
    except ClientError:
        pass


class TestBucketOperations:
    """Test S3 bucket operations"""

    def test_create_bucket(self, s3_client):
        """Test bucket creation"""
        bucket_name = f"test-create-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        try:
            response = s3_client.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": RUSTFS_REGION},
            )
            assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
        finally:
            try:
                s3_client.delete_bucket(Bucket=bucket_name)
            except ClientError:
                pass

    def test_list_buckets(self, s3_client, test_bucket):
        """Test listing buckets"""
        response = s3_client.list_buckets()
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
        assert "Buckets" in response
        bucket_names = [b["Name"] for b in response["Buckets"]]
        assert test_bucket in bucket_names

    def test_head_bucket(self, s3_client, test_bucket):
        """Test bucket existence check"""
        response = s3_client.head_bucket(Bucket=test_bucket)
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200

    def test_head_bucket_not_found(self, s3_client):
        """Test 404 for non-existent bucket"""
        with pytest.raises(ClientError) as exc_info:
            s3_client.head_bucket(Bucket="non-existent-bucket-12345")
        assert exc_info.value.response["Error"]["Code"] in ["404", "NoSuchBucket"]

    def test_bucket_versioning(self, s3_client, test_bucket):
        """Test enabling bucket versioning"""
        s3_client.put_bucket_versioning(
            Bucket=test_bucket,
            VersioningConfiguration={"Status": "Enabled"},
        )
        response = s3_client.get_bucket_versioning(Bucket=test_bucket)
        assert response.get("Status") == "Enabled"


class TestObjectOperations:
    """Test S3 object operations"""

    def test_put_object(self, s3_client, test_bucket):
        """Test uploading an object"""
        key = "test-put-object.txt"
        content = b"Hello, RustFS!"

        response = s3_client.put_object(
            Bucket=test_bucket,
            Key=key,
            Body=content,
            ContentType="text/plain",
        )

        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
        assert "ETag" in response

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_get_object(self, s3_client, test_bucket):
        """Test downloading an object"""
        key = "test-get-object.txt"
        content = b"Test content for get operation"

        s3_client.put_object(Bucket=test_bucket, Key=key, Body=content)

        response = s3_client.get_object(Bucket=test_bucket, Key=key)
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
        assert response["Body"].read() == content

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_get_object_not_found(self, s3_client, test_bucket):
        """Test 404 for non-existent object"""
        with pytest.raises(ClientError) as exc_info:
            s3_client.get_object(Bucket=test_bucket, Key="non-existent-key")
        assert exc_info.value.response["Error"]["Code"] == "NoSuchKey"

    def test_head_object(self, s3_client, test_bucket):
        """Test object metadata retrieval"""
        key = "test-head-object.txt"
        content = b"Content for head test"

        s3_client.put_object(
            Bucket=test_bucket,
            Key=key,
            Body=content,
            ContentType="text/plain",
            Metadata={"custom-key": "custom-value"},
        )

        response = s3_client.head_object(Bucket=test_bucket, Key=key)
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
        assert response["ContentLength"] == len(content)
        assert response["ContentType"] == "text/plain"
        assert response["Metadata"].get("custom-key") == "custom-value"

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_delete_object(self, s3_client, test_bucket):
        """Test object deletion"""
        key = "test-delete-object.txt"
        s3_client.put_object(Bucket=test_bucket, Key=key, Body=b"To be deleted")

        response = s3_client.delete_object(Bucket=test_bucket, Key=key)
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 204

        with pytest.raises(ClientError) as exc_info:
            s3_client.head_object(Bucket=test_bucket, Key=key)
        assert exc_info.value.response["Error"]["Code"] == "404"

    def test_list_objects(self, s3_client, test_bucket):
        """Test listing objects with prefix"""
        prefix = "list-test/"
        keys = [f"{prefix}file{i}.txt" for i in range(5)]

        for key in keys:
            s3_client.put_object(Bucket=test_bucket, Key=key, Body=b"test")

        response = s3_client.list_objects_v2(Bucket=test_bucket, Prefix=prefix)
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200
        assert response["KeyCount"] == 5

        listed_keys = [obj["Key"] for obj in response["Contents"]]
        for key in keys:
            assert key in listed_keys

        for key in keys:
            s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_copy_object(self, s3_client, test_bucket):
        """Test copying an object"""
        source_key = "copy-source.txt"
        dest_key = "copy-dest.txt"
        content = b"Content to copy"

        s3_client.put_object(Bucket=test_bucket, Key=source_key, Body=content)

        response = s3_client.copy_object(
            CopySource={"Bucket": test_bucket, "Key": source_key},
            Bucket=test_bucket,
            Key=dest_key,
        )
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200

        dest_response = s3_client.get_object(Bucket=test_bucket, Key=dest_key)
        assert dest_response["Body"].read() == content

        s3_client.delete_object(Bucket=test_bucket, Key=source_key)
        s3_client.delete_object(Bucket=test_bucket, Key=dest_key)


class TestMultipartUpload:
    """Test S3 multipart upload operations"""

    def test_multipart_upload_complete(self, s3_client, test_bucket):
        """Test complete multipart upload flow"""
        key = "multipart-test.bin"
        part_size = 5 * 1024 * 1024
        num_parts = 2

        response = s3_client.create_multipart_upload(
            Bucket=test_bucket,
            Key=key,
            ContentType="application/octet-stream",
        )
        upload_id = response["UploadId"]
        assert upload_id

        parts = []
        for i in range(num_parts):
            part_data = os.urandom(part_size)
            part_response = s3_client.upload_part(
                Bucket=test_bucket,
                Key=key,
                UploadId=upload_id,
                PartNumber=i + 1,
                Body=part_data,
            )
            parts.append({
                "PartNumber": i + 1,
                "ETag": part_response["ETag"],
            })

        complete_response = s3_client.complete_multipart_upload(
            Bucket=test_bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )
        assert complete_response["ResponseMetadata"]["HTTPStatusCode"] == 200

        head_response = s3_client.head_object(Bucket=test_bucket, Key=key)
        assert head_response["ContentLength"] == part_size * num_parts

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_multipart_upload_abort(self, s3_client, test_bucket):
        """Test aborting a multipart upload"""
        key = "multipart-abort-test.bin"

        response = s3_client.create_multipart_upload(
            Bucket=test_bucket,
            Key=key,
        )
        upload_id = response["UploadId"]

        s3_client.upload_part(
            Bucket=test_bucket,
            Key=key,
            UploadId=upload_id,
            PartNumber=1,
            Body=os.urandom(5 * 1024 * 1024),
        )

        abort_response = s3_client.abort_multipart_upload(
            Bucket=test_bucket,
            Key=key,
            UploadId=upload_id,
        )
        assert abort_response["ResponseMetadata"]["HTTPStatusCode"] == 204


class TestPresignedUrls:
    """Test presigned URL generation and usage"""

    def test_presigned_get_url(self, s3_client, test_bucket):
        """Test presigned URL for GET"""
        key = "presigned-get-test.txt"
        content = b"Presigned content"

        s3_client.put_object(Bucket=test_bucket, Key=key, Body=content)

        url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": test_bucket, "Key": key},
            ExpiresIn=3600,
        )

        assert url
        assert test_bucket in url
        assert key in url
        assert "X-Amz-Signature" in url or "Signature" in url

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_presigned_put_url(self, s3_client, test_bucket):
        """Test presigned URL for PUT"""
        key = "presigned-put-test.txt"

        url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": test_bucket,
                "Key": key,
                "ContentType": "text/plain",
            },
            ExpiresIn=3600,
        )

        assert url
        assert test_bucket in url
        assert key in url

    def test_presigned_post(self, s3_client, test_bucket):
        """Test presigned POST for browser uploads"""
        key = "presigned-post-test.txt"

        response = s3_client.generate_presigned_post(
            Bucket=test_bucket,
            Key=key,
            Fields={"Content-Type": "text/plain"},
            Conditions=[
                {"Content-Type": "text/plain"},
                ["content-length-range", 1, 10485760],
            ],
            ExpiresIn=3600,
        )

        assert "url" in response
        assert "fields" in response
        assert "key" in response["fields"]


class TestMetadataAndHeaders:
    """Test metadata and header handling"""

    def test_custom_metadata(self, s3_client, test_bucket):
        """Test custom metadata storage and retrieval"""
        key = "metadata-test.txt"
        metadata = {
            "user-id": "12345",
            "document-type": "kyc",
            "upload-source": "mobile-app",
        }

        s3_client.put_object(
            Bucket=test_bucket,
            Key=key,
            Body=b"test",
            Metadata=metadata,
        )

        response = s3_client.head_object(Bucket=test_bucket, Key=key)
        for k, v in metadata.items():
            assert response["Metadata"].get(k) == v

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_content_type_preservation(self, s3_client, test_bucket):
        """Test content-type is preserved"""
        test_cases = [
            ("test.json", "application/json"),
            ("test.pdf", "application/pdf"),
            ("test.png", "image/png"),
            ("test.html", "text/html"),
        ]

        for key, content_type in test_cases:
            s3_client.put_object(
                Bucket=test_bucket,
                Key=key,
                Body=b"test",
                ContentType=content_type,
            )

            response = s3_client.head_object(Bucket=test_bucket, Key=key)
            assert response["ContentType"] == content_type

            s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_etag_consistency(self, s3_client, test_bucket):
        """Test ETag is consistent for same content"""
        key = "etag-test.txt"
        content = b"Consistent content for ETag test"
        expected_md5 = hashlib.md5(content).hexdigest()

        response1 = s3_client.put_object(Bucket=test_bucket, Key=key, Body=content)
        etag1 = response1["ETag"].strip('"')

        s3_client.delete_object(Bucket=test_bucket, Key=key)

        response2 = s3_client.put_object(Bucket=test_bucket, Key=key, Body=content)
        etag2 = response2["ETag"].strip('"')

        assert etag1 == etag2
        assert etag1 == expected_md5

        s3_client.delete_object(Bucket=test_bucket, Key=key)


class TestEscrowPlatformWorkflows:
    """Test escrow platform-specific workflows"""

    def test_kyc_document_upload_workflow(self, s3_client, test_bucket):
        """Test KYC document upload workflow"""
        user_id = "user-12345"
        doc_type = "national_id"
        timestamp = datetime.utcnow().isoformat()
        key = f"users/{user_id}/kyc/{doc_type}/{timestamp}"

        document_content = b"PDF content here..."

        response = s3_client.put_object(
            Bucket=test_bucket,
            Key=key,
            Body=document_content,
            ContentType="application/pdf",
            Metadata={
                "user_id": user_id,
                "document_type": doc_type,
                "upload_timestamp": timestamp,
            },
        )
        assert response["ResponseMetadata"]["HTTPStatusCode"] == 200

        head_response = s3_client.head_object(Bucket=test_bucket, Key=key)
        assert head_response["ContentType"] == "application/pdf"
        assert head_response["Metadata"]["user_id"] == user_id

        s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_dispute_evidence_workflow(self, s3_client, test_bucket):
        """Test dispute evidence upload workflow"""
        dispute_id = "dispute-67890"
        evidence_files = [
            ("screenshot.png", "image/png", b"PNG content"),
            ("chat_log.txt", "text/plain", b"Chat log content"),
            ("receipt.pdf", "application/pdf", b"Receipt PDF"),
        ]

        uploaded_keys = []
        for filename, content_type, content in evidence_files:
            key = f"disputes/{dispute_id}/evidence/{filename}"
            s3_client.put_object(
                Bucket=test_bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
                Metadata={"dispute_id": dispute_id},
            )
            uploaded_keys.append(key)

        list_response = s3_client.list_objects_v2(
            Bucket=test_bucket,
            Prefix=f"disputes/{dispute_id}/evidence/",
        )
        assert list_response["KeyCount"] == 3

        for key in uploaded_keys:
            s3_client.delete_object(Bucket=test_bucket, Key=key)

    def test_transaction_export_workflow(self, s3_client, test_bucket):
        """Test transaction export workflow"""
        merchant_id = "merchant-abc"
        export_date = datetime.utcnow().strftime("%Y-%m-%d")
        key = f"exports/{merchant_id}/transactions/{export_date}.csv"

        csv_content = b"id,amount,status\n1,1000,completed\n2,2000,pending"

        s3_client.put_object(
            Bucket=test_bucket,
            Key=key,
            Body=csv_content,
            ContentType="text/csv",
            Metadata={
                "merchant_id": merchant_id,
                "export_date": export_date,
                "record_count": "2",
            },
        )

        presigned_url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": test_bucket, "Key": key},
            ExpiresIn=86400,
        )
        assert presigned_url

        s3_client.delete_object(Bucket=test_bucket, Key=key)


class TestRustFSStorageClient:
    """Test the RustFSStorage Python client"""

    def test_storage_client_initialization(self):
        """Test storage client can be initialized"""
        from app.rustfs_storage import RustFSStorage, StorageConfig

        config = StorageConfig(
            endpoint_url=RUSTFS_ENDPOINT,
            access_key=RUSTFS_ACCESS_KEY,
            secret_key=RUSTFS_SECRET_KEY,
            region=RUSTFS_REGION,
        )
        storage = RustFSStorage(config)
        assert storage.config.endpoint_url == RUSTFS_ENDPOINT

    def test_storage_bucket_enum(self):
        """Test storage bucket enum values"""
        from app.rustfs_storage import StorageBucket

        assert StorageBucket.DOCUMENTS == "escrow-documents"
        assert StorageBucket.KYC == "escrow-kyc"
        assert StorageBucket.EVIDENCE == "escrow-evidence"
        assert StorageBucket.EXPORTS == "escrow-exports"

    def test_upload_result_dataclass(self):
        """Test UploadResult dataclass"""
        from app.rustfs_storage import UploadResult

        result = UploadResult(
            bucket="test-bucket",
            key="test-key",
            etag="abc123",
            version_id="v1",
            size=1024,
            content_type="application/pdf",
        )
        assert result.bucket == "test-bucket"
        assert result.size == 1024


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

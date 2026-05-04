#!/usr/bin/env python3
"""
RustFS S3 Compatibility Test Suite

This test suite validates that RustFS behaves identically to MinIO for all S3 operations
used by the payment-switch platform, including Spark/Flink/Ray data pipelines.

Usage:
    # Run all tests
    python rustfs_compatibility_test.py

    # Run with custom endpoint
    S3_ENDPOINT=http://rustfs.lakehouse:9000 python rustfs_compatibility_test.py

Environment Variables:
    S3_ENDPOINT: RustFS/MinIO endpoint (default: http://rustfs.lakehouse:9000)
    AWS_ACCESS_KEY_ID: Access key
    AWS_SECRET_ACCESS_KEY: Secret key
    S3_REGION: Region (default: us-east-1)
"""

import os
import sys
import json
import time
import uuid
import hashlib
import tempfile
import threading
import unittest
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


class RustFSTestConfig:
    """Configuration for RustFS compatibility tests"""
    
    def __init__(self):
        self.endpoint = os.getenv('S3_ENDPOINT', 'http://rustfs.lakehouse:9000')
        self.region = os.getenv('S3_REGION', 'us-east-1')
        self.access_key = os.getenv('AWS_ACCESS_KEY_ID', '')
        self.secret_key = os.getenv('AWS_SECRET_ACCESS_KEY', '')
        self.test_bucket = os.getenv('S3_TEST_BUCKET', 'rustfs-python-test')
        
    def get_s3_client(self):
        """Create and return an S3 client configured for RustFS"""
        return boto3.client(
            's3',
            endpoint_url=self.endpoint,
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}
            )
        )
    
    def get_s3_resource(self):
        """Create and return an S3 resource configured for RustFS"""
        return boto3.resource(
            's3',
            endpoint_url=self.endpoint,
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}
            )
        )


class TestBucketOperations(unittest.TestCase):
    """Test bucket-level S3 operations"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = f"bucket-test-{uuid.uuid4().hex[:8]}"
    
    @classmethod
    def tearDownClass(cls):
        try:
            cls.s3.delete_bucket(Bucket=cls.test_bucket)
        except Exception:
            pass
    
    def test_01_create_bucket(self):
        """Test bucket creation"""
        response = self.s3.create_bucket(Bucket=self.test_bucket)
        self.assertIn('Location', response)
    
    def test_02_head_bucket(self):
        """Test bucket existence check"""
        response = self.s3.head_bucket(Bucket=self.test_bucket)
        self.assertEqual(response['ResponseMetadata']['HTTPStatusCode'], 200)
    
    def test_03_list_buckets(self):
        """Test bucket listing"""
        response = self.s3.list_buckets()
        bucket_names = [b['Name'] for b in response['Buckets']]
        self.assertIn(self.test_bucket, bucket_names)
    
    def test_04_delete_bucket(self):
        """Test bucket deletion"""
        response = self.s3.delete_bucket(Bucket=self.test_bucket)
        self.assertEqual(response['ResponseMetadata']['HTTPStatusCode'], 204)
        
        # Verify deletion
        with self.assertRaises(ClientError):
            self.s3.head_bucket(Bucket=self.test_bucket)


class TestObjectOperations(unittest.TestCase):
    """Test object-level S3 operations"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = cls.config.test_bucket
        
        # Ensure test bucket exists
        try:
            cls.s3.create_bucket(Bucket=cls.test_bucket)
        except ClientError as e:
            if e.response['Error']['Code'] != 'BucketAlreadyOwnedByYou':
                raise
    
    def test_put_object(self):
        """Test object upload"""
        key = f"test-object-{uuid.uuid4().hex[:8]}.txt"
        content = b"Hello, RustFS! This is a test object."
        
        response = self.s3.put_object(
            Bucket=self.test_bucket,
            Key=key,
            Body=content,
            ContentType='text/plain',
            Metadata={'test-key': 'test-value'}
        )
        
        self.assertIn('ETag', response)
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_get_object(self):
        """Test object download"""
        key = f"test-object-{uuid.uuid4().hex[:8]}.txt"
        content = b"Test content for download"
        
        # Upload
        self.s3.put_object(Bucket=self.test_bucket, Key=key, Body=content)
        
        # Download
        response = self.s3.get_object(Bucket=self.test_bucket, Key=key)
        downloaded_content = response['Body'].read()
        
        self.assertEqual(downloaded_content, content)
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_head_object(self):
        """Test object metadata retrieval"""
        key = f"test-object-{uuid.uuid4().hex[:8]}.txt"
        content = b"Test content"
        
        # Upload with metadata
        self.s3.put_object(
            Bucket=self.test_bucket,
            Key=key,
            Body=content,
            ContentType='text/plain',
            Metadata={'custom-key': 'custom-value'}
        )
        
        # Get metadata
        response = self.s3.head_object(Bucket=self.test_bucket, Key=key)
        
        self.assertEqual(response['ContentLength'], len(content))
        self.assertEqual(response['ContentType'], 'text/plain')
        self.assertEqual(response['Metadata'].get('custom-key'), 'custom-value')
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_list_objects_v2(self):
        """Test object listing with pagination"""
        prefix = f"list-test-{uuid.uuid4().hex[:8]}/"
        keys = [f"{prefix}object-{i}.txt" for i in range(5)]
        
        # Upload objects
        for key in keys:
            self.s3.put_object(Bucket=self.test_bucket, Key=key, Body=b"test")
        
        # List objects
        response = self.s3.list_objects_v2(
            Bucket=self.test_bucket,
            Prefix=prefix
        )
        
        listed_keys = [obj['Key'] for obj in response.get('Contents', [])]
        for key in keys:
            self.assertIn(key, listed_keys)
        
        # Cleanup
        for key in keys:
            self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_delete_object(self):
        """Test object deletion"""
        key = f"test-object-{uuid.uuid4().hex[:8]}.txt"
        
        # Upload
        self.s3.put_object(Bucket=self.test_bucket, Key=key, Body=b"test")
        
        # Delete
        response = self.s3.delete_object(Bucket=self.test_bucket, Key=key)
        self.assertEqual(response['ResponseMetadata']['HTTPStatusCode'], 204)
        
        # Verify deletion
        with self.assertRaises(ClientError):
            self.s3.head_object(Bucket=self.test_bucket, Key=key)
    
    def test_copy_object(self):
        """Test object copying"""
        source_key = f"source-{uuid.uuid4().hex[:8]}.txt"
        dest_key = f"dest-{uuid.uuid4().hex[:8]}.txt"
        content = b"Content to copy"
        
        # Upload source
        self.s3.put_object(Bucket=self.test_bucket, Key=source_key, Body=content)
        
        # Copy
        self.s3.copy_object(
            Bucket=self.test_bucket,
            Key=dest_key,
            CopySource={'Bucket': self.test_bucket, 'Key': source_key}
        )
        
        # Verify copy
        response = self.s3.get_object(Bucket=self.test_bucket, Key=dest_key)
        self.assertEqual(response['Body'].read(), content)
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=source_key)
        self.s3.delete_object(Bucket=self.test_bucket, Key=dest_key)


class TestPresignedURLs(unittest.TestCase):
    """Test presigned URL generation"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = cls.config.test_bucket
        
        try:
            cls.s3.create_bucket(Bucket=cls.test_bucket)
        except ClientError:
            pass
    
    def test_presigned_get_url(self):
        """Test presigned GET URL generation"""
        key = f"presigned-{uuid.uuid4().hex[:8]}.txt"
        content = b"Presigned URL test content"
        
        # Upload
        self.s3.put_object(Bucket=self.test_bucket, Key=key, Body=content)
        
        # Generate presigned URL
        url = self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.test_bucket, 'Key': key},
            ExpiresIn=3600
        )
        
        self.assertIsNotNone(url)
        self.assertIn(self.test_bucket, url)
        self.assertIn(key, url)
        self.assertIn('X-Amz-Signature', url)
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_presigned_put_url(self):
        """Test presigned PUT URL generation"""
        key = f"presigned-put-{uuid.uuid4().hex[:8]}.txt"
        
        # Generate presigned URL for upload
        url = self.s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': self.test_bucket, 'Key': key},
            ExpiresIn=3600
        )
        
        self.assertIsNotNone(url)
        self.assertIn('X-Amz-Signature', url)


class TestMultipartUpload(unittest.TestCase):
    """Test multipart upload operations"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = cls.config.test_bucket
        
        try:
            cls.s3.create_bucket(Bucket=cls.test_bucket)
        except ClientError:
            pass
    
    def test_multipart_upload(self):
        """Test complete multipart upload workflow"""
        key = f"multipart-{uuid.uuid4().hex[:8]}.bin"
        part_size = 5 * 1024 * 1024  # 5MB minimum
        num_parts = 2
        
        # Create test data
        test_data = os.urandom(part_size * num_parts)
        
        # Initiate multipart upload
        response = self.s3.create_multipart_upload(
            Bucket=self.test_bucket,
            Key=key,
            ContentType='application/octet-stream'
        )
        upload_id = response['UploadId']
        
        # Upload parts
        parts = []
        for i in range(num_parts):
            part_number = i + 1
            start = i * part_size
            end = start + part_size
            part_data = test_data[start:end]
            
            response = self.s3.upload_part(
                Bucket=self.test_bucket,
                Key=key,
                UploadId=upload_id,
                PartNumber=part_number,
                Body=part_data
            )
            
            parts.append({
                'ETag': response['ETag'],
                'PartNumber': part_number
            })
        
        # Complete multipart upload
        self.s3.complete_multipart_upload(
            Bucket=self.test_bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={'Parts': parts}
        )
        
        # Verify upload
        response = self.s3.head_object(Bucket=self.test_bucket, Key=key)
        self.assertEqual(response['ContentLength'], len(test_data))
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_abort_multipart_upload(self):
        """Test aborting a multipart upload"""
        key = f"abort-multipart-{uuid.uuid4().hex[:8]}.bin"
        
        # Initiate multipart upload
        response = self.s3.create_multipart_upload(
            Bucket=self.test_bucket,
            Key=key
        )
        upload_id = response['UploadId']
        
        # Abort
        self.s3.abort_multipart_upload(
            Bucket=self.test_bucket,
            Key=key,
            UploadId=upload_id
        )
        
        # Verify object doesn't exist
        with self.assertRaises(ClientError):
            self.s3.head_object(Bucket=self.test_bucket, Key=key)


class TestVersioning(unittest.TestCase):
    """Test bucket versioning operations"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = f"versioning-test-{uuid.uuid4().hex[:8]}"
        
        cls.s3.create_bucket(Bucket=cls.test_bucket)
    
    @classmethod
    def tearDownClass(cls):
        try:
            # Delete all versions
            response = cls.s3.list_object_versions(Bucket=cls.test_bucket)
            for version in response.get('Versions', []):
                cls.s3.delete_object(
                    Bucket=cls.test_bucket,
                    Key=version['Key'],
                    VersionId=version['VersionId']
                )
            for marker in response.get('DeleteMarkers', []):
                cls.s3.delete_object(
                    Bucket=cls.test_bucket,
                    Key=marker['Key'],
                    VersionId=marker['VersionId']
                )
            cls.s3.delete_bucket(Bucket=cls.test_bucket)
        except Exception:
            pass
    
    def test_enable_versioning(self):
        """Test enabling bucket versioning"""
        self.s3.put_bucket_versioning(
            Bucket=self.test_bucket,
            VersioningConfiguration={'Status': 'Enabled'}
        )
        
        response = self.s3.get_bucket_versioning(Bucket=self.test_bucket)
        self.assertEqual(response.get('Status'), 'Enabled')
    
    def test_multiple_versions(self):
        """Test uploading multiple versions of an object"""
        key = "versioned-object.txt"
        versions = []
        
        for i in range(3):
            content = f"Version {i + 1}".encode()
            response = self.s3.put_object(
                Bucket=self.test_bucket,
                Key=key,
                Body=content
            )
            if 'VersionId' in response:
                versions.append(response['VersionId'])
        
        # List versions
        response = self.s3.list_object_versions(
            Bucket=self.test_bucket,
            Prefix=key
        )
        
        listed_versions = [v['VersionId'] for v in response.get('Versions', [])]
        for version_id in versions:
            if version_id:
                self.assertIn(version_id, listed_versions)


class TestConcurrentOperations(unittest.TestCase):
    """Test concurrent S3 operations"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = cls.config.test_bucket
        
        try:
            cls.s3.create_bucket(Bucket=cls.test_bucket)
        except ClientError:
            pass
    
    def test_concurrent_writes(self):
        """Test concurrent object uploads"""
        num_concurrent = 20
        prefix = f"concurrent-{uuid.uuid4().hex[:8]}/"
        
        def upload_object(index):
            key = f"{prefix}object-{index}.txt"
            content = f"Concurrent content {index}".encode()
            self.s3.put_object(Bucket=self.test_bucket, Key=key, Body=content)
            return key
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(upload_object, i) for i in range(num_concurrent)]
            keys = [f.result() for f in as_completed(futures)]
        
        self.assertEqual(len(keys), num_concurrent)
        
        # Cleanup
        for key in keys:
            self.s3.delete_object(Bucket=self.test_bucket, Key=key)
    
    def test_concurrent_reads(self):
        """Test concurrent object downloads"""
        num_concurrent = 20
        prefix = f"concurrent-read-{uuid.uuid4().hex[:8]}/"
        keys = []
        
        # Upload objects first
        for i in range(num_concurrent):
            key = f"{prefix}object-{i}.txt"
            self.s3.put_object(
                Bucket=self.test_bucket,
                Key=key,
                Body=f"Content {i}".encode()
            )
            keys.append(key)
        
        def download_object(key):
            response = self.s3.get_object(Bucket=self.test_bucket, Key=key)
            return response['Body'].read()
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(download_object, key) for key in keys]
            results = [f.result() for f in as_completed(futures)]
        
        self.assertEqual(len(results), num_concurrent)
        
        # Cleanup
        for key in keys:
            self.s3.delete_object(Bucket=self.test_bucket, Key=key)


class TestLargeObjects(unittest.TestCase):
    """Test operations with larger objects"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = cls.config.test_bucket
        
        try:
            cls.s3.create_bucket(Bucket=cls.test_bucket)
        except ClientError:
            pass
    
    def test_large_object_integrity(self):
        """Test upload/download integrity for large objects"""
        key = f"large-object-{uuid.uuid4().hex[:8]}.bin"
        object_size = 10 * 1024 * 1024  # 10MB
        
        # Generate random data
        test_data = os.urandom(object_size)
        expected_hash = hashlib.sha256(test_data).hexdigest()
        
        # Upload
        self.s3.put_object(Bucket=self.test_bucket, Key=key, Body=test_data)
        
        # Download
        response = self.s3.get_object(Bucket=self.test_bucket, Key=key)
        downloaded_data = response['Body'].read()
        
        # Verify integrity
        actual_hash = hashlib.sha256(downloaded_data).hexdigest()
        self.assertEqual(actual_hash, expected_hash)
        self.assertEqual(len(downloaded_data), object_size)
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)


class TestDeltaLakeCompatibility(unittest.TestCase):
    """Test operations specific to Delta Lake usage patterns"""
    
    @classmethod
    def setUpClass(cls):
        cls.config = RustFSTestConfig()
        cls.s3 = cls.config.get_s3_client()
        cls.test_bucket = cls.config.test_bucket
        
        try:
            cls.s3.create_bucket(Bucket=cls.test_bucket)
        except ClientError:
            pass
    
    def test_delta_log_operations(self):
        """Test Delta Lake _delta_log directory operations"""
        prefix = f"delta-table-{uuid.uuid4().hex[:8]}/_delta_log/"
        
        # Simulate Delta Lake log files
        log_files = [
            f"{prefix}00000000000000000000.json",
            f"{prefix}00000000000000000001.json",
            f"{prefix}00000000000000000002.json",
            f"{prefix}_last_checkpoint",
        ]
        
        # Upload log files
        for log_file in log_files:
            content = json.dumps({"test": "data"}).encode()
            self.s3.put_object(Bucket=self.test_bucket, Key=log_file, Body=content)
        
        # List log files (Delta Lake pattern)
        response = self.s3.list_objects_v2(
            Bucket=self.test_bucket,
            Prefix=prefix
        )
        
        listed_keys = [obj['Key'] for obj in response.get('Contents', [])]
        for log_file in log_files:
            self.assertIn(log_file, listed_keys)
        
        # Cleanup
        for log_file in log_files:
            self.s3.delete_object(Bucket=self.test_bucket, Key=log_file)
    
    def test_parquet_file_operations(self):
        """Test Parquet file upload/download (simulated)"""
        key = f"delta-table-{uuid.uuid4().hex[:8]}/part-00000.parquet"
        
        # Simulate Parquet file (random binary data)
        parquet_data = os.urandom(1024 * 100)  # 100KB
        
        # Upload
        self.s3.put_object(
            Bucket=self.test_bucket,
            Key=key,
            Body=parquet_data,
            ContentType='application/octet-stream'
        )
        
        # Download
        response = self.s3.get_object(Bucket=self.test_bucket, Key=key)
        downloaded_data = response['Body'].read()
        
        self.assertEqual(downloaded_data, parquet_data)
        
        # Cleanup
        self.s3.delete_object(Bucket=self.test_bucket, Key=key)


def run_all_tests():
    """Run all tests and return results summary"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestBucketOperations,
        TestObjectOperations,
        TestPresignedURLs,
        TestMultipartUpload,
        TestVersioning,
        TestConcurrentOperations,
        TestLargeObjects,
        TestDeltaLakeCompatibility,
    ]
    
    for test_class in test_classes:
        tests = loader.loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\n" + "=" * 70)
    print("RUSTFS COMPATIBILITY TEST SUMMARY")
    print("=" * 70)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped)}")
    print(f"Success: {result.wasSuccessful()}")
    print("=" * 70)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)

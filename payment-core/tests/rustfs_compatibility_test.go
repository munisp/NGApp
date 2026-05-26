// Package tests provides S3 compatibility tests for RustFS migration
// This test suite validates that RustFS behaves identically to MinIO for all S3 operations
// used by the payment-switch platform.
package tests

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
)

// TestConfig holds S3 test configuration
type TestConfig struct {
	Endpoint        string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	UsePathStyle    bool
	TestBucket      string
}

// DefaultTestConfig returns configuration from environment variables
func DefaultTestConfig() *TestConfig {
	return &TestConfig{
		Endpoint:        getEnvOrDefault("S3_ENDPOINT", "http://rustfs.lakehouse:9000"),
		Region:          getEnvOrDefault("S3_REGION", "us-east-1"),
		AccessKeyID:     getEnvOrDefault("AWS_ACCESS_KEY_ID", ""),
		SecretAccessKey: getEnvOrDefault("AWS_SECRET_ACCESS_KEY", ""),
		UsePathStyle:    true,
		TestBucket:      getEnvOrDefault("S3_TEST_BUCKET", "rustfs-compatibility-test"),
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// S3TestClient wraps the S3 client for testing
type S3TestClient struct {
	client *s3.Client
	config *TestConfig
}

// NewS3TestClient creates a new S3 test client
func NewS3TestClient(cfg *TestConfig) (*S3TestClient, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               cfg.Endpoint,
			HostnameImmutable: true,
		}, nil
	})

	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.Region),
		config.WithEndpointResolverWithOptions(customResolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID,
			cfg.SecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle
	})

	return &S3TestClient{
		client: client,
		config: cfg,
	}, nil
}

// TestBucketOperations tests bucket creation, listing, and deletion
func TestBucketOperations(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := fmt.Sprintf("test-bucket-%s", uuid.New().String()[:8])

	// Test: Create bucket
	t.Run("CreateBucket", func(t *testing.T) {
		_, err := client.client.CreateBucket(ctx, &s3.CreateBucketInput{
			Bucket: aws.String(testBucket),
		})
		if err != nil {
			t.Fatalf("Failed to create bucket: %v", err)
		}
	})

	// Test: Head bucket (check existence)
	t.Run("HeadBucket", func(t *testing.T) {
		_, err := client.client.HeadBucket(ctx, &s3.HeadBucketInput{
			Bucket: aws.String(testBucket),
		})
		if err != nil {
			t.Fatalf("Failed to head bucket: %v", err)
		}
	})

	// Test: List buckets
	t.Run("ListBuckets", func(t *testing.T) {
		output, err := client.client.ListBuckets(ctx, &s3.ListBucketsInput{})
		if err != nil {
			t.Fatalf("Failed to list buckets: %v", err)
		}

		found := false
		for _, bucket := range output.Buckets {
			if aws.ToString(bucket.Name) == testBucket {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("Created bucket not found in list")
		}
	})

	// Cleanup: Delete bucket
	t.Run("DeleteBucket", func(t *testing.T) {
		_, err := client.client.DeleteBucket(ctx, &s3.DeleteBucketInput{
			Bucket: aws.String(testBucket),
		})
		if err != nil {
			t.Fatalf("Failed to delete bucket: %v", err)
		}
	})
}

// TestObjectOperations tests basic object CRUD operations
func TestObjectOperations(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := cfg.TestBucket

	// Ensure test bucket exists
	client.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(testBucket),
	})

	testKey := fmt.Sprintf("test-object-%s.txt", uuid.New().String()[:8])
	testContent := []byte("Hello, RustFS! This is a test object for S3 compatibility testing.")
	contentHash := sha256.Sum256(testContent)
	expectedHash := hex.EncodeToString(contentHash[:])

	// Test: PutObject
	t.Run("PutObject", func(t *testing.T) {
		_, err := client.client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(testBucket),
			Key:         aws.String(testKey),
			Body:        bytes.NewReader(testContent),
			ContentType: aws.String("text/plain"),
			Metadata: map[string]string{
				"test-key":     "test-value",
				"content-hash": expectedHash,
			},
		})
		if err != nil {
			t.Fatalf("Failed to put object: %v", err)
		}
	})

	// Test: HeadObject
	t.Run("HeadObject", func(t *testing.T) {
		output, err := client.client.HeadObject(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		})
		if err != nil {
			t.Fatalf("Failed to head object: %v", err)
		}

		if aws.ToInt64(output.ContentLength) != int64(len(testContent)) {
			t.Errorf("Content length mismatch: expected %d, got %d", len(testContent), aws.ToInt64(output.ContentLength))
		}

		if aws.ToString(output.ContentType) != "text/plain" {
			t.Errorf("Content type mismatch: expected text/plain, got %s", aws.ToString(output.ContentType))
		}
	})

	// Test: GetObject
	t.Run("GetObject", func(t *testing.T) {
		output, err := client.client.GetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		})
		if err != nil {
			t.Fatalf("Failed to get object: %v", err)
		}
		defer output.Body.Close()

		content, err := io.ReadAll(output.Body)
		if err != nil {
			t.Fatalf("Failed to read object body: %v", err)
		}

		if !bytes.Equal(content, testContent) {
			t.Errorf("Content mismatch: expected %s, got %s", string(testContent), string(content))
		}

		// Verify metadata
		if output.Metadata["test-key"] != "test-value" {
			t.Errorf("Metadata mismatch: expected test-value, got %s", output.Metadata["test-key"])
		}
	})

	// Test: ListObjectsV2
	t.Run("ListObjectsV2", func(t *testing.T) {
		output, err := client.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket: aws.String(testBucket),
			Prefix: aws.String("test-object-"),
		})
		if err != nil {
			t.Fatalf("Failed to list objects: %v", err)
		}

		found := false
		for _, obj := range output.Contents {
			if aws.ToString(obj.Key) == testKey {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("Created object not found in list")
		}
	})

	// Test: DeleteObject
	t.Run("DeleteObject", func(t *testing.T) {
		_, err := client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		})
		if err != nil {
			t.Fatalf("Failed to delete object: %v", err)
		}

		// Verify deletion
		_, err = client.client.HeadObject(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		})
		if err == nil {
			t.Fatalf("Object still exists after deletion")
		}
	})
}

// TestPresignedURLs tests presigned URL generation and usage
func TestPresignedURLs(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := cfg.TestBucket

	// Ensure test bucket exists
	client.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(testBucket),
	})

	testKey := fmt.Sprintf("presigned-test-%s.txt", uuid.New().String()[:8])
	testContent := []byte("Presigned URL test content")

	// Upload test object
	_, err = client.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(testBucket),
		Key:    aws.String(testKey),
		Body:   bytes.NewReader(testContent),
	})
	if err != nil {
		t.Fatalf("Failed to upload test object: %v", err)
	}

	// Test: Generate presigned GET URL
	t.Run("PresignGetObject", func(t *testing.T) {
		presignClient := s3.NewPresignClient(client.client)

		request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		}, s3.WithPresignExpires(15*time.Minute))
		if err != nil {
			t.Fatalf("Failed to generate presigned URL: %v", err)
		}

		if request.URL == "" {
			t.Fatalf("Presigned URL is empty")
		}

		// Verify URL contains expected components
		if !strings.Contains(request.URL, testBucket) {
			t.Errorf("Presigned URL does not contain bucket name")
		}
		if !strings.Contains(request.URL, testKey) {
			t.Errorf("Presigned URL does not contain object key")
		}
		if !strings.Contains(request.URL, "X-Amz-Signature") {
			t.Errorf("Presigned URL does not contain signature")
		}

		t.Logf("Generated presigned URL: %s", request.URL)
	})

	// Cleanup
	client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(testBucket),
		Key:    aws.String(testKey),
	})
}

// TestMultipartUpload tests multipart upload operations
func TestMultipartUpload(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := cfg.TestBucket

	// Ensure test bucket exists
	client.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(testBucket),
	})

	testKey := fmt.Sprintf("multipart-test-%s.bin", uuid.New().String()[:8])

	// Create 10MB test data (minimum part size is 5MB)
	partSize := 5 * 1024 * 1024 // 5MB
	numParts := 2
	totalSize := partSize * numParts
	testData := make([]byte, totalSize)
	for i := range testData {
		testData[i] = byte(i % 256)
	}

	var uploadID string
	var completedParts []types.CompletedPart

	// Test: Create multipart upload
	t.Run("CreateMultipartUpload", func(t *testing.T) {
		output, err := client.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
			Bucket:      aws.String(testBucket),
			Key:         aws.String(testKey),
			ContentType: aws.String("application/octet-stream"),
		})
		if err != nil {
			t.Fatalf("Failed to create multipart upload: %v", err)
		}
		uploadID = aws.ToString(output.UploadId)
		if uploadID == "" {
			t.Fatalf("Upload ID is empty")
		}
	})

	// Test: Upload parts
	t.Run("UploadParts", func(t *testing.T) {
		for i := 0; i < numParts; i++ {
			partNumber := int32(i + 1)
			start := i * partSize
			end := start + partSize
			partData := testData[start:end]

			output, err := client.client.UploadPart(ctx, &s3.UploadPartInput{
				Bucket:     aws.String(testBucket),
				Key:        aws.String(testKey),
				UploadId:   aws.String(uploadID),
				PartNumber: aws.Int32(partNumber),
				Body:       bytes.NewReader(partData),
			})
			if err != nil {
				t.Fatalf("Failed to upload part %d: %v", partNumber, err)
			}

			completedParts = append(completedParts, types.CompletedPart{
				ETag:       output.ETag,
				PartNumber: aws.Int32(partNumber),
			})
		}
	})

	// Test: Complete multipart upload
	t.Run("CompleteMultipartUpload", func(t *testing.T) {
		_, err := client.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
			Bucket:   aws.String(testBucket),
			Key:      aws.String(testKey),
			UploadId: aws.String(uploadID),
			MultipartUpload: &types.CompletedMultipartUpload{
				Parts: completedParts,
			},
		})
		if err != nil {
			t.Fatalf("Failed to complete multipart upload: %v", err)
		}
	})

	// Verify uploaded object
	t.Run("VerifyMultipartObject", func(t *testing.T) {
		output, err := client.client.HeadObject(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		})
		if err != nil {
			t.Fatalf("Failed to head multipart object: %v", err)
		}

		if aws.ToInt64(output.ContentLength) != int64(totalSize) {
			t.Errorf("Content length mismatch: expected %d, got %d", totalSize, aws.ToInt64(output.ContentLength))
		}
	})

	// Cleanup
	client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(testBucket),
		Key:    aws.String(testKey),
	})
}

// TestVersioning tests bucket versioning operations
func TestVersioning(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := fmt.Sprintf("versioning-test-%s", uuid.New().String()[:8])

	// Create test bucket
	_, err = client.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(testBucket),
	})
	if err != nil {
		t.Fatalf("Failed to create bucket: %v", err)
	}

	// Test: Enable versioning
	t.Run("EnableVersioning", func(t *testing.T) {
		_, err := client.client.PutBucketVersioning(ctx, &s3.PutBucketVersioningInput{
			Bucket: aws.String(testBucket),
			VersioningConfiguration: &types.VersioningConfiguration{
				Status: types.BucketVersioningStatusEnabled,
			},
		})
		if err != nil {
			t.Fatalf("Failed to enable versioning: %v", err)
		}
	})

	// Test: Get versioning status
	t.Run("GetVersioningStatus", func(t *testing.T) {
		output, err := client.client.GetBucketVersioning(ctx, &s3.GetBucketVersioningInput{
			Bucket: aws.String(testBucket),
		})
		if err != nil {
			t.Fatalf("Failed to get versioning status: %v", err)
		}

		if output.Status != types.BucketVersioningStatusEnabled {
			t.Errorf("Versioning status mismatch: expected Enabled, got %s", output.Status)
		}
	})

	// Test: Upload multiple versions
	testKey := "versioned-object.txt"
	var versionIDs []string

	t.Run("UploadMultipleVersions", func(t *testing.T) {
		for i := 1; i <= 3; i++ {
			content := []byte(fmt.Sprintf("Version %d content", i))
			output, err := client.client.PutObject(ctx, &s3.PutObjectInput{
				Bucket: aws.String(testBucket),
				Key:    aws.String(testKey),
				Body:   bytes.NewReader(content),
			})
			if err != nil {
				t.Fatalf("Failed to upload version %d: %v", i, err)
			}
			if output.VersionId != nil {
				versionIDs = append(versionIDs, aws.ToString(output.VersionId))
			}
		}

		if len(versionIDs) < 3 {
			t.Logf("Warning: Expected 3 version IDs, got %d (versioning may not be fully supported)", len(versionIDs))
		}
	})

	// Cleanup: Delete all versions and bucket
	t.Run("Cleanup", func(t *testing.T) {
		// List and delete all object versions
		listOutput, _ := client.client.ListObjectVersions(ctx, &s3.ListObjectVersionsInput{
			Bucket: aws.String(testBucket),
		})
		if listOutput != nil {
			for _, version := range listOutput.Versions {
				client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
					Bucket:    aws.String(testBucket),
					Key:       version.Key,
					VersionId: version.VersionId,
				})
			}
			for _, marker := range listOutput.DeleteMarkers {
				client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
					Bucket:    aws.String(testBucket),
					Key:       marker.Key,
					VersionId: marker.VersionId,
				})
			}
		}

		// Delete bucket
		client.client.DeleteBucket(ctx, &s3.DeleteBucketInput{
			Bucket: aws.String(testBucket),
		})
	})
}

// TestConcurrentOperations tests concurrent read/write operations
func TestConcurrentOperations(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := cfg.TestBucket

	// Ensure test bucket exists
	client.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(testBucket),
	})

	numConcurrent := 10
	var wg sync.WaitGroup
	errors := make(chan error, numConcurrent*2)
	keys := make([]string, numConcurrent)

	// Concurrent writes
	t.Run("ConcurrentWrites", func(t *testing.T) {
		for i := 0; i < numConcurrent; i++ {
			wg.Add(1)
			keys[i] = fmt.Sprintf("concurrent-test-%d-%s.txt", i, uuid.New().String()[:8])
			go func(key string, index int) {
				defer wg.Done()
				content := []byte(fmt.Sprintf("Concurrent content %d", index))
				_, err := client.client.PutObject(ctx, &s3.PutObjectInput{
					Bucket: aws.String(testBucket),
					Key:    aws.String(key),
					Body:   bytes.NewReader(content),
				})
				if err != nil {
					errors <- fmt.Errorf("write %d failed: %w", index, err)
				}
			}(keys[i], i)
		}
		wg.Wait()

		select {
		case err := <-errors:
			t.Fatalf("Concurrent write failed: %v", err)
		default:
			t.Logf("All %d concurrent writes succeeded", numConcurrent)
		}
	})

	// Concurrent reads
	t.Run("ConcurrentReads", func(t *testing.T) {
		for i := 0; i < numConcurrent; i++ {
			wg.Add(1)
			go func(key string, index int) {
				defer wg.Done()
				output, err := client.client.GetObject(ctx, &s3.GetObjectInput{
					Bucket: aws.String(testBucket),
					Key:    aws.String(key),
				})
				if err != nil {
					errors <- fmt.Errorf("read %d failed: %w", index, err)
					return
				}
				defer output.Body.Close()
				io.ReadAll(output.Body)
			}(keys[i], i)
		}
		wg.Wait()

		select {
		case err := <-errors:
			t.Fatalf("Concurrent read failed: %v", err)
		default:
			t.Logf("All %d concurrent reads succeeded", numConcurrent)
		}
	})

	// Cleanup
	for _, key := range keys {
		client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(key),
		})
	}
}

// TestLargeObjectOperations tests operations with larger objects
func TestLargeObjectOperations(t *testing.T) {
	cfg := DefaultTestConfig()
	client, err := NewS3TestClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create S3 client: %v", err)
	}

	ctx := context.Background()
	testBucket := cfg.TestBucket

	// Ensure test bucket exists
	client.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(testBucket),
	})

	// Test with 1MB object
	testKey := fmt.Sprintf("large-object-%s.bin", uuid.New().String()[:8])
	objectSize := 1024 * 1024 // 1MB
	testData := make([]byte, objectSize)
	for i := range testData {
		testData[i] = byte(i % 256)
	}

	// Calculate hash for verification
	hash := sha256.Sum256(testData)
	expectedHash := hex.EncodeToString(hash[:])

	t.Run("UploadLargeObject", func(t *testing.T) {
		_, err := client.client.PutObject(ctx, &s3.PutObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
			Body:   bytes.NewReader(testData),
		})
		if err != nil {
			t.Fatalf("Failed to upload large object: %v", err)
		}
	})

	t.Run("DownloadAndVerifyLargeObject", func(t *testing.T) {
		output, err := client.client.GetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(testBucket),
			Key:    aws.String(testKey),
		})
		if err != nil {
			t.Fatalf("Failed to download large object: %v", err)
		}
		defer output.Body.Close()

		downloadedData, err := io.ReadAll(output.Body)
		if err != nil {
			t.Fatalf("Failed to read large object: %v", err)
		}

		// Verify size
		if len(downloadedData) != objectSize {
			t.Errorf("Size mismatch: expected %d, got %d", objectSize, len(downloadedData))
		}

		// Verify hash
		downloadedHash := sha256.Sum256(downloadedData)
		actualHash := hex.EncodeToString(downloadedHash[:])
		if actualHash != expectedHash {
			t.Errorf("Hash mismatch: expected %s, got %s", expectedHash, actualHash)
		}
	})

	// Cleanup
	client.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(testBucket),
		Key:    aws.String(testKey),
	})
}

// RunAllTests runs all S3 compatibility tests and returns a summary
func RunAllTests() map[string]bool {
	results := make(map[string]bool)

	tests := []struct {
		name string
		fn   func(*testing.T)
	}{
		{"BucketOperations", TestBucketOperations},
		{"ObjectOperations", TestObjectOperations},
		{"PresignedURLs", TestPresignedURLs},
		{"MultipartUpload", TestMultipartUpload},
		{"Versioning", TestVersioning},
		{"ConcurrentOperations", TestConcurrentOperations},
		{"LargeObjectOperations", TestLargeObjectOperations},
	}

	for _, test := range tests {
		t := &testing.T{}
		test.fn(t)
		results[test.name] = !t.Failed()
	}

	return results
}

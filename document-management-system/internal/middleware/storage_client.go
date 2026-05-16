package middleware

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type StorageClient struct {
	s3Client   *s3.Client
	bucket     string
	endpoint   string
	region     string
}

type StorageConfig struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	Region          string
	UsePathStyle    bool
}

type UploadResult struct {
	Key         string    `json:"key"`
	Bucket      string    `json:"bucket"`
	Size        int64     `json:"size"`
	ContentType string    `json:"content_type"`
	Checksum    string    `json:"checksum"`
	UploadedAt  time.Time `json:"uploaded_at"`
	URL         string    `json:"url"`
}

type DownloadResult struct {
	Data        []byte    `json:"data"`
	Size        int64     `json:"size"`
	ContentType string    `json:"content_type"`
	Checksum    string    `json:"checksum"`
	LastModified time.Time `json:"last_modified"`
}

func NewStorageClient(cfg *StorageConfig) (*StorageClient, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.Endpoint != "" {
			return aws.Endpoint{
				URL:               cfg.Endpoint,
				HostnameImmutable: true,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID,
			cfg.SecretAccessKey,
			"",
		)),
		config.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle
	})

	return &StorageClient{
		s3Client: s3Client,
		bucket:   cfg.Bucket,
		endpoint: cfg.Endpoint,
		region:   cfg.Region,
	}, nil
}

func (s *StorageClient) Upload(ctx context.Context, key string, data []byte, contentType string) (*UploadResult, error) {
	checksum := sha256.Sum256(data)
	checksumHex := hex.EncodeToString(checksum[:])

	_, err := s.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(data),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(int64(len(data))),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload object: %w", err)
	}

	return &UploadResult{
		Key:         key,
		Bucket:      s.bucket,
		Size:        int64(len(data)),
		ContentType: contentType,
		Checksum:    checksumHex,
		UploadedAt:  time.Now(),
		URL:         s.GetObjectURL(key),
	}, nil
}

func (s *StorageClient) UploadDocument(ctx context.Context, docID string, fileName string, data []byte, contentType string) (*UploadResult, error) {
	ext := filepath.Ext(fileName)
	key := fmt.Sprintf("documents/%s/%s%s", docID[:2], docID, ext)

	return s.Upload(ctx, key, data, contentType)
}

func (s *StorageClient) UploadVersion(ctx context.Context, docID string, version int, fileName string, data []byte, contentType string) (*UploadResult, error) {
	ext := filepath.Ext(fileName)
	key := fmt.Sprintf("documents/%s/%s/v%d%s", docID[:2], docID, version, ext)

	return s.Upload(ctx, key, data, contentType)
}

func (s *StorageClient) UploadThumbnail(ctx context.Context, docID string, data []byte) (*UploadResult, error) {
	key := fmt.Sprintf("thumbnails/%s/%s.jpg", docID[:2], docID)

	return s.Upload(ctx, key, data, "image/jpeg")
}

func (s *StorageClient) Download(ctx context.Context, key string) (*DownloadResult, error) {
	result, err := s.s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download object: %w", err)
	}
	defer result.Body.Close()

	data, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read object body: %w", err)
	}

	checksum := sha256.Sum256(data)
	checksumHex := hex.EncodeToString(checksum[:])

	contentType := ""
	if result.ContentType != nil {
		contentType = *result.ContentType
	}

	var lastModified time.Time
	if result.LastModified != nil {
		lastModified = *result.LastModified
	}

	return &DownloadResult{
		Data:         data,
		Size:         int64(len(data)),
		ContentType:  contentType,
		Checksum:     checksumHex,
		LastModified: lastModified,
	}, nil
}

func (s *StorageClient) Delete(ctx context.Context, key string) error {
	_, err := s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *StorageClient) DeleteDocument(ctx context.Context, docID string) error {
	prefix := fmt.Sprintf("documents/%s/%s", docID[:2], docID)

	listResult, err := s.s3Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return fmt.Errorf("failed to list objects: %w", err)
	}

	for _, obj := range listResult.Contents {
		if err := s.Delete(ctx, *obj.Key); err != nil {
			return err
		}
	}

	thumbnailKey := fmt.Sprintf("thumbnails/%s/%s.jpg", docID[:2], docID)
	s.Delete(ctx, thumbnailKey)

	return nil
}

func (s *StorageClient) GetObjectURL(key string) string {
	if s.endpoint != "" {
		return fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, key)
}

func (s *StorageClient) GeneratePresignedURL(ctx context.Context, key string, expiration time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(s.s3Client)

	request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiration))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return request.URL, nil
}

func (s *StorageClient) GenerateUploadURL(ctx context.Context, key string, contentType string, expiration time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(s.s3Client)

	request, err := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiration))
	if err != nil {
		return "", fmt.Errorf("failed to generate upload URL: %w", err)
	}

	return request.URL, nil
}

func (s *StorageClient) ListDocuments(ctx context.Context, prefix string, maxKeys int32) ([]string, error) {
	result, err := s.s3Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket:  aws.String(s.bucket),
		Prefix:  aws.String(prefix),
		MaxKeys: aws.Int32(maxKeys),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list objects: %w", err)
	}

	var keys []string
	for _, obj := range result.Contents {
		keys = append(keys, *obj.Key)
	}

	return keys, nil
}

func (s *StorageClient) CopyObject(ctx context.Context, sourceKey, destKey string) error {
	_, err := s.s3Client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(s.bucket),
		CopySource: aws.String(fmt.Sprintf("%s/%s", s.bucket, sourceKey)),
		Key:        aws.String(destKey),
	})
	return err
}

func (s *StorageClient) GetObjectMetadata(ctx context.Context, key string) (map[string]string, error) {
	result, err := s.s3Client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get object metadata: %w", err)
	}

	metadata := make(map[string]string)
	for k, v := range result.Metadata {
		metadata[k] = v
	}

	if result.ContentType != nil {
		metadata["content-type"] = *result.ContentType
	}
	if result.ContentLength != nil {
		metadata["content-length"] = fmt.Sprintf("%d", *result.ContentLength)
	}

	return metadata, nil
}

func (s *StorageClient) Close() error {
	return nil
}

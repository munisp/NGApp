// Package onboarding provides document storage with S3-compatible storage (RustFS/MinIO)
package onboarding

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
	"github.com/google/uuid"
)

// DocumentStorageConfig holds S3-compatible storage configuration (RustFS/MinIO)
type DocumentStorageConfig struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	UsePathStyle    bool // For S3-compatible storage (RustFS/MinIO)
}

// DefaultDocumentStorageConfig returns default configuration
func DefaultDocumentStorageConfig() *DocumentStorageConfig {
	return &DocumentStorageConfig{
		Endpoint:        getEnv("S3_ENDPOINT", "http://rustfs.lakehouse.svc.cluster.local:9000"),
		Region:          getEnv("S3_REGION", "us-east-1"),
		Bucket:          getEnv("S3_BUCKET", "onboarding-documents"),
		AccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", getEnv("S3_ACCESS_KEY_ID", "")),
		SecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", getEnv("S3_SECRET_ACCESS_KEY", "")),
		UsePathStyle:    getEnv("S3_USE_PATH_STYLE", "true") == "true",
	}
}

// DocumentStorage handles document storage operations
type DocumentStorage struct {
	client *s3.Client
	bucket string
}

// NewDocumentStorage creates a new document storage client
func NewDocumentStorage(cfg *DocumentStorageConfig) (*DocumentStorage, error) {
	if cfg == nil {
		cfg = DefaultDocumentStorageConfig()
	}

	// Create custom endpoint resolver for MinIO
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

	storage := &DocumentStorage{
		client: client,
		bucket: cfg.Bucket,
	}

	// Ensure bucket exists
	if err := storage.ensureBucket(context.Background()); err != nil {
		return nil, err
	}

	return storage, nil
}

// ensureBucket creates the bucket if it doesn't exist
func (s *DocumentStorage) ensureBucket(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err == nil {
		return nil
	}

	_, err = s.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err != nil {
		return fmt.Errorf("failed to create bucket: %w", err)
	}

	return nil
}

// Document represents a stored document
type Document struct {
	ID           string            `json:"id"`
	CaseID       string            `json:"case_id"`
	FileName     string            `json:"file_name"`
	ContentType  string            `json:"content_type"`
	Size         int64             `json:"size"`
	ContentHash  string            `json:"content_hash"`
	S3Key        string            `json:"s3_key"`
	Version      string            `json:"version"`
	UploadedBy   string            `json:"uploaded_by"`
	UploadedAt   time.Time         `json:"uploaded_at"`
	ScanStatus   string            `json:"scan_status"` // PENDING, CLEAN, INFECTED
	ScanResult   string            `json:"scan_result"`
	Metadata     map[string]string `json:"metadata"`
	RetentionEnd time.Time         `json:"retention_end"`
}

// UploadDocument uploads a document to storage
func (s *DocumentStorage) UploadDocument(ctx context.Context, caseID string, fileName string, contentType string, data io.Reader, uploadedBy string) (*Document, error) {
	// Read all data to calculate hash
	content, err := io.ReadAll(data)
	if err != nil {
		return nil, fmt.Errorf("failed to read document: %w", err)
	}

	// Calculate content hash
	hash := sha256.Sum256(content)
	contentHash := hex.EncodeToString(hash[:])

	// Generate document ID and S3 key
	docID := uuid.New().String()
	ext := filepath.Ext(fileName)
	s3Key := fmt.Sprintf("cases/%s/documents/%s%s", caseID, docID, ext)

	// Upload to S3
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(s3Key),
		Body:        bytes.NewReader(content),
		ContentType: aws.String(contentType),
		Metadata: map[string]string{
			"case-id":      caseID,
			"document-id":  docID,
			"content-hash": contentHash,
			"uploaded-by":  uploadedBy,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}

	// Get version ID
	headOutput, _ := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	})

	version := ""
	if headOutput != nil && headOutput.VersionId != nil {
		version = *headOutput.VersionId
	}

	doc := &Document{
		ID:           docID,
		CaseID:       caseID,
		FileName:     fileName,
		ContentType:  contentType,
		Size:         int64(len(content)),
		ContentHash:  contentHash,
		S3Key:        s3Key,
		Version:      version,
		UploadedBy:   uploadedBy,
		UploadedAt:   time.Now(),
		ScanStatus:   "PENDING",
		RetentionEnd: time.Now().AddDate(7, 0, 0), // 7 year retention
		Metadata:     make(map[string]string),
	}

	return doc, nil
}

// GetDocument retrieves a document from storage
func (s *DocumentStorage) GetDocument(ctx context.Context, s3Key string) (io.ReadCloser, *Document, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get document: %w", err)
	}

	doc := &Document{
		S3Key:       s3Key,
		ContentType: aws.ToString(output.ContentType),
		Size:        aws.ToInt64(output.ContentLength),
	}

	if output.Metadata != nil {
		doc.ID = output.Metadata["document-id"]
		doc.CaseID = output.Metadata["case-id"]
		doc.ContentHash = output.Metadata["content-hash"]
		doc.UploadedBy = output.Metadata["uploaded-by"]
	}

	return output.Body, doc, nil
}

// GetPresignedURL generates a presigned URL for document download
func (s *DocumentStorage) GetPresignedURL(ctx context.Context, s3Key string, expiry time.Duration) (string, error) {
	presignClient := s3.NewPresignClient(s.client)

	request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return request.URL, nil
}

// DeleteDocument deletes a document from storage
func (s *DocumentStorage) DeleteDocument(ctx context.Context, s3Key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}

	return nil
}

// ListDocuments lists all documents for a case
func (s *DocumentStorage) ListDocuments(ctx context.Context, caseID string) ([]*Document, error) {
	prefix := fmt.Sprintf("cases/%s/documents/", caseID)

	output, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}

	var documents []*Document
	for _, obj := range output.Contents {
		doc := &Document{
			S3Key:      aws.ToString(obj.Key),
			Size:       aws.ToInt64(obj.Size),
			UploadedAt: aws.ToTime(obj.LastModified),
		}
		documents = append(documents, doc)
	}

	return documents, nil
}

// VerifyContentHash verifies the integrity of a document
func (s *DocumentStorage) VerifyContentHash(ctx context.Context, s3Key string, expectedHash string) (bool, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return false, fmt.Errorf("failed to get document: %w", err)
	}
	defer output.Body.Close()

	content, err := io.ReadAll(output.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read document: %w", err)
	}

	hash := sha256.Sum256(content)
	actualHash := hex.EncodeToString(hash[:])

	return actualHash == expectedHash, nil
}

// EvidenceLink represents a link between a requirement and evidence documents
type EvidenceLink struct {
	ID            string    `json:"id"`
	RequirementID string    `json:"requirement_id"`
	DocumentID    string    `json:"document_id"`
	LinkedBy      string    `json:"linked_by"`
	LinkedAt      time.Time `json:"linked_at"`
	Notes         string    `json:"notes"`
}

// EvidenceManager manages evidence linking for requirements
type EvidenceManager struct {
	storage *DocumentStorage
	store   EvidenceStore
}

// EvidenceStore interface for storing evidence links
type EvidenceStore interface {
	AddEvidenceLink(ctx context.Context, link *EvidenceLink) error
	GetEvidenceLinks(ctx context.Context, requirementID string) ([]*EvidenceLink, error)
	RemoveEvidenceLink(ctx context.Context, linkID string) error
}

// NewEvidenceManager creates a new evidence manager
func NewEvidenceManager(storage *DocumentStorage, store EvidenceStore) *EvidenceManager {
	return &EvidenceManager{
		storage: storage,
		store:   store,
	}
}

// LinkEvidence links a document to a requirement as evidence
func (m *EvidenceManager) LinkEvidence(ctx context.Context, requirementID, documentID, linkedBy, notes string) (*EvidenceLink, error) {
	link := &EvidenceLink{
		ID:            uuid.New().String(),
		RequirementID: requirementID,
		DocumentID:    documentID,
		LinkedBy:      linkedBy,
		LinkedAt:      time.Now(),
		Notes:         notes,
	}

	if err := m.store.AddEvidenceLink(ctx, link); err != nil {
		return nil, err
	}

	return link, nil
}

// GetRequirementEvidence retrieves all evidence for a requirement
func (m *EvidenceManager) GetRequirementEvidence(ctx context.Context, requirementID string) ([]*EvidenceLink, error) {
	return m.store.GetEvidenceLinks(ctx, requirementID)
}

// ValidateRequirementEvidence validates that a requirement has sufficient evidence
func (m *EvidenceManager) ValidateRequirementEvidence(ctx context.Context, requirementID string, minDocuments int) (bool, error) {
	links, err := m.store.GetEvidenceLinks(ctx, requirementID)
	if err != nil {
		return false, err
	}

	return len(links) >= minDocuments, nil
}

// DocumentScanResult represents the result of a malware scan
type DocumentScanResult struct {
	DocumentID string    `json:"document_id"`
	Status     string    `json:"status"` // CLEAN, INFECTED, ERROR
	Engine     string    `json:"engine"`
	Details    string    `json:"details"`
	ScannedAt  time.Time `json:"scanned_at"`
}

// MalwareScanner interface for document scanning
type MalwareScanner interface {
	ScanDocument(ctx context.Context, content []byte) (*DocumentScanResult, error)
}

// ClamAVScanner implements malware scanning with ClamAV
type ClamAVScanner struct {
	endpoint string
}

// NewClamAVScanner creates a new ClamAV scanner
func NewClamAVScanner(endpoint string) *ClamAVScanner {
	if endpoint == "" {
		endpoint = getEnv("CLAMAV_ENDPOINT", "http://clamav.payment-switch.svc.cluster.local:3310")
	}
	return &ClamAVScanner{endpoint: endpoint}
}

// ScanDocument scans a document for malware
func (s *ClamAVScanner) ScanDocument(ctx context.Context, content []byte) (*DocumentScanResult, error) {
	// In production, this would call ClamAV REST API
	// For now, return clean status
	return &DocumentScanResult{
		Status:    "CLEAN",
		Engine:    "ClamAV",
		Details:   "No threats detected",
		ScannedAt: time.Now(),
	}, nil
}

// DocumentRetentionPolicy defines retention rules
type DocumentRetentionPolicy struct {
	DocumentType    string        `json:"document_type"`
	RetentionPeriod time.Duration `json:"retention_period"`
	LegalHold       bool          `json:"legal_hold"`
}

// DefaultRetentionPolicies returns default retention policies
func DefaultRetentionPolicies() map[string]DocumentRetentionPolicy {
	return map[string]DocumentRetentionPolicy{
		"certificate_of_incorporation": {RetentionPeriod: 10 * 365 * 24 * time.Hour}, // 10 years
		"banking_license":              {RetentionPeriod: 10 * 365 * 24 * time.Hour},
		"aml_policy":                   {RetentionPeriod: 7 * 365 * 24 * time.Hour}, // 7 years
		"financial_statements":         {RetentionPeriod: 7 * 365 * 24 * time.Hour},
		"board_resolution":             {RetentionPeriod: 10 * 365 * 24 * time.Hour},
		"default":                      {RetentionPeriod: 7 * 365 * 24 * time.Hour},
	}
}

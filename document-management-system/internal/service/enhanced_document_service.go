package service

import (
	"context"
	"crypto/sha256"
	"document-management-system/internal/middleware"
	"document-management-system/internal/models"
	"document-management-system/internal/ocr"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnhancedDocumentService struct {
	db            *gorm.DB
	kafka         *middleware.KafkaClient
	temporal      *middleware.TemporalClient
	redis         *middleware.RedisClient
	storage       *middleware.StorageClient
	elasticsearch *middleware.ElasticsearchClient
	ocrProvider   *ocr.MultiProviderOCR
}

type EnhancedDocumentConfig struct {
	KafkaBrokers        []string
	TemporalHost        string
	TemporalNamespace   string
	RedisAddr           string
	RedisPassword       string
	StorageEndpoint     string
	StorageAccessKey    string
	StorageSecretKey    string
	StorageBucket       string
	StorageRegion       string
	ElasticsearchAddrs  []string
	ElasticsearchUser   string
	ElasticsearchPass   string
	ElasticsearchIndex  string
	PaddleOCREndpoint   string
	VLMEndpoint         string
	VLMAPIKey           string
	VLMModel            string
	DoclingEndpoint     string
}

func NewEnhancedDocumentService(db *gorm.DB, config *EnhancedDocumentConfig) (*EnhancedDocumentService, error) {
	kafka, err := middleware.NewKafkaClient(config.KafkaBrokers, "document-consumer-group")
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka client: %w", err)
	}

	temporal, err := middleware.NewTemporalClient(config.TemporalHost, config.TemporalNamespace)
	if err != nil {
		return nil, fmt.Errorf("failed to create temporal client: %w", err)
	}

	redis, err := middleware.NewRedisClient(config.RedisAddr, config.RedisPassword, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to create redis client: %w", err)
	}

	storage, err := middleware.NewStorageClient(&middleware.StorageConfig{
		Endpoint:        config.StorageEndpoint,
		AccessKeyID:     config.StorageAccessKey,
		SecretAccessKey: config.StorageSecretKey,
		Bucket:          config.StorageBucket,
		Region:          config.StorageRegion,
		UsePathStyle:    true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create storage client: %w", err)
	}

	elasticsearch, err := middleware.NewElasticsearchClient(&middleware.ElasticsearchConfig{
		Addresses: config.ElasticsearchAddrs,
		Username:  config.ElasticsearchUser,
		Password:  config.ElasticsearchPass,
		Index:     config.ElasticsearchIndex,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create elasticsearch client: %w", err)
	}

	ocrProvider := ocr.NewMultiProviderOCR(&ocr.MultiProviderConfig{
		PaddleOCREndpoint: config.PaddleOCREndpoint,
		VLMEndpoint:       config.VLMEndpoint,
		VLMAPIKey:         config.VLMAPIKey,
		VLMModel:          config.VLMModel,
		DoclingEndpoint:   config.DoclingEndpoint,
		FallbackOrder:     []string{"PaddleOCR", "VLM", "Docling"},
		ConsensusMode:     false,
		MinConfidence:     0.7,
	})

	return &EnhancedDocumentService{
		db:            db,
		kafka:         kafka,
		temporal:      temporal,
		redis:         redis,
		storage:       storage,
		elasticsearch: elasticsearch,
		ocrProvider:   ocrProvider,
	}, nil
}

func (s *EnhancedDocumentService) UploadDocument(ctx context.Context, fileName string, data []byte, contentType string, documentType string, folderID string, uploadedBy string, metadata map[string]interface{}) (*models.Document, error) {
	docID := uuid.New()

	checksum := sha256.Sum256(data)
	checksumHex := hex.EncodeToString(checksum[:])

	uploadResult, err := s.storage.UploadDocument(ctx, docID.String(), fileName, data, contentType)
	if err != nil {
		return nil, fmt.Errorf("failed to upload to storage: %w", err)
	}

	doc := &models.Document{
		ID:           docID,
		FileName:     fileName,
		DocumentType: documentType,
		MimeType:     contentType,
		FileSize:     int64(len(data)),
		FilePath:     uploadResult.Key,
		Checksum:     checksumHex,
		Status:       "UPLOADED",
		Version:      1,
		UploadedBy:   uuid.MustParse(uploadedBy),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if folderID != "" {
		folderUUID := uuid.MustParse(folderID)
		doc.FolderID = &folderUUID
	}

	if err := s.db.WithContext(ctx).Create(doc).Error; err != nil {
		return nil, fmt.Errorf("failed to create document record: %w", err)
	}

	s.redis.CacheDocument(ctx, &middleware.CachedDocument{
		ID:           doc.ID.String(),
		FileName:     doc.FileName,
		DocumentType: doc.DocumentType,
		MimeType:     doc.MimeType,
		FileSize:     doc.FileSize,
		FilePath:     doc.FilePath,
		UploadedBy:   uploadedBy,
		Version:      doc.Version,
		OCRStatus:    "PENDING",
	}, 24*time.Hour)

	s.redis.AddUserDocument(ctx, uploadedBy, doc.ID.String())

	s.kafka.PublishDocumentUploaded(ctx, doc.ID.String(), documentType, fileName, doc.FileSize, uploadedBy)

	workflowInput := &middleware.DocumentProcessingInput{
		DocumentID:   doc.ID.String(),
		FileName:     fileName,
		FilePath:     uploadResult.Key,
		MimeType:     contentType,
		DocumentType: documentType,
		UploadedBy:   uploadedBy,
	}

	if _, err := s.temporal.StartDocumentProcessingWorkflow(ctx, workflowInput); err != nil {
		return nil, fmt.Errorf("failed to start processing workflow: %w", err)
	}

	return doc, nil
}

func (s *EnhancedDocumentService) ProcessDocumentOCR(ctx context.Context, docID string) (*ocr.InsuranceDocumentData, error) {
	doc, err := s.GetDocument(ctx, docID)
	if err != nil {
		return nil, err
	}

	cachedOCR, err := s.redis.GetCachedOCRResult(ctx, docID)
	if err == nil && cachedOCR != nil {
		return &ocr.InsuranceDocumentData{
			DocumentType:    doc.DocumentType,
			RawText:         cachedOCR.Text,
			ExtractedFields: cachedOCR.ExtractedFields,
			Confidence:      cachedOCR.Confidence,
			Provider:        cachedOCR.Provider,
		}, nil
	}

	downloadResult, err := s.storage.Download(ctx, doc.FilePath)
	if err != nil {
		s.kafka.PublishOCRFailed(ctx, docID, err.Error())
		return nil, fmt.Errorf("failed to download document: %w", err)
	}

	ocrResult, err := s.ocrProvider.ExtractInsuranceDocument(ctx, downloadResult.Data, doc.DocumentType)
	if err != nil {
		s.kafka.PublishOCRFailed(ctx, docID, err.Error())
		return nil, fmt.Errorf("failed to process OCR: %w", err)
	}

	s.db.WithContext(ctx).Model(&models.Document{}).Where("id = ?", docID).Updates(map[string]interface{}{
		"ocr_text":       ocrResult.RawText,
		"ocr_confidence": ocrResult.Confidence,
		"ocr_status":     "COMPLETED",
		"ocr_provider":   ocrResult.Provider,
		"updated_at":     time.Now(),
	})

	s.redis.CacheOCRResult(ctx, &middleware.CachedOCRResult{
		DocumentID:      docID,
		Text:            ocrResult.RawText,
		Confidence:      ocrResult.Confidence,
		Provider:        ocrResult.Provider,
		ExtractedFields: ocrResult.ExtractedFields,
	}, 7*24*time.Hour)

	s.elasticsearch.UpdateDocument(ctx, docID, map[string]interface{}{
		"ocr_text": ocrResult.RawText,
	})

	s.kafka.PublishOCRCompleted(ctx, docID, ocrResult.Confidence, ocrResult.ExtractedFields)

	return ocrResult, nil
}

func (s *EnhancedDocumentService) GetDocument(ctx context.Context, docID string) (*models.Document, error) {
	cachedDoc, err := s.redis.GetCachedDocument(ctx, docID)
	if err == nil && cachedDoc != nil {
		return &models.Document{
			ID:           uuid.MustParse(cachedDoc.ID),
			FileName:     cachedDoc.FileName,
			DocumentType: cachedDoc.DocumentType,
			MimeType:     cachedDoc.MimeType,
			FileSize:     cachedDoc.FileSize,
			FilePath:     cachedDoc.FilePath,
			Version:      cachedDoc.Version,
		}, nil
	}

	var doc models.Document
	if err := s.db.WithContext(ctx).First(&doc, "id = ?", docID).Error; err != nil {
		return nil, err
	}

	s.redis.CacheDocument(ctx, &middleware.CachedDocument{
		ID:           doc.ID.String(),
		FileName:     doc.FileName,
		DocumentType: doc.DocumentType,
		MimeType:     doc.MimeType,
		FileSize:     doc.FileSize,
		FilePath:     doc.FilePath,
		Version:      doc.Version,
	}, 1*time.Hour)

	return &doc, nil
}

func (s *EnhancedDocumentService) DownloadDocument(ctx context.Context, docID string, userID string) ([]byte, string, error) {
	doc, err := s.GetDocument(ctx, docID)
	if err != nil {
		return nil, "", err
	}

	downloadResult, err := s.storage.Download(ctx, doc.FilePath)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download document: %w", err)
	}

	s.redis.LogDocumentAccess(ctx, docID, userID, "DOWNLOAD")

	s.kafka.PublishEvent(ctx, middleware.TopicDocumentAccessed, &middleware.DocumentEvent{
		EventType:  "DOCUMENT_DOWNLOADED",
		DocumentID: docID,
		UploadedBy: userID,
	})

	return downloadResult.Data, doc.FileName, nil
}

func (s *EnhancedDocumentService) CreateVersion(ctx context.Context, docID string, fileName string, data []byte, contentType string, uploadedBy string) (*models.DocumentVersion, error) {
	doc, err := s.GetDocument(ctx, docID)
	if err != nil {
		return nil, err
	}

	newVersion := doc.Version + 1

	uploadResult, err := s.storage.UploadVersion(ctx, docID, newVersion, fileName, data, contentType)
	if err != nil {
		return nil, fmt.Errorf("failed to upload version: %w", err)
	}

	checksum := sha256.Sum256(data)
	checksumHex := hex.EncodeToString(checksum[:])

	version := &models.DocumentVersion{
		ID:         uuid.New(),
		DocumentID: uuid.MustParse(docID),
		Version:    newVersion,
		FileName:   fileName,
		FilePath:   uploadResult.Key,
		FileSize:   int64(len(data)),
		Checksum:   checksumHex,
		UploadedBy: uuid.MustParse(uploadedBy),
		CreatedAt:  time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(version).Error; err != nil {
		return nil, fmt.Errorf("failed to create version record: %w", err)
	}

	s.db.WithContext(ctx).Model(&models.Document{}).Where("id = ?", docID).Updates(map[string]interface{}{
		"version":    newVersion,
		"file_path":  uploadResult.Key,
		"file_size":  int64(len(data)),
		"checksum":   checksumHex,
		"updated_at": time.Now(),
	})

	s.redis.InvalidateDocumentCache(ctx, docID)

	s.kafka.PublishDocumentVersioned(ctx, docID, newVersion, uploadedBy)

	return version, nil
}

func (s *EnhancedDocumentService) SearchDocuments(ctx context.Context, query *middleware.SearchQuery) (*middleware.SearchResult, error) {
	cachedResults, err := s.redis.GetCachedSearchResults(ctx, query.Query)
	if err == nil && cachedResults != nil && len(cachedResults) > 0 {
		var documents []middleware.DocumentIndex
		for _, docID := range cachedResults {
			doc, err := s.GetDocument(ctx, docID)
			if err == nil {
				documents = append(documents, middleware.DocumentIndex{
					ID:           doc.ID.String(),
					FileName:     doc.FileName,
					DocumentType: doc.DocumentType,
					MimeType:     doc.MimeType,
				})
			}
		}
		return &middleware.SearchResult{
			Total:     int64(len(documents)),
			Documents: documents,
			Page:      query.Page,
			PageSize:  query.PageSize,
		}, nil
	}

	result, err := s.elasticsearch.Search(ctx, query)
	if err != nil {
		return nil, err
	}

	var docIDs []string
	for _, doc := range result.Documents {
		docIDs = append(docIDs, doc.ID)
	}
	s.redis.CacheSearchResults(ctx, query.Query, docIDs, 5*time.Minute)

	return result, nil
}

func (s *EnhancedDocumentService) DeleteDocument(ctx context.Context, docID string, userID string) error {
	doc, err := s.GetDocument(ctx, docID)
	if err != nil {
		return err
	}

	if err := s.storage.DeleteDocument(ctx, docID); err != nil {
		return fmt.Errorf("failed to delete from storage: %w", err)
	}

	if err := s.db.WithContext(ctx).Delete(&models.Document{}, "id = ?", docID).Error; err != nil {
		return fmt.Errorf("failed to delete document record: %w", err)
	}

	s.redis.InvalidateDocumentCache(ctx, docID)
	s.redis.RemoveUserDocument(ctx, doc.UploadedBy.String(), docID)

	s.elasticsearch.DeleteDocument(ctx, docID)

	s.kafka.PublishEvent(ctx, middleware.TopicDocumentDeleted, &middleware.DocumentEvent{
		EventType:  "DOCUMENT_DELETED",
		DocumentID: docID,
		UploadedBy: userID,
	})

	return nil
}

func (s *EnhancedDocumentService) CreateFolder(ctx context.Context, name string, parentID string, createdBy string) (*models.DocumentFolder, error) {
	folder := &models.DocumentFolder{
		ID:        uuid.New(),
		Name:      name,
		CreatedBy: uuid.MustParse(createdBy),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if parentID != "" {
		parentUUID := uuid.MustParse(parentID)
		folder.ParentID = &parentUUID

		var parent models.DocumentFolder
		if err := s.db.WithContext(ctx).First(&parent, "id = ?", parentID).Error; err != nil {
			return nil, fmt.Errorf("parent folder not found: %w", err)
		}
		folder.Path = filepath.Join(parent.Path, name)
	} else {
		folder.Path = "/" + name
	}

	if err := s.db.WithContext(ctx).Create(folder).Error; err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	return folder, nil
}

func (s *EnhancedDocumentService) GetFolderContents(ctx context.Context, folderID string) ([]models.Document, []models.DocumentFolder, error) {
	var documents []models.Document
	var subfolders []models.DocumentFolder

	if folderID == "" {
		s.db.WithContext(ctx).Where("folder_id IS NULL").Find(&documents)
		s.db.WithContext(ctx).Where("parent_id IS NULL").Find(&subfolders)
	} else {
		s.db.WithContext(ctx).Where("folder_id = ?", folderID).Find(&documents)
		s.db.WithContext(ctx).Where("parent_id = ?", folderID).Find(&subfolders)
	}

	return documents, subfolders, nil
}

func (s *EnhancedDocumentService) GetDocumentAccessLog(ctx context.Context, docID string, limit int64) ([]map[string]interface{}, error) {
	return s.redis.GetDocumentAccessLog(ctx, docID, limit)
}

func (s *EnhancedDocumentService) GetDocumentStats(ctx context.Context) (map[string]interface{}, error) {
	var totalDocs, totalSize int64
	var docsByType []struct {
		DocumentType string
		Count        int64
	}

	s.db.Model(&models.Document{}).Count(&totalDocs)
	s.db.Model(&models.Document{}).Select("COALESCE(SUM(file_size), 0)").Scan(&totalSize)
	s.db.Model(&models.Document{}).Select("document_type, COUNT(*) as count").Group("document_type").Scan(&docsByType)

	uploadStats, _ := s.redis.GetDocumentStats(ctx, "uploads", 30)
	downloadStats, _ := s.redis.GetDocumentStats(ctx, "downloads", 30)

	return map[string]interface{}{
		"total_documents":   totalDocs,
		"total_size_bytes":  totalSize,
		"documents_by_type": docsByType,
		"upload_stats":      uploadStats,
		"download_stats":    downloadStats,
	}, nil
}

func (s *EnhancedDocumentService) GeneratePresignedURL(ctx context.Context, docID string, expiration time.Duration) (string, error) {
	doc, err := s.GetDocument(ctx, docID)
	if err != nil {
		return "", err
	}

	return s.storage.GeneratePresignedURL(ctx, doc.FilePath, expiration)
}

func (s *EnhancedDocumentService) Close() error {
	s.kafka.Close()
	s.temporal.Close()
	s.redis.Close()
	s.elasticsearch.Close()
	return nil
}

package service

import (
	"context"
	"crypto/sha256"
	"document-management-system/internal/models"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DocumentService struct {
	db *gorm.DB
}

func NewDocumentService(db *gorm.DB) *DocumentService {
	return &DocumentService{db: db}
}

func (s *DocumentService) CreateDocument(ctx context.Context, doc *models.Document) error {
	doc.ID = uuid.New()
	doc.DocumentNumber = fmt.Sprintf("DOC-%d", time.Now().UnixNano())
	doc.Status = models.DocumentStatusPending
	doc.Version = 1
	return s.db.WithContext(ctx).Create(doc).Error
}

func (s *DocumentService) GetDocument(ctx context.Context, docID uuid.UUID) (*models.Document, error) {
	var doc models.Document
	err := s.db.WithContext(ctx).First(&doc, "id = ?", docID).Error
	return &doc, err
}

func (s *DocumentService) UpdateDocument(ctx context.Context, docID uuid.UUID, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&models.Document{}).Where("id = ?", docID).Updates(updates).Error
}

func (s *DocumentService) CreateVersion(ctx context.Context, docID uuid.UUID, version *models.DocumentVersion) error {
	var doc models.Document
	if err := s.db.WithContext(ctx).First(&doc, "id = ?", docID).Error; err != nil {
		return err
	}

	version.ID = uuid.New()
	version.DocumentID = docID
	version.Version = doc.Version + 1

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(version).Error; err != nil {
			return err
		}
		return tx.Model(&doc).Update("version", version.Version).Error
	})
}

func (s *DocumentService) GetVersions(ctx context.Context, docID uuid.UUID) ([]models.DocumentVersion, error) {
	var versions []models.DocumentVersion
	err := s.db.WithContext(ctx).Where("document_id = ?", docID).Order("version DESC").Find(&versions).Error
	return versions, err
}

func (s *DocumentService) LogAccess(ctx context.Context, access *models.DocumentAccess) error {
	access.ID = uuid.New()
	return s.db.WithContext(ctx).Create(access).Error
}

func (s *DocumentService) SearchDocuments(ctx context.Context, query string, entityType string, entityID uuid.UUID) ([]models.Document, error) {
	var docs []models.Document
	db := s.db.WithContext(ctx)

	if query != "" {
		searchPattern := "%" + query + "%"
		db = db.Where("title ILIKE ? OR description ILIKE ? OR ocr_text ILIKE ?", searchPattern, searchPattern, searchPattern)
	}
	if entityType != "" {
		db = db.Where("entity_type = ?", entityType)
	}
	if entityID != uuid.Nil {
		db = db.Where("entity_id = ?", entityID)
	}

	err := db.Order("created_at DESC").Find(&docs).Error
	return docs, err
}

func (s *DocumentService) ProcessOCR(ctx context.Context, docID uuid.UUID, ocrText string) error {
	return s.db.WithContext(ctx).Model(&models.Document{}).Where("id = ?", docID).Updates(map[string]interface{}{
		"ocr_text":      ocrText,
		"ocr_processed": true,
	}).Error
}

func (s *DocumentService) VerifyDocument(ctx context.Context, docID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&models.Document{}).Where("id = ?", docID).Update("status", models.DocumentStatusVerified).Error
}

func (s *DocumentService) ArchiveDocument(ctx context.Context, docID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&models.Document{}).Where("id = ?", docID).Update("status", models.DocumentStatusArchived).Error
}

func (s *DocumentService) CalculateChecksum(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func (s *DocumentService) CreateFolder(ctx context.Context, folder *models.DocumentFolder) error {
	folder.ID = uuid.New()
	return s.db.WithContext(ctx).Create(folder).Error
}

func (s *DocumentService) GetFolders(ctx context.Context, parentID *uuid.UUID) ([]models.DocumentFolder, error) {
	var folders []models.DocumentFolder
	query := s.db.WithContext(ctx)
	if parentID != nil {
		query = query.Where("parent_id = ?", parentID)
	} else {
		query = query.Where("parent_id IS NULL")
	}
	err := query.Find(&folders).Error
	return folders, err
}

func (s *DocumentService) GetDocumentStats(ctx context.Context) (map[string]interface{}, error) {
	var total, pending, verified, archived int64
	var totalSize int64

	s.db.Model(&models.Document{}).Count(&total)
	s.db.Model(&models.Document{}).Where("status = ?", models.DocumentStatusPending).Count(&pending)
	s.db.Model(&models.Document{}).Where("status = ?", models.DocumentStatusVerified).Count(&verified)
	s.db.Model(&models.Document{}).Where("status = ?", models.DocumentStatusArchived).Count(&archived)
	s.db.Model(&models.Document{}).Select("COALESCE(SUM(file_size), 0)").Scan(&totalSize)

	return map[string]interface{}{
		"total_documents":    total,
		"pending_documents":  pending,
		"verified_documents": verified,
		"archived_documents": archived,
		"total_storage_bytes": totalSize,
	}, nil
}

package sync

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"

	"erpnext-integration-service/internal/erpnext"
	"erpnext-integration-service/internal/models"
)

// DocumentSyncService handles synchronization of documents to ERPNext DMS
type DocumentSyncService struct {
	erpnextClient *erpnext.Client
}

// NewDocumentSyncService creates a new document sync service
func NewDocumentSyncService(erpnextClient *erpnext.Client) *DocumentSyncService {
	return &DocumentSyncService{
		erpnextClient: erpnextClient,
	}
}

// SyncDocumentCreated syncs a newly created document to ERPNext DMS
func (s *DocumentSyncService) SyncDocumentCreated(ctx context.Context, event *models.DocumentCreatedEvent) (string, error) {
	log.Printf("Syncing document: DocumentID=%s, FileName=%s", event.DocumentID, event.FileName)

	// Download the file from S3
	fileContent, err := s.downloadFile(ctx, event.FileURL)
	if err != nil {
		return "", fmt.Errorf("failed to download file from S3: %w", err)
	}

	// Encode file content as base64
	base64Content := base64.StdEncoding.EncodeToString(fileContent)

	// Create file in ERPNext
	file := &erpnext.File{
		FileName:          event.FileName,
		IsPrivate:         boolToInt(event.IsPrivate),
		AttachedToDoctype: event.RelatedEntityType,
		AttachedToName:    event.RelatedEntityID,
		Content:           base64Content,
	}

	fileID, err := s.erpnextClient.UploadFile(ctx, file)
	if err != nil {
		return "", fmt.Errorf("failed to upload file to ERPNext: %w", err)
	}

	log.Printf("Uploaded file to ERPNext: %s", fileID)

	return fileID, nil
}

// downloadFile downloads a file from a URL
func (s *DocumentSyncService) downloadFile(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download file: status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// boolToInt converts a boolean to an integer (0 or 1)
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

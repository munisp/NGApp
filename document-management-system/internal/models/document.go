package models

import (
	"time"

	"github.com/google/uuid"
)

type DocumentStatus string

const (
	DocumentStatusPending   DocumentStatus = "PENDING"
	DocumentStatusProcessed DocumentStatus = "PROCESSED"
	DocumentStatusVerified  DocumentStatus = "VERIFIED"
	DocumentStatusRejected  DocumentStatus = "REJECTED"
	DocumentStatusArchived  DocumentStatus = "ARCHIVED"
)

type Document struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	DocumentNumber string        `json:"document_number" gorm:"type:varchar(50);unique"`
	Title         string         `json:"title" gorm:"type:varchar(255);not null"`
	Description   string         `json:"description" gorm:"type:text"`
	DocumentType  string         `json:"document_type" gorm:"type:varchar(50);not null"`
	Category      string         `json:"category" gorm:"type:varchar(50)"`
	FileName      string         `json:"file_name" gorm:"type:varchar(255)"`
	FilePath      string         `json:"file_path" gorm:"type:varchar(500)"`
	FileSize      int64          `json:"file_size"`
	MimeType      string         `json:"mime_type" gorm:"type:varchar(100)"`
	Checksum      string         `json:"checksum" gorm:"type:varchar(64)"`
	Status        DocumentStatus `json:"status" gorm:"type:varchar(20);not null"`
	Version       int            `json:"version" gorm:"default:1"`
	ParentID      *uuid.UUID     `json:"parent_id" gorm:"type:uuid"`
	EntityType    string         `json:"entity_type" gorm:"type:varchar(50)"`
	EntityID      uuid.UUID      `json:"entity_id" gorm:"type:uuid;index"`
	UploadedBy    uuid.UUID      `json:"uploaded_by" gorm:"type:uuid"`
	OCRText       string         `json:"ocr_text" gorm:"type:text"`
	OCRProcessed  bool           `json:"ocr_processed" gorm:"default:false"`
	Tags          string         `json:"tags" gorm:"type:jsonb"`
	Metadata      string         `json:"metadata" gorm:"type:jsonb"`
	ExpiresAt     *time.Time     `json:"expires_at"`
	CreatedAt     time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

type DocumentVersion struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	DocumentID   uuid.UUID `json:"document_id" gorm:"type:uuid;not null;index"`
	Version      int       `json:"version" gorm:"not null"`
	FileName     string    `json:"file_name" gorm:"type:varchar(255)"`
	FilePath     string    `json:"file_path" gorm:"type:varchar(500)"`
	FileSize     int64     `json:"file_size"`
	Checksum     string    `json:"checksum" gorm:"type:varchar(64)"`
	ChangeNotes  string    `json:"change_notes" gorm:"type:text"`
	CreatedBy    uuid.UUID `json:"created_by" gorm:"type:uuid"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type DocumentAccess struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	DocumentID   uuid.UUID `json:"document_id" gorm:"type:uuid;not null;index"`
	UserID       uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	AccessType   string    `json:"access_type" gorm:"type:varchar(20)"`
	AccessedAt   time.Time `json:"accessed_at" gorm:"autoCreateTime"`
	IPAddress    string    `json:"ip_address" gorm:"type:varchar(45)"`
	UserAgent    string    `json:"user_agent" gorm:"type:varchar(500)"`
}

type DocumentFolder struct {
	ID          uuid.UUID  `json:"id" gorm:"type:uuid;primary_key"`
	Name        string     `json:"name" gorm:"type:varchar(100);not null"`
	Description string     `json:"description" gorm:"type:text"`
	ParentID    *uuid.UUID `json:"parent_id" gorm:"type:uuid"`
	Path        string     `json:"path" gorm:"type:varchar(500)"`
	OwnerID     uuid.UUID  `json:"owner_id" gorm:"type:uuid"`
	IsPublic    bool       `json:"is_public" gorm:"default:false"`
	CreatedAt   time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

type DocumentTemplate struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Name         string    `json:"name" gorm:"type:varchar(100);not null"`
	Description  string    `json:"description" gorm:"type:text"`
	TemplateType string    `json:"template_type" gorm:"type:varchar(50)"`
	Content      string    `json:"content" gorm:"type:text"`
	Variables    string    `json:"variables" gorm:"type:jsonb"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

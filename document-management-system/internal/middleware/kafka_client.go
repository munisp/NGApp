package middleware

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type KafkaClient struct {
	writer        *kafka.Writer
	brokers       []string
	consumerGroup string
}

const (
	TopicDocumentUploaded    = "documents.uploaded"
	TopicDocumentProcessed   = "documents.processed"
	TopicDocumentVerified    = "documents.verified"
	TopicDocumentClassified  = "documents.classified"
	TopicOCRCompleted        = "documents.ocr.completed"
	TopicOCRFailed           = "documents.ocr.failed"
	TopicDocumentExpiring    = "documents.expiring"
	TopicDocumentDeleted     = "documents.deleted"
	TopicDocumentAccessed    = "documents.accessed"
	TopicDocumentVersioned   = "documents.versioned"
)

type DocumentEvent struct {
	EventID       string                 `json:"event_id"`
	EventType     string                 `json:"event_type"`
	Timestamp     time.Time              `json:"timestamp"`
	DocumentID    string                 `json:"document_id"`
	DocumentType  string                 `json:"document_type"`
	FileName      string                 `json:"file_name"`
	FileSize      int64                  `json:"file_size"`
	MimeType      string                 `json:"mime_type"`
	UploadedBy    string                 `json:"uploaded_by"`
	FolderID      string                 `json:"folder_id,omitempty"`
	Version       int                    `json:"version,omitempty"`
	OCRStatus     string                 `json:"ocr_status,omitempty"`
	OCRConfidence float64                `json:"ocr_confidence,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

func NewKafkaClient(brokers []string, consumerGroup string) (*KafkaClient, error) {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Async:        false,
	}

	return &KafkaClient{
		writer:        writer,
		brokers:       brokers,
		consumerGroup: consumerGroup,
	}, nil
}

func (k *KafkaClient) PublishEvent(ctx context.Context, topic string, event *DocumentEvent) error {
	if event.EventID == "" {
		event.EventID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Topic: topic,
		Key:   []byte(event.DocumentID),
		Value: data,
	})
}

func (k *KafkaClient) PublishDocumentUploaded(ctx context.Context, docID, docType, fileName string, fileSize int64, uploadedBy string) error {
	return k.PublishEvent(ctx, TopicDocumentUploaded, &DocumentEvent{
		EventType:    "DOCUMENT_UPLOADED",
		DocumentID:   docID,
		DocumentType: docType,
		FileName:     fileName,
		FileSize:     fileSize,
		UploadedBy:   uploadedBy,
	})
}

func (k *KafkaClient) PublishDocumentProcessed(ctx context.Context, docID string, ocrStatus string, confidence float64) error {
	return k.PublishEvent(ctx, TopicDocumentProcessed, &DocumentEvent{
		EventType:     "DOCUMENT_PROCESSED",
		DocumentID:    docID,
		OCRStatus:     ocrStatus,
		OCRConfidence: confidence,
	})
}

func (k *KafkaClient) PublishOCRCompleted(ctx context.Context, docID string, confidence float64, extractedFields map[string]interface{}) error {
	return k.PublishEvent(ctx, TopicOCRCompleted, &DocumentEvent{
		EventType:     "OCR_COMPLETED",
		DocumentID:    docID,
		OCRStatus:     "COMPLETED",
		OCRConfidence: confidence,
		Metadata:      extractedFields,
	})
}

func (k *KafkaClient) PublishOCRFailed(ctx context.Context, docID string, errorMessage string) error {
	return k.PublishEvent(ctx, TopicOCRFailed, &DocumentEvent{
		EventType:  "OCR_FAILED",
		DocumentID: docID,
		OCRStatus:  "FAILED",
		Metadata: map[string]interface{}{
			"error": errorMessage,
		},
	})
}

func (k *KafkaClient) PublishDocumentClassified(ctx context.Context, docID string, classification string, confidence float64) error {
	return k.PublishEvent(ctx, TopicDocumentClassified, &DocumentEvent{
		EventType:    "DOCUMENT_CLASSIFIED",
		DocumentID:   docID,
		DocumentType: classification,
		OCRConfidence: confidence,
	})
}

func (k *KafkaClient) PublishDocumentVersioned(ctx context.Context, docID string, version int, uploadedBy string) error {
	return k.PublishEvent(ctx, TopicDocumentVersioned, &DocumentEvent{
		EventType:  "DOCUMENT_VERSIONED",
		DocumentID: docID,
		Version:    version,
		UploadedBy: uploadedBy,
	})
}

func (k *KafkaClient) Subscribe(ctx context.Context, topic string, handler func(*DocumentEvent) error) error {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  k.brokers,
		Topic:    topic,
		GroupID:  k.consumerGroup,
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})
	defer reader.Close()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			msg, err := reader.ReadMessage(ctx)
			if err != nil {
				continue
			}

			var event DocumentEvent
			if err := json.Unmarshal(msg.Value, &event); err != nil {
				continue
			}

			if err := handler(&event); err != nil {
				continue
			}
		}
	}
}

func (k *KafkaClient) Close() error {
	return k.writer.Close()
}

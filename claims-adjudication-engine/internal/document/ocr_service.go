package document

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type OCRResult struct {
	DocumentID   string            `json:"document_id"`
	Text         string            `json:"extracted_text"`
	Confidence   float64           `json:"confidence"`
	Fields       map[string]string `json:"extracted_fields"`
	DocumentType string            `json:"document_type"`
	ProcessedAt  time.Time         `json:"processed_at"`
}

type OCRService struct {
	provider string
}

func NewOCRService(provider string) *OCRService {
	if provider == "" { provider = "internal" }
	return &OCRService{provider: provider}
}

func (s *OCRService) ExtractText(ctx context.Context, documentID string, content []byte) (*OCRResult, error) {
	if len(content) == 0 {
		return nil, fmt.Errorf("empty document content")
	}

	result := &OCRResult{
		DocumentID:  documentID,
		Confidence:  0.85,
		Fields:      make(map[string]string),
		ProcessedAt: time.Now(),
	}

	text := string(content)
	result.Text = text
	result.DocumentType = s.classifyDocument(text)
	result.Fields = s.extractFields(text, result.DocumentType)

	return result, nil
}

func (s *OCRService) classifyDocument(text string) string {
	lower := strings.ToLower(text)
	switch {
	case strings.Contains(lower, "medical") || strings.Contains(lower, "diagnosis") || strings.Contains(lower, "hospital"):
		return "medical_report"
	case strings.Contains(lower, "police") || strings.Contains(lower, "incident"):
		return "police_report"
	case strings.Contains(lower, "invoice") || strings.Contains(lower, "receipt") || strings.Contains(lower, "amount due"):
		return "invoice"
	case strings.Contains(lower, "death") || strings.Contains(lower, "certificate"):
		return "death_certificate"
	case strings.Contains(lower, "repair") || strings.Contains(lower, "damage"):
		return "damage_assessment"
	default:
		return "general_document"
	}
}

func (s *OCRService) extractFields(text string, docType string) map[string]string {
	fields := make(map[string]string)
	lines := strings.Split(text, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if idx := strings.Index(line, ":"); idx > 0 {
			key := strings.TrimSpace(line[:idx])
			val := strings.TrimSpace(line[idx+1:])
			if key != "" && val != "" {
				fields[strings.ToLower(strings.ReplaceAll(key, " ", "_"))] = val
			}
		}
	}

	fields["document_type"] = docType
	return fields
}

func (s *OCRService) ValidateDocument(ctx context.Context, result *OCRResult, requiredFields []string) (bool, []string) {
	var missing []string
	for _, field := range requiredFields {
		if _, ok := result.Fields[field]; !ok {
			missing = append(missing, field)
		}
	}
	return len(missing) == 0, missing
}

package workflows

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"

	"go.temporal.io/sdk/activity"
)

// DocumentProcessingActivity handles document analysis in the underwriting workflow
type DocumentProcessingActivity struct {
	PythonAgentPath string
}

// DocumentInput represents a document to be analyzed
type DocumentInput struct {
	Path string `json:"path"`
	Type string `json:"type"`
}

// DocumentAnalysisRequest represents the request for document analysis
type DocumentAnalysisRequest struct {
	ApplicationID string          `json:"application_id"`
	Documents     []DocumentInput `json:"documents"`
}

// DocumentAnalysisResult represents the result of document analysis
type DocumentAnalysisResult struct {
	Success            bool                     `json:"success"`
	AnalysisTimestamp  string                   `json:"analysis_timestamp"`
	TotalDocuments     int                      `json:"total_documents"`
	DocumentAnalyses   []map[string]interface{} `json:"document_analyses"`
	OverallAssessment  map[string]interface{}   `json:"overall_assessment"`
	RedFlags           []string                 `json:"red_flags"`
	Recommendation     string                   `json:"recommendation"`
	AuthenticityScore  float64                  `json:"authenticity_score"`
	ErrorMessage       string                   `json:"error_message,omitempty"`
}

// ProcessDocuments analyzes all documents for an underwriting application
func (a *DocumentProcessingActivity) ProcessDocuments(ctx context.Context, req DocumentAnalysisRequest) (*DocumentAnalysisResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Starting document processing", "application_id", req.ApplicationID, "document_count", len(req.Documents))

	// Convert request to JSON
	requestJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Call Python document analysis agent
	cmd := exec.CommandContext(
		ctx,
		"python3",
		a.PythonAgentPath,
		string(requestJSON),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		logger.Error("Document processing failed", "error", err, "output", string(output))
		return &DocumentAnalysisResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Python agent error: %v, output: %s", err, string(output)),
		}, nil // Return nil error to not fail the workflow, let it handle the failure
	}

	// Parse result
	var result DocumentAnalysisResult
	if err := json.Unmarshal(output, &result); err != nil {
		logger.Error("Failed to parse document analysis result", "error", err, "output", string(output))
		return &DocumentAnalysisResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to parse result: %v", err),
		}, nil
	}

	logger.Info("Document processing completed",
		"success", result.Success,
		"authenticity_score", result.AuthenticityScore,
		"recommendation", result.Recommendation,
	)

	return &result, nil
}

// VerifyDocumentAuthenticity verifies the authenticity of a single document
func (a *DocumentProcessingActivity) VerifyDocumentAuthenticity(ctx context.Context, documentPath string, documentType string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Verifying document authenticity", "path", documentPath, "type", documentType)

	// Call Python VLM service
	cmd := exec.CommandContext(
		ctx,
		"python3",
		"-c",
		fmt.Sprintf(`
import asyncio
import json
from document_processing.vlm.vision_language_service import VisionLanguageService

async def main():
    service = VisionLanguageService()
    result = await service.verify_document_authenticity("%s", "%s")
    print(json.dumps(result))

asyncio.run(main())
`, documentPath, documentType),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("authenticity verification failed: %w, output: %s", err, string(output))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse authenticity result: %w", err)
	}

	return result, nil
}

// ExtractDocumentFields extracts specific fields from a document
func (a *DocumentProcessingActivity) ExtractDocumentFields(ctx context.Context, documentPath string, fields []string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Extracting document fields", "path", documentPath, "fields", fields)

	fieldsJSON, _ := json.Marshal(fields)

	// Call Python VLM service
	cmd := exec.CommandContext(
		ctx,
		"python3",
		"-c",
		fmt.Sprintf(`
import asyncio
import json
from document_processing.vlm.vision_language_service import VisionLanguageService

async def main():
    service = VisionLanguageService()
    result = await service.extract_document_fields("%s", %s)
    print(json.dumps(result))

asyncio.run(main())
`, documentPath, string(fieldsJSON)),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("field extraction failed: %w, output: %s", err, string(output))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse extraction result: %w", err)
	}

	return result, nil
}

// CompareDocumentFaces compares faces in two documents (e.g., ID photo vs selfie)
func (a *DocumentProcessingActivity) CompareDocumentFaces(ctx context.Context, imagePath1 string, imagePath2 string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Comparing document faces", "image1", imagePath1, "image2", imagePath2)

	// Call Python VLM service
	cmd := exec.CommandContext(
		ctx,
		"python3",
		"-c",
		fmt.Sprintf(`
import asyncio
import json
from document_processing.vlm.vision_language_service import VisionLanguageService

async def main():
    service = VisionLanguageService()
    result = await service.compare_documents("%s", "%s", "face_match")
    print(json.dumps(result))

asyncio.run(main())
`, imagePath1, imagePath2),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("face comparison failed: %w, output: %s", err, string(output))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse comparison result: %w", err)
	}

	return result, nil
}

// ParseMedicalDocument parses a medical document and extracts health information
func (a *DocumentProcessingActivity) ParseMedicalDocument(ctx context.Context, documentPath string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Parsing medical document", "path", documentPath)

	// Call Python Docling service
	cmd := exec.CommandContext(
		ctx,
		"python3",
		"-c",
		fmt.Sprintf(`
import asyncio
import json
from document_processing.parsers.docling_service import DoclingService

async def main():
    service = DoclingService()
    result = await service.parse_medical_report("%s")
    print(json.dumps(result))

asyncio.run(main())
`, documentPath),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("medical document parsing failed: %w, output: %s", err, string(output))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse medical document result: %w", err)
	}

	return result, nil
}

// ParseFinancialDocument parses a financial document and extracts financial information
func (a *DocumentProcessingActivity) ParseFinancialDocument(ctx context.Context, documentPath string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Parsing financial document", "path", documentPath)

	// Call Python Docling service
	cmd := exec.CommandContext(
		ctx,
		"python3",
		"-c",
		fmt.Sprintf(`
import asyncio
import json
from document_processing.parsers.docling_service import DoclingService

async def main():
    service = DoclingService()
    result = await service.parse_financial_statement("%s")
    print(json.dumps(result))

asyncio.run(main())
`, documentPath),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("financial document parsing failed: %w, output: %s", err, string(output))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse financial document result: %w", err)
	}

	return result, nil
}

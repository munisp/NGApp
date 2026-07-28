package ocr

import (
	"context"
	"encoding/base64"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type MultiProviderOCR struct {
	providers       []OCRProvider
	fallbackOrder   []string
	consensusMode   bool
	minConfidence   float64
}

type MultiProviderConfig struct {
	PaddleOCREndpoint string
	VLMEndpoint       string
	VLMAPIKey         string
	VLMModel          string
	DoclingEndpoint   string
	FallbackOrder     []string
	ConsensusMode     bool
	MinConfidence     float64
}

type ProviderResult struct {
	Provider string
	Result   *OCRResult
	Error    error
}

func NewMultiProviderOCR(config *MultiProviderConfig) *MultiProviderOCR {
	var providers []OCRProvider

	if config.PaddleOCREndpoint != "" {
		providers = append(providers, NewPaddleOCRProvider(config.PaddleOCREndpoint))
	}

	if config.VLMEndpoint != "" && config.VLMAPIKey != "" {
		providers = append(providers, NewVLMProvider(config.VLMEndpoint, config.VLMAPIKey, config.VLMModel))
	}

	if config.DoclingEndpoint != "" {
		providers = append(providers, NewDoclingProvider(config.DoclingEndpoint))
	}

	fallbackOrder := config.FallbackOrder
	if len(fallbackOrder) == 0 {
		fallbackOrder = []string{"PaddleOCR", "VLM", "Docling"}
	}

	minConfidence := config.MinConfidence
	if minConfidence == 0 {
		minConfidence = 0.7
	}

	return &MultiProviderOCR{
		providers:     providers,
		fallbackOrder: fallbackOrder,
		consensusMode: config.ConsensusMode,
		minConfidence: minConfidence,
	}
}

func (m *MultiProviderOCR) ExtractText(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error) {
	if m.consensusMode && len(m.providers) > 1 {
		return m.extractWithConsensus(ctx, imageData, options)
	}

	return m.extractWithFallback(ctx, imageData, options)
}

func (m *MultiProviderOCR) extractWithFallback(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error) {
	providerMap := make(map[string]OCRProvider)
	for _, p := range m.providers {
		providerMap[p.GetProviderName()] = p
	}

	var lastError error
	for _, providerName := range m.fallbackOrder {
		provider, exists := providerMap[providerName]
		if !exists {
			continue
		}

		if !provider.IsAvailable(ctx) {
			continue
		}

		result, err := provider.ExtractText(ctx, imageData, options)
		if err != nil {
			lastError = err
			continue
		}

		if result.Confidence >= m.minConfidence {
			return result, nil
		}

		lastError = fmt.Errorf("confidence too low: %.2f < %.2f", result.Confidence, m.minConfidence)
	}

	if lastError != nil {
		return nil, fmt.Errorf("all providers failed, last error: %w", lastError)
	}

	return nil, fmt.Errorf("no available OCR providers")
}

func (m *MultiProviderOCR) extractWithConsensus(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error) {
	results := make(chan ProviderResult, len(m.providers))
	var wg sync.WaitGroup

	for _, provider := range m.providers {
		if !provider.IsAvailable(ctx) {
			continue
		}

		wg.Add(1)
		go func(p OCRProvider) {
			defer wg.Done()
			result, err := p.ExtractText(ctx, imageData, options)
			results <- ProviderResult{
				Provider: p.GetProviderName(),
				Result:   result,
				Error:    err,
			}
		}(provider)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var successfulResults []ProviderResult
	for r := range results {
		if r.Error == nil && r.Result != nil {
			successfulResults = append(successfulResults, r)
		}
	}

	if len(successfulResults) == 0 {
		return nil, fmt.Errorf("all providers failed")
	}

	return m.mergeResults(successfulResults), nil
}

func (m *MultiProviderOCR) mergeResults(results []ProviderResult) *OCRResult {
	if len(results) == 1 {
		return results[0].Result
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Result.Confidence > results[j].Result.Confidence
	})

	bestResult := results[0].Result

	var totalConfidence float64
	providers := make([]string, 0, len(results))
	for _, r := range results {
		totalConfidence += r.Result.Confidence
		providers = append(providers, r.Provider)
	}

	mergedResult := &OCRResult{
		Provider:       strings.Join(providers, "+"),
		Text:           bestResult.Text,
		Confidence:     totalConfidence / float64(len(results)),
		Language:       bestResult.Language,
		Pages:          bestResult.Pages,
		Tables:         bestResult.Tables,
		Forms:          bestResult.Forms,
		ProcessingTime: bestResult.ProcessingTime,
		Metadata: map[string]interface{}{
			"consensus_mode":    true,
			"provider_count":    len(results),
			"providers":         providers,
			"individual_scores": getIndividualScores(results),
		},
	}

	return mergedResult
}

func getIndividualScores(results []ProviderResult) map[string]float64 {
	scores := make(map[string]float64)
	for _, r := range results {
		scores[r.Provider] = r.Result.Confidence
	}
	return scores
}

func (m *MultiProviderOCR) ExtractStructuredData(ctx context.Context, imageData []byte, documentType string) (*StructuredData, error) {
	for _, providerName := range m.fallbackOrder {
		for _, provider := range m.providers {
			if provider.GetProviderName() != providerName {
				continue
			}

			if !provider.IsAvailable(ctx) {
				continue
			}

			result, err := provider.ExtractStructuredData(ctx, imageData, documentType)
			if err != nil {
				continue
			}

			if result.Confidence >= m.minConfidence {
				return result, nil
			}
		}
	}

	return nil, fmt.Errorf("failed to extract structured data from all providers")
}

func (m *MultiProviderOCR) ExtractInsuranceDocument(ctx context.Context, imageData []byte, documentType string) (*InsuranceDocumentData, error) {
	ocrResult, err := m.ExtractText(ctx, imageData, &OCROptions{
		DetectLayout:  true,
		ExtractTables: true,
		ExtractForms:  true,
		DocumentType:  documentType,
	})
	if err != nil {
		return nil, err
	}

	structuredData, err := m.ExtractStructuredData(ctx, imageData, documentType)
	if err != nil {
		structuredData = &StructuredData{
			DocumentType:    documentType,
			ExtractedFields: make(map[string]interface{}),
		}
	}

	return &InsuranceDocumentData{
		DocumentType:    documentType,
		RawText:         ocrResult.Text,
		ExtractedFields: structuredData.ExtractedFields,
		Tables:          ocrResult.Tables,
		Forms:           ocrResult.Forms,
		Confidence:      ocrResult.Confidence,
		Provider:        ocrResult.Provider,
		ProcessingTime:  ocrResult.ProcessingTime,
		ValidationResult: validateInsuranceDocument(documentType, structuredData.ExtractedFields),
	}, nil
}

type InsuranceDocumentData struct {
	DocumentType     string                 `json:"document_type"`
	RawText          string                 `json:"raw_text"`
	ExtractedFields  map[string]interface{} `json:"extracted_fields"`
	Tables           []TableResult          `json:"tables,omitempty"`
	Forms            []FormField            `json:"forms,omitempty"`
	Confidence       float64                `json:"confidence"`
	Provider         string                 `json:"provider"`
	ProcessingTime   time.Duration          `json:"processing_time"`
	ValidationResult *ValidationResult      `json:"validation_result"`
}

type ValidationResult struct {
	IsValid          bool     `json:"is_valid"`
	MissingFields    []string `json:"missing_fields,omitempty"`
	InvalidFields    []string `json:"invalid_fields,omitempty"`
	Warnings         []string `json:"warnings,omitempty"`
	ComplianceStatus string   `json:"compliance_status"`
}

func validateInsuranceDocument(documentType string, fields map[string]interface{}) *ValidationResult {
	result := &ValidationResult{
		IsValid:          true,
		ComplianceStatus: "COMPLIANT",
	}

	requiredFields := getRequiredFields(documentType)
	for _, field := range requiredFields {
		if _, exists := fields[field]; !exists {
			result.MissingFields = append(result.MissingFields, field)
			result.IsValid = false
		}
	}

	for fieldName, fieldValue := range fields {
		if !validateFieldFormat(fieldName, fieldValue) {
			result.InvalidFields = append(result.InvalidFields, fieldName)
		}
	}

	if len(result.MissingFields) > 0 || len(result.InvalidFields) > 0 {
		result.ComplianceStatus = "NON_COMPLIANT"
	}

	return result
}

func getRequiredFields(documentType string) []string {
	switch documentType {
	case "insurance_policy":
		return []string{"policy_number", "insured_name", "effective_date", "expiry_date", "premium_amount"}
	case "claim_form":
		return []string{"claim_number", "policy_number", "claimant_name", "incident_date", "claim_amount"}
	case "bank_statement":
		return []string{"account_number", "statement_date", "opening_balance", "closing_balance"}
	case "id_document":
		return []string{"document_number", "full_name", "date_of_birth"}
	default:
		return []string{}
	}
}

func validateFieldFormat(fieldName string, fieldValue interface{}) bool {
	strValue, ok := fieldValue.(string)
	if !ok {
		return true
	}

	switch fieldName {
	case "policy_number", "claim_number":
		matched, _ := regexp.MatchString(`^[A-Z]{2,4}-\d{4,}-\d{3,}$`, strValue)
		return matched || len(strValue) > 5

	case "account_number":
		matched, _ := regexp.MatchString(`^\d{10,}$`, strValue)
		return matched

	case "email":
		matched, _ := regexp.MatchString(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`, strValue)
		return matched

	case "phone":
		matched, _ := regexp.MatchString(`^\+?[\d\s-]{10,}$`, strValue)
		return matched

	default:
		return true
	}
}

func (m *MultiProviderOCR) GetAvailableProviders(ctx context.Context) []string {
	var available []string
	for _, p := range m.providers {
		if p.IsAvailable(ctx) {
			available = append(available, p.GetProviderName())
		}
	}
	return available
}

func (m *MultiProviderOCR) GetProviderStatus(ctx context.Context) map[string]bool {
	status := make(map[string]bool)
	for _, p := range m.providers {
		status[p.GetProviderName()] = p.IsAvailable(ctx)
	}
	return status
}

func encodeBase64Impl(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

func init() {
	_ = encodeBase64Impl
}

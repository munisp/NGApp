package ocr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

type OCRProvider interface {
	ExtractText(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error)
	ExtractStructuredData(ctx context.Context, imageData []byte, documentType string) (*StructuredData, error)
	GetProviderName() string
	IsAvailable(ctx context.Context) bool
}

type OCROptions struct {
	Language        string   `json:"language"`
	DetectLayout    bool     `json:"detect_layout"`
	ExtractTables   bool     `json:"extract_tables"`
	ExtractForms    bool     `json:"extract_forms"`
	ConfidenceThreshold float64 `json:"confidence_threshold"`
	DocumentType    string   `json:"document_type"`
	EnabledProviders []string `json:"enabled_providers"`
}

type OCRResult struct {
	Provider       string           `json:"provider"`
	Text           string           `json:"text"`
	Confidence     float64          `json:"confidence"`
	Language       string           `json:"language"`
	Pages          []PageResult     `json:"pages"`
	Tables         []TableResult    `json:"tables,omitempty"`
	Forms          []FormField      `json:"forms,omitempty"`
	ProcessingTime time.Duration    `json:"processing_time"`
	Metadata       map[string]interface{} `json:"metadata"`
}

type PageResult struct {
	PageNumber int           `json:"page_number"`
	Text       string        `json:"text"`
	Confidence float64       `json:"confidence"`
	Width      int           `json:"width"`
	Height     int           `json:"height"`
	Blocks     []TextBlock   `json:"blocks"`
}

type TextBlock struct {
	Text       string    `json:"text"`
	Confidence float64   `json:"confidence"`
	BoundingBox BoundingBox `json:"bounding_box"`
	BlockType  string    `json:"block_type"`
}

type BoundingBox struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type TableResult struct {
	PageNumber int        `json:"page_number"`
	Rows       [][]string `json:"rows"`
	Headers    []string   `json:"headers"`
	Confidence float64    `json:"confidence"`
}

type FormField struct {
	FieldName  string  `json:"field_name"`
	FieldValue string  `json:"field_value"`
	Confidence float64 `json:"confidence"`
	FieldType  string  `json:"field_type"`
}

type StructuredData struct {
	DocumentType    string                 `json:"document_type"`
	ExtractedFields map[string]interface{} `json:"extracted_fields"`
	Confidence      float64                `json:"confidence"`
	ValidationErrors []string              `json:"validation_errors,omitempty"`
}

type PaddleOCRProvider struct {
	endpoint   string
	httpClient *http.Client
}

func NewPaddleOCRProvider(endpoint string) *PaddleOCRProvider {
	return &PaddleOCRProvider{
		endpoint: endpoint,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (p *PaddleOCRProvider) GetProviderName() string {
	return "PaddleOCR"
}

func (p *PaddleOCRProvider) IsAvailable(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, "GET", p.endpoint+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (p *PaddleOCRProvider) ExtractText(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error) {
	startTime := time.Now()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("image", "document.png")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := part.Write(imageData); err != nil {
		return nil, fmt.Errorf("failed to write image data: %w", err)
	}

	if options != nil {
		writer.WriteField("language", options.Language)
		writer.WriteField("detect_layout", fmt.Sprintf("%v", options.DetectLayout))
		writer.WriteField("extract_tables", fmt.Sprintf("%v", options.ExtractTables))
	}

	writer.Close()

	req, err := http.NewRequestWithContext(ctx, "POST", p.endpoint+"/ocr", &body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OCR request failed: %s", string(respBody))
	}

	var paddleResult struct {
		Text       string  `json:"text"`
		Confidence float64 `json:"confidence"`
		Boxes      []struct {
			Text       string    `json:"text"`
			Confidence float64   `json:"confidence"`
			Box        [][]int   `json:"box"`
		} `json:"boxes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&paddleResult); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	result := &OCRResult{
		Provider:       "PaddleOCR",
		Text:           paddleResult.Text,
		Confidence:     paddleResult.Confidence,
		Language:       options.Language,
		ProcessingTime: time.Since(startTime),
		Metadata:       make(map[string]interface{}),
	}

	var blocks []TextBlock
	for _, box := range paddleResult.Boxes {
		block := TextBlock{
			Text:       box.Text,
			Confidence: box.Confidence,
			BlockType:  "text",
		}
		if len(box.Box) >= 2 {
			block.BoundingBox = BoundingBox{
				X:      box.Box[0][0],
				Y:      box.Box[0][1],
				Width:  box.Box[1][0] - box.Box[0][0],
				Height: box.Box[2][1] - box.Box[0][1],
			}
		}
		blocks = append(blocks, block)
	}

	result.Pages = []PageResult{
		{
			PageNumber: 1,
			Text:       paddleResult.Text,
			Confidence: paddleResult.Confidence,
			Blocks:     blocks,
		},
	}

	return result, nil
}

func (p *PaddleOCRProvider) ExtractStructuredData(ctx context.Context, imageData []byte, documentType string) (*StructuredData, error) {
	ocrResult, err := p.ExtractText(ctx, imageData, &OCROptions{
		Language:     "en",
		DetectLayout: true,
		ExtractForms: true,
	})
	if err != nil {
		return nil, err
	}

	return extractStructuredDataFromText(ocrResult.Text, documentType)
}

type VLMProvider struct {
	endpoint   string
	apiKey     string
	modelName  string
	httpClient *http.Client
}

func NewVLMProvider(endpoint, apiKey, modelName string) *VLMProvider {
	return &VLMProvider{
		endpoint:  endpoint,
		apiKey:    apiKey,
		modelName: modelName,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (v *VLMProvider) GetProviderName() string {
	return "VLM"
}

func (v *VLMProvider) IsAvailable(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, "GET", v.endpoint+"/health", nil)
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+v.apiKey)
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (v *VLMProvider) ExtractText(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error) {
	startTime := time.Now()

	prompt := "Extract all text from this document image. Preserve the layout and structure as much as possible."
	if options != nil && options.DocumentType != "" {
		prompt = fmt.Sprintf("Extract all text from this %s document. Identify and extract key fields specific to this document type.", options.DocumentType)
	}

	requestBody := map[string]interface{}{
		"model": v.modelName,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type":       "image_url",
						"image_url": map[string]string{
							"url": fmt.Sprintf("data:image/png;base64,%s", encodeBase64(imageData)),
						},
					},
				},
			},
		},
		"max_tokens": 4096,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", v.endpoint+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+v.apiKey)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("VLM request failed: %s", string(respBody))
	}

	var vlmResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vlmResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	extractedText := ""
	if len(vlmResponse.Choices) > 0 {
		extractedText = vlmResponse.Choices[0].Message.Content
	}

	return &OCRResult{
		Provider:       "VLM",
		Text:           extractedText,
		Confidence:     0.95,
		Language:       "en",
		ProcessingTime: time.Since(startTime),
		Pages: []PageResult{
			{
				PageNumber: 1,
				Text:       extractedText,
				Confidence: 0.95,
			},
		},
		Metadata: map[string]interface{}{
			"model": v.modelName,
		},
	}, nil
}

func (v *VLMProvider) ExtractStructuredData(ctx context.Context, imageData []byte, documentType string) (*StructuredData, error) {
	prompt := fmt.Sprintf(`Analyze this %s document and extract the following information in JSON format:
- All key fields and their values
- Document number/reference
- Dates
- Names
- Amounts
- Any other relevant structured data

Return ONLY valid JSON with the extracted fields.`, documentType)

	requestBody := map[string]interface{}{
		"model": v.modelName,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type":       "image_url",
						"image_url": map[string]string{
							"url": fmt.Sprintf("data:image/png;base64,%s", encodeBase64(imageData)),
						},
					},
				},
			},
		},
		"max_tokens": 4096,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", v.endpoint+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+v.apiKey)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var vlmResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vlmResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	extractedFields := make(map[string]interface{})
	if len(vlmResponse.Choices) > 0 {
		content := vlmResponse.Choices[0].Message.Content
		json.Unmarshal([]byte(content), &extractedFields)
	}

	return &StructuredData{
		DocumentType:    documentType,
		ExtractedFields: extractedFields,
		Confidence:      0.90,
	}, nil
}

type DoclingProvider struct {
	endpoint   string
	httpClient *http.Client
}

func NewDoclingProvider(endpoint string) *DoclingProvider {
	return &DoclingProvider{
		endpoint: endpoint,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (d *DoclingProvider) GetProviderName() string {
	return "Docling"
}

func (d *DoclingProvider) IsAvailable(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, "GET", d.endpoint+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := d.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (d *DoclingProvider) ExtractText(ctx context.Context, imageData []byte, options *OCROptions) (*OCRResult, error) {
	startTime := time.Now()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", "document.pdf")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := part.Write(imageData); err != nil {
		return nil, fmt.Errorf("failed to write document data: %w", err)
	}

	if options != nil {
		writer.WriteField("extract_tables", fmt.Sprintf("%v", options.ExtractTables))
		writer.WriteField("extract_images", "false")
		writer.WriteField("output_format", "json")
	}

	writer.Close()

	req, err := http.NewRequestWithContext(ctx, "POST", d.endpoint+"/convert", &body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Docling request failed: %s", string(respBody))
	}

	var doclingResult struct {
		Document struct {
			Text   string `json:"text"`
			Pages  []struct {
				PageNumber int    `json:"page_number"`
				Text       string `json:"text"`
				Tables     []struct {
					Rows [][]string `json:"rows"`
				} `json:"tables"`
			} `json:"pages"`
		} `json:"document"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&doclingResult); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	result := &OCRResult{
		Provider:       "Docling",
		Text:           doclingResult.Document.Text,
		Confidence:     0.92,
		Language:       "en",
		ProcessingTime: time.Since(startTime),
		Metadata:       make(map[string]interface{}),
	}

	for _, page := range doclingResult.Document.Pages {
		pageResult := PageResult{
			PageNumber: page.PageNumber,
			Text:       page.Text,
			Confidence: 0.92,
		}
		result.Pages = append(result.Pages, pageResult)

		for _, table := range page.Tables {
			tableResult := TableResult{
				PageNumber: page.PageNumber,
				Rows:       table.Rows,
				Confidence: 0.90,
			}
			if len(table.Rows) > 0 {
				tableResult.Headers = table.Rows[0]
			}
			result.Tables = append(result.Tables, tableResult)
		}
	}

	return result, nil
}

func (d *DoclingProvider) ExtractStructuredData(ctx context.Context, imageData []byte, documentType string) (*StructuredData, error) {
	ocrResult, err := d.ExtractText(ctx, imageData, &OCROptions{
		ExtractTables: true,
		ExtractForms:  true,
	})
	if err != nil {
		return nil, err
	}

	return extractStructuredDataFromText(ocrResult.Text, documentType)
}

func extractStructuredDataFromText(text string, documentType string) (*StructuredData, error) {
	extractedFields := make(map[string]interface{})

	switch documentType {
	case "insurance_policy":
		extractedFields["policy_number"] = extractField(text, "Policy Number", "Policy No")
		extractedFields["insured_name"] = extractField(text, "Insured Name", "Policyholder")
		extractedFields["effective_date"] = extractField(text, "Effective Date", "Start Date")
		extractedFields["expiry_date"] = extractField(text, "Expiry Date", "End Date")
		extractedFields["premium_amount"] = extractField(text, "Premium", "Total Premium")
		extractedFields["sum_insured"] = extractField(text, "Sum Insured", "Coverage Amount")

	case "claim_form":
		extractedFields["claim_number"] = extractField(text, "Claim Number", "Claim No")
		extractedFields["policy_number"] = extractField(text, "Policy Number", "Policy No")
		extractedFields["claimant_name"] = extractField(text, "Claimant Name", "Name")
		extractedFields["incident_date"] = extractField(text, "Date of Incident", "Incident Date")
		extractedFields["claim_amount"] = extractField(text, "Claim Amount", "Amount Claimed")
		extractedFields["description"] = extractField(text, "Description", "Details")

	case "bank_statement":
		extractedFields["account_number"] = extractField(text, "Account Number", "Account No")
		extractedFields["account_holder"] = extractField(text, "Account Holder", "Account Name")
		extractedFields["statement_date"] = extractField(text, "Statement Date", "Date")
		extractedFields["opening_balance"] = extractField(text, "Opening Balance", "Previous Balance")
		extractedFields["closing_balance"] = extractField(text, "Closing Balance", "Current Balance")

	case "id_document":
		extractedFields["document_number"] = extractField(text, "ID Number", "Document Number")
		extractedFields["full_name"] = extractField(text, "Name", "Full Name")
		extractedFields["date_of_birth"] = extractField(text, "Date of Birth", "DOB")
		extractedFields["expiry_date"] = extractField(text, "Expiry Date", "Valid Until")
		extractedFields["address"] = extractField(text, "Address", "Residential Address")

	default:
		extractedFields["raw_text"] = text
	}

	return &StructuredData{
		DocumentType:    documentType,
		ExtractedFields: extractedFields,
		Confidence:      0.85,
	}, nil
}

func extractField(text string, fieldNames ...string) string {
	return ""
}

func encodeBase64(data []byte) string {
	return ""
}

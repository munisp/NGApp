package kyc

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

type DocumentType string

const (
	DocumentTypePassport       DocumentType = "passport"
	DocumentTypeNationalID     DocumentType = "national_id"
	DocumentTypeDriversLicense DocumentType = "drivers_license"
	DocumentTypeBankStatement  DocumentType = "bank_statement"
	DocumentTypeUtilityBill    DocumentType = "utility_bill"
	DocumentTypeProofOfAddress DocumentType = "proof_of_address"
)

type OCRProvider string

const (
	OCRProviderDeepSeek OCRProvider = "deepseek"
	OCRProviderLocal    OCRProvider = "local"
)

type ExtractedField struct {
	FieldName   string       `json:"fieldName"`
	Value       string       `json:"value"`
	Confidence  float64      `json:"confidence"`
	BoundingBox *BoundingBox `json:"boundingBox,omitempty"`
}

type BoundingBox struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type DocumentOCRResult struct {
	DocumentID      string           `json:"documentId"`
	DocumentType    DocumentType     `json:"documentType"`
	RawText         string           `json:"rawText"`
	ExtractedFields []ExtractedField `json:"extractedFields"`
	StructuredData  *DocumentData    `json:"structuredData,omitempty"`
	Confidence      float64          `json:"confidence"`
	ProcessingTime  int64            `json:"processingTimeMs"`
	Provider        OCRProvider      `json:"provider"`
	Warnings        []string         `json:"warnings,omitempty"`
	CreatedAt       time.Time        `json:"createdAt"`
}

type DocumentData struct {
	FirstName        string `json:"firstName,omitempty"`
	LastName         string `json:"lastName,omitempty"`
	FullName         string `json:"fullName,omitempty"`
	DateOfBirth      string `json:"dateOfBirth,omitempty"`
	Gender           string `json:"gender,omitempty"`
	Nationality      string `json:"nationality,omitempty"`
	DocumentNumber   string `json:"documentNumber,omitempty"`
	ExpiryDate       string `json:"expiryDate,omitempty"`
	IssueDate        string `json:"issueDate,omitempty"`
	IssuingCountry   string `json:"issuingCountry,omitempty"`
	IssuingAuthority string `json:"issuingAuthority,omitempty"`
	Address          string `json:"address,omitempty"`
	MRZLine1         string `json:"mrzLine1,omitempty"`
	MRZLine2         string `json:"mrzLine2,omitempty"`
	BVN              string `json:"bvn,omitempty"`
	NIN              string `json:"nin,omitempty"`
	PhoneNumber      string `json:"phoneNumber,omitempty"`
}

type DeepSeekOCRResponse struct {
	Text       string                 `json:"text"`
	Confidence float64                `json:"confidence,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type OCRConfig struct {
	Provider      OCRProvider `json:"provider"`
	APIKey        string      `json:"-"`
	APIURL        string      `json:"apiUrl"`
	Timeout       int         `json:"timeout"`
	MaxRetries    int         `json:"maxRetries"`
	Language      string      `json:"language"`
	EnableMRZ     bool        `json:"enableMrz"`
	EnableBarcode bool        `json:"enableBarcode"`
}

type OCRService struct {
	mu         sync.RWMutex
	config     OCRConfig
	httpClient *http.Client
	cache      map[string]*DocumentOCRResult
}

func NewOCRService(config *OCRConfig) *OCRService {
	if config == nil {
		config = &OCRConfig{
			Provider:      OCRProviderDeepSeek,
			APIKey:        os.Getenv("DEEPSEEK_OCR_API_KEY"),
			APIURL:        "https://api.deepseek.com",
			Timeout:       60,
			MaxRetries:    3,
			Language:      "en",
			EnableMRZ:     true,
			EnableBarcode: true,
		}
	}

	if config.APIURL == "" {
		config.APIURL = "https://api.deepseek.com"
	}
	if config.APIKey == "" {
		config.APIKey = os.Getenv("DEEPSEEK_OCR_API_KEY")
	}

	return &OCRService{
		config: *config,
		httpClient: &http.Client{
			Timeout: time.Duration(config.Timeout) * time.Second,
		},
		cache: make(map[string]*DocumentOCRResult),
	}
}

func (s *OCRService) ExtractDocument(imageData []byte, documentType DocumentType, filename string) (*DocumentOCRResult, error) {
	startTime := time.Now()
	documentID := generateRandomHex(16)

	var rawText string
	var err error

	if s.config.Provider == OCRProviderDeepSeek {
		rawText, err = s.callDeepSeekOCR(imageData, documentType, filename)
	} else {
		rawText, err = s.performLocalOCR(imageData)
	}

	if err != nil {
		return nil, fmt.Errorf("OCR extraction failed: %w", err)
	}

	extractedFields := s.extractFieldsFromText(rawText, documentType)
	structuredData := s.parseStructuredData(extractedFields, documentType)
	confidence := s.calculateConfidence(extractedFields)
	warnings := s.validateExtractedData(structuredData, documentType)

	result := &DocumentOCRResult{
		DocumentID:      documentID,
		DocumentType:    documentType,
		RawText:         rawText,
		ExtractedFields: extractedFields,
		StructuredData:  structuredData,
		Confidence:      confidence,
		ProcessingTime:  time.Since(startTime).Milliseconds(),
		Provider:        s.config.Provider,
		Warnings:        warnings,
		CreatedAt:       time.Now(),
	}

	s.mu.Lock()
	s.cache[documentID] = result
	s.mu.Unlock()

	return result, nil
}

func (s *OCRService) ExtractDocumentFromBase64(base64Data string, documentType DocumentType, filename string) (*DocumentOCRResult, error) {
	base64Data = strings.TrimPrefix(base64Data, "data:image/jpeg;base64,")
	base64Data = strings.TrimPrefix(base64Data, "data:image/png;base64,")
	base64Data = strings.TrimPrefix(base64Data, "data:application/pdf;base64,")

	imageData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 image: %w", err)
	}

	return s.ExtractDocument(imageData, documentType, filename)
}

func (s *OCRService) callDeepSeekOCR(imageData []byte, documentType DocumentType, filename string) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := part.Write(imageData); err != nil {
		return "", fmt.Errorf("failed to write image data: %w", err)
	}

	prompt := s.getExtractionPrompt(documentType)
	if err := writer.WriteField("prompt", prompt); err != nil {
		return "", fmt.Errorf("failed to write prompt field: %w", err)
	}

	if err := writer.WriteField("language", s.config.Language); err != nil {
		return "", fmt.Errorf("failed to write language field: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequest("POST", s.config.APIURL+"/v1/ocr", &body)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+s.config.APIKey)
	req.Header.Set("Accept", "application/json")

	var lastErr error
	for attempt := 0; attempt < s.config.MaxRetries; attempt++ {
		resp, err := s.httpClient.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(attempt+1) * time.Second)
			continue
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %w", err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("DeepSeek OCR API error (status %d): %s", resp.StatusCode, string(respBody))
			if resp.StatusCode >= 500 {
				time.Sleep(time.Duration(attempt+1) * time.Second)
				continue
			}
			return "", lastErr
		}

		var ocrResponse DeepSeekOCRResponse
		if err := json.Unmarshal(respBody, &ocrResponse); err != nil {
			return "", fmt.Errorf("failed to parse OCR response: %w", err)
		}

		return ocrResponse.Text, nil
	}

	return "", fmt.Errorf("OCR failed after %d attempts: %w", s.config.MaxRetries, lastErr)
}

func (s *OCRService) performLocalOCR(imageData []byte) (string, error) {
	return "", fmt.Errorf("local OCR not implemented - use DeepSeek provider")
}

func (s *OCRService) getExtractionPrompt(documentType DocumentType) string {
	prompts := map[DocumentType]string{
		DocumentTypePassport: `Extract all text from this passport image. Focus on:
- Full name (first name, last name)
- Date of birth (format: YYYY-MM-DD)
- Passport number
- Nationality
- Gender
- Issue date and expiry date
- Issuing country/authority
- MRZ lines (if visible)
Return the extracted information in a structured format.`,

		DocumentTypeNationalID: `Extract all text from this national ID card. Focus on:
- Full name
- Date of birth
- ID number (NIN/BVN)
- Gender
- Address
- Issue date and expiry date
Return the extracted information in a structured format.`,

		DocumentTypeDriversLicense: `Extract all text from this driver's license. Focus on:
- Full name
- Date of birth
- License number
- Address
- Issue date and expiry date
- License class/category
Return the extracted information in a structured format.`,

		DocumentTypeBankStatement: `Extract all text from this bank statement. Focus on:
- Account holder name
- Account number
- Bank name
- Statement period
- Address
Return the extracted information in a structured format.`,

		DocumentTypeUtilityBill: `Extract all text from this utility bill. Focus on:
- Account holder name
- Service address
- Bill date
- Account number
Return the extracted information in a structured format.`,

		DocumentTypeProofOfAddress: `Extract all text from this proof of address document. Focus on:
- Full name
- Complete address
- Date on document
Return the extracted information in a structured format.`,
	}

	if prompt, ok := prompts[documentType]; ok {
		return prompt
	}
	return "Extract all text from this document. Return the extracted information in a structured format."
}

func (s *OCRService) extractFieldsFromText(rawText string, documentType DocumentType) []ExtractedField {
	var fields []ExtractedField

	patterns := map[string]*regexp.Regexp{
		"firstName":      regexp.MustCompile(`(?i)(?:first\s*name|given\s*name|prenom)[:\s]*([A-Za-z\s]+)`),
		"lastName":       regexp.MustCompile(`(?i)(?:last\s*name|surname|family\s*name|nom)[:\s]*([A-Za-z\s]+)`),
		"fullName":       regexp.MustCompile(`(?i)(?:full\s*name|name)[:\s]*([A-Za-z\s]+)`),
		"dateOfBirth":    regexp.MustCompile(`(?i)(?:date\s*of\s*birth|dob|birth\s*date|d\.o\.b)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})`),
		"gender":         regexp.MustCompile(`(?i)(?:gender|sex)[:\s]*(male|female|m|f)`),
		"nationality":    regexp.MustCompile(`(?i)(?:nationality|citizenship)[:\s]*([A-Za-z\s]+)`),
		"documentNumber": regexp.MustCompile(`(?i)(?:passport\s*no|document\s*no|id\s*no|license\s*no|number)[:\s]*([A-Z0-9]+)`),
		"expiryDate":     regexp.MustCompile(`(?i)(?:expiry|expiration|valid\s*until|exp)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})`),
		"issueDate":      regexp.MustCompile(`(?i)(?:issue\s*date|date\s*of\s*issue|issued)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})`),
		"address":        regexp.MustCompile(`(?i)(?:address|residence)[:\s]*([A-Za-z0-9\s,.-]+)`),
		"bvn":            regexp.MustCompile(`(?i)(?:bvn|bank\s*verification)[:\s]*(\d{11})`),
		"nin":            regexp.MustCompile(`(?i)(?:nin|national\s*id)[:\s]*(\d{11})`),
		"phoneNumber":    regexp.MustCompile(`(?i)(?:phone|mobile|tel)[:\s]*(\+?\d{10,14})`),
	}

	mrzPattern := regexp.MustCompile(`([A-Z<]{44})\s*([A-Z0-9<]{44})`)
	if matches := mrzPattern.FindStringSubmatch(rawText); len(matches) >= 3 {
		fields = append(fields, ExtractedField{
			FieldName:  "mrzLine1",
			Value:      matches[1],
			Confidence: 0.95,
		})
		fields = append(fields, ExtractedField{
			FieldName:  "mrzLine2",
			Value:      matches[2],
			Confidence: 0.95,
		})
	}

	for fieldName, pattern := range patterns {
		if matches := pattern.FindStringSubmatch(rawText); len(matches) >= 2 {
			value := strings.TrimSpace(matches[1])
			if value != "" {
				fields = append(fields, ExtractedField{
					FieldName:  fieldName,
					Value:      value,
					Confidence: 0.85,
				})
			}
		}
	}

	return fields
}

func (s *OCRService) parseStructuredData(fields []ExtractedField, documentType DocumentType) *DocumentData {
	data := &DocumentData{}

	for _, field := range fields {
		switch field.FieldName {
		case "firstName":
			data.FirstName = field.Value
		case "lastName":
			data.LastName = field.Value
		case "fullName":
			data.FullName = field.Value
		case "dateOfBirth":
			data.DateOfBirth = s.normalizeDate(field.Value)
		case "gender":
			data.Gender = s.normalizeGender(field.Value)
		case "nationality":
			data.Nationality = field.Value
		case "documentNumber":
			data.DocumentNumber = field.Value
		case "expiryDate":
			data.ExpiryDate = s.normalizeDate(field.Value)
		case "issueDate":
			data.IssueDate = s.normalizeDate(field.Value)
		case "address":
			data.Address = field.Value
		case "bvn":
			data.BVN = field.Value
		case "nin":
			data.NIN = field.Value
		case "phoneNumber":
			data.PhoneNumber = field.Value
		case "mrzLine1":
			data.MRZLine1 = field.Value
		case "mrzLine2":
			data.MRZLine2 = field.Value
		}
	}

	if data.FullName == "" && data.FirstName != "" && data.LastName != "" {
		data.FullName = data.FirstName + " " + data.LastName
	}

	if data.MRZLine1 != "" && data.MRZLine2 != "" {
		s.parseMRZ(data)
	}

	return data
}

func (s *OCRService) parseMRZ(data *DocumentData) {
	if len(data.MRZLine1) >= 44 {
		docType := data.MRZLine1[0:1]
		if docType == "P" {
			issuingCountry := strings.ReplaceAll(data.MRZLine1[2:5], "<", "")
			data.IssuingCountry = issuingCountry

			namePart := data.MRZLine1[5:44]
			nameParts := strings.Split(namePart, "<<")
			if len(nameParts) >= 2 {
				data.LastName = strings.ReplaceAll(nameParts[0], "<", " ")
				data.FirstName = strings.ReplaceAll(nameParts[1], "<", " ")
				data.LastName = strings.TrimSpace(data.LastName)
				data.FirstName = strings.TrimSpace(data.FirstName)
			}
		}
	}

	if len(data.MRZLine2) >= 44 {
		data.DocumentNumber = strings.ReplaceAll(data.MRZLine2[0:9], "<", "")
		data.Nationality = strings.ReplaceAll(data.MRZLine2[10:13], "<", "")

		dobRaw := data.MRZLine2[13:19]
		if len(dobRaw) == 6 {
			year := dobRaw[0:2]
			month := dobRaw[2:4]
			day := dobRaw[4:6]
			yearInt := 0
			fmt.Sscanf(year, "%d", &yearInt)
			if yearInt > 30 {
				data.DateOfBirth = fmt.Sprintf("19%s-%s-%s", year, month, day)
			} else {
				data.DateOfBirth = fmt.Sprintf("20%s-%s-%s", year, month, day)
			}
		}

		genderChar := data.MRZLine2[20:21]
		if genderChar == "M" {
			data.Gender = "Male"
		} else if genderChar == "F" {
			data.Gender = "Female"
		}

		expRaw := data.MRZLine2[21:27]
		if len(expRaw) == 6 {
			year := expRaw[0:2]
			month := expRaw[2:4]
			day := expRaw[4:6]
			data.ExpiryDate = fmt.Sprintf("20%s-%s-%s", year, month, day)
		}
	}
}

func (s *OCRService) normalizeDate(dateStr string) string {
	dateStr = strings.TrimSpace(dateStr)

	patterns := []struct {
		pattern *regexp.Regexp
		format  string
	}{
		{regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})$`), ""},
		{regexp.MustCompile(`^(\d{2})/(\d{2})/(\d{4})$`), "dd/mm/yyyy"},
		{regexp.MustCompile(`^(\d{2})-(\d{2})-(\d{4})$`), "dd-mm-yyyy"},
		{regexp.MustCompile(`^(\d{2})/(\d{2})/(\d{2})$`), "dd/mm/yy"},
	}

	for _, p := range patterns {
		if matches := p.pattern.FindStringSubmatch(dateStr); len(matches) >= 4 {
			switch p.format {
			case "dd/mm/yyyy", "dd-mm-yyyy":
				return fmt.Sprintf("%s-%s-%s", matches[3], matches[2], matches[1])
			case "dd/mm/yy":
				year := matches[3]
				yearInt := 0
				fmt.Sscanf(year, "%d", &yearInt)
				if yearInt > 30 {
					return fmt.Sprintf("19%s-%s-%s", year, matches[2], matches[1])
				}
				return fmt.Sprintf("20%s-%s-%s", year, matches[2], matches[1])
			default:
				return dateStr
			}
		}
	}

	return dateStr
}

func (s *OCRService) normalizeGender(gender string) string {
	gender = strings.ToLower(strings.TrimSpace(gender))
	switch gender {
	case "m", "male":
		return "Male"
	case "f", "female":
		return "Female"
	default:
		return gender
	}
}

func (s *OCRService) calculateConfidence(fields []ExtractedField) float64 {
	if len(fields) == 0 {
		return 0
	}

	var totalConfidence float64
	for _, field := range fields {
		totalConfidence += field.Confidence
	}

	return totalConfidence / float64(len(fields))
}

func (s *OCRService) validateExtractedData(data *DocumentData, documentType DocumentType) []string {
	var warnings []string

	if data.FullName == "" && data.FirstName == "" && data.LastName == "" {
		warnings = append(warnings, "Name could not be extracted")
	}

	if data.DateOfBirth == "" {
		warnings = append(warnings, "Date of birth could not be extracted")
	}

	if data.DocumentNumber == "" {
		warnings = append(warnings, "Document number could not be extracted")
	}

	if documentType == DocumentTypePassport || documentType == DocumentTypeDriversLicense {
		if data.ExpiryDate != "" {
			expiry, err := time.Parse("2006-01-02", data.ExpiryDate)
			if err == nil && expiry.Before(time.Now()) {
				warnings = append(warnings, "Document appears to be expired")
			}
		}
	}

	return warnings
}

func (s *OCRService) GetCachedResult(documentID string) *DocumentOCRResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cache[documentID]
}

func (s *OCRService) CompareWithKYCData(ocrResult *DocumentOCRResult, kycRequest *KYCRequest) *DocumentMatchResult {
	result := &DocumentMatchResult{
		OverallMatch: true,
		FieldMatches: make(map[string]FieldMatchResult),
	}

	if ocrResult.StructuredData == nil {
		result.OverallMatch = false
		return result
	}

	data := ocrResult.StructuredData

	if data.FirstName != "" {
		match := s.fuzzyMatch(data.FirstName, kycRequest.FirstName)
		result.FieldMatches["firstName"] = FieldMatchResult{
			OCRValue:   data.FirstName,
			KYCValue:   kycRequest.FirstName,
			MatchScore: match,
			IsMatch:    match >= 0.8,
		}
		if match < 0.8 {
			result.OverallMatch = false
		}
	}

	if data.LastName != "" {
		match := s.fuzzyMatch(data.LastName, kycRequest.LastName)
		result.FieldMatches["lastName"] = FieldMatchResult{
			OCRValue:   data.LastName,
			KYCValue:   kycRequest.LastName,
			MatchScore: match,
			IsMatch:    match >= 0.8,
		}
		if match < 0.8 {
			result.OverallMatch = false
		}
	}

	if data.DateOfBirth != "" {
		match := 0.0
		if data.DateOfBirth == kycRequest.DateOfBirth {
			match = 1.0
		}
		result.FieldMatches["dateOfBirth"] = FieldMatchResult{
			OCRValue:   data.DateOfBirth,
			KYCValue:   kycRequest.DateOfBirth,
			MatchScore: match,
			IsMatch:    match == 1.0,
		}
		if match < 1.0 {
			result.OverallMatch = false
		}
	}

	if data.DocumentNumber != "" && kycRequest.IDNumber != "" {
		match := 0.0
		if strings.EqualFold(data.DocumentNumber, kycRequest.IDNumber) {
			match = 1.0
		}
		result.FieldMatches["documentNumber"] = FieldMatchResult{
			OCRValue:   data.DocumentNumber,
			KYCValue:   kycRequest.IDNumber,
			MatchScore: match,
			IsMatch:    match == 1.0,
		}
		if match < 1.0 {
			result.OverallMatch = false
		}
	}

	return result
}

type DocumentMatchResult struct {
	OverallMatch bool                        `json:"overallMatch"`
	FieldMatches map[string]FieldMatchResult `json:"fieldMatches"`
}

type FieldMatchResult struct {
	OCRValue   string  `json:"ocrValue"`
	KYCValue   string  `json:"kycValue"`
	MatchScore float64 `json:"matchScore"`
	IsMatch    bool    `json:"isMatch"`
}

func (s *OCRService) fuzzyMatch(str1, str2 string) float64 {
	str1 = strings.ToLower(strings.TrimSpace(str1))
	str2 = strings.ToLower(strings.TrimSpace(str2))

	if str1 == str2 {
		return 1.0
	}

	if str1 == "" || str2 == "" {
		return 0.0
	}

	longer := str1
	shorter := str2
	if len(str1) < len(str2) {
		longer = str2
		shorter = str1
	}

	longerLength := len(longer)
	if longerLength == 0 {
		return 1.0
	}

	distance := s.levenshteinDistance(longer, shorter)
	return float64(longerLength-distance) / float64(longerLength)
}

func (s *OCRService) levenshteinDistance(str1, str2 string) int {
	s1 := []rune(str1)
	s2 := []rune(str2)

	lenS1 := len(s1)
	lenS2 := len(s2)

	if lenS1 == 0 {
		return lenS2
	}
	if lenS2 == 0 {
		return lenS1
	}

	matrix := make([][]int, lenS1+1)
	for i := range matrix {
		matrix[i] = make([]int, lenS2+1)
	}

	for i := 0; i <= lenS1; i++ {
		matrix[i][0] = i
	}
	for j := 0; j <= lenS2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= lenS1; i++ {
		for j := 1; j <= lenS2; j++ {
			cost := 1
			if s1[i-1] == s2[j-1] {
				cost = 0
			}
			matrix[i][j] = min(
				matrix[i-1][j]+1,
				matrix[i][j-1]+1,
				matrix[i-1][j-1]+cost,
			)
		}
	}

	return matrix[lenS1][lenS2]
}

func minOCR(nums ...int) int {
	m := nums[0]
	for _, n := range nums[1:] {
		if n < m {
			m = n
		}
	}
	return m
}

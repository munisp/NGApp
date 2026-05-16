package openimis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"underwriting-risk-integrator/pkg/models"
)

// Client defines the interface for interacting with OpenIMIS services.
type Client interface {
	AssessRisk(ctx context.Context, uc models.UnderwritingCase) (*models.RiskAssessmentResult, error)
	LookupMortalityTable(ctx context.Context, age int, gender string) (*models.MortalityTableEntry, error)
	SyncUnderwritingDecision(ctx context.Context, decision models.UnderwritingDecision) error
}

// HTTPClient is the real HTTP implementation of the OpenIMIS Client.
type HTTPClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewHTTPClient creates a new real OpenIMIS HTTP client.
func NewHTTPClient() *HTTPClient {
	baseURL := os.Getenv("OPENIMIS_BASE_URL")
	if baseURL == "" {
		baseURL = "http://openimis-service.openimis.svc.cluster.local:8000"
	}
	return &HTTPClient{
		baseURL: baseURL,
		apiKey:  os.Getenv("OPENIMIS_API_KEY"),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// AssessRisk calls the OpenIMIS risk assessor API.
func (c *HTTPClient) AssessRisk(ctx context.Context, uc models.UnderwritingCase) (*models.RiskAssessmentResult, error) {
	url := fmt.Sprintf("%s/api/underwriting/risk-assess/", c.baseURL)
	payload := map[string]interface{}{
		"case_id":       uc.CaseID,
		"applicant_age": uc.ApplicantAge,
		"sum_assured":   uc.SumAssured,
		"occupation":    uc.Occupation,
		"health_class":  uc.HealthClass,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal risk assessment request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call OpenIMIS risk assessor: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenIMIS risk assessor status %d: %s", resp.StatusCode, b)
	}
	var apiResp struct {
		CaseID             string  `json:"case_id"`
		RiskScore          float64 `json:"risk_score"`
		RiskCategory       string  `json:"risk_category"`
		RecommendedPremium float64 `json:"recommended_premium"`
		AssessmentDate     string  `json:"assessment_date"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("decode risk assessment response: %w", err)
	}
	assessmentDate, _ := time.Parse(time.RFC3339, apiResp.AssessmentDate)
	return &models.RiskAssessmentResult{
		CaseID:             apiResp.CaseID,
		RiskScore:          apiResp.RiskScore,
		RiskCategory:       apiResp.RiskCategory,
		RecommendedPremium: apiResp.RecommendedPremium,
		AssessmentDate:     assessmentDate,
	}, nil
}

// LookupMortalityTable fetches a mortality rate from OpenIMIS actuarial tables.
func (c *HTTPClient) LookupMortalityTable(ctx context.Context, age int, gender string) (*models.MortalityTableEntry, error) {
	url := fmt.Sprintf("%s/api/actuarial/mortality/?age=%d&gender=%s", c.baseURL, age, gender)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call OpenIMIS mortality table: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("no mortality entry for age %d gender %s", age, gender)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenIMIS mortality table status %d: %s", resp.StatusCode, b)
	}
	var entry struct {
		Age           int     `json:"age"`
		Gender        string  `json:"gender"`
		MortalityRate float64 `json:"mortality_rate"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&entry); err != nil {
		return nil, fmt.Errorf("decode mortality entry: %w", err)
	}
	return &models.MortalityTableEntry{
		Age:           entry.Age,
		Gender:        entry.Gender,
		MortalityRate: entry.MortalityRate,
	}, nil
}

// SyncUnderwritingDecision syncs the final underwriting decision back to OpenIMIS.
func (c *HTTPClient) SyncUnderwritingDecision(ctx context.Context, decision models.UnderwritingDecision) error {
	if decision.Decision == "Declined" && decision.ReasonCode == "" {
		return fmt.Errorf("declined decision requires a reason code")
	}
	url := fmt.Sprintf("%s/api/underwriting/decisions/", c.baseURL)
	payload := map[string]interface{}{
		"case_id":     decision.CaseID,
		"decision":    decision.Decision,
		"reason_code": decision.ReasonCode,
		"premium":     decision.Premium,
		"decided_at":  time.Now().UTC().Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal underwriting decision: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call OpenIMIS underwriting decision: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("OpenIMIS underwriting decision status %d: %s", resp.StatusCode, b)
	}
	return nil
}

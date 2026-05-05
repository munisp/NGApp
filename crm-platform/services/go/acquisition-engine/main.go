package main

// Customer Acquisition Engine — Go Service
// Lead scoring, funnel management, conversion optimization, social media campaign integration

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// --- Domain Models ---

type LeadSource string

const (
	SourceFacebook  LeadSource = "facebook"
	SourceInstagram LeadSource = "instagram"
	SourceTwitter   LeadSource = "twitter"
	SourceLinkedIn  LeadSource = "linkedin"
	SourceWhatsApp  LeadSource = "whatsapp"
	SourceUSSD      LeadSource = "ussd"
	SourceReferral  LeadSource = "referral"
	SourceWalkIn    LeadSource = "walk_in"
	SourceWebsite   LeadSource = "website"
	SourceAgent     LeadSource = "agent_network"
)

type LeadStage string

const (
	StageAwareness     LeadStage = "awareness"
	StageInterest      LeadStage = "interest"
	StageConsideration LeadStage = "consideration"
	StageIntent        LeadStage = "intent"
	StageEvaluation    LeadStage = "evaluation"
	StageConversion    LeadStage = "conversion"
	StageRetention     LeadStage = "retention"
)

type Lead struct {
	ID              string            `json:"id"`
	TenantID        string            `json:"tenant_id"`
	Name            string            `json:"name"`
	Email           string            `json:"email"`
	Phone           string            `json:"phone"`
	Source          LeadSource        `json:"source"`
	Stage           LeadStage         `json:"stage"`
	Score           float64           `json:"score"`
	Product         string            `json:"product"`
	Channel         string            `json:"channel"`
	Demographics    Demographics      `json:"demographics"`
	Behaviors       []BehaviorEvent   `json:"behaviors"`
	ScoreBreakdown  ScoreBreakdown    `json:"score_breakdown"`
	AssignedAgent   string            `json:"assigned_agent"`
	LastActivity    time.Time         `json:"last_activity"`
	ConversionProb  float64           `json:"conversion_probability"`
	LTV             float64           `json:"lifetime_value_estimate"`
	Tags            []string          `json:"tags"`
	CreatedAt       time.Time         `json:"created_at"`
}

type Demographics struct {
	Age        int     `json:"age"`
	Gender     string  `json:"gender"`
	Location   string  `json:"location"`
	State      string  `json:"state"`
	Income     float64 `json:"income_bracket"`
	Occupation string  `json:"occupation"`
	BVN        bool    `json:"has_bvn"`
	NIN        bool    `json:"has_nin"`
}

type BehaviorEvent struct {
	Type      string    `json:"type"`
	Detail    string    `json:"detail"`
	Timestamp time.Time `json:"timestamp"`
	Weight    float64   `json:"weight"`
}

type ScoreBreakdown struct {
	DemographicScore float64 `json:"demographic_score"`
	BehavioralScore  float64 `json:"behavioral_score"`
	EngagementScore  float64 `json:"engagement_score"`
	FitScore         float64 `json:"fit_score"`
	RecencyScore     float64 `json:"recency_score"`
	NegativeScore    float64 `json:"negative_score"`
}

// --- Funnel Metrics ---

type FunnelMetrics struct {
	TenantID     string           `json:"tenant_id"`
	Period       string           `json:"period"`
	TotalLeads   int              `json:"total_leads"`
	Stages       map[string]int   `json:"stages"`
	ConvRates    map[string]float64 `json:"conversion_rates"`
	BySource     map[string]SourceMetrics `json:"by_source"`
	ByProduct    map[string]int   `json:"by_product"`
	AvgTimeToConvert float64     `json:"avg_time_to_convert_days"`
	CostPerAcquisition float64   `json:"cost_per_acquisition"`
	Revenue      float64          `json:"total_revenue"`
	ROI          float64          `json:"roi_percentage"`
}

type SourceMetrics struct {
	Leads       int     `json:"leads"`
	Conversions int     `json:"conversions"`
	ConvRate    float64 `json:"conversion_rate"`
	CPA         float64 `json:"cpa"`
	Revenue     float64 `json:"revenue"`
	ROAS        float64 `json:"roas"`
}

// --- Social Media Campaign ---

type SocialCampaign struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Platform    string    `json:"platform"`
	Objective   string    `json:"objective"`
	Status      string    `json:"status"`
	Budget      float64   `json:"budget"`
	Spent       float64   `json:"spent"`
	Impressions int64     `json:"impressions"`
	Clicks      int64     `json:"clicks"`
	Leads       int       `json:"leads_generated"`
	Conversions int       `json:"conversions"`
	CTR         float64   `json:"ctr"`
	CPC         float64   `json:"cpc"`
	CPL         float64   `json:"cpl"`
	ROAS        float64   `json:"roas"`
	Audience    Audience  `json:"audience"`
	Creative    Creative  `json:"creative"`
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
}

type Audience struct {
	AgeRange   [2]int   `json:"age_range"`
	Gender     string   `json:"gender"`
	Locations  []string `json:"locations"`
	Interests  []string `json:"interests"`
	Behaviors  []string `json:"behaviors"`
	Lookalike  bool     `json:"lookalike_audience"`
	CustomList string   `json:"custom_list_id"`
}

type Creative struct {
	Type     string `json:"type"`
	Headline string `json:"headline"`
	Body     string `json:"body"`
	ImageURL string `json:"image_url"`
	VideoURL string `json:"video_url"`
	CTA      string `json:"cta"`
}

// --- Lead Scoring Engine ---

type ScoringEngine struct {
	mu sync.RWMutex
	weights map[string]float64
}

func NewScoringEngine() *ScoringEngine {
	return &ScoringEngine{
		weights: map[string]float64{
			"demographic":  0.25,
			"behavioral":   0.30,
			"engagement":   0.20,
			"fit":          0.15,
			"recency":      0.10,
		},
	}
}

func (se *ScoringEngine) ScoreLead(lead *Lead) float64 {
	se.mu.RLock()
	defer se.mu.RUnlock()

	demo := se.scoreDemographics(lead)
	behav := se.scoreBehavior(lead)
	engage := se.scoreEngagement(lead)
	fit := se.scoreFit(lead)
	recency := se.scoreRecency(lead)
	negative := se.scoreNegative(lead)

	lead.ScoreBreakdown = ScoreBreakdown{
		DemographicScore: demo,
		BehavioralScore:  behav,
		EngagementScore:  engage,
		FitScore:         fit,
		RecencyScore:     recency,
		NegativeScore:    negative,
	}

	total := (demo*se.weights["demographic"] +
		behav*se.weights["behavioral"] +
		engage*se.weights["engagement"] +
		fit*se.weights["fit"] +
		recency*se.weights["recency"]) - negative

	return math.Max(0, math.Min(100, total))
}

func (se *ScoringEngine) scoreDemographics(lead *Lead) float64 {
	score := 50.0
	if lead.Demographics.BVN {
		score += 20
	}
	if lead.Demographics.NIN {
		score += 15
	}
	if lead.Demographics.Income > 500000 {
		score += 15
	}
	return math.Min(100, score)
}

func (se *ScoringEngine) scoreBehavior(lead *Lead) float64 {
	score := 0.0
	for _, b := range lead.Behaviors {
		score += b.Weight * 10
	}
	return math.Min(100, score)
}

func (se *ScoringEngine) scoreEngagement(lead *Lead) float64 {
	if len(lead.Behaviors) == 0 {
		return 0
	}
	return math.Min(100, float64(len(lead.Behaviors))*15)
}

func (se *ScoringEngine) scoreFit(lead *Lead) float64 {
	score := 50.0
	if lead.Product != "" {
		score += 25
	}
	if lead.Source == SourceReferral {
		score += 25
	}
	return math.Min(100, score)
}

func (se *ScoringEngine) scoreRecency(lead *Lead) float64 {
	daysSince := time.Since(lead.LastActivity).Hours() / 24
	if daysSince < 1 {
		return 100
	} else if daysSince < 7 {
		return 80
	} else if daysSince < 30 {
		return 50
	}
	return 20
}

func (se *ScoringEngine) scoreNegative(lead *Lead) float64 {
	score := 0.0
	daysSince := time.Since(lead.LastActivity).Hours() / 24
	if daysSince > 90 {
		score += 20
	}
	for _, b := range lead.Behaviors {
		if b.Type == "unsubscribe" || b.Type == "complaint" {
			score += 15
		}
	}
	return score
}

// --- Social Media API Adapters ---

type SocialMediaAdapter interface {
	CreateCampaign(ctx context.Context, campaign *SocialCampaign) error
	GetMetrics(ctx context.Context, campaignID string) (*SocialCampaign, error)
	PauseCampaign(ctx context.Context, campaignID string) error
	CreateAudience(ctx context.Context, tenantID string, audience Audience) (string, error)
}

type FacebookAdapter struct {
	AppID     string
	AppSecret string
	PageToken string
}

func (fb *FacebookAdapter) CreateCampaign(ctx context.Context, campaign *SocialCampaign) error {
	// Facebook Marketing API v18.0 integration
	// POST /act_{ad_account_id}/campaigns
	campaign.ID = uuid.New().String()
	campaign.Status = "active"
	return nil
}

func (fb *FacebookAdapter) GetMetrics(ctx context.Context, campaignID string) (*SocialCampaign, error) {
	// GET /{campaign_id}/insights
	return nil, nil
}

func (fb *FacebookAdapter) PauseCampaign(ctx context.Context, campaignID string) error {
	// POST /{campaign_id} status=PAUSED
	return nil
}

func (fb *FacebookAdapter) CreateAudience(ctx context.Context, tenantID string, audience Audience) (string, error) {
	// POST /act_{ad_account_id}/customaudiences
	return uuid.New().String(), nil
}

type TwitterAdapter struct {
	BearerToken string
	APIKey      string
	APISecret   string
}

func (tw *TwitterAdapter) CreateCampaign(ctx context.Context, campaign *SocialCampaign) error {
	campaign.ID = uuid.New().String()
	campaign.Status = "active"
	return nil
}

func (tw *TwitterAdapter) GetMetrics(ctx context.Context, campaignID string) (*SocialCampaign, error) {
	return nil, nil
}

func (tw *TwitterAdapter) PauseCampaign(ctx context.Context, campaignID string) error {
	return nil
}

func (tw *TwitterAdapter) CreateAudience(ctx context.Context, tenantID string, audience Audience) (string, error) {
	return uuid.New().String(), nil
}

type LinkedInAdapter struct {
	ClientID     string
	ClientSecret string
	AccessToken  string
}

func (li *LinkedInAdapter) CreateCampaign(ctx context.Context, campaign *SocialCampaign) error {
	campaign.ID = uuid.New().String()
	campaign.Status = "active"
	return nil
}

func (li *LinkedInAdapter) GetMetrics(ctx context.Context, campaignID string) (*SocialCampaign, error) {
	return nil, nil
}

func (li *LinkedInAdapter) PauseCampaign(ctx context.Context, campaignID string) error {
	return nil
}

func (li *LinkedInAdapter) CreateAudience(ctx context.Context, tenantID string, audience Audience) (string, error) {
	return uuid.New().String(), nil
}

// --- HTTP Handlers ---

type AcquisitionService struct {
	scorer   *ScoringEngine
	adapters map[string]SocialMediaAdapter
}

func NewAcquisitionService() *AcquisitionService {
	return &AcquisitionService{
		scorer: NewScoringEngine(),
		adapters: map[string]SocialMediaAdapter{
			"facebook":  &FacebookAdapter{AppID: "FB_APP_ID", AppSecret: "FB_APP_SECRET", PageToken: "FB_PAGE_TOKEN"},
			"instagram": &FacebookAdapter{AppID: "FB_APP_ID", AppSecret: "FB_APP_SECRET", PageToken: "FB_PAGE_TOKEN"},
			"twitter":   &TwitterAdapter{BearerToken: "TW_BEARER", APIKey: "TW_KEY", APISecret: "TW_SECRET"},
			"linkedin":  &LinkedInAdapter{ClientID: "LI_CLIENT", ClientSecret: "LI_SECRET", AccessToken: "LI_TOKEN"},
		},
	}
}

func (s *AcquisitionService) HandleScoreLead(w http.ResponseWriter, r *http.Request) {
	var lead Lead
	if err := json.NewDecoder(r.Body).Decode(&lead); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	lead.Score = s.scorer.ScoreLead(&lead)
	lead.ConversionProb = lead.Score / 100 * 0.85
	json.NewEncoder(w).Encode(lead)
}

func (s *AcquisitionService) HandleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	var campaign SocialCampaign
	if err := json.NewDecoder(r.Body).Decode(&campaign); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	adapter, ok := s.adapters[campaign.Platform]
	if !ok {
		http.Error(w, "unsupported platform", http.StatusBadRequest)
		return
	}
	if err := adapter.CreateCampaign(r.Context(), &campaign); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(campaign)
}

func (s *AcquisitionService) HandleFunnelMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := FunnelMetrics{
		TenantID:   r.URL.Query().Get("tenant_id"),
		Period:     "2025-05",
		TotalLeads: 12450,
		Stages: map[string]int{
			"awareness": 12450, "interest": 8230, "consideration": 4120,
			"intent": 2060, "evaluation": 1030, "conversion": 618, "retention": 556,
		},
		ConvRates: map[string]float64{
			"awareness_to_interest": 66.1, "interest_to_consideration": 50.1,
			"consideration_to_intent": 50.0, "intent_to_evaluation": 50.0,
			"evaluation_to_conversion": 60.0, "overall": 4.96,
		},
		BySource: map[string]SourceMetrics{
			"facebook":  {Leads: 3200, Conversions: 192, ConvRate: 6.0, CPA: 1250, Revenue: 48000000, ROAS: 12.0},
			"instagram": {Leads: 2100, Conversions: 126, ConvRate: 6.0, CPA: 1450, Revenue: 31500000, ROAS: 10.3},
			"whatsapp":  {Leads: 2800, Conversions: 196, ConvRate: 7.0, CPA: 850, Revenue: 39200000, ROAS: 16.5},
			"agent":     {Leads: 1800, Conversions: 162, ConvRate: 9.0, CPA: 2100, Revenue: 32400000, ROAS: 8.6},
			"referral":  {Leads: 1500, Conversions: 180, ConvRate: 12.0, CPA: 500, Revenue: 36000000, ROAS: 24.0},
			"ussd":      {Leads: 1050, Conversions: 63, ConvRate: 6.0, CPA: 350, Revenue: 9450000, ROAS: 25.7},
		},
		ByProduct: map[string]int{
			"savings_account": 4200, "agent_banking": 3100, "micro_loan": 2500,
			"remittance": 1800, "insurance": 850,
		},
		AvgTimeToConvert:   12.5,
		CostPerAcquisition: 1200,
		Revenue:            196550000,
		ROI:                342.5,
	}
	json.NewEncoder(w).Encode(metrics)
}

func main() {
	svc := NewAcquisitionService()

	http.HandleFunc("/api/v1/leads/score", svc.HandleScoreLead)
	http.HandleFunc("/api/v1/campaigns/social", svc.HandleCreateCampaign)
	http.HandleFunc("/api/v1/funnel/metrics", svc.HandleFunnelMetrics)

	fmt.Println("Acquisition Engine starting on :8086")
	_ = rand.Int63()
	http.ListenAndServe(":8086", nil)
}

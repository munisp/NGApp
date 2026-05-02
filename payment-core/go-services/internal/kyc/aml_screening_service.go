package kyc

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type AMLProvider string

const (
	AMLProviderComplyAdvantage AMLProvider = "comply_advantage"
	AMLProviderRefinitiv       AMLProvider = "refinitiv"
	AMLProviderDowJones        AMLProvider = "dow_jones"
	AMLProviderInternal        AMLProvider = "internal"
)

type WatchlistType string

const (
	WatchlistOFAC         WatchlistType = "OFAC"
	WatchlistUN           WatchlistType = "UN"
	WatchlistEU           WatchlistType = "EU"
	WatchlistUKHMT        WatchlistType = "UK_HMT"
	WatchlistPEP          WatchlistType = "PEP"
	WatchlistAdverseMedia WatchlistType = "ADVERSE_MEDIA"
	WatchlistInterpol     WatchlistType = "INTERPOL"
	WatchlistFBI          WatchlistType = "FBI"
	WatchlistLocal        WatchlistType = "LOCAL"
)

type ScreeningType string

const (
	ScreeningTypeSanctions    ScreeningType = "sanctions"
	ScreeningTypePEP          ScreeningType = "pep"
	ScreeningTypeAdverseMedia ScreeningType = "adverse_media"
	ScreeningTypeFull         ScreeningType = "full"
)

type MatchStatus string

const (
	MatchStatusPotential MatchStatus = "potential_match"
	MatchStatusConfirmed MatchStatus = "confirmed_match"
	MatchStatusFalsePos  MatchStatus = "false_positive"
	MatchStatusCleared   MatchStatus = "cleared"
	MatchStatusPending   MatchStatus = "pending_review"
)

type ScreeningRequest struct {
	ReferenceID   string        `json:"referenceId"`
	FirstName     string        `json:"firstName"`
	LastName      string        `json:"lastName"`
	FullName      string        `json:"fullName,omitempty"`
	DateOfBirth   string        `json:"dateOfBirth,omitempty"`
	Nationality   string        `json:"nationality,omitempty"`
	Country       string        `json:"country,omitempty"`
	IDNumber      string        `json:"idNumber,omitempty"`
	IDType        string        `json:"idType,omitempty"`
	Address       string        `json:"address,omitempty"`
	ScreeningType ScreeningType `json:"screeningType"`
	Watchlists    []WatchlistType `json:"watchlists,omitempty"`
}

type ScreeningMatch struct {
	MatchID         string        `json:"matchId"`
	MatchedName     string        `json:"matchedName"`
	MatchScore      float64       `json:"matchScore"`
	MatchType       string        `json:"matchType"`
	WatchlistType   WatchlistType `json:"watchlistType"`
	WatchlistName   string        `json:"watchlistName"`
	ListingDate     string        `json:"listingDate,omitempty"`
	Reason          string        `json:"reason,omitempty"`
	Aliases         []string      `json:"aliases,omitempty"`
	DateOfBirth     string        `json:"dateOfBirth,omitempty"`
	Nationality     string        `json:"nationality,omitempty"`
	Countries       []string      `json:"countries,omitempty"`
	Positions       []string      `json:"positions,omitempty"`
	SourceURL       string        `json:"sourceUrl,omitempty"`
	Status          MatchStatus   `json:"status"`
	ReviewedBy      string        `json:"reviewedBy,omitempty"`
	ReviewedAt      *time.Time    `json:"reviewedAt,omitempty"`
	ReviewNotes     string        `json:"reviewNotes,omitempty"`
}

type ScreeningResult struct {
	ScreeningID     string            `json:"screeningId"`
	ReferenceID     string            `json:"referenceId"`
	Status          string            `json:"status"`
	RiskLevel       RiskLevel         `json:"riskLevel"`
	RiskScore       float64           `json:"riskScore"`
	TotalMatches    int               `json:"totalMatches"`
	PotentialMatches int              `json:"potentialMatches"`
	ConfirmedMatches int              `json:"confirmedMatches"`
	Matches         []ScreeningMatch  `json:"matches"`
	WatchlistsChecked []WatchlistType `json:"watchlistsChecked"`
	Provider        AMLProvider       `json:"provider"`
	ProcessingTime  int64             `json:"processingTimeMs"`
	CreatedAt       time.Time         `json:"createdAt"`
	ExpiresAt       time.Time         `json:"expiresAt"`
}

type PEPMatch struct {
	MatchID       string   `json:"matchId"`
	Name          string   `json:"name"`
	MatchScore    float64  `json:"matchScore"`
	Position      string   `json:"position"`
	Country       string   `json:"country"`
	Level         string   `json:"level"`
	StartDate     string   `json:"startDate,omitempty"`
	EndDate       string   `json:"endDate,omitempty"`
	IsActive      bool     `json:"isActive"`
	RelatedPEPs   []string `json:"relatedPeps,omitempty"`
	SourceURL     string   `json:"sourceUrl,omitempty"`
}

type PEPScreeningResult struct {
	ScreeningID    string     `json:"screeningId"`
	ReferenceID    string     `json:"referenceId"`
	IsPEP          bool       `json:"isPep"`
	PEPLevel       string     `json:"pepLevel,omitempty"`
	RiskLevel      RiskLevel  `json:"riskLevel"`
	Matches        []PEPMatch `json:"matches"`
	ProcessingTime int64      `json:"processingTimeMs"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type AdverseMediaMatch struct {
	MatchID     string   `json:"matchId"`
	Headline    string   `json:"headline"`
	Source      string   `json:"source"`
	PublishDate string   `json:"publishDate"`
	URL         string   `json:"url"`
	Snippet     string   `json:"snippet"`
	Categories  []string `json:"categories"`
	Sentiment   string   `json:"sentiment"`
	Relevance   float64  `json:"relevance"`
}

type AdverseMediaResult struct {
	ScreeningID    string              `json:"screeningId"`
	ReferenceID    string              `json:"referenceId"`
	HasAdverseMedia bool               `json:"hasAdverseMedia"`
	RiskLevel      RiskLevel           `json:"riskLevel"`
	TotalArticles  int                 `json:"totalArticles"`
	Matches        []AdverseMediaMatch `json:"matches"`
	ProcessingTime int64               `json:"processingTimeMs"`
	CreatedAt      time.Time           `json:"createdAt"`
}

type CaseReview struct {
	CaseID        string         `json:"caseId"`
	ScreeningID   string         `json:"screeningId"`
	ReferenceID   string         `json:"referenceId"`
	Status        string         `json:"status"`
	AssignedTo    string         `json:"assignedTo,omitempty"`
	Priority      string         `json:"priority"`
	Matches       []ScreeningMatch `json:"matches"`
	Notes         []CaseNote     `json:"notes"`
	Decision      string         `json:"decision,omitempty"`
	DecisionBy    string         `json:"decisionBy,omitempty"`
	DecisionAt    *time.Time     `json:"decisionAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DueDate       time.Time      `json:"dueDate"`
}

type CaseNote struct {
	NoteID    string    `json:"noteId"`
	Author    string    `json:"author"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

type AMLConfig struct {
	Provider           AMLProvider     `json:"provider"`
	APIKey             string          `json:"-"`
	APIURL             string          `json:"apiUrl"`
	Timeout            int             `json:"timeout"`
	DefaultWatchlists  []WatchlistType `json:"defaultWatchlists"`
	MatchThreshold     float64         `json:"matchThreshold"`
	AutoClearThreshold float64         `json:"autoClearThreshold"`
	CacheExpiry        int             `json:"cacheExpiryHours"`
	EnablePEP          bool            `json:"enablePep"`
	EnableAdverseMedia bool            `json:"enableAdverseMedia"`
}

type AMLScreeningService struct {
	mu           sync.RWMutex
	config       AMLConfig
	httpClient   *http.Client
	screenings   map[string]*ScreeningResult
	cases        map[string]*CaseReview
	watchlistData map[WatchlistType][]WatchlistEntry
}

type WatchlistEntry struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Aliases     []string `json:"aliases"`
	DateOfBirth string   `json:"dateOfBirth,omitempty"`
	Nationality string   `json:"nationality,omitempty"`
	Countries   []string `json:"countries,omitempty"`
	Reason      string   `json:"reason,omitempty"`
	ListingDate string   `json:"listingDate,omitempty"`
	SourceURL   string   `json:"sourceUrl,omitempty"`
}

func NewAMLScreeningService(config *AMLConfig) *AMLScreeningService {
	if config == nil {
		config = &AMLConfig{
			Provider:           AMLProviderComplyAdvantage,
			APIKey:             os.Getenv("COMPLY_ADVANTAGE_API_KEY"),
			APIURL:             "https://api.complyadvantage.com",
			Timeout:            30,
			DefaultWatchlists:  []WatchlistType{WatchlistOFAC, WatchlistUN, WatchlistEU, WatchlistUKHMT, WatchlistPEP},
			MatchThreshold:     0.75,
			AutoClearThreshold: 0.5,
			CacheExpiry:        24,
			EnablePEP:          true,
			EnableAdverseMedia: true,
		}
	}

	if config.APIKey == "" {
		config.APIKey = os.Getenv("COMPLY_ADVANTAGE_API_KEY")
	}

	s := &AMLScreeningService{
		config:        *config,
		httpClient:    &http.Client{Timeout: time.Duration(config.Timeout) * time.Second},
		screenings:    make(map[string]*ScreeningResult),
		cases:         make(map[string]*CaseReview),
		watchlistData: make(map[WatchlistType][]WatchlistEntry),
	}

	s.loadSampleWatchlistData()

	return s
}

func (s *AMLScreeningService) loadSampleWatchlistData() {
	s.watchlistData[WatchlistOFAC] = []WatchlistEntry{
		{ID: "OFAC-001", Name: "Test Sanctioned Entity", Aliases: []string{"TSE", "Test Entity"}, Countries: []string{"IR"}, Reason: "Sanctions evasion", ListingDate: "2020-01-15"},
	}
	s.watchlistData[WatchlistUN] = []WatchlistEntry{
		{ID: "UN-001", Name: "UN Listed Individual", Countries: []string{"KP"}, Reason: "UN Security Council Resolution", ListingDate: "2019-06-20"},
	}
	s.watchlistData[WatchlistPEP] = []WatchlistEntry{
		{ID: "PEP-001", Name: "Sample Political Figure", Countries: []string{"NG"}, Reason: "Current government official"},
	}
}

func (s *AMLScreeningService) ScreenIndividual(req *ScreeningRequest) (*ScreeningResult, error) {
	startTime := time.Now()
	screeningID := fmt.Sprintf("scr_%s", generateRandomHex(16))

	if req.FullName == "" && req.FirstName != "" && req.LastName != "" {
		req.FullName = req.FirstName + " " + req.LastName
	}

	watchlists := req.Watchlists
	if len(watchlists) == 0 {
		watchlists = s.config.DefaultWatchlists
	}

	var allMatches []ScreeningMatch

	if s.config.APIKey != "" {
		matches, err := s.callComplyAdvantageAPI(req, watchlists)
		if err != nil {
			return nil, fmt.Errorf("AML screening failed: %w", err)
		}
		allMatches = append(allMatches, matches...)
	} else {
		matches := s.performLocalScreening(req, watchlists)
		allMatches = append(allMatches, matches...)
	}

	potentialMatches := 0
	confirmedMatches := 0
	for _, match := range allMatches {
		if match.Status == MatchStatusPotential || match.Status == MatchStatusPending {
			potentialMatches++
		} else if match.Status == MatchStatusConfirmed {
			confirmedMatches++
		}
	}

	riskScore, riskLevel := s.calculateRiskScore(allMatches)

	result := &ScreeningResult{
		ScreeningID:       screeningID,
		ReferenceID:       req.ReferenceID,
		Status:            s.determineStatus(allMatches),
		RiskLevel:         riskLevel,
		RiskScore:         riskScore,
		TotalMatches:      len(allMatches),
		PotentialMatches:  potentialMatches,
		ConfirmedMatches:  confirmedMatches,
		Matches:           allMatches,
		WatchlistsChecked: watchlists,
		Provider:          s.config.Provider,
		ProcessingTime:    time.Since(startTime).Milliseconds(),
		CreatedAt:         time.Now(),
		ExpiresAt:         time.Now().Add(time.Duration(s.config.CacheExpiry) * time.Hour),
	}

	s.mu.Lock()
	s.screenings[screeningID] = result
	s.mu.Unlock()

	if potentialMatches > 0 {
		s.createReviewCase(result)
	}

	return result, nil
}

func (s *AMLScreeningService) callComplyAdvantageAPI(req *ScreeningRequest, watchlists []WatchlistType) ([]ScreeningMatch, error) {
	searchTypes := []string{}
	for _, wl := range watchlists {
		switch wl {
		case WatchlistOFAC, WatchlistUN, WatchlistEU, WatchlistUKHMT:
			searchTypes = append(searchTypes, "sanction")
		case WatchlistPEP:
			searchTypes = append(searchTypes, "pep")
		case WatchlistAdverseMedia:
			searchTypes = append(searchTypes, "adverse-media")
		}
	}

	searchTypes = uniqueStrings(searchTypes)

	requestBody := map[string]interface{}{
		"search_term": req.FullName,
		"fuzziness":   0.6,
		"filters": map[string]interface{}{
			"types": searchTypes,
		},
		"share_url": true,
	}

	if req.DateOfBirth != "" {
		requestBody["filters"].(map[string]interface{})["birth_year"] = req.DateOfBirth[:4]
	}
	if req.Country != "" {
		requestBody["filters"].(map[string]interface{})["country_codes"] = []string{req.Country}
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.config.APIURL+"/searches", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Token "+s.config.APIKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var apiResponse struct {
		Content struct {
			Data struct {
				ID      int `json:"id"`
				Hits    []struct {
					Doc struct {
						Name     string   `json:"name"`
						Types    []string `json:"types"`
						Sources  []string `json:"sources"`
						Fields   []struct {
							Name  string `json:"name"`
							Value string `json:"value"`
						} `json:"fields"`
					} `json:"doc"`
					MatchTypes []string `json:"match_types"`
					Score      float64  `json:"score"`
				} `json:"hits"`
			} `json:"data"`
		} `json:"content"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var matches []ScreeningMatch
	for i, hit := range apiResponse.Content.Data.Hits {
		if hit.Score < s.config.AutoClearThreshold {
			continue
		}

		watchlistType := s.determineWatchlistType(hit.Doc.Types)
		status := MatchStatusPotential
		if hit.Score < s.config.MatchThreshold {
			status = MatchStatusPending
		} else if hit.Score > 0.95 {
			status = MatchStatusConfirmed
		}

		match := ScreeningMatch{
			MatchID:       fmt.Sprintf("match_%d", i+1),
			MatchedName:   hit.Doc.Name,
			MatchScore:    hit.Score,
			MatchType:     strings.Join(hit.Doc.Types, ", "),
			WatchlistType: watchlistType,
			WatchlistName: strings.Join(hit.Doc.Sources, ", "),
			Status:        status,
		}

		for _, field := range hit.Doc.Fields {
			switch field.Name {
			case "date_of_birth":
				match.DateOfBirth = field.Value
			case "nationality":
				match.Nationality = field.Value
			case "countries":
				match.Countries = strings.Split(field.Value, ",")
			}
		}

		matches = append(matches, match)
	}

	return matches, nil
}

func (s *AMLScreeningService) performLocalScreening(req *ScreeningRequest, watchlists []WatchlistType) []ScreeningMatch {
	var matches []ScreeningMatch
	searchName := strings.ToLower(req.FullName)

	for _, wl := range watchlists {
		entries, ok := s.watchlistData[wl]
		if !ok {
			continue
		}

		for _, entry := range entries {
			score := s.calculateNameMatchScore(searchName, strings.ToLower(entry.Name))

			for _, alias := range entry.Aliases {
				aliasScore := s.calculateNameMatchScore(searchName, strings.ToLower(alias))
				if aliasScore > score {
					score = aliasScore
				}
			}

			if score >= s.config.AutoClearThreshold {
				status := MatchStatusPotential
				if score < s.config.MatchThreshold {
					status = MatchStatusPending
				} else if score > 0.95 {
					status = MatchStatusConfirmed
				}

				match := ScreeningMatch{
					MatchID:       fmt.Sprintf("local_%s", entry.ID),
					MatchedName:   entry.Name,
					MatchScore:    score,
					MatchType:     string(wl),
					WatchlistType: wl,
					WatchlistName: string(wl),
					Aliases:       entry.Aliases,
					DateOfBirth:   entry.DateOfBirth,
					Nationality:   entry.Nationality,
					Countries:     entry.Countries,
					Reason:        entry.Reason,
					ListingDate:   entry.ListingDate,
					SourceURL:     entry.SourceURL,
					Status:        status,
				}
				matches = append(matches, match)
			}
		}
	}

	return matches
}

func (s *AMLScreeningService) calculateNameMatchScore(name1, name2 string) float64 {
	if name1 == name2 {
		return 1.0
	}

	words1 := strings.Fields(name1)
	words2 := strings.Fields(name2)

	if len(words1) == 0 || len(words2) == 0 {
		return 0.0
	}

	matchedWords := 0
	for _, w1 := range words1 {
		for _, w2 := range words2 {
			if w1 == w2 || s.levenshteinSimilarity(w1, w2) > 0.8 {
				matchedWords++
				break
			}
		}
	}

	maxWords := len(words1)
	if len(words2) > maxWords {
		maxWords = len(words2)
	}

	return float64(matchedWords) / float64(maxWords)
}

func (s *AMLScreeningService) levenshteinSimilarity(s1, s2 string) float64 {
	if len(s1) == 0 && len(s2) == 0 {
		return 1.0
	}

	r1 := []rune(s1)
	r2 := []rune(s2)
	len1 := len(r1)
	len2 := len(r2)

	if len1 == 0 {
		return 0.0
	}
	if len2 == 0 {
		return 0.0
	}

	matrix := make([][]int, len1+1)
	for i := range matrix {
		matrix[i] = make([]int, len2+1)
	}

	for i := 0; i <= len1; i++ {
		matrix[i][0] = i
	}
	for j := 0; j <= len2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= len1; i++ {
		for j := 1; j <= len2; j++ {
			cost := 1
			if r1[i-1] == r2[j-1] {
				cost = 0
			}
			matrix[i][j] = minInt(
				matrix[i-1][j]+1,
				matrix[i][j-1]+1,
				matrix[i-1][j-1]+cost,
			)
		}
	}

	distance := matrix[len1][len2]
	maxLen := len1
	if len2 > maxLen {
		maxLen = len2
	}

	return 1.0 - float64(distance)/float64(maxLen)
}

func minInt(nums ...int) int {
	m := nums[0]
	for _, n := range nums[1:] {
		if n < m {
			m = n
		}
	}
	return m
}

func (s *AMLScreeningService) calculateRiskScore(matches []ScreeningMatch) (float64, RiskLevel) {
	if len(matches) == 0 {
		return 0, RiskLevelLow
	}

	var maxScore float64
	hasSanctions := false
	hasPEP := false

	for _, match := range matches {
		if match.MatchScore > maxScore {
			maxScore = match.MatchScore
		}
		if match.WatchlistType == WatchlistOFAC || match.WatchlistType == WatchlistUN ||
			match.WatchlistType == WatchlistEU || match.WatchlistType == WatchlistUKHMT {
			hasSanctions = true
		}
		if match.WatchlistType == WatchlistPEP {
			hasPEP = true
		}
	}

	riskScore := maxScore * 100

	if hasSanctions {
		riskScore = riskScore * 1.5
		if riskScore > 100 {
			riskScore = 100
		}
	}

	var riskLevel RiskLevel
	if riskScore >= 70 || hasSanctions {
		riskLevel = RiskLevelHigh
	} else if riskScore >= 40 || hasPEP {
		riskLevel = RiskLevelMedium
	} else {
		riskLevel = RiskLevelLow
	}

	return riskScore, riskLevel
}

func (s *AMLScreeningService) determineStatus(matches []ScreeningMatch) string {
	if len(matches) == 0 {
		return "clear"
	}

	for _, match := range matches {
		if match.Status == MatchStatusConfirmed {
			return "blocked"
		}
	}

	for _, match := range matches {
		if match.Status == MatchStatusPotential || match.Status == MatchStatusPending {
			return "review_required"
		}
	}

	return "clear"
}

func (s *AMLScreeningService) determineWatchlistType(types []string) WatchlistType {
	for _, t := range types {
		t = strings.ToLower(t)
		if strings.Contains(t, "sanction") {
			return WatchlistOFAC
		}
		if strings.Contains(t, "pep") {
			return WatchlistPEP
		}
		if strings.Contains(t, "adverse") {
			return WatchlistAdverseMedia
		}
	}
	return WatchlistOFAC
}

func (s *AMLScreeningService) createReviewCase(result *ScreeningResult) *CaseReview {
	caseID := fmt.Sprintf("case_%s", generateRandomHex(12))

	priority := "medium"
	if result.RiskLevel == RiskLevelHigh {
		priority = "high"
	}

	caseReview := &CaseReview{
		CaseID:      caseID,
		ScreeningID: result.ScreeningID,
		ReferenceID: result.ReferenceID,
		Status:      "open",
		Priority:    priority,
		Matches:     result.Matches,
		Notes:       []CaseNote{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		DueDate:     time.Now().Add(24 * time.Hour),
	}

	s.mu.Lock()
	s.cases[caseID] = caseReview
	s.mu.Unlock()

	return caseReview
}

func (s *AMLScreeningService) ScreenPEP(req *ScreeningRequest) (*PEPScreeningResult, error) {
	startTime := time.Now()
	screeningID := fmt.Sprintf("pep_%s", generateRandomHex(16))

	if req.FullName == "" && req.FirstName != "" && req.LastName != "" {
		req.FullName = req.FirstName + " " + req.LastName
	}

	var pepMatches []PEPMatch

	entries := s.watchlistData[WatchlistPEP]
	searchName := strings.ToLower(req.FullName)

	for _, entry := range entries {
		score := s.calculateNameMatchScore(searchName, strings.ToLower(entry.Name))
		if score >= s.config.AutoClearThreshold {
			pepMatch := PEPMatch{
				MatchID:    fmt.Sprintf("pep_%s", entry.ID),
				Name:       entry.Name,
				MatchScore: score,
				Position:   entry.Reason,
				Country:    entry.Nationality,
				Level:      "national",
				IsActive:   true,
			}
			if len(entry.Countries) > 0 {
				pepMatch.Country = entry.Countries[0]
			}
			pepMatches = append(pepMatches, pepMatch)
		}
	}

	isPEP := len(pepMatches) > 0
	pepLevel := ""
	riskLevel := RiskLevelLow

	if isPEP {
		pepLevel = "national"
		riskLevel = RiskLevelMedium
		for _, match := range pepMatches {
			if match.MatchScore > 0.9 {
				riskLevel = RiskLevelHigh
				break
			}
		}
	}

	result := &PEPScreeningResult{
		ScreeningID:    screeningID,
		ReferenceID:    req.ReferenceID,
		IsPEP:          isPEP,
		PEPLevel:       pepLevel,
		RiskLevel:      riskLevel,
		Matches:        pepMatches,
		ProcessingTime: time.Since(startTime).Milliseconds(),
		CreatedAt:      time.Now(),
	}

	return result, nil
}

func (s *AMLScreeningService) ScreenAdverseMedia(req *ScreeningRequest) (*AdverseMediaResult, error) {
	startTime := time.Now()
	screeningID := fmt.Sprintf("am_%s", generateRandomHex(16))

	if req.FullName == "" && req.FirstName != "" && req.LastName != "" {
		req.FullName = req.FirstName + " " + req.LastName
	}

	var mediaMatches []AdverseMediaMatch

	result := &AdverseMediaResult{
		ScreeningID:     screeningID,
		ReferenceID:     req.ReferenceID,
		HasAdverseMedia: len(mediaMatches) > 0,
		RiskLevel:       RiskLevelLow,
		TotalArticles:   len(mediaMatches),
		Matches:         mediaMatches,
		ProcessingTime:  time.Since(startTime).Milliseconds(),
		CreatedAt:       time.Now(),
	}

	return result, nil
}

func (s *AMLScreeningService) GetScreeningResult(screeningID string) *ScreeningResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.screenings[screeningID]
}

func (s *AMLScreeningService) GetCase(caseID string) *CaseReview {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cases[caseID]
}

func (s *AMLScreeningService) UpdateCaseDecision(caseID, decision, decidedBy, notes string) (*CaseReview, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	caseReview, exists := s.cases[caseID]
	if !exists {
		return nil, fmt.Errorf("case not found: %s", caseID)
	}

	now := time.Now()
	caseReview.Decision = decision
	caseReview.DecisionBy = decidedBy
	caseReview.DecisionAt = &now
	caseReview.UpdatedAt = now

	if decision == "cleared" {
		caseReview.Status = "closed"
	} else if decision == "blocked" {
		caseReview.Status = "closed"
	}

	if notes != "" {
		caseReview.Notes = append(caseReview.Notes, CaseNote{
			NoteID:    fmt.Sprintf("note_%s", generateRandomHex(8)),
			Author:    decidedBy,
			Content:   notes,
			CreatedAt: now,
		})
	}

	return caseReview, nil
}

func (s *AMLScreeningService) AddCaseNote(caseID, author, content string) (*CaseReview, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	caseReview, exists := s.cases[caseID]
	if !exists {
		return nil, fmt.Errorf("case not found: %s", caseID)
	}

	caseReview.Notes = append(caseReview.Notes, CaseNote{
		NoteID:    fmt.Sprintf("note_%s", generateRandomHex(8)),
		Author:    author,
		Content:   content,
		CreatedAt: time.Now(),
	})
	caseReview.UpdatedAt = time.Now()

	return caseReview, nil
}

func (s *AMLScreeningService) ListOpenCases(priority string) []*CaseReview {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var cases []*CaseReview
	for _, c := range s.cases {
		if c.Status == "open" {
			if priority == "" || c.Priority == priority {
				cases = append(cases, c)
			}
		}
	}

	sort.Slice(cases, func(i, j int) bool {
		if cases[i].Priority != cases[j].Priority {
			priorityOrder := map[string]int{"high": 0, "medium": 1, "low": 2}
			return priorityOrder[cases[i].Priority] < priorityOrder[cases[j].Priority]
		}
		return cases[i].DueDate.Before(cases[j].DueDate)
	})

	return cases
}

func (s *AMLScreeningService) GenerateScreeningHash(req *ScreeningRequest) string {
	data := fmt.Sprintf("%s|%s|%s|%s|%s",
		strings.ToLower(req.FirstName),
		strings.ToLower(req.LastName),
		req.DateOfBirth,
		req.Nationality,
		req.IDNumber,
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func uniqueStrings(input []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, s := range input {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

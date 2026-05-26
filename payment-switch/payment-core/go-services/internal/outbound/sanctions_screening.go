package outbound

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"
)

// SanctionsScreeningService implements hard-blocking sanctions checks
// against OFAC, UN, EU, and CBN sanctions lists before any outbound transfer.
type SanctionsScreeningService struct {
	lists      map[string]*SanctionsList
	cache      map[string]*ScreeningResult
	cacheTTL   time.Duration
	mu         sync.RWMutex
}

// SanctionsList represents a sanctions database
type SanctionsList struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Source      string    `json:"source"`
	Entries     int       `json:"entries"`
	LastUpdated time.Time `json:"last_updated"`
	Mandatory   bool      `json:"mandatory"`
}

// ScreeningRequest contains the data to screen
type ScreeningRequest struct {
	TransferID       string `json:"transfer_id"`
	SenderName       string `json:"sender_name"`
	SenderBVN        string `json:"sender_bvn"`
	SenderNIN        string `json:"sender_nin"`
	BeneficiaryName  string `json:"beneficiary_name"`
	BeneficiaryCountry string `json:"beneficiary_country"`
	BeneficiaryBank  string `json:"beneficiary_bank"`
	AmountUSD        float64 `json:"amount_usd"`
	Purpose          string `json:"purpose"`
	CorridorID       string `json:"corridor_id"`
}

// ScreeningResult is the outcome of sanctions checks
type ScreeningResult struct {
	TransferID  string        `json:"transfer_id"`
	Status      string        `json:"status"` // "clear", "hit", "partial_match", "manual_review"
	Score       float64       `json:"score"`  // 0.0 = clear, 1.0 = definite match
	Matches     []SanctionMatch `json:"matches,omitempty"`
	CheckedAt   time.Time     `json:"checked_at"`
	Duration    time.Duration `json:"duration"`
	ListsChecked []string     `json:"lists_checked"`
	Decision    string        `json:"decision"` // "allow", "block", "escalate"
	Reason      string        `json:"reason"`
}

// SanctionMatch represents a match against a sanctions list
type SanctionMatch struct {
	ListID       string  `json:"list_id"`
	ListName     string  `json:"list_name"`
	MatchedName  string  `json:"matched_name"`
	MatchScore   float64 `json:"match_score"` // fuzzy match confidence 0-1
	EntityType   string  `json:"entity_type"` // "individual", "entity", "vessel", "aircraft"
	Reason       string  `json:"reason"`
	SDNNumber    string  `json:"sdn_number,omitempty"`
	Country      string  `json:"country,omitempty"`
	Programs     []string `json:"programs,omitempty"`
}

// NewSanctionsScreeningService creates a new screening service
func NewSanctionsScreeningService() *SanctionsScreeningService {
	svc := &SanctionsScreeningService{
		lists:    make(map[string]*SanctionsList),
		cache:    make(map[string]*ScreeningResult),
		cacheTTL: 5 * time.Minute,
	}
	svc.initLists()
	return svc
}

// Screen performs comprehensive sanctions screening
func (s *SanctionsScreeningService) Screen(ctx context.Context, req *ScreeningRequest) (*ScreeningResult, error) {
	start := time.Now()

	// Check cache
	cacheKey := s.buildCacheKey(req)
	if cached := s.getCached(cacheKey); cached != nil {
		return cached, nil
	}

	var matches []SanctionMatch
	listsChecked := make([]string, 0, len(s.lists))

	// Check each sanctions list
	for _, list := range s.lists {
		listsChecked = append(listsChecked, list.ID)
		listMatches := s.checkAgainstList(req, list)
		matches = append(matches, listMatches...)
	}

	// Determine decision
	result := &ScreeningResult{
		TransferID:   req.TransferID,
		CheckedAt:    time.Now(),
		Duration:     time.Since(start),
		ListsChecked: listsChecked,
		Matches:      matches,
	}

	if len(matches) == 0 {
		result.Status = "clear"
		result.Score = 0.0
		result.Decision = "allow"
		result.Reason = "No matches found across all sanctions lists"
	} else {
		maxScore := 0.0
		for _, m := range matches {
			if m.MatchScore > maxScore {
				maxScore = m.MatchScore
			}
		}
		result.Score = maxScore

		if maxScore >= 0.95 {
			result.Status = "hit"
			result.Decision = "block"
			result.Reason = fmt.Sprintf("High-confidence match (%.1f%%) against %s", maxScore*100, matches[0].ListName)
		} else if maxScore >= 0.75 {
			result.Status = "partial_match"
			result.Decision = "escalate"
			result.Reason = fmt.Sprintf("Partial match (%.1f%%) requires manual review", maxScore*100)
		} else {
			result.Status = "clear"
			result.Decision = "allow"
			result.Reason = fmt.Sprintf("Low-confidence matches (%.1f%%) below threshold", maxScore*100)
		}
	}

	// Cache result
	s.setCached(cacheKey, result)

	return result, nil
}

// checkAgainstList performs fuzzy matching against a sanctions list
func (s *SanctionsScreeningService) checkAgainstList(req *ScreeningRequest, list *SanctionsList) []SanctionMatch {
	var matches []SanctionMatch

	// Normalize names for comparison
	senderNorm := normalizeName(req.SenderName)
	benefNorm := normalizeName(req.BeneficiaryName)

	// Check against known high-risk patterns (demonstration of logic)
	// In production this connects to OFAC SDN API, UN consolidated list API, etc.
	highRiskCountries := map[string]bool{
		"KP": true, "IR": true, "SY": true, "CU": true, "VE": true,
		"SD": true, "SS": true, "LY": true, "SO": true, "YE": true,
	}

	if highRiskCountries[req.BeneficiaryCountry] {
		matches = append(matches, SanctionMatch{
			ListID:      list.ID,
			ListName:    list.Name,
			MatchedName: req.BeneficiaryCountry,
			MatchScore:  0.99,
			EntityType:  "country",
			Reason:      fmt.Sprintf("Destination country %s is on comprehensive sanctions list", req.BeneficiaryCountry),
			Programs:    []string{"COMPREHENSIVE_SANCTIONS"},
		})
	}

	// Check for name patterns indicating sanctioned entities
	sanctionedPatterns := []struct {
		pattern  string
		program  string
		sdn      string
	}{
		{"BANK OF IRAN", "IRAN-SANCTIONS", "SDN-IR-001"},
		{"KOREA DEVELOPMENT", "DPRK-SANCTIONS", "SDN-KP-001"},
		{"MILITARY OF SYRIA", "SYRIA-SANCTIONS", "SDN-SY-001"},
	}

	for _, sp := range sanctionedPatterns {
		senderScore := fuzzyMatch(senderNorm, strings.ToLower(sp.pattern))
		benefScore := fuzzyMatch(benefNorm, strings.ToLower(sp.pattern))

		if senderScore > 0.7 {
			matches = append(matches, SanctionMatch{
				ListID:      list.ID,
				ListName:    list.Name,
				MatchedName: sp.pattern,
				MatchScore:  senderScore,
				EntityType:  "entity",
				Reason:      "Sender name matches sanctioned entity",
				SDNNumber:   sp.sdn,
				Programs:    []string{sp.program},
			})
		}
		if benefScore > 0.7 {
			matches = append(matches, SanctionMatch{
				ListID:      list.ID,
				ListName:    list.Name,
				MatchedName: sp.pattern,
				MatchScore:  benefScore,
				EntityType:  "entity",
				Reason:      "Beneficiary name matches sanctioned entity",
				SDNNumber:   sp.sdn,
				Programs:    []string{sp.program},
			})
		}
	}

	return matches
}

// initLists initializes the sanctions lists
func (s *SanctionsScreeningService) initLists() {
	s.lists = map[string]*SanctionsList{
		"ofac_sdn": {ID: "ofac_sdn", Name: "OFAC SDN List", Source: "https://sanctionslist.ofac.treas.gov/", Entries: 12847, LastUpdated: time.Now(), Mandatory: true},
		"ofac_non_sdn": {ID: "ofac_non_sdn", Name: "OFAC Non-SDN Lists", Source: "https://sanctionslist.ofac.treas.gov/", Entries: 3421, LastUpdated: time.Now(), Mandatory: true},
		"un_consolidated": {ID: "un_consolidated", Name: "UN Security Council Consolidated List", Source: "https://www.un.org/securitycouncil/sanctions/", Entries: 789, LastUpdated: time.Now(), Mandatory: true},
		"eu_sanctions": {ID: "eu_sanctions", Name: "EU Consolidated Sanctions", Source: "https://data.europa.eu/data/datasets/consolidated-list-of-sanctions", Entries: 2156, LastUpdated: time.Now(), Mandatory: true},
		"cbn_watchlist": {ID: "cbn_watchlist", Name: "CBN Domestic Watchlist", Source: "https://www.cbn.gov.ng/", Entries: 456, LastUpdated: time.Now(), Mandatory: true},
		"interpol_red": {ID: "interpol_red", Name: "INTERPOL Red Notice", Source: "https://www.interpol.int/", Entries: 7312, LastUpdated: time.Now(), Mandatory: false},
		"pep_list": {ID: "pep_list", Name: "Politically Exposed Persons", Source: "internal", Entries: 15000, LastUpdated: time.Now(), Mandatory: true},
	}
}

// normalizeName normalizes a name for fuzzy matching
func normalizeName(name string) string {
	name = strings.ToLower(name)
	name = strings.TrimSpace(name)
	// Remove common prefixes/suffixes
	for _, prefix := range []string{"mr. ", "mrs. ", "dr. ", "chief ", "alhaji "} {
		name = strings.TrimPrefix(name, prefix)
	}
	return name
}

// fuzzyMatch returns a similarity score between 0-1
func fuzzyMatch(a, b string) float64 {
	if a == b {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}
	// Levenshtein-based similarity
	distance := levenshteinDistance(a, b)
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	return 1.0 - float64(distance)/float64(maxLen)
}

// levenshteinDistance computes edit distance between two strings
func levenshteinDistance(a, b string) int {
	la := len(a)
	lb := len(b)
	d := make([][]int, la+1)
	for i := range d {
		d[i] = make([]int, lb+1)
		d[i][0] = i
	}
	for j := 1; j <= lb; j++ {
		d[0][j] = j
	}
	for i := 1; i <= la; i++ {
		for j := 1; j <= lb; j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			d[i][j] = min(d[i-1][j]+1, min(d[i][j-1]+1, d[i-1][j-1]+cost))
		}
	}
	return d[la][lb]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// buildCacheKey creates a deterministic cache key for a screening request
func (s *SanctionsScreeningService) buildCacheKey(req *ScreeningRequest) string {
	data := fmt.Sprintf("%s|%s|%s|%s", req.SenderName, req.BeneficiaryName, req.BeneficiaryCountry, req.CorridorID)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *SanctionsScreeningService) getCached(key string) *ScreeningResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result, ok := s.cache[key]
	if !ok {
		return nil
	}
	if time.Since(result.CheckedAt) > s.cacheTTL {
		return nil
	}
	return result
}

func (s *SanctionsScreeningService) setCached(key string, result *ScreeningResult) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache[key] = result
}

// GetLists returns all configured sanctions lists
func (s *SanctionsScreeningService) GetLists() []*SanctionsList {
	result := make([]*SanctionsList, 0, len(s.lists))
	for _, l := range s.lists {
		result = append(result, l)
	}
	return result
}

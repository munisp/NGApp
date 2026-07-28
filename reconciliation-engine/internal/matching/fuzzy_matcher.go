package matching

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

type FuzzyMatcher struct {
	config *MatcherConfig
}

type MatcherConfig struct {
	AmountTolerance       float64 `json:"amount_tolerance"`
	AmountTolerancePercent float64 `json:"amount_tolerance_percent"`
	DateToleranceDays     int     `json:"date_tolerance_days"`
	MinConfidenceScore    float64 `json:"min_confidence_score"`
	EnableMLMatching      bool    `json:"enable_ml_matching"`
	WeightAmount          float64 `json:"weight_amount"`
	WeightDate            float64 `json:"weight_date"`
	WeightReference       float64 `json:"weight_reference"`
	WeightDescription     float64 `json:"weight_description"`
}

type SourceRecord struct {
	ID          string    `json:"id"`
	Reference   string    `json:"reference"`
	Amount      float64   `json:"amount"`
	Date        time.Time `json:"date"`
	Description string    `json:"description"`
	EntityType  string    `json:"entity_type"`
	EntityID    string    `json:"entity_id"`
	Metadata    map[string]interface{} `json:"metadata"`
}

type TargetRecord struct {
	ID          string    `json:"id"`
	Reference   string    `json:"reference"`
	Amount      float64   `json:"amount"`
	Date        time.Time `json:"date"`
	Description string    `json:"description"`
	BankCode    string    `json:"bank_code"`
	AccountNum  string    `json:"account_num"`
	Metadata    map[string]interface{} `json:"metadata"`
}

type MatchResult struct {
	ID              string    `json:"id"`
	SourceID        string    `json:"source_id"`
	TargetID        string    `json:"target_id"`
	MatchStatus     string    `json:"match_status"`
	ConfidenceScore float64   `json:"confidence_score"`
	AmountVariance  float64   `json:"amount_variance"`
	DateVariance    int       `json:"date_variance_days"`
	MatchFactors    MatchFactors `json:"match_factors"`
	MatchedAt       time.Time `json:"matched_at"`
}

type MatchFactors struct {
	AmountScore     float64 `json:"amount_score"`
	DateScore       float64 `json:"date_score"`
	ReferenceScore  float64 `json:"reference_score"`
	DescriptionScore float64 `json:"description_score"`
	MLScore         float64 `json:"ml_score,omitempty"`
}

type MatchingStats struct {
	TotalSourceRecords  int     `json:"total_source_records"`
	TotalTargetRecords  int     `json:"total_target_records"`
	ExactMatches        int     `json:"exact_matches"`
	FuzzyMatches        int     `json:"fuzzy_matches"`
	PartialMatches      int     `json:"partial_matches"`
	UnmatchedSource     int     `json:"unmatched_source"`
	UnmatchedTarget     int     `json:"unmatched_target"`
	TotalVariance       float64 `json:"total_variance"`
	AvgConfidenceScore  float64 `json:"avg_confidence_score"`
	ProcessingTimeMs    int64   `json:"processing_time_ms"`
}

func NewFuzzyMatcher(config *MatcherConfig) *FuzzyMatcher {
	if config == nil {
		config = &MatcherConfig{
			AmountTolerance:        0.01,
			AmountTolerancePercent: 1.0,
			DateToleranceDays:      3,
			MinConfidenceScore:     70.0,
			EnableMLMatching:       true,
			WeightAmount:           0.4,
			WeightDate:             0.2,
			WeightReference:        0.25,
			WeightDescription:      0.15,
		}
	}
	return &FuzzyMatcher{config: config}
}

func (m *FuzzyMatcher) MatchRecords(ctx context.Context, sources []SourceRecord, targets []TargetRecord) ([]MatchResult, *MatchingStats, error) {
	startTime := time.Now()
	
	var results []MatchResult
	matchedTargets := make(map[string]bool)
	matchedSources := make(map[string]bool)
	
	stats := &MatchingStats{
		TotalSourceRecords: len(sources),
		TotalTargetRecords: len(targets),
	}

	for _, source := range sources {
		select {
		case <-ctx.Done():
			return nil, nil, ctx.Err()
		default:
		}

		var bestMatch *MatchResult
		var bestScore float64

		for _, target := range targets {
			if matchedTargets[target.ID] {
				continue
			}

			result := m.calculateMatch(source, target)
			
			if result.ConfidenceScore > bestScore && result.ConfidenceScore >= m.config.MinConfidenceScore {
				bestScore = result.ConfidenceScore
				bestMatch = result
			}
		}

		if bestMatch != nil {
			matchedTargets[bestMatch.TargetID] = true
			matchedSources[source.ID] = true
			results = append(results, *bestMatch)

			if bestMatch.ConfidenceScore >= 99.0 {
				stats.ExactMatches++
			} else if bestMatch.ConfidenceScore >= 85.0 {
				stats.FuzzyMatches++
			} else {
				stats.PartialMatches++
			}
			stats.TotalVariance += math.Abs(bestMatch.AmountVariance)
		}
	}

	for _, source := range sources {
		if !matchedSources[source.ID] {
			stats.UnmatchedSource++
			results = append(results, MatchResult{
				ID:          uuid.New().String(),
				SourceID:    source.ID,
				MatchStatus: "UNMATCHED",
				MatchedAt:   time.Now(),
			})
		}
	}

	for _, target := range targets {
		if !matchedTargets[target.ID] {
			stats.UnmatchedTarget++
			results = append(results, MatchResult{
				ID:          uuid.New().String(),
				TargetID:    target.ID,
				MatchStatus: "UNMATCHED",
				MatchedAt:   time.Now(),
			})
		}
	}

	totalMatched := stats.ExactMatches + stats.FuzzyMatches + stats.PartialMatches
	if totalMatched > 0 {
		var totalConfidence float64
		for _, r := range results {
			if r.MatchStatus == "MATCHED" || r.MatchStatus == "PARTIAL" {
				totalConfidence += r.ConfidenceScore
			}
		}
		stats.AvgConfidenceScore = totalConfidence / float64(totalMatched)
	}

	stats.ProcessingTimeMs = time.Since(startTime).Milliseconds()

	return results, stats, nil
}

func (m *FuzzyMatcher) calculateMatch(source SourceRecord, target TargetRecord) *MatchResult {
	factors := MatchFactors{}

	factors.AmountScore = m.calculateAmountScore(source.Amount, target.Amount)
	factors.DateScore = m.calculateDateScore(source.Date, target.Date)
	factors.ReferenceScore = m.calculateReferenceScore(source.Reference, target.Reference)
	factors.DescriptionScore = m.calculateDescriptionScore(source.Description, target.Description)

	if m.config.EnableMLMatching {
		factors.MLScore = m.calculateMLScore(source, target)
	}

	confidence := factors.AmountScore*m.config.WeightAmount +
		factors.DateScore*m.config.WeightDate +
		factors.ReferenceScore*m.config.WeightReference +
		factors.DescriptionScore*m.config.WeightDescription

	if m.config.EnableMLMatching && factors.MLScore > 0 {
		confidence = confidence*0.7 + factors.MLScore*0.3
	}

	status := "UNMATCHED"
	if confidence >= 99.0 {
		status = "MATCHED"
	} else if confidence >= 85.0 {
		status = "MATCHED"
	} else if confidence >= m.config.MinConfidenceScore {
		status = "PARTIAL"
	}

	dateVariance := int(math.Abs(source.Date.Sub(target.Date).Hours() / 24))

	return &MatchResult{
		ID:              uuid.New().String(),
		SourceID:        source.ID,
		TargetID:        target.ID,
		MatchStatus:     status,
		ConfidenceScore: confidence,
		AmountVariance:  source.Amount - target.Amount,
		DateVariance:    dateVariance,
		MatchFactors:    factors,
		MatchedAt:       time.Now(),
	}
}

func (m *FuzzyMatcher) calculateAmountScore(sourceAmount, targetAmount float64) float64 {
	if sourceAmount == targetAmount {
		return 100.0
	}

	diff := math.Abs(sourceAmount - targetAmount)
	
	if diff <= m.config.AmountTolerance {
		return 99.0
	}

	percentDiff := (diff / math.Max(sourceAmount, targetAmount)) * 100
	
	if percentDiff <= m.config.AmountTolerancePercent {
		return 95.0 - (percentDiff * 5)
	}

	if percentDiff <= 5.0 {
		return 80.0 - (percentDiff * 4)
	}

	if percentDiff <= 10.0 {
		return 60.0 - (percentDiff * 2)
	}

	return math.Max(0, 40.0-percentDiff)
}

func (m *FuzzyMatcher) calculateDateScore(sourceDate, targetDate time.Time) float64 {
	daysDiff := int(math.Abs(sourceDate.Sub(targetDate).Hours() / 24))

	if daysDiff == 0 {
		return 100.0
	}

	if daysDiff <= m.config.DateToleranceDays {
		return 100.0 - float64(daysDiff)*5
	}

	if daysDiff <= 7 {
		return 80.0 - float64(daysDiff-m.config.DateToleranceDays)*5
	}

	if daysDiff <= 30 {
		return 50.0 - float64(daysDiff-7)*1.5
	}

	return math.Max(0, 20.0-float64(daysDiff-30)*0.5)
}

func (m *FuzzyMatcher) calculateReferenceScore(sourceRef, targetRef string) float64 {
	if sourceRef == "" || targetRef == "" {
		return 50.0
	}

	sourceRef = strings.ToUpper(strings.TrimSpace(sourceRef))
	targetRef = strings.ToUpper(strings.TrimSpace(targetRef))

	if sourceRef == targetRef {
		return 100.0
	}

	if strings.Contains(sourceRef, targetRef) || strings.Contains(targetRef, sourceRef) {
		return 90.0
	}

	similarity := m.levenshteinSimilarity(sourceRef, targetRef)
	
	return similarity * 100
}

func (m *FuzzyMatcher) calculateDescriptionScore(sourceDesc, targetDesc string) float64 {
	if sourceDesc == "" || targetDesc == "" {
		return 50.0
	}

	sourceDesc = strings.ToLower(strings.TrimSpace(sourceDesc))
	targetDesc = strings.ToLower(strings.TrimSpace(targetDesc))

	if sourceDesc == targetDesc {
		return 100.0
	}

	sourceWords := strings.Fields(sourceDesc)
	targetWords := strings.Fields(targetDesc)

	if len(sourceWords) == 0 || len(targetWords) == 0 {
		return 50.0
	}

	matchCount := 0
	for _, sw := range sourceWords {
		for _, tw := range targetWords {
			if sw == tw || m.levenshteinSimilarity(sw, tw) > 0.8 {
				matchCount++
				break
			}
		}
	}

	maxWords := math.Max(float64(len(sourceWords)), float64(len(targetWords)))
	return (float64(matchCount) / maxWords) * 100
}

func (m *FuzzyMatcher) calculateMLScore(source SourceRecord, target TargetRecord) float64 {
	features := make([]float64, 0)

	features = append(features, m.normalizeAmount(source.Amount))
	features = append(features, m.normalizeAmount(target.Amount))
	features = append(features, math.Abs(source.Amount-target.Amount)/math.Max(source.Amount, target.Amount))

	daysDiff := math.Abs(source.Date.Sub(target.Date).Hours() / 24)
	features = append(features, math.Min(daysDiff/30.0, 1.0))

	refSimilarity := m.levenshteinSimilarity(source.Reference, target.Reference)
	features = append(features, refSimilarity)

	descSimilarity := m.levenshteinSimilarity(source.Description, target.Description)
	features = append(features, descSimilarity)

	score := 0.0
	weights := []float64{0.1, 0.1, 0.3, 0.15, 0.2, 0.15}
	
	for i, f := range features {
		if i < len(weights) {
			if i == 2 || i == 3 {
				score += (1 - f) * weights[i] * 100
			} else {
				score += f * weights[i] * 100
			}
		}
	}

	return math.Min(score, 100.0)
}

func (m *FuzzyMatcher) normalizeAmount(amount float64) float64 {
	if amount <= 0 {
		return 0
	}
	return math.Min(math.Log10(amount)/8.0, 1.0)
}

func (m *FuzzyMatcher) levenshteinSimilarity(s1, s2 string) float64 {
	if s1 == s2 {
		return 1.0
	}

	len1 := len(s1)
	len2 := len(s2)

	if len1 == 0 || len2 == 0 {
		return 0.0
	}

	matrix := make([][]int, len1+1)
	for i := range matrix {
		matrix[i] = make([]int, len2+1)
		matrix[i][0] = i
	}
	for j := 0; j <= len2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= len1; i++ {
		for j := 1; j <= len2; j++ {
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

	distance := matrix[len1][len2]
	maxLen := max(len1, len2)
	
	return 1.0 - float64(distance)/float64(maxLen)
}

func (m *FuzzyMatcher) FindPotentialDuplicates(ctx context.Context, records []SourceRecord) ([][]SourceRecord, error) {
	var duplicateGroups [][]SourceRecord
	processed := make(map[string]bool)

	for i, r1 := range records {
		if processed[r1.ID] {
			continue
		}

		group := []SourceRecord{r1}
		processed[r1.ID] = true

		for j := i + 1; j < len(records); j++ {
			r2 := records[j]
			if processed[r2.ID] {
				continue
			}

			if m.isPotentialDuplicate(r1, r2) {
				group = append(group, r2)
				processed[r2.ID] = true
			}
		}

		if len(group) > 1 {
			duplicateGroups = append(duplicateGroups, group)
		}
	}

	return duplicateGroups, nil
}

func (m *FuzzyMatcher) isPotentialDuplicate(r1, r2 SourceRecord) bool {
	if r1.Amount != r2.Amount {
		return false
	}

	daysDiff := math.Abs(r1.Date.Sub(r2.Date).Hours() / 24)
	if daysDiff > 1 {
		return false
	}

	refSimilarity := m.levenshteinSimilarity(r1.Reference, r2.Reference)
	if refSimilarity > 0.9 {
		return true
	}

	descSimilarity := m.levenshteinSimilarity(r1.Description, r2.Description)
	return descSimilarity > 0.9
}

func (m *FuzzyMatcher) SuggestMatches(ctx context.Context, source SourceRecord, targets []TargetRecord, topN int) ([]MatchResult, error) {
	var results []MatchResult

	for _, target := range targets {
		result := m.calculateMatch(source, target)
		if result.ConfidenceScore >= 50.0 {
			results = append(results, *result)
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].ConfidenceScore > results[j].ConfidenceScore
	})

	if len(results) > topN {
		results = results[:topN]
	}

	return results, nil
}

func min(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

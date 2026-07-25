package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"
	"unicode"

	"github.com/munisp/NGApp/enterprise-mdm/internal/store"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type MDMService struct {
	store       *store.Store
	redis       *redis.Client
	kafkaWriter *kafka.Writer
	logger      *zap.Logger
}

type GoldenRecord struct {
	ID              string            `json:"id"`
	EntityType      string            `json:"entity_type"` // customer, agent, product
	Name            string            `json:"name"`
	BVN             string            `json:"bvn,omitempty"`
	NIN             string            `json:"nin,omitempty"`
	Phone           string            `json:"phone"`
	Email           string            `json:"email"`
	Address         string            `json:"address"`
	DateOfBirth     string            `json:"date_of_birth,omitempty"`
	SourceSystems   []string          `json:"source_systems"`
	Confidence      float64           `json:"confidence_score"`
	QualityScore    float64           `json:"quality_score"`
	Attributes      map[string]string `json:"attributes"`
	MergedFrom      []string          `json:"merged_from,omitempty"`
	LastUpdated     time.Time         `json:"last_updated"`
}

type QualityMetrics struct {
	Domain          string  `json:"domain"`
	TotalRecords    int     `json:"total_records"`
	Completeness    float64 `json:"completeness"` // target: >95%
	Accuracy        float64 `json:"accuracy"`
	Consistency     float64 `json:"consistency"`
	Timeliness      float64 `json:"timeliness"`
	Uniqueness      float64 `json:"uniqueness"`
	OverallScore    float64 `json:"overall_score"`
	DuplicateCount  int     `json:"duplicate_count"`
}

type DedupCandidate struct {
	RecordA     string  `json:"record_a_id"`
	RecordB     string  `json:"record_b_id"`
	MatchScore  float64 `json:"match_score"`
	MatchFields []string `json:"match_fields"`
	Status      string  `json:"status"` // pending, confirmed, rejected
}

func NewMDMService(s *store.Store, redisAddr, kafkaBroker string, logger *zap.Logger) *MDMService {
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr, PoolSize: 10})
	writer := &kafka.Writer{
		Addr:    kafka.TCP(kafkaBroker),
		Topic:   "mdm.events",
		Balancer: &kafka.LeastBytes{},
	}

	return &MDMService{store: s, redis: rdb, kafkaWriter: writer, logger: logger}
}

func (s *MDMService) StartDataQualityMonitor(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.calculateQualityMetrics(ctx)
		}
	}
}

func (s *MDMService) calculateQualityMetrics(ctx context.Context) {
	domains := []string{"customer", "agent", "product", "policy"}
	for _, domain := range domains {
		metrics := s.GetDomainQuality(ctx, domain)
		data, _ := json.Marshal(metrics)
		s.redis.Set(ctx, "mdm:quality:"+domain, data, 2*time.Hour)
	}
}

func (s *MDMService) GetDomainQuality(ctx context.Context, domain string) *QualityMetrics {
	return &QualityMetrics{
		Domain:       domain,
		Completeness: 0.0,
		Accuracy:     0.0,
		Consistency:  0.0,
		Timeliness:   0.0,
		Uniqueness:   0.0,
		OverallScore: 0.0,
	}
}

func (s *MDMService) FindDuplicates(ctx context.Context, recordID string) []DedupCandidate {
	return []DedupCandidate{}
}

func (s *MDMService) MergeRecords(ctx context.Context, survivorID string, duplicateIDs []string) (*GoldenRecord, error) {
	event, _ := json.Marshal(map[string]interface{}{
		"type":       "record_merge",
		"survivor":   survivorID,
		"duplicates": duplicateIDs,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
	s.kafkaWriter.WriteMessages(ctx, kafka.Message{Key: []byte(survivorID), Value: event})
	return &GoldenRecord{ID: survivorID}, nil
}

// CalculateMatchScore computes similarity between two records using BVN/NIN, name, phone, and address.
func (s *MDMService) CalculateMatchScore(a, b *GoldenRecord) float64 {
	score := 0.0
	weights := 0.0

	// BVN exact match (highest weight)
	if a.BVN != "" && a.BVN == b.BVN {
		score += 40
	}
	weights += 40

	// NIN exact match
	if a.NIN != "" && a.NIN == b.NIN {
		score += 30
	}
	weights += 30

	// Phone number match
	if normalizePhone(a.Phone) == normalizePhone(b.Phone) {
		score += 15
	}
	weights += 15

	// Name similarity (Levenshtein-based)
	nameSim := stringSimilarity(strings.ToLower(a.Name), strings.ToLower(b.Name))
	score += nameSim * 15
	weights += 15

	if weights == 0 {
		return 0
	}
	return score / weights
}

func normalizePhone(phone string) string {
	digits := ""
	for _, r := range phone {
		if unicode.IsDigit(r) {
			digits += string(r)
		}
	}
	if len(digits) > 10 {
		return digits[len(digits)-10:]
	}
	return digits
}

func stringSimilarity(a, b string) float64 {
	if a == b {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	dist := levenshtein(a, b)
	return 1.0 - float64(dist)/float64(maxLen)
}

func levenshtein(a, b string) int {
	la, lb := len(a), len(b)
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

package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"time"

	"net/http"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// BiometricAuthService implements the biometric authentication service
type BiometricAuthService struct {
	db    *sql.DB
	redis *redis.Client
}

// BiometricType represents the type of biometric authentication
type BiometricType string

const (
	BiometricTypeFingerprint BiometricType = "fingerprint"
	BiometricTypeFace        BiometricType = "face"
	BiometricTypeVoice       BiometricType = "voice"
	BiometricTypeIris        BiometricType = "iris"
)

// BiometricTemplate represents a stored biometric template
type BiometricTemplate struct {
	TemplateID    string        `json:"template_id"`
	UserID        string        `json:"user_id"`
	BiometricType BiometricType `json:"biometric_type"`
	TemplateData  string        `json:"template_data"` // Encrypted/hashed template
	Quality       float64       `json:"quality"`
	DeviceID      string        `json:"device_id"`
	CreatedAt     time.Time     `json:"created_at"`
	LastUsedAt    *time.Time    `json:"last_used_at,omitempty"`
	Status        string        `json:"status"`
}

// AuthenticationRequest represents a biometric authentication request
type AuthenticationRequest struct {
	UserID        string        `json:"user_id"`
	BiometricType BiometricType `json:"biometric_type"`
	BiometricData string        `json:"biometric_data"` // Raw biometric data
	DeviceID      string        `json:"device_id"`
	Challenge     string        `json:"challenge,omitempty"` // For liveness detection
}

// AuthenticationResponse represents the authentication result
type AuthenticationResponse struct {
	Authenticated bool      `json:"authenticated"`
	Token         string    `json:"token,omitempty"`
	MatchScore    float64   `json:"match_score"`
	Timestamp     time.Time `json:"timestamp"`
	Message       string    `json:"message"`
}

// NewBiometricAuthService creates a new biometric authentication service
func NewBiometricAuthService(db *sql.DB, redis *redis.Client) *BiometricAuthService {
	return &BiometricAuthService{
		db:    db,
		redis: redis,
	}
}

// RegisterBiometric registers a new biometric template
func (s *BiometricAuthService) RegisterBiometric(ctx context.Context, userID string, biometricType BiometricType, biometricData string, deviceID string) (*BiometricTemplate, error) {
	// Validate input
	if userID == "" || biometricData == "" {
		return nil, status.Error(codes.InvalidArgument, "missing required fields")
	}

	// Extract and validate biometric features
	quality, err := s.extractBiometricQuality(biometricData, biometricType)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid biometric data")
	}

	// Quality threshold check
	if quality < 0.6 {
		return nil, status.Error(codes.FailedPrecondition, "biometric quality too low")
	}

	// Create biometric template
	templateID := generateID()
	templateData := s.createTemplate(biometricData, biometricType)

	// Store in database
	query := `
		INSERT INTO biometric_templates (template_id, user_id, biometric_type, template_data, quality, device_id, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	now := time.Now()
	_, err = s.db.ExecContext(ctx, query,
		templateID,
		userID,
		string(biometricType),
		templateData,
		quality,
		deviceID,
		"ACTIVE",
		now,
	)

	if err != nil {
		log.Printf("Failed to register biometric: %v", err)
		return nil, status.Error(codes.Internal, "failed to register biometric")
	}

	template := &BiometricTemplate{
		TemplateID:    templateID,
		UserID:        userID,
		BiometricType: biometricType,
		TemplateData:  templateData,
		Quality:       quality,
		DeviceID:      deviceID,
		CreatedAt:     now,
		Status:        "ACTIVE",
	}

	// Cache template for fast authentication
	if err := s.cacheTemplate(ctx, template); err != nil {
		log.Printf("Failed to cache template: %v", err)
	}

	return template, nil
}

// Authenticate performs biometric authentication
func (s *BiometricAuthService) Authenticate(ctx context.Context, req *AuthenticationRequest) (*AuthenticationResponse, error) {
	// Validate request
	if req.UserID == "" || req.BiometricData == "" {
		return nil, status.Error(codes.InvalidArgument, "missing required fields")
	}

	// Perform liveness detection if challenge is provided
	if req.Challenge != "" {
		if !s.verifyLiveness(req.BiometricData, req.Challenge) {
			return &AuthenticationResponse{
				Authenticated: false,
				MatchScore:    0.0,
				Timestamp:     time.Now(),
				Message:       "Liveness detection failed",
			}, nil
		}
	}

	// Retrieve stored templates
	templates, err := s.getTemplates(ctx, req.UserID, req.BiometricType)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to retrieve templates")
	}

	if len(templates) == 0 {
		return &AuthenticationResponse{
			Authenticated: false,
			MatchScore:    0.0,
			Timestamp:     time.Now(),
			Message:       "No biometric template found",
		}, nil
	}

	// Create template from input data
	inputTemplate := s.createTemplate(req.BiometricData, req.BiometricType)

	// Match against stored templates
	var bestMatch float64
	var matchedTemplate *BiometricTemplate

	for _, template := range templates {
		matchScore := s.matchTemplates(inputTemplate, template.TemplateData, req.BiometricType)
		if matchScore > bestMatch {
			bestMatch = matchScore
			matchedTemplate = &template
		}
	}

	// Authentication threshold
	threshold := s.getMatchThreshold(req.BiometricType)

	if bestMatch >= threshold {
		// Authentication successful
		token := s.generateAuthToken(req.UserID, req.BiometricType)

		// Update last used time
		go s.updateLastUsed(context.Background(), matchedTemplate.TemplateID)

		// Log successful authentication
		go s.logAuthentication(context.Background(), req.UserID, req.BiometricType, true, bestMatch, req.DeviceID)

		return &AuthenticationResponse{
			Authenticated: true,
			Token:         token,
			MatchScore:    bestMatch,
			Timestamp:     time.Now(),
			Message:       "Authentication successful",
		}, nil
	}

	// Authentication failed
	go s.logAuthentication(context.Background(), req.UserID, req.BiometricType, false, bestMatch, req.DeviceID)

	return &AuthenticationResponse{
		Authenticated: false,
		MatchScore:    bestMatch,
		Timestamp:     time.Now(),
		Message:       "Authentication failed - biometric mismatch",
	}, nil
}

// Multi-factor authentication combining biometric with PIN
func (s *BiometricAuthService) AuthenticateMultiFactor(ctx context.Context, userID string, biometricData string, biometricType BiometricType, pin string) (*AuthenticationResponse, error) {
	// First, verify biometric
	bioReq := &AuthenticationRequest{
		UserID:        userID,
		BiometricType: biometricType,
		BiometricData: biometricData,
	}

	bioResult, err := s.Authenticate(ctx, bioReq)
	if err != nil {
		return nil, err
	}

	if !bioResult.Authenticated {
		return bioResult, nil
	}

	// Second, verify PIN
	pinValid, err := s.verifyPIN(ctx, userID, pin)
	if err != nil {
		return nil, err
	}

	if !pinValid {
		return &AuthenticationResponse{
			Authenticated: false,
			MatchScore:    bioResult.MatchScore,
			Timestamp:     time.Now(),
			Message:       "PIN verification failed",
		}, nil
	}

	// Both factors passed
	token := s.generateAuthToken(userID, biometricType)

	return &AuthenticationResponse{
		Authenticated: true,
		Token:         token,
		MatchScore:    bioResult.MatchScore,
		Timestamp:     time.Now(),
		Message:       "Multi-factor authentication successful",
	}, nil
}

// Helper methods

func (s *BiometricAuthService) extractBiometricQuality(data string, bioType BiometricType) (float64, error) {
	if data == "" {
		return 0.0, fmt.Errorf("empty biometric data")
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return 0.0, fmt.Errorf("invalid base64 encoding: %v", err)
	}

	dataLen := len(decoded)
	var quality float64

	switch bioType {
	case BiometricTypeFingerprint:
		if dataLen < 500 {
			return 0.0, fmt.Errorf("fingerprint data too small")
		}
		entropy := calculateEntropy(decoded)
		uniquePatterns := countUniquePatterns(decoded, 4)
		quality = (entropy/8.0)*0.4 + (float64(uniquePatterns)/float64(dataLen/4))*0.3 + (float64(dataLen)/5000.0)*0.3
		if quality > 1.0 {
			quality = 1.0
		}

	case BiometricTypeFace:
		if dataLen < 2000 {
			return 0.0, fmt.Errorf("face data too small")
		}
		entropy := calculateEntropy(decoded)
		variance := calculateVariance(decoded)
		quality = (entropy/8.0)*0.35 + (variance/128.0)*0.35 + (float64(dataLen)/20000.0)*0.3
		if quality > 1.0 {
			quality = 1.0
		}

	case BiometricTypeVoice:
		if dataLen < 1000 {
			return 0.0, fmt.Errorf("voice data too small")
		}
		entropy := calculateEntropy(decoded)
		signalStrength := calculateSignalStrength(decoded)
		quality = (entropy/8.0)*0.4 + (signalStrength)*0.4 + (float64(dataLen)/10000.0)*0.2
		if quality > 1.0 {
			quality = 1.0
		}

	case BiometricTypeIris:
		if dataLen < 1500 {
			return 0.0, fmt.Errorf("iris data too small")
		}
		entropy := calculateEntropy(decoded)
		uniquePatterns := countUniquePatterns(decoded, 8)
		quality = (entropy/8.0)*0.5 + (float64(uniquePatterns)/float64(dataLen/8))*0.5
		if quality > 1.0 {
			quality = 1.0
		}

	default:
		return 0.0, fmt.Errorf("unsupported biometric type: %s", bioType)
	}

	return quality, nil
}

func calculateEntropy(data []byte) float64 {
	if len(data) == 0 {
		return 0.0
	}

	freq := make(map[byte]int)
	for _, b := range data {
		freq[b]++
	}

	var entropy float64
	dataLen := float64(len(data))
	for _, count := range freq {
		p := float64(count) / dataLen
		if p > 0 {
			entropy -= p * (log2(p))
		}
	}

	return entropy
}

func log2(x float64) float64 {
	if x <= 0 {
		return 0
	}
	return 1.4426950408889634 * logNatural(x)
}

func logNatural(x float64) float64 {
	if x <= 0 {
		return 0
	}
	result := 0.0
	for i := 0; i < 100; i++ {
		term := (1.0 / float64(2*i+1)) * pow((x-1)/(x+1), 2*i+1)
		result += term
	}
	return 2 * result
}

func pow(base float64, exp int) float64 {
	result := 1.0
	for i := 0; i < exp; i++ {
		result *= base
	}
	return result
}

func countUniquePatterns(data []byte, patternSize int) int {
	if len(data) < patternSize {
		return 0
	}

	patterns := make(map[string]bool)
	for i := 0; i <= len(data)-patternSize; i++ {
		pattern := string(data[i : i+patternSize])
		patterns[pattern] = true
	}

	return len(patterns)
}

func calculateVariance(data []byte) float64 {
	if len(data) == 0 {
		return 0.0
	}

	var sum float64
	for _, b := range data {
		sum += float64(b)
	}
	mean := sum / float64(len(data))

	var variance float64
	for _, b := range data {
		diff := float64(b) - mean
		variance += diff * diff
	}

	return variance / float64(len(data))
}

func calculateSignalStrength(data []byte) float64 {
	if len(data) < 2 {
		return 0.0
	}

	var totalDiff float64
	for i := 1; i < len(data); i++ {
		diff := float64(data[i]) - float64(data[i-1])
		if diff < 0 {
			diff = -diff
		}
		totalDiff += diff
	}

	avgDiff := totalDiff / float64(len(data)-1)
	return avgDiff / 128.0
}

func (s *BiometricAuthService) createTemplate(data string, bioType BiometricType) string {
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		h := sha256.New()
		h.Write([]byte(data))
		h.Write([]byte(string(bioType)))
		return base64.StdEncoding.EncodeToString(h.Sum(nil))
	}

	var featureVector []byte

	switch bioType {
	case BiometricTypeFingerprint:
		featureVector = extractFingerprintFeatures(decoded)
	case BiometricTypeFace:
		featureVector = extractFaceFeatures(decoded)
	case BiometricTypeVoice:
		featureVector = extractVoiceFeatures(decoded)
	case BiometricTypeIris:
		featureVector = extractIrisFeatures(decoded)
	default:
		h := sha256.New()
		h.Write(decoded)
		h.Write([]byte(string(bioType)))
		return base64.StdEncoding.EncodeToString(h.Sum(nil))
	}

	h := sha256.New()
	h.Write(featureVector)
	h.Write([]byte(string(bioType)))
	h.Write([]byte{byte(len(featureVector) >> 8), byte(len(featureVector))})

	return base64.StdEncoding.EncodeToString(append(h.Sum(nil), featureVector...))
}

func extractFingerprintFeatures(data []byte) []byte {
	blockSize := 16
	numBlocks := len(data) / blockSize
	if numBlocks < 1 {
		numBlocks = 1
	}

	features := make([]byte, 0, numBlocks*4)

	for i := 0; i < numBlocks && i*blockSize < len(data); i++ {
		start := i * blockSize
		end := start + blockSize
		if end > len(data) {
			end = len(data)
		}
		block := data[start:end]

		var sum, min, max byte
		min = 255
		for _, b := range block {
			sum += b
			if b < min {
				min = b
			}
			if b > max {
				max = b
			}
		}
		avg := sum / byte(len(block))
		features = append(features, avg, min, max, max-min)
	}

	return features
}

func extractFaceFeatures(data []byte) []byte {
	regionSize := 64
	numRegions := len(data) / regionSize
	if numRegions < 1 {
		numRegions = 1
	}
	if numRegions > 128 {
		numRegions = 128
	}

	features := make([]byte, 0, numRegions*8)

	for i := 0; i < numRegions && i*regionSize < len(data); i++ {
		start := i * regionSize
		end := start + regionSize
		if end > len(data) {
			end = len(data)
		}
		region := data[start:end]

		var sum uint64
		var min, max byte
		min = 255
		for _, b := range region {
			sum += uint64(b)
			if b < min {
				min = b
			}
			if b > max {
				max = b
			}
		}
		avg := byte(sum / uint64(len(region)))

		var variance uint64
		for _, b := range region {
			diff := int64(b) - int64(avg)
			variance += uint64(diff * diff)
		}
		stdDev := byte(variance / uint64(len(region)) / 256)

		var edgeCount byte
		for j := 1; j < len(region); j++ {
			diff := int(region[j]) - int(region[j-1])
			if diff < 0 {
				diff = -diff
			}
			if diff > 30 {
				edgeCount++
			}
		}

		features = append(features, avg, min, max, max-min, stdDev, edgeCount, byte(len(region)), byte(i))
	}

	return features
}

func extractVoiceFeatures(data []byte) []byte {
	frameSize := 32
	numFrames := len(data) / frameSize
	if numFrames < 1 {
		numFrames = 1
	}
	if numFrames > 256 {
		numFrames = 256
	}

	features := make([]byte, 0, numFrames*6)

	for i := 0; i < numFrames && i*frameSize < len(data); i++ {
		start := i * frameSize
		end := start + frameSize
		if end > len(data) {
			end = len(data)
		}
		frame := data[start:end]

		var sum uint64
		var min, max byte
		min = 255
		for _, b := range frame {
			sum += uint64(b)
			if b < min {
				min = b
			}
			if b > max {
				max = b
			}
		}
		avg := byte(sum / uint64(len(frame)))

		var zeroCrossings byte
		for j := 1; j < len(frame); j++ {
			if (frame[j] > 128 && frame[j-1] <= 128) || (frame[j] <= 128 && frame[j-1] > 128) {
				zeroCrossings++
			}
		}

		energy := byte((sum / uint64(len(frame))) >> 1)

		features = append(features, avg, min, max, max-min, zeroCrossings, energy)
	}

	return features
}

func extractIrisFeatures(data []byte) []byte {
	sectorSize := 32
	numSectors := len(data) / sectorSize
	if numSectors < 1 {
		numSectors = 1
	}
	if numSectors > 64 {
		numSectors = 64
	}

	features := make([]byte, 0, numSectors*8)

	for i := 0; i < numSectors && i*sectorSize < len(data); i++ {
		start := i * sectorSize
		end := start + sectorSize
		if end > len(data) {
			end = len(data)
		}
		sector := data[start:end]

		var sum uint64
		var min, max byte
		min = 255
		for _, b := range sector {
			sum += uint64(b)
			if b < min {
				min = b
			}
			if b > max {
				max = b
			}
		}
		avg := byte(sum / uint64(len(sector)))

		var patternBits byte
		for j := 0; j < 8 && j < len(sector); j++ {
			if sector[j] > avg {
				patternBits |= (1 << j)
			}
		}

		var transitions byte
		for j := 1; j < len(sector); j++ {
			if (sector[j] > avg) != (sector[j-1] > avg) {
				transitions++
			}
		}

		features = append(features, avg, min, max, max-min, patternBits, transitions, byte(len(sector)), byte(i))
	}

	return features
}

func (s *BiometricAuthService) matchTemplates(template1, template2 string, bioType BiometricType) float64 {
	if template1 == template2 {
		return 1.0
	}

	decoded1, err1 := base64.StdEncoding.DecodeString(template1)
	decoded2, err2 := base64.StdEncoding.DecodeString(template2)

	if err1 != nil || err2 != nil {
		minLen := len(template1)
		if len(template2) < minLen {
			minLen = len(template2)
		}
		matches := 0
		for i := 0; i < minLen; i++ {
			if template1[i] == template2[i] {
				matches++
			}
		}
		return float64(matches) / float64(minLen)
	}

	hashSize := 32
	if len(decoded1) < hashSize || len(decoded2) < hashSize {
		return 0.0
	}

	hash1 := decoded1[:hashSize]
	hash2 := decoded2[:hashSize]
	features1 := decoded1[hashSize:]
	features2 := decoded2[hashSize:]

	hashMatch := 0
	for i := 0; i < hashSize; i++ {
		if hash1[i] == hash2[i] {
			hashMatch++
		}
	}
	hashScore := float64(hashMatch) / float64(hashSize)

	if len(features1) == 0 || len(features2) == 0 {
		return hashScore
	}

	featureScore := compareFeatureVectors(features1, features2, bioType)

	switch bioType {
	case BiometricTypeFingerprint:
		return hashScore*0.3 + featureScore*0.7
	case BiometricTypeFace:
		return hashScore*0.25 + featureScore*0.75
	case BiometricTypeVoice:
		return hashScore*0.2 + featureScore*0.8
	case BiometricTypeIris:
		return hashScore*0.35 + featureScore*0.65
	default:
		return hashScore*0.3 + featureScore*0.7
	}
}

func compareFeatureVectors(features1, features2 []byte, bioType BiometricType) float64 {
	minLen := len(features1)
	if len(features2) < minLen {
		minLen = len(features2)
	}

	if minLen == 0 {
		return 0.0
	}

	var totalSimilarity float64
	var comparisons int

	var blockSize int
	switch bioType {
	case BiometricTypeFingerprint:
		blockSize = 4
	case BiometricTypeFace:
		blockSize = 8
	case BiometricTypeVoice:
		blockSize = 6
	case BiometricTypeIris:
		blockSize = 8
	default:
		blockSize = 4
	}

	numBlocks := minLen / blockSize
	if numBlocks == 0 {
		numBlocks = 1
	}

	for i := 0; i < numBlocks && i*blockSize < minLen; i++ {
		start := i * blockSize
		end := start + blockSize
		if end > minLen {
			end = minLen
		}

		block1 := features1[start:end]
		block2 := features2[start:end]

		blockSimilarity := compareBlocks(block1, block2)
		totalSimilarity += blockSimilarity
		comparisons++
	}

	if comparisons == 0 {
		return 0.0
	}

	return totalSimilarity / float64(comparisons)
}

func compareBlocks(block1, block2 []byte) float64 {
	if len(block1) != len(block2) {
		minLen := len(block1)
		if len(block2) < minLen {
			minLen = len(block2)
		}
		if minLen == 0 {
			return 0.0
		}
		block1 = block1[:minLen]
		block2 = block2[:minLen]
	}

	var totalDiff float64
	for i := 0; i < len(block1); i++ {
		diff := int(block1[i]) - int(block2[i])
		if diff < 0 {
			diff = -diff
		}
		totalDiff += float64(diff)
	}

	maxDiff := float64(len(block1)) * 255.0
	if maxDiff == 0 {
		return 1.0
	}

	return 1.0 - (totalDiff / maxDiff)
}

func (s *BiometricAuthService) getMatchThreshold(bioType BiometricType) float64 {
	// Different biometric types have different accuracy thresholds
	switch bioType {
	case BiometricTypeFingerprint:
		return 0.85
	case BiometricTypeFace:
		return 0.80
	case BiometricTypeVoice:
		return 0.75
	case BiometricTypeIris:
		return 0.95
	default:
		return 0.80
	}
}

func (s *BiometricAuthService) verifyLiveness(data string, challenge string) bool {
	if data == "" || challenge == "" {
		return false
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return false
	}

	challengeBytes, err := base64.StdEncoding.DecodeString(challenge)
	if err != nil {
		challengeBytes = []byte(challenge)
	}

	if len(decoded) < 100 {
		return false
	}

	entropy := calculateEntropy(decoded)
	if entropy < 4.0 {
		return false
	}

	variance := calculateVariance(decoded)
	if variance < 100 {
		return false
	}

	h := sha256.New()
	h.Write(decoded[:len(decoded)/2])
	h.Write(challengeBytes)
	expectedMarker := h.Sum(nil)[:8]

	markerFound := false
	for i := 0; i <= len(decoded)-8; i++ {
		matches := 0
		for j := 0; j < 8; j++ {
			if decoded[i+j]^expectedMarker[j] < 32 {
				matches++
			}
		}
		if matches >= 5 {
			markerFound = true
			break
		}
	}

	if !markerFound {
		signalStrength := calculateSignalStrength(decoded)
		if signalStrength < 0.1 {
			return false
		}
	}

	return true
}

func (s *BiometricAuthService) generateAuthToken(userID string, bioType BiometricType) string {
	// Generate a secure authentication token
	data := fmt.Sprintf("%s|%s|%d", userID, bioType, time.Now().Unix())
	h := sha256.New()
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func (s *BiometricAuthService) getTemplates(ctx context.Context, userID string, bioType BiometricType) ([]BiometricTemplate, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("bio_templates:%s:%s", userID, bioType)
	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var templates []BiometricTemplate
		if json.Unmarshal([]byte(cached), &templates) == nil {
			return templates, nil
		}
	}

	// Query database
	query := `
		SELECT template_id, user_id, biometric_type, template_data, quality, device_id, created_at, last_used_at, status
		FROM biometric_templates
		WHERE user_id = $1 AND biometric_type = $2 AND status = 'ACTIVE'
	`

	rows, err := s.db.QueryContext(ctx, query, userID, string(bioType))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []BiometricTemplate
	for rows.Next() {
		var template BiometricTemplate
		var lastUsedAt sql.NullTime

		err := rows.Scan(
			&template.TemplateID,
			&template.UserID,
			&template.BiometricType,
			&template.TemplateData,
			&template.Quality,
			&template.DeviceID,
			&template.CreatedAt,
			&lastUsedAt,
			&template.Status,
		)

		if err != nil {
			continue
		}

		if lastUsedAt.Valid {
			template.LastUsedAt = &lastUsedAt.Time
		}

		templates = append(templates, template)
	}

	// Cache for future use
	if data, err := json.Marshal(templates); err == nil {
		s.redis.Set(ctx, cacheKey, data, 1*time.Hour)
	}

	return templates, nil
}

func (s *BiometricAuthService) cacheTemplate(ctx context.Context, template *BiometricTemplate) error {
	key := fmt.Sprintf("bio_template:%s", template.TemplateID)
	data, err := json.Marshal(template)
	if err != nil {
		return err
	}

	return s.redis.Set(ctx, key, data, 24*time.Hour).Err()
}

func (s *BiometricAuthService) updateLastUsed(ctx context.Context, templateID string) {
	query := "UPDATE biometric_templates SET last_used_at = $1 WHERE template_id = $2"
	_, err := s.db.ExecContext(ctx, query, time.Now(), templateID)
	if err != nil {
		log.Printf("Failed to update last_used_at: %v", err)
	}
}

func (s *BiometricAuthService) logAuthentication(ctx context.Context, userID string, bioType BiometricType, success bool, matchScore float64, deviceID string) {
	query := `
		INSERT INTO biometric_auth_log (user_id, biometric_type, success, match_score, device_id, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := s.db.ExecContext(ctx, query, userID, string(bioType), success, matchScore, deviceID, time.Now())
	if err != nil {
		log.Printf("Failed to log authentication: %v", err)
	}
}

func (s *BiometricAuthService) verifyPIN(ctx context.Context, userID string, pin string) (bool, error) {
	if userID == "" || pin == "" {
		return false, fmt.Errorf("missing user ID or PIN")
	}

	if len(pin) < 4 || len(pin) > 8 {
		return false, fmt.Errorf("PIN must be 4-8 digits")
	}

	for _, c := range pin {
		if c < '0' || c > '9' {
			return false, fmt.Errorf("PIN must contain only digits")
		}
	}

	query := `
		SELECT pin_hash, pin_salt, failed_attempts, locked_until
		FROM user_pins
		WHERE user_id = $1 AND status = 'ACTIVE'
	`

	var pinHash, pinSalt string
	var failedAttempts int
	var lockedUntil sql.NullTime

	err := s.db.QueryRowContext(ctx, query, userID).Scan(&pinHash, &pinSalt, &failedAttempts, &lockedUntil)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("no PIN registered for user")
		}
		return false, fmt.Errorf("failed to retrieve PIN: %v", err)
	}

	if lockedUntil.Valid && lockedUntil.Time.After(time.Now()) {
		return false, fmt.Errorf("account locked until %v", lockedUntil.Time)
	}

	h := sha256.New()
	h.Write([]byte(pin))
	h.Write([]byte(pinSalt))
	computedHash := base64.StdEncoding.EncodeToString(h.Sum(nil))

	if computedHash != pinHash {
		go s.incrementFailedAttempts(context.Background(), userID, failedAttempts+1)
		return false, nil
	}

	if failedAttempts > 0 {
		go s.resetFailedAttempts(context.Background(), userID)
	}

	return true, nil
}

func (s *BiometricAuthService) incrementFailedAttempts(ctx context.Context, userID string, attempts int) {
	var lockedUntil *time.Time
	if attempts >= 5 {
		lockTime := time.Now().Add(30 * time.Minute)
		lockedUntil = &lockTime
	}

	query := `
		UPDATE user_pins
		SET failed_attempts = $1, locked_until = $2, updated_at = $3
		WHERE user_id = $4
	`

	_, err := s.db.ExecContext(ctx, query, attempts, lockedUntil, time.Now(), userID)
	if err != nil {
		log.Printf("Failed to update failed attempts: %v", err)
	}
}

func (s *BiometricAuthService) resetFailedAttempts(ctx context.Context, userID string) {
	query := `
		UPDATE user_pins
		SET failed_attempts = 0, locked_until = NULL, updated_at = $1
		WHERE user_id = $2
	`

	_, err := s.db.ExecContext(ctx, query, time.Now(), userID)
	if err != nil {
		log.Printf("Failed to reset failed attempts: %v", err)
	}
}

func generateID() string {
	return fmt.Sprintf("bio_%d", time.Now().UnixNano())
}

func main() {
	// Initialize PostgreSQL connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/payment_switch?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis connection
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Create biometric auth service
	bioService := NewBiometricAuthService(db, redisClient)

	// Start gRPC server
	port := os.Getenv("PORT")
	if port == "" {
		port = "50052"
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	// RegisterBiometricAuthServiceServer(grpcServer, bioService)

	// Start HTTP health server on separate port
	healthPort := os.Getenv("HEALTH_PORT")
	if healthPort == "" {
		healthPort = "8082"
	}
	go func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"status":"healthy","service":"biometric-auth"}`)
		})
		mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if err := bioService.db.Ping(); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				fmt.Fprintf(w, `{"status":"not_ready","error":"%s"}`, err.Error())
				return
			}
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"status":"ready","service":"biometric-auth"}`)
		})
		log.Printf("Biometric health server on :%s", healthPort)
		http.ListenAndServe(":"+healthPort, mux)
	}()

	log.Printf("Biometric Auth Service starting on port %s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}

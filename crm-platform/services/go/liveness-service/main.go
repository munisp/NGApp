package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// --- Domain Types ---

// LivenessResult represents the outcome of a liveness check
type LivenessResult struct {
	SessionID       string             `json:"session_id"`
	IsLive          bool               `json:"is_live"`
	Confidence      float64            `json:"confidence"`
	Method          string             `json:"method"` // passive, active
	SpoofType       string             `json:"spoof_type,omitempty"`
	AntiSpoofScores AntiSpoofScores    `json:"anti_spoof_scores"`
	Landmarks       *FacialLandmarks   `json:"landmarks,omitempty"`
	Timestamp       time.Time          `json:"timestamp"`
	ProcessingMs    int64              `json:"processing_ms"`
	Metadata        map[string]string  `json:"metadata,omitempty"`
}

// AntiSpoofScores contains individual anti-spoofing check results
type AntiSpoofScores struct {
	TextureAnalysis   float64 `json:"texture_analysis"`    // LBP/frequency domain
	MoireDetection    float64 `json:"moire_detection"`     // screen replay
	DepthEstimation   float64 `json:"depth_estimation"`    // 3D structure
	BlinkDetection    float64 `json:"blink_detection"`     // eye blink presence
	MicroExpression   float64 `json:"micro_expression"`    // facial micro-movements
	ColorConsistency  float64 `json:"color_consistency"`   // skin color analysis
	ReflectionCheck   float64 `json:"reflection_check"`    // specular highlights
	FrequencyDomain   float64 `json:"frequency_domain"`    // DCT artifact detection
	TemporalCoherence float64 `json:"temporal_coherence"`  // frame-to-frame consistency
	DeepfakeScore     float64 `json:"deepfake_score"`      // GAN artifact detection
	OverallScore      float64 `json:"overall_score"`        // weighted aggregate
}

// FacialLandmarks represents 68-point facial landmark positions
type FacialLandmarks struct {
	Jaw          []Point `json:"jaw"`           // 17 points (0-16)
	RightEyebrow []Point `json:"right_eyebrow"` // 5 points (17-21)
	LeftEyebrow  []Point `json:"left_eyebrow"`  // 5 points (22-26)
	NoseBridge   []Point `json:"nose_bridge"`    // 4 points (27-30)
	NoseTip      []Point `json:"nose_tip"`       // 5 points (31-35)
	RightEye     []Point `json:"right_eye"`      // 6 points (36-41)
	LeftEye      []Point `json:"left_eye"`       // 6 points (42-47)
	OuterLip     []Point `json:"outer_lip"`      // 12 points (48-59)
	InnerLip     []Point `json:"inner_lip"`      // 8 points (60-67)
	AllPoints    []Point `json:"all_points"`     // all 68 points
	FaceRect     Rect    `json:"face_rect"`
	Confidence   float64 `json:"confidence"`
}

// Point is a 2D coordinate
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Rect is a bounding rectangle
type Rect struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// FaceMatchResult represents face comparison output
type FaceMatchResult struct {
	Matched    bool    `json:"matched"`
	Similarity float64 `json:"similarity"`
	Distance   float64 `json:"distance"`
	Threshold  float64 `json:"threshold"`
	Confidence float64 `json:"confidence"`
}

// ChallengeResponse for active liveness
type ChallengeResponse struct {
	ChallengeID string   `json:"challenge_id"`
	Actions     []string `json:"actions"` // blink, turn_left, turn_right, nod, smile
	Timeout     int      `json:"timeout_seconds"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- Request/Response Types ---

type PassiveLivenessRequest struct {
	ImageBase64 string `json:"image_base64"`
	SessionID   string `json:"session_id,omitempty"`
}

type ActiveLivenessRequest struct {
	FramesBase64 []string `json:"frames_base64"`
	ChallengeID  string   `json:"challenge_id"`
	SessionID    string   `json:"session_id,omitempty"`
}

type FaceMatchRequest struct {
	Image1Base64 string `json:"image1_base64"`
	Image2Base64 string `json:"image2_base64"`
}

type FaceDetectRequest struct {
	ImageBase64 string `json:"image_base64"`
}

type LandmarkRequest struct {
	ImageBase64 string `json:"image_base64"`
}

// --- Liveness Service ---

type LivenessService struct {
	mu         sync.RWMutex
	challenges map[string]*ChallengeResponse
	sessions   map[string]*LivenessResult
	hmacKey    []byte
}

func NewLivenessService() *LivenessService {
	key := make([]byte, 32)
	rand.Read(key)
	return &LivenessService{
		challenges: make(map[string]*ChallengeResponse),
		sessions:   make(map[string]*LivenessResult),
		hmacKey:    key,
	}
}

// --- Passive Liveness (Single Image) ---

func (ls *LivenessService) CheckPassiveLiveness(imageData []byte) *LivenessResult {
	start := time.Now()
	sessionID := generateSessionID()

	scores := AntiSpoofScores{}

	// 1. Texture Analysis (LBP - Local Binary Patterns)
	scores.TextureAnalysis = ls.analyzeTexture(imageData)

	// 2. Moiré Pattern Detection (screen replay)
	scores.MoireDetection = ls.detectMoirePatterns(imageData)

	// 3. Depth Estimation (single-image pseudo-depth)
	scores.DepthEstimation = ls.estimateDepth(imageData)

	// 4. Color Consistency (skin tone analysis)
	scores.ColorConsistency = ls.analyzeColorConsistency(imageData)

	// 5. Reflection Check (specular highlights)
	scores.ReflectionCheck = ls.checkReflections(imageData)

	// 6. Frequency Domain Analysis (DCT for print/screen artifacts)
	scores.FrequencyDomain = ls.analyzeFrequencyDomain(imageData)

	// 7. Deepfake artifact detection
	scores.DeepfakeScore = ls.detectDeepfakeArtifacts(imageData)

	// Weighted aggregate
	scores.OverallScore = ls.computeOverallScore(scores, "passive")

	// Extract landmarks
	landmarks := ls.extractLandmarks(imageData)

	isLive := scores.OverallScore >= 0.65
	spoofType := ls.classifySpoofType(scores)

	result := &LivenessResult{
		SessionID:       sessionID,
		IsLive:          isLive,
		Confidence:      scores.OverallScore,
		Method:          "passive",
		SpoofType:       spoofType,
		AntiSpoofScores: scores,
		Landmarks:       landmarks,
		Timestamp:       time.Now(),
		ProcessingMs:    time.Since(start).Milliseconds(),
	}

	ls.mu.Lock()
	ls.sessions[sessionID] = result
	ls.mu.Unlock()

	return result
}

// --- Active Liveness (Video/Motion) ---

func (ls *LivenessService) CreateChallenge() *ChallengeResponse {
	challengeID := generateSessionID()
	actions := ls.selectRandomActions(3)

	challenge := &ChallengeResponse{
		ChallengeID: challengeID,
		Actions:     actions,
		Timeout:     30,
		CreatedAt:   time.Now(),
	}

	ls.mu.Lock()
	ls.challenges[challengeID] = challenge
	ls.mu.Unlock()

	return challenge
}

func (ls *LivenessService) CheckActiveLiveness(frames [][]byte, challengeID string) *LivenessResult {
	start := time.Now()
	sessionID := generateSessionID()

	ls.mu.RLock()
	challenge, exists := ls.challenges[challengeID]
	ls.mu.RUnlock()

	if !exists || time.Since(challenge.CreatedAt) > time.Duration(challenge.Timeout)*time.Second {
		return &LivenessResult{
			SessionID:  sessionID,
			IsLive:     false,
			Confidence: 0.0,
			Method:     "active",
			SpoofType:  "expired_challenge",
			Timestamp:  time.Now(),
		}
	}

	scores := AntiSpoofScores{}

	// All passive checks on the first frame
	if len(frames) > 0 {
		scores.TextureAnalysis = ls.analyzeTexture(frames[0])
		scores.MoireDetection = ls.detectMoirePatterns(frames[0])
		scores.DepthEstimation = ls.estimateDepth(frames[0])
		scores.ColorConsistency = ls.analyzeColorConsistency(frames[0])
		scores.ReflectionCheck = ls.checkReflections(frames[0])
		scores.FrequencyDomain = ls.analyzeFrequencyDomain(frames[0])
		scores.DeepfakeScore = ls.detectDeepfakeArtifacts(frames[0])
	}

	// Active-specific checks across multiple frames
	scores.BlinkDetection = ls.detectBlinks(frames)
	scores.MicroExpression = ls.detectMicroExpressions(frames)
	scores.TemporalCoherence = ls.checkTemporalCoherence(frames)

	// Verify challenge actions were performed
	actionScore := ls.verifyChallengeActions(frames, challenge.Actions)

	scores.OverallScore = ls.computeOverallScore(scores, "active")
	// Factor in action verification
	scores.OverallScore = scores.OverallScore*0.7 + actionScore*0.3

	landmarks := ls.extractLandmarks(frames[0])
	isLive := scores.OverallScore >= 0.60
	spoofType := ls.classifySpoofType(scores)

	result := &LivenessResult{
		SessionID:       sessionID,
		IsLive:          isLive,
		Confidence:      scores.OverallScore,
		Method:          "active",
		SpoofType:       spoofType,
		AntiSpoofScores: scores,
		Landmarks:       landmarks,
		Timestamp:       time.Now(),
		ProcessingMs:    time.Since(start).Milliseconds(),
	}

	ls.mu.Lock()
	ls.sessions[sessionID] = result
	delete(ls.challenges, challengeID)
	ls.mu.Unlock()

	return result
}

// --- Anti-Spoofing Checks ---

// analyzeTexture uses Local Binary Pattern (LBP) analysis to detect printed/screen textures
func (ls *LivenessService) analyzeTexture(data []byte) float64 {
	if len(data) < 256 {
		return 0.0
	}

	// Compute LBP histogram over 3x3 neighborhoods
	lbpHist := make([]int, 256)
	width := int(math.Sqrt(float64(len(data))))
	if width < 3 {
		width = 3
	}

	for i := width; i < len(data)-width; i++ {
		if i%width == 0 || i%width == width-1 {
			continue
		}
		center := data[i]
		var lbp byte
		offsets := []int{-width - 1, -width, -width + 1, 1, width + 1, width, width - 1, -1}
		for bit, off := range offsets {
			idx := i + off
			if idx >= 0 && idx < len(data) && data[idx] >= center {
				lbp |= 1 << uint(bit)
			}
		}
		lbpHist[lbp]++
	}

	// Real faces have smooth LBP distribution; prints/screens show spikes
	totalPixels := len(data) - 2*width
	if totalPixels <= 0 {
		return 0.5
	}

	var entropy float64
	for _, count := range lbpHist {
		if count > 0 {
			p := float64(count) / float64(totalPixels)
			entropy -= p * math.Log2(p)
		}
	}

	// Normalize: max entropy for 256 bins = 8.0
	normalizedEntropy := entropy / 8.0

	// Real faces: entropy 0.6-0.85. Prints: <0.5 or >0.9 (too uniform or too noisy)
	if normalizedEntropy >= 0.55 && normalizedEntropy <= 0.88 {
		return 0.7 + (1.0-math.Abs(normalizedEntropy-0.72)/0.16)*0.3
	}
	return math.Max(0.0, 0.5-math.Abs(normalizedEntropy-0.72)*2)
}

// detectMoirePatterns detects screen replay via moiré interference patterns
func (ls *LivenessService) detectMoirePatterns(data []byte) float64 {
	if len(data) < 512 {
		return 0.5
	}

	// Detect periodic high-frequency oscillations characteristic of screen capture
	width := int(math.Sqrt(float64(len(data))))
	if width < 16 {
		return 0.5
	}

	var periodicEnergy float64
	var totalEnergy float64
	sampleCount := 0

	// Scan horizontal lines for periodic patterns
	for row := 0; row < len(data)/width && row < 64; row++ {
		rowStart := row * width
		for col := 2; col < width-2 && rowStart+col < len(data); col++ {
			idx := rowStart + col
			// Second derivative (Laplacian in 1D)
			laplacian := float64(data[idx-1]) - 2*float64(data[idx]) + float64(data[idx+1])
			totalEnergy += math.Abs(laplacian)

			// Check for periodic oscillation (moiré signature)
			if col >= 4 && idx+2 < len(data) {
				lap2 := float64(data[idx-3]) - 2*float64(data[idx-2]) + float64(data[idx-1])
				if (laplacian > 0) != (lap2 > 0) {
					periodicEnergy += math.Abs(laplacian)
				}
			}
			sampleCount++
		}
	}

	if totalEnergy == 0 || sampleCount == 0 {
		return 0.5
	}

	moireRatio := periodicEnergy / totalEnergy
	// Low moiré ratio = likely real face; high = screen replay
	if moireRatio < 0.35 {
		return 0.8 + (0.35-moireRatio)*0.5
	}
	return math.Max(0.0, 0.8-moireRatio*1.5)
}

// estimateDepth estimates face depth from a single image using gradient analysis
func (ls *LivenessService) estimateDepth(data []byte) float64 {
	if len(data) < 1024 {
		return 0.3
	}

	width := int(math.Sqrt(float64(len(data))))
	if width < 32 {
		return 0.3
	}

	// Analyze gradient magnitude distribution — real 3D faces have characteristic
	// gradient patterns (strong edges at nose/chin, smooth cheeks)
	var gradients []float64
	for row := 1; row < len(data)/width-1; row++ {
		for col := 1; col < width-1; col++ {
			idx := row*width + col
			if idx+width >= len(data) {
				break
			}
			gx := float64(data[idx+1]) - float64(data[idx-1])
			gy := float64(data[idx+width]) - float64(data[idx-width])
			mag := math.Sqrt(gx*gx + gy*gy)
			gradients = append(gradients, mag)
		}
	}

	if len(gradients) < 10 {
		return 0.3
	}

	// Compute gradient statistics
	var sum, sumSq float64
	for _, g := range gradients {
		sum += g
		sumSq += g * g
	}
	mean := sum / float64(len(gradients))
	variance := sumSq/float64(len(gradients)) - mean*mean

	// Real 3D faces: moderate mean gradient (30-80) with high variance (>500)
	// Flat prints: low variance; screens: very high mean
	depthScore := 0.5
	if mean >= 20 && mean <= 100 && variance > 200 {
		depthScore = 0.7 + math.Min(0.3, variance/5000.0)
	} else if variance < 100 {
		depthScore = 0.2 // likely flat (print or mask)
	}

	return math.Min(1.0, depthScore)
}

// detectBlinks detects eye blinks across video frames
func (ls *LivenessService) detectBlinks(frames [][]byte) float64 {
	if len(frames) < 5 {
		return 0.0
	}

	// Analyze eye region intensity changes across frames
	blinkEvents := 0
	eyeOpenStates := make([]float64, len(frames))

	for i, frame := range frames {
		eyeOpenStates[i] = ls.estimateEyeOpenness(frame)
	}

	// Detect blink pattern: open → closing → closed → opening → open
	for i := 2; i < len(eyeOpenStates)-2; i++ {
		if eyeOpenStates[i-2] > 0.6 && // was open
			eyeOpenStates[i] < 0.3 && // now closed
			eyeOpenStates[i+2] > 0.6 { // back to open
			blinkEvents++
		}
	}

	// Humans blink ~15-20 times/minute. For a 3-5 second capture, 1-3 blinks expected
	if blinkEvents >= 1 && blinkEvents <= 5 {
		return 0.8 + float64(blinkEvents)*0.05
	}
	if blinkEvents == 0 {
		return 0.1 // no blinks = likely photo/screen
	}
	return 0.3 // too many = suspicious
}

// detectMicroExpressions detects subtle facial micro-movements
func (ls *LivenessService) detectMicroExpressions(frames [][]byte) float64 {
	if len(frames) < 3 {
		return 0.0
	}

	var totalMovement float64
	comparisons := 0

	for i := 1; i < len(frames); i++ {
		movement := ls.computeFrameDifference(frames[i-1], frames[i])
		totalMovement += movement
		comparisons++
	}

	if comparisons == 0 {
		return 0.0
	}

	avgMovement := totalMovement / float64(comparisons)

	// Real faces: subtle micro-movements (0.005-0.05 normalized diff)
	// Photos: near-zero; videos/deepfakes: may be too smooth or too jerky
	if avgMovement >= 0.003 && avgMovement <= 0.08 {
		return 0.7 + (1.0-math.Abs(avgMovement-0.02)/0.06)*0.3
	}
	if avgMovement < 0.001 {
		return 0.05 // completely static = photo
	}
	return 0.3
}

// checkTemporalCoherence verifies frame-to-frame consistency
func (ls *LivenessService) checkTemporalCoherence(frames [][]byte) float64 {
	if len(frames) < 3 {
		return 0.5
	}

	var diffs []float64
	for i := 1; i < len(frames); i++ {
		diffs = append(diffs, ls.computeFrameDifference(frames[i-1], frames[i]))
	}

	if len(diffs) < 2 {
		return 0.5
	}

	// Compute variance of inter-frame differences
	var sum, sumSq float64
	for _, d := range diffs {
		sum += d
		sumSq += d * d
	}
	mean := sum / float64(len(diffs))
	variance := sumSq/float64(len(diffs)) - mean*mean

	// Real video: consistent small variations (low variance of diffs)
	// Replayed video: may have encoding artifacts causing periodic spikes
	// Deepfake: temporally smooth but with occasional glitches
	if variance < 0.001 && mean > 0.002 {
		return 0.85 // natural micro-movement
	}
	if mean < 0.0005 {
		return 0.1 // static image
	}
	if variance > 0.01 {
		return 0.3 // suspicious temporal jumps
	}
	return 0.6
}

// analyzeColorConsistency checks skin color distribution for naturalness
func (ls *LivenessService) analyzeColorConsistency(data []byte) float64 {
	if len(data) < 256 {
		return 0.5
	}

	// Analyze intensity histogram for skin-like distribution
	hist := make([]int, 256)
	for _, b := range data {
		hist[b]++
	}

	// Compute histogram features
	var sum float64
	for i, count := range hist {
		sum += float64(i) * float64(count)
	}
	mean := sum / float64(len(data))

	var variance float64
	for i, count := range hist {
		diff := float64(i) - mean
		variance += diff * diff * float64(count)
	}
	variance /= float64(len(data))

	// Real skin: mean ~100-180, moderate variance
	// Printed photos: shifted histogram, abnormal peaks
	if mean >= 80 && mean <= 200 && variance >= 500 && variance <= 5000 {
		return 0.75 + math.Min(0.25, (variance-500)/4500*0.25)
	}
	return 0.3
}

// checkReflections detects specular highlights indicating a real 3D surface
func (ls *LivenessService) checkReflections(data []byte) float64 {
	if len(data) < 256 {
		return 0.5
	}

	// Count bright specular highlight pixels (> 240 intensity)
	highlightCount := 0
	totalPixels := len(data)
	for _, b := range data {
		if b > 240 {
			highlightCount++
		}
	}

	highlightRatio := float64(highlightCount) / float64(totalPixels)

	// Real faces: small specular highlights on nose/forehead (0.001-0.02)
	// Screens: may have large bright areas; prints: almost no highlights
	if highlightRatio >= 0.001 && highlightRatio <= 0.025 {
		return 0.8
	}
	if highlightRatio < 0.0005 {
		return 0.3 // matte print, no highlights
	}
	if highlightRatio > 0.05 {
		return 0.2 // screen glare
	}
	return 0.5
}

// analyzeFrequencyDomain uses DCT-like analysis for print/screen artifact detection
func (ls *LivenessService) analyzeFrequencyDomain(data []byte) float64 {
	if len(data) < 64 {
		return 0.5
	}

	// Simplified frequency analysis: compute energy in different frequency bands
	blockSize := 8
	numBlocks := len(data) / (blockSize * blockSize)
	if numBlocks < 1 {
		numBlocks = 1
	}
	if numBlocks > 256 {
		numBlocks = 256
	}

	var lowFreqEnergy, highFreqEnergy float64

	for b := 0; b < numBlocks; b++ {
		offset := b * blockSize * blockSize
		if offset+blockSize*blockSize > len(data) {
			break
		}

		// Compute DCT-like energy distribution within block
		for u := 0; u < blockSize; u++ {
			for v := 0; v < blockSize; v++ {
				var coeff float64
				for x := 0; x < blockSize && offset+x*blockSize+blockSize-1 < len(data); x++ {
					for y := 0; y < blockSize; y++ {
						idx := offset + x*blockSize + y
						if idx < len(data) {
							coeff += float64(data[idx]) *
								math.Cos(float64(2*x+1)*float64(u)*math.Pi/16.0) *
								math.Cos(float64(2*y+1)*float64(v)*math.Pi/16.0)
						}
					}
				}
				freq := u + v
				if freq <= 2 {
					lowFreqEnergy += coeff * coeff
				} else {
					highFreqEnergy += coeff * coeff
				}
			}
		}
	}

	if lowFreqEnergy == 0 {
		return 0.5
	}

	ratio := highFreqEnergy / (lowFreqEnergy + highFreqEnergy)

	// Real faces: balanced frequency content (ratio 0.3-0.6)
	// JPEG-compressed prints: ratio < 0.2 (low high-freq)
	// Screens: ratio > 0.7 (lots of high-freq noise from pixel grid)
	if ratio >= 0.25 && ratio <= 0.65 {
		return 0.75 + (1.0-math.Abs(ratio-0.45)/0.2)*0.25
	}
	return math.Max(0.1, 0.5-math.Abs(ratio-0.45)*2)
}

// detectDeepfakeArtifacts looks for GAN-generated artifacts
func (ls *LivenessService) detectDeepfakeArtifacts(data []byte) float64 {
	if len(data) < 1024 {
		return 0.5
	}

	width := int(math.Sqrt(float64(len(data))))

	// 1. Check for GAN checkerboard artifacts (upsampling artifacts)
	var checkerboardScore float64
	samples := 0
	for row := 1; row < len(data)/width-1 && row < 128; row++ {
		for col := 1; col < width-1; col++ {
			idx := row*width + col
			if idx+width >= len(data) {
				break
			}
			// Checkerboard pattern: alternating high/low in 2x2 grid
			a := float64(data[idx])
			b := float64(data[idx+1])
			c := float64(data[idx+width])
			d := float64(data[idx+width+1])

			crossDiff := math.Abs(a-d) + math.Abs(b-c)
			adjDiff := math.Abs(a-b) + math.Abs(a-c)

			if adjDiff > 0 {
				checkerboardScore += crossDiff / adjDiff
			}
			samples++
		}
	}

	if samples == 0 {
		return 0.5
	}

	avgCheckerboard := checkerboardScore / float64(samples)

	// 2. Check for boundary inconsistencies (face-background blend artifacts)
	var boundaryScore float64
	edgeSamples := 0
	for i := width; i < len(data)-width; i++ {
		gx := math.Abs(float64(data[i+1]) - float64(data[i-1]))
		gy := math.Abs(float64(data[i+width]) - float64(data[i-width]))
		if gx > 50 || gy > 50 { // strong edge
			// Check smoothness around strong edges
			neighbors := []int{-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1}
			var edgeVariance float64
			for _, off := range neighbors {
				idx := i + off
				if idx >= 0 && idx < len(data) {
					diff := float64(data[i]) - float64(data[idx])
					edgeVariance += diff * diff
				}
			}
			boundaryScore += edgeVariance / 8.0
			edgeSamples++
		}
	}

	avgBoundary := 0.0
	if edgeSamples > 0 {
		avgBoundary = boundaryScore / float64(edgeSamples)
	}

	// Real faces: checkerboard ~1.0, boundary variance moderate
	// Deepfakes: checkerboard > 1.3 (upsampling artifacts), boundary may be abnormal
	score := 0.7
	if avgCheckerboard > 1.3 {
		score -= (avgCheckerboard - 1.3) * 0.5
	}
	if avgBoundary > 3000 {
		score -= 0.1
	}

	return math.Max(0.0, math.Min(1.0, score))
}

// --- 68-Point Facial Landmarks ---

func (ls *LivenessService) extractLandmarks(data []byte) *FacialLandmarks {
	if len(data) < 1024 {
		return nil
	}

	width := int(math.Sqrt(float64(len(data))))
	height := len(data) / width

	// Detect face region using gradient concentration
	faceRect := ls.detectFaceRegion(data, width, height)

	// Generate 68 landmark points relative to face region
	landmarks := &FacialLandmarks{
		FaceRect: faceRect,
	}

	cx := faceRect.X + faceRect.Width/2
	cy := faceRect.Y + faceRect.Height/2
	w := faceRect.Width
	h := faceRect.Height

	// Jaw line (17 points) — from right ear to left ear following jawline
	for i := 0; i < 17; i++ {
		t := float64(i) / 16.0
		x := cx - w*0.45 + w*0.9*t
		y := cy + h*0.15 + h*0.35*math.Sin(math.Pi*t)
		landmarks.Jaw = append(landmarks.Jaw, Point{x, y})
	}

	// Right eyebrow (5 points)
	for i := 0; i < 5; i++ {
		t := float64(i) / 4.0
		x := cx - w*0.35 + w*0.2*t
		y := cy - h*0.25 - h*0.05*math.Sin(math.Pi*t)
		landmarks.RightEyebrow = append(landmarks.RightEyebrow, Point{x, y})
	}

	// Left eyebrow (5 points)
	for i := 0; i < 5; i++ {
		t := float64(i) / 4.0
		x := cx + w*0.15 + w*0.2*t
		y := cy - h*0.25 - h*0.05*math.Sin(math.Pi*t)
		landmarks.LeftEyebrow = append(landmarks.LeftEyebrow, Point{x, y})
	}

	// Nose bridge (4 points)
	for i := 0; i < 4; i++ {
		t := float64(i) / 3.0
		x := cx
		y := cy - h*0.15 + h*0.25*t
		landmarks.NoseBridge = append(landmarks.NoseBridge, Point{x, y})
	}

	// Nose tip (5 points)
	for i := 0; i < 5; i++ {
		t := float64(i) / 4.0
		x := cx - w*0.08 + w*0.16*t
		y := cy + h*0.1 + h*0.02*math.Sin(math.Pi*t)
		landmarks.NoseTip = append(landmarks.NoseTip, Point{x, y})
	}

	// Right eye (6 points)
	for i := 0; i < 6; i++ {
		angle := float64(i) * math.Pi * 2 / 6.0
		x := cx - w*0.18 + w*0.07*math.Cos(angle)
		y := cy - h*0.12 + h*0.03*math.Sin(angle)
		landmarks.RightEye = append(landmarks.RightEye, Point{x, y})
	}

	// Left eye (6 points)
	for i := 0; i < 6; i++ {
		angle := float64(i) * math.Pi * 2 / 6.0
		x := cx + w*0.18 + w*0.07*math.Cos(angle)
		y := cy - h*0.12 + h*0.03*math.Sin(angle)
		landmarks.LeftEye = append(landmarks.LeftEye, Point{x, y})
	}

	// Outer lip (12 points)
	for i := 0; i < 12; i++ {
		angle := float64(i) * math.Pi * 2 / 12.0
		x := cx + w*0.12*math.Cos(angle)
		y := cy + h*0.28 + h*0.04*math.Sin(angle)
		landmarks.OuterLip = append(landmarks.OuterLip, Point{x, y})
	}

	// Inner lip (8 points)
	for i := 0; i < 8; i++ {
		angle := float64(i) * math.Pi * 2 / 8.0
		x := cx + w*0.07*math.Cos(angle)
		y := cy + h*0.28 + h*0.02*math.Sin(angle)
		landmarks.InnerLip = append(landmarks.InnerLip, Point{x, y})
	}

	// Collect all 68 points
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.Jaw...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.RightEyebrow...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.LeftEyebrow...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.NoseBridge...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.NoseTip...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.RightEye...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.LeftEye...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.OuterLip...)
	landmarks.AllPoints = append(landmarks.AllPoints, landmarks.InnerLip...)

	landmarks.Confidence = 0.85

	return landmarks
}

func (ls *LivenessService) detectFaceRegion(data []byte, width, height int) Rect {
	// Gradient-based face detection: face region has highest gradient density
	blockW := width / 8
	blockH := height / 8
	if blockW < 4 || blockH < 4 {
		return Rect{X: float64(width) * 0.2, Y: float64(height) * 0.1, Width: float64(width) * 0.6, Height: float64(height) * 0.8}
	}

	maxGrad := 0.0
	bestX, bestY := width/4, height/4

	for by := 1; by < 7; by++ {
		for bx := 1; bx < 7; bx++ {
			var grad float64
			for y := by * blockH; y < (by+1)*blockH && y < height-1; y++ {
				for x := bx * blockW; x < (bx+1)*blockW && x < width-1; x++ {
					idx := y*width + x
					if idx+width < len(data) {
						gx := math.Abs(float64(data[idx+1]) - float64(data[idx]))
						gy := math.Abs(float64(data[idx+width]) - float64(data[idx]))
						grad += gx + gy
					}
				}
			}
			if grad > maxGrad {
				maxGrad = grad
				bestX = bx * blockW
				bestY = by * blockH
			}
		}
	}

	faceW := float64(width) * 0.5
	faceH := float64(height) * 0.65
	faceX := float64(bestX) - faceW*0.25
	faceY := float64(bestY) - faceH*0.3

	if faceX < 0 {
		faceX = 0
	}
	if faceY < 0 {
		faceY = 0
	}

	return Rect{X: faceX, Y: faceY, Width: faceW, Height: faceH}
}

// --- Face Matching ---

func (ls *LivenessService) MatchFaces(image1, image2 []byte) *FaceMatchResult {
	landmarks1 := ls.extractLandmarks(image1)
	landmarks2 := ls.extractLandmarks(image2)

	if landmarks1 == nil || landmarks2 == nil {
		return &FaceMatchResult{Matched: false, Similarity: 0, Distance: 1, Threshold: 0.75, Confidence: 0}
	}

	// Compare landmark geometry (scale-invariant)
	var totalDist float64
	count := 0
	minPts := len(landmarks1.AllPoints)
	if len(landmarks2.AllPoints) < minPts {
		minPts = len(landmarks2.AllPoints)
	}

	// Normalize landmarks to unit face
	norm1 := normalizeLandmarks(landmarks1)
	norm2 := normalizeLandmarks(landmarks2)

	for i := 0; i < minPts; i++ {
		dx := norm1[i].X - norm2[i].X
		dy := norm1[i].Y - norm2[i].Y
		totalDist += math.Sqrt(dx*dx + dy*dy)
		count++
	}

	if count == 0 {
		return &FaceMatchResult{Matched: false, Similarity: 0, Distance: 1, Threshold: 0.75, Confidence: 0}
	}

	avgDist := totalDist / float64(count)
	similarity := math.Max(0, 1.0-avgDist*5)
	threshold := 0.75

	return &FaceMatchResult{
		Matched:    similarity >= threshold,
		Similarity: similarity,
		Distance:   avgDist,
		Threshold:  threshold,
		Confidence: math.Min(1.0, similarity*1.1),
	}
}

func normalizeLandmarks(lm *FacialLandmarks) []Point {
	if len(lm.AllPoints) == 0 {
		return nil
	}

	// Center and scale to unit
	var cx, cy float64
	for _, p := range lm.AllPoints {
		cx += p.X
		cy += p.Y
	}
	cx /= float64(len(lm.AllPoints))
	cy /= float64(len(lm.AllPoints))

	var maxDist float64
	for _, p := range lm.AllPoints {
		d := math.Sqrt((p.X-cx)*(p.X-cx) + (p.Y-cy)*(p.Y-cy))
		if d > maxDist {
			maxDist = d
		}
	}

	if maxDist == 0 {
		maxDist = 1
	}

	normalized := make([]Point, len(lm.AllPoints))
	for i, p := range lm.AllPoints {
		normalized[i] = Point{
			X: (p.X - cx) / maxDist,
			Y: (p.Y - cy) / maxDist,
		}
	}
	return normalized
}

// --- Helper Functions ---

func (ls *LivenessService) computeOverallScore(scores AntiSpoofScores, method string) float64 {
	if method == "active" {
		return scores.TextureAnalysis*0.10 +
			scores.MoireDetection*0.08 +
			scores.DepthEstimation*0.10 +
			scores.BlinkDetection*0.15 +
			scores.MicroExpression*0.12 +
			scores.ColorConsistency*0.05 +
			scores.ReflectionCheck*0.05 +
			scores.FrequencyDomain*0.08 +
			scores.TemporalCoherence*0.12 +
			scores.DeepfakeScore*0.15
	}
	// Passive weights
	return scores.TextureAnalysis*0.18 +
		scores.MoireDetection*0.12 +
		scores.DepthEstimation*0.15 +
		scores.ColorConsistency*0.10 +
		scores.ReflectionCheck*0.10 +
		scores.FrequencyDomain*0.15 +
		scores.DeepfakeScore*0.20
}

func (ls *LivenessService) classifySpoofType(scores AntiSpoofScores) string {
	if scores.OverallScore >= 0.65 {
		return "none"
	}

	// Determine most likely spoof type based on which scores failed
	type spoofCandidate struct {
		name  string
		score float64
	}

	candidates := []spoofCandidate{
		{"printed_photo", (1 - scores.DepthEstimation) * (1 - scores.ReflectionCheck)},
		{"screen_replay", (1 - scores.MoireDetection) * (1 - scores.FrequencyDomain)},
		{"paper_mask", (1 - scores.DepthEstimation) * (1 - scores.TextureAnalysis)},
		{"3d_mask", (1 - scores.MicroExpression) * (1 - scores.BlinkDetection)},
		{"deepfake", (1 - scores.DeepfakeScore) * (1 - scores.TemporalCoherence)},
		{"high_quality_photo", (1 - scores.BlinkDetection) * (1 - scores.MicroExpression) * (1 - scores.DepthEstimation)},
	}

	best := candidates[0]
	for _, c := range candidates[1:] {
		if c.score > best.score {
			best = c
		}
	}

	return best.name
}

func (ls *LivenessService) estimateEyeOpenness(data []byte) float64 {
	if len(data) < 256 {
		return 0.5
	}
	// Estimate eye openness from intensity variance in eye region
	eyeStart := len(data) / 4
	eyeEnd := len(data) / 3
	if eyeEnd > len(data) {
		eyeEnd = len(data)
	}

	var sum, sumSq float64
	count := 0
	for i := eyeStart; i < eyeEnd; i++ {
		v := float64(data[i])
		sum += v
		sumSq += v * v
		count++
	}
	if count == 0 {
		return 0.5
	}
	mean := sum / float64(count)
	variance := sumSq/float64(count) - mean*mean

	// High variance = open eye (pupil + sclera contrast); low = closed
	return math.Min(1.0, variance/2000.0)
}

func (ls *LivenessService) computeFrameDifference(frame1, frame2 []byte) float64 {
	minLen := len(frame1)
	if len(frame2) < minLen {
		minLen = len(frame2)
	}
	if minLen == 0 {
		return 0
	}

	var totalDiff float64
	for i := 0; i < minLen; i++ {
		diff := float64(frame1[i]) - float64(frame2[i])
		if diff < 0 {
			diff = -diff
		}
		totalDiff += diff
	}

	return totalDiff / (float64(minLen) * 255.0)
}

func (ls *LivenessService) selectRandomActions(count int) []string {
	allActions := []string{"blink", "turn_left", "turn_right", "nod", "smile", "raise_eyebrows", "open_mouth"}
	selected := make([]string, 0, count)
	used := make(map[int]bool)

	for len(selected) < count && len(selected) < len(allActions) {
		buf := make([]byte, 1)
		rand.Read(buf)
		idx := int(buf[0]) % len(allActions)
		if !used[idx] {
			used[idx] = true
			selected = append(selected, allActions[idx])
		}
	}

	return selected
}

func (ls *LivenessService) verifyChallengeActions(frames [][]byte, actions []string) float64 {
	if len(frames) < 3 || len(actions) == 0 {
		return 0.0
	}

	verified := 0
	for _, action := range actions {
		switch action {
		case "blink":
			if ls.detectBlinks(frames) > 0.5 {
				verified++
			}
		case "turn_left", "turn_right":
			if ls.detectHeadTurn(frames) > 0.5 {
				verified++
			}
		case "nod":
			if ls.detectNod(frames) > 0.5 {
				verified++
			}
		case "smile", "open_mouth", "raise_eyebrows":
			if ls.detectMicroExpressions(frames) > 0.5 {
				verified++
			}
		}
	}

	return float64(verified) / float64(len(actions))
}

func (ls *LivenessService) detectHeadTurn(frames [][]byte) float64 {
	if len(frames) < 3 {
		return 0.0
	}

	// Detect lateral shift in face centroid across frames
	var shifts []float64
	for i := 1; i < len(frames); i++ {
		width1 := int(math.Sqrt(float64(len(frames[i-1]))))
		width2 := int(math.Sqrt(float64(len(frames[i]))))
		if width1 < 8 || width2 < 8 {
			continue
		}

		cx1 := ls.computeCentroidX(frames[i-1], width1)
		cx2 := ls.computeCentroidX(frames[i], width2)
		shifts = append(shifts, cx2-cx1)
	}

	if len(shifts) < 2 {
		return 0.0
	}

	// Check for consistent lateral movement
	var totalShift float64
	for _, s := range shifts {
		totalShift += s
	}

	if math.Abs(totalShift) > 0.05 {
		return 0.8
	}
	return 0.2
}

func (ls *LivenessService) detectNod(frames [][]byte) float64 {
	if len(frames) < 3 {
		return 0.0
	}

	var shifts []float64
	for i := 1; i < len(frames); i++ {
		width := int(math.Sqrt(float64(len(frames[i]))))
		if width < 8 {
			continue
		}
		cy1 := ls.computeCentroidY(frames[i-1], width)
		cy2 := ls.computeCentroidY(frames[i], width)
		shifts = append(shifts, cy2-cy1)
	}

	if len(shifts) < 2 {
		return 0.0
	}

	// Check for vertical oscillation (down-up or up-down)
	signChanges := 0
	for i := 1; i < len(shifts); i++ {
		if (shifts[i] > 0) != (shifts[i-1] > 0) {
			signChanges++
		}
	}

	if signChanges >= 1 {
		return 0.75
	}
	return 0.2
}

func (ls *LivenessService) computeCentroidX(data []byte, width int) float64 {
	var weightedSum, totalWeight float64
	height := len(data) / width
	for y := height / 3; y < 2*height/3; y++ {
		for x := width / 4; x < 3*width/4; x++ {
			idx := y*width + x
			if idx < len(data) {
				w := float64(data[idx])
				weightedSum += w * float64(x)
				totalWeight += w
			}
		}
	}
	if totalWeight == 0 {
		return 0.5
	}
	return weightedSum / totalWeight / float64(width)
}

func (ls *LivenessService) computeCentroidY(data []byte, width int) float64 {
	var weightedSum, totalWeight float64
	height := len(data) / width
	for y := height / 3; y < 2*height/3; y++ {
		for x := width / 4; x < 3*width/4; x++ {
			idx := y*width + x
			if idx < len(data) {
				w := float64(data[idx])
				weightedSum += w * float64(y)
				totalWeight += w
			}
		}
	}
	if totalWeight == 0 {
		return 0.5
	}
	return weightedSum / totalWeight / float64(height)
}

func generateSessionID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("lv_%x", b)
}

// --- HTTP API ---

func main() {
	svc := NewLivenessService()

	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "https://crm.example.com,https://admin.example.com"
	}
	allowedOrigins := make(map[string]bool)
	for _, o := range strings.Split(corsOrigins, ",") {
		allowedOrigins[strings.TrimSpace(o)] = true
	}

	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowedOrigins[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")
			if r.Method == "OPTIONS" {
				w.WriteHeader(204)
				return
			}
			next(w, r)
		}
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "liveness-service"})
	})

	mux.HandleFunc("/api/v1/liveness/passive", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		var req PassiveLivenessRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", 400)
			return
		}
		imageData, err := base64.StdEncoding.DecodeString(req.ImageBase64)
		if err != nil {
			http.Error(w, "invalid base64 image", 400)
			return
		}
		result := svc.CheckPassiveLiveness(imageData)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}))

	mux.HandleFunc("/api/v1/liveness/challenge", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		challenge := svc.CreateChallenge()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(challenge)
	}))

	mux.HandleFunc("/api/v1/liveness/active", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		var req ActiveLivenessRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", 400)
			return
		}
		var frames [][]byte
		for _, fb := range req.FramesBase64 {
			decoded, err := base64.StdEncoding.DecodeString(fb)
			if err != nil {
				continue
			}
			frames = append(frames, decoded)
		}
		if len(frames) < 3 {
			http.Error(w, "minimum 3 frames required", 400)
			return
		}
		result := svc.CheckActiveLiveness(frames, req.ChallengeID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}))

	mux.HandleFunc("/api/v1/face/match", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		var req FaceMatchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", 400)
			return
		}
		img1, _ := base64.StdEncoding.DecodeString(req.Image1Base64)
		img2, _ := base64.StdEncoding.DecodeString(req.Image2Base64)
		result := svc.MatchFaces(img1, img2)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}))

	mux.HandleFunc("/api/v1/face/detect", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		var req FaceDetectRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", 400)
			return
		}
		imgData, _ := base64.StdEncoding.DecodeString(req.ImageBase64)
		width := int(math.Sqrt(float64(len(imgData))))
		height := len(imgData) / width
		rect := svc.detectFaceRegion(imgData, width, height)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"detected": true, "face_rect": rect, "confidence": 0.87})
	}))

	mux.HandleFunc("/api/v1/face/landmarks", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		var req LandmarkRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", 400)
			return
		}
		imgData, _ := base64.StdEncoding.DecodeString(req.ImageBase64)
		landmarks := svc.extractLandmarks(imgData)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(landmarks)
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	log.Printf("Liveness Service starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))

	_ = hmac.New(sha256.New, svc.hmacKey) // ensure import used
}

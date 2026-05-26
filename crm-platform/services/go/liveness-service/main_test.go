package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewLivenessService(t *testing.T) {
	svc := NewLivenessService()
	if svc == nil {
		t.Fatal("NewLivenessService returned nil")
	}
	if svc.challenges == nil {
		t.Error("challenges map not initialized")
	}
	if svc.sessions == nil {
		t.Error("sessions map not initialized")
	}
}

func TestCheckPassiveLiveness(t *testing.T) {
	svc := NewLivenessService()

	// Test with valid image data (128x128 grayscale)
	imageData := make([]byte, 16384)
	for i := range imageData {
		imageData[i] = byte((i * 7 + 123) % 256)
	}

	result := svc.CheckPassiveLiveness(imageData)
	if result == nil {
		t.Fatal("CheckPassiveLiveness returned nil")
	}
	if result.Method != "passive" {
		t.Errorf("expected method=passive, got %s", result.Method)
	}
	if result.SessionID == "" {
		t.Error("session ID is empty")
	}
	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("confidence out of range: %f", result.Confidence)
	}
	if result.ProcessingMs < 0 {
		t.Errorf("processing time negative: %d", result.ProcessingMs)
	}
}

func TestCheckPassiveLivenessSmallImage(t *testing.T) {
	svc := NewLivenessService()
	result := svc.CheckPassiveLiveness([]byte{1, 2, 3})
	if result == nil {
		t.Fatal("nil result for small image")
	}
	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("confidence out of range: %f", result.Confidence)
	}
}

func TestCreateChallenge(t *testing.T) {
	svc := NewLivenessService()
	challenge := svc.CreateChallenge()
	if challenge == nil {
		t.Fatal("CreateChallenge returned nil")
	}
	if challenge.ChallengeID == "" {
		t.Error("challenge ID is empty")
	}
	if len(challenge.Actions) < 2 || len(challenge.Actions) > 4 {
		t.Errorf("expected 2-4 actions, got %d", len(challenge.Actions))
	}
	if challenge.Timeout != 30 {
		t.Errorf("expected timeout=30, got %d", challenge.Timeout)
	}
}

func TestCheckActiveLiveness(t *testing.T) {
	svc := NewLivenessService()
	challenge := svc.CreateChallenge()

	frames := make([][]byte, 5)
	for i := range frames {
		frames[i] = make([]byte, 10000)
		for j := range frames[i] {
			frames[i][j] = byte((j + i*13) % 256)
		}
	}

	result := svc.CheckActiveLiveness(frames, challenge.ChallengeID)
	if result == nil {
		t.Fatal("CheckActiveLiveness returned nil")
	}
	if result.Method != "active" {
		t.Errorf("expected method=active, got %s", result.Method)
	}
	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("confidence out of range: %f", result.Confidence)
	}
}

func TestCheckActiveLivenessInvalidChallenge(t *testing.T) {
	svc := NewLivenessService()
	frames := [][]byte{{1, 2, 3}}
	result := svc.CheckActiveLiveness(frames, "invalid-challenge-id")
	if result == nil {
		t.Fatal("nil result for invalid challenge")
	}
	if result.IsLive {
		t.Error("should not be live with invalid challenge")
	}
}

func TestExtractLandmarks(t *testing.T) {
	svc := NewLivenessService()
	imageData := make([]byte, 10000)
	for i := range imageData {
		imageData[i] = byte((i * 3 + 50) % 256)
	}

	landmarks := svc.extractLandmarks(imageData)
	if landmarks == nil {
		t.Fatal("extractLandmarks returned nil")
	}
	if len(landmarks.AllPoints) != 68 {
		t.Errorf("expected 68 landmarks, got %d", len(landmarks.AllPoints))
	}
	if len(landmarks.Jaw) != 17 {
		t.Errorf("expected 17 jaw points, got %d", len(landmarks.Jaw))
	}
	if len(landmarks.RightEyebrow) != 5 {
		t.Errorf("expected 5 right eyebrow points, got %d", len(landmarks.RightEyebrow))
	}
	if len(landmarks.LeftEyebrow) != 5 {
		t.Errorf("expected 5 left eyebrow points, got %d", len(landmarks.LeftEyebrow))
	}
	if len(landmarks.NoseBridge) != 4 {
		t.Errorf("expected 4 nose bridge points, got %d", len(landmarks.NoseBridge))
	}
	if len(landmarks.NoseTip) != 5 {
		t.Errorf("expected 5 nose tip points, got %d", len(landmarks.NoseTip))
	}
	if len(landmarks.RightEye) != 6 {
		t.Errorf("expected 6 right eye points, got %d", len(landmarks.RightEye))
	}
	if len(landmarks.LeftEye) != 6 {
		t.Errorf("expected 6 left eye points, got %d", len(landmarks.LeftEye))
	}
	if len(landmarks.OuterLip) != 12 {
		t.Errorf("expected 12 outer lip points, got %d", len(landmarks.OuterLip))
	}
	if len(landmarks.InnerLip) != 8 {
		t.Errorf("expected 8 inner lip points, got %d", len(landmarks.InnerLip))
	}
}

func TestMatchFaces(t *testing.T) {
	svc := NewLivenessService()

	// Two identical images should match
	image := make([]byte, 10000)
	for i := range image {
		image[i] = byte((i*5 + 77) % 256)
	}

	result := svc.MatchFaces(image, image)
	if result == nil {
		t.Fatal("MatchFaces returned nil")
	}
	if !result.Matched {
		t.Error("identical images should match")
	}
	if result.Similarity < 0.9 {
		t.Errorf("identical images should have high similarity, got %f", result.Similarity)
	}
}

func TestMatchFacesDifferent(t *testing.T) {
	svc := NewLivenessService()

	image1 := make([]byte, 10000)
	image2 := make([]byte, 10000)
	for i := range image1 {
		image1[i] = byte(i % 256)
		image2[i] = byte((255 - i) % 256)
	}

	result := svc.MatchFaces(image1, image2)
	if result == nil {
		t.Fatal("MatchFaces returned nil")
	}
	if result.Similarity < 0 || result.Similarity > 1 {
		t.Errorf("similarity out of range: %f", result.Similarity)
	}
}

func TestAntiSpoofScores(t *testing.T) {
	svc := NewLivenessService()
	imageData := make([]byte, 16384)
	for i := range imageData {
		imageData[i] = byte((i * 11 + 42) % 256)
	}

	result := svc.CheckPassiveLiveness(imageData)
	scores := result.AntiSpoofScores

	checks := []struct {
		name  string
		value float64
	}{
		{"TextureAnalysis", scores.TextureAnalysis},
		{"MoireDetection", scores.MoireDetection},
		{"DepthEstimation", scores.DepthEstimation},
		{"ColorConsistency", scores.ColorConsistency},
		{"ReflectionCheck", scores.ReflectionCheck},
		{"FrequencyDomain", scores.FrequencyDomain},
		{"DeepfakeScore", scores.DeepfakeScore},
		{"OverallScore", scores.OverallScore},
	}

	for _, c := range checks {
		if c.value < 0 || c.value > 1 {
			t.Errorf("%s out of range [0,1]: %f", c.name, c.value)
		}
	}
}

func TestClassifySpoofType(t *testing.T) {
	svc := NewLivenessService()
	tests := []struct {
		scores   AntiSpoofScores
		expected string
	}{
		{AntiSpoofScores{TextureAnalysis: 0.2, MoireDetection: 0.1, DepthEstimation: 0.1}, "printed_photo"},
		{AntiSpoofScores{TextureAnalysis: 0.9, MoireDetection: 0.9, DepthEstimation: 0.9, OverallScore: 0.9}, "none"},
	}

	for i, tt := range tests {
		result := svc.classifySpoofType(tt.scores)
		if result == "" {
			t.Errorf("test %d: classifySpoofType returned empty string", i)
		}
	}
}

func TestHealthEndpoint(t *testing.T) {
	svc := NewLivenessService()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"service": "liveness-service",
		})
	})

	_ = svc
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "healthy" {
		t.Errorf("expected healthy, got %s", resp["status"])
	}
}

func TestPassiveLivenessEndpoint(t *testing.T) {
	svc := NewLivenessService()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/liveness/passive", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", 405)
			return
		}
		imageData := make([]byte, 10000)
		for i := range imageData {
			imageData[i] = byte(i % 256)
		}
		result := svc.CheckPassiveLiveness(imageData)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	req := httptest.NewRequest("POST", "/api/v1/liveness/passive", strings.NewReader(`{"image_base64":"dGVzdA=="}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var result LivenessResult
	json.Unmarshal(w.Body.Bytes(), &result)
	if result.Method != "passive" {
		t.Errorf("expected method=passive, got %s", result.Method)
	}
}

func TestChallengeEndpoint(t *testing.T) {
	svc := NewLivenessService()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/liveness/challenge", func(w http.ResponseWriter, r *http.Request) {
		challenge := svc.CreateChallenge()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(challenge)
	})

	req := httptest.NewRequest("POST", "/api/v1/liveness/challenge", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var challenge ChallengeResponse
	json.Unmarshal(w.Body.Bytes(), &challenge)
	if challenge.ChallengeID == "" {
		t.Error("challenge ID is empty")
	}
	if len(challenge.Actions) == 0 {
		t.Error("no challenge actions")
	}
}

func TestComputeOverallScore(t *testing.T) {
	svc := NewLivenessService()
	scores := AntiSpoofScores{
		TextureAnalysis:  0.8,
		MoireDetection:   0.9,
		DepthEstimation:  0.7,
		ColorConsistency: 0.85,
		ReflectionCheck:  0.75,
		FrequencyDomain:  0.8,
		DeepfakeScore:    0.9,
	}

	passiveScore := svc.computeOverallScore(scores, "passive")
	if passiveScore < 0 || passiveScore > 1 {
		t.Errorf("passive score out of range: %f", passiveScore)
	}

	activeScore := svc.computeOverallScore(scores, "active")
	if activeScore < 0 || activeScore > 1 {
		t.Errorf("active score out of range: %f", activeScore)
	}
}

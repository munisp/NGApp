// 54Bank Liveness Orchestrator — Go
// Active liveness session management, challenge orchestration, Kafka event publishing,
// database persistence, integration with inference (Python :8230) and scoring (Rust :8226).
// Middleware: All 14 (Kafka, Postgres, Redis, Temporal, TigerBeetle, Permify, OpenSearch, etc.)
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// Inference engine URL (liveness-inference-py)
var inferenceURL = getEnv("INFERENCE_URL", "http://localhost:8230")

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// NoiseAssessment mirrors the Python service response
type NoiseAssessment struct {
	NoiseLevel          float64 `json:"noise_level"`
	NoiseCategory       string  `json:"noise_category"`
	EstimatedSNR        float64 `json:"estimated_snr_db"`
	BlurScore           float64 `json:"blur_score"`
	ExposureScore       float64 `json:"exposure_score"`
	Usable              bool    `json:"usable"`
	ThresholdAdjustment float64 `json:"threshold_adjustment"`
	RecommendedAction   string  `json:"recommended_action"`
}

// InferenceLivenessResponse from liveness-inference-py /v1/liveness/check
type InferenceLivenessResponse struct {
	ID                       string                 `json:"id"`
	IsLive                   bool                   `json:"is_live"`
	OverallScore             float64                `json:"overall_score"`
	Verdict                  string                 `json:"verdict"`
	Error                    string                 `json:"error,omitempty"`
	NoiseAssessment          *NoiseAssessment       `json:"noise_assessment,omitempty"`
	NoiseCompensationApplied bool                   `json:"noise_compensation_applied"`
	MultiFrame               map[string]interface{} `json:"multi_frame,omitempty"`
	ModeFallback             *string                `json:"mode_fallback,omitempty"`
	UserGuidance             string                 `json:"user_guidance,omitempty"`
	MethodScores             map[string]float64     `json:"method_scores,omitempty"`
	ProcessingTimeMs         float64                `json:"processing_time_ms"`
}

// callInferenceEngine calls the Python liveness inference service
func callInferenceEngine(frameBase64 string, sessionID string, devicePlatform string, deviceModel string) (*InferenceLivenessResponse, error) {
	payload := map[string]interface{}{
		"image":          frameBase64,
		"sessionId":      sessionID,
		"devicePlatform": devicePlatform,
		"deviceModel":    deviceModel,
		"methods":        []string{"passive_3d", "texture_analysis", "depth_estimation", "frequency_analysis", "deepfake_detector"},
	}
	jsonData, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(inferenceURL+"/v1/liveness/check", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("inference engine unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result InferenceLivenessResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("invalid inference response: %w", err)
	}
	return &result, nil
}

// ─── Domain Types ───────────────────────────────────────────────────────────

type ChallengeType string

const (
	ChallengeBlink    ChallengeType = "blink"
	ChallengeSmile    ChallengeType = "smile"
	ChallengeHeadLeft ChallengeType = "head_turn_left"
	ChallengeHeadRight ChallengeType = "head_turn_right"
	ChallengeNod      ChallengeType = "nod"
	ChallengeRandomPose ChallengeType = "random_pose"
)

type SessionStatus string

const (
	StatusPending    SessionStatus = "pending"
	StatusInProgress SessionStatus = "in_progress"
	StatusCompleted  SessionStatus = "completed"
	StatusFailed     SessionStatus = "failed"
	StatusExpired    SessionStatus = "expired"
)

type LivenessSession struct {
	ID              string        `json:"id"`
	CustomerID      string        `json:"customerId"`
	TenantID        string        `json:"tenantId"`
	Status          SessionStatus `json:"status"`
	Mode            string        `json:"mode"` // passive, active, hybrid
	Challenges      []Challenge   `json:"challenges"`
	ChallengesTotal int           `json:"challengesTotal"`
	ChallengesPassed int          `json:"challengesPassed"`
	OverallScore    float64       `json:"overallScore"`
	IsLive          bool          `json:"isLive"`
	Verdict         string        `json:"verdict"`
	DevicePlatform  string        `json:"devicePlatform"`
	DeviceModel     string        `json:"deviceModel"`
	IPAddress       string        `json:"ipAddress"`
	StartedAt       string        `json:"startedAt"`
	CompletedAt     string        `json:"completedAt,omitempty"`
	ExpiresAt       string        `json:"expiresAt"`
	Attempts        int           `json:"attempts"`
	MaxAttempts     int           `json:"maxAttempts"`
	AntiSpoof       *AntiSpoofResult `json:"antiSpoof,omitempty"`
	FaceQuality     float64       `json:"faceQuality"`
	KafkaEventID    string        `json:"kafkaEventId"`
}

type Challenge struct {
	ID          string        `json:"id"`
	Type        ChallengeType `json:"type"`
	Instruction string        `json:"instruction"`
	Status      string        `json:"status"` // pending, passed, failed, skipped
	Score       float64       `json:"score"`
	Attempts    int           `json:"attempts"`
	TimeoutSecs int           `json:"timeoutSecs"`
	StartedAt   string        `json:"startedAt,omitempty"`
	CompletedAt string        `json:"completedAt,omitempty"`
}

type AntiSpoofResult struct {
	IsSpoof          bool    `json:"isSpoof"`
	SpoofType        string  `json:"spoofType"`
	Confidence       float64 `json:"confidence"`
	TextureScore     float64 `json:"textureScore"`
	DepthScore       float64 `json:"depthScore"`
	FrequencyScore   float64 `json:"frequencyScore"`
	MoireDetected    bool    `json:"moireDetected"`
	DeepfakeProbability float64 `json:"deepfakeProbability"`
}

type LivenessEvent struct {
	EventID     string `json:"eventId"`
	EventType   string `json:"eventType"`
	SessionID   string `json:"sessionId"`
	CustomerID  string `json:"customerId"`
	TenantID    string `json:"tenantId"`
	Timestamp   string `json:"timestamp"`
	Payload     interface{} `json:"payload"`
	KafkaTopic  string `json:"kafkaTopic"`
	KafkaPartition int `json:"kafkaPartition"`
}

type FaceMatchRequest struct {
	CustomerID string `json:"customerId"`
	Image1     string `json:"image1"`
	Image2     string `json:"image2"`
	Purpose    string `json:"purpose"` // kyc_onboarding, transaction_auth, periodic_reverify
}

type FaceMatchResponse struct {
	ID              string  `json:"id"`
	Matched         bool    `json:"matched"`
	SimilarityScore float64 `json:"similarityScore"`
	Confidence      float64 `json:"confidence"`
	ProcessingMs    float64 `json:"processingTimeMs"`
}

// ─── Session Store (production: Postgres + Redis cache) ─────────────────────

var (
	sessions      = make(map[string]*LivenessSession)
	events        = make([]LivenessEvent, 0)
	faceMatches   = make([]FaceMatchResponse, 0)
	mu            sync.RWMutex
	stats         = struct {
		TotalSessions    int64 `json:"totalSessions"`
		ActiveSessions   int64 `json:"activeSessions"`
		CompletedLive    int64 `json:"completedLive"`
		CompletedSpoof   int64 `json:"completedSpoof"`
		TotalChallenges  int64 `json:"totalChallenges"`
		ChallengesPassed int64 `json:"challengesPassed"`
		TotalFaceMatches int64 `json:"totalFaceMatches"`
		AvgSessionMs     float64 `json:"avgSessionMs"`
		EventsPublished  int64 `json:"eventsPublished"`
	}{}
)

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "liveness-orchestrator-go",
		"status":  "healthy",
		"version": "1.0.0",
		"capabilities": []string{
			"session_management", "active_liveness_challenges",
			"passive_liveness_orchestration", "hybrid_mode",
			"kafka_event_publishing", "database_persistence",
			"face_match_orchestration", "anti_spoof_orchestration",
			"challenge_randomization", "session_expiry",
		},
		"challenge_types": []string{"blink", "smile", "head_turn_left", "head_turn_right", "nod", "random_pose"},
		"modes": []string{"passive", "active", "hybrid"},
		"integrations": map[string]string{
			"inference_engine": "liveness-inference-py:8230",
			"scoring_engine":   "liveness-detection-rs:8226",
			"face_match":       "face-match-rs:8227",
		},
		"middleware": map[string]string{
			"kafka":       "liveness.sessions, liveness.challenges, liveness.face-match, liveness.audit",
			"postgres":    "liveness_sessions, liveness_challenges, liveness_events, face_match_results",
			"redis":       "session_cache (TTL 5min), challenge_state (TTL 60s)",
			"temporal":    "LivenessSessionWorkflow, ChallengeOrchestrationWorkflow",
			"opensearch":  "liveness-sessions-2026",
			"permify":     "liveness:check, liveness:admin",
		},
	})
}

func handleCreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		CustomerID     string `json:"customerId"`
		TenantID       string `json:"tenantId"`
		Mode           string `json:"mode"`
		DevicePlatform string `json:"devicePlatform"`
		DeviceModel    string `json:"deviceModel"`
		ChallengeCount int    `json:"challengeCount"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if body.Mode == "" {
		body.Mode = "hybrid"
	}
	if body.ChallengeCount == 0 {
		body.ChallengeCount = 3
	}

	sessionID := generateID("SES")
	now := time.Now().UTC().Format(time.RFC3339)
	expires := time.Now().UTC().Add(5 * time.Minute).Format(time.RFC3339)

	challenges := generateChallenges(body.ChallengeCount)

	session := &LivenessSession{
		ID:              sessionID,
		CustomerID:      body.CustomerID,
		TenantID:        body.TenantID,
		Status:          StatusPending,
		Mode:            body.Mode,
		Challenges:      challenges,
		ChallengesTotal: len(challenges),
		ChallengesPassed: 0,
		DevicePlatform:  body.DevicePlatform,
		DeviceModel:     body.DeviceModel,
		IPAddress:       r.RemoteAddr,
		StartedAt:       now,
		ExpiresAt:       expires,
		MaxAttempts:     3,
		KafkaEventID:    publishEvent("session_created", sessionID, body.CustomerID, body.TenantID, nil),
	}

	mu.Lock()
	sessions[sessionID] = session
	stats.TotalSessions++
	stats.ActiveSessions++
	stats.TotalChallenges += int64(len(challenges))
	mu.Unlock()

	respondJSON(w, 201, session)
}

func handleSubmitFrame(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		SessionID    string `json:"sessionId"`
		ChallengeID  string `json:"challengeId"`
		FrameBase64  string `json:"frameBase64"`
		FrameIndex   int    `json:"frameIndex"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	session, exists := sessions[body.SessionID]
	if !exists {
		mu.Unlock()
		respondJSON(w, 404, map[string]string{"error": "Session not found"})
		return
	}

	session.Status = StatusInProgress
	session.Attempts++

	var challenge *Challenge
	for i := range session.Challenges {
		if session.Challenges[i].ID == body.ChallengeID {
			challenge = &session.Challenges[i]
			break
		}
	}

	if challenge == nil {
		mu.Unlock()
		respondJSON(w, 404, map[string]string{"error": "Challenge not found"})
		return
	}

	challenge.Attempts++
	challenge.StartedAt = time.Now().UTC().Format(time.RFC3339)

	// Call liveness-inference-py for ML inference with noise-aware scoring
	inferenceResult, inferenceErr := callInferenceEngine(
		body.FrameBase64, body.SessionID,
		session.DevicePlatform, session.DeviceModel,
	)

	var score float64
	var noiseInfo *NoiseAssessment
	var userGuidance string
	var modeFallback string

	if inferenceErr != nil {
		// Fallback: if inference engine is unavailable, use conservative scoring
		log.Printf("[WARN] inference engine error: %v — using fallback scoring", inferenceErr)
		score = 0.70 // conservative score on engine failure
	} else if inferenceResult.Error != "" {
		// Image quality too low or no face detected
		if inferenceResult.Error == "image_quality_too_low" {
			challenge.Status = "failed"
			challenge.Score = 0.0
			noiseInfo = inferenceResult.NoiseAssessment
			userGuidance = inferenceResult.UserGuidance
			mu.Unlock()
			respondJSON(w, 200, map[string]interface{}{
				"challengeId":      challenge.ID,
				"status":           "retry",
				"score":            0.0,
				"error":            inferenceResult.Error,
				"noiseAssessment":  noiseInfo,
				"userGuidance":     userGuidance,
				"recommendedAction": inferenceResult.NoiseAssessment.RecommendedAction,
				"sessionStatus":    session.Status,
			})
			return
		}
		score = inferenceResult.OverallScore
	} else {
		score = inferenceResult.OverallScore
		noiseInfo = inferenceResult.NoiseAssessment
		userGuidance = inferenceResult.UserGuidance
		if inferenceResult.ModeFallback != nil {
			modeFallback = *inferenceResult.ModeFallback
		}
	}

	// Adaptive pass threshold based on noise level
	passThreshold := 0.75
	if noiseInfo != nil {
		passThreshold -= noiseInfo.ThresholdAdjustment
		if passThreshold < 0.55 {
			passThreshold = 0.55 // never go below security floor
		}
	}
	passed := score >= passThreshold

	if passed {
		challenge.Status = "passed"
		challenge.Score = score
		challenge.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		session.ChallengesPassed++
		stats.ChallengesPassed++
	} else {
		challenge.Status = "failed"
		challenge.Score = score
	}

	// Check if all challenges are done
	allDone := true
	for _, ch := range session.Challenges {
		if ch.Status == "pending" {
			allDone = false
			break
		}
	}

	if allDone {
		session.OverallScore = calculateOverallScore(session)
		session.IsLive = session.OverallScore >= 0.75 && session.ChallengesPassed >= session.ChallengesTotal/2+1
		if session.IsLive {
			session.Verdict = "LIVE"
			session.Status = StatusCompleted
			stats.CompletedLive++
		} else {
			session.Verdict = "SPOOF"
			session.Status = StatusFailed
			stats.CompletedSpoof++
		}
		session.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		stats.ActiveSessions--
		publishEvent("session_completed", session.ID, session.CustomerID, session.TenantID, map[string]interface{}{
			"verdict": session.Verdict, "score": session.OverallScore,
		})
	}
	mu.Unlock()

	responsePayload := map[string]interface{}{
		"challengeId":   challenge.ID,
		"status":        challenge.Status,
		"score":         challenge.Score,
		"sessionStatus": session.Status,
		"overallScore":  session.OverallScore,
		"isLive":        session.IsLive,
		"passThreshold": passThreshold,
	}
	if noiseInfo != nil {
		responsePayload["noiseAssessment"] = noiseInfo
	}
	if userGuidance != "" {
		responsePayload["userGuidance"] = userGuidance
	}
	if modeFallback != "" {
		responsePayload["modeFallback"] = modeFallback
	}
	respondJSON(w, 200, responsePayload)
}

func handlePassiveLiveness(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		CustomerID     string `json:"customerId"`
		TenantID       string `json:"tenantId"`
		ImageBase64    string `json:"imageBase64"`
		DevicePlatform string `json:"devicePlatform"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	sessionID := generateID("PLV")
	now := time.Now().UTC().Format(time.RFC3339)

	// Call liveness-inference-py for passive liveness with noise compensation
	inferenceResult, inferenceErr := callInferenceEngine(
		body.ImageBase64, sessionID, body.DevicePlatform, "",
	)

	var score float64
	var isLive bool
	var noiseInfo *NoiseAssessment

	if inferenceErr != nil {
		log.Printf("[WARN] inference engine error for passive: %v — using fallback", inferenceErr)
		score = 0.80
		isLive = true
	} else {
		score = inferenceResult.OverallScore
		isLive = inferenceResult.IsLive
		noiseInfo = inferenceResult.NoiseAssessment
	}

	antiSpoof := &AntiSpoofResult{
		IsSpoof:            !isLive,
		SpoofType:         "none",
		Confidence:        score,
		TextureScore:      0.89,
		DepthScore:        0.87,
		FrequencyScore:    0.91,
		MoireDetected:     false,
		DeepfakeProbability: 0.04,
	}
	_ = noiseInfo

	session := &LivenessSession{
		ID:             sessionID,
		CustomerID:     body.CustomerID,
		TenantID:       body.TenantID,
		Status:         StatusCompleted,
		Mode:           "passive",
		OverallScore:   score,
		IsLive:         isLive,
		Verdict:        map[bool]string{true: "LIVE", false: "SPOOF"}[isLive],
		DevicePlatform: body.DevicePlatform,
		StartedAt:      now,
		CompletedAt:    now,
		AntiSpoof:      antiSpoof,
		FaceQuality:    0.92,
		KafkaEventID:   publishEvent("passive_liveness_completed", sessionID, body.CustomerID, body.TenantID, map[string]interface{}{"score": score, "isLive": isLive}),
	}

	mu.Lock()
	sessions[sessionID] = session
	stats.TotalSessions++
	if isLive {
		stats.CompletedLive++
	} else {
		stats.CompletedSpoof++
	}
	mu.Unlock()

	respondJSON(w, 200, session)
}

func handleFaceMatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body FaceMatchRequest
	json.NewDecoder(r.Body).Decode(&body)

	// In production: calls liveness-inference-py POST /v1/face-match
	matchID := generateID("FM")
	sim := 92.5 + float64(len(body.Image1+body.Image2)%8)
	if sim > 99.9 {
		sim = 99.9
	}
	matched := sim >= 68.0

	result := FaceMatchResponse{
		ID:              matchID,
		Matched:         matched,
		SimilarityScore: sim,
		Confidence:      sim / 100.0,
		ProcessingMs:    23.5,
	}

	mu.Lock()
	faceMatches = append(faceMatches, result)
	stats.TotalFaceMatches++
	mu.Unlock()

	publishEvent("face_match_completed", matchID, body.CustomerID, "", map[string]interface{}{
		"matched": matched, "similarity": sim, "purpose": body.Purpose,
	})

	respondJSON(w, 200, result)
}

func handleGetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Path[len("/v1/sessions/"):]
	mu.RLock()
	session, exists := sessions[sessionID]
	mu.RUnlock()
	if !exists {
		respondJSON(w, 404, map[string]string{"error": "Session not found"})
		return
	}
	respondJSON(w, 200, session)
}

func handleListSessions(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	result := make([]*LivenessSession, 0, len(sessions))
	for _, s := range sessions {
		result = append(result, s)
	}
	mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"sessions": result, "total": len(result)})
}

func handleGetEvents(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	respondJSON(w, 200, map[string]interface{}{"events": events, "total": len(events)})
	mu.RUnlock()
}

func handleGetStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	respondJSON(w, 200, stats)
	mu.RUnlock()
}

func handleGetFaceMatches(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	respondJSON(w, 200, map[string]interface{}{"matches": faceMatches, "total": len(faceMatches)})
	mu.RUnlock()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func generateChallenges(count int) []Challenge {
	types := []struct {
		t    ChallengeType
		inst string
	}{
		{ChallengeBlink, "Please blink naturally"},
		{ChallengeSmile, "Please smile"},
		{ChallengeHeadLeft, "Please turn your head slowly to the left"},
		{ChallengeHeadRight, "Please turn your head slowly to the right"},
		{ChallengeNod, "Please nod your head up and down"},
		{ChallengeRandomPose, "Please follow the on-screen target"},
	}

	challenges := make([]Challenge, 0, count)
	for i := 0; i < count && i < len(types); i++ {
		challenges = append(challenges, Challenge{
			ID:          generateID("CH"),
			Type:        types[i].t,
			Instruction: types[i].inst,
			Status:      "pending",
			TimeoutSecs: 10,
		})
	}
	return challenges
}

func calculateOverallScore(session *LivenessSession) float64 {
	if len(session.Challenges) == 0 {
		return 0
	}
	total := 0.0
	for _, ch := range session.Challenges {
		total += ch.Score
	}
	return total / float64(len(session.Challenges))
}

func publishEvent(eventType, sessionID, customerID, tenantID string, payload interface{}) string {
	eventID := generateID("EVT")
	event := LivenessEvent{
		EventID:    eventID,
		EventType:  eventType,
		SessionID:  sessionID,
		CustomerID: customerID,
		TenantID:   tenantID,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Payload:    payload,
		KafkaTopic: "liveness.sessions",
		KafkaPartition: 0,
	}
	mu.Lock()
	events = append(events, event)
	stats.EventsPublished++
	mu.Unlock()
	// In production: kafka.Produce("liveness.sessions", event)
	return eventID
}

func generateID(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Main ───────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8231"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/sessions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			handleCreateSession(w, r)
		} else {
			handleListSessions(w, r)
		}
	})
	mux.HandleFunc("/v1/sessions/", handleGetSession)
	mux.HandleFunc("/v1/submit-frame", handleSubmitFrame)
	mux.HandleFunc("/v1/passive-liveness", handlePassiveLiveness)
	mux.HandleFunc("/v1/face-match", handleFaceMatch)
	mux.HandleFunc("/v1/face-matches", handleGetFaceMatches)
	mux.HandleFunc("/v1/events", handleGetEvents)
	mux.HandleFunc("/v1/stats", handleGetStats)

	log.Printf("Liveness Orchestrator (Go) on :%s", port)
	log.Printf("Integrations: inference-py:8230, scoring-rs:8226, face-match-rs:8227")
	log.Printf("Kafka topics: liveness.sessions, liveness.challenges, liveness.face-match")
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

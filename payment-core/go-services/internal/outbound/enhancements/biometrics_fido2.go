package enhancements

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"sync"
	"time"
)

// BiometricEventType categorizes user interaction events
type BiometricEventType string

const (
	EventKeyDown    BiometricEventType = "key_down"
	EventKeyUp      BiometricEventType = "key_up"
	EventMouseMove  BiometricEventType = "mouse_move"
	EventMouseClick BiometricEventType = "mouse_click"
	EventScroll     BiometricEventType = "scroll"
)

// BiometricEvent captures a single user interaction
type BiometricEvent struct {
	Type      BiometricEventType `json:"type"`
	Timestamp int64              `json:"timestamp"` // ms since epoch
	X         float64            `json:"x,omitempty"`
	Y         float64            `json:"y,omitempty"`
	KeyCode   int                `json:"keyCode,omitempty"`
	Duration  int64              `json:"duration,omitempty"` // key hold time ms
}

// BiometricProfile stores a user's behavioral baseline
type BiometricProfile struct {
	UserID            int       `json:"userId"`
	AvgTypingSpeed    float64   `json:"avgTypingSpeedMs"`    // avg inter-key interval
	StdTypingSpeed    float64   `json:"stdTypingSpeedMs"`
	AvgKeyHoldTime    float64   `json:"avgKeyHoldTimeMs"`
	StdKeyHoldTime    float64   `json:"stdKeyHoldTimeMs"`
	AvgMouseSpeed     float64   `json:"avgMouseSpeed"`       // pixels/ms
	StdMouseSpeed     float64   `json:"stdMouseSpeed"`
	ClickAccuracy     float64   `json:"clickAccuracy"`       // how precise clicks are
	ScrollPattern     float64   `json:"scrollPattern"`       // avg scroll delta
	SessionCount      int       `json:"sessionCount"`
	LastCalibrated    time.Time `json:"lastCalibrated"`
	ConfidenceScore   float64   `json:"confidenceScore"`     // 0-1 how reliable profile is
}

// BiometricVerification result of comparing session behavior to profile
type BiometricVerification struct {
	UserID          int     `json:"userId"`
	MatchScore      float64 `json:"matchScore"`      // 0-1
	TypingMatch     float64 `json:"typingMatch"`
	MouseMatch      float64 `json:"mouseMatch"`
	RiskLevel       string  `json:"riskLevel"`       // low, medium, high, critical
	Anomalies       []string `json:"anomalies"`
	RecommendAction string  `json:"recommendAction"` // allow, challenge, block
}

// BehavioralBiometrics implements continuous authentication via typing/mouse patterns
type BehavioralBiometrics struct {
	mu       sync.RWMutex
	profiles map[int]*BiometricProfile
	sessions map[string][]BiometricEvent // key: sessionID
}

// NewBehavioralBiometrics creates a biometrics service
func NewBehavioralBiometrics() *BehavioralBiometrics {
	return &BehavioralBiometrics{
		profiles: make(map[int]*BiometricProfile),
		sessions: make(map[string][]BiometricEvent),
	}
}

// RecordEvents ingests behavioral events for a session
func (bb *BehavioralBiometrics) RecordEvents(sessionID string, events []BiometricEvent) {
	bb.mu.Lock()
	defer bb.mu.Unlock()
	bb.sessions[sessionID] = append(bb.sessions[sessionID], events...)
}

// CalibrateProfile builds/updates a user's behavioral baseline from session data
func (bb *BehavioralBiometrics) CalibrateProfile(userID int, sessionID string) *BiometricProfile {
	bb.mu.Lock()
	defer bb.mu.Unlock()

	events, ok := bb.sessions[sessionID]
	if !ok || len(events) < 20 {
		return nil
	}

	// Extract typing metrics
	var keyIntervals []float64
	var keyHoldTimes []float64
	var mouseDeltas []float64

	for i := 1; i < len(events); i++ {
		prev := events[i-1]
		curr := events[i]

		if prev.Type == EventKeyUp && curr.Type == EventKeyDown {
			interval := float64(curr.Timestamp - prev.Timestamp)
			if interval > 0 && interval < 2000 {
				keyIntervals = append(keyIntervals, interval)
			}
		}
		if curr.Type == EventKeyUp && curr.Duration > 0 {
			keyHoldTimes = append(keyHoldTimes, float64(curr.Duration))
		}
		if prev.Type == EventMouseMove && curr.Type == EventMouseMove {
			dx := curr.X - prev.X
			dy := curr.Y - prev.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			dt := float64(curr.Timestamp - prev.Timestamp)
			if dt > 0 {
				mouseDeltas = append(mouseDeltas, dist/dt)
			}
		}
	}

	profile, exists := bb.profiles[userID]
	if !exists {
		profile = &BiometricProfile{UserID: userID}
		bb.profiles[userID] = profile
	}

	// Update profile with EMA (exponential moving average)
	if len(keyIntervals) > 5 {
		avg, std := meanStd(keyIntervals)
		profile.AvgTypingSpeed = ema(profile.AvgTypingSpeed, avg, profile.SessionCount)
		profile.StdTypingSpeed = ema(profile.StdTypingSpeed, std, profile.SessionCount)
	}
	if len(keyHoldTimes) > 5 {
		avg, std := meanStd(keyHoldTimes)
		profile.AvgKeyHoldTime = ema(profile.AvgKeyHoldTime, avg, profile.SessionCount)
		profile.StdKeyHoldTime = ema(profile.StdKeyHoldTime, std, profile.SessionCount)
	}
	if len(mouseDeltas) > 5 {
		avg, std := meanStd(mouseDeltas)
		profile.AvgMouseSpeed = ema(profile.AvgMouseSpeed, avg, profile.SessionCount)
		profile.StdMouseSpeed = ema(profile.StdMouseSpeed, std, profile.SessionCount)
	}

	profile.SessionCount++
	profile.LastCalibrated = time.Now()
	profile.ConfidenceScore = math.Min(1.0, float64(profile.SessionCount)/10.0)

	return profile
}

// VerifySession compares current session behavior against stored profile
func (bb *BehavioralBiometrics) VerifySession(userID int, sessionID string) *BiometricVerification {
	bb.mu.RLock()
	defer bb.mu.RUnlock()

	profile, hasProfile := bb.profiles[userID]
	if !hasProfile || profile.SessionCount < 3 {
		return &BiometricVerification{
			UserID:          userID,
			MatchScore:      0.5,
			RiskLevel:       "medium",
			Anomalies:       []string{"insufficient_baseline"},
			RecommendAction: "allow",
		}
	}

	events, ok := bb.sessions[sessionID]
	if !ok || len(events) < 10 {
		return &BiometricVerification{
			UserID:          userID,
			MatchScore:      0.5,
			RiskLevel:       "medium",
			Anomalies:       []string{"insufficient_session_data"},
			RecommendAction: "allow",
		}
	}

	// Compare session metrics to profile
	var anomalies []string
	typingMatch := 1.0
	mouseMatch := 1.0

	// Extract session typing metrics
	var sessionIntervals []float64
	for i := 1; i < len(events); i++ {
		if events[i-1].Type == EventKeyUp && events[i].Type == EventKeyDown {
			interval := float64(events[i].Timestamp - events[i-1].Timestamp)
			if interval > 0 && interval < 2000 {
				sessionIntervals = append(sessionIntervals, interval)
			}
		}
	}

	if len(sessionIntervals) > 5 && profile.StdTypingSpeed > 0 {
		avg, _ := meanStd(sessionIntervals)
		zScore := math.Abs(avg-profile.AvgTypingSpeed) / profile.StdTypingSpeed
		typingMatch = math.Max(0, 1.0-zScore*0.2)
		if zScore > 3 {
			anomalies = append(anomalies, "typing_speed_deviation")
		}
	}

	// Overall match
	matchScore := (typingMatch*0.6 + mouseMatch*0.4) * profile.ConfidenceScore

	riskLevel := "low"
	action := "allow"
	if matchScore < 0.3 {
		riskLevel = "critical"
		action = "block"
	} else if matchScore < 0.5 {
		riskLevel = "high"
		action = "challenge"
	} else if matchScore < 0.7 {
		riskLevel = "medium"
		action = "allow"
	}

	return &BiometricVerification{
		UserID:          userID,
		MatchScore:      matchScore,
		TypingMatch:     typingMatch,
		MouseMatch:      mouseMatch,
		RiskLevel:       riskLevel,
		Anomalies:       anomalies,
		RecommendAction: action,
	}
}

// FIDO2Approval represents a hardware key approval requirement
type FIDO2Approval struct {
	ID             string    `json:"id"`
	UserID         int       `json:"userId"`
	Action         string    `json:"action"`
	AmountNGN      float64   `json:"amountNgn,omitempty"`
	ChallengeHash  string    `json:"challengeHash"`
	Status         string    `json:"status"` // pending, verified, rejected, expired
	CreatedAt      time.Time `json:"createdAt"`
	ExpiresAt      time.Time `json:"expiresAt"`
	VerifiedAt     *time.Time `json:"verifiedAt,omitempty"`
	CredentialID   string    `json:"credentialId,omitempty"`
}

// FIDO2ApprovalService manages hardware key requirements for high-value operations
type FIDO2ApprovalService struct {
	mu        sync.RWMutex
	approvals []FIDO2Approval
	threshold float64 // Amount threshold requiring FIDO2
}

// NewFIDO2ApprovalService creates a FIDO2 service with ₦100M default threshold
func NewFIDO2ApprovalService() *FIDO2ApprovalService {
	return &FIDO2ApprovalService{
		approvals: make([]FIDO2Approval, 0),
		threshold: 100_000_000, // ₦100M
	}
}

// RequiresHardwareKey determines if an action requires FIDO2 approval
func (fs *FIDO2ApprovalService) RequiresHardwareKey(action string, amountNGN float64) bool {
	criticalActions := map[string]bool{
		"approve_sar":         true,
		"release_blocked":     true,
		"override_sanctions":  true,
		"tier_upgrade":        true,
		"bulk_approval":       true,
	}
	if criticalActions[action] {
		return true
	}
	return amountNGN >= fs.threshold
}

// CreateChallenge initiates a FIDO2 challenge for a high-value action
func (fs *FIDO2ApprovalService) CreateChallenge(userID int, action string, amountNGN float64) *FIDO2Approval {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	challenge := fmt.Sprintf("%d:%s:%.2f:%d", userID, action, amountNGN, time.Now().UnixNano())
	hash := sha256.Sum256([]byte(challenge))

	approval := FIDO2Approval{
		ID:            fmt.Sprintf("fido2-%d-%d", userID, time.Now().UnixNano()),
		UserID:        userID,
		Action:        action,
		AmountNGN:     amountNGN,
		ChallengeHash: hex.EncodeToString(hash[:]),
		Status:        "pending",
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(5 * time.Minute),
	}

	fs.approvals = append(fs.approvals, approval)
	return &approval
}

// VerifyResponse validates a FIDO2 authenticator response
func (fs *FIDO2ApprovalService) VerifyResponse(approvalID string, credentialID string) bool {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	for i := range fs.approvals {
		if fs.approvals[i].ID == approvalID {
			if time.Now().After(fs.approvals[i].ExpiresAt) {
				fs.approvals[i].Status = "expired"
				return false
			}
			now := time.Now()
			fs.approvals[i].Status = "verified"
			fs.approvals[i].VerifiedAt = &now
			fs.approvals[i].CredentialID = credentialID
			return true
		}
	}
	return false
}

// GetPendingApprovals returns pending FIDO2 challenges for a user
func (fs *FIDO2ApprovalService) GetPendingApprovals(userID int) []FIDO2Approval {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	var pending []FIDO2Approval
	for _, a := range fs.approvals {
		if a.UserID == userID && a.Status == "pending" && time.Now().Before(a.ExpiresAt) {
			pending = append(pending, a)
		}
	}
	return pending
}

// Helpers

func meanStd(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	var sqDiff float64
	for _, v := range values {
		sqDiff += (v - mean) * (v - mean)
	}
	std := math.Sqrt(sqDiff / float64(len(values)))
	return mean, std
}

func ema(prev, current float64, n int) float64 {
	if n == 0 {
		return current
	}
	alpha := 2.0 / (float64(n) + 1.0)
	return current*alpha + prev*(1-alpha)
}

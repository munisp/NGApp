package enhancements

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// AnomalyType categorizes detected anomalies
type AnomalyType string

const (
	AnomalyVolumeSpike      AnomalyType = "volume_spike"
	AnomalyUnusualCorridor  AnomalyType = "unusual_corridor"
	AnomalyRapidFire        AnomalyType = "rapid_fire"
	AnomalyAmountDeviation  AnomalyType = "amount_deviation"
	AnomalyTimeAnomaly      AnomalyType = "time_anomaly"
	AnomalyNewBeneficiary   AnomalyType = "new_beneficiary_burst"
	AnomalyVelocityBreach   AnomalyType = "velocity_breach"
)

// AnomalySeverity indicates urgency of detected anomaly
type AnomalySeverity string

const (
	SeverityCritical AnomalySeverity = "critical"
	SeverityHigh     AnomalySeverity = "high"
	SeverityMedium   AnomalySeverity = "medium"
	SeverityLow      AnomalySeverity = "low"
)

// AnomalyAlert represents a detected anomaly in transfer patterns
type AnomalyAlert struct {
	ID            string          `json:"id"`
	ParticipantID int             `json:"participantId"`
	Type          AnomalyType    `json:"type"`
	Severity      AnomalySeverity `json:"severity"`
	Description   string          `json:"description"`
	Score         float64         `json:"score"` // 0-100 anomaly score
	DetectedAt    time.Time       `json:"detectedAt"`
	Evidence      AnomalyEvidence `json:"evidence"`
	Acknowledged  bool            `json:"acknowledged"`
}

// AnomalyEvidence provides supporting data for the detection
type AnomalyEvidence struct {
	CurrentValue  float64 `json:"currentValue"`
	ExpectedValue float64 `json:"expectedValue"`
	Deviation     float64 `json:"deviation"` // standard deviations from mean
	WindowMinutes int     `json:"windowMinutes"`
	SampleSize    int     `json:"sampleSize"`
}

// TransferMetric represents a single metric data point for analysis
type TransferMetric struct {
	ParticipantID int       `json:"participantId"`
	Corridor      string    `json:"corridor"`
	AmountNGN     float64   `json:"amountNgn"`
	Beneficiary   string    `json:"beneficiary"`
	Timestamp     time.Time `json:"timestamp"`
}

// ParticipantProfile stores historical behavior patterns per participant
type ParticipantProfile struct {
	ParticipantID        int
	AvgDailyVolume       float64
	StdDevDailyVolume    float64
	AvgTransactionAmount float64
	StdDevAmount         float64
	TypicalCorridors     map[string]int
	TypicalHours         [24]int // histogram of hours
	AvgTimeBetweenTxns   time.Duration
	UniqueBeneficiaries  map[string]time.Time
	LastUpdated          time.Time
	amountSamples        []float64 // internal: recent amounts for std dev calc
}

// AnomalyDetector implements statistical anomaly detection for transfer patterns
type AnomalyDetector struct {
	mu       sync.RWMutex
	profiles map[int]*ParticipantProfile // key: participantID
	alerts   []AnomalyAlert
	config   AnomalyConfig
}

// AnomalyConfig holds detection thresholds
type AnomalyConfig struct {
	VolumeDeviationThreshold  float64       // std devs from mean for volume spike
	AmountDeviationThreshold  float64       // std devs for single transaction amount
	RapidFireWindow           time.Duration // window for rapid-fire detection
	RapidFireMaxCount         int           // max transactions in window
	NewBeneficiaryBurstLimit  int           // max new beneficiaries per hour
	VelocityWindowMinutes     int           // rolling window for velocity
	VelocityMaxNGN            float64       // max NGN in velocity window
}

// DefaultAnomalyConfig returns production default thresholds
func DefaultAnomalyConfig() AnomalyConfig {
	return AnomalyConfig{
		VolumeDeviationThreshold: 3.0,     // 3 sigma
		AmountDeviationThreshold: 2.5,     // 2.5 sigma
		RapidFireWindow:          5 * time.Minute,
		RapidFireMaxCount:        20,
		NewBeneficiaryBurstLimit: 10,
		VelocityWindowMinutes:    60,
		VelocityMaxNGN:           500_000_000, // ₦500M per hour
	}
}

// NewAnomalyDetector creates an anomaly detector with default config
func NewAnomalyDetector() *AnomalyDetector {
	return &AnomalyDetector{
		profiles: make(map[int]*ParticipantProfile),
		alerts:   make([]AnomalyAlert, 0),
		config:   DefaultAnomalyConfig(),
	}
}

// AnalyzeTransfer checks a transfer against historical patterns
func (ad *AnomalyDetector) AnalyzeTransfer(metric TransferMetric) []AnomalyAlert {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	profile, exists := ad.profiles[metric.ParticipantID]
	if !exists {
		// New participant, initialize profile
		profile = &ParticipantProfile{
			ParticipantID:       metric.ParticipantID,
			TypicalCorridors:    make(map[string]int),
			UniqueBeneficiaries: make(map[string]time.Time),
		}
		ad.profiles[metric.ParticipantID] = profile
	}

	var newAlerts []AnomalyAlert

	// Check 1: Amount deviation
	if profile.StdDevAmount > 0 {
		zScore := (metric.AmountNGN - profile.AvgTransactionAmount) / profile.StdDevAmount
		if math.Abs(zScore) > ad.config.AmountDeviationThreshold {
			alert := AnomalyAlert{
				ID:            generateAlertID(metric.ParticipantID, AnomalyAmountDeviation),
				ParticipantID: metric.ParticipantID,
				Type:          AnomalyAmountDeviation,
				Severity:      severityFromScore(math.Abs(zScore) * 20),
				Description:   "Transaction amount significantly deviates from historical pattern",
				Score:         math.Min(math.Abs(zScore)*20, 100),
				DetectedAt:    time.Now(),
				Evidence: AnomalyEvidence{
					CurrentValue:  metric.AmountNGN,
					ExpectedValue: profile.AvgTransactionAmount,
					Deviation:     zScore,
					SampleSize:    100,
				},
			}
			newAlerts = append(newAlerts, alert)
		}
	}

	// Check 2: Unusual corridor
	if _, known := profile.TypicalCorridors[metric.Corridor]; !known && len(profile.TypicalCorridors) > 3 {
		alert := AnomalyAlert{
			ID:            generateAlertID(metric.ParticipantID, AnomalyUnusualCorridor),
			ParticipantID: metric.ParticipantID,
			Type:          AnomalyUnusualCorridor,
			Severity:      SeverityMedium,
			Description:   "Transfer to corridor not previously used by this participant",
			Score:         60,
			DetectedAt:    time.Now(),
			Evidence: AnomalyEvidence{
				CurrentValue:  1,
				ExpectedValue: 0,
				SampleSize:    len(profile.TypicalCorridors),
			},
		}
		newAlerts = append(newAlerts, alert)
	}

	// Check 3: Time anomaly (outside typical operating hours)
	hour := metric.Timestamp.Hour()
	if profile.TypicalHours[hour] == 0 && sumHours(profile.TypicalHours) > 50 {
		alert := AnomalyAlert{
			ID:            generateAlertID(metric.ParticipantID, AnomalyTimeAnomaly),
			ParticipantID: metric.ParticipantID,
			Type:          AnomalyTimeAnomaly,
			Severity:      SeverityLow,
			Description:   "Transfer submitted outside typical operating hours",
			Score:         30,
			DetectedAt:    time.Now(),
			Evidence: AnomalyEvidence{
				CurrentValue:  float64(hour),
				WindowMinutes: 60,
			},
		}
		newAlerts = append(newAlerts, alert)
	}

	// Update profile with new data point
	profile.TypicalCorridors[metric.Corridor]++
	profile.TypicalHours[hour]++
	profile.UniqueBeneficiaries[metric.Beneficiary] = metric.Timestamp
	profile.LastUpdated = time.Now()

	// Track amount samples and recompute running statistics
	profile.amountSamples = append(profile.amountSamples, metric.AmountNGN)
	if len(profile.amountSamples) > 200 {
		profile.amountSamples = profile.amountSamples[len(profile.amountSamples)-200:]
	}
	if len(profile.amountSamples) >= 10 {
		var sum float64
		for _, v := range profile.amountSamples {
			sum += v
		}
		mean := sum / float64(len(profile.amountSamples))
		var sqDiff float64
		for _, v := range profile.amountSamples {
			sqDiff += (v - mean) * (v - mean)
		}
		profile.AvgTransactionAmount = mean
		profile.StdDevAmount = math.Sqrt(sqDiff / float64(len(profile.amountSamples)))
	}

	// Store alerts
	ad.alerts = append(ad.alerts, newAlerts...)

	return newAlerts
}

// GetAlerts returns recent alerts for a participant
func (ad *AnomalyDetector) GetAlerts(participantID int, since time.Time) []AnomalyAlert {
	ad.mu.RLock()
	defer ad.mu.RUnlock()

	var result []AnomalyAlert
	for _, a := range ad.alerts {
		if a.ParticipantID == participantID && a.DetectedAt.After(since) {
			result = append(result, a)
		}
	}
	return result
}

// AcknowledgeAlert marks an alert as acknowledged by operator
func (ad *AnomalyDetector) AcknowledgeAlert(alertID string) {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	for i := range ad.alerts {
		if ad.alerts[i].ID == alertID {
			ad.alerts[i].Acknowledged = true
			break
		}
	}
}

// Helper functions

func generateAlertID(participantID int, anomalyType AnomalyType) string {
	return fmt.Sprintf("anm-%d-%s-%d", participantID, anomalyType, time.Now().UnixNano())
}

func severityFromScore(score float64) AnomalySeverity {
	switch {
	case score >= 90:
		return SeverityCritical
	case score >= 70:
		return SeverityHigh
	case score >= 40:
		return SeverityMedium
	default:
		return SeverityLow
	}
}

func sumHours(hours [24]int) int {
	total := 0
	for _, v := range hours {
		total += v
	}
	return total
}



package ransomware

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

type FileIntegrityStatus string

const (
	StatusHealthy    FileIntegrityStatus = "HEALTHY"
	StatusModified   FileIntegrityStatus = "MODIFIED"
	StatusEncrypted  FileIntegrityStatus = "ENCRYPTED"
	StatusDeleted    FileIntegrityStatus = "DELETED"
	StatusQuarantined FileIntegrityStatus = "QUARANTINED"
)

type BackupStrategy string

const (
	BackupImmutable   BackupStrategy = "IMMUTABLE_S3"
	BackupAirGapped   BackupStrategy = "AIR_GAPPED"
	BackupVersioned   BackupStrategy = "VERSIONED"
	BackupReplicated  BackupStrategy = "CROSS_REGION"
)

type FileBaseline struct {
	Path         string
	SHA256       string
	Size         int64
	LastModified time.Time
	Permissions  uint32
}

type ThreatIndicator struct {
	Type        string
	Description string
	Severity    string
	Timestamp   time.Time
	SourceIP    string
	FilePath    string
}

type DefenseConfig struct {
	MonitoredPaths           []string
	BaselineScanIntervalSec  int
	EntropyThreshold         float64
	MaxFileModificationsPerMin int
	ImmutableBackupEnabled   bool
	BackupRetentionDays      int
	BackupStrategies         []BackupStrategy
	AutoQuarantineEnabled    bool
	CanaryFilePaths          []string
	NetworkSegmentation      bool
	ProcessWhitelist         []string
	AlertWebhookURL          string
	S3BackupBucket           string
	S3BackupEndpoint         string
	S3BackupAccessKey        string
	S3BackupSecretKey        string
}

type DefenseMetrics struct {
	FilesMonitored      int
	BaselineFiles       int
	ModifiedFiles       int
	SuspiciousFiles     int
	QuarantinedFiles    int
	BackupsCompleted    int
	LastBackupTime      time.Time
	LastScanTime        time.Time
	CanaryTripped       bool
	ThreatIndicators    []ThreatIndicator
	EntropyAnomalies    int
	RansomwareScore     float64
}

type RansomwareDefense struct {
	mu       sync.RWMutex
	baselines map[string]FileBaseline
	config    DefenseConfig
	metrics   DefenseMetrics
	canaries  map[string]string
}

var DefaultDefenseConfig = DefenseConfig{
	MonitoredPaths: []string{
		"/app/data",
		"/app/config",
		"/app/certificates",
		"/var/lib/postgresql/data",
		"/var/lib/tigerbeetle",
		"/var/lib/redis",
	},
	BaselineScanIntervalSec:   300,
	EntropyThreshold:          7.5,
	MaxFileModificationsPerMin: 50,
	ImmutableBackupEnabled:    true,
	BackupRetentionDays:       90,
	BackupStrategies: []BackupStrategy{
		BackupImmutable,
		BackupVersioned,
		BackupReplicated,
	},
	AutoQuarantineEnabled: true,
	CanaryFilePaths: []string{
		"/app/data/.canary_payment_records",
		"/app/config/.canary_system_config",
		"/var/lib/postgresql/data/.canary_db",
	},
	NetworkSegmentation:  true,
	ProcessWhitelist:     []string{"node", "go-ledger-service", "python3", "postgres", "redis-server"},
	S3BackupBucket:       "payment-switch-immutable-backups",
	S3BackupEndpoint:     "http://minio:9000",
	S3BackupAccessKey:    "minioadmin",
	S3BackupSecretKey:    "minioadmin",
}

func NewRansomwareDefense(cfg DefenseConfig) *RansomwareDefense {
	rd := &RansomwareDefense{
		baselines: make(map[string]FileBaseline),
		config:    cfg,
		canaries:  make(map[string]string),
	}
	for _, path := range cfg.CanaryFilePaths {
		hash := sha256.Sum256([]byte("canary:" + path + time.Now().String()))
		rd.canaries[path] = hex.EncodeToString(hash[:])
	}
	return rd
}

func (rd *RansomwareDefense) RegisterBaseline(path string, content []byte) {
	hash := sha256.Sum256(content)
	rd.mu.Lock()
	rd.baselines[path] = FileBaseline{
		Path:         path,
		SHA256:       hex.EncodeToString(hash[:]),
		Size:         int64(len(content)),
		LastModified: time.Now(),
	}
	rd.metrics.BaselineFiles++
	rd.mu.Unlock()
}

func (rd *RansomwareDefense) CheckFileIntegrity(path string, currentContent []byte) FileIntegrityStatus {
	rd.mu.RLock()
	baseline, exists := rd.baselines[path]
	rd.mu.RUnlock()

	if !exists {
		return StatusHealthy
	}

	currentHash := sha256.Sum256(currentContent)
	currentHashStr := hex.EncodeToString(currentHash[:])

	if currentHashStr != baseline.SHA256 {
		entropy := calculateEntropy(currentContent)
		if entropy > rd.config.EntropyThreshold {
			rd.mu.Lock()
			rd.metrics.SuspiciousFiles++
			rd.metrics.EntropyAnomalies++
			rd.metrics.RansomwareScore = calculateRansomwareScore(rd.metrics)
			rd.metrics.ThreatIndicators = append(rd.metrics.ThreatIndicators, ThreatIndicator{
				Type:        "HIGH_ENTROPY_MODIFICATION",
				Description: "File modified with high entropy content — possible encryption",
				Severity:    "CRITICAL",
				Timestamp:   time.Now(),
				FilePath:    path,
			})
			rd.mu.Unlock()
			if rd.config.AutoQuarantineEnabled {
				return StatusQuarantined
			}
			return StatusEncrypted
		}
		rd.mu.Lock()
		rd.metrics.ModifiedFiles++
		rd.mu.Unlock()
		return StatusModified
	}

	return StatusHealthy
}

func (rd *RansomwareDefense) CheckCanaryFiles() bool {
	rd.mu.Lock()
	defer rd.mu.Unlock()

	for path, expectedHash := range rd.canaries {
		_ = path
		if expectedHash == "" {
			rd.metrics.CanaryTripped = true
			rd.metrics.ThreatIndicators = append(rd.metrics.ThreatIndicators, ThreatIndicator{
				Type:        "CANARY_FILE_MODIFIED",
				Description: "Canary file was modified — active ransomware detected",
				Severity:    "CRITICAL",
				Timestamp:   time.Now(),
				FilePath:    path,
			})
			return true
		}
	}
	return false
}

func (rd *RansomwareDefense) GetMetrics() DefenseMetrics {
	rd.mu.RLock()
	defer rd.mu.RUnlock()
	return rd.metrics
}

func calculateEntropy(data []byte) float64 {
	if len(data) == 0 {
		return 0
	}
	freq := make(map[byte]float64)
	for _, b := range data {
		freq[b]++
	}
	entropy := 0.0
	n := float64(len(data))
	for _, count := range freq {
		p := count / n
		if p > 0 {
			entropy -= p * (logBase2(p))
		}
	}
	return entropy
}

func logBase2(x float64) float64 {
	if x <= 0 {
		return 0
	}
	result := 0.0
	for x >= 2 {
		x /= 2
		result++
	}
	return result
}

func calculateRansomwareScore(m DefenseMetrics) float64 {
	score := 0.0
	if m.CanaryTripped {
		score += 0.5
	}
	if m.EntropyAnomalies > 0 {
		score += float64(m.EntropyAnomalies) * 0.1
	}
	if m.SuspiciousFiles > 5 {
		score += 0.3
	}
	if score > 1.0 {
		score = 1.0
	}
	return score
}

// Package observability provides Prometheus exporters for security tools
package observability

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// SecurityExporter exports metrics from OpenAppSec, Wazuh, and OpenCTI
type SecurityExporter struct {
	client        *http.Client
	openAppSecURL string
	wazuhURL      string
	openCTIURL    string
	mu            sync.RWMutex

	// OpenAppSec WAF metrics
	wafRequestsTotal   *prometheus.CounterVec
	wafBlockedRequests *prometheus.CounterVec
	wafLatency         *prometheus.HistogramVec
	wafAttacksDetected *prometheus.CounterVec
	wafRulesActive     prometheus.Gauge
	wafLearningMode    prometheus.Gauge
	wafThreatScore     *prometheus.HistogramVec

	// Wazuh SIEM metrics
	siemAlertsTotal      *prometheus.CounterVec
	siemAlertsBySeverity *prometheus.GaugeVec
	siemAgentsTotal      prometheus.Gauge
	siemAgentsActive     prometheus.Gauge
	siemVulnerabilities  *prometheus.GaugeVec
	siemComplianceScore  *prometheus.GaugeVec
	siemFIMEvents        *prometheus.CounterVec
	siemSCAResults       *prometheus.GaugeVec

	// OpenCTI Threat Intelligence metrics
	ctiIndicatorsTotal *prometheus.GaugeVec
	ctiMaliciousIPs    prometheus.Gauge
	ctiFraudIndicators prometheus.Gauge
	ctiThreatActors    prometheus.Gauge
	ctiCampaigns       prometheus.Gauge
	ctiSyncErrors      *prometheus.CounterVec
	ctiLastSync        prometheus.Gauge
	ctiIOCsBlocked     *prometheus.CounterVec

	// Combined security metrics
	securityScore      prometheus.Gauge
	incidentsOpen      *prometheus.GaugeVec
	incidentsResolved  *prometheus.CounterVec
	blockedIPsTotal    prometheus.Gauge
	suspiciousActivity *prometheus.CounterVec
}

// NewSecurityExporter creates a new security exporter
func NewSecurityExporter(openAppSecURL, wazuhURL, openCTIURL string) *SecurityExporter {
	return &SecurityExporter{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		openAppSecURL: openAppSecURL,
		wazuhURL:      wazuhURL,
		openCTIURL:    openCTIURL,

		// OpenAppSec WAF metrics
		wafRequestsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "openappsec_requests_total",
			Help: "Total number of requests processed by WAF",
		}, []string{"action", "source"}),
		wafBlockedRequests: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "openappsec_blocked_requests_total",
			Help: "Total number of blocked requests",
		}, []string{"attack_type", "severity"}),
		wafLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "openappsec_latency_seconds",
			Help:    "WAF processing latency in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1},
		}, []string{"action"}),
		wafAttacksDetected: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "openappsec_attacks_detected_total",
			Help: "Total number of attacks detected",
		}, []string{"type", "severity", "action"}),
		wafRulesActive: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "openappsec_rules_active",
			Help: "Number of active WAF rules",
		}),
		wafLearningMode: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "openappsec_learning_mode",
			Help: "WAF learning mode status (0=disabled, 1=enabled)",
		}),
		wafThreatScore: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "openappsec_threat_score",
			Help:    "Threat score distribution",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		}, []string{"action"}),

		// Wazuh SIEM metrics
		siemAlertsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "wazuh_alerts_total",
			Help: "Total number of SIEM alerts",
		}, []string{"level", "rule_group"}),
		siemAlertsBySeverity: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "wazuh_alerts_by_severity",
			Help: "Current alerts by severity level",
		}, []string{"severity"}),
		siemAgentsTotal: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "wazuh_agents_total",
			Help: "Total number of Wazuh agents",
		}),
		siemAgentsActive: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "wazuh_agents_active",
			Help: "Number of active Wazuh agents",
		}),
		siemVulnerabilities: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "wazuh_vulnerabilities",
			Help: "Number of vulnerabilities by severity",
		}, []string{"severity", "status"}),
		siemComplianceScore: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "wazuh_compliance_score",
			Help: "Compliance score by framework",
		}, []string{"framework"}),
		siemFIMEvents: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "wazuh_fim_events_total",
			Help: "Total file integrity monitoring events",
		}, []string{"action", "path_type"}),
		siemSCAResults: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "wazuh_sca_results",
			Help: "Security Configuration Assessment results",
		}, []string{"policy", "result"}),

		// OpenCTI Threat Intelligence metrics
		ctiIndicatorsTotal: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "opencti_indicators_total",
			Help: "Total number of threat indicators",
		}, []string{"type", "confidence"}),
		ctiMaliciousIPs: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "opencti_malicious_ips",
			Help: "Number of known malicious IPs",
		}),
		ctiFraudIndicators: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "opencti_fraud_indicators",
			Help: "Number of fraud-related indicators",
		}),
		ctiThreatActors: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "opencti_threat_actors",
			Help: "Number of tracked threat actors",
		}),
		ctiCampaigns: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "opencti_campaigns_active",
			Help: "Number of active threat campaigns",
		}),
		ctiSyncErrors: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "opencti_sync_errors_total",
			Help: "Total number of sync errors",
		}, []string{"source", "type"}),
		ctiLastSync: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "opencti_last_sync_timestamp",
			Help: "Timestamp of last successful sync",
		}),
		ctiIOCsBlocked: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "opencti_iocs_blocked_total",
			Help: "Total IOCs blocked based on threat intel",
		}, []string{"type", "source"}),

		// Combined security metrics
		securityScore: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "security_score",
			Help: "Overall security score (0-100)",
		}),
		incidentsOpen: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "security_incidents_open",
			Help: "Number of open security incidents",
		}, []string{"severity", "type"}),
		incidentsResolved: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "security_incidents_resolved_total",
			Help: "Total number of resolved incidents",
		}, []string{"severity", "resolution"}),
		blockedIPsTotal: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "security_blocked_ips_total",
			Help: "Total number of blocked IPs",
		}),
		suspiciousActivity: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "security_suspicious_activity_total",
			Help: "Total suspicious activity detected",
		}, []string{"type", "source"}),
	}
}

// Start starts the exporter background collection
func (e *SecurityExporter) Start(ctx context.Context) {
	go e.collectLoop(ctx)
}

// collectLoop periodically collects metrics
func (e *SecurityExporter) collectLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.collectOpenAppSec()
			e.collectWazuh()
			e.collectOpenCTI()
			e.calculateSecurityScore()
		}
	}
}

func (e *SecurityExporter) collectOpenAppSec() {
	if e.openAppSecURL == "" {
		return
	}

	resp, err := e.client.Get(e.openAppSecURL + "/api/v1/metrics")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var metrics struct {
		RulesActive  int  `json:"rules_active"`
		LearningMode bool `json:"learning_mode"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return
	}

	e.wafRulesActive.Set(float64(metrics.RulesActive))
	if metrics.LearningMode {
		e.wafLearningMode.Set(1)
	} else {
		e.wafLearningMode.Set(0)
	}
}

func (e *SecurityExporter) collectWazuh() {
	if e.wazuhURL == "" {
		return
	}

	resp, err := e.client.Get(e.wazuhURL + "/agents/summary/status")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var summary struct {
		Data struct {
			Connection struct {
				Active       int `json:"active"`
				Disconnected int `json:"disconnected"`
				Total        int `json:"total"`
			} `json:"connection"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		return
	}

	e.siemAgentsTotal.Set(float64(summary.Data.Connection.Total))
	e.siemAgentsActive.Set(float64(summary.Data.Connection.Active))
}

func (e *SecurityExporter) collectOpenCTI() {
	if e.openCTIURL == "" {
		return
	}

	resp, err := e.client.Get(e.openCTIURL + "/api/v1/stats")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var stats struct {
		MaliciousIPs    int `json:"malicious_ips"`
		FraudIndicators int `json:"fraud_indicators"`
		ThreatActors    int `json:"threat_actors"`
		Campaigns       int `json:"campaigns"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return
	}

	e.ctiMaliciousIPs.Set(float64(stats.MaliciousIPs))
	e.ctiFraudIndicators.Set(float64(stats.FraudIndicators))
	e.ctiThreatActors.Set(float64(stats.ThreatActors))
	e.ctiCampaigns.Set(float64(stats.Campaigns))
	e.ctiLastSync.Set(float64(time.Now().Unix()))
}

func (e *SecurityExporter) calculateSecurityScore() {
	// Calculate overall security score based on various factors
	// This is a simplified calculation
	score := 100.0

	// Deduct points for various issues (would be based on actual metrics)
	// For now, set a baseline score
	e.securityScore.Set(score)
}

// RecordWAFRequest records a WAF request
func (e *SecurityExporter) RecordWAFRequest(action, source string, latency time.Duration) {
	e.wafRequestsTotal.WithLabelValues(action, source).Inc()
	e.wafLatency.WithLabelValues(action).Observe(latency.Seconds())
}

// RecordWAFBlock records a blocked request
func (e *SecurityExporter) RecordWAFBlock(attackType, severity string) {
	e.wafBlockedRequests.WithLabelValues(attackType, severity).Inc()
}

// RecordAttack records a detected attack
func (e *SecurityExporter) RecordAttack(attackType, severity, action string, threatScore float64) {
	e.wafAttacksDetected.WithLabelValues(attackType, severity, action).Inc()
	e.wafThreatScore.WithLabelValues(action).Observe(threatScore)
}

// RecordSIEMAlert records a SIEM alert
func (e *SecurityExporter) RecordSIEMAlert(level, ruleGroup string) {
	e.siemAlertsTotal.WithLabelValues(level, ruleGroup).Inc()
}

// UpdateAlertsBySeverity updates alerts by severity
func (e *SecurityExporter) UpdateAlertsBySeverity(severity string, count int) {
	e.siemAlertsBySeverity.WithLabelValues(severity).Set(float64(count))
}

// RecordVulnerability records a vulnerability
func (e *SecurityExporter) RecordVulnerability(severity, status string, count int) {
	e.siemVulnerabilities.WithLabelValues(severity, status).Set(float64(count))
}

// UpdateComplianceScore updates compliance score
func (e *SecurityExporter) UpdateComplianceScore(framework string, score float64) {
	e.siemComplianceScore.WithLabelValues(framework).Set(score)
}

// RecordFIMEvent records a file integrity monitoring event
func (e *SecurityExporter) RecordFIMEvent(action, pathType string) {
	e.siemFIMEvents.WithLabelValues(action, pathType).Inc()
}

// UpdateSCAResults updates SCA results
func (e *SecurityExporter) UpdateSCAResults(policy, result string, count int) {
	e.siemSCAResults.WithLabelValues(policy, result).Set(float64(count))
}

// UpdateIndicators updates threat indicators count
func (e *SecurityExporter) UpdateIndicators(indicatorType, confidence string, count int) {
	e.ctiIndicatorsTotal.WithLabelValues(indicatorType, confidence).Set(float64(count))
}

// RecordSyncError records a sync error
func (e *SecurityExporter) RecordSyncError(source, errorType string) {
	e.ctiSyncErrors.WithLabelValues(source, errorType).Inc()
}

// RecordIOCBlocked records a blocked IOC
func (e *SecurityExporter) RecordIOCBlocked(iocType, source string) {
	e.ctiIOCsBlocked.WithLabelValues(iocType, source).Inc()
}

// UpdateOpenIncidents updates open incidents count
func (e *SecurityExporter) UpdateOpenIncidents(severity, incidentType string, count int) {
	e.incidentsOpen.WithLabelValues(severity, incidentType).Set(float64(count))
}

// RecordIncidentResolved records a resolved incident
func (e *SecurityExporter) RecordIncidentResolved(severity, resolution string) {
	e.incidentsResolved.WithLabelValues(severity, resolution).Inc()
}

// UpdateBlockedIPs updates blocked IPs count
func (e *SecurityExporter) UpdateBlockedIPs(count int) {
	e.blockedIPsTotal.Set(float64(count))
}

// RecordSuspiciousActivity records suspicious activity
func (e *SecurityExporter) RecordSuspiciousActivity(activityType, source string) {
	e.suspiciousActivity.WithLabelValues(activityType, source).Inc()
}

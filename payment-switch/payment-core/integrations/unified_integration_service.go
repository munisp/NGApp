// Package integrations provides a unified integration service for all security and monitoring tools
package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"payment-switch/payment-core/integrations/kubecost"
	"payment-switch/payment-core/integrations/openappsec"
	"payment-switch/payment-core/integrations/opencti"
	"payment-switch/payment-core/integrations/opensearch"
	"payment-switch/payment-core/integrations/wazuh"
)

// UnifiedIntegrationConfig holds configuration for all integrations
type UnifiedIntegrationConfig struct {
	// OpenAppSec configuration
	OpenAppSec openappsec.Config
	
	// OpenCTI configuration
	OpenCTI opencti.Config
	
	// Wazuh configuration
	Wazuh wazuh.Config
	
	// OpenSearch configuration
	OpenSearch opensearch.Config
	
	// Kubecost configuration
	Kubecost kubecost.Config
	
	// Server configuration
	ServerPort int
	
	// Kafka configuration for event streaming
	KafkaBrokers []string
	KafkaTopic   string
	
	// Alert webhook
	AlertWebhookURL string
}

// UnifiedIntegrationService provides a unified interface to all integrations
type UnifiedIntegrationService struct {
	config       UnifiedIntegrationConfig
	
	// Clients
	openAppSec   *openappsec.Client
	openCTI      *opencti.Client
	wazuh        *wazuh.Client
	openSearch   *opensearch.Client
	kubecost     *kubecost.Client
	middleware   *SecurityMiddleware
	
	// HTTP server
	server       *http.Server
	
	// State
	mu           sync.RWMutex
	running      bool
	startTime    time.Time
	
	// Metrics
	eventsProcessed int64
	alertsSent      int64
	errors          int64
}

// NewUnifiedIntegrationService creates a new unified integration service
func NewUnifiedIntegrationService(config UnifiedIntegrationConfig) *UnifiedIntegrationService {
	return &UnifiedIntegrationService{
		config: config,
	}
}

// Start initializes and starts all integrations
func (s *UnifiedIntegrationService) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("service already running")
	}
	s.running = true
	s.startTime = time.Now()
	s.mu.Unlock()
	
	// Initialize OpenAppSec client
	if s.config.OpenAppSec.ManagementURL != "" {
		s.openAppSec = openappsec.NewClient(s.config.OpenAppSec)
		if err := s.openAppSec.Start(ctx); err != nil {
			fmt.Printf("OpenAppSec start warning: %v\n", err)
		}
		
		// Register event handler
		s.openAppSec.RegisterEventHandler(func(event openappsec.SecurityEvent) {
			s.handleSecurityEvent("openappsec", event)
		})
	}
	
	// Initialize OpenCTI client
	if s.config.OpenCTI.URL != "" {
		s.openCTI = opencti.NewClient(s.config.OpenCTI)
		if err := s.openCTI.Start(ctx); err != nil {
			fmt.Printf("OpenCTI start warning: %v\n", err)
		}
	}
	
	// Initialize Wazuh client
	if s.config.Wazuh.ManagerURL != "" {
		s.wazuh = wazuh.NewClient(s.config.Wazuh)
		if err := s.wazuh.Start(ctx); err != nil {
			fmt.Printf("Wazuh start warning: %v\n", err)
		}
		
		// Register alert handler
		s.wazuh.RegisterAlertHandler(func(alert wazuh.Alert) {
			s.handleWazuhAlert(alert)
		})
	}
	
	// Initialize OpenSearch client
	if s.config.OpenSearch.URL != "" {
		s.openSearch = opensearch.NewClient(s.config.OpenSearch)
		if err := s.openSearch.Start(ctx); err != nil {
			fmt.Printf("OpenSearch start warning: %v\n", err)
		}
	}
	
	// Initialize Kubecost client
	if s.config.Kubecost.URL != "" {
		s.kubecost = kubecost.NewClient(s.config.Kubecost)
		if err := s.kubecost.Start(ctx); err != nil {
			fmt.Printf("Kubecost start warning: %v\n", err)
		}
	}
	
	// Initialize security middleware
	s.middleware = NewSecurityMiddleware(APISIXMiddlewareConfig{
		OpenAppSecURL:     s.config.OpenAppSec.AgentURL,
		OpenCTIURL:        s.config.OpenCTI.URL,
		OpenSearchURL:     s.config.OpenSearch.URL,
		EnableWAF:         true,
		EnableThreatIntel: true,
		EnableLogging:     true,
		BlockOnThreat:     true,
		ThreatThreshold:   70,
		LogLevel:          "info",
	})
	s.middleware.SetOpenAppSecClient(s.openAppSec)
	s.middleware.SetOpenCTIClient(s.openCTI)
	s.middleware.SetOpenSearchClient(s.openSearch)
	
	// Start HTTP server
	if s.config.ServerPort > 0 {
		go s.startHTTPServer(ctx)
	}
	
	// Start background tasks
	go s.syncThreatIntelToWAF(ctx)
	go s.cleanupExpiredBlocks(ctx)
	
	return nil
}

// Stop stops all integrations
func (s *UnifiedIntegrationService) Stop(ctx context.Context) error {
	s.mu.Lock()
	s.running = false
	s.mu.Unlock()
	
	if s.server != nil {
		return s.server.Shutdown(ctx)
	}
	
	return nil
}

// startHTTPServer starts the HTTP API server
func (s *UnifiedIntegrationService) startHTTPServer(ctx context.Context) {
	mux := http.NewServeMux()
	
	// Health endpoints
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/ready", s.handleReady)
	
	// Metrics endpoint
	mux.HandleFunc("/metrics", s.handleMetrics)
	
	// Security endpoints
	mux.HandleFunc("/api/v1/security/check", s.handleSecurityCheck)
	mux.HandleFunc("/api/v1/security/block-ip", s.handleBlockIP)
	mux.HandleFunc("/api/v1/security/unblock-ip", s.handleUnblockIP)
	mux.HandleFunc("/api/v1/security/blocked-ips", s.handleBlockedIPs)
	
	// Threat intelligence endpoints
	mux.HandleFunc("/api/v1/threat-intel/indicators", s.handleThreatIndicators)
	mux.HandleFunc("/api/v1/threat-intel/malicious-ips", s.handleMaliciousIPs)
	mux.HandleFunc("/api/v1/threat-intel/sync", s.handleThreatSync)
	
	// SIEM endpoints
	mux.HandleFunc("/api/v1/siem/alerts", s.handleSIEMAlerts)
	mux.HandleFunc("/api/v1/siem/agents", s.handleSIEMAgents)
	mux.HandleFunc("/api/v1/siem/vulnerabilities", s.handleVulnerabilities)
	
	// Log analytics endpoints
	mux.HandleFunc("/api/v1/logs/search", s.handleLogSearch)
	mux.HandleFunc("/api/v1/logs/security-events", s.handleSecurityEvents)
	mux.HandleFunc("/api/v1/logs/transactions", s.handleTransactionLogs)
	
	// Cost monitoring endpoints
	mux.HandleFunc("/api/v1/cost/report", s.handleCostReport)
	mux.HandleFunc("/api/v1/cost/by-namespace", s.handleCostByNamespace)
	mux.HandleFunc("/api/v1/cost/recommendations", s.handleCostRecommendations)
	mux.HandleFunc("/api/v1/cost/efficiency", s.handleClusterEfficiency)
	
	// Dashboard data endpoint
	mux.HandleFunc("/api/v1/dashboard/security", s.handleSecurityDashboard)
	mux.HandleFunc("/api/v1/dashboard/cost", s.handleCostDashboard)
	mux.HandleFunc("/api/v1/dashboard/operations", s.handleOperationsDashboard)
	
	s.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.config.ServerPort),
		Handler: mux,
	}
	
	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Printf("HTTP server error: %v\n", err)
	}
}

// handleHealth handles health check requests
func (s *UnifiedIntegrationService) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"uptime": time.Since(s.startTime).String(),
	})
}

// handleReady handles readiness check requests
func (s *UnifiedIntegrationService) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	status := map[string]interface{}{
		"ready": true,
		"components": map[string]bool{},
	}
	
	components := status["components"].(map[string]bool)
	
	if s.openAppSec != nil {
		components["openappsec"] = s.openAppSec.HealthCheck(ctx) == nil
	}
	if s.openCTI != nil {
		components["opencti"] = s.openCTI.HealthCheck(ctx) == nil
	}
	if s.wazuh != nil {
		components["wazuh"] = s.wazuh.HealthCheck(ctx) == nil
	}
	if s.openSearch != nil {
		components["opensearch"] = s.openSearch.HealthCheck(ctx) == nil
	}
	if s.kubecost != nil {
		components["kubecost"] = s.kubecost.HealthCheck(ctx) == nil
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// handleMetrics handles metrics requests
func (s *UnifiedIntegrationService) handleMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	metrics := map[string]interface{}{
		"uptime_seconds":    time.Since(s.startTime).Seconds(),
		"events_processed":  s.eventsProcessed,
		"alerts_sent":       s.alertsSent,
		"errors":            s.errors,
	}
	s.mu.RUnlock()
	
	if s.openAppSec != nil {
		metrics["openappsec"] = s.openAppSec.GetSecurityMetrics()
	}
	if s.openCTI != nil {
		metrics["opencti"] = s.openCTI.GetStats()
	}
	if s.wazuh != nil {
		metrics["wazuh"] = s.wazuh.GetStats()
	}
	if s.openSearch != nil {
		metrics["opensearch"] = s.openSearch.GetStats()
	}
	if s.kubecost != nil {
		metrics["kubecost"] = s.kubecost.GetStats()
	}
	if s.middleware != nil {
		metrics["middleware"] = s.middleware.GetMetrics()
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// handleSecurityCheck handles security check requests
func (s *UnifiedIntegrationService) handleSecurityCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req SecurityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	resp, err := s.middleware.ProcessRequest(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleBlockIP handles IP blocking requests
func (s *UnifiedIntegrationService) handleBlockIP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		IP       string `json:"ip"`
		Reason   string `json:"reason"`
		Duration string `json:"duration"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	duration, _ := time.ParseDuration(req.Duration)
	if duration == 0 {
		duration = 24 * time.Hour
	}
	
	if s.openAppSec != nil {
		if err := s.openAppSec.BlockIP(r.Context(), req.IP, req.Reason, duration); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "blocked",
		"ip":       req.IP,
		"duration": duration.String(),
	})
}

// handleUnblockIP handles IP unblocking requests
func (s *UnifiedIntegrationService) handleUnblockIP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		IP string `json:"ip"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if s.openAppSec != nil {
		if err := s.openAppSec.UnblockIP(r.Context(), req.IP); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "unblocked",
		"ip":     req.IP,
	})
}

// handleBlockedIPs handles blocked IPs list requests
func (s *UnifiedIntegrationService) handleBlockedIPs(w http.ResponseWriter, r *http.Request) {
	metrics := s.middleware.GetMetrics()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"blocked_count": metrics["blocked_ips"],
	})
}

// handleThreatIndicators handles threat indicator requests
func (s *UnifiedIntegrationService) handleThreatIndicators(w http.ResponseWriter, r *http.Request) {
	if s.openCTI == nil {
		http.Error(w, "OpenCTI not configured", http.StatusServiceUnavailable)
		return
	}
	
	indicators := s.openCTI.GetFraudIndicators()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(indicators)
}

// handleMaliciousIPs handles malicious IPs requests
func (s *UnifiedIntegrationService) handleMaliciousIPs(w http.ResponseWriter, r *http.Request) {
	if s.openCTI == nil {
		http.Error(w, "OpenCTI not configured", http.StatusServiceUnavailable)
		return
	}
	
	ips := s.openCTI.GetMaliciousIPs()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ips)
}

// handleThreatSync handles threat intelligence sync requests
func (s *UnifiedIntegrationService) handleThreatSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Trigger sync
	go s.syncThreatIntelToWAFOnce(r.Context())
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "sync_triggered",
	})
}

// handleSIEMAlerts handles SIEM alerts requests
func (s *UnifiedIntegrationService) handleSIEMAlerts(w http.ResponseWriter, r *http.Request) {
	if s.wazuh == nil {
		http.Error(w, "Wazuh not configured", http.StatusServiceUnavailable)
		return
	}
	
	alerts := s.wazuh.GetRecentAlerts(100)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}

// handleSIEMAgents handles SIEM agents requests
func (s *UnifiedIntegrationService) handleSIEMAgents(w http.ResponseWriter, r *http.Request) {
	if s.wazuh == nil {
		http.Error(w, "Wazuh not configured", http.StatusServiceUnavailable)
		return
	}
	
	agents := s.wazuh.GetAgents()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(agents)
}

// handleVulnerabilities handles vulnerability requests
func (s *UnifiedIntegrationService) handleVulnerabilities(w http.ResponseWriter, r *http.Request) {
	if s.wazuh == nil {
		http.Error(w, "Wazuh not configured", http.StatusServiceUnavailable)
		return
	}
	
	vulns := s.wazuh.GetVulnerabilities()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(vulns)
}

// handleLogSearch handles log search requests
func (s *UnifiedIntegrationService) handleLogSearch(w http.ResponseWriter, r *http.Request) {
	if s.openSearch == nil {
		http.Error(w, "OpenSearch not configured", http.StatusServiceUnavailable)
		return
	}
	
	service := r.URL.Query().Get("service")
	level := r.URL.Query().Get("level")
	
	from := time.Now().Add(-24 * time.Hour)
	to := time.Now()
	
	result, err := s.openSearch.SearchLogs(r.Context(), service, level, from, to, 100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// handleSecurityEvents handles security events requests
func (s *UnifiedIntegrationService) handleSecurityEvents(w http.ResponseWriter, r *http.Request) {
	if s.openSearch == nil {
		http.Error(w, "OpenSearch not configured", http.StatusServiceUnavailable)
		return
	}
	
	severity := r.URL.Query().Get("severity")
	
	from := time.Now().Add(-24 * time.Hour)
	to := time.Now()
	
	result, err := s.openSearch.SearchSecurityEvents(r.Context(), severity, from, to, 100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// handleTransactionLogs handles transaction log requests
func (s *UnifiedIntegrationService) handleTransactionLogs(w http.ResponseWriter, r *http.Request) {
	if s.openSearch == nil {
		http.Error(w, "OpenSearch not configured", http.StatusServiceUnavailable)
		return
	}
	
	from := time.Now().Add(-24 * time.Hour)
	to := time.Now()
	
	metrics, err := s.openSearch.GetTransactionMetrics(r.Context(), from, to)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// handleCostReport handles cost report requests
func (s *UnifiedIntegrationService) handleCostReport(w http.ResponseWriter, r *http.Request) {
	if s.kubecost == nil {
		http.Error(w, "Kubecost not configured", http.StatusServiceUnavailable)
		return
	}
	
	window := r.URL.Query().Get("window")
	if window == "" {
		window = "7d"
	}
	
	report, err := s.kubecost.GenerateCostReport(r.Context(), window)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

// handleCostByNamespace handles cost by namespace requests
func (s *UnifiedIntegrationService) handleCostByNamespace(w http.ResponseWriter, r *http.Request) {
	if s.kubecost == nil {
		http.Error(w, "Kubecost not configured", http.StatusServiceUnavailable)
		return
	}
	
	window := r.URL.Query().Get("window")
	if window == "" {
		window = "7d"
	}
	
	costs, err := s.kubecost.GetCostByNamespace(r.Context(), window)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(costs)
}

// handleCostRecommendations handles cost recommendations requests
func (s *UnifiedIntegrationService) handleCostRecommendations(w http.ResponseWriter, r *http.Request) {
	if s.kubecost == nil {
		http.Error(w, "Kubecost not configured", http.StatusServiceUnavailable)
		return
	}
	
	recommendations := s.kubecost.GetRecommendations()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recommendations)
}

// handleClusterEfficiency handles cluster efficiency requests
func (s *UnifiedIntegrationService) handleClusterEfficiency(w http.ResponseWriter, r *http.Request) {
	if s.kubecost == nil {
		http.Error(w, "Kubecost not configured", http.StatusServiceUnavailable)
		return
	}
	
	efficiency, err := s.kubecost.GetClusterEfficiency(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(efficiency)
}

// handleSecurityDashboard handles security dashboard data requests
func (s *UnifiedIntegrationService) handleSecurityDashboard(w http.ResponseWriter, r *http.Request) {
	dashboard := map[string]interface{}{
		"timestamp": time.Now(),
	}
	
	if s.openAppSec != nil {
		dashboard["waf_metrics"] = s.openAppSec.GetSecurityMetrics()
	}
	if s.openCTI != nil {
		dashboard["threat_intel"] = s.openCTI.GetStats()
		dashboard["malicious_ips_count"] = len(s.openCTI.GetMaliciousIPs())
	}
	if s.wazuh != nil {
		dashboard["siem_stats"] = s.wazuh.GetStats()
		dashboard["recent_alerts"] = s.wazuh.GetRecentAlerts(10)
	}
	if s.middleware != nil {
		dashboard["middleware_metrics"] = s.middleware.GetMetrics()
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dashboard)
}

// handleCostDashboard handles cost dashboard data requests
func (s *UnifiedIntegrationService) handleCostDashboard(w http.ResponseWriter, r *http.Request) {
	if s.kubecost == nil {
		http.Error(w, "Kubecost not configured", http.StatusServiceUnavailable)
		return
	}
	
	report := s.kubecost.GetLastReport()
	if report == nil {
		http.Error(w, "No cost data available", http.StatusServiceUnavailable)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

// handleOperationsDashboard handles operations dashboard data requests
func (s *UnifiedIntegrationService) handleOperationsDashboard(w http.ResponseWriter, r *http.Request) {
	dashboard := map[string]interface{}{
		"timestamp": time.Now(),
	}
	
	if s.openSearch != nil {
		nocData, err := s.openSearch.GetNOCDashboardData(r.Context())
		if err == nil {
			dashboard["noc_data"] = nocData
		}
		dashboard["opensearch_stats"] = s.openSearch.GetStats()
	}
	
	s.mu.RLock()
	dashboard["service_uptime"] = time.Since(s.startTime).String()
	dashboard["events_processed"] = s.eventsProcessed
	dashboard["alerts_sent"] = s.alertsSent
	dashboard["errors"] = s.errors
	s.mu.RUnlock()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dashboard)
}

// handleSecurityEvent handles security events from OpenAppSec
func (s *UnifiedIntegrationService) handleSecurityEvent(source string, event openappsec.SecurityEvent) {
	s.mu.Lock()
	s.eventsProcessed++
	s.mu.Unlock()
	
	// Log to OpenSearch
	if s.openSearch != nil {
		s.openSearch.IndexSecurityEvent(opensearch.SecurityEvent{
			Timestamp:   event.Timestamp,
			EventType:   event.EventType,
			Severity:    event.Severity,
			Source:      source,
			SourceIP:    event.SourceIP,
			DestIP:      event.DestinationIP,
			Action:      event.Action,
			Resource:    event.RequestPath,
			Result:      event.Action,
			Description: event.AttackDetails,
			RuleID:      event.RuleID,
			Metadata: map[string]interface{}{
				"attack_type": event.AttackType,
				"confidence":  event.Confidence,
				"user_agent":  event.UserAgent,
			},
		})
	}
}

// handleWazuhAlert handles alerts from Wazuh
func (s *UnifiedIntegrationService) handleWazuhAlert(alert wazuh.Alert) {
	s.mu.Lock()
	s.eventsProcessed++
	s.mu.Unlock()
	
	// Log to OpenSearch
	if s.openSearch != nil {
		s.openSearch.IndexSecurityEvent(opensearch.SecurityEvent{
			Timestamp:   alert.Timestamp,
			EventType:   "siem_alert",
			Severity:    s.wazuhLevelToSeverity(alert.Rule.Level),
			Source:      "wazuh",
			SourceIP:    alert.SrcIP,
			DestIP:      alert.DstIP,
			Action:      "alert",
			Resource:    alert.Location,
			Result:      "detected",
			Description: alert.Rule.Description,
			RuleID:      alert.Rule.ID,
			AlertID:     alert.ID,
			MITRE:       s.extractMITRE(alert.Rule.MITRE),
			Compliance:  s.extractCompliance(alert.Rule),
			RawLog:      alert.FullLog,
		})
	}
}

// wazuhLevelToSeverity converts Wazuh level to severity
func (s *UnifiedIntegrationService) wazuhLevelToSeverity(level int) string {
	switch {
	case level >= 15:
		return "critical"
	case level >= 12:
		return "high"
	case level >= 7:
		return "medium"
	case level >= 4:
		return "low"
	default:
		return "info"
	}
}

// extractMITRE extracts MITRE ATT&CK IDs
func (s *UnifiedIntegrationService) extractMITRE(mitre *wazuh.MITRE) []string {
	if mitre == nil {
		return nil
	}
	return mitre.ID
}

// extractCompliance extracts compliance frameworks
func (s *UnifiedIntegrationService) extractCompliance(rule wazuh.AlertRule) []string {
	var compliance []string
	compliance = append(compliance, rule.PCI_DSS...)
	compliance = append(compliance, rule.GDPR...)
	compliance = append(compliance, rule.HIPAA...)
	compliance = append(compliance, rule.NIST...)
	return compliance
}

// syncThreatIntelToWAF syncs threat intelligence to WAF periodically
func (s *UnifiedIntegrationService) syncThreatIntelToWAF(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncThreatIntelToWAFOnce(ctx)
		}
	}
}

// syncThreatIntelToWAFOnce performs a single sync
func (s *UnifiedIntegrationService) syncThreatIntelToWAFOnce(ctx context.Context) {
	if s.openCTI == nil || s.openAppSec == nil {
		return
	}
	
	// Get malicious IPs from OpenCTI
	ips := s.openCTI.GetMaliciousIPs()
	
	// Convert to OpenAppSec format
	var iocs []openappsec.ThreatIntelligence
	for _, ip := range ips {
		iocs = append(iocs, openappsec.ThreatIntelligence{
			IPAddress:   ip.IP,
			ThreatType:  ip.ThreatType,
			ThreatScore: float64(ip.Score) / 100.0,
			Source:      "opencti",
			FirstSeen:   ip.FirstSeen,
			LastSeen:    ip.LastSeen,
			IsBlocked:   ip.IsBlocked,
		})
	}
	
	// Sync to OpenAppSec
	if err := s.openAppSec.SyncWithOpenCTI(ctx, iocs); err != nil {
		s.mu.Lock()
		s.errors++
		s.mu.Unlock()
	}
}

// cleanupExpiredBlocks cleans up expired IP blocks
func (s *UnifiedIntegrationService) cleanupExpiredBlocks(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if s.middleware != nil {
				s.middleware.CleanupExpiredBlocks()
			}
		}
	}
}

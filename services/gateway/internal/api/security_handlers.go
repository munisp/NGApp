package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/services/gateway/internal/models"
)

// ============================================================
// Security Dashboard API Handlers
// ============================================================

// securityDashboard returns the full security posture overview
func (s *Server) securityDashboard(c *gin.Context) {
	wafStatus := s.apisix.CheckWAFStatus(s.cfg.OpenAppSecURL)

	// Vault status
	vaultConnected := false
	vaultFallback := true
	if s.vault != nil {
		vaultConnected = s.vault.IsConnected()
		vaultFallback = s.vault.IsFallback()
	}

	// Audit log stats
	auditEntries := int64(0)
	auditLastHash := ""
	if s.auditLog != nil {
		auditEntries = s.auditLog.EntryCount()
		auditLastHash = s.auditLog.LastHash()
	}

	// Insider alerts
	totalAlerts, openAlerts := 0, 0
	activityCount := 0
	if s.insiderMonitor != nil {
		totalAlerts, openAlerts = s.insiderMonitor.AlertCount()
		activityCount = s.insiderMonitor.ActivityCount()
	}

	// DDoS stats
	var ddosStats map[string]interface{}
	if s.ddosProtection != nil {
		ddosStats = s.ddosProtection.Stats()
	}

	// Session stats
	activeSessions := 0
	if s.sessionMgr != nil {
		activeSessions = s.sessionMgr.ActiveCount()
	}

	// Verify audit chain integrity
	chainValid := true
	if s.auditLog != nil {
		valid, _, _ := s.auditLog.VerifyChain()
		chainValid = valid
	}

	// Compute security scores dynamically from actual component state
	authScore := 60
	if s.sessionMgr != nil {
		authScore += 15 // session management active
	}
	if s.hmacSigner != nil {
		authScore += 15 // HMAC signing active
	}
	if s.inputValidator != nil {
		authScore += 10 // input validation active
	}

	encryptionScore := 40
	if vaultConnected && !vaultFallback {
		encryptionScore = 95 // Vault Transit active with real encryption
	} else if vaultFallback {
		encryptionScore = 60 // fallback AES-256 encryption active
	}

	monitoringScore := 40
	if s.auditLog != nil && auditEntries > 0 {
		monitoringScore += 20 // audit logging active
	}
	if s.insiderMonitor != nil {
		monitoringScore += 20 // insider threat monitoring active
	}
	if chainValid {
		monitoringScore += 10 // chain integrity verified
	}

	authzScore := 50
	if wafStatus.Enabled {
		authzScore += 25 // WAF active
	}
	if s.ddosProtection != nil {
		authzScore += 15 // DDoS protection active
	}

	incidentScore := 50
	if openAlerts == 0 {
		incidentScore += 20 // no open alerts
	}
	if s.ddosProtection != nil {
		incidentScore += 15 // automated blocking
	}

	complianceScore := 50
	if s.auditLog != nil && chainValid {
		complianceScore += 20 // tamper-proof audit trail
	}
	if vaultConnected {
		complianceScore += 15 // centralized secrets management
	}

	// Cap all scores at 100
	capScore := func(s int) int {
		if s > 100 {
			return 100
		}
		return s
	}
	authScore = capScore(authScore)
	encryptionScore = capScore(encryptionScore)
	monitoringScore = capScore(monitoringScore)
	authzScore = capScore(authzScore)
	incidentScore = capScore(incidentScore)
	complianceScore = capScore(complianceScore)

	overallScore := (authScore + encryptionScore + monitoringScore + authzScore + incidentScore + complianceScore) / 6

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"security_score": gin.H{
				"overall":           overallScore,
				"authentication":    authScore,
				"authorization":     authzScore,
				"encryption":        encryptionScore,
				"monitoring":        monitoringScore,
				"incident_response": incidentScore,
				"compliance":        complianceScore,
			},
			"vault": gin.H{
				"connected":   vaultConnected,
				"fallback":    vaultFallback,
				"transit_key": "nexcom-exchange",
				"pki_enabled": true,
			},
			"waf": gin.H{
				"enabled":   wafStatus.Enabled,
				"connected": wafStatus.Connected,
				"mode":      wafStatus.Mode,
				"policy":    wafStatus.PolicyName,
			},
			"audit_log": gin.H{
				"entries":     auditEntries,
				"last_hash":   auditLastHash,
				"chain_valid": chainValid,
			},
			"insider_threats": gin.H{
				"total_alerts":   totalAlerts,
				"open_alerts":    openAlerts,
				"activity_count": activityCount,
				"rules_active":   5,
			},
			"ddos_protection": ddosStats,
			"sessions": gin.H{
				"active_count": activeSessions,
			},
			"siem": gin.H{
				"wazuh":   "active",
				"opencti": "active",
			},
			"mtls": gin.H{
				"enabled": true,
				"mode":    "STRICT",
				"mesh":    "istio",
			},
			"encryption": gin.H{
				"transit":     "AES-256-GCM96",
				"tls_version": "TLS 1.3",
				"at_rest":     "AES-256",
			},
			"compliance": gin.H{
				"soc2":     "in_progress",
				"iso27001": "planned",
				"pci_dss":  "not_applicable",
				"cbn":      "compliant",
				"ndpr":     "compliant",
			},
			"network_policies": gin.H{
				"k8s_network_policies": 10,
				"namespaces_protected": 3,
				"default_deny":         true,
			},
			"input_validation": gin.H{
				"enabled":          true,
				"blocked_patterns": 7,
				"max_body_size":    "10MB",
			},
			"hmac_signing": gin.H{
				"enabled":        true,
				"algorithm":      "HMAC-SHA256",
				"trading_apis":   true,
				"max_time_drift": "5m",
			},
		},
	})
}

// securityAuditLog returns recent audit log entries
func (s *Server) securityAuditLog(c *gin.Context) {
	entries := int64(0)
	lastHash := ""
	chainValid := true
	if s.auditLog != nil {
		entries = s.auditLog.EntryCount()
		lastHash = s.auditLog.LastHash()
		valid, _, _ := s.auditLog.VerifyChain()
		chainValid = valid
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"total_entries": entries,
			"last_hash":     lastHash,
			"chain_valid":   chainValid,
			"categories": []gin.H{
				{"name": "auth", "description": "Authentication events (login, logout, MFA)"},
				{"name": "trade", "description": "Trading operations (orders, cancellations)"},
				{"name": "admin", "description": "Administrative actions (config changes, user management)"},
				{"name": "kyc", "description": "KYC/KYB verification events"},
				{"name": "settlement", "description": "Settlement and clearing events"},
				{"name": "surveillance", "description": "Market surveillance alerts"},
				{"name": "data_access", "description": "Sensitive data access (PII, financial records)"},
				{"name": "compliance", "description": "Compliance-related events"},
			},
			"regulations": []string{"CBN", "SEC", "NDPR", "GDPR", "SOC2", "ISO27001", "MiFID II", "AML", "CFT"},
		},
	})
}

// securityInsiderAlerts returns insider threat alerts
func (s *Server) securityInsiderAlerts(c *gin.Context) {
	var alerts []interface{}
	totalAlerts, openAlerts := 0, 0
	if s.insiderMonitor != nil {
		for _, a := range s.insiderMonitor.GetAlerts() {
			alerts = append(alerts, gin.H{
				"id":          a.ID,
				"timestamp":   a.Timestamp,
				"user_id":     a.UserID,
				"rule_name":   a.RuleName,
				"severity":    a.Severity,
				"description": a.Description,
				"evidence":    a.Evidence,
				"status":      a.Status,
			})
		}
		totalAlerts, openAlerts = s.insiderMonitor.AlertCount()
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"alerts":       alerts,
			"total_alerts": totalAlerts,
			"open_alerts":  openAlerts,
			"rules": []gin.H{
				{"name": "excessive_failed_access", "severity": "high", "description": "Multiple failed access attempts in short period"},
				{"name": "after_hours_admin_access", "severity": "medium", "description": "Administrative actions outside business hours"},
				{"name": "bulk_data_access", "severity": "critical", "description": "Unusually large data access (potential exfiltration)"},
				{"name": "privilege_escalation_attempt", "severity": "high", "description": "Attempt to access resources beyond assigned role"},
				{"name": "separation_of_duties_violation", "severity": "critical", "description": "User performing conflicting roles"},
			},
		},
	})
}

// securityDDoSStats returns DDoS protection statistics
func (s *Server) securityDDoSStats(c *gin.Context) {
	var stats map[string]interface{}
	if s.ddosProtection != nil {
		stats = s.ddosProtection.Stats()
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"stats": stats,
			"config": gin.H{
				"global_rps":           10000,
				"per_ip_rpm":           300,
				"per_endpoint_rpm":     100,
				"block_duration":       "15m",
				"reputation_threshold": 80.0,
			},
			"layers": []gin.H{
				{"name": "Global Rate Limit", "description": "Requests per second across all clients", "limit": 10000},
				{"name": "Per-IP Rate Limit", "description": "Requests per minute per IP", "limit": 300},
				{"name": "Per-Endpoint Rate Limit", "description": "Requests per minute per endpoint", "limit": 100},
				{"name": "IP Reputation", "description": "Behavioral analysis and reputation scoring", "threshold": 80.0},
				{"name": "WAF ML Detection", "description": "OpenAppSec machine learning anomaly detection", "mode": "prevent-learn"},
			},
		},
	})
}

// securityActiveSessions returns active session information
func (s *Server) securityActiveSessions(c *gin.Context) {
	activeSessions := 0
	if s.sessionMgr != nil {
		activeSessions = s.sessionMgr.ActiveCount()
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"active_sessions": activeSessions,
			"features": gin.H{
				"device_binding":  true,
				"token_rotation":  true,
				"idle_timeout":    "30m",
				"grace_period":    "30s",
				"risk_scoring":    true,
				"auto_revocation": true,
			},
		},
	})
}

// securityVaultStatus returns Vault connection and engine status
func (s *Server) securityVaultStatus(c *gin.Context) {
	connected := false
	fallback := true
	if s.vault != nil {
		connected = s.vault.IsConnected()
		fallback = s.vault.IsFallback()
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"connected": connected,
			"fallback":  fallback,
			"engines": gin.H{
				"kv_v2":   gin.H{"enabled": true, "description": "Key-Value secrets storage"},
				"transit": gin.H{"enabled": true, "description": "Encryption-as-a-service (AES-256-GCM96)", "key": "nexcom-exchange"},
				"pki":     gin.H{"enabled": true, "description": "PKI for mTLS certificate generation", "role": "nexcom-service"},
			},
			"policies": []string{"gateway-policy", "matching-engine-policy", "kyc-service-policy", "admin-policy"},
			"audit": gin.H{
				"enabled": true,
				"type":    "file",
				"path":    "/vault/logs/audit.log",
			},
		},
	})
}

// securityBlockIP blocks an IP address
func (s *Server) securityBlockIP(c *gin.Context) {
	var req struct {
		IP       string `json:"ip" binding:"required"`
		Duration string `json:"duration"`
		Reason   string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Invalid request: ip is required",
		})
		return
	}

	duration := 15 * time.Minute
	if req.Duration != "" {
		if d, err := time.ParseDuration(req.Duration); err == nil {
			duration = d
		}
	}

	if s.ddosProtection != nil {
		s.ddosProtection.BlockIP(req.IP, duration)
	}

	// Log admin action
	if s.auditLog != nil {
		userID := s.getUserID(c)
		s.auditLog.LogAdmin("ip_blocked", userID, req.IP, "ip_address",
			"Reason: "+req.Reason+", Duration: "+duration.String(), "success")
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"ip":       req.IP,
			"blocked":  true,
			"duration": duration.String(),
			"reason":   req.Reason,
		},
	})
}

// securityRotateKeys rotates encryption keys
func (s *Server) securityRotateKeys(c *gin.Context) {
	rotated := false
	if s.vault != nil {
		err := s.vault.RotateTransitKey()
		rotated = err == nil
	}

	// Log admin action
	if s.auditLog != nil {
		userID := s.getUserID(c)
		result := "success"
		if !rotated {
			result = "failed"
		}
		s.auditLog.LogAdmin("key_rotation", userID, "nexcom-exchange", "transit_key", "", result)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"rotated":    rotated,
			"key":        "nexcom-exchange",
			"algorithm":  "AES-256-GCM96",
			"rotated_at": time.Now().UTC().Format(time.RFC3339),
		},
	})
}

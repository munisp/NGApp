package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// PermissionTier controls what agents can do autonomously
type PermissionTier string

const (
	TierObserve              PermissionTier = "observe"
	TierSuggest              PermissionTier = "suggest"
	TierDraft                PermissionTier = "draft"
	TierExecuteWithApproval  PermissionTier = "execute_with_approval"
	TierFullyAutonomous      PermissionTier = "fully_autonomous"
)

type AgentConfig struct {
	AgentID         string         `json:"agent_id"`
	Name            string         `json:"name"`
	PermissionTier  PermissionTier `json:"permission_tier"`
	IsActive        bool           `json:"is_active"`
	MaxTokensPerDay int            `json:"max_tokens_per_day"`
	MaxCostPerDay   float64        `json:"max_cost_per_day_usd"`
	AllowedActions  []string       `json:"allowed_actions"`
	ApprovalRequired bool          `json:"approval_required"`
	CreatedAt       time.Time      `json:"created_at"`
}

type AuditEntry struct {
	ID              string    `json:"id"`
	AgentID         string    `json:"agent_id"`
	Action          string    `json:"action"`
	InputSummary    string    `json:"input_summary"`
	OutputSummary   string    `json:"output_summary"`
	PermissionTier  string    `json:"permission_tier"`
	TokensUsed      int       `json:"tokens_used"`
	CostUSD         float64   `json:"cost_usd"`
	TenantID        string    `json:"tenant_id"`
	ApprovedBy      string    `json:"approved_by,omitempty"`
	Timestamp       time.Time `json:"timestamp"`
}

type GovernanceDashboard struct {
	TotalAgents       int     `json:"total_agents"`
	ActiveAgents      int     `json:"active_agents"`
	TotalActionsToday int     `json:"total_actions_today"`
	TotalTokensToday  int     `json:"total_tokens_today"`
	TotalCostToday    float64 `json:"total_cost_today_usd"`
	PendingApprovals  int     `json:"pending_approvals"`
	ErrorRate         float64 `json:"error_rate_pct"`
}

func main() {
	r := gin.Default()

	api := r.Group("/api/v1/agents")
	{
		api.GET("/governance", func(c *gin.Context) {
			c.JSON(http.StatusOK, GovernanceDashboard{
				TotalAgents:       5,
				ActiveAgents:      3,
				TotalActionsToday: 142,
				TotalTokensToday:  28400,
				TotalCostToday:    0.057,
				PendingApprovals:  2,
				ErrorRate:         1.4,
			})
		})

		api.GET("/configs", func(c *gin.Context) {
			configs := []AgentConfig{
				{AgentID: "sales-agent-v1", Name: "Sales Prospector", PermissionTier: TierDraft, IsActive: true, MaxTokensPerDay: 50000, MaxCostPerDay: 0.10, AllowedActions: []string{"research", "draft_outreach", "score_lead"}, CreatedAt: time.Now()},
				{AgentID: "cs-agent-v1", Name: "Customer Success Monitor", PermissionTier: TierSuggest, IsActive: true, MaxTokensPerDay: 30000, MaxCostPerDay: 0.06, AllowedActions: []string{"analyze_health", "generate_playbook"}, CreatedAt: time.Now()},
				{AgentID: "compliance-agent-v1", Name: "Compliance Checker", PermissionTier: TierObserve, IsActive: true, MaxTokensPerDay: 20000, MaxCostPerDay: 0.04, AllowedActions: []string{"check_compliance", "flag_violations"}, CreatedAt: time.Now()},
			}
			c.JSON(http.StatusOK, gin.H{"data": configs})
		})

		api.POST("/kill-switch", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "all_agents_stopped", "timestamp": time.Now()})
		})

		api.GET("/:agentId/audit", func(c *gin.Context) {
			agentID := c.Param("agentId")
			entries := []AuditEntry{
				{ID: "aud-001", AgentID: agentID, Action: "draft_outreach", InputSummary: "Research Dangote Industries", OutputSummary: "Generated personalized outreach for CFO", PermissionTier: "draft", TokensUsed: 2400, CostUSD: 0.0048, TenantID: "acme-bank", Timestamp: time.Now().Add(-1 * time.Hour)},
				{ID: "aud-002", AgentID: agentID, Action: "score_lead", InputSummary: "Score MTN Nigeria lead", OutputSummary: "Score: 78/100, qualified", PermissionTier: "draft", TokensUsed: 800, CostUSD: 0.0016, TenantID: "acme-bank", Timestamp: time.Now().Add(-2 * time.Hour)},
				{ID: "aud-003", AgentID: agentID, Action: "research", InputSummary: "Competitive analysis for Shoprite", OutputSummary: "Identified 3 competitor offerings", PermissionTier: "draft", TokensUsed: 3200, CostUSD: 0.0064, TenantID: "acme-bank", Timestamp: time.Now().Add(-4 * time.Hour)},
			}
			c.JSON(http.StatusOK, gin.H{"agent_id": agentID, "entries": entries, "total": len(entries)})
		})

		api.PUT("/:agentId/config", func(c *gin.Context) {
			agentID := c.Param("agentId")
			var update map[string]interface{}
			if err := c.BindJSON(&update); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"agent_id": agentID, "updated": update, "status": "config_updated"})
		})

		api.POST("/:agentId/approve", func(c *gin.Context) {
			agentID := c.Param("agentId")
			c.JSON(http.StatusOK, gin.H{"agent_id": agentID, "status": "action_approved", "approved_by": "admin", "timestamp": time.Now()})
		})

		api.POST("/:agentId/reject", func(c *gin.Context) {
			agentID := c.Param("agentId")
			c.JSON(http.StatusOK, gin.H{"agent_id": agentID, "status": "action_rejected", "rejected_by": "admin", "timestamp": time.Now()})
		})

		api.GET("/cost-summary", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"daily_cost":   0.057,
				"weekly_cost":  0.342,
				"monthly_cost": 1.368,
				"by_agent": []gin.H{
					{"agent_id": "sales-agent-v1", "cost": 0.028, "tokens": 14000},
					{"agent_id": "cs-agent-v1", "cost": 0.018, "tokens": 9000},
					{"agent_id": "compliance-agent-v1", "cost": 0.011, "tokens": 5400},
				},
				"budget_remaining": 8.632,
				"budget_limit":     10.0,
			})
		})
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "agent-governance"})
	})

	r.Run(":8093")
}

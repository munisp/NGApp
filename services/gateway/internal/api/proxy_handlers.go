package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/services/gateway/internal/models"
)

// proxyGet forwards a GET request to an upstream service and returns the response.
func (s *Server) proxyGet(c *gin.Context, baseURL, path string) {
	url := fmt.Sprintf("%s%s", baseURL, path)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		c.JSON(http.StatusBadGateway, models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("upstream unavailable: %v", err),
		})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.Data(resp.StatusCode, "application/json", body)
		return
	}
	c.JSON(resp.StatusCode, models.APIResponse{Success: true, Data: result})
}

// proxyPost forwards a POST request to an upstream service.
func (s *Server) proxyPost(c *gin.Context, baseURL, path string) {
	url := fmt.Sprintf("%s%s", baseURL, path)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, models.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("upstream unavailable: %v", err),
		})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.Data(resp.StatusCode, "application/json", body)
		return
	}
	c.JSON(resp.StatusCode, models.APIResponse{Success: true, Data: result})
}

// ============================================================
// Matching Engine Proxy Handlers
// ============================================================

func (s *Server) matchingEngineStatus(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/status")
}

func (s *Server) matchingEngineDepth(c *gin.Context) {
	symbol := c.Param("symbol")
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/orderbook/"+symbol)
}

func (s *Server) matchingEngineSymbols(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/symbols")
}

func (s *Server) matchingEngineFutures(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/futures/contracts")
}

func (s *Server) matchingEngineOptions(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/options/contracts")
}

func (s *Server) matchingEnginePositions(c *gin.Context) {
	accountID := c.Param("account_id")
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/clearing/positions/"+accountID)
}

func (s *Server) matchingEngineSurveillance(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/surveillance/alerts")
}

func (s *Server) matchingEngineWarehouses(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/delivery/warehouses")
}

func (s *Server) matchingEngineAudit(c *gin.Context) {
	s.proxyGet(c, s.cfg.MatchingEngineURL, "/api/v1/audit/entries")
}

// ============================================================
// Ingestion Engine Proxy Handlers
// ============================================================

func (s *Server) ingestionFeeds(c *gin.Context) {
	s.proxyGet(c, s.cfg.IngestionEngineURL, "/api/v1/feeds")
}

func (s *Server) ingestionStartFeed(c *gin.Context) {
	id := c.Param("id")
	s.proxyPost(c, s.cfg.IngestionEngineURL, "/api/v1/feeds/"+id+"/start")
}

func (s *Server) ingestionStopFeed(c *gin.Context) {
	id := c.Param("id")
	s.proxyPost(c, s.cfg.IngestionEngineURL, "/api/v1/feeds/"+id+"/stop")
}

func (s *Server) ingestionMetrics(c *gin.Context) {
	s.proxyGet(c, s.cfg.IngestionEngineURL, "/api/v1/feeds/metrics")
}

func (s *Server) ingestionLakehouseStatus(c *gin.Context) {
	s.proxyGet(c, s.cfg.IngestionEngineURL, "/api/v1/lakehouse/status")
}

func (s *Server) ingestionLakehouseCatalog(c *gin.Context) {
	s.proxyGet(c, s.cfg.IngestionEngineURL, "/api/v1/lakehouse/catalog")
}

func (s *Server) ingestionSchemaRegistry(c *gin.Context) {
	s.proxyGet(c, s.cfg.IngestionEngineURL, "/api/v1/schema-registry")
}

func (s *Server) ingestionPipelineStatus(c *gin.Context) {
	s.proxyGet(c, s.cfg.IngestionEngineURL, "/api/v1/pipeline/status")
}

// ============================================================
// Platform Health Aggregator (Improvement #16)
// ============================================================

func (s *Server) platformHealth(c *gin.Context) {
	type serviceHealth struct {
		Name    string `json:"name"`
		Status  string `json:"status"`
		URL     string `json:"url"`
		Latency string `json:"latency,omitempty"`
	}

	services := []serviceHealth{
		{Name: "gateway", Status: "healthy", URL: "localhost:8000"},
		{Name: "kafka", Status: boolToStatus(s.kafka.IsConnected()), URL: s.cfg.KafkaBrokers},
		{Name: "redis", Status: boolToStatus(s.redis.IsConnected()), URL: s.cfg.RedisURL},
		{Name: "temporal", Status: boolToStatus(s.temporal.IsConnected()), URL: s.cfg.TemporalHost},
		{Name: "tigerbeetle", Status: boolToStatus(s.tigerbeetle.IsConnected()), URL: s.cfg.TigerBeetleAddresses},
		{Name: "dapr", Status: boolToStatus(s.dapr.IsConnected()), URL: "localhost:" + s.cfg.DaprHTTPPort},
		{Name: "fluvio", Status: boolToStatus(s.fluvio.IsConnected()), URL: s.cfg.FluvioEndpoint},
		{Name: "keycloak", Status: "configured", URL: s.cfg.KeycloakURL},
		{Name: "permify", Status: boolToStatus(s.permify.IsConnected()), URL: s.cfg.PermifyEndpoint},
	}

	// Check upstream services
	upstreams := []struct {
		name string
		url  string
	}{
		{"matching-engine", s.cfg.MatchingEngineURL},
		{"ingestion-engine", s.cfg.IngestionEngineURL},
	}

	client := &http.Client{Timeout: 3 * time.Second}
	for _, up := range upstreams {
		start := time.Now()
		resp, err := client.Get(up.url + "/health")
		latency := time.Since(start)
		status := "unhealthy"
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				status = "healthy"
			}
		}
		services = append(services, serviceHealth{
			Name:    up.name,
			Status:  status,
			URL:     up.url,
			Latency: latency.String(),
		})
	}

	healthy := 0
	for _, svc := range services {
		if svc.Status == "healthy" || svc.Status == "configured" {
			healthy++
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"platform":        "nexcom-exchange",
			"status":          fmt.Sprintf("%d/%d services healthy", healthy, len(services)),
			"services":        services,
			"timestamp":       time.Now().Format(time.RFC3339),
			"totalServices":   len(services),
			"healthyServices": healthy,
		},
	})
}

func boolToStatus(connected bool) string {
	if connected {
		return "healthy"
	}
	return "unhealthy"
}

// ============================================================
// Accounts CRUD (Improvement #18)
// ============================================================

func (s *Server) listAccounts(c *gin.Context) {
	accounts := s.store.GetAccounts()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"accounts": accounts}})
}

func (s *Server) createAccount(c *gin.Context) {
	var req models.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	account := s.store.CreateAccount(req)
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: account})
}

func (s *Server) getAccount(c *gin.Context) {
	id := c.Param("id")
	account, ok := s.store.GetAccount(id)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "account not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: account})
}

func (s *Server) updateAccount(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	account, ok := s.store.UpdateAccount(id, req)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "account not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: account})
}

func (s *Server) deleteAccount(c *gin.Context) {
	id := c.Param("id")
	if !s.store.DeleteAccount(id) {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "account not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "account deleted"}})
}

// ============================================================
// Audit Log Read (Improvement #18)
// ============================================================

func (s *Server) listAuditLog(c *gin.Context) {
	entries := s.store.GetAuditLog()
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"entries": entries}})
}

func (s *Server) getAuditEntry(c *gin.Context) {
	id := c.Param("id")
	entry, ok := s.store.GetAuditEntry(id)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "audit entry not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: entry})
}

// ============================================================
// WebSocket Endpoints (Improvement #8)
// ============================================================

func (s *Server) wsNotifications(c *gin.Context) {
	// WebSocket upgrade for real-time notifications
	// In production: upgrade to WS, subscribe to user-specific notification channel
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"message": "WebSocket endpoint for notifications",
			"usage":   "Connect via ws://host:8000/api/v1/ws/notifications with Authorization header",
			"events":  []string{"order_filled", "price_alert", "margin_warning", "trade_executed", "settlement_complete"},
		},
	})
}

func (s *Server) wsMarketData(c *gin.Context) {
	// WebSocket upgrade for real-time market data streaming
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"message":  "WebSocket endpoint for market data",
			"usage":    "Connect via ws://host:8000/api/v1/ws/market-data with Authorization header",
			"channels": []string{"ticker", "orderbook", "trades", "candles", "depth"},
		},
	})
}

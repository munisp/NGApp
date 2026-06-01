// Package api provides an internal HTTP API server for the OG-RMM middleware worker.
// Endpoints are consumed by the Node.js tRPC server via HTTP to expose middleware
// status and trigger operations.
package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/og-rmm/middleware/internal/cache"
	"github.com/og-rmm/middleware/internal/kafka"
	"github.com/og-rmm/middleware/internal/ledger"
	"github.com/og-rmm/middleware/internal/temporal"
)

// Server wraps the Gin HTTP server with references to all middleware clients.
type Server struct {
	router   *gin.Engine
	cache    *cache.Client
	ledger   ledger.LedgerClient
	temporal temporal.Worker
	kafka    kafka.Consumer
}

// NewServer constructs the internal API server.
func NewServer(
	cacheClient *cache.Client,
	ledgerClient ledger.LedgerClient,
	temporalWorker temporal.Worker,
	kafkaConsumer kafka.Consumer,
) *Server {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	s := &Server{
		router:   r,
		cache:    cacheClient,
		ledger:   ledgerClient,
		temporal: temporalWorker,
		kafka:    kafkaConsumer,
	}

	s.registerRoutes()
	return s
}

// Run starts the HTTP server on the given address.
func (s *Server) Run(addr string) error {
	return s.router.Run(addr)
}

// Handler returns the underlying http.Handler for use with http.Server.
func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) registerRoutes() {
	v1 := s.router.Group("/v1")

	// Health / status
	v1.GET("/health", s.handleHealth)
	v1.GET("/status", s.handleStatus)

	// Cache
	v1.GET("/cache/stats", s.handleCacheStats)

	// Ledger
	v1.GET("/ledger/balance/:accountId", s.handleLedgerBalance)
	v1.GET("/ledger/transfers/:accountId", s.handleLedgerTransfers)
	v1.POST("/ledger/transfer", s.handleLedgerTransfer)
	v1.POST("/ledger/account", s.handleLedgerCreateAccount)

	// Temporal workflows
	v1.POST("/workflows/start", s.handleWorkflowStart)
	v1.GET("/workflows/:workflowId/status", s.handleWorkflowStatus)
	v1.POST("/workflows/:workflowId/signal", s.handleWorkflowSignal)
	v1.DELETE("/workflows/:workflowId", s.handleWorkflowTerminate)

	// Kafka
	v1.GET("/kafka/stats", s.handleKafkaStats)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func (s *Server) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "timestamp": time.Now()})
}

func (s *Server) handleStatus(c *gin.Context) {
	ctx := c.Request.Context()
	cacheStats, _ := s.cache.Stats(ctx)
	kafkaStats := s.kafka.Stats()

	c.JSON(http.StatusOK, gin.H{
		"version":   "12.0.0",
		"timestamp": time.Now(),
		"services": gin.H{
			"cache": cacheStats,
			"kafka": kafkaStats,
		},
	})
}

func (s *Server) handleCacheStats(c *gin.Context) {
	ctx := c.Request.Context()
	stats, err := s.cache.Stats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (s *Server) handleLedgerBalance(c *gin.Context) {
	accountID := c.Param("accountId")
	ctx := c.Request.Context()
	balance, err := s.ledger.GetAccountBalance(ctx, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, balance)
}

func (s *Server) handleLedgerTransfers(c *gin.Context) {
	accountID := c.Param("accountId")
	ctx := c.Request.Context()
	transfers, err := s.ledger.GetTransfers(ctx, accountID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"transfers": transfers})
}

func (s *Server) handleLedgerTransfer(c *gin.Context) {
	var t ledger.Transfer
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := c.Request.Context()
	if err := s.ledger.CreateTransfer(ctx, t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created"})
}

func (s *Server) handleLedgerCreateAccount(c *gin.Context) {
	var req struct {
		ID     string `json:"id" binding:"required"`
		Ledger uint32 `json:"ledger"`
		Code   uint16 `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := c.Request.Context()
	if err := s.ledger.CreateAccount(ctx, req.ID, req.Ledger, req.Code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created"})
}

func (s *Server) handleWorkflowStart(c *gin.Context) {
	var req struct {
		WorkflowType string `json:"workflowType" binding:"required"`
		Input        any    `json:"input"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := c.Request.Context()
	id, err := s.temporal.StartWorkflow(ctx, req.WorkflowType, req.Input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"workflowId": id})
}

func (s *Server) handleWorkflowStatus(c *gin.Context) {
	workflowID := c.Param("workflowId")
	ctx := c.Request.Context()
	status, err := s.temporal.GetWorkflowStatus(ctx, workflowID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (s *Server) handleWorkflowSignal(c *gin.Context) {
	workflowID := c.Param("workflowId")
	var req struct {
		Signal  string `json:"signal" binding:"required"`
		Payload any    `json:"payload"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := c.Request.Context()
	if err := s.temporal.SignalWorkflow(ctx, workflowID, req.Signal, req.Payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "signalled"})
}

func (s *Server) handleWorkflowTerminate(c *gin.Context) {
	workflowID := c.Param("workflowId")
	reason := c.Query("reason")
	if reason == "" {
		reason = "terminated by operator"
	}
	ctx := c.Request.Context()
	if err := s.temporal.TerminateWorkflow(ctx, workflowID, reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "terminated"})
}

func (s *Server) handleKafkaStats(c *gin.Context) {
	c.JSON(http.StatusOK, s.kafka.Stats())
}

// contextWithTimeout is a helper used by handlers that need a short deadline.
func contextWithTimeout(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, d)
}

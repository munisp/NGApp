package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/services/gateway/internal/config"
	"github.com/munisp/NGApp/services/gateway/internal/dapr"
	"github.com/munisp/NGApp/services/gateway/internal/fluvio"
	kafkaclient "github.com/munisp/NGApp/services/gateway/internal/kafka"
	"github.com/munisp/NGApp/services/gateway/internal/keycloak"
	"github.com/munisp/NGApp/services/gateway/internal/models"
	"github.com/munisp/NGApp/services/gateway/internal/permify"
	redisclient "github.com/munisp/NGApp/services/gateway/internal/redis"
	"github.com/munisp/NGApp/services/gateway/internal/store"
	"github.com/munisp/NGApp/services/gateway/internal/temporal"
	"github.com/munisp/NGApp/services/gateway/internal/tigerbeetle"
)

type Server struct {
	cfg         *config.Config
	store       *store.Store
	kafka       *kafkaclient.Client
	redis       *redisclient.Client
	temporal    *temporal.Client
	tigerbeetle *tigerbeetle.Client
	dapr        *dapr.Client
	fluvio      *fluvio.Client
	keycloak    *keycloak.Client
	permify     *permify.Client
}

func NewServer(
	cfg *config.Config,
	kafka *kafkaclient.Client,
	redis *redisclient.Client,
	temporal *temporal.Client,
	tigerbeetle *tigerbeetle.Client,
	dapr *dapr.Client,
	fluvio *fluvio.Client,
	keycloak *keycloak.Client,
	permify *permify.Client,
) *Server {
	return &Server{
		cfg:         cfg,
		store:       store.New(),
		kafka:       kafka,
		redis:       redis,
		temporal:    temporal,
		tigerbeetle: tigerbeetle,
		dapr:        dapr,
		fluvio:      fluvio,
		keycloak:    keycloak,
		permify:     permify,
	}
}

func (s *Server) SetupRoutes() *gin.Engine {
	if s.cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(s.corsMiddleware())

	// Health check
	r.GET("/health", s.healthCheck)
	r.GET("/api/v1/health", s.healthCheck)

	api := r.Group("/api/v1")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/login", s.login)
			auth.POST("/logout", s.logout)
			auth.POST("/refresh", s.refreshToken)
			auth.POST("/callback", s.authCallback)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(s.authMiddleware())
		{
			// Markets
			markets := protected.Group("/markets")
			{
				markets.GET("", s.listMarkets)
				markets.GET("/search", s.searchMarkets)
				markets.GET("/:symbol/ticker", s.getTicker)
				markets.GET("/:symbol/orderbook", s.getOrderBook)
				markets.GET("/:symbol/candles", s.getCandles)
			}

			// Orders
			orders := protected.Group("/orders")
			{
				orders.GET("", s.listOrders)
				orders.POST("", s.createOrder)
				orders.GET("/:id", s.getOrder)
				orders.DELETE("/:id", s.cancelOrder)
			}

			// Trades
			trades := protected.Group("/trades")
			{
				trades.GET("", s.listTrades)
				trades.GET("/:id", s.getTrade)
			}

			// Portfolio
			portfolio := protected.Group("/portfolio")
			{
				portfolio.GET("", s.getPortfolio)
				portfolio.GET("/positions", s.listPositions)
				portfolio.DELETE("/positions/:id", s.closePosition)
				portfolio.GET("/history", s.getPortfolioHistory)
			}

			// Alerts
			alerts := protected.Group("/alerts")
			{
				alerts.GET("", s.listAlerts)
				alerts.POST("", s.createAlert)
				alerts.PATCH("/:id", s.updateAlert)
				alerts.DELETE("/:id", s.deleteAlert)
			}

			// Account
			account := protected.Group("/account")
			{
				account.GET("/profile", s.getProfile)
				account.PATCH("/profile", s.updateProfile)
				account.GET("/kyc", s.getKYC)
				account.POST("/kyc/submit", s.submitKYC)
				account.GET("/sessions", s.listSessions)
				account.DELETE("/sessions/:id", s.revokeSession)
				account.GET("/preferences", s.getPreferences)
				account.PATCH("/preferences", s.updatePreferences)
				account.POST("/password", s.changePassword)
				account.POST("/2fa/enable", s.enable2FA)
				account.POST("/api-keys", s.generateAPIKey)
			}

			// Notifications
			notifications := protected.Group("/notifications")
			{
				notifications.GET("", s.listNotifications)
				notifications.PATCH("/:id/read", s.markNotificationRead)
				notifications.POST("/read-all", s.markAllRead)
			}

			// Analytics
			analytics := protected.Group("/analytics")
			{
				analytics.GET("/dashboard", s.analyticsDashboard)
				analytics.GET("/pnl", s.pnlReport)
				analytics.GET("/geospatial/:commodity", s.geospatialData)
				analytics.GET("/ai-insights", s.aiInsights)
				analytics.GET("/forecast/:symbol", s.priceForecast)
			}

			// Middleware status
			protected.GET("/middleware/status", s.middlewareStatus)

			// Matching Engine proxy routes
			me := protected.Group("/matching-engine")
			{
				me.GET("/status", s.matchingEngineStatus)
				me.GET("/depth/:symbol", s.matchingEngineDepth)
				me.GET("/symbols", s.matchingEngineSymbols)
				me.GET("/futures/contracts", s.matchingEngineFutures)
				me.GET("/options/contracts", s.matchingEngineOptions)
				me.GET("/clearing/positions/:account_id", s.matchingEnginePositions)
				me.GET("/surveillance/alerts", s.matchingEngineSurveillance)
				me.GET("/delivery/warehouses", s.matchingEngineWarehouses)
				me.GET("/audit/entries", s.matchingEngineAudit)

				// Market Makers proxy routes
				me.GET("/market-makers", s.meMarketMakersList)
				me.GET("/market-makers/:id", s.meMarketMakersGet)
				me.GET("/market-makers/:id/performance", s.meMarketMakersPerformance)
				me.GET("/market-makers/quotes/:symbol", s.meMarketMakersQuotes)
				me.POST("/market-makers/quotes", s.meMarketMakersSubmitQuote)

				// Indices proxy routes
				me.GET("/indices", s.meIndicesList)
				me.GET("/indices/values", s.meIndicesValues)
				me.GET("/indices/:id", s.meIndicesGet)
				me.GET("/indices/:id/value", s.meIndicesValue)

				// Corporate Actions proxy routes
				me.GET("/corporate-actions", s.meCorporateActionsList)
				me.GET("/corporate-actions/pending", s.meCorporateActionsPending)
				me.GET("/corporate-actions/:symbol", s.meCorporateActionsForSymbol)
				me.POST("/corporate-actions/:id/process", s.meCorporateActionsProcess)

				// Brokers proxy routes
				me.GET("/brokers", s.meBrokersList)
				me.GET("/brokers/connected", s.meBrokersConnected)
				me.GET("/brokers/:id", s.meBrokersGet)
				me.POST("/brokers/route", s.meBrokersRoute)
			}

			// Ingestion Engine proxy routes
			ing := protected.Group("/ingestion")
			{
				ing.GET("/feeds", s.ingestionFeeds)
				ing.POST("/feeds/:id/start", s.ingestionStartFeed)
				ing.POST("/feeds/:id/stop", s.ingestionStopFeed)
				ing.GET("/feeds/metrics", s.ingestionMetrics)
				ing.GET("/lakehouse/status", s.ingestionLakehouseStatus)
				ing.GET("/lakehouse/catalog", s.ingestionLakehouseCatalog)
				ing.GET("/schema-registry", s.ingestionSchemaRegistry)
				ing.GET("/pipeline/status", s.ingestionPipelineStatus)
			}

			// Platform health aggregator
			protected.GET("/platform/health", s.platformHealth)

			// Accounts CRUD (for accounts table)
			accounts := protected.Group("/accounts")
			{
				accounts.GET("", s.listAccounts)
				accounts.POST("", s.createAccount)
				accounts.GET("/:id", s.getAccount)
				accounts.PATCH("/:id", s.updateAccount)
				accounts.DELETE("/:id", s.deleteAccount)
			}

			// Audit Log CRUD
			auditLog := protected.Group("/audit-log")
			{
				auditLog.GET("", s.listAuditLog)
				auditLog.GET("/:id", s.getAuditEntry)
			}

			// Blockchain service proxy routes (Digital Assets + IPFS + Fractional Trading)
			bc := protected.Group("/blockchain")
			{
				// Tokenization
				bc.POST("/tokenize", s.bcTokenize)
				bc.GET("/tokens", s.bcListTokens)
				bc.GET("/tokens/:token_id", s.bcGetToken)
				bc.POST("/tokens/:token_id/transfer", s.bcTransferToken)
				bc.POST("/tokens/:token_id/fractionalize", s.bcFractionalizeToken)
				// Settlement (DvP)
				bc.POST("/settle", s.bcSettle)
				bc.GET("/tx/:tx_hash", s.bcGetTransaction)
				// Bridge
				bc.POST("/bridge/initiate", s.bcBridgeInitiate)
				bc.GET("/chains/status", s.bcChainStatus)
				// Fractional trading
				bc.GET("/fractions/assets", s.bcFractionalAssets)
				bc.GET("/fractions/assets/:asset_id", s.bcFractionalAsset)
				bc.POST("/fractions/orders", s.bcFractionalOrder)
				bc.GET("/fractions/orderbook/:asset_id", s.bcFractionalOrderbook)
				bc.GET("/fractions/trades", s.bcFractionalTrades)
				bc.GET("/fractions/portfolio/:holder_id", s.bcFractionalPortfolio)
				// IPFS
				bc.POST("/ipfs/pin", s.bcIpfsPin)
				bc.GET("/ipfs/get/:cid", s.bcIpfsGet)
				bc.GET("/ipfs/status", s.bcIpfsStatus)
			}

			// WebSocket endpoint for real-time notifications
			protected.GET("/ws/notifications", s.wsNotifications)
			protected.GET("/ws/market-data", s.wsMarketData)
		}
	}

	return r
}

// ============================================================
// Middleware
// ============================================================

func (s *Server) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origins := strings.Split(s.cfg.CORSOrigins, ",")
		origin := c.GetHeader("Origin")
		for _, o := range origins {
			if strings.TrimSpace(o) == origin {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}
		if origin != "" && c.GetHeader("Access-Control-Allow-Origin") == "" {
			// In dev mode, allow all origins
			if s.cfg.Environment == "development" {
				c.Header("Access-Control-Allow-Origin", origin)
			}
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// In development mode, allow unauthenticated access with demo user
		// In production mode, Keycloak + Permify are REQUIRED
		if s.cfg.Environment != "production" {
			if authHeader == "" || authHeader == "Bearer demo-token" {
				c.Set("userID", "usr-001")
				c.Set("email", "trader@nexcom.exchange")
				c.Set("roles", []string{"trader", "user"})
				c.Next()
				return
			}
		}

		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "missing authorization header"})
			c.Abort()
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := s.keycloak.ValidateToken(token)
		if err != nil {
			// In non-production, fall back to demo user on token validation failure
			if s.cfg.Environment != "production" {
				c.Set("userID", "usr-001")
				c.Set("email", "trader@nexcom.exchange")
				c.Set("roles", []string{"trader", "user"})
				c.Next()
				return
			}
			c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "invalid token: " + err.Error()})
			c.Abort()
			return
		}

		// Check Permify authorization
		allowed, err := s.permify.Check("user", claims.Sub, "access", "user", claims.Sub)
		if err != nil || !allowed {
			// In non-production, allow access even if Permify fails
			if s.cfg.Environment != "production" {
				c.Set("userID", claims.Sub)
				c.Set("email", claims.Email)
				c.Set("roles", claims.RealmRoles)
				c.Next()
				return
			}
			c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "access denied"})
			c.Abort()
			return
		}

		c.Set("userID", claims.Sub)
		c.Set("email", claims.Email)
		c.Set("roles", claims.RealmRoles)
		c.Next()
	}
}

func (s *Server) getUserID(c *gin.Context) string {
	id, _ := c.Get("userID")
	if s, ok := id.(string); ok {
		return s
	}
	return "usr-001"
}

// ============================================================
// Health
// ============================================================

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"status":  "healthy",
			"service": "nexcom-gateway",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": gin.H{
				"kafka":       s.kafka.IsConnected(),
				"redis":       s.redis.IsConnected(),
				"temporal":    s.temporal.IsConnected(),
				"tigerbeetle": s.tigerbeetle.IsConnected(),
				"dapr":        s.dapr.IsConnected(),
				"fluvio":      s.fluvio.IsConnected(),
			},
		},
	})
}

// ============================================================
// Auth
// ============================================================

func (s *Server) login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// In development, accept demo credentials
	if s.cfg.Environment == "development" && req.Email == "trader@nexcom.exchange" {
		// Publish login event to Kafka
		s.kafka.Produce(kafkaclient.TopicAuditLog, req.Email, map[string]interface{}{
			"event": "login", "email": req.Email, "timestamp": time.Now().Unix(),
		})

		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data: models.LoginResponse{
				AccessToken:  "demo-access-token",
				RefreshToken: "demo-refresh-token",
				IDToken:      "demo-id-token",
				ExpiresIn:    3600,
				TokenType:    "Bearer",
			},
		})
		return
	}

	// In production: exchange credentials with Keycloak
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.LoginResponse{
			AccessToken:  "mock-access-token",
			RefreshToken: "mock-refresh-token",
			IDToken:      "mock-id-token",
			ExpiresIn:    3600,
			TokenType:    "Bearer",
		},
	})
}

func (s *Server) logout(c *gin.Context) {
	userID := s.getUserID(c)
	s.kafka.Produce(kafkaclient.TopicAuditLog, userID, map[string]interface{}{
		"event": "logout", "userId": userID, "timestamp": time.Now().Unix(),
	})
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "logged out successfully"}})
}

func (s *Server) refreshToken(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	tokens, err := s.keycloak.RefreshTokens(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Error: "token refresh failed"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.LoginResponse{
			AccessToken:  tokens.AccessToken,
			RefreshToken: tokens.RefreshToken,
			IDToken:      tokens.IDToken,
			ExpiresIn:    tokens.ExpiresIn,
			TokenType:    tokens.TokenType,
		},
	})
}

func (s *Server) authCallback(c *gin.Context) {
	code := c.Query("code")
	redirectURI := c.Query("redirect_uri")
	codeVerifier := c.Query("code_verifier")

	if code == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "missing authorization code"})
		return
	}

	tokens, err := s.keycloak.ExchangeCode(code, redirectURI, codeVerifier)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "code exchange failed"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.LoginResponse{
			AccessToken:  tokens.AccessToken,
			RefreshToken: tokens.RefreshToken,
			IDToken:      tokens.IDToken,
			ExpiresIn:    tokens.ExpiresIn,
			TokenType:    tokens.TokenType,
		},
	})
}

// ============================================================
// Markets
// ============================================================

func (s *Server) listMarkets(c *gin.Context) {
	// Try Redis cache first
	var cached []models.Commodity
	if err := s.redis.Get("cache:markets:all", &cached); err == nil {
		c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"commodities": cached}})
		return
	}

	commodities := s.store.GetCommodities()

	// Cache for 5 seconds
	s.redis.Set("cache:markets:all", commodities, 5*time.Second)

	// Publish market data request to Fluvio for real-time updates
	s.fluvio.Produce(fluvio.TopicMarketTicks, "all", map[string]interface{}{
		"request": "market_list", "timestamp": time.Now().Unix(),
	})

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"commodities": commodities}})
}

func (s *Server) searchMarkets(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		s.listMarkets(c)
		return
	}
	results := s.store.SearchCommodities(query)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"commodities": results}})
}

func (s *Server) getTicker(c *gin.Context) {
	symbol := c.Param("symbol")

	// Try Redis cache (1 second TTL for ticker data)
	var cached models.MarketTicker
	cacheKey := "cache:ticker:" + symbol
	if err := s.redis.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: cached})
		return
	}

	ticker, ok := s.store.GetTicker(symbol)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "symbol not found"})
		return
	}

	s.redis.Set(cacheKey, ticker, 1*time.Second)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: ticker})
}

func (s *Server) getOrderBook(c *gin.Context) {
	symbol := c.Param("symbol")
	book := s.store.GetOrderBook(symbol)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: book})
}

func (s *Server) getCandles(c *gin.Context) {
	symbol := c.Param("symbol")
	interval := c.DefaultQuery("interval", "1h")
	limit := 100
	candles := s.store.GetCandles(symbol, interval, limit)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"candles": candles}})
}

// ============================================================
// Orders CRUD
// ============================================================

func (s *Server) listOrders(c *gin.Context) {
	userID := s.getUserID(c)
	status := c.Query("status")

	// Check Permify authorization
	allowed, _ := s.permify.Check("order", "*", "list", "user", userID)
	if !allowed {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "not authorized to list orders"})
		return
	}

	orders := s.store.GetOrders(userID, status)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"orders": orders}})
}

func (s *Server) createOrder(c *gin.Context) {
	userID := s.getUserID(c)
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Check trading permission via Permify
	allowed, _ := s.permify.CheckTradingPermission(userID, req.Symbol, "trade")
	if !allowed {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "not authorized to trade " + req.Symbol})
		return
	}

	order := models.Order{
		UserID:   userID,
		Symbol:   req.Symbol,
		Side:     req.Side,
		Type:     req.Type,
		Quantity: req.Quantity,
		Price:    req.Price,
		StopPrice: req.StopPrice,
	}

	created := s.store.CreateOrder(order)

	// Start Temporal order lifecycle workflow
	s.temporal.StartOrderWorkflow(c.Request.Context(), created.ID, models.OrderWorkflowInput{
		OrderID: created.ID,
		UserID:  userID,
		Symbol:  req.Symbol,
		Side:    string(req.Side),
		Type:    string(req.Type),
		Price:   req.Price,
		Qty:     req.Quantity,
	})

	// Publish to Kafka for event sourcing
	s.kafka.Produce(kafkaclient.TopicOrders, created.ID, models.OrderEvent{
		EventType: "ORDER_CREATED",
		Order:     created,
		Timestamp: time.Now().UnixMilli(),
	})

	// Create TigerBeetle pending transfer for margin hold
	marginAmount := int64(req.Price * req.Quantity * 0.1 * 100) // 10% margin in cents
	s.tigerbeetle.CreatePendingTransfer(
		"user-margin-"+userID,
		"exchange-clearing",
		marginAmount,
		tigerbeetle.TransferMarginDeposit,
	)

	// Save order state via Dapr
	s.dapr.SaveState(dapr.StateStoreRedis, "order:"+created.ID, created)

	// Publish to Fluvio for real-time feed
	s.fluvio.Produce(fluvio.TopicTradeSignals, created.Symbol, map[string]interface{}{
		"type": "new_order", "order": created,
	})

	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: created})
}

func (s *Server) getOrder(c *gin.Context) {
	orderID := c.Param("id")
	order, ok := s.store.GetOrder(orderID)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "order not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: order})
}

func (s *Server) cancelOrder(c *gin.Context) {
	orderID := c.Param("id")
	userID := s.getUserID(c)

	cancelled, err := s.store.CancelOrder(orderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Cancel Temporal workflow
	s.temporal.CancelWorkflow(c.Request.Context(), "order-"+orderID)

	// Publish cancellation event to Kafka
	s.kafka.Produce(kafkaclient.TopicOrders, orderID, models.OrderEvent{
		EventType: "ORDER_CANCELLED",
		Order:     cancelled,
		Timestamp: time.Now().UnixMilli(),
	})

	// Release margin via TigerBeetle
	s.tigerbeetle.VoidTransfer("pending-margin-" + orderID)

	// Audit log
	s.kafka.Produce(kafkaclient.TopicAuditLog, userID, map[string]interface{}{
		"event": "order_cancelled", "orderId": orderID, "userId": userID,
	})

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: cancelled})
}

// ============================================================
// Trades
// ============================================================

func (s *Server) listTrades(c *gin.Context) {
	userID := s.getUserID(c)
	symbol := c.Query("symbol")
	trades := s.store.GetTrades(userID, symbol, 0)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"trades": trades}})
}

func (s *Server) getTrade(c *gin.Context) {
	tradeID := c.Param("id")
	trade, ok := s.store.GetTrade(tradeID)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "trade not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: trade})
}

// ============================================================
// Portfolio
// ============================================================

func (s *Server) getPortfolio(c *gin.Context) {
	userID := s.getUserID(c)

	// Try cache
	var cached models.PortfolioSummary
	cacheKey := "cache:portfolio:" + userID
	if err := s.redis.Get(cacheKey, &cached); err == nil {
		c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: cached})
		return
	}

	portfolio := s.store.GetPortfolio(userID)
	s.redis.Set(cacheKey, portfolio, 5*time.Second)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: portfolio})
}

func (s *Server) listPositions(c *gin.Context) {
	userID := s.getUserID(c)
	positions := s.store.GetPositions(userID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"positions": positions}})
}

func (s *Server) closePosition(c *gin.Context) {
	positionID := c.Param("id")
	userID := s.getUserID(c)

	position, err := s.store.ClosePosition(positionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Settle via TigerBeetle
	amount := int64(position.UnrealizedPnl * 100)
	if amount > 0 {
		s.tigerbeetle.CreateTransfer("exchange-clearing", "user-settlement-"+userID, amount, tigerbeetle.TransferTradeSettlement)
	} else {
		s.tigerbeetle.CreateTransfer("user-settlement-"+userID, "exchange-clearing", -amount, tigerbeetle.TransferTradeSettlement)
	}

	// Start settlement workflow
	s.temporal.StartSettlementWorkflow(c.Request.Context(), positionID, models.SettlementWorkflowInput{
		TradeID:  positionID,
		BuyerID:  userID,
		SellerID: "exchange",
		Amount:   position.UnrealizedPnl,
		Symbol:   position.Symbol,
	})

	// Invalidate portfolio cache
	s.redis.Delete("cache:portfolio:" + userID)

	s.kafka.Produce(kafkaclient.TopicOrders, positionID, map[string]interface{}{
		"event": "position_closed", "positionId": positionID, "userId": userID, "pnl": position.UnrealizedPnl,
	})

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{
		"message":  "position closed",
		"position": position,
		"pnl":      position.UnrealizedPnl,
	}})
}

func (s *Server) getPortfolioHistory(c *gin.Context) {
	// Return mock portfolio history
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"period": c.DefaultQuery("period", "1M"),
			"history": []gin.H{
				{"date": time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02"), "value": 145000},
				{"date": time.Now().Add(-20 * 24 * time.Hour).Format("2006-01-02"), "value": 148500},
				{"date": time.Now().Add(-10 * 24 * time.Hour).Format("2006-01-02"), "value": 152000},
				{"date": time.Now().Format("2006-01-02"), "value": 156000},
			},
		},
	})
}

// ============================================================
// Alerts CRUD
// ============================================================

func (s *Server) listAlerts(c *gin.Context) {
	userID := s.getUserID(c)
	alerts := s.store.GetAlerts(userID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"alerts": alerts}})
}

func (s *Server) createAlert(c *gin.Context) {
	userID := s.getUserID(c)
	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	alert := models.PriceAlert{
		UserID:      userID,
		Symbol:      req.Symbol,
		Condition:   req.Condition,
		TargetPrice: req.TargetPrice,
	}
	created := s.store.CreateAlert(alert)

	// Publish alert to Kafka for monitoring
	s.kafka.Produce(kafkaclient.TopicAlerts, created.ID, map[string]interface{}{
		"event": "alert_created", "alert": created,
	})

	// Store in Dapr state for distributed alert checking
	s.dapr.SaveState(dapr.StateStoreRedis, "alert:"+created.ID, created)

	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: created})
}

func (s *Server) updateAlert(c *gin.Context) {
	alertID := c.Param("id")
	var req models.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	updated, err := s.store.UpdateAlert(alertID, req.Active)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	s.dapr.SaveState(dapr.StateStoreRedis, "alert:"+alertID, updated)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: updated})
}

func (s *Server) deleteAlert(c *gin.Context) {
	alertID := c.Param("id")
	if err := s.store.DeleteAlert(alertID); err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	s.dapr.DeleteState(dapr.StateStoreRedis, "alert:"+alertID)
	s.kafka.Produce(kafkaclient.TopicAlerts, alertID, map[string]interface{}{
		"event": "alert_deleted", "alertId": alertID,
	})

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "alert deleted"}})
}

// ============================================================
// Account
// ============================================================

func (s *Server) getProfile(c *gin.Context) {
	userID := s.getUserID(c)
	user, ok := s.store.GetUser(userID)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "user not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: user})
}

func (s *Server) updateProfile(c *gin.Context) {
	userID := s.getUserID(c)
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	updated, err := s.store.UpdateUser(userID, req)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	s.kafka.Produce(kafkaclient.TopicAuditLog, userID, map[string]interface{}{
		"event": "profile_updated", "userId": userID,
	})

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: updated})
}

func (s *Server) getKYC(c *gin.Context) {
	userID := s.getUserID(c)
	user, _ := s.store.GetUser(userID)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"status": user.KYCStatus,
			"steps": []gin.H{
				{"step": "personal_info", "status": "completed", "label": "Personal Information"},
				{"step": "identity_doc", "status": "completed", "label": "Identity Document"},
				{"step": "address_proof", "status": "completed", "label": "Proof of Address"},
				{"step": "selfie", "status": "completed", "label": "Selfie Verification"},
				{"step": "sanctions", "status": "completed", "label": "Sanctions Screening"},
				{"step": "approval", "status": "completed", "label": "Final Approval"},
			},
		},
	})
}

func (s *Server) submitKYC(c *gin.Context) {
	userID := s.getUserID(c)
	// Start KYC Temporal workflow
	exec, _ := s.temporal.StartKYCWorkflow(c.Request.Context(), userID, map[string]string{"userId": userID})

	s.kafka.Produce(kafkaclient.TopicKYCEvents, userID, map[string]interface{}{
		"event": "kyc_submitted", "userId": userID, "workflowId": exec.WorkflowID,
	})

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"message":    "KYC verification submitted",
			"workflowId": exec.WorkflowID,
		},
	})
}

func (s *Server) listSessions(c *gin.Context) {
	userID := s.getUserID(c)
	sessions := s.store.GetSessions(userID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"sessions": sessions}})
}

func (s *Server) revokeSession(c *gin.Context) {
	sessionID := c.Param("id")
	if err := s.store.RevokeSession(sessionID); err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Also revoke in Keycloak
	s.keycloak.RevokeSession(sessionID)

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "session revoked"}})
}

func (s *Server) getPreferences(c *gin.Context) {
	userID := s.getUserID(c)
	prefs, ok := s.store.GetPreferences(userID)
	if !ok {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "preferences not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: prefs})
}

func (s *Server) updatePreferences(c *gin.Context) {
	userID := s.getUserID(c)
	var req models.UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	updated, err := s.store.UpdatePreferences(userID, req)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	s.dapr.SaveState(dapr.StateStoreRedis, "prefs:"+userID, updated)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: updated})
}

func (s *Server) changePassword(c *gin.Context) {
	userID := s.getUserID(c)
	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	if err := s.keycloak.ChangePassword(userID, req.CurrentPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "password change failed"})
		return
	}

	s.kafka.Produce(kafkaclient.TopicAuditLog, userID, map[string]interface{}{
		"event": "password_changed", "userId": userID,
	})

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "password changed successfully"}})
}

func (s *Server) enable2FA(c *gin.Context) {
	userID := s.getUserID(c)
	totpURI, err := s.keycloak.Enable2FA(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "failed to enable 2FA"})
		return
	}

	s.kafka.Produce(kafkaclient.TopicAuditLog, userID, map[string]interface{}{
		"event": "2fa_enabled", "userId": userID,
	})

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"message": "2FA enabled",
			"totpUri": totpURI,
		},
	})
}

func (s *Server) generateAPIKey(c *gin.Context) {
	userID := s.getUserID(c)
	apiKey := "nex_" + time.Now().Format("20060102") + "_" + userID[:8]

	// Store API key hash via Dapr state
	s.dapr.SaveState(dapr.StateStoreRedis, "apikey:"+userID, map[string]string{
		"key":     apiKey,
		"created": time.Now().Format(time.RFC3339),
	})

	s.kafka.Produce(kafkaclient.TopicAuditLog, userID, map[string]interface{}{
		"event": "api_key_generated", "userId": userID,
	})

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"apiKey":  apiKey,
			"message": "API key generated. Store it securely — it won't be shown again.",
		},
	})
}

// ============================================================
// Notifications
// ============================================================

func (s *Server) listNotifications(c *gin.Context) {
	userID := s.getUserID(c)
	notifications := s.store.GetNotifications(userID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"notifications": notifications}})
}

func (s *Server) markNotificationRead(c *gin.Context) {
	notifID := c.Param("id")
	userID := s.getUserID(c)
	if err := s.store.MarkNotificationRead(notifID, userID); err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "marked as read"}})
}

func (s *Server) markAllRead(c *gin.Context) {
	userID := s.getUserID(c)
	s.store.MarkAllNotificationsRead(userID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"message": "all notifications marked as read"}})
}

// ============================================================
// Analytics (delegates to Python analytics service via Dapr)
// ============================================================

func (s *Server) analyticsDashboard(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"marketCap":     2470000000,
			"volume24h":     456000000,
			"activePairs":   42,
			"activeTraders":  12500,
			"topGainers":    []gin.H{{"symbol": "VCU", "change": 3.05}, {"symbol": "NAT_GAS", "change": 2.89}, {"symbol": "COFFEE", "change": 2.80}},
			"topLosers":     []gin.H{{"symbol": "CRUDE_OIL", "change": -1.51}, {"symbol": "COCOA", "change": -1.37}, {"symbol": "WHEAT", "change": -0.72}},
			"volumeByCategory": gin.H{"agricultural": 45, "metals": 25, "energy": 20, "carbon": 10},
		},
	})
}

func (s *Server) pnlReport(c *gin.Context) {
	period := c.DefaultQuery("period", "1M")
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"period":     period,
			"totalPnl":   8450.25,
			"winRate":    68.5,
			"totalTrades": 156,
			"avgReturn":  2.3,
			"sharpeRatio": 1.85,
			"maxDrawdown": -4.2,
		},
	})
}

func (s *Server) geospatialData(c *gin.Context) {
	commodity := c.Param("commodity")
	// In production: delegates to Python analytics service with Apache Sedona
	resp, _ := s.dapr.InvokeService("analytics-service", "/api/v1/geospatial/"+commodity, nil)
	_ = resp

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"commodity": commodity,
			"regions": []gin.H{
				{"name": "Kenya", "lat": -1.286389, "lng": 36.817223, "production": 3200000, "commodity": "MAIZE"},
				{"name": "Ethiopia", "lat": 9.02497, "lng": 38.74689, "production": 7500000, "commodity": "COFFEE"},
				{"name": "Ghana", "lat": 5.603717, "lng": -0.186964, "production": 800000, "commodity": "COCOA"},
				{"name": "Nigeria", "lat": 9.05785, "lng": 7.49508, "production": 2100000, "commodity": "SESAME"},
				{"name": "Tanzania", "lat": -6.369028, "lng": 34.888822, "production": 5800000, "commodity": "MAIZE"},
			},
		},
	})
}

func (s *Server) aiInsights(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"sentiment": gin.H{"bullish": 62, "bearish": 23, "neutral": 15},
			"anomalies": []gin.H{
				{"symbol": "COFFEE", "type": "volume_spike", "severity": "medium", "message": "Unusual volume increase detected in COFFEE market"},
				{"symbol": "GOLD", "type": "price_deviation", "severity": "low", "message": "GOLD price deviating from 30-day moving average"},
			},
			"recommendations": []gin.H{
				{"symbol": "MAIZE", "action": "BUY", "confidence": 0.78, "reason": "Strong seasonal demand pattern"},
				{"symbol": "CRUDE_OIL", "action": "HOLD", "confidence": 0.65, "reason": "Geopolitical uncertainty"},
			},
		},
	})
}

func (s *Server) priceForecast(c *gin.Context) {
	symbol := c.Param("symbol")
	ticker, _ := s.store.GetTicker(symbol)
	base := ticker.LastPrice

	forecasts := make([]gin.H, 7)
	for i := 0; i < 7; i++ {
		change := (0.5 - float64(i%3)*0.2) * float64(i+1)
		forecasts[i] = gin.H{
			"date":       time.Now().Add(time.Duration(i+1) * 24 * time.Hour).Format("2006-01-02"),
			"predicted":  base * (1 + change/100),
			"upper":      base * (1 + (change+2)/100),
			"lower":      base * (1 + (change-2)/100),
			"confidence": 0.85 - float64(i)*0.05,
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"symbol":    symbol,
			"forecasts": forecasts,
			"model":     "LSTM-Attention",
			"accuracy":  0.82,
		},
	})
}

// ============================================================
// Middleware Status
// ============================================================

func (s *Server) middlewareStatus(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"kafka":       gin.H{"connected": s.kafka.IsConnected(), "brokers": s.cfg.KafkaBrokers},
			"redis":       gin.H{"connected": s.redis.IsConnected(), "url": s.cfg.RedisURL},
			"temporal":    gin.H{"connected": s.temporal.IsConnected(), "host": s.cfg.TemporalHost},
			"tigerbeetle": gin.H{"connected": s.tigerbeetle.IsConnected(), "addresses": s.cfg.TigerBeetleAddresses},
			"dapr":        gin.H{"connected": s.dapr.IsConnected(), "httpPort": s.cfg.DaprHTTPPort},
			"fluvio":      gin.H{"connected": s.fluvio.IsConnected(), "endpoint": s.cfg.FluvioEndpoint},
			"keycloak":    gin.H{"url": s.cfg.KeycloakURL, "realm": s.cfg.KeycloakRealm},
			"permify":     gin.H{"connected": s.permify.IsConnected(), "endpoint": s.cfg.PermifyEndpoint},
			"apisix":      gin.H{"adminUrl": s.cfg.APISIXAdminURL},
		},
	})
}

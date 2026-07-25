package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/munisp/NGApp/ussd-gateway/internal/menu"
	"github.com/munisp/NGApp/ussd-gateway/internal/session"
	"go.uber.org/zap"
)

type Handler struct {
	menuEngine *menu.Engine
	sessionMgr *session.Manager
	logger     *zap.Logger
}

func NewHandler(me *menu.Engine, sm *session.Manager, logger *zap.Logger) *Handler {
	return &Handler{menuEngine: me, sessionMgr: sm, logger: logger}
}

// HandleUSSD processes incoming USSD requests from telco gateway.
// Supports Africa's Talking, Hubtel, and generic USSD gateway protocols.
func (h *Handler) HandleUSSD(c *gin.Context) {
	// Parse USSD callback (compatible with Africa's Talking format)
	sessionID := c.DefaultQuery("sessionId", c.PostForm("sessionId"))
	phoneNumber := c.DefaultQuery("phoneNumber", c.PostForm("phoneNumber"))
	serviceCode := c.DefaultQuery("serviceCode", c.PostForm("serviceCode"))
	text := c.DefaultQuery("text", c.PostForm("text"))

	if sessionID == "" || phoneNumber == "" {
		c.String(http.StatusBadRequest, "END Missing required parameters")
		return
	}

	ctx := c.Request.Context()

	// Get or create session
	sess, err := h.sessionMgr.GetOrCreate(ctx, sessionID, phoneNumber, serviceCode)
	if err != nil {
		h.logger.Error("session creation failed", zap.Error(err))
		c.String(http.StatusInternalServerError, "END Service unavailable. Please try again.")
		return
	}

	var response *menu.USSDResponse

	if text == "" {
		// New session - show main menu
		response = h.menuEngine.GetMainMenu()
	} else {
		// Process user input - get last part of input chain
		parts := splitText(text)
		lastInput := parts[len(parts)-1]
		response = h.menuEngine.ProcessInput(ctx, sess, lastInput)
	}

	// Format response for telco gateway
	prefix := "CON "
	if response.End {
		prefix = "END "
		h.sessionMgr.End(ctx, sess)
	}

	c.String(http.StatusOK, prefix+response.Message)
}

func (h *Handler) GetActiveSessions(c *gin.Context) {
	count := h.sessionMgr.GetActiveCount(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"active_sessions": count})
}

func (h *Handler) GetSession(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"session_id": c.Param("id")})
}

func (h *Handler) GetDailyAnalytics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"total_sessions":   0,
		"unique_users":     0,
		"completed":        0,
		"abandoned":        0,
		"avg_duration_sec": 0,
		"top_menus":        []interface{}{},
	})
}

func (h *Handler) GetStateAnalytics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"states": []map[string]interface{}{
			{"state": "Lagos", "sessions": 0, "percentage": 0},
			{"state": "Abuja", "sessions": 0, "percentage": 0},
			{"state": "Kano", "sessions": 0, "percentage": 0},
		},
	})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "ussd-gateway"})
}

func splitText(text string) []string {
	if text == "" {
		return []string{}
	}
	parts := []string{}
	current := ""
	for _, ch := range text {
		if ch == '*' {
			if current != "" {
				parts = append(parts, current)
			}
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

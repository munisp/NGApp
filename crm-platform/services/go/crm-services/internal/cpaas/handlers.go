package cpaas

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type Handler struct {
	logger *logrus.Logger
}

func NewHandler(logger *logrus.Logger) *Handler {
	return &Handler{logger: logger}
}

func (h *Handler) GetChannelMetrics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"channels": []ChannelMetric{}, "total_messages": 0})
}

func (h *Handler) ListMessages(c *gin.Context) {
	channel := c.Query("channel")
	c.JSON(http.StatusOK, gin.H{"data": []MessageLog{}, "channel": channel, "total": 0})
}

func (h *Handler) GetDeliveryReport(c *gin.Context) {
	msgID := c.Param("messageId")
	c.JSON(http.StatusOK, gin.H{"message_id": msgID, "status": "delivered"})
}

func (h *Handler) ListDevelopers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []APIConsumer{}, "total": 0})
}

func (h *Handler) GetAPIExplorer(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"endpoints": []APIEndpoint{
			{Path: "/v1/messages/sms", Method: "POST", Description: "Send SMS"},
			{Path: "/v1/messages/whatsapp", Method: "POST", Description: "Send WhatsApp message"},
			{Path: "/v1/voice/call", Method: "POST", Description: "Initiate voice call"},
			{Path: "/v1/verify/send", Method: "POST", Description: "Send OTP verification"},
		},
	})
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	cpaas := rg.Group("/cpaas")
	{
		cpaas.GET("/channels", h.GetChannelMetrics)
		cpaas.GET("/messages", h.ListMessages)
		cpaas.GET("/delivery/:messageId", h.GetDeliveryReport)
		cpaas.GET("/developers", h.ListDevelopers)
		cpaas.GET("/api-explorer", h.GetAPIExplorer)
	}
}

package commodity

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

func (h *Handler) ListPositions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []Position{}, "total": 0})
}

func (h *Handler) ListTrades(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []Trade{}, "total": 0})
}

func (h *Handler) ListSettlements(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []Settlement{}, "total": 0})
}

func (h *Handler) GetCounterpartyRisk(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"exposures": []CounterpartyExposure{}, "total_exposure": 0})
}

func (h *Handler) GetPriceFeed(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"prices": []PriceQuote{}, "timestamp": ""})
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	commodity := rg.Group("/commodity")
	{
		commodity.GET("/positions", h.ListPositions)
		commodity.GET("/trades", h.ListTrades)
		commodity.GET("/settlements", h.ListSettlements)
		commodity.GET("/counterparty-risk", h.GetCounterpartyRisk)
		commodity.GET("/prices", h.GetPriceFeed)
	}
}

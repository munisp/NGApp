package pipeline

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

func (h *Handler) GetPipeline(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"stages": []Stage{
			{Name: "Discovery", Count: 142, Value: 2400000},
			{Name: "Qualification", Count: 87, Value: 1800000},
			{Name: "Proposal", Count: 52, Value: 1200000},
			{Name: "Negotiation", Count: 28, Value: 840000},
			{Name: "Closed Won", Count: 15, Value: 620000},
		},
		"total_pipeline_value": 6860000,
		"weighted_value":      3420000,
		"avg_cycle_days":      34,
	})
}

func (h *Handler) GetForecast(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"current_quarter": gin.H{
			"target":    4200000,
			"committed": 2800000,
			"best_case": 3600000,
			"pipeline":  6860000,
		},
		"monte_carlo": gin.H{
			"p10": 2100000, "p50": 3200000, "p90": 4100000,
			"simulations": 10000,
		},
	})
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	revops := rg.Group("/revops")
	{
		revops.GET("/pipeline", h.GetPipeline)
		revops.GET("/forecast", h.GetForecast)
	}
}

type Stage struct {
	Name  string  `json:"name"`
	Count int     `json:"count"`
	Value float64 `json:"value"`
}

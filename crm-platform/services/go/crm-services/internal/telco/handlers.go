package telco

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

// @Summary List subscribers
// @Tags Telco
// @Produce json
// @Param tenant_id header string true "Tenant ID"
// @Success 200 {object} SubscriberListResponse
// @Router /telco/subscribers [get]
func (h *Handler) ListSubscribers(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	h.logger.WithField("tenant", tenantID).Info("listing subscribers")
	c.JSON(http.StatusOK, gin.H{
		"data":  []Subscriber{},
		"total": 0,
		"page":  1,
	})
}

// @Summary Get cell site metrics
// @Tags Telco
// @Produce json
// @Router /telco/cell-sites [get]
func (h *Handler) ListCellSites(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []CellSite{}, "total": 0})
}

// @Summary SIM lifecycle events
// @Tags Telco
// @Produce json
// @Param msisdn path string true "MSISDN"
// @Router /telco/sim/{msisdn} [get]
func (h *Handler) GetSIMLifecycle(c *gin.Context) {
	msisdn := c.Param("msisdn")
	c.JSON(http.StatusOK, gin.H{"msisdn": msisdn, "events": []SIMEvent{}})
}

// @Summary Interconnect agreements
// @Tags Telco
// @Router /telco/interconnect [get]
func (h *Handler) ListInterconnect(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []InterconnectAgreement{}, "total": 0})
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	telco := rg.Group("/telco")
	{
		telco.GET("/subscribers", h.ListSubscribers)
		telco.GET("/cell-sites", h.ListCellSites)
		telco.GET("/sim/:msisdn", h.GetSIMLifecycle)
		telco.GET("/interconnect", h.ListInterconnect)
	}
}

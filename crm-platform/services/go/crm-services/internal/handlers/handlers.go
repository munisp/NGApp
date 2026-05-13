package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// CustomerService defines customer operations needed by handlers.
type CustomerService interface {
	// Placeholder — implemented in service package
}

// HealthService defines health check operations.
type HealthService interface {
	// Placeholder — implemented in service package
}

// CustomerHandler handles customer HTTP endpoints.
type CustomerHandler struct {
	service CustomerService
	logger  *logrus.Logger
}

// NewCustomerHandler creates a new customer handler.
func NewCustomerHandler(service CustomerService, logger *logrus.Logger) *CustomerHandler {
	return &CustomerHandler{service: service, logger: logger}
}

// RegisterRoutes adds customer routes to the router group.
func (h *CustomerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/customers", h.List)
	rg.POST("/customers", h.Create)
	rg.GET("/customers/:id", h.Get)
	rg.PUT("/customers/:id", h.Update)
	rg.DELETE("/customers/:id", h.Delete)
}

func (h *CustomerHandler) List(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []interface{}{}, "total": 0})
}

func (h *CustomerHandler) Create(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"status": "created"})
}

func (h *CustomerHandler) Get(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id")})
}

func (h *CustomerHandler) Update(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id"), "status": "updated"})
}

func (h *CustomerHandler) Delete(c *gin.Context) {
	c.JSON(http.StatusNoContent, nil)
}

// HealthHandler handles health check endpoints.
type HealthHandler struct {
	service HealthService
	logger  *logrus.Logger
}

// NewHealthHandler creates a new health handler.
func NewHealthHandler(service HealthService, logger *logrus.Logger) *HealthHandler {
	return &HealthHandler{service: service, logger: logger}
}

// RegisterRoutes adds health routes.
func (h *HealthHandler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.Health)
	router.GET("/ready", h.Ready)
}

func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

func (h *HealthHandler) Ready(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

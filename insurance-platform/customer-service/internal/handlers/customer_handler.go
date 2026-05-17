package handlers

import (
	"net/http"
	"customer-service/internal/models"
	"customer-service/internal/service"
	"github.com/gin-gonic/gin"
)

type CustomerHandler struct{ svc *service.CustomerService }

func NewCustomerHandler(svc *service.CustomerService) *CustomerHandler { return &CustomerHandler{svc: svc} }

func (h *CustomerHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", h.HealthCheck)
	r.GET("/ready", h.ReadinessCheck)
	v1 := r.Group("/api/v1")
	c := v1.Group("/customers")
	c.POST("/", h.CreateCustomer)
	c.GET("/", h.ListCustomers)
	c.GET("/:id", h.GetCustomer)
	c.PUT("/:id", h.UpdateCustomer)
	c.DELETE("/:id", h.DeleteCustomer)
	c.POST("/:id/verify", h.VerifyKYC)
	c.POST("/:id/suspend", h.SuspendCustomer)
	c.GET("/:id/policies", h.GetPolicies)
	c.GET("/:id/claims", h.GetClaims)
	c.GET("/:id/payments", h.GetPayments)
	c.GET("/:id/360", h.GetCustomer360)
}

func (h *CustomerHandler) HealthCheck(c *gin.Context) { c.JSON(200, gin.H{"status": "healthy", "service": "customer-service"}) }
func (h *CustomerHandler) ReadinessCheck(c *gin.Context) { c.JSON(200, gin.H{"status": "ready", "service": "customer-service"}) }

func (h *CustomerHandler) CreateCustomer(c *gin.Context) {
	var cust models.Customer
	if err := c.ShouldBindJSON(&cust); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	if err := h.svc.RegisterCustomer(c.Request.Context(), &cust); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(201, cust)
}

func (h *CustomerHandler) ListCustomers(c *gin.Context) {
	filter := models.CustomerFilter{KYCStatus: c.Query("kyc_status"), State: c.Query("state"), Tier: c.Query("tier")}
	customers, err := h.svc.ListCustomers(c.Request.Context(), filter)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, customers)
}

func (h *CustomerHandler) GetCustomer(c *gin.Context) {
	cust, err := h.svc.GetCustomer(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
	c.JSON(200, cust)
}

func (h *CustomerHandler) UpdateCustomer(c *gin.Context) {
	var cust models.Customer
	if err := c.ShouldBindJSON(&cust); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	cust.ID = c.Param("id")
	if err := h.svc.UpdateCustomer(c.Request.Context(), &cust); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, cust)
}

func (h *CustomerHandler) DeleteCustomer(c *gin.Context) {
	if err := h.svc.DeleteCustomer(c.Request.Context(), c.Param("id")); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "customer deleted"})
}

func (h *CustomerHandler) VerifyKYC(c *gin.Context) {
	if err := h.svc.VerifyKYC(c.Request.Context(), c.Param("id")); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "KYC verified"})
}

func (h *CustomerHandler) SuspendCustomer(c *gin.Context) {
	if err := h.svc.SuspendCustomer(c.Request.Context(), c.Param("id")); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "customer suspended"})
}

func (h *CustomerHandler) GetPolicies(c *gin.Context) {
	ps, err := h.svc.GetCustomerPolicies(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(200, ps)
}

func (h *CustomerHandler) GetClaims(c *gin.Context) {
	cs, err := h.svc.GetCustomerClaims(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(200, cs)
}

func (h *CustomerHandler) GetPayments(c *gin.Context) {
	ps, err := h.svc.GetCustomerPayments(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(200, ps)
}

func (h *CustomerHandler) GetCustomer360(c *gin.Context) {
	data, err := h.svc.GetCustomer360(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(200, data)
}

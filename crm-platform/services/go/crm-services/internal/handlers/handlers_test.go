package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func setupRouter() (*gin.Engine, *CustomerHandler, *HealthHandler) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	logger := logrus.New()

	ch := NewCustomerHandler(nil, logger)
	hh := NewHealthHandler(nil, logger)
	return r, ch, hh
}

func TestHealthCheck(t *testing.T) {
	r, _, hh := setupRouter()
	r.GET("/health", hh.HealthCheck)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "healthy")
}

func TestReadinessCheck(t *testing.T) {
	r, _, hh := setupRouter()
	r.GET("/ready", hh.ReadinessCheck)

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "ready")
}

func TestGetCustomers(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/customers", ch.GetCustomers)

	req := httptest.NewRequest("GET", "/customers", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "data")
	assert.Contains(t, w.Body.String(), "total")
}

func TestCreateCustomer(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/customers", ch.CreateCustomer)

	body := `{"name": "Test Corp", "email": "test@corp.com"}`
	req := httptest.NewRequest("POST", "/customers", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.Contains(t, w.Body.String(), "created")
}

func TestGetCustomer(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/customers/:id", ch.GetCustomer)

	req := httptest.NewRequest("GET", "/customers/cus-123", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "cus-123")
}

func TestUpdateCustomer(t *testing.T) {
	r, ch, _ := setupRouter()
	r.PUT("/customers/:id", ch.UpdateCustomer)

	body := `{"name": "Updated Corp"}`
	req := httptest.NewRequest("PUT", "/customers/cus-123", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "updated")
}

func TestDeleteCustomer(t *testing.T) {
	r, ch, _ := setupRouter()
	r.DELETE("/customers/:id", ch.DeleteCustomer)

	req := httptest.NewRequest("DELETE", "/customers/cus-123", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestGetCustomerProfile(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/customers/:id/profile", ch.GetCustomerProfile)

	req := httptest.NewRequest("GET", "/customers/cus-123/profile", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "profile")
}

func TestUpdateCustomerProfile(t *testing.T) {
	r, ch, _ := setupRouter()
	r.PUT("/customers/:id/profile", ch.UpdateCustomerProfile)

	req := httptest.NewRequest("PUT", "/customers/cus-123/profile", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "profile_updated")
}

func TestGetCustomerInteractions(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/customers/:id/interactions", ch.GetCustomerInteractions)

	req := httptest.NewRequest("GET", "/customers/cus-123/interactions", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "data")
}

func TestCreateCustomerInteraction(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/customers/:id/interactions", ch.CreateCustomerInteraction)

	body := `{"type": "call", "notes": "Follow up"}`
	req := httptest.NewRequest("POST", "/customers/cus-123/interactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestGetCustomerSegments(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/customers/:id/segments", ch.GetCustomerSegments)

	req := httptest.NewRequest("GET", "/customers/cus-123/segments", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSegmentAnalytics(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/analytics/segments", ch.GetSegmentAnalytics)

	req := httptest.NewRequest("GET", "/analytics/segments", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "segments")
}

func TestLifecycleAnalytics(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/analytics/lifecycle", ch.GetLifecycleAnalytics)

	req := httptest.NewRequest("GET", "/analytics/lifecycle", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestValueAnalytics(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/analytics/value", ch.GetValueAnalytics)

	req := httptest.NewRequest("GET", "/analytics/value", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestChurnAnalytics(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/analytics/churn", ch.GetChurnAnalytics)

	req := httptest.NewRequest("GET", "/analytics/churn", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSearchCustomers(t *testing.T) {
	r, ch, _ := setupRouter()
	r.GET("/search/customers", ch.SearchCustomers)

	req := httptest.NewRequest("GET", "/search/customers?q=dangote", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdvancedSearch(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/search/customers/advanced", ch.AdvancedSearchCustomers)

	body := `{"filters": {"segment": "enterprise"}}`
	req := httptest.NewRequest("POST", "/search/customers/advanced", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestBulkCreateCustomers(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/bulk/customers", ch.BulkCreateCustomers)

	body := `{"customers": [{"name": "Corp A"}, {"name": "Corp B"}]}`
	req := httptest.NewRequest("POST", "/bulk/customers", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestBulkUpdateCustomers(t *testing.T) {
	r, ch, _ := setupRouter()
	r.PUT("/bulk/customers", ch.BulkUpdateCustomers)

	req := httptest.NewRequest("PUT", "/bulk/customers", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestBulkDeleteCustomers(t *testing.T) {
	r, ch, _ := setupRouter()
	r.DELETE("/bulk/customers", ch.BulkDeleteCustomers)

	req := httptest.NewRequest("DELETE", "/bulk/customers", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleCustomerEvent(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/events/customer", ch.HandleCustomerEvent)

	body := `{"type": "customer_created", "data": {}}`
	req := httptest.NewRequest("POST", "/events/customer", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusAccepted, w.Code)
	assert.Contains(t, w.Body.String(), "event_queued")
}

func TestHandleInteractionEvent(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/events/interaction", ch.HandleInteractionEvent)

	body := `{"type": "interaction_logged"}`
	req := httptest.NewRequest("POST", "/events/interaction", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusAccepted, w.Code)
}

func TestHandleSegmentEvent(t *testing.T) {
	r, ch, _ := setupRouter()
	r.POST("/events/segment", ch.HandleSegmentEvent)

	body := `{"type": "segment_changed"}`
	req := httptest.NewRequest("POST", "/events/segment", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusAccepted, w.Code)
}

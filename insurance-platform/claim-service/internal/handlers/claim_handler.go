package handlers

import (
	"claim-service/internal/models"
	"claim-service/internal/service"
	"github.com/gin-gonic/gin"
)

type ClaimHandler struct{ svc *service.ClaimService }

func NewClaimHandler(svc *service.ClaimService) *ClaimHandler { return &ClaimHandler{svc: svc} }

func (h *ClaimHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", h.HealthCheck)
	r.GET("/ready", h.ReadinessCheck)
	v1 := r.Group("/api/v1")
	c := v1.Group("/claims")
	c.POST("/", h.CreateClaim)
	c.GET("/", h.ListClaims)
	c.GET("/:id", h.GetClaim)
	c.PUT("/:id", h.UpdateClaim)
	c.DELETE("/:id", h.DeleteClaim)
	c.POST("/:id/approve", h.ApproveClaim)
	c.POST("/:id/reject", h.RejectClaim)
	c.POST("/:id/review", h.StartReview)
	c.GET("/:id/documents", h.ListDocuments)
	c.POST("/:id/documents", h.UploadDocument)
	c.GET("/:id/notes", h.ListNotes)
	c.POST("/:id/notes", h.AddNote)
	c.GET("/:id/settlement", h.CalculateSettlement)
}

func (h *ClaimHandler) HealthCheck(c *gin.Context) { c.JSON(200, gin.H{"status": "healthy", "service": "claim-service"}) }
func (h *ClaimHandler) ReadinessCheck(c *gin.Context) { c.JSON(200, gin.H{"status": "ready", "service": "claim-service"}) }

func (h *ClaimHandler) CreateClaim(c *gin.Context) {
	var claim models.Claim
	if err := c.ShouldBindJSON(&claim); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	if err := h.svc.FileClaim(c.Request.Context(), &claim); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(201, claim)
}

func (h *ClaimHandler) ListClaims(c *gin.Context) {
	filter := models.ClaimFilter{Status: c.Query("status"), CustomerID: c.Query("customer_id"), PolicyID: c.Query("policy_id")}
	claims, err := h.svc.ListClaims(c.Request.Context(), filter)
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, claims)
}

func (h *ClaimHandler) GetClaim(c *gin.Context) {
	claim, err := h.svc.GetClaim(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
	c.JSON(200, claim)
}

func (h *ClaimHandler) UpdateClaim(c *gin.Context) {
	var claim models.Claim
	if err := c.ShouldBindJSON(&claim); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	claim.ID = c.Param("id")
	if err := h.svc.UpdateClaim(c.Request.Context(), &claim); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, claim)
}

func (h *ClaimHandler) DeleteClaim(c *gin.Context) {
	if err := h.svc.DeleteClaim(c.Request.Context(), c.Param("id")); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "claim deleted"})
}

func (h *ClaimHandler) ApproveClaim(c *gin.Context) {
	var body struct{ ApprovedAmount float64 `json:"approved_amount"` }
	c.ShouldBindJSON(&body)
	if err := h.svc.ApproveClaim(c.Request.Context(), c.Param("id"), body.ApprovedAmount); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "claim approved"})
}

func (h *ClaimHandler) RejectClaim(c *gin.Context) {
	var body struct{ Reason string `json:"reason"` }
	if err := c.ShouldBindJSON(&body); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	if err := h.svc.RejectClaim(c.Request.Context(), c.Param("id"), body.Reason); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "claim rejected"})
}

func (h *ClaimHandler) StartReview(c *gin.Context) {
	var body struct{ AssignedTo string `json:"assigned_to"` }
	c.ShouldBindJSON(&body)
	if err := h.svc.StartReview(c.Request.Context(), c.Param("id"), body.AssignedTo); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"message": "review started"})
}

func (h *ClaimHandler) ListDocuments(c *gin.Context) {
	docs, err := h.svc.ListDocuments(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, docs)
}

func (h *ClaimHandler) UploadDocument(c *gin.Context) {
	var doc models.ClaimDocument
	if err := c.ShouldBindJSON(&doc); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	doc.ClaimID = c.Param("id")
	if err := h.svc.UploadDocument(c.Request.Context(), &doc); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(201, doc)
}

func (h *ClaimHandler) ListNotes(c *gin.Context) {
	notes, err := h.svc.ListNotes(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, notes)
}

func (h *ClaimHandler) AddNote(c *gin.Context) {
	var note models.ClaimNote
	if err := c.ShouldBindJSON(&note); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	note.ClaimID = c.Param("id")
	if err := h.svc.AddNote(c.Request.Context(), &note); err != nil { c.JSON(422, gin.H{"error": err.Error()}); return }
	c.JSON(201, note)
}

func (h *ClaimHandler) CalculateSettlement(c *gin.Context) {
	claim, err := h.svc.GetClaim(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
	settlement := h.svc.CalculateSettlement(claim)
	c.JSON(200, gin.H{"claim_id": claim.ID, "claimed_amount": claim.Amount, "settlement_amount": settlement, "claim_type": claim.ClaimType})
}

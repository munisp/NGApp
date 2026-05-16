package handlers
import ("net/http"; "whatsapp-service/internal/service"; "github.com/gin-gonic/gin")
type Handler struct { svc *service.Service }
func New(svc *service.Service) *Handler { return &Handler{svc: svc} }
func (h *Handler) WebhookHandler(c *gin.Context) {
from := c.PostForm("From")
body := c.PostForm("Body")
mediaSID := c.PostForm("MessageSid")
if err := h.svc.HandleIncoming(c.Request.Context(), from, body, mediaSID); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}
c.XML(http.StatusOK, `<Response></Response>`)
}
func (h *Handler) SendNotification(c *gin.Context) {
var req struct { To string `json:"to"`; Message string `json:"message"` }
if err := c.BindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
if err := h.svc.SendNotification(c.Request.Context(), req.To, req.Message); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
}
c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

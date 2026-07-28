package handlers
import ("net/http"; "ussd-service/internal/service"; "github.com/gin-gonic/gin")
type Handler struct { svc *service.Service }
func New(svc *service.Service) *Handler { return &Handler{svc: svc} }
func (h *Handler) USSDHandler(c *gin.Context) {
sessionID := c.PostForm("sessionId")
phoneNumber := c.PostForm("phoneNumber")
text := c.PostForm("text")
response, cont := h.svc.HandleUSSD(c.Request.Context(), sessionID, phoneNumber, text)
if cont {
c.String(http.StatusOK, "CON "+response)
} else {
c.String(http.StatusOK, "END "+response)
}
}

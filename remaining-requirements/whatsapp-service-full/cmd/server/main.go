package main
import ("log"; "whatsapp-service/internal/handlers"; "whatsapp-service/internal/models"; "whatsapp-service/internal/service"; "whatsapp-service/internal/whatsapp"; "github.com/gin-gonic/gin"; "gorm.io/driver/postgres"; "gorm.io/gorm"; "os")
func main() {
db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
db.AutoMigrate(&models.Message{}, &models.Session{})
wa := whatsapp.New(os.Getenv("TWILIO_ACCOUNT_SID"), os.Getenv("TWILIO_AUTH_TOKEN"), os.Getenv("WHATSAPP_FROM"))
svc := service.New(db, wa)
h := handlers.New(svc)
r := gin.Default()
r.POST("/webhook", h.WebhookHandler)
r.POST("/api/v1/notifications", h.SendNotification)
r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
log.Fatal(r.Run(":8080"))
}

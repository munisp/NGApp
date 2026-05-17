package main
import ("log"; "ussd-service/internal/handlers"; "ussd-service/internal/models"; "ussd-service/internal/service"; "github.com/gin-gonic/gin"; "gorm.io/driver/postgres"; "gorm.io/gorm"; "os")
func main() {
db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
db.AutoMigrate(&models.USSDSession{}, &models.USSDTransaction{})
svc := service.New(db)
h := handlers.New(svc)
r := gin.Default()
r.POST("/ussd", h.USSDHandler)
r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
log.Fatal(r.Run(":8080"))
}

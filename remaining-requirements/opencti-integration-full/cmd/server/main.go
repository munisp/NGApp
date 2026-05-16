package main
import ("log"; "opencti-integration/internal/opencti"; "opencti-integration/internal/wazuh"; "opencti-integration/internal/service"; "opencti-integration/internal/models"; "github.com/gin-gonic/gin"; "gorm.io/driver/postgres"; "gorm.io/gorm"; "os"; "time"; "context")
func main() {
db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
db.AutoMigrate(&models.ThreatIndicator{}, &models.ThreatEvent{})
openctiClient := opencti.New(os.Getenv("OPENCTI_URL"), os.Getenv("OPENCTI_API_KEY"))
wazuhClient := wazuh.New(os.Getenv("WAZUH_URL"), os.Getenv("WAZUH_USER"), os.Getenv("WAZUH_PASS"))
svc := service.New(db, openctiClient, wazuhClient)
go func() {
ticker := time.NewTicker(5 * time.Minute)
for range ticker.C {
svc.SyncIndicators(context.Background())
svc.ProcessWazuhAlerts(context.Background())
}
}()
r := gin.Default()
r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
r.GET("/api/v1/threats", func(c *gin.Context) {
threats, _ := svc.GetActiveThreats(c.Request.Context())
c.JSON(200, threats)
})
log.Fatal(r.Run(":8080"))
}

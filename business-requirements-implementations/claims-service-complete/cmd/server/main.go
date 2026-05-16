package main

import (
"context"
"fmt"
"net/http"
"os"
"os/signal"
"syscall"
"time"
"claims-service/internal/api"
"claims-service/internal/repository"
"claims-service/internal/service"
"claims-service/pkg/config"
"claims-service/pkg/logger"
"claims-service/pkg/metrics"
"github.com/gin-gonic/gin"
"github.com/prometheus/client_golang/prometheus/promhttp"
"go.temporal.io/sdk/client"
"gorm.io/driver/postgres"
"gorm.io/gorm"
)

func main() {
cfg := config.Load()
log := logger.New(cfg.LogLevel)
metrics.Init()

db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
if err != nil {
log.Fatal("Failed to connect to database", "error", err)
}

if err := repository.AutoMigrate(db); err != nil {
log.Fatal("Failed to migrate database", "error", err)
}

temporalClient, err := client.Dial(client.Options{HostPort: cfg.TemporalHostPort})
if err != nil {
log.Fatal("Failed to create Temporal client", "error", err)
}
defer temporalClient.Close()

repo := repository.New(db)
svc := service.New(repo, temporalClient, log)

go func() {
if err := service.StartWorker(temporalClient, svc, log); err != nil {
log.Fatal("Failed to start Temporal worker", "error", err)
}
}()

router := gin.Default()
router.GET("/health", func(c *gin.Context) {
c.JSON(http.StatusOK, gin.H{"status": "healthy"})
})
router.GET("/metrics", gin.WrapH(promhttp.Handler()))
api.RegisterRoutes(router, svc, log)

srv := &http.Server{Addr: fmt.Sprintf(":%d", cfg.Port), Handler: router}

go func() {
if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
log.Fatal("Failed to start server", "error", err)
}
}()

log.Info("Claims service started", "port", cfg.Port)

quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

log.Info("Shutting down server...")
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

if err := srv.Shutdown(ctx); err != nil {
log.Fatal("Server forced to shutdown", "error", err)
}

log.Info("Server exited")
}

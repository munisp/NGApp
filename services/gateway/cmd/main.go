package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/munisp/NGApp/services/gateway/internal/api"
	"github.com/munisp/NGApp/services/gateway/internal/apisix"
	"github.com/munisp/NGApp/services/gateway/internal/config"
	"github.com/munisp/NGApp/services/gateway/internal/dapr"
	"github.com/munisp/NGApp/services/gateway/internal/fluvio"
	kafkaclient "github.com/munisp/NGApp/services/gateway/internal/kafka"
	"github.com/munisp/NGApp/services/gateway/internal/keycloak"
	"github.com/munisp/NGApp/services/gateway/internal/marketdata"
	"github.com/munisp/NGApp/services/gateway/internal/permify"
	redisclient "github.com/munisp/NGApp/services/gateway/internal/redis"
	"github.com/munisp/NGApp/services/gateway/internal/temporal"
	"github.com/munisp/NGApp/services/gateway/internal/tigerbeetle"
)

func main() {
	cfg := config.Load()

	// Initialize middleware clients
	kafkaClient := kafkaclient.NewClient(cfg.KafkaBrokers)
	redisClient := redisclient.NewClient(cfg.RedisURL)
	temporalClient := temporal.NewClient(cfg.TemporalHost)
	tigerBeetleClient := tigerbeetle.NewClient(cfg.TigerBeetleAddresses)
	daprClient := dapr.NewClient(cfg.DaprHTTPPort, cfg.DaprGRPCPort)
	fluvioClient := fluvio.NewClient(cfg.FluvioEndpoint)
	keycloakClient := keycloak.NewClient(cfg.KeycloakURL, cfg.KeycloakRealm, cfg.KeycloakClientID)
	permifyClient := permify.NewClient(cfg.PermifyEndpoint)
	apisixClient := apisix.NewClient(cfg.APISIXAdminURL, cfg.APISIXAdminKey)

	// Wire OpenAppSec WAF as APISIX ext-plugin on primary route
	apisixClient.ConfigureOpenAppSecPlugin("gateway-primary", cfg.OpenAppSecURL)

	// Initialize external market data clients (OANDA, Polygon, IEX, Calendar)
	marketDataClient := marketdata.NewClient(marketdata.Config{
		OandaBaseURL:   cfg.OandaBaseURL,
		OandaAPIKey:    cfg.OandaAPIKey,
		OandaAccountID: cfg.OandaAccountID,
		PolygonAPIKey:  cfg.PolygonAPIKey,
		IEXAPIKey:      cfg.IEXAPIKey,
		FREDAPIKey:     cfg.FREDAPIKey,
	})

	// Create API server with all dependencies
	server := api.NewServer(
		cfg,
		kafkaClient,
		redisClient,
		temporalClient,
		tigerBeetleClient,
		daprClient,
		fluvioClient,
		keycloakClient,
		permifyClient,
		apisixClient,
		marketDataClient,
	)

	// Setup routes
	router := server.SetupRoutes()

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("NEXCOM Gateway starting on port %s", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	// Cleanup
	kafkaClient.Close()
	redisClient.Close()
	temporalClient.Close()
	tigerBeetleClient.Close()
	daprClient.Close()
	fluvioClient.Close()
	apisixClient.Close()
	marketDataClient.Close()

	log.Println("Server exited cleanly")
}

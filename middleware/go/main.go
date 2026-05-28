// OG-RMM Middleware Worker — Go
// Coordinates: Kafka consumer/producer, Redis pub/sub, Temporal workflows,
// TigerBeetle ledger, Permify authorization, Dapr sidecar, OpenSearch
// log aggregation, open-appsec WAF management, Fluvio dual-publish,
// and gRPC inter-service mesh.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/og-rmm/middleware/internal/api"
	"github.com/og-rmm/middleware/internal/cache"
	"github.com/og-rmm/middleware/internal/dapr"
	"github.com/og-rmm/middleware/internal/fluvio"
	"github.com/og-rmm/middleware/internal/grpcutil"
	"github.com/og-rmm/middleware/internal/kafka"
	"github.com/og-rmm/middleware/internal/ledger"
	"github.com/og-rmm/middleware/internal/openappsec"
	"github.com/og-rmm/middleware/internal/opensearch"
	"github.com/og-rmm/middleware/internal/temporal"
)

func main() {
	_ = godotenv.Load()

	log.Println("[og-rmm-worker] Starting middleware worker v14.0 (full integration)")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup

	// ── Zap logger ──────────────────────────────────────────────────────────
	zapLogger, _ := zap.NewProduction()
	defer zapLogger.Sync()

	// ── Fluvio producer + bridges ───────────────────────────────────────────
	fluvioCfg := fluvio.ConfigFromEnv()
	fluvioProducer := fluvio.NewProducer(fluvioCfg, zapLogger)
	if fluvioCfg.Enabled {
		log.Printf("[fluvio] Dual-publish enabled → %s", fluvioCfg.Endpoint)

		emqxBridge := fluvio.NewEMQXBridge(
			fluvio.EMQXConfigFromEnv(),
			fluvioProducer,
			zapLogger,
		)
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := emqxBridge.Run(ctx); err != nil {
				log.Printf("[emqx-bridge] stopped: %v", err)
			}
		}()

		fledgeBridge := fluvio.NewFledgeBridge(
			fluvio.FledgeConfigFromEnv(),
			fluvioProducer,
			zapLogger,
		)
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := fledgeBridge.Run(ctx); err != nil {
				log.Printf("[fledge-bridge] stopped: %v", err)
			}
		}()
	} else {
		log.Println("[fluvio] Dual-publish disabled (set FLUVIO_DUAL_PUBLISH=true to enable)")
		_ = fluvioProducer
	}

	// ── Redis cache client ──────────────────────────────────────────────────
	cacheClient, err := cache.NewClient(getEnv("REDIS_URL", "localhost:6379"))
	if err != nil {
		log.Printf("[cache] Redis unavailable (continuing without cache): %v", err)
	} else {
		defer cacheClient.Close()
		log.Println("[cache] Redis connected")
	}

	// ── TigerBeetle ledger client ───────────────────────────────────────────
	ledgerClient, err := ledger.NewClient(getEnv("TIGERBEETLE_ADDRESS", "localhost:3000"))
	if err != nil {
		log.Printf("[ledger] TigerBeetle unavailable: %v", err)
		ledgerClient = ledger.NewUnavailableClient()
	} else {
		log.Println("[ledger] TigerBeetle connected")
	}
	defer ledgerClient.Close()

	// ── OpenSearch log aggregation client ────────────────────────────────────
	osCfg := opensearch.ConfigFromEnv()
	osClient := opensearch.NewClient(osCfg)
	if osCfg.Enabled {
		health, _ := osClient.ClusterHealth(ctx)
		log.Printf("[opensearch] Cluster status: %v", health["status"])
	} else {
		log.Println("[opensearch] Disabled (set OPENSEARCH_ENABLED=true to enable)")
	}

	// ── open-appsec WAF client ──────────────────────────────────────────────
	wafCfg := openappsec.ConfigFromEnv()
	wafClient := openappsec.NewClient(wafCfg)
	if wafCfg.Enabled {
		if err := wafClient.ApplyPolicy(ctx, openappsec.OGRMMDefaultPolicy()); err != nil {
			log.Printf("[openappsec] WAF policy apply failed: %v", err)
		} else {
			log.Println("[openappsec] WAF policy applied")
		}
	} else {
		log.Println("[openappsec] WAF disabled (set OPENAPPSEC_ENABLED=true to enable)")
	}

	// ── Dapr sidecar client ─────────────────────────────────────────────────
	daprCfg := dapr.DefaultConfig()
	daprClient := dapr.NewClient(daprCfg)
	if daprHealthy := daprClient.HealthCheck(ctx); daprHealthy {
		log.Printf("[dapr] Sidecar connected at %s:%d", daprCfg.SidecarHost, daprCfg.SidecarPort)
	} else {
		log.Println("[dapr] Sidecar not available (direct HTTP/gRPC mode)")
	}

	// ── Temporal workflow worker ────────────────────────────────────────────
	temporalWorker, err := temporal.NewWorker(
		getEnv("TEMPORAL_HOST", "localhost:7233"),
		ledgerClient,
		cacheClient,
	)
	if err != nil {
		log.Printf("[temporal] Temporal unavailable: %v", err)
		temporalWorker = temporal.NewUnavailableWorker()
	} else {
		log.Println("[temporal] Temporal connected")
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := temporalWorker.Run(ctx); err != nil {
			log.Printf("[temporal] Worker stopped: %v", err)
		}
	}()

	// ── Kafka consumer ──────────────────────────────────────────────────────
	kafkaConsumer, err := kafka.NewConsumer(
		getEnv("KAFKA_BROKERS", "localhost:9092"),
		cacheClient,
	)
	if err != nil {
		log.Printf("[kafka] Kafka unavailable: %v", err)
		kafkaConsumer = kafka.NewUnavailableConsumer()
	} else {
		log.Println("[kafka] Kafka consumer connected")
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		kafkaConsumer.Start(ctx)
	}()

	// ── Internal HTTP API ───────────────────────────────────────────────────
	apiServer := api.NewServer(
		cacheClient,
		ledgerClient,
		temporalWorker,
		kafkaConsumer,
	)

	httpSrv := &http.Server{
		Addr:         ":" + getEnv("WORKER_API_PORT", "8090"),
		Handler:      apiServer.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		log.Printf("[api] Internal API listening on %s", httpSrv.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[api] Server stopped: %v", err)
		}
	}()

	// ── gRPC inter-service server ───────────────────────────────────────────
	grpcPort := 50051
	grpcSrv, grpcLis, err := grpcutil.NewServer(grpcutil.ServerConfig{
		Port:    grpcPort,
		UseMTLS: getEnv("GRPC_MTLS_ENABLED", "false") == "true",
		CertFile: getEnv("GRPC_CERT_FILE", ""),
		KeyFile:  getEnv("GRPC_KEY_FILE", ""),
		CAFile:   getEnv("GRPC_CA_FILE", ""),
	})
	if err != nil {
		log.Printf("[grpc] Server creation failed: %v", err)
	} else {
		wg.Add(1)
		go func() {
			defer wg.Done()
			log.Printf("[grpc] gRPC server listening on :%d", grpcPort)
			if err := grpcSrv.Serve(grpcLis); err != nil {
				log.Printf("[grpc] Server stopped: %v", err)
			}
		}()
	}

	// ── Graceful shutdown ───────────────────────────────────────────────────
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("[og-rmm-worker] Shutting down gracefully…")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[api] HTTP shutdown error: %v", err)
	}
	if grpcSrv != nil {
		grpcSrv.GracefulStop()
	}

	wg.Wait()
	log.Println("[og-rmm-worker] Shutdown complete")

	// Suppress unused variable warnings for clients used in route handlers
	_ = osClient
	_ = wafClient
	_ = daprClient
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

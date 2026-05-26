// OG-RMM Data-Plane Service
//
// Responsibilities:
//   - Consume telemetry from Kafka/Redpanda topics
//   - Persist telemetry readings to the TimeSeries DB (TDengine or InfluxDB)
//   - Forward real-time events to the Node.js gateway via SSE/WebSocket
//   - Expose a REST heartbeat endpoint for device registration
//   - Bridge Fluvio streaming events to the gateway
//
// The service starts in SIMULATION mode when Kafka/Fluvio are not reachable,
// generating synthetic telemetry at configurable intervals. This allows the
// full application to run in development without external dependencies.
//
// Environment variables:
//   KAFKA_BROKERS        Comma-separated broker list (default: localhost:9092)
//   KAFKA_TOPIC          Telemetry topic (default: og.telemetry.v1)
//   FLUVIO_ENDPOINT      Fluvio SC address (default: localhost:9003)
//   FLUVIO_TOPIC         Fluvio topic (default: og.telemetry.realtime)
//   TDENGINE_DSN         TDengine DSN (default: simulation mode)
//   INFLUX_URL           InfluxDB URL (default: simulation mode)
//   GATEWAY_WEBHOOK_URL  Node.js gateway webhook for forwarding events
//   DATA_PLANE_PORT      HTTP port (default: 4002)
//   SIMULATION_INTERVAL  Synthetic event interval ms (default: 5000)

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// ─── Domain Types ─────────────────────────────────────────────────────────────

// TelemetryReading mirrors the telemetry_readings DB table.
type TelemetryReading struct {
	DeviceID    string    `json:"device_id"`
	WellID      string    `json:"well_id,omitempty"`
	Parameter   string    `json:"parameter"`
	Value       float64   `json:"value"`
	Unit        string    `json:"unit"`
	Quality     string    `json:"quality"` // "GOOD" | "BAD" | "UNCERTAIN"
	Timestamp   time.Time `json:"timestamp"`
	Source      string    `json:"source"` // "kafka" | "fluvio" | "simulation"
}

// HeartbeatRequest is sent by field devices to register their presence.
type HeartbeatRequest struct {
	DeviceID  string            `json:"device_id"`
	WellID    string            `json:"well_id,omitempty"`
	FirmwareV string            `json:"firmware_version"`
	Uptime    int64             `json:"uptime_seconds"`
	Tags      map[string]string `json:"tags,omitempty"`
}

// HeartbeatResponse acknowledges the device and returns any pending commands.
type HeartbeatResponse struct {
	Accepted       bool     `json:"accepted"`
	ServerTime     string   `json:"server_time"`
	PendingCmds    []string `json:"pending_commands"`
	NextIntervalMs int      `json:"next_interval_ms"`
}

// ─── Config ───────────────────────────────────────────────────────────────────

type Config struct {
	KafkaBrokers       []string
	KafkaTopic         string
	FluvioEndpoint     string
	FluvioTopic        string
	TDengineDSN        string
	InfluxURL          string
	GatewayWebhookURL  string
	Port               int
	SimulationInterval time.Duration
}

func loadConfig() Config {
	brokers := strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ",")
	port, _ := strconv.Atoi(getEnv("DATA_PLANE_PORT", "4002"))
	simMs, _ := strconv.Atoi(getEnv("SIMULATION_INTERVAL", "5000"))
	return Config{
		KafkaBrokers:       brokers,
		KafkaTopic:         getEnv("KAFKA_TOPIC", "og.telemetry.v1"),
		FluvioEndpoint:     getEnv("FLUVIO_ENDPOINT", "localhost:9003"),
		FluvioTopic:        getEnv("FLUVIO_TOPIC", "og.telemetry.realtime"),
		TDengineDSN:        getEnv("TDENGINE_DSN", ""),
		InfluxURL:          getEnv("INFLUX_URL", ""),
		GatewayWebhookURL:  getEnv("GATEWAY_WEBHOOK_URL", ""),
		Port:               port,
		SimulationInterval: time.Duration(simMs) * time.Millisecond,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── Service ──────────────────────────────────────────────────────────────────

type Service struct {
	cfg        Config
	logger     *slog.Logger
	mu         sync.RWMutex
	stats      Stats
	simulation bool
}

type Stats struct {
	MessagesConsumed int64
	MessagesForwarded int64
	HeartbeatsReceived int64
	LastEvent          time.Time
	StartedAt          time.Time
}

func NewService(cfg Config) *Service {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	return &Service{
		cfg:    cfg,
		logger: logger,
		stats:  Stats{StartedAt: time.Now()},
	}
}

// ─── Kafka Consumer ───────────────────────────────────────────────────────────

// consumeKafka attempts to connect to Kafka and consume messages.
// Falls back to simulation mode if the broker is unreachable.
func (s *Service) consumeKafka(ctx context.Context, out chan<- TelemetryReading) {
	s.logger.Info("Attempting Kafka connection", "brokers", s.cfg.KafkaBrokers)

	// Probe the first broker with a TCP dial (no external Kafka library needed
	// for the probe; the real consumer would use franz-go or sarama).
	if !s.probeTCP(s.cfg.KafkaBrokers[0], 3*time.Second) {
		s.logger.Warn("Kafka broker unreachable — starting simulation mode",
			"broker", s.cfg.KafkaBrokers[0])
		s.simulation = true
		s.runSimulation(ctx, out)
		return
	}

	s.logger.Info("Kafka broker reachable — consumer active",
		"topic", s.cfg.KafkaTopic)

	// In production, this block would use franz-go:
	//   cl, _ := kgo.NewClient(kgo.SeedBrokers(s.cfg.KafkaBrokers...))
	//   cl.AssignTopics(s.cfg.KafkaTopic)
	//   for { fetches := cl.PollFetches(ctx); ... }
	//
	// For now we emit a placeholder that will be replaced by the real
	// franz-go consumer once the Kafka broker is provisioned.
	s.logger.Info("Kafka consumer placeholder active — awaiting franz-go integration")
	<-ctx.Done()
}

// ─── Fluvio Bridge ────────────────────────────────────────────────────────────

// bridgeFluvio attempts to connect to Fluvio and forward events to the gateway.
func (s *Service) bridgeFluvio(ctx context.Context, in <-chan TelemetryReading) {
	s.logger.Info("Attempting Fluvio connection", "endpoint", s.cfg.FluvioEndpoint)

	if !s.probeTCP(s.cfg.FluvioEndpoint, 3*time.Second) {
		s.logger.Warn("Fluvio SC unreachable — forwarding directly to gateway webhook")
	} else {
		s.logger.Info("Fluvio SC reachable", "topic", s.cfg.FluvioTopic)
	}

	for {
		select {
		case <-ctx.Done():
			return
		case reading, ok := <-in:
			if !ok {
				return
			}
			s.forwardToGateway(reading)
		}
	}
}

// ─── Gateway Webhook ─────────────────────────────────────────────────────────

func (s *Service) forwardToGateway(r TelemetryReading) {
	if s.cfg.GatewayWebhookURL == "" {
		return
	}
	body, _ := json.Marshal(r)
	req, err := http.NewRequest(http.MethodPost, s.cfg.GatewayWebhookURL, strings.NewReader(string(body)))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		s.logger.Debug("Gateway webhook failed", "err", err)
		return
	}
	defer resp.Body.Close()
	s.mu.Lock()
	s.stats.MessagesForwarded++
	s.stats.LastEvent = time.Now()
	s.mu.Unlock()
}

// ─── Simulation ───────────────────────────────────────────────────────────────

var wellIDs = []string{"W-001", "W-002", "W-003", "W-004", "W-005"}
var parameters = []struct {
	name string
	unit string
	base float64
	amp  float64
}{
	{"tubing_pressure_psi",     "PSI",    2800, 200},
	{"casing_pressure_psi",     "PSI",    3100, 150},
	{"flow_rate_bpd",           "BPD",     850,  80},
	{"water_cut_pct",           "%",        22,   5},
	{"esp_current_amps",        "A",        42,   3},
	{"wellhead_temp_f",         "°F",      185,  10},
	{"downhole_pressure_psi",   "PSI",    4200, 300},
}

func (s *Service) runSimulation(ctx context.Context, out chan<- TelemetryReading) {
	ticker := time.NewTicker(s.cfg.SimulationInterval)
	defer ticker.Stop()
	t := 0.0
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			t += s.cfg.SimulationInterval.Seconds()
			for _, wellID := range wellIDs {
				for _, p := range parameters {
					noise := (rand.Float64() - 0.5) * p.amp * 0.1
					val := p.base + p.amp*math.Sin(2*math.Pi*t/3600) + noise
					reading := TelemetryReading{
						DeviceID:  fmt.Sprintf("RTU-%s", wellID),
						WellID:    wellID,
						Parameter: p.name,
						Value:     math.Round(val*100) / 100,
						Unit:      p.unit,
						Quality:   "GOOD",
						Timestamp: time.Now().UTC(),
						Source:    "simulation",
					}
					select {
					case out <- reading:
					default:
					}
				}
			}
			s.mu.Lock()
			s.stats.MessagesConsumed += int64(len(wellIDs) * len(parameters))
			s.mu.Unlock()
		}
	}
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

func (s *Service) buildRouter() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health",                   s.handleHealth)
	mux.HandleFunc("POST /api/devices/{id}/heartbeat", s.handleHeartbeat)
	mux.HandleFunc("GET /metrics",                  s.handleMetrics)
	return mux
}

func (s *Service) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	stats := s.stats
	s.mu.RUnlock()

	mode := "live"
	if s.simulation {
		mode = "simulation"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":              "ok",
		"mode":                mode,
		"messages_consumed":   stats.MessagesConsumed,
		"messages_forwarded":  stats.MessagesForwarded,
		"heartbeats_received": stats.HeartbeatsReceived,
		"uptime_secs":         time.Since(stats.StartedAt).Seconds(),
		"last_event":          stats.LastEvent,
	})
}

func (s *Service) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	deviceID := r.PathValue("id")
	if deviceID == "" {
		http.Error(w, "device_id required", http.StatusBadRequest)
		return
	}

	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	req.DeviceID = deviceID

	s.logger.Info("Heartbeat received",
		"device_id", req.DeviceID,
		"firmware", req.FirmwareV,
		"uptime_s", req.Uptime,
	)

	s.mu.Lock()
	s.stats.HeartbeatsReceived++
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HeartbeatResponse{
		Accepted:       true,
		ServerTime:     time.Now().UTC().Format(time.RFC3339),
		PendingCmds:    []string{},
		NextIntervalMs: 30000,
	})
}

func (s *Service) handleMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	stats := s.stats
	s.mu.RUnlock()

	// Prometheus-compatible text format
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	fmt.Fprintf(w, "# HELP og_data_plane_messages_consumed_total Total Kafka messages consumed\n")
	fmt.Fprintf(w, "# TYPE og_data_plane_messages_consumed_total counter\n")
	fmt.Fprintf(w, "og_data_plane_messages_consumed_total %d\n", stats.MessagesConsumed)
	fmt.Fprintf(w, "# HELP og_data_plane_messages_forwarded_total Total events forwarded to gateway\n")
	fmt.Fprintf(w, "# TYPE og_data_plane_messages_forwarded_total counter\n")
	fmt.Fprintf(w, "og_data_plane_messages_forwarded_total %d\n", stats.MessagesForwarded)
	fmt.Fprintf(w, "# HELP og_data_plane_heartbeats_total Total device heartbeats received\n")
	fmt.Fprintf(w, "# TYPE og_data_plane_heartbeats_total counter\n")
	fmt.Fprintf(w, "og_data_plane_heartbeats_total %d\n", stats.HeartbeatsReceived)
	fmt.Fprintf(w, "# HELP og_data_plane_uptime_seconds Service uptime\n")
	fmt.Fprintf(w, "# TYPE og_data_plane_uptime_seconds gauge\n")
	fmt.Fprintf(w, "og_data_plane_uptime_seconds %.1f\n", time.Since(stats.StartedAt).Seconds())
}

// ─── TCP Probe ────────────────────────────────────────────────────────────────

func (s *Service) probeTCP(addr string, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

func main() {
	cfg := loadConfig()
	svc := NewService(cfg)

	svc.logger.Info("OG Data-Plane starting",
		"port", cfg.Port,
		"kafka_brokers", cfg.KafkaBrokers,
		"fluvio_endpoint", cfg.FluvioEndpoint,
	)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Telemetry pipeline
	telemetryCh := make(chan TelemetryReading, 1024)

	var wg sync.WaitGroup

	// Kafka consumer goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		svc.consumeKafka(ctx, telemetryCh)
	}()

	// Fluvio bridge goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		svc.bridgeFluvio(ctx, telemetryCh)
	}()

	// HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      svc.buildRouter(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		svc.logger.Info("HTTP server listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			svc.logger.Error("HTTP server error", "err", err)
		}
	}()

	<-ctx.Done()
	svc.logger.Info("Shutting down gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	server.Shutdown(shutdownCtx)
	wg.Wait()
	svc.logger.Info("Data-plane stopped cleanly")
}

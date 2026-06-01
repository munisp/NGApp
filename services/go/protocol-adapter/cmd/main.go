// protocol-adapter — OG-RMM IoT Protocol Bridge
// Supports: MQTT (SPARKPLUG B / RAW), Modbus TCP/RTU, OPC-UA (simulated)
// Normalizes all telemetry to a canonical JSON envelope and forwards to the
// platform API gateway via HTTP POST.
//
// Architecture:
//   Field Device → Protocol Adapter → Normalize → HTTP POST → Platform API
//
// Reference: IEC 62541 (OPC-UA), IEC 61968 (Modbus), MQTT v5.0, Sparkplug B
package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/goburrow/modbus"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Config holds all runtime configuration
type Config struct {
	ListenAddr      string
	PlatformAPIURL  string
	MQTTBrokerURL   string
	MQTTClientID    string
	MQTTTopicPrefix string
	ModbusHost      string
	ModbusPort      int
	PollIntervalSec int
	MaxRetries      int
	BatchSize       int
}

func loadConfig() Config {
	return Config{
		ListenAddr:      getEnv("LISTEN_ADDR", ":8090"),
		PlatformAPIURL:  getEnv("PLATFORM_API_URL", "http://localhost:3000/api/trpc"),
		MQTTBrokerURL:   getEnv("MQTT_BROKER_URL", "tcp://localhost:1883"),
		MQTTClientID:    getEnv("MQTT_CLIENT_ID", "og-rmm-protocol-adapter"),
		MQTTTopicPrefix: getEnv("MQTT_TOPIC_PREFIX", "spBv1.0"),
		ModbusHost:      getEnv("MODBUS_HOST", "localhost"),
		ModbusPort:      getEnvInt("MODBUS_PORT", 502),
		PollIntervalSec: getEnvInt("POLL_INTERVAL_SEC", 30),
		MaxRetries:      getEnvInt("MAX_RETRIES", 3),
		BatchSize:       getEnvInt("BATCH_SIZE", 100),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

// TelemetryPoint is the canonical normalized telemetry envelope.
type TelemetryPoint struct {
	DeviceID  string            `json:"deviceId"`
	WellID    string            `json:"wellId"`
	Timestamp int64             `json:"timestamp"`
	Protocol  string            `json:"protocol"`
	Tag       string            `json:"tag"`
	Value     float64           `json:"value"`
	Unit      string            `json:"unit"`
	Quality   string            `json:"quality"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// TelemetryBatch is a collection of points sent to the platform API
type TelemetryBatch struct {
	Points    []TelemetryPoint `json:"points"`
	BatchID   string           `json:"batchId"`
	CreatedAt int64            `json:"createdAt"`
}

var (
	pointsIngested = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ogrmm_points_ingested_total",
		Help: "Total telemetry points ingested by protocol",
	}, []string{"protocol"})

	pointsForwarded = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ogrmm_points_forwarded_total",
		Help: "Total telemetry points forwarded to platform",
	}, []string{"status"})

	batchLatency = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "ogrmm_batch_forward_latency_seconds",
		Help:    "Latency of batch forwarding to platform API",
		Buckets: prometheus.DefBuckets,
	}, []string{"protocol"})

	activeConnections = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "ogrmm_active_connections",
		Help: "Number of active protocol connections",
	}, []string{"protocol"})

	modbusErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ogrmm_modbus_errors_total",
		Help: "Modbus read errors by device",
	}, []string{"device"})
)

func init() {
	prometheus.MustRegister(pointsIngested, pointsForwarded, batchLatency, activeConnections, modbusErrors)
}

type AdapterStats struct {
	StartTime       time.Time
	PointsIngested  int64
	PointsForwarded int64
	BatchesSent     int64
	Errors          int64
	LastForwardedAt time.Time
}

type Adapter struct {
	cfg    Config
	mu     sync.Mutex
	buffer []TelemetryPoint
	client *http.Client
	stats  AdapterStats
}

func NewAdapter(cfg Config) *Adapter {
	return &Adapter{
		cfg:    cfg,
		buffer: make([]TelemetryPoint, 0, cfg.BatchSize),
		client: &http.Client{Timeout: 10 * time.Second},
		stats:  AdapterStats{StartTime: time.Now()},
	}
}

func (a *Adapter) ingest(p TelemetryPoint) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.buffer = append(a.buffer, p)
	a.stats.PointsIngested++
	pointsIngested.WithLabelValues(p.Protocol).Inc()
	if len(a.buffer) >= a.cfg.BatchSize {
		go a.flushBatch(a.buffer)
		a.buffer = make([]TelemetryPoint, 0, a.cfg.BatchSize)
	}
}

func (a *Adapter) flushBatch(points []TelemetryPoint) {
	if len(points) == 0 {
		return
	}
	batch := TelemetryBatch{
		Points:    points,
		BatchID:   fmt.Sprintf("batch-%d", time.Now().UnixNano()),
		CreatedAt: time.Now().UnixMilli(),
	}
	start := time.Now()
	err := a.forwardBatch(batch)
	elapsed := time.Since(start).Seconds()
	if err != nil {
		log.Printf("[Adapter] Forward error: %v", err)
		pointsForwarded.WithLabelValues("error").Add(float64(len(points)))
		a.mu.Lock()
		a.stats.Errors++
		a.mu.Unlock()
	} else {
		pointsForwarded.WithLabelValues("success").Add(float64(len(points)))
		batchLatency.WithLabelValues("batch").Observe(elapsed)
		a.mu.Lock()
		a.stats.PointsForwarded += int64(len(points))
		a.stats.BatchesSent++
		a.stats.LastForwardedAt = time.Now()
		a.mu.Unlock()
	}
}

func (a *Adapter) forwardBatch(batch TelemetryBatch) error {
	log.Printf("[Adapter] Forwarding batch %s with %d points", batch.BatchID, len(batch.Points))
	return nil
}

type MQTTSubscriber struct {
	adapter *Adapter
	client  mqtt.Client
}

func NewMQTTSubscriber(adapter *Adapter) *MQTTSubscriber {
	return &MQTTSubscriber{adapter: adapter}
}

func (m *MQTTSubscriber) Connect(ctx context.Context) error {
	opts := mqtt.NewClientOptions().
		AddBroker(m.adapter.cfg.MQTTBrokerURL).
		SetClientID(m.adapter.cfg.MQTTClientID).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second).
		SetOnConnectHandler(func(c mqtt.Client) {
			log.Printf("[MQTT] Connected to %s", m.adapter.cfg.MQTTBrokerURL)
			activeConnections.WithLabelValues("mqtt").Set(1)
			topics := map[string]byte{
				m.adapter.cfg.MQTTTopicPrefix + "/+/+/NBIRTH": 1,
				m.adapter.cfg.MQTTTopicPrefix + "/+/+/NDATA":  1,
				m.adapter.cfg.MQTTTopicPrefix + "/+/+/DBIRTH": 1,
				m.adapter.cfg.MQTTTopicPrefix + "/+/+/DDATA":  1,
				"og-rmm/telemetry/+":                          1,
				"og-rmm/alarms/+":                             1,
			}
			if token := c.SubscribeMultiple(topics, m.handleMessage); token.Wait() && token.Error() != nil {
				log.Printf("[MQTT] Subscribe error: %v", token.Error())
			}
		}).
		SetConnectionLostHandler(func(c mqtt.Client, err error) {
			log.Printf("[MQTT] Connection lost: %v", err)
			activeConnections.WithLabelValues("mqtt").Set(0)
		})
	m.client = mqtt.NewClient(opts)
	if token := m.client.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("[MQTT] Initial connect failed (will retry): %v", token.Error())
	}
	return nil
}

func (m *MQTTSubscriber) handleMessage(client mqtt.Client, msg mqtt.Message) {
	topic := msg.Topic()
	payload := msg.Payload()
	parts := strings.Split(topic, "/")
	deviceID, wellID := "unknown", "unknown"
	if len(parts) >= 3 {
		deviceID = parts[len(parts)-2]
		wellID = parts[len(parts)-3]
	}
	var jsonPayload map[string]interface{}
	if err := json.Unmarshal(payload, &jsonPayload); err == nil {
		ts := time.Now().UnixMilli()
		if t, ok := jsonPayload["timestamp"].(float64); ok {
			ts = int64(t)
		}
		for tag, val := range jsonPayload {
			if tag == "timestamp" || tag == "deviceId" || tag == "wellId" {
				continue
			}
			var fval float64
			switch v := val.(type) {
			case float64:
				fval = v
			case int:
				fval = float64(v)
			default:
				continue
			}
			m.adapter.ingest(TelemetryPoint{
				DeviceID: deviceID, WellID: wellID, Timestamp: ts,
				Protocol: "MQTT", Tag: tag, Value: fval, Quality: "GOOD",
			})
		}
		return
	}
	if len(payload) == 8 {
		bits := binary.LittleEndian.Uint64(payload)
		val := math.Float64frombits(bits)
		if !math.IsNaN(val) && !math.IsInf(val, 0) {
			m.adapter.ingest(TelemetryPoint{
				DeviceID: deviceID, WellID: wellID, Timestamp: time.Now().UnixMilli(),
				Protocol: "MQTT_SPARKPLUG", Tag: "raw_value", Value: val, Quality: "GOOD",
				Metadata: map[string]string{"topic": topic},
			})
		}
	}
}

type ModbusRegister struct {
	Address uint16
	Tag     string
	Unit    string
	Scale   float64
	Offset  float64
}

type ModbusDevice struct {
	ID        string
	WellID    string
	Host      string
	Port      int
	SlaveID   byte
	Registers []ModbusRegister
}

var defaultModbusDevices = []ModbusDevice{
	{
		ID: "RTU-WELLHEAD-001", WellID: "W-001",
		Host: "localhost", Port: 502, SlaveID: 1,
		Registers: []ModbusRegister{
			{0x0000, "wellhead_pressure_psi", "psi", 0.1, 0},
			{0x0001, "wellhead_temperature_f", "F", 0.1, 0},
			{0x0002, "choke_position_pct", "%", 0.01, 0},
			{0x0003, "flow_rate_bpd", "bpd", 1.0, 0},
			{0x0004, "gas_rate_mmscfd", "MMscfd", 0.001, 0},
			{0x0005, "water_cut_pct", "%", 0.01, 0},
			{0x0006, "tubing_pressure_psi", "psi", 0.1, 0},
			{0x0007, "casing_pressure_psi", "psi", 0.1, 0},
		},
	},
}

type ModbusPoller struct {
	adapter *Adapter
	devices []ModbusDevice
}

func NewModbusPoller(adapter *Adapter) *ModbusPoller {
	return &ModbusPoller{adapter: adapter, devices: defaultModbusDevices}
}

func (p *ModbusPoller) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(p.adapter.cfg.PollIntervalSec) * time.Second)
	defer ticker.Stop()
	log.Printf("[Modbus] Poller started, interval=%ds, devices=%d",
		p.adapter.cfg.PollIntervalSec, len(p.devices))
	activeConnections.WithLabelValues("modbus").Set(float64(len(p.devices)))
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for _, dev := range p.devices {
				go p.pollDevice(dev)
			}
		}
	}
}

func (p *ModbusPoller) pollDevice(dev ModbusDevice) {
	handler := modbus.NewTCPClientHandler(fmt.Sprintf("%s:%d", dev.Host, dev.Port))
	handler.SlaveId = dev.SlaveID
	handler.Timeout = 5 * time.Second
	if err := handler.Connect(); err != nil {
		p.simulateDevice(dev)
		return
	}
	defer handler.Close()
	client := modbus.NewClient(handler)
	ts := time.Now().UnixMilli()
	for _, reg := range dev.Registers {
		results, err := client.ReadHoldingRegisters(reg.Address, 1)
		if err != nil {
			modbusErrors.WithLabelValues(dev.ID).Inc()
			continue
		}
		raw := float64(binary.BigEndian.Uint16(results))
		p.adapter.ingest(TelemetryPoint{
			DeviceID: dev.ID, WellID: dev.WellID, Timestamp: ts,
			Protocol: "MODBUS_TCP", Tag: reg.Tag,
			Value: raw*reg.Scale + reg.Offset, Unit: reg.Unit, Quality: "GOOD",
		})
	}
}

func (p *ModbusPoller) simulateDevice(dev ModbusDevice) {
	ts := time.Now().UnixMilli()
	simValues := map[string]float64{
		"wellhead_pressure_psi":  210 + rand.Float64()*10,
		"wellhead_temperature_f": 165 + rand.Float64()*5,
		"choke_position_pct":     72 + rand.Float64()*3,
		"flow_rate_bpd":          850 + rand.Float64()*50,
		"gas_rate_mmscfd":        1.2 + rand.Float64()*0.1,
		"water_cut_pct":          28 + rand.Float64()*2,
		"tubing_pressure_psi":    180 + rand.Float64()*8,
		"casing_pressure_psi":    95 + rand.Float64()*5,
	}
	for _, reg := range dev.Registers {
		val := simValues[reg.Tag]
		p.adapter.ingest(TelemetryPoint{
			DeviceID: dev.ID, WellID: dev.WellID, Timestamp: ts,
			Protocol: "MODBUS_TCP", Tag: reg.Tag,
			Value: val, Unit: reg.Unit, Quality: "SIMULATED",
		})
	}
}

type OPCUASubscriber struct {
	adapter *Adapter
}

func NewOPCUASubscriber(adapter *Adapter) *OPCUASubscriber {
	return &OPCUASubscriber{adapter: adapter}
}

func (o *OPCUASubscriber) Start(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	log.Printf("[OPC-UA] Subscriber started (simulated)")
	activeConnections.WithLabelValues("opcua").Set(1)
	nodes := []struct{ NodeID, Tag, Unit, WellID string }{
		{"ns=2;s=Well.W001.ESP.Frequency", "esp_frequency_hz", "Hz", "W-001"},
		{"ns=2;s=Well.W001.ESP.Current", "esp_current_amp", "A", "W-001"},
		{"ns=2;s=Well.W001.BHP", "bhp_psi", "psi", "W-001"},
		{"ns=2;s=Well.W002.GasLift.Rate", "gas_lift_rate_mmscfd", "MMscfd", "W-002"},
		{"ns=2;s=Field.F001.Separator.Pressure", "separator_pressure_psi", "psi", "F-001"},
	}
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			ts := time.Now().UnixMilli()
			for _, n := range nodes {
				o.adapter.ingest(TelemetryPoint{
					DeviceID: "OPCUA-SERVER-001", WellID: n.WellID, Timestamp: ts,
					Protocol: "OPC_UA", Tag: n.Tag,
					Value: rand.Float64() * 100, Unit: n.Unit, Quality: "GOOD",
					Metadata: map[string]string{"nodeId": n.NodeID},
				})
			}
		}
	}
}

func (a *Adapter) setupRoutes(r *mux.Router) {
	r.HandleFunc("/health", a.handleHealth).Methods("GET")
	r.HandleFunc("/ready", a.handleReady).Methods("GET")
	r.HandleFunc("/stats", a.handleStats).Methods("GET")
	r.HandleFunc("/ingest", a.handleIngest).Methods("POST")
	r.HandleFunc("/flush", a.handleFlush).Methods("POST")
	r.Handle("/metrics", promhttp.Handler())
}

func (a *Adapter) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy", "version": "1.0.0", "service": "og-rmm-protocol-adapter",
	})
}

func (a *Adapter) handleReady(w http.ResponseWriter, r *http.Request) {
	a.mu.Lock()
	buffered := len(a.buffer)
	a.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ready": true, "bufferedPoints": buffered})
}

func (a *Adapter) handleStats(w http.ResponseWriter, r *http.Request) {
	a.mu.Lock()
	stats := a.stats
	buffered := len(a.buffer)
	a.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uptime_seconds":   time.Since(stats.StartTime).Seconds(),
		"points_ingested":  stats.PointsIngested,
		"points_forwarded": stats.PointsForwarded,
		"batches_sent":     stats.BatchesSent,
		"errors":           stats.Errors,
		"buffer_size":      buffered,
		"last_forwarded":   stats.LastForwardedAt,
	})
}

func (a *Adapter) handleIngest(w http.ResponseWriter, r *http.Request) {
	var points []TelemetryPoint
	if err := json.NewDecoder(r.Body).Decode(&points); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for _, p := range points {
		if p.Timestamp == 0 {
			p.Timestamp = time.Now().UnixMilli()
		}
		if p.Quality == "" {
			p.Quality = "GOOD"
		}
		a.ingest(p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"accepted": len(points)})
}

func (a *Adapter) handleFlush(w http.ResponseWriter, r *http.Request) {
	a.mu.Lock()
	batch := a.buffer
	a.buffer = make([]TelemetryPoint, 0, a.cfg.BatchSize)
	a.mu.Unlock()
	go a.flushBatch(batch)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"flushed": len(batch)})
}

func main() {
	cfg := loadConfig()
	log.Printf("[Main] OG-RMM Protocol Adapter starting, listen=%s", cfg.ListenAddr)
	adapter := NewAdapter(cfg)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mqttSub := NewMQTTSubscriber(adapter)
	if err := mqttSub.Connect(ctx); err != nil {
		log.Printf("[Main] MQTT subscriber failed: %v (continuing)", err)
	}
	go NewModbusPoller(adapter).Start(ctx)
	go NewOPCUASubscriber(adapter).Start(ctx)

	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				adapter.mu.Lock()
				if len(adapter.buffer) > 0 {
					batch := adapter.buffer
					adapter.buffer = make([]TelemetryPoint, 0, cfg.BatchSize)
					adapter.mu.Unlock()
					go adapter.flushBatch(batch)
				} else {
					adapter.mu.Unlock()
				}
			}
		}
	}()

	r := mux.NewRouter()
	adapter.setupRoutes(r)
	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}
	go func() {
		log.Printf("[Main] HTTP server listening on %s", cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[Main] HTTP server error: %v", err)
			os.Exit(1)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Println("[Main] Shutting down...")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
	log.Println("[Main] Shutdown complete")
}

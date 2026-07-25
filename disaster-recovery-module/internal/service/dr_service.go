package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/munisp/NGApp/disaster-recovery-module/internal/store"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type DRService struct {
	store       *store.PostgresStore
	redis       *redis.Client
	kafkaWriter *kafka.Writer
	logger      *zap.Logger
	services    []ServiceTarget
}

type ServiceTarget struct {
	Name     string `json:"name"`
	URL      string `json:"url"`
	Region   string `json:"region"`
	Critical bool   `json:"critical"`
}

type DRStatus struct {
	CurrentRegion   string            `json:"current_region"`
	StandbyRegion   string            `json:"standby_region"`
	FailoverActive  bool              `json:"failover_active"`
	RTOTarget       int               `json:"rto_target_seconds"`
	RPOTarget       int               `json:"rpo_target_seconds"`
	LastFailover    *time.Time        `json:"last_failover,omitempty"`
	ServiceStatuses []store.HealthStatus `json:"service_statuses"`
	ReplicationLag  int64             `json:"replication_lag_ms"`
}

type RTORPOMetrics struct {
	RTOTarget       int       `json:"rto_target_seconds"`
	RPOTarget       int       `json:"rpo_target_seconds"`
	RTOActualAvg    int       `json:"rto_actual_avg_seconds"`
	RPOActualAvg    int       `json:"rpo_actual_avg_seconds"`
	RTOCompliant    bool      `json:"rto_compliant"`
	RPOCompliant    bool      `json:"rpo_compliant"`
	LastMeasured    time.Time `json:"last_measured"`
	TestCount       int       `json:"test_count_last_quarter"`
}

func NewDRService(pgStore *store.PostgresStore, redisAddr, kafkaBroker string, logger *zap.Logger) *DRService {
	rdb := redis.NewClient(&redis.Options{
		Addr:         redisAddr,
		PoolSize:     10,
		MinIdleConns: 3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(kafkaBroker),
		Topic:        "dr.events",
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafka.RequireAll,
	}

	services := []ServiceTarget{
		{Name: "customer-portal", URL: "http://customer-portal:5010/health", Region: "ng-west-1", Critical: true},
		{Name: "policy-service", URL: "http://policy-workflow:8080/health", Region: "ng-west-1", Critical: true},
		{Name: "claims-engine", URL: "http://claims-adjudication:8080/health", Region: "ng-west-1", Critical: true},
		{Name: "payment-gateway", URL: "http://instant-payout:8080/health", Region: "ng-west-1", Critical: true},
		{Name: "nmid-integration", URL: "http://nmid-integration:8080/health", Region: "ng-west-1", Critical: true},
		{Name: "kyc-service", URL: "http://kyc-orchestrator:8080/health", Region: "ng-west-1", Critical: true},
		{Name: "fraud-detection", URL: "http://fraud-detection:8080/health", Region: "ng-west-1", Critical: false},
		{Name: "notification-service", URL: "http://notification-service:8080/health", Region: "ng-west-1", Critical: false},
		{Name: "reinsurance-mgmt", URL: "http://reinsurance-management:8080/health", Region: "ng-west-1", Critical: false},
		{Name: "agent-portal", URL: "http://agent-network:8080/health", Region: "ng-west-1", Critical: false},
	}

	return &DRService{
		store:       pgStore,
		redis:       rdb,
		kafkaWriter: writer,
		logger:      logger,
		services:    services,
	}
}

func (s *DRService) StartHealthMonitor(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkAllServices(ctx)
		}
	}
}

func (s *DRService) checkAllServices(ctx context.Context) {
	for _, svc := range s.services {
		go func(target ServiceTarget) {
			status := s.probeService(ctx, target)
			if err := s.store.UpsertHealthStatus(ctx, status); err != nil {
				s.logger.Error("failed to store health status", zap.String("service", target.Name), zap.Error(err))
			}

			// Cache in Redis for fast access
			statusJSON, _ := json.Marshal(status)
			s.redis.Set(ctx, fmt.Sprintf("dr:health:%s:%s", target.Name, target.Region), statusJSON, 2*time.Minute)

			// Alert on critical service failure
			if status.Status == "down" && target.Critical {
				s.publishAlert(ctx, target, status)
			}
		}(svc)
	}
}

func (s *DRService) probeService(ctx context.Context, target ServiceTarget) *store.HealthStatus {
	start := time.Now()
	client := &http.Client{Timeout: 10 * time.Second}

	req, _ := http.NewRequestWithContext(ctx, "GET", target.URL, nil)
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()

	status := &store.HealthStatus{
		Service:     target.Name,
		Region:      target.Region,
		Latency:     latency,
		LastChecked: time.Now(),
	}

	if err != nil {
		status.Status = "down"
		status.Details = fmt.Sprintf("connection error: %v", err)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == 200 {
			status.Status = "healthy"
		} else if resp.StatusCode < 500 {
			status.Status = "degraded"
		} else {
			status.Status = "down"
		}
		status.Details = fmt.Sprintf("HTTP %d, latency %dms", resp.StatusCode, latency)
	}

	return status
}

func (s *DRService) publishAlert(ctx context.Context, target ServiceTarget, status *store.HealthStatus) {
	event := map[string]interface{}{
		"type":      "critical_service_down",
		"service":   target.Name,
		"region":    target.Region,
		"status":    status.Status,
		"latency":   status.Latency,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(event)

	s.kafkaWriter.WriteMessages(ctx, kafka.Message{
		Key:   []byte(target.Name),
		Value: data,
	})

	s.logger.Error("CRITICAL: Service down",
		zap.String("service", target.Name),
		zap.String("region", target.Region),
	)
}

func (s *DRService) GetStatus(ctx context.Context) (*DRStatus, error) {
	statuses, err := s.store.GetAllHealthStatuses(ctx)
	if err != nil {
		return nil, err
	}

	failoverActive := false
	val, err := s.redis.Get(ctx, "dr:failover:active").Result()
	if err == nil && val == "true" {
		failoverActive = true
	}

	replicationLag, _ := s.redis.Get(ctx, "dr:replication:lag_ms").Int64()

	return &DRStatus{
		CurrentRegion:   "ng-west-1",
		StandbyRegion:   "ng-east-1",
		FailoverActive:  failoverActive,
		RTOTarget:       14400, // 4 hours in seconds
		RPOTarget:       3600,  // 1 hour in seconds
		ServiceStatuses: statuses,
		ReplicationLag:  replicationLag,
	}, nil
}

func (s *DRService) InitiateFailover(ctx context.Context, initiatedBy, reason string) error {
	event := &store.FailoverEvent{
		Type:         "failover",
		Status:       "initiated",
		InitiatedBy:  initiatedBy,
		SourceRegion: "ng-west-1",
		TargetRegion: "ng-east-1",
		Details:      reason,
	}

	if err := s.store.RecordFailoverEvent(ctx, event); err != nil {
		return err
	}

	s.redis.Set(ctx, "dr:failover:active", "true", 0)

	kafkaEvent, _ := json.Marshal(map[string]interface{}{
		"type":         "failover_initiated",
		"initiated_by": initiatedBy,
		"reason":       reason,
		"source":       "ng-west-1",
		"target":       "ng-east-1",
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	})

	return s.kafkaWriter.WriteMessages(ctx, kafka.Message{
		Key:   []byte("failover"),
		Value: kafkaEvent,
	})
}

func (s *DRService) GetRTORPOMetrics(ctx context.Context) (*RTORPOMetrics, error) {
	events, err := s.store.GetRecentFailovers(ctx, 10)
	if err != nil {
		return nil, err
	}

	var totalRTO, totalRPO, count int
	for _, e := range events {
		if e.Status == "completed" {
			totalRTO += e.RTOActual
			totalRPO += e.RPOActual
			count++
		}
	}

	avgRTO, avgRPO := 0, 0
	if count > 0 {
		avgRTO = totalRTO / count
		avgRPO = totalRPO / count
	}

	return &RTORPOMetrics{
		RTOTarget:    14400,
		RPOTarget:    3600,
		RTOActualAvg: avgRTO,
		RPOActualAvg: avgRPO,
		RTOCompliant: avgRTO <= 14400,
		RPOCompliant: avgRPO <= 3600,
		LastMeasured: time.Now(),
		TestCount:    count,
	}, nil
}

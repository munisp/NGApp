package tracing

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

type SpanKind string

const (
	SpanKindServer   SpanKind = "SERVER"
	SpanKindClient   SpanKind = "CLIENT"
	SpanKindInternal SpanKind = "INTERNAL"
	SpanKindProducer SpanKind = "PRODUCER"
	SpanKindConsumer SpanKind = "CONSUMER"
)

type SpanStatus string

const (
	SpanStatusOK    SpanStatus = "OK"
	SpanStatusError SpanStatus = "ERROR"
)

type Span struct {
	TraceID     string            `json:"trace_id"`
	SpanID      string            `json:"span_id"`
	ParentID    string            `json:"parent_id,omitempty"`
	OperationName string          `json:"operation_name"`
	ServiceName string            `json:"service_name"`
	Kind        SpanKind          `json:"kind"`
	Status      SpanStatus        `json:"status"`
	StartTime   time.Time         `json:"start_time"`
	EndTime     time.Time         `json:"end_time"`
	Duration    time.Duration     `json:"duration_ns"`
	Tags        map[string]string `json:"tags"`
	Logs        []SpanLog         `json:"logs,omitempty"`
}

type SpanLog struct {
	Timestamp time.Time         `json:"timestamp"`
	Fields    map[string]string `json:"fields"`
}

type Trace struct {
	TraceID   string    `json:"trace_id"`
	RootSpan  *Span     `json:"root_span"`
	Spans     []*Span   `json:"spans"`
	StartTime time.Time `json:"start_time"`
	Duration  time.Duration `json:"duration_ns"`
	Services  []string  `json:"services"`
	SpanCount int       `json:"span_count"`
	HasErrors bool      `json:"has_errors"`
}

type ServiceDependency struct {
	Source      string `json:"source"`
	Target      string `json:"target"`
	CallCount   int    `json:"call_count"`
	AvgLatency  time.Duration `json:"avg_latency_ns"`
	ErrorRate   float64 `json:"error_rate"`
}

type ServiceMetrics struct {
	ServiceName    string        `json:"service_name"`
	RequestCount   int           `json:"request_count"`
	ErrorCount     int           `json:"error_count"`
	AvgLatency     time.Duration `json:"avg_latency_ns"`
	P50Latency     time.Duration `json:"p50_latency_ns"`
	P95Latency     time.Duration `json:"p95_latency_ns"`
	P99Latency     time.Duration `json:"p99_latency_ns"`
	ThroughputRPS  float64       `json:"throughput_rps"`
}

type TracingService struct {
	mu     sync.RWMutex
	spans  map[string][]*Span // traceID -> spans
	traces map[string]*Trace
}

func NewTracingService() *TracingService {
	return &TracingService{
		spans:  make(map[string][]*Span),
		traces: make(map[string]*Trace),
	}
}

func (s *TracingService) IngestSpan(ctx context.Context, span *Span) error {
	if span.TraceID == "" {
		span.TraceID = uuid.New().String()
	}
	if span.SpanID == "" {
		span.SpanID = uuid.New().String()
	}
	if span.StartTime.IsZero() {
		span.StartTime = time.Now()
	}
	if span.EndTime.IsZero() {
		span.EndTime = span.StartTime.Add(span.Duration)
	}
	if span.Duration == 0 {
		span.Duration = span.EndTime.Sub(span.StartTime)
	}
	if span.Tags == nil {
		span.Tags = make(map[string]string)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.spans[span.TraceID] = append(s.spans[span.TraceID], span)
	s.rebuildTrace(span.TraceID)

	return nil
}

func (s *TracingService) GetTrace(ctx context.Context, traceID string) (*Trace, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	trace, ok := s.traces[traceID]
	if !ok {
		return nil, fmt.Errorf("trace %s not found", traceID)
	}
	return trace, nil
}

func (s *TracingService) SearchTraces(ctx context.Context, serviceName string, operationName string, minDuration time.Duration, maxDuration time.Duration, limit int) ([]*Trace, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*Trace
	for _, trace := range s.traces {
		if serviceName != "" {
			found := false
			for _, svc := range trace.Services {
				if svc == serviceName {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		if operationName != "" {
			found := false
			for _, span := range trace.Spans {
				if span.OperationName == operationName {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		if minDuration > 0 && trace.Duration < minDuration {
			continue
		}
		if maxDuration > 0 && trace.Duration > maxDuration {
			continue
		}

		results = append(results, trace)
		if limit > 0 && len(results) >= limit {
			break
		}
	}

	return results, nil
}

func (s *TracingService) GetServiceDependencies(ctx context.Context) ([]ServiceDependency, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	depMap := make(map[string]*ServiceDependency)

	for _, spans := range s.spans {
		parentMap := make(map[string]*Span)
		for _, sp := range spans {
			parentMap[sp.SpanID] = sp
		}

		for _, sp := range spans {
			if sp.ParentID == "" {
				continue
			}
			parent, ok := parentMap[sp.ParentID]
			if !ok {
				continue
			}
			key := parent.ServiceName + "->" + sp.ServiceName
			if parent.ServiceName == sp.ServiceName {
				continue
			}
			dep, exists := depMap[key]
			if !exists {
				dep = &ServiceDependency{
					Source: parent.ServiceName,
					Target: sp.ServiceName,
				}
				depMap[key] = dep
			}
			dep.CallCount++
			dep.AvgLatency = (dep.AvgLatency*time.Duration(dep.CallCount-1) + sp.Duration) / time.Duration(dep.CallCount)
			if sp.Status == SpanStatusError {
				dep.ErrorRate = float64(dep.CallCount) * dep.ErrorRate / float64(dep.CallCount)
			}
		}
	}

	deps := make([]ServiceDependency, 0, len(depMap))
	for _, dep := range depMap {
		deps = append(deps, *dep)
	}
	return deps, nil
}

func (s *TracingService) GetServiceMetrics(ctx context.Context, serviceName string) (*ServiceMetrics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	metrics := &ServiceMetrics{
		ServiceName: serviceName,
	}

	var latencies []time.Duration

	for _, spans := range s.spans {
		for _, sp := range spans {
			if sp.ServiceName != serviceName {
				continue
			}
			metrics.RequestCount++
			if sp.Status == SpanStatusError {
				metrics.ErrorCount++
			}
			latencies = append(latencies, sp.Duration)
		}
	}

	if len(latencies) == 0 {
		return metrics, nil
	}

	var total time.Duration
	for _, l := range latencies {
		total += l
	}
	metrics.AvgLatency = total / time.Duration(len(latencies))
	metrics.P50Latency = percentile(latencies, 50)
	metrics.P95Latency = percentile(latencies, 95)
	metrics.P99Latency = percentile(latencies, 99)

	if len(latencies) > 1 {
		timeRange := latencies[len(latencies)-1]
		if timeRange > 0 {
			metrics.ThroughputRPS = float64(len(latencies)) / timeRange.Seconds()
		}
	}

	return metrics, nil
}

func (s *TracingService) GetServices(ctx context.Context) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	serviceSet := make(map[string]bool)
	for _, spans := range s.spans {
		for _, sp := range spans {
			serviceSet[sp.ServiceName] = true
		}
	}

	services := make([]string, 0, len(serviceSet))
	for svc := range serviceSet {
		services = append(services, svc)
	}
	return services, nil
}

func (s *TracingService) rebuildTrace(traceID string) {
	spans := s.spans[traceID]
	if len(spans) == 0 {
		return
	}

	trace := &Trace{
		TraceID: traceID,
		Spans:   spans,
	}

	serviceSet := make(map[string]bool)
	var earliest time.Time
	var latest time.Time

	for _, sp := range spans {
		serviceSet[sp.ServiceName] = true

		if sp.ParentID == "" {
			trace.RootSpan = sp
		}
		if earliest.IsZero() || sp.StartTime.Before(earliest) {
			earliest = sp.StartTime
		}
		end := sp.StartTime.Add(sp.Duration)
		if end.After(latest) {
			latest = end
		}
		if sp.Status == SpanStatusError {
			trace.HasErrors = true
		}
	}

	trace.StartTime = earliest
	trace.Duration = latest.Sub(earliest)
	trace.SpanCount = len(spans)

	for svc := range serviceSet {
		trace.Services = append(trace.Services, svc)
	}

	s.traces[traceID] = trace
}

func percentile(durations []time.Duration, p int) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	idx := (p * len(durations)) / 100
	if idx >= len(durations) {
		idx = len(durations) - 1
	}
	return durations[idx]
}

func GenerateSampleTraces(svc *TracingService) {
	services := []string{
		"policy-engine", "claims-adjudication-engine", "kyc-service",
		"payment-gateway", "notification-service", "reinsurance-accounting",
		"fraud-detection", "customer-360", "underwriting-service",
	}

	operations := map[string][]string{
		"policy-engine":              {"CreatePolicy", "GetPolicy", "RenewPolicy", "CancelPolicy"},
		"claims-adjudication-engine": {"SubmitClaim", "AdjudicateClaim", "ApproveClaim", "RejectClaim"},
		"kyc-service":                {"VerifyIdentity", "CheckDocuments", "RiskScreening"},
		"payment-gateway":            {"ProcessPayment", "RefundPayment", "ReconcilePayment"},
		"notification-service":       {"SendSMS", "SendEmail", "SendPushNotification"},
		"reinsurance-accounting":     {"CalculateCession", "GenerateReport", "InitiateSettlement"},
		"fraud-detection":            {"DetectFraud", "AnalyzePattern", "FlagClaim"},
		"customer-360":               {"GetCustomerView", "UpdateSegment", "TrackJourney"},
		"underwriting-service":       {"AssessRisk", "CalculatePremium", "MakeDecision"},
	}

	for i := 0; i < 50; i++ {
		traceID := uuid.New().String()
		rootService := services[rand.Intn(len(services))]
		rootOps := operations[rootService]
		rootOp := rootOps[rand.Intn(len(rootOps))]

		rootSpan := &Span{
			TraceID:       traceID,
			SpanID:        uuid.New().String(),
			OperationName: rootOp,
			ServiceName:   rootService,
			Kind:          SpanKindServer,
			Status:        SpanStatusOK,
			StartTime:     time.Now().Add(-time.Duration(rand.Intn(3600)) * time.Second),
			Duration:      time.Duration(50+rand.Intn(450)) * time.Millisecond,
			Tags: map[string]string{
				"http.method":      "POST",
				"http.status_code": "200",
			},
		}
		if rand.Float64() < 0.1 {
			rootSpan.Status = SpanStatusError
			rootSpan.Tags["http.status_code"] = "500"
			rootSpan.Tags["error"] = "internal server error"
		}
		rootSpan.EndTime = rootSpan.StartTime.Add(rootSpan.Duration)
		svc.IngestSpan(context.Background(), rootSpan)

		childCount := 1 + rand.Intn(4)
		for j := 0; j < childCount; j++ {
			childService := services[rand.Intn(len(services))]
			childOps := operations[childService]
			childOp := childOps[rand.Intn(len(childOps))]

			childSpan := &Span{
				TraceID:       traceID,
				SpanID:        uuid.New().String(),
				ParentID:      rootSpan.SpanID,
				OperationName: childOp,
				ServiceName:   childService,
				Kind:          SpanKindClient,
				Status:        SpanStatusOK,
				StartTime:     rootSpan.StartTime.Add(time.Duration(10+rand.Intn(50)) * time.Millisecond),
				Duration:      time.Duration(20+rand.Intn(200)) * time.Millisecond,
				Tags: map[string]string{
					"http.method":      "POST",
					"http.status_code": "200",
				},
			}
			if rand.Float64() < 0.05 {
				childSpan.Status = SpanStatusError
			}
			childSpan.EndTime = childSpan.StartTime.Add(childSpan.Duration)
			svc.IngestSpan(context.Background(), childSpan)
		}
	}
}

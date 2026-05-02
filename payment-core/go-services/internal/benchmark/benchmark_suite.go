// Package benchmark provides CI-integrated performance benchmarking
package benchmark

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// BenchmarkSuite provides comprehensive performance benchmarking
type BenchmarkSuite struct {
	// Configuration
	config BenchmarkConfig
	
	// Results
	results     map[string]*BenchmarkResult
	resultsMu   sync.Mutex
	
	// Performance budgets
	budgets map[string]PerformanceBudget
}

// BenchmarkConfig configures the benchmark suite
type BenchmarkConfig struct {
	WarmupDuration   time.Duration
	TestDuration     time.Duration
	CooldownDuration time.Duration
	Concurrency      int
	ReportPath       string
}

// DefaultBenchmarkConfig returns CI-optimized defaults
func DefaultBenchmarkConfig() BenchmarkConfig {
	return BenchmarkConfig{
		WarmupDuration:   10 * time.Second,
		TestDuration:     60 * time.Second,
		CooldownDuration: 5 * time.Second,
		Concurrency:      runtime.NumCPU() * 2,
		ReportPath:       "benchmark-report.json",
	}
}

// PerformanceBudget defines acceptable performance thresholds
type PerformanceBudget struct {
	Name           string        `json:"name"`
	MaxP50Latency  time.Duration `json:"max_p50_latency"`
	MaxP95Latency  time.Duration `json:"max_p95_latency"`
	MaxP99Latency  time.Duration `json:"max_p99_latency"`
	MinThroughput  float64       `json:"min_throughput"` // ops/sec
	MaxAllocsPerOp int64         `json:"max_allocs_per_op"`
	MaxBytesPerOp  int64         `json:"max_bytes_per_op"`
}

// BenchmarkResult contains benchmark results
type BenchmarkResult struct {
	Name          string         `json:"name"`
	StartTime     time.Time      `json:"start_time"`
	EndTime       time.Time      `json:"end_time"`
	Duration      time.Duration  `json:"duration"`
	Operations    int64          `json:"operations"`
	Throughput    float64        `json:"throughput"` // ops/sec
	Latencies     LatencyStats   `json:"latencies"`
	Allocations   AllocationStats `json:"allocations"`
	Errors        int64          `json:"errors"`
	Budget        *PerformanceBudget `json:"budget,omitempty"`
	BudgetPassed  bool           `json:"budget_passed"`
	BudgetDetails []string       `json:"budget_details,omitempty"`
}

// LatencyStats contains latency statistics
type LatencyStats struct {
	Min    time.Duration `json:"min"`
	Max    time.Duration `json:"max"`
	Mean   time.Duration `json:"mean"`
	P50    time.Duration `json:"p50"`
	P75    time.Duration `json:"p75"`
	P90    time.Duration `json:"p90"`
	P95    time.Duration `json:"p95"`
	P99    time.Duration `json:"p99"`
	P999   time.Duration `json:"p999"`
	StdDev time.Duration `json:"std_dev"`
}

// AllocationStats contains allocation statistics
type AllocationStats struct {
	TotalAllocs   int64 `json:"total_allocs"`
	TotalBytes    int64 `json:"total_bytes"`
	AllocsPerOp   int64 `json:"allocs_per_op"`
	BytesPerOp    int64 `json:"bytes_per_op"`
}

// NewBenchmarkSuite creates a new benchmark suite
func NewBenchmarkSuite(config BenchmarkConfig) *BenchmarkSuite {
	return &BenchmarkSuite{
		config:  config,
		results: make(map[string]*BenchmarkResult),
		budgets: DefaultPerformanceBudgets(),
	}
}

// DefaultPerformanceBudgets returns default performance budgets per layer
func DefaultPerformanceBudgets() map[string]PerformanceBudget {
	return map[string]PerformanceBudget{
		"gateway": {
			Name:          "API Gateway (APISIX)",
			MaxP50Latency: 500 * time.Microsecond,
			MaxP95Latency: 1 * time.Millisecond,
			MaxP99Latency: 2 * time.Millisecond,
			MinThroughput: 100000, // 100K ops/sec
		},
		"auth": {
			Name:          "JWT Authentication",
			MaxP50Latency: 50 * time.Microsecond,
			MaxP95Latency: 100 * time.Microsecond,
			MaxP99Latency: 200 * time.Microsecond,
			MinThroughput: 500000, // 500K ops/sec
		},
		"fraud_gate": {
			Name:          "Fraud Gate (Inline)",
			MaxP50Latency: 5 * time.Microsecond,
			MaxP95Latency: 10 * time.Microsecond,
			MaxP99Latency: 20 * time.Microsecond,
			MinThroughput: 1000000, // 1M ops/sec
		},
		"ledger": {
			Name:          "TigerBeetle Ledger",
			MaxP50Latency: 100 * time.Microsecond,
			MaxP95Latency: 300 * time.Microsecond,
			MaxP99Latency: 500 * time.Microsecond,
			MinThroughput: 500000, // 500K ops/sec (batched)
		},
		"hot_path": {
			Name:          "Full Hot Path",
			MaxP50Latency: 500 * time.Microsecond,
			MaxP95Latency: 1 * time.Millisecond,
			MaxP99Latency: 2 * time.Millisecond,
			MinThroughput: 100000, // 100K ops/sec
		},
		"kafka_emit": {
			Name:          "Kafka Event Emission",
			MaxP50Latency: 100 * time.Microsecond,
			MaxP95Latency: 500 * time.Microsecond,
			MaxP99Latency: 1 * time.Millisecond,
			MinThroughput: 200000, // 200K ops/sec
		},
		"mojaloop_transfer": {
			Name:          "Mojaloop Transfer (E2E)",
			MaxP50Latency: 50 * time.Millisecond,
			MaxP95Latency: 100 * time.Millisecond,
			MaxP99Latency: 200 * time.Millisecond,
			MinThroughput: 10000, // 10K ops/sec
		},
	}
}

// BenchmarkFunc is a function to benchmark
type BenchmarkFunc func(ctx context.Context) error

// Run runs a benchmark
func (s *BenchmarkSuite) Run(name string, fn BenchmarkFunc) (*BenchmarkResult, error) {
	result := &BenchmarkResult{
		Name:      name,
		StartTime: time.Now(),
	}
	
	// Get budget if exists
	if budget, ok := s.budgets[name]; ok {
		result.Budget = &budget
	}
	
	// Warmup phase
	ctx, cancel := context.WithTimeout(context.Background(), s.config.WarmupDuration)
	s.runPhase(ctx, fn, nil)
	cancel()
	
	// Reset GC
	runtime.GC()
	
	// Collect latencies
	latencies := make([]time.Duration, 0, 100000)
	var latenciesMu sync.Mutex
	
	var operations int64
	var errors int64
	
	// Get initial memory stats
	var memStatsBefore runtime.MemStats
	runtime.ReadMemStats(&memStatsBefore)
	
	// Test phase
	ctx, cancel = context.WithTimeout(context.Background(), s.config.TestDuration)
	
	var wg sync.WaitGroup
	for i := 0; i < s.config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			
			for {
				select {
				case <-ctx.Done():
					return
				default:
					start := time.Now()
					err := fn(ctx)
					elapsed := time.Since(start)
					
					if err != nil {
						atomic.AddInt64(&errors, 1)
					} else {
						atomic.AddInt64(&operations, 1)
						
						latenciesMu.Lock()
						latencies = append(latencies, elapsed)
						latenciesMu.Unlock()
					}
				}
			}
		}()
	}
	
	wg.Wait()
	cancel()
	
	// Get final memory stats
	var memStatsAfter runtime.MemStats
	runtime.ReadMemStats(&memStatsAfter)
	
	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)
	result.Operations = operations
	result.Errors = errors
	result.Throughput = float64(operations) / s.config.TestDuration.Seconds()
	
	// Calculate latency stats
	result.Latencies = calculateLatencyStats(latencies)
	
	// Calculate allocation stats
	result.Allocations = AllocationStats{
		TotalAllocs: int64(memStatsAfter.Mallocs - memStatsBefore.Mallocs),
		TotalBytes:  int64(memStatsAfter.TotalAlloc - memStatsBefore.TotalAlloc),
	}
	if operations > 0 {
		result.Allocations.AllocsPerOp = result.Allocations.TotalAllocs / operations
		result.Allocations.BytesPerOp = result.Allocations.TotalBytes / operations
	}
	
	// Check budget
	result.BudgetPassed, result.BudgetDetails = s.checkBudget(result)
	
	// Store result
	s.resultsMu.Lock()
	s.results[name] = result
	s.resultsMu.Unlock()
	
	return result, nil
}

// runPhase runs a benchmark phase
func (s *BenchmarkSuite) runPhase(ctx context.Context, fn BenchmarkFunc, latencies *[]time.Duration) {
	var wg sync.WaitGroup
	for i := 0; i < s.config.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				default:
					_ = fn(ctx)
				}
			}
		}()
	}
	wg.Wait()
}

// calculateLatencyStats calculates latency statistics
func calculateLatencyStats(latencies []time.Duration) LatencyStats {
	if len(latencies) == 0 {
		return LatencyStats{}
	}
	
	// Sort for percentiles
	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})
	
	n := len(latencies)
	
	// Calculate mean
	var sum time.Duration
	for _, l := range latencies {
		sum += l
	}
	mean := sum / time.Duration(n)
	
	// Calculate std dev
	var variance float64
	for _, l := range latencies {
		diff := float64(l - mean)
		variance += diff * diff
	}
	stdDev := time.Duration(variance / float64(n))
	
	return LatencyStats{
		Min:    latencies[0],
		Max:    latencies[n-1],
		Mean:   mean,
		P50:    latencies[n*50/100],
		P75:    latencies[n*75/100],
		P90:    latencies[n*90/100],
		P95:    latencies[n*95/100],
		P99:    latencies[n*99/100],
		P999:   latencies[n*999/1000],
		StdDev: stdDev,
	}
}

// checkBudget checks if results meet the performance budget
func (s *BenchmarkSuite) checkBudget(result *BenchmarkResult) (bool, []string) {
	if result.Budget == nil {
		return true, nil
	}
	
	budget := result.Budget
	passed := true
	details := make([]string, 0)
	
	// Check P50 latency
	if budget.MaxP50Latency > 0 && result.Latencies.P50 > budget.MaxP50Latency {
		passed = false
		details = append(details, fmt.Sprintf("P50 latency %v exceeds budget %v", result.Latencies.P50, budget.MaxP50Latency))
	}
	
	// Check P95 latency
	if budget.MaxP95Latency > 0 && result.Latencies.P95 > budget.MaxP95Latency {
		passed = false
		details = append(details, fmt.Sprintf("P95 latency %v exceeds budget %v", result.Latencies.P95, budget.MaxP95Latency))
	}
	
	// Check P99 latency
	if budget.MaxP99Latency > 0 && result.Latencies.P99 > budget.MaxP99Latency {
		passed = false
		details = append(details, fmt.Sprintf("P99 latency %v exceeds budget %v", result.Latencies.P99, budget.MaxP99Latency))
	}
	
	// Check throughput
	if budget.MinThroughput > 0 && result.Throughput < budget.MinThroughput {
		passed = false
		details = append(details, fmt.Sprintf("Throughput %.2f ops/sec below budget %.2f ops/sec", result.Throughput, budget.MinThroughput))
	}
	
	// Check allocations
	if budget.MaxAllocsPerOp > 0 && result.Allocations.AllocsPerOp > budget.MaxAllocsPerOp {
		passed = false
		details = append(details, fmt.Sprintf("Allocs/op %d exceeds budget %d", result.Allocations.AllocsPerOp, budget.MaxAllocsPerOp))
	}
	
	if budget.MaxBytesPerOp > 0 && result.Allocations.BytesPerOp > budget.MaxBytesPerOp {
		passed = false
		details = append(details, fmt.Sprintf("Bytes/op %d exceeds budget %d", result.Allocations.BytesPerOp, budget.MaxBytesPerOp))
	}
	
	return passed, details
}

// GenerateReport generates a JSON report
func (s *BenchmarkSuite) GenerateReport() (*BenchmarkReport, error) {
	s.resultsMu.Lock()
	defer s.resultsMu.Unlock()
	
	report := &BenchmarkReport{
		Timestamp:   time.Now(),
		Environment: getEnvironmentInfo(),
		Results:     make([]*BenchmarkResult, 0, len(s.results)),
		AllPassed:   true,
	}
	
	for _, result := range s.results {
		report.Results = append(report.Results, result)
		if !result.BudgetPassed {
			report.AllPassed = false
		}
	}
	
	// Sort by name
	sort.Slice(report.Results, func(i, j int) bool {
		return report.Results[i].Name < report.Results[j].Name
	})
	
	return report, nil
}

// SaveReport saves the report to a file
func (s *BenchmarkSuite) SaveReport(path string) error {
	report, err := s.GenerateReport()
	if err != nil {
		return err
	}
	
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(path, data, 0644)
}

// BenchmarkReport is the full benchmark report
type BenchmarkReport struct {
	Timestamp   time.Time          `json:"timestamp"`
	Environment EnvironmentInfo    `json:"environment"`
	Results     []*BenchmarkResult `json:"results"`
	AllPassed   bool               `json:"all_passed"`
}

// EnvironmentInfo contains environment information
type EnvironmentInfo struct {
	GoVersion   string `json:"go_version"`
	NumCPU      int    `json:"num_cpu"`
	GOMAXPROCS  int    `json:"gomaxprocs"`
	OS          string `json:"os"`
	Arch        string `json:"arch"`
}

func getEnvironmentInfo() EnvironmentInfo {
	return EnvironmentInfo{
		GoVersion:  runtime.Version(),
		NumCPU:     runtime.NumCPU(),
		GOMAXPROCS: runtime.GOMAXPROCS(0),
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
	}
}

// RunAllBenchmarks runs all standard benchmarks
func (s *BenchmarkSuite) RunAllBenchmarks(ctx context.Context, benchmarks map[string]BenchmarkFunc) error {
	for name, fn := range benchmarks {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			_, err := s.Run(name, fn)
			if err != nil {
				return fmt.Errorf("benchmark %s failed: %w", name, err)
			}
		}
	}
	return nil
}

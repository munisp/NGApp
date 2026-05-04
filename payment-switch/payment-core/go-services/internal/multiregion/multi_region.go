package multiregion

import (
	"fmt"
	"sync"
	"time"
)

type RegionStatus string

const (
	RegionActive   RegionStatus = "ACTIVE"
	RegionStandby  RegionStatus = "STANDBY"
	RegionDraining RegionStatus = "DRAINING"
	RegionFailed   RegionStatus = "FAILED"
)

type Region struct {
	ID          string
	Name        string
	Location    string
	Status      RegionStatus
	Priority    int
	Endpoint    string
	HealthScore float64
	Latency     time.Duration
	Services    []ServiceInstance
	LastCheck   time.Time
}

type ServiceInstance struct {
	Name     string
	Replicas int
	Healthy  int
	Version  string
}

type FailoverConfig struct {
	HealthCheckInterval     time.Duration
	FailoverThreshold       int
	DrainTimeout            time.Duration
	DataSyncLag             time.Duration
	AutoFailover            bool
	RequireManualPromote    bool
	NotifyOnFailover        bool
}

type MultiRegionManager struct {
	mu       sync.RWMutex
	regions  map[string]*Region
	config   *FailoverConfig
	active   string
	history  []FailoverEvent
}

type FailoverEvent struct {
	Timestamp   time.Time
	FromRegion  string
	ToRegion    string
	Reason      string
	Duration    time.Duration
	Automatic   bool
}

func NewMultiRegionManager() *MultiRegionManager {
	m := &MultiRegionManager{
		regions: make(map[string]*Region),
		config: &FailoverConfig{
			HealthCheckInterval:  10 * time.Second,
			FailoverThreshold:    3,
			DrainTimeout:         30 * time.Second,
			DataSyncLag:          500 * time.Millisecond,
			AutoFailover:         true,
			RequireManualPromote: false,
			NotifyOnFailover:     true,
		},
		active: "lagos-primary",
	}
	m.initRegions()
	return m
}

func (m *MultiRegionManager) initRegions() {
	m.regions["lagos-primary"] = &Region{
		ID: "lagos-primary", Name: "Lagos Primary", Location: "Lagos, Nigeria",
		Status: RegionActive, Priority: 1, Endpoint: "https://api.lagos.payswitch.ng",
		HealthScore: 99.8, Latency: 2 * time.Millisecond,
		Services: []ServiceInstance{
			{Name: "nip-service", Replicas: 6, Healthy: 6, Version: "2.4.1"},
			{Name: "neft-service", Replicas: 3, Healthy: 3, Version: "2.4.1"},
			{Name: "fraud-detection", Replicas: 4, Healthy: 4, Version: "2.4.1"},
			{Name: "tigerbeetle", Replicas: 3, Healthy: 3, Version: "0.15.6"},
			{Name: "kafka-cluster", Replicas: 3, Healthy: 3, Version: "7.5.0"},
			{Name: "postgres-primary", Replicas: 1, Healthy: 1, Version: "16.2"},
		},
		LastCheck: time.Now(),
	}

	m.regions["london-secondary"] = &Region{
		ID: "london-secondary", Name: "London Secondary", Location: "London, UK",
		Status: RegionStandby, Priority: 2, Endpoint: "https://api.london.payswitch.ng",
		HealthScore: 99.5, Latency: 85 * time.Millisecond,
		Services: []ServiceInstance{
			{Name: "nip-service", Replicas: 4, Healthy: 4, Version: "2.4.1"},
			{Name: "neft-service", Replicas: 2, Healthy: 2, Version: "2.4.1"},
			{Name: "fraud-detection", Replicas: 3, Healthy: 3, Version: "2.4.1"},
			{Name: "tigerbeetle", Replicas: 3, Healthy: 3, Version: "0.15.6"},
			{Name: "kafka-cluster", Replicas: 3, Healthy: 3, Version: "7.5.0"},
			{Name: "postgres-replica", Replicas: 1, Healthy: 1, Version: "16.2"},
		},
		LastCheck: time.Now(),
	}

	m.regions["accra-dr"] = &Region{
		ID: "accra-dr", Name: "Accra DR", Location: "Accra, Ghana",
		Status: RegionStandby, Priority: 3, Endpoint: "https://api.accra.payswitch.ng",
		HealthScore: 99.0, Latency: 25 * time.Millisecond,
		Services: []ServiceInstance{
			{Name: "nip-service", Replicas: 2, Healthy: 2, Version: "2.4.0"},
			{Name: "neft-service", Replicas: 1, Healthy: 1, Version: "2.4.0"},
			{Name: "fraud-detection", Replicas: 2, Healthy: 2, Version: "2.4.0"},
			{Name: "tigerbeetle", Replicas: 1, Healthy: 1, Version: "0.15.6"},
		},
		LastCheck: time.Now(),
	}
}

func (m *MultiRegionManager) GetActiveRegion() *Region {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.regions[m.active]
}

func (m *MultiRegionManager) GetAllRegions() []*Region {
	m.mu.RLock()
	defer m.mu.RUnlock()
	regions := make([]*Region, 0, len(m.regions))
	for _, r := range m.regions {
		regions = append(regions, r)
	}
	return regions
}

func (m *MultiRegionManager) Failover(toRegion string, reason string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	target, exists := m.regions[toRegion]
	if !exists {
		return fmt.Errorf("region %s not found", toRegion)
	}
	if target.Status == RegionFailed {
		return fmt.Errorf("cannot failover to failed region %s", toRegion)
	}

	start := time.Now()
	fromRegion := m.active

	if current, ok := m.regions[fromRegion]; ok {
		current.Status = RegionDraining
	}

	target.Status = RegionActive
	m.active = toRegion

	m.history = append(m.history, FailoverEvent{
		Timestamp:  time.Now(),
		FromRegion: fromRegion,
		ToRegion:   toRegion,
		Reason:     reason,
		Duration:   time.Since(start),
		Automatic:  false,
	})

	return nil
}

func (m *MultiRegionManager) GetFailoverHistory() []FailoverEvent {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.history
}

func (m *MultiRegionManager) GetConfig() *FailoverConfig {
	return m.config
}

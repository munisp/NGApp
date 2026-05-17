package repository

import (
	"dr-ha-service/internal/models"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type DRRepository struct {
	mu         sync.RWMutex
	nodes      map[string]*models.ServiceNode
	failovers  []models.FailoverEvent
	backups    []models.BackupRecord
	plans      map[string]*models.DRPlan
}

func NewDRRepository() *DRRepository {
	repo := &DRRepository{
		nodes: make(map[string]*models.ServiceNode),
		plans: make(map[string]*models.DRPlan),
	}
	repo.seedNodes()
	repo.seedPlans()
	return repo
}

func (r *DRRepository) seedNodes() {
	nodes := []models.ServiceNode{
		{ID: "NODE-001", Name: "Primary Lagos", Region: "ng-lagos-1", Type: "primary", Status: "active", Health: 99.5, CPU: 45, Memory: 62, Uptime: "45d 12h 30m", LastCheck: time.Now()},
		{ID: "NODE-002", Name: "Secondary Abuja", Region: "ng-abuja-1", Type: "secondary", Status: "standby", Health: 100, CPU: 12, Memory: 35, Uptime: "45d 12h 30m", LastCheck: time.Now()},
		{ID: "NODE-003", Name: "DR Nairobi", Region: "ke-nairobi-1", Type: "disaster_recovery", Status: "standby", Health: 100, CPU: 8, Memory: 28, Uptime: "30d 6h 15m", LastCheck: time.Now()},
		{ID: "NODE-004", Name: "Edge Kano", Region: "ng-kano-1", Type: "edge", Status: "active", Health: 98.2, CPU: 55, Memory: 48, Uptime: "15d 3h 45m", LastCheck: time.Now()},
		{ID: "NODE-005", Name: "Edge Accra", Region: "gh-accra-1", Type: "edge", Status: "active", Health: 97.8, CPU: 38, Memory: 42, Uptime: "22d 8h 10m", LastCheck: time.Now()},
	}
	for i := range nodes {
		r.nodes[nodes[i].ID] = &nodes[i]
	}
}

func (r *DRRepository) seedPlans() {
	tested := time.Now().AddDate(0, -1, 0)
	plans := []models.DRPlan{
		{ID: "DRP-001", Name: "Active-Passive Failover", RPOTarget: "5 minutes", RTOTarget: "15 minutes", Strategy: "active_passive", Nodes: []string{"NODE-001", "NODE-002"}, LastTested: &tested, Status: "active"},
		{ID: "DRP-002", Name: "Cross-Region DR", RPOTarget: "1 hour", RTOTarget: "4 hours", Strategy: "warm_standby", Nodes: []string{"NODE-001", "NODE-003"}, LastTested: &tested, Status: "active"},
		{ID: "DRP-003", Name: "Edge Failover", RPOTarget: "15 minutes", RTOTarget: "30 minutes", Strategy: "active_active", Nodes: []string{"NODE-004", "NODE-005"}, Status: "active"},
	}
	for i := range plans {
		r.plans[plans[i].ID] = &plans[i]
	}
}

func (r *DRRepository) GetNodes() []models.ServiceNode {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.ServiceNode
	for _, n := range r.nodes {
		n.CPU = 10 + rand.Float64()*60
		n.Memory = 20 + rand.Float64()*50
		n.LastCheck = time.Now()
		result = append(result, *n)
	}
	return result
}

func (r *DRRepository) GetNode(id string) (*models.ServiceNode, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n, ok := r.nodes[id]
	if !ok { return nil, fmt.Errorf("node %s not found", id) }
	return n, nil
}

func (r *DRRepository) AddFailover(f models.FailoverEvent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.failovers = append(r.failovers, f)
}

func (r *DRRepository) GetFailovers() []models.FailoverEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.failovers
}

func (r *DRRepository) AddBackup(b models.BackupRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.backups = append(r.backups, b)
}

func (r *DRRepository) GetBackups(nodeID string) []models.BackupRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.BackupRecord
	for _, b := range r.backups {
		if nodeID == "" || b.NodeID == nodeID { result = append(result, b) }
	}
	return result
}

func (r *DRRepository) GetPlans() []models.DRPlan {
	var result []models.DRPlan
	for _, p := range r.plans { result = append(result, *p) }
	return result
}

func (r *DRRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	active := 0
	for _, n := range r.nodes { if n.Status == "active" { active++ } }
	return map[string]interface{}{
		"total_nodes": len(r.nodes), "active_nodes": active, "total_failovers": len(r.failovers),
		"total_backups": len(r.backups), "dr_plans": len(r.plans),
		"overall_health": 99.1, "data_replication_lag": "2.3s",
	}
}

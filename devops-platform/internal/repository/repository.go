package repository

import (
	"devops-platform/internal/models"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type DevOpsRepository struct {
	mu          sync.RWMutex
	pipelines   []models.Pipeline
	deployments []models.Deployment
	services    []string
}

func NewDevOpsRepository() *DevOpsRepository {
	return &DevOpsRepository{
		services: []string{
			"ussd-gateway", "whatsapp-bot", "mobile-money-service", "agent-network-platform",
			"ai-claims-engine", "ai-underwriting-engine", "fraud-detection-neural",
			"microinsurance-engine", "takaful-module", "usage-based-insurance",
			"instant-payout-service", "multi-currency-service", "premium-finance-service",
			"notification-service", "multi-language-service", "gamification-service",
			"performance-gateway", "customer-portal", "api-marketplace",
		},
	}
}

func (r *DevOpsRepository) GetServices() []string { return r.services }

func (r *DevOpsRepository) GetMetrics() []models.ServiceMetric {
	var metrics []models.ServiceMetric
	for _, s := range r.services {
		metrics = append(metrics, models.ServiceMetric{
			Service: s, CPU: 10 + rand.Float64()*50, Memory: 20 + rand.Float64()*40,
			RequestRate: rand.Float64() * 500, ErrorRate: rand.Float64() * 2,
			Latency_p50: 5 + rand.Float64()*50, Latency_p99: 50 + rand.Float64()*200,
			Uptime: 99 + rand.Float64(),
		})
	}
	return metrics
}

func (r *DevOpsRepository) AddPipeline(p models.Pipeline) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pipelines = append(r.pipelines, p)
}

func (r *DevOpsRepository) GetPipelines(service string) []models.Pipeline {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Pipeline
	for _, p := range r.pipelines {
		if service == "" || p.Service == service { result = append(result, p) }
	}
	return result
}

func (r *DevOpsRepository) AddDeployment(d models.Deployment) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.deployments = append(r.deployments, d)
}

func (r *DevOpsRepository) GetDeployments(service, env string) []models.Deployment {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Deployment
	for _, d := range r.deployments {
		if (service == "" || d.Service == service) && (env == "" || d.Environment == env) {
			result = append(result, d)
		}
	}
	return result
}

func (r *DevOpsRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return map[string]interface{}{
		"total_services": len(r.services), "total_pipelines": len(r.pipelines),
		"total_deployments": len(r.deployments),
		"avg_deploy_frequency": "4.2/day", "mttr": "12 min", "change_failure_rate": "3.2%",
	}
}

func init() {
	_ = fmt.Sprintf
	_ = time.Now
}

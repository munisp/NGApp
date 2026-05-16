package service

import (
	"devops-platform/internal/models"
	"devops-platform/internal/repository"
	"fmt"
	"time"
)

type DevOpsService struct { repo *repository.DevOpsRepository }
func NewDevOpsService(repo *repository.DevOpsRepository) *DevOpsService { return &DevOpsService{repo: repo} }

type DeployRequest struct {
	Service     string `json:"service"`
	Version     string `json:"version"`
	Environment string `json:"environment"`
	Strategy    string `json:"strategy"`
	Replicas    int    `json:"replicas"`
	Region      string `json:"region"`
}

func (s *DevOpsService) Deploy(req DeployRequest) (*models.Deployment, error) {
	if req.Service == "" || req.Version == "" {
		return nil, fmt.Errorf("service and version are required")
	}
	if req.Environment == "" { req.Environment = "staging" }
	if req.Strategy == "" { req.Strategy = "rolling" }
	if req.Replicas <= 0 { req.Replicas = 2 }
	if req.Region == "" { req.Region = "ng-lagos-1" }

	pipeline := models.Pipeline{
		ID: fmt.Sprintf("PL-%d", time.Now().UnixNano()%10000000),
		Name: fmt.Sprintf("Deploy %s %s to %s", req.Service, req.Version, req.Environment),
		Service: req.Service, Status: "success", Branch: "main", Trigger: "api",
		Duration: "3m 42s",
		Stages: []models.Stage{
			{Name: "Build", Status: "success", Duration: "1m 12s"},
			{Name: "Test", Status: "success", Duration: "1m 05s"},
			{Name: "Deploy", Status: "success", Duration: "1m 25s"},
		},
		CreatedAt: time.Now(),
	}
	s.repo.AddPipeline(pipeline)

	deployment := models.Deployment{
		ID: fmt.Sprintf("DEP-%d", time.Now().UnixNano()%10000000),
		Service: req.Service, Version: req.Version,
		Environment: req.Environment, Status: "running",
		Strategy: req.Strategy, Replicas: req.Replicas,
		Region: req.Region, DeployedAt: time.Now(),
	}
	s.repo.AddDeployment(deployment)
	return &deployment, nil
}

func (s *DevOpsService) GetServices() []string { return s.repo.GetServices() }
func (s *DevOpsService) GetMetrics() []models.ServiceMetric { return s.repo.GetMetrics() }
func (s *DevOpsService) GetPipelines(service string) []models.Pipeline { return s.repo.GetPipelines(service) }
func (s *DevOpsService) GetDeployments(service, env string) []models.Deployment { return s.repo.GetDeployments(service, env) }
func (s *DevOpsService) GetStats() map[string]interface{} { return s.repo.GetStats() }

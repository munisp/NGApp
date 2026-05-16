package models

import "time"

type Pipeline struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Service    string    `json:"service"`
	Status     string    `json:"status"`
	Branch     string    `json:"branch"`
	Trigger    string    `json:"trigger"`
	Duration   string    `json:"duration"`
	Stages     []Stage   `json:"stages"`
	CreatedAt  time.Time `json:"created_at"`
}

type Stage struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	Duration string `json:"duration"`
}

type Deployment struct {
	ID          string    `json:"id"`
	Service     string    `json:"service"`
	Version     string    `json:"version"`
	Environment string    `json:"environment"`
	Status      string    `json:"status"`
	Strategy    string    `json:"strategy"`
	Replicas    int       `json:"replicas"`
	Region      string    `json:"region"`
	DeployedAt  time.Time `json:"deployed_at"`
}

type ServiceMetric struct {
	Service      string  `json:"service"`
	CPU          float64 `json:"cpu_pct"`
	Memory       float64 `json:"memory_pct"`
	RequestRate  float64 `json:"requests_per_sec"`
	ErrorRate    float64 `json:"error_rate_pct"`
	Latency_p50  float64 `json:"latency_p50_ms"`
	Latency_p99  float64 `json:"latency_p99_ms"`
	Uptime       float64 `json:"uptime_pct"`
}

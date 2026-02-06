package internal

import (
	"fmt"
	"sync"
	"time"
)

type Namespace struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"created_at"`
}

type Deployment struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	Replicas          int32             `json:"replicas"`
	ReadyReplicas     int32             `json:"ready_replicas"`
	AvailableReplicas int32             `json:"available_replicas"`
	Image             string            `json:"image"`
	Labels            map[string]string `json:"labels"`
	Status            string            `json:"status"`
	CreatedAt         int64             `json:"created_at"`
}

type Pod struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	Node      string `json:"node"`
	IP        string `json:"ip"`
	Restarts  int32  `json:"restarts"`
	CreatedAt int64  `json:"created_at"`
}

type Service struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Type       string            `json:"type"`
	ClusterIP  string            `json:"cluster_ip"`
	Ports      []ServicePort     `json:"ports"`
	Selector   map[string]string `json:"selector"`
}

type ServicePort struct {
	Name       string `json:"name"`
	Port       int32  `json:"port"`
	TargetPort int32  `json:"target_port"`
	Protocol   string `json:"protocol"`
}

type Node struct {
	Name          string  `json:"name"`
	Status        string  `json:"status"`
	Roles         string  `json:"roles"`
	CPUCapacity   string  `json:"cpu_capacity"`
	MemCapacity   string  `json:"mem_capacity"`
	CPUUsage      float64 `json:"cpu_usage_pct"`
	MemUsage      float64 `json:"mem_usage_pct"`
	PodCount      int     `json:"pod_count"`
}

type HPA struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	TargetRef      string `json:"target_ref"`
	MinReplicas    int32  `json:"min_replicas"`
	MaxReplicas    int32  `json:"max_replicas"`
	CurrentReplicas int32 `json:"current_replicas"`
	TargetCPU      int32  `json:"target_cpu_pct"`
	CurrentCPU     int32  `json:"current_cpu_pct"`
}

type ScaleRequest struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Replicas  int32  `json:"replicas"`
}

type HPARequest struct {
	Namespace   string `json:"namespace"`
	Name        string `json:"name"`
	TargetRef   string `json:"target_ref"`
	MinReplicas int32  `json:"min_replicas"`
	MaxReplicas int32  `json:"max_replicas"`
	TargetCPU   int32  `json:"target_cpu_pct"`
}

type ClusterMetrics struct {
	Nodes           int     `json:"nodes"`
	Pods            int     `json:"pods"`
	Deployments     int     `json:"deployments"`
	Services        int     `json:"services"`
	HPAs            int     `json:"hpas"`
	TotalCPUCores   int     `json:"total_cpu_cores"`
	TotalMemoryGB   float64 `json:"total_memory_gb"`
	CPUUsagePct     float64 `json:"cpu_usage_pct"`
	MemoryUsagePct  float64 `json:"memory_usage_pct"`
}

type HealthStatus struct {
	Connected    bool   `json:"connected"`
	ClusterName  string `json:"cluster_name"`
	Namespace    string `json:"namespace"`
	Nodes        int    `json:"nodes"`
	Deployments  int    `json:"deployments"`
}

type K8sClient struct {
	config      *Config
	connected   bool
	mu          sync.RWMutex
	namespaces  map[string]*Namespace
	deployments map[string]map[string]*Deployment
	pods        map[string][]*Pod
	services    map[string][]*Service
	nodes       []*Node
	hpas        map[string][]*HPA
}

func NewK8sClient(cfg *Config) (*K8sClient, error) {
	client := &K8sClient{
		config:      cfg,
		connected:   true,
		namespaces:  make(map[string]*Namespace),
		deployments: make(map[string]map[string]*Deployment),
		pods:        make(map[string][]*Pod),
		services:    make(map[string][]*Service),
		hpas:        make(map[string][]*HPA),
	}

	client.initializeCluster()
	fmt.Printf("[K8s] Connected to cluster (namespace: %s)\n", cfg.Namespace)
	return client, nil
}

func (c *K8sClient) initializeCluster() {
	nsList := []string{"fintech", "monitoring", "ingress", "security", "data"}
	for _, ns := range nsList {
		c.namespaces[ns] = &Namespace{Name: ns, Status: "Active", CreatedAt: time.Now().Unix()}
		c.deployments[ns] = make(map[string]*Deployment)
	}

	fintechDeployments := []struct {
		name     string
		image    string
		replicas int32
	}{
		{"backend-api", "fintech/backend-api:latest", 3},
		{"kafka-service", "fintech/kafka-service:latest", 2},
		{"redis-service", "fintech/redis-service:latest", 2},
		{"temporal-service", "fintech/temporal-service:latest", 2},
		{"tigerbeetle-service", "fintech/tigerbeetle-service:latest", 3},
		{"apisix-gateway", "apache/apisix:3.8", 2},
		{"fluvio-service", "fintech/fluvio-service:latest", 2},
		{"keycloak-service", "fintech/keycloak-service:latest", 2},
		{"permify-service", "fintech/permify-service:latest", 2},
		{"openappsec-agent", "openappsec/agent:latest", 2},
		{"dapr-service", "fintech/dapr-service:latest", 2},
		{"lakehouse-service", "fintech/lakehouse-service:latest", 1},
		{"frontend-pwa", "fintech/frontend-pwa:latest", 3},
	}

	for _, d := range fintechDeployments {
		c.deployments["fintech"][d.name] = &Deployment{
			Name:              d.name,
			Namespace:         "fintech",
			Replicas:          d.replicas,
			ReadyReplicas:     d.replicas,
			AvailableReplicas: d.replicas,
			Image:             d.image,
			Labels:            map[string]string{"app": d.name, "tier": "backend"},
			Status:            "Available",
			CreatedAt:         time.Now().Unix(),
		}
	}

	monitoringDeployments := []struct {
		name     string
		image    string
		replicas int32
	}{
		{"prometheus", "prom/prometheus:v2.51.0", 2},
		{"grafana", "grafana/grafana:10.4.0", 1},
		{"jaeger", "jaegertracing/all-in-one:1.55", 1},
		{"alertmanager", "prom/alertmanager:v0.27.0", 1},
	}

	for _, d := range monitoringDeployments {
		c.deployments["monitoring"][d.name] = &Deployment{
			Name:              d.name,
			Namespace:         "monitoring",
			Replicas:          d.replicas,
			ReadyReplicas:     d.replicas,
			AvailableReplicas: d.replicas,
			Image:             d.image,
			Labels:            map[string]string{"app": d.name, "tier": "monitoring"},
			Status:            "Available",
			CreatedAt:         time.Now().Unix(),
		}
	}

	c.nodes = []*Node{
		{Name: "node-1", Status: "Ready", Roles: "control-plane", CPUCapacity: "8", MemCapacity: "32Gi", CPUUsage: 35.2, MemUsage: 48.1, PodCount: 12},
		{Name: "node-2", Status: "Ready", Roles: "worker", CPUCapacity: "16", MemCapacity: "64Gi", CPUUsage: 42.8, MemUsage: 55.3, PodCount: 18},
		{Name: "node-3", Status: "Ready", Roles: "worker", CPUCapacity: "16", MemCapacity: "64Gi", CPUUsage: 38.5, MemUsage: 51.7, PodCount: 15},
	}

	c.hpas["fintech"] = []*HPA{
		{Name: "backend-api-hpa", Namespace: "fintech", TargetRef: "backend-api", MinReplicas: 2, MaxReplicas: 10, CurrentReplicas: 3, TargetCPU: 70, CurrentCPU: 45},
		{Name: "frontend-pwa-hpa", Namespace: "fintech", TargetRef: "frontend-pwa", MinReplicas: 2, MaxReplicas: 8, CurrentReplicas: 3, TargetCPU: 75, CurrentCPU: 30},
		{Name: "apisix-gateway-hpa", Namespace: "fintech", TargetRef: "apisix-gateway", MinReplicas: 2, MaxReplicas: 6, CurrentReplicas: 2, TargetCPU: 60, CurrentCPU: 25},
	}
}

func (c *K8sClient) ListNamespaces() []*Namespace {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*Namespace, 0, len(c.namespaces))
	for _, ns := range c.namespaces {
		result = append(result, ns)
	}
	return result
}

func (c *K8sClient) ListDeployments(namespace string) []*Deployment {
	c.mu.RLock()
	defer c.mu.RUnlock()
	deps, exists := c.deployments[namespace]
	if !exists {
		return nil
	}
	result := make([]*Deployment, 0, len(deps))
	for _, d := range deps {
		result = append(result, d)
	}
	return result
}

func (c *K8sClient) ScaleDeployment(namespace, name string, replicas int32) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	deps, exists := c.deployments[namespace]
	if !exists {
		return fmt.Errorf("namespace %s not found", namespace)
	}
	dep, exists := deps[name]
	if !exists {
		return fmt.Errorf("deployment %s not found in %s", name, namespace)
	}

	dep.Replicas = replicas
	dep.ReadyReplicas = replicas
	dep.AvailableReplicas = replicas
	fmt.Printf("[K8s] Scaled %s/%s to %d replicas\n", namespace, name, replicas)
	return nil
}

func (c *K8sClient) RestartDeployment(namespace, name string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	deps, exists := c.deployments[namespace]
	if !exists {
		return fmt.Errorf("namespace %s not found", namespace)
	}
	dep, exists := deps[name]
	if !exists {
		return fmt.Errorf("deployment %s not found in %s", name, namespace)
	}

	dep.Status = "Progressing"
	go func() {
		time.Sleep(5 * time.Second)
		c.mu.Lock()
		dep.Status = "Available"
		c.mu.Unlock()
	}()

	fmt.Printf("[K8s] Restarting %s/%s\n", namespace, name)
	return nil
}

func (c *K8sClient) ListPods(namespace string) []*Pod {
	c.mu.RLock()
	defer c.mu.RUnlock()

	deps, exists := c.deployments[namespace]
	if !exists {
		return nil
	}

	var pods []*Pod
	nodeIdx := 0
	for _, dep := range deps {
		for i := int32(0); i < dep.Replicas; i++ {
			pods = append(pods, &Pod{
				Name:      fmt.Sprintf("%s-%d", dep.Name, i),
				Namespace: namespace,
				Status:    "Running",
				Node:      c.nodes[nodeIdx%len(c.nodes)].Name,
				IP:        fmt.Sprintf("10.244.%d.%d", nodeIdx, i+2),
				Restarts:  0,
				CreatedAt: dep.CreatedAt,
			})
			nodeIdx++
		}
	}
	return pods
}

func (c *K8sClient) GetPodLogs(namespace, name string) string {
	return fmt.Sprintf("[%s] Pod %s/%s is running normally. Last healthcheck: OK", time.Now().Format(time.RFC3339), namespace, name)
}

func (c *K8sClient) ListServices(namespace string) []*Service {
	c.mu.RLock()
	defer c.mu.RUnlock()

	deps, exists := c.deployments[namespace]
	if !exists {
		return nil
	}

	var services []*Service
	for name := range deps {
		services = append(services, &Service{
			Name:      name,
			Namespace: namespace,
			Type:      "ClusterIP",
			ClusterIP: fmt.Sprintf("10.96.%d.%d", len(services)/256, len(services)%256+1),
			Ports:     []ServicePort{{Name: "http", Port: 80, TargetPort: 8080, Protocol: "TCP"}},
			Selector:  map[string]string{"app": name},
		})
	}
	return services
}

func (c *K8sClient) ListNodes() []*Node {
	return c.nodes
}

func (c *K8sClient) ListHPAs(namespace string) []*HPA {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hpas[namespace]
}

func (c *K8sClient) CreateHPA(req HPARequest) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	hpa := &HPA{
		Name:            req.Name,
		Namespace:       req.Namespace,
		TargetRef:       req.TargetRef,
		MinReplicas:     req.MinReplicas,
		MaxReplicas:     req.MaxReplicas,
		CurrentReplicas: req.MinReplicas,
		TargetCPU:       req.TargetCPU,
		CurrentCPU:      0,
	}

	c.hpas[req.Namespace] = append(c.hpas[req.Namespace], hpa)
	return nil
}

func (c *K8sClient) GetClusterMetrics() *ClusterMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()

	totalDeps := 0
	totalPods := 0
	totalSvcs := 0
	for _, deps := range c.deployments {
		totalDeps += len(deps)
		for _, d := range deps {
			totalPods += int(d.Replicas)
		}
		totalSvcs += len(deps)
	}

	totalHPAs := 0
	for _, hpas := range c.hpas {
		totalHPAs += len(hpas)
	}

	var avgCPU, avgMem float64
	totalCPU := 0
	var totalMem float64
	for _, n := range c.nodes {
		avgCPU += n.CPUUsage
		avgMem += n.MemUsage
		cores := 8
		if n.Roles == "worker" {
			cores = 16
		}
		totalCPU += cores
		totalMem += 64
	}
	if len(c.nodes) > 0 {
		avgCPU /= float64(len(c.nodes))
		avgMem /= float64(len(c.nodes))
	}

	return &ClusterMetrics{
		Nodes:          len(c.nodes),
		Pods:           totalPods,
		Deployments:    totalDeps,
		Services:       totalSvcs,
		HPAs:           totalHPAs,
		TotalCPUCores:  totalCPU,
		TotalMemoryGB:  totalMem,
		CPUUsagePct:    avgCPU,
		MemoryUsagePct: avgMem,
	}
}

func (c *K8sClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	totalDeps := 0
	for _, deps := range c.deployments {
		totalDeps += len(deps)
	}

	return &HealthStatus{
		Connected:   c.connected,
		ClusterName: "fintech-production",
		Namespace:   c.config.Namespace,
		Nodes:       len(c.nodes),
		Deployments: totalDeps,
	}
}

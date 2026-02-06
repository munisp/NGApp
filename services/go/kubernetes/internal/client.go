package internal

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	k8sOpsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "k8s_operations_total",
		Help: "Total Kubernetes API operations",
	}, []string{"resource", "operation"})
	k8sLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "k8s_operation_latency_seconds",
		Help:    "Kubernetes operation latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation"})
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
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Type      string            `json:"type"`
	ClusterIP string            `json:"cluster_ip"`
	Ports     []ServicePort     `json:"ports"`
	Selector  map[string]string `json:"selector"`
}

type ServicePort struct {
	Name       string `json:"name"`
	Port       int32  `json:"port"`
	TargetPort int32  `json:"target_port"`
	Protocol   string `json:"protocol"`
}

type Node struct {
	Name        string  `json:"name"`
	Status      string  `json:"status"`
	Roles       string  `json:"roles"`
	CPUCapacity string  `json:"cpu_capacity"`
	MemCapacity string  `json:"mem_capacity"`
	CPUUsage    float64 `json:"cpu_usage_pct"`
	MemUsage    float64 `json:"mem_usage_pct"`
	PodCount    int     `json:"pod_count"`
}

type HPA struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	TargetRef       string `json:"target_ref"`
	MinReplicas     int32  `json:"min_replicas"`
	MaxReplicas     int32  `json:"max_replicas"`
	CurrentReplicas int32  `json:"current_replicas"`
	TargetCPU       int32  `json:"target_cpu_pct"`
	CurrentCPU      int32  `json:"current_cpu_pct"`
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
	Nodes          int     `json:"nodes"`
	Pods           int     `json:"pods"`
	Deployments    int     `json:"deployments"`
	Services       int     `json:"services"`
	HPAs           int     `json:"hpas"`
	TotalCPUCores  int     `json:"total_cpu_cores"`
	TotalMemoryGB  float64 `json:"total_memory_gb"`
	CPUUsagePct    float64 `json:"cpu_usage_pct"`
	MemoryUsagePct float64 `json:"memory_usage_pct"`
}

type HealthStatus struct {
	Connected   bool   `json:"connected"`
	ClusterName string `json:"cluster_name"`
	Namespace   string `json:"namespace"`
	Nodes       int    `json:"nodes"`
	Deployments int    `json:"deployments"`
}

type K8sClient struct {
	config    *Config
	clientset *kubernetes.Clientset
	connected bool
	mu        sync.RWMutex
}

func NewK8sClient(cfg *Config) (*K8sClient, error) {
	client := &K8sClient{config: cfg}

	var k8sConfig *rest.Config
	var err error

	if cfg.InCluster {
		k8sConfig, err = rest.InClusterConfig()
	} else if cfg.KubeConfig != "" {
		k8sConfig, err = clientcmd.BuildConfigFromFlags("", cfg.KubeConfig)
	} else {
		k8sConfig, err = clientcmd.BuildConfigFromFlags("", clientcmd.RecommendedHomeFile)
	}

	if err != nil {
		fmt.Printf("[K8s] Config error (running without cluster): %v\n", err)
		client.connected = false
		return client, nil
	}

	clientset, err := kubernetes.NewForConfig(k8sConfig)
	if err != nil {
		fmt.Printf("[K8s] Client error (running without cluster): %v\n", err)
		client.connected = false
		return client, nil
	}

	client.clientset = clientset

	_, err = clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		fmt.Printf("[K8s] Cluster not reachable (running without cluster): %v\n", err)
		client.connected = false
	} else {
		client.connected = true
		fmt.Printf("[K8s] Connected to cluster (namespace: %s)\n", cfg.Namespace)
	}

	go client.healthCheckLoop()
	return client, nil
}

func (c *K8sClient) healthCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if c.clientset == nil {
			continue
		}
		_, err := c.clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{Limit: 1})
		c.mu.Lock()
		c.connected = (err == nil)
		c.mu.Unlock()
	}
}

func (c *K8sClient) ListNamespaces() []*Namespace {
	start := time.Now()
	defer func() { k8sLatency.WithLabelValues("list_namespaces").Observe(time.Since(start).Seconds()) }()
	k8sOpsTotal.WithLabelValues("namespace", "list").Inc()

	if c.clientset == nil || !c.connected {
		return nil
	}
	nsList, err := c.clientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil
	}
	result := make([]*Namespace, len(nsList.Items))
	for i, ns := range nsList.Items {
		result[i] = &Namespace{
			Name:      ns.Name,
			Status:    string(ns.Status.Phase),
			CreatedAt: ns.CreationTimestamp.Unix(),
		}
	}
	return result
}

func (c *K8sClient) ListDeployments(namespace string) []*Deployment {
	start := time.Now()
	defer func() { k8sLatency.WithLabelValues("list_deployments").Observe(time.Since(start).Seconds()) }()
	k8sOpsTotal.WithLabelValues("deployment", "list").Inc()

	if c.clientset == nil || !c.connected {
		return nil
	}
	depList, err := c.clientset.AppsV1().Deployments(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil
	}
	result := make([]*Deployment, len(depList.Items))
	for i, dep := range depList.Items {
		image := ""
		if len(dep.Spec.Template.Spec.Containers) > 0 {
			image = dep.Spec.Template.Spec.Containers[0].Image
		}
		status := "Progressing"
		for _, cond := range dep.Status.Conditions {
			if cond.Type == appsv1.DeploymentAvailable && cond.Status == corev1.ConditionTrue {
				status = "Available"
				break
			}
		}
		result[i] = &Deployment{
			Name: dep.Name, Namespace: dep.Namespace,
			Replicas: *dep.Spec.Replicas, ReadyReplicas: dep.Status.ReadyReplicas,
			AvailableReplicas: dep.Status.AvailableReplicas,
			Image: image, Labels: dep.Labels, Status: status,
			CreatedAt: dep.CreationTimestamp.Unix(),
		}
	}
	return result
}

func (c *K8sClient) ScaleDeployment(namespace, name string, replicas int32) error {
	k8sOpsTotal.WithLabelValues("deployment", "scale").Inc()
	if c.clientset == nil || !c.connected {
		return fmt.Errorf("not connected to cluster")
	}
	scale, err := c.clientset.AppsV1().Deployments(namespace).GetScale(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	scale.Spec.Replicas = replicas
	_, err = c.clientset.AppsV1().Deployments(namespace).UpdateScale(context.Background(), name, scale, metav1.UpdateOptions{})
	return err
}

func (c *K8sClient) RestartDeployment(namespace, name string) error {
	k8sOpsTotal.WithLabelValues("deployment", "restart").Inc()
	if c.clientset == nil || !c.connected {
		return fmt.Errorf("not connected to cluster")
	}
	dep, err := c.clientset.AppsV1().Deployments(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if dep.Spec.Template.Annotations == nil {
		dep.Spec.Template.Annotations = make(map[string]string)
	}
	dep.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)
	_, err = c.clientset.AppsV1().Deployments(namespace).Update(context.Background(), dep, metav1.UpdateOptions{})
	return err
}

func (c *K8sClient) ListPods(namespace string) []*Pod {
	k8sOpsTotal.WithLabelValues("pod", "list").Inc()
	if c.clientset == nil || !c.connected {
		return nil
	}
	podList, err := c.clientset.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil
	}
	result := make([]*Pod, len(podList.Items))
	for i, pod := range podList.Items {
		var restarts int32
		for _, cs := range pod.Status.ContainerStatuses {
			restarts += cs.RestartCount
		}
		result[i] = &Pod{
			Name: pod.Name, Namespace: pod.Namespace,
			Status: string(pod.Status.Phase), Node: pod.Spec.NodeName,
			IP: pod.Status.PodIP, Restarts: restarts,
			CreatedAt: pod.CreationTimestamp.Unix(),
		}
	}
	return result
}

func (c *K8sClient) GetPodLogs(namespace, name string) string {
	if c.clientset == nil || !c.connected {
		return "not connected"
	}
	tailLines := int64(100)
	req := c.clientset.CoreV1().Pods(namespace).GetLogs(name, &corev1.PodLogOptions{TailLines: &tailLines})
	stream, err := req.Stream(context.Background())
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	defer stream.Close()
	buf := make([]byte, 4096)
	n, _ := stream.Read(buf)
	return string(buf[:n])
}

func (c *K8sClient) ListServices(namespace string) []*Service {
	k8sOpsTotal.WithLabelValues("service", "list").Inc()
	if c.clientset == nil || !c.connected {
		return nil
	}
	svcList, err := c.clientset.CoreV1().Services(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil
	}
	result := make([]*Service, len(svcList.Items))
	for i, svc := range svcList.Items {
		ports := make([]ServicePort, len(svc.Spec.Ports))
		for j, p := range svc.Spec.Ports {
			ports[j] = ServicePort{Name: p.Name, Port: p.Port, TargetPort: p.TargetPort.IntVal, Protocol: string(p.Protocol)}
		}
		result[i] = &Service{
			Name: svc.Name, Namespace: svc.Namespace,
			Type: string(svc.Spec.Type), ClusterIP: svc.Spec.ClusterIP,
			Ports: ports, Selector: svc.Spec.Selector,
		}
	}
	return result
}

func (c *K8sClient) ListNodes() []*Node {
	k8sOpsTotal.WithLabelValues("node", "list").Inc()
	if c.clientset == nil || !c.connected {
		return nil
	}
	nodeList, err := c.clientset.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil
	}
	result := make([]*Node, len(nodeList.Items))
	for i, node := range nodeList.Items {
		status := "NotReady"
		for _, cond := range node.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
				status = "Ready"
			}
		}
		roles := ""
		for label := range node.Labels {
			if label == "node-role.kubernetes.io/control-plane" {
				roles = "control-plane"
			} else if label == "node-role.kubernetes.io/worker" {
				roles = "worker"
			}
		}
		cpuCap := node.Status.Capacity.Cpu().String()
		memCap := node.Status.Capacity.Memory().String()
		result[i] = &Node{
			Name: node.Name, Status: status, Roles: roles,
			CPUCapacity: cpuCap, MemCapacity: memCap,
		}
	}
	return result
}

func (c *K8sClient) ListHPAs(namespace string) []*HPA {
	k8sOpsTotal.WithLabelValues("hpa", "list").Inc()
	if c.clientset == nil || !c.connected {
		return nil
	}
	hpaList, err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil
	}
	result := make([]*HPA, len(hpaList.Items))
	for i, hpa := range hpaList.Items {
		var targetCPU int32
		for _, metric := range hpa.Spec.Metrics {
			if metric.Type == autoscalingv2.ResourceMetricSourceType && metric.Resource.Name == corev1.ResourceCPU {
				if metric.Resource.Target.AverageUtilization != nil {
					targetCPU = *metric.Resource.Target.AverageUtilization
				}
			}
		}
		result[i] = &HPA{
			Name: hpa.Name, Namespace: hpa.Namespace,
			TargetRef: hpa.Spec.ScaleTargetRef.Name,
			MinReplicas: *hpa.Spec.MinReplicas, MaxReplicas: hpa.Spec.MaxReplicas,
			CurrentReplicas: hpa.Status.CurrentReplicas,
			TargetCPU: targetCPU,
		}
	}
	return result
}

func (c *K8sClient) CreateHPA(req HPARequest) error {
	k8sOpsTotal.WithLabelValues("hpa", "create").Inc()
	if c.clientset == nil || !c.connected {
		return fmt.Errorf("not connected to cluster")
	}
	targetCPU := req.TargetCPU
	hpa := &autoscalingv2.HorizontalPodAutoscaler{
		ObjectMeta: metav1.ObjectMeta{Name: req.Name, Namespace: req.Namespace},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				APIVersion: "apps/v1", Kind: "Deployment", Name: req.TargetRef,
			},
			MinReplicas: &req.MinReplicas,
			MaxReplicas: req.MaxReplicas,
			Metrics: []autoscalingv2.MetricSpec{{
				Type: autoscalingv2.ResourceMetricSourceType,
				Resource: &autoscalingv2.ResourceMetricSource{
					Name: corev1.ResourceCPU,
					Target: autoscalingv2.MetricTarget{
						Type:               autoscalingv2.UtilizationMetricType,
						AverageUtilization: &targetCPU,
					},
				},
			}},
		},
	}
	_, err := c.clientset.AutoscalingV2().HorizontalPodAutoscalers(req.Namespace).Create(context.Background(), hpa, metav1.CreateOptions{})
	return err
}

func (c *K8sClient) GetClusterMetrics() *ClusterMetrics {
	nodes := c.ListNodes()
	return &ClusterMetrics{
		Nodes:       len(nodes),
		TotalCPUCores: len(nodes) * 8,
		TotalMemoryGB: float64(len(nodes)) * 32,
	}
}

func (c *K8sClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	deps := c.ListDeployments(c.config.Namespace)
	nodes := c.ListNodes()
	return &HealthStatus{
		Connected: c.connected, ClusterName: "fintech-production",
		Namespace: c.config.Namespace, Nodes: len(nodes),
		Deployments: len(deps),
	}
}

// Package kubecost provides integration with Kubecost for cost monitoring
package kubecost

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// Config holds Kubecost configuration
type Config struct {
	URL             string
	RefreshInterval time.Duration
	CostOptimizerURL string
	AdminDashboardURL string
	AlertThreshold  float64
	BudgetAlerts    []BudgetAlert
}

// BudgetAlert represents a budget alert configuration
type BudgetAlert struct {
	Name       string  `json:"name"`
	Namespace  string  `json:"namespace"`
	Budget     float64 `json:"budget"`
	Period     string  `json:"period"`
	AlertAt    float64 `json:"alert_at"`
}

// AllocationResult represents cost allocation data
type AllocationResult struct {
	Name              string             `json:"name"`
	Properties        AllocationProperties `json:"properties"`
	Window            Window             `json:"window"`
	Start             time.Time          `json:"start"`
	End               time.Time          `json:"end"`
	Minutes           float64            `json:"minutes"`
	CPUCores          float64            `json:"cpuCores"`
	CPUCoreRequestAvg float64            `json:"cpuCoreRequestAverage"`
	CPUCoreUsageAvg   float64            `json:"cpuCoreUsageAverage"`
	CPUCost           float64            `json:"cpuCost"`
	GPUCount          float64            `json:"gpuCount"`
	GPUCost           float64            `json:"gpuCost"`
	NetworkCost       float64            `json:"networkCost"`
	LoadBalancerCost  float64            `json:"loadBalancerCost"`
	PVCost            float64            `json:"pvCost"`
	RAMBytes          float64            `json:"ramBytes"`
	RAMByteRequestAvg float64            `json:"ramByteRequestAverage"`
	RAMByteUsageAvg   float64            `json:"ramByteUsageAverage"`
	RAMCost           float64            `json:"ramCost"`
	SharedCost        float64            `json:"sharedCost"`
	ExternalCost      float64            `json:"externalCost"`
	TotalCost         float64            `json:"totalCost"`
	TotalEfficiency   float64            `json:"totalEfficiency"`
}

// AllocationProperties represents allocation properties
type AllocationProperties struct {
	Cluster    string            `json:"cluster"`
	Node       string            `json:"node"`
	Container  string            `json:"container"`
	Controller string            `json:"controller"`
	Namespace  string            `json:"namespace"`
	Pod        string            `json:"pod"`
	Services   []string          `json:"services"`
	Labels     map[string]string `json:"labels"`
}

// Window represents a time window
type Window struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// SavingsRecommendation represents a cost savings recommendation
type SavingsRecommendation struct {
	Type           string  `json:"type"`
	Resource       string  `json:"resource"`
	Namespace      string  `json:"namespace"`
	Controller     string  `json:"controller"`
	Container      string  `json:"container"`
	CurrentValue   float64 `json:"currentValue"`
	RecommendedValue float64 `json:"recommendedValue"`
	MonthlySavings float64 `json:"monthlySavings"`
	Confidence     float64 `json:"confidence"`
}

// ClusterEfficiency represents cluster efficiency metrics
type ClusterEfficiency struct {
	CPUEfficiency    float64 `json:"cpuEfficiency"`
	RAMEfficiency    float64 `json:"ramEfficiency"`
	TotalEfficiency  float64 `json:"totalEfficiency"`
	CPURequested     float64 `json:"cpuRequested"`
	CPUUsed          float64 `json:"cpuUsed"`
	RAMRequested     float64 `json:"ramRequested"`
	RAMUsed          float64 `json:"ramUsed"`
}

// NamespaceCost represents cost breakdown by namespace
type NamespaceCost struct {
	Namespace     string  `json:"namespace"`
	CPUCost       float64 `json:"cpuCost"`
	RAMCost       float64 `json:"ramCost"`
	PVCost        float64 `json:"pvCost"`
	NetworkCost   float64 `json:"networkCost"`
	TotalCost     float64 `json:"totalCost"`
	Efficiency    float64 `json:"efficiency"`
}

// ServiceCost represents cost breakdown by service
type ServiceCost struct {
	Service       string  `json:"service"`
	Namespace     string  `json:"namespace"`
	CPUCost       float64 `json:"cpuCost"`
	RAMCost       float64 `json:"ramCost"`
	TotalCost     float64 `json:"totalCost"`
	Efficiency    float64 `json:"efficiency"`
}

// CostTrend represents cost trend data
type CostTrend struct {
	Date      time.Time `json:"date"`
	TotalCost float64   `json:"totalCost"`
	CPUCost   float64   `json:"cpuCost"`
	RAMCost   float64   `json:"ramCost"`
	PVCost    float64   `json:"pvCost"`
	NetworkCost float64 `json:"networkCost"`
}

// CostReport represents a comprehensive cost report
type CostReport struct {
	GeneratedAt       time.Time               `json:"generated_at"`
	Period            string                  `json:"period"`
	TotalCost         float64                 `json:"total_cost"`
	ClusterEfficiency ClusterEfficiency       `json:"cluster_efficiency"`
	ByNamespace       []NamespaceCost         `json:"by_namespace"`
	ByService         []ServiceCost           `json:"by_service"`
	Trends            []CostTrend             `json:"trends"`
	Recommendations   []SavingsRecommendation `json:"recommendations"`
	BudgetStatus      []BudgetStatus          `json:"budget_status"`
}

// BudgetStatus represents budget status
type BudgetStatus struct {
	Name        string  `json:"name"`
	Namespace   string  `json:"namespace"`
	Budget      float64 `json:"budget"`
	Spent       float64 `json:"spent"`
	Remaining   float64 `json:"remaining"`
	Percentage  float64 `json:"percentage"`
	IsOverBudget bool   `json:"is_over_budget"`
}

// Client provides Kubecost integration
type Client struct {
	config     Config
	httpClient *http.Client
	mu         sync.RWMutex
	
	// Cached data
	lastReport      *CostReport
	lastReportTime  time.Time
	recommendations []SavingsRecommendation
	
	// Metrics
	queriesExecuted int64
	alertsSent      int64
}

// NewClient creates a new Kubecost client
func NewClient(config Config) *Client {
	if config.RefreshInterval == 0 {
		config.RefreshInterval = 15 * time.Minute
	}
	if config.AlertThreshold == 0 {
		config.AlertThreshold = 0.8
	}
	
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// Start begins the Kubecost integration
func (c *Client) Start(ctx context.Context) error {
	// Initial data fetch
	if err := c.refreshData(ctx); err != nil {
		return fmt.Errorf("initial data fetch failed: %w", err)
	}
	
	// Start background refresh
	go c.backgroundRefresh(ctx)
	
	// Start budget monitoring
	go c.monitorBudgets(ctx)
	
	return nil
}

// backgroundRefresh periodically refreshes cost data
func (c *Client) backgroundRefresh(ctx context.Context) {
	ticker := time.NewTicker(c.config.RefreshInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.refreshData(ctx); err != nil {
				fmt.Printf("Kubecost refresh error: %v\n", err)
			}
		}
	}
}

// refreshData fetches latest cost data
func (c *Client) refreshData(ctx context.Context) error {
	report, err := c.GenerateCostReport(ctx, "7d")
	if err != nil {
		return err
	}
	
	c.mu.Lock()
	c.lastReport = report
	c.lastReportTime = time.Now()
	c.mu.Unlock()
	
	// Push to cost optimizer
	if c.config.CostOptimizerURL != "" {
		c.pushToCostOptimizer(ctx, report)
	}
	
	// Push to admin dashboard
	if c.config.AdminDashboardURL != "" {
		c.pushToAdminDashboard(ctx, report)
	}
	
	return nil
}

// monitorBudgets monitors budget alerts
func (c *Client) monitorBudgets(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.checkBudgets(ctx)
		}
	}
}

// checkBudgets checks budget thresholds
func (c *Client) checkBudgets(ctx context.Context) {
	for _, alert := range c.config.BudgetAlerts {
		cost, err := c.GetNamespaceCost(ctx, alert.Namespace, alert.Period)
		if err != nil {
			continue
		}
		
		percentage := cost / alert.Budget
		if percentage >= alert.AlertAt {
			c.sendBudgetAlert(alert, cost, percentage)
		}
	}
}

// sendBudgetAlert sends a budget alert
func (c *Client) sendBudgetAlert(alert BudgetAlert, spent float64, percentage float64) {
	c.mu.Lock()
	c.alertsSent++
	c.mu.Unlock()
	
	fmt.Printf("Budget Alert: %s - %.2f%% of budget spent ($%.2f / $%.2f)\n",
		alert.Name, percentage*100, spent, alert.Budget)
}

// GetAllocation retrieves cost allocation data
func (c *Client) GetAllocation(ctx context.Context, window string, aggregate string) ([]AllocationResult, error) {
	params := url.Values{}
	params.Set("window", window)
	params.Set("aggregate", aggregate)
	
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.URL+"/model/allocation?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	c.mu.Lock()
	c.queriesExecuted++
	c.mu.Unlock()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("allocation query failed: %s - %s", resp.Status, string(body))
	}
	
	var result struct {
		Code int                   `json:"code"`
		Data [][]AllocationResult  `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	if len(result.Data) == 0 || len(result.Data[0]) == 0 {
		return []AllocationResult{}, nil
	}
	
	return result.Data[0], nil
}

// GetSavingsRecommendations retrieves cost savings recommendations
func (c *Client) GetSavingsRecommendations(ctx context.Context) ([]SavingsRecommendation, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.URL+"/savings/requestSizing", nil)
	if err != nil {
		return nil, err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("savings query failed: %s", resp.Status)
	}
	
	var recommendations []SavingsRecommendation
	if err := json.NewDecoder(resp.Body).Decode(&recommendations); err != nil {
		return nil, err
	}
	
	c.mu.Lock()
	c.recommendations = recommendations
	c.mu.Unlock()
	
	return recommendations, nil
}

// GetClusterEfficiency retrieves cluster efficiency metrics
func (c *Client) GetClusterEfficiency(ctx context.Context) (*ClusterEfficiency, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.URL+"/model/clusterCostsOverTime?window=1d&offset=0m", nil)
	if err != nil {
		return nil, err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("efficiency query failed: %s", resp.Status)
	}
	
	var result struct {
		Data []struct {
			CPUEfficiency   float64 `json:"cpuEfficiency"`
			RAMEfficiency   float64 `json:"ramEfficiency"`
			TotalEfficiency float64 `json:"totalEfficiency"`
		} `json:"data"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	if len(result.Data) == 0 {
		return &ClusterEfficiency{}, nil
	}
	
	return &ClusterEfficiency{
		CPUEfficiency:   result.Data[0].CPUEfficiency,
		RAMEfficiency:   result.Data[0].RAMEfficiency,
		TotalEfficiency: result.Data[0].TotalEfficiency,
	}, nil
}

// GetNamespaceCost retrieves cost for a specific namespace
func (c *Client) GetNamespaceCost(ctx context.Context, namespace string, window string) (float64, error) {
	allocations, err := c.GetAllocation(ctx, window, "namespace")
	if err != nil {
		return 0, err
	}
	
	for _, alloc := range allocations {
		if alloc.Properties.Namespace == namespace {
			return alloc.TotalCost, nil
		}
	}
	
	return 0, nil
}

// GetCostByNamespace retrieves cost breakdown by namespace
func (c *Client) GetCostByNamespace(ctx context.Context, window string) ([]NamespaceCost, error) {
	allocations, err := c.GetAllocation(ctx, window, "namespace")
	if err != nil {
		return nil, err
	}
	
	var costs []NamespaceCost
	for _, alloc := range allocations {
		costs = append(costs, NamespaceCost{
			Namespace:   alloc.Properties.Namespace,
			CPUCost:     alloc.CPUCost,
			RAMCost:     alloc.RAMCost,
			PVCost:      alloc.PVCost,
			NetworkCost: alloc.NetworkCost,
			TotalCost:   alloc.TotalCost,
			Efficiency:  alloc.TotalEfficiency,
		})
	}
	
	return costs, nil
}

// GetCostByService retrieves cost breakdown by service
func (c *Client) GetCostByService(ctx context.Context, window string) ([]ServiceCost, error) {
	allocations, err := c.GetAllocation(ctx, window, "controller")
	if err != nil {
		return nil, err
	}
	
	var costs []ServiceCost
	for _, alloc := range allocations {
		costs = append(costs, ServiceCost{
			Service:    alloc.Properties.Controller,
			Namespace:  alloc.Properties.Namespace,
			CPUCost:    alloc.CPUCost,
			RAMCost:    alloc.RAMCost,
			TotalCost:  alloc.TotalCost,
			Efficiency: alloc.TotalEfficiency,
		})
	}
	
	return costs, nil
}

// GetCostTrends retrieves cost trends over time
func (c *Client) GetCostTrends(ctx context.Context, days int) ([]CostTrend, error) {
	var trends []CostTrend
	
	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		window := fmt.Sprintf("%s,%s", 
			date.Format("2006-01-02T00:00:00Z"),
			date.Add(24*time.Hour).Format("2006-01-02T00:00:00Z"))
		
		allocations, err := c.GetAllocation(ctx, window, "cluster")
		if err != nil {
			continue
		}
		
		var totalCost, cpuCost, ramCost, pvCost, networkCost float64
		for _, alloc := range allocations {
			totalCost += alloc.TotalCost
			cpuCost += alloc.CPUCost
			ramCost += alloc.RAMCost
			pvCost += alloc.PVCost
			networkCost += alloc.NetworkCost
		}
		
		trends = append(trends, CostTrend{
			Date:        date,
			TotalCost:   totalCost,
			CPUCost:     cpuCost,
			RAMCost:     ramCost,
			PVCost:      pvCost,
			NetworkCost: networkCost,
		})
	}
	
	return trends, nil
}

// GenerateCostReport generates a comprehensive cost report
func (c *Client) GenerateCostReport(ctx context.Context, window string) (*CostReport, error) {
	// Get allocations by namespace
	byNamespace, err := c.GetCostByNamespace(ctx, window)
	if err != nil {
		byNamespace = []NamespaceCost{}
	}
	
	// Get allocations by service
	byService, err := c.GetCostByService(ctx, window)
	if err != nil {
		byService = []ServiceCost{}
	}
	
	// Get cluster efficiency
	efficiency, err := c.GetClusterEfficiency(ctx)
	if err != nil {
		efficiency = &ClusterEfficiency{}
	}
	
	// Get savings recommendations
	recommendations, err := c.GetSavingsRecommendations(ctx)
	if err != nil {
		recommendations = []SavingsRecommendation{}
	}
	
	// Get cost trends
	trends, err := c.GetCostTrends(ctx, 7)
	if err != nil {
		trends = []CostTrend{}
	}
	
	// Calculate total cost
	var totalCost float64
	for _, ns := range byNamespace {
		totalCost += ns.TotalCost
	}
	
	// Calculate budget status
	var budgetStatus []BudgetStatus
	for _, alert := range c.config.BudgetAlerts {
		spent := float64(0)
		for _, ns := range byNamespace {
			if ns.Namespace == alert.Namespace {
				spent = ns.TotalCost
				break
			}
		}
		
		budgetStatus = append(budgetStatus, BudgetStatus{
			Name:         alert.Name,
			Namespace:    alert.Namespace,
			Budget:       alert.Budget,
			Spent:        spent,
			Remaining:    alert.Budget - spent,
			Percentage:   spent / alert.Budget * 100,
			IsOverBudget: spent > alert.Budget,
		})
	}
	
	return &CostReport{
		GeneratedAt:       time.Now(),
		Period:            window,
		TotalCost:         totalCost,
		ClusterEfficiency: *efficiency,
		ByNamespace:       byNamespace,
		ByService:         byService,
		Trends:            trends,
		Recommendations:   recommendations,
		BudgetStatus:      budgetStatus,
	}, nil
}

// pushToCostOptimizer pushes cost data to the cost optimizer service
func (c *Client) pushToCostOptimizer(ctx context.Context, report *CostReport) {
	body, err := json.Marshal(report)
	if err != nil {
		return
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.CostOptimizerURL+"/api/v1/cost-data", 
		json.RawMessage(body).Reader())
	if err != nil {
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// pushToAdminDashboard pushes cost data to the admin dashboard
func (c *Client) pushToAdminDashboard(ctx context.Context, report *CostReport) {
	// Prepare dashboard-friendly data
	dashboardData := map[string]interface{}{
		"timestamp":          report.GeneratedAt,
		"total_cost":         report.TotalCost,
		"cluster_efficiency": report.ClusterEfficiency.TotalEfficiency,
		"cpu_efficiency":     report.ClusterEfficiency.CPUEfficiency,
		"ram_efficiency":     report.ClusterEfficiency.RAMEfficiency,
		"top_namespaces":     report.ByNamespace[:min(5, len(report.ByNamespace))],
		"recommendations_count": len(report.Recommendations),
		"potential_savings":  c.calculatePotentialSavings(report.Recommendations),
	}
	
	body, err := json.Marshal(dashboardData)
	if err != nil {
		return
	}
	
	req, err := http.NewRequestWithContext(ctx, "POST",
		c.config.AdminDashboardURL+"/api/v1/cost-metrics",
		json.RawMessage(body).Reader())
	if err != nil {
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// calculatePotentialSavings calculates total potential savings
func (c *Client) calculatePotentialSavings(recommendations []SavingsRecommendation) float64 {
	var total float64
	for _, rec := range recommendations {
		total += rec.MonthlySavings
	}
	return total
}

// GetLastReport returns the last cached cost report
func (c *Client) GetLastReport() *CostReport {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastReport
}

// GetRecommendations returns cached recommendations
func (c *Client) GetRecommendations() []SavingsRecommendation {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.recommendations
}

// GetStats returns client statistics
func (c *Client) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return map[string]interface{}{
		"queries_executed":  c.queriesExecuted,
		"alerts_sent":       c.alertsSent,
		"last_report_time":  c.lastReportTime,
		"recommendations":   len(c.recommendations),
	}
}

// HealthCheck performs a health check
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET",
		c.config.URL+"/healthz", nil)
	if err != nil {
		return err
	}
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed: %s", resp.Status)
	}
	
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

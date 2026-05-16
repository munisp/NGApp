package service

type ReportHealthRequest struct {
	ServiceName    string  `json:"service_name"`
	ServiceType    string  `json:"service_type"`
	Status         string  `json:"status"`
	Uptime         float64 `json:"uptime"`
	ResponseTimeMs float64 `json:"response_time_ms"`
	ErrorRate      float64 `json:"error_rate"`
	CPU            float64 `json:"cpu_percent"`
	Memory         float64 `json:"memory_percent"`
	DiskUsage      float64 `json:"disk_usage_percent"`
	ActiveConns    int     `json:"active_connections"`
	Version        string  `json:"version"`
	Endpoint       string  `json:"endpoint"`
}

type RecordMetricRequest struct {
	ServiceName string                 `json:"service_name"`
	MetricName  string                 `json:"metric_name"`
	MetricValue float64                `json:"metric_value"`
	Unit        string                 `json:"unit"`
	Tags        map[string]interface{} `json:"tags"`
	Period      string                 `json:"period"`
}

type CreateAlertConfigRequest struct {
	Name          string  `json:"name"`
	ServiceName   string  `json:"service_name"`
	MetricName    string  `json:"metric_name"`
	Operator      string  `json:"operator"`
	Threshold     float64 `json:"threshold"`
	Duration      int     `json:"duration_minutes"`
	Severity      string  `json:"severity"`
	NotifyChannel string  `json:"notify_channel"`
}

type SetSLARequest struct {
	ServiceName   string  `json:"service_name"`
	TargetUptime  float64 `json:"target_uptime"`
	MaxResponseMs float64 `json:"max_response_ms"`
	MaxErrorRate  float64 `json:"max_error_rate"`
	MeasurePeriod string  `json:"measure_period"`
}

// Package infrastructure provides KEDA autoscaling configuration
package infrastructure

import (
	"fmt"
)

// KEDAScalerConfig represents a KEDA scaler configuration
type KEDAScalerConfig struct {
	Name              string
	Type              string
	Metadata          map[string]string
	AuthenticationRef string
}

// KEDAScaledObjectConfig represents a KEDA ScaledObject configuration
type KEDAScaledObjectConfig struct {
	Name             string
	Namespace        string
	ScaleTargetRef   ScaleTargetRef
	MinReplicaCount  int32
	MaxReplicaCount  int32
	PollingInterval  int32
	CooldownPeriod   int32
	IdleReplicaCount *int32
	Triggers         []KEDATrigger
	Advanced         *KEDAAdvancedConfig
}

// ScaleTargetRef references the target deployment
type ScaleTargetRef struct {
	APIVersion string
	Kind       string
	Name       string
}

// KEDATrigger represents a KEDA trigger
type KEDATrigger struct {
	Type              string
	Metadata          map[string]string
	AuthenticationRef *KEDAAuthRef
}

// KEDAAuthRef references authentication
type KEDAAuthRef struct {
	Name string
	Kind string
}

// KEDAAdvancedConfig represents advanced KEDA configuration
type KEDAAdvancedConfig struct {
	RestoreToOriginalReplicaCount bool
	HorizontalPodAutoscalerConfig *HPAConfig
}

// HPAConfig represents HPA configuration
type HPAConfig struct {
	Name     string
	Behavior *HPABehavior
}

// HPABehavior represents HPA scaling behavior
type HPABehavior struct {
	ScaleDown *HPAScalingRules
	ScaleUp   *HPAScalingRules
}

// HPAScalingRules represents scaling rules
type HPAScalingRules struct {
	StabilizationWindowSeconds int32
	SelectPolicy               string
	Policies                   []HPAScalingPolicy
}

// HPAScalingPolicy represents a scaling policy
type HPAScalingPolicy struct {
	Type          string
	Value         int32
	PeriodSeconds int32
}

// OptimalKEDAConfigs returns optimized KEDA configurations for all services
func OptimalKEDAConfigs() []KEDAScaledObjectConfig {
	return []KEDAScaledObjectConfig{
		// Payment Gateway - scale on Kafka lag and CPU
		{
			Name:            "payment-gateway-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "payment-gateway"},
			MinReplicaCount: 3,
			MaxReplicaCount: 50,
			PollingInterval: 15,
			CooldownPeriod:  60,
			Triggers: []KEDATrigger{
				{
					Type: "kafka",
					Metadata: map[string]string{
						"bootstrapServers":       "kafka-0:9092,kafka-1:9092,kafka-2:9092",
						"consumerGroup":          "payment-gateway-group",
						"topic":                  "payment.transfers",
						"lagThreshold":           "100",
						"activationLagThreshold": "10",
					},
					AuthenticationRef: &KEDAAuthRef{Name: "kafka-auth", Kind: "TriggerAuthentication"},
				},
				{
					Type: "cpu",
					Metadata: map[string]string{
						"type":  "Utilization",
						"value": "70",
					},
				},
				{
					Type: "memory",
					Metadata: map[string]string{
						"type":  "Utilization",
						"value": "80",
					},
				},
			},
			Advanced: &KEDAAdvancedConfig{
				RestoreToOriginalReplicaCount: true,
				HorizontalPodAutoscalerConfig: &HPAConfig{
					Behavior: &HPABehavior{
						ScaleUp: &HPAScalingRules{
							StabilizationWindowSeconds: 0,
							SelectPolicy:               "Max",
							Policies: []HPAScalingPolicy{
								{Type: "Percent", Value: 100, PeriodSeconds: 15},
								{Type: "Pods", Value: 10, PeriodSeconds: 15},
							},
						},
						ScaleDown: &HPAScalingRules{
							StabilizationWindowSeconds: 300,
							SelectPolicy:               "Min",
							Policies: []HPAScalingPolicy{
								{Type: "Percent", Value: 10, PeriodSeconds: 60},
							},
						},
					},
				},
			},
		},
		// Fraud Detection - scale on Kafka lag and CPU
		{
			Name:            "fraud-detection-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "fraud-detection"},
			MinReplicaCount: 2,
			MaxReplicaCount: 30,
			PollingInterval: 10,
			CooldownPeriod:  60,
			Triggers: []KEDATrigger{
				{
					Type: "kafka",
					Metadata: map[string]string{
						"bootstrapServers":       "kafka-0:9092,kafka-1:9092,kafka-2:9092",
						"consumerGroup":          "fraud-detection-group",
						"topic":                  "transaction-events",
						"lagThreshold":           "50",
						"activationLagThreshold": "5",
					},
					AuthenticationRef: &KEDAAuthRef{Name: "kafka-auth", Kind: "TriggerAuthentication"},
				},
				{
					Type: "cpu",
					Metadata: map[string]string{
						"type":  "Utilization",
						"value": "60",
					},
				},
			},
			Advanced: &KEDAAdvancedConfig{
				RestoreToOriginalReplicaCount: true,
				HorizontalPodAutoscalerConfig: &HPAConfig{
					Behavior: &HPABehavior{
						ScaleUp: &HPAScalingRules{
							StabilizationWindowSeconds: 0,
							SelectPolicy:               "Max",
							Policies: []HPAScalingPolicy{
								{Type: "Percent", Value: 200, PeriodSeconds: 10},
							},
						},
						ScaleDown: &HPAScalingRules{
							StabilizationWindowSeconds: 300,
							SelectPolicy:               "Min",
							Policies: []HPAScalingPolicy{
								{Type: "Percent", Value: 10, PeriodSeconds: 60},
							},
						},
					},
				},
			},
		},
		// Go Ledger - scale on Prometheus metrics
		{
			Name:            "go-ledger-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "go-ledger"},
			MinReplicaCount: 3,
			MaxReplicaCount: 50,
			PollingInterval: 15,
			CooldownPeriod:  60,
			Triggers: []KEDATrigger{
				{
					Type: "prometheus",
					Metadata: map[string]string{
						"serverAddress": "http://prometheus.monitoring:9090",
						"metricName":    "http_requests_per_second",
						"query":         "sum(rate(http_requests_total{service=\"go-ledger\"}[1m]))",
						"threshold":     "1000",
					},
				},
				{
					Type: "cpu",
					Metadata: map[string]string{
						"type":  "Utilization",
						"value": "70",
					},
				},
			},
		},
		// Temporal Workers - scale on Temporal task queue depth
		{
			Name:            "temporal-worker-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "temporal-worker"},
			MinReplicaCount: 2,
			MaxReplicaCount: 20,
			PollingInterval: 15,
			CooldownPeriod:  120,
			Triggers: []KEDATrigger{
				{
					Type: "prometheus",
					Metadata: map[string]string{
						"serverAddress": "http://prometheus.monitoring:9090",
						"metricName":    "temporal_workflow_task_queue_depth",
						"query":         "sum(temporal_workflow_task_schedule_to_start_latency_count{namespace=\"payment-switch\"})",
						"threshold":     "100",
					},
				},
			},
		},
		// Mojaloop Service - scale on request rate
		{
			Name:            "mojaloop-service-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "mojaloop-service"},
			MinReplicaCount: 3,
			MaxReplicaCount: 30,
			PollingInterval: 15,
			CooldownPeriod:  60,
			Triggers: []KEDATrigger{
				{
					Type: "prometheus",
					Metadata: map[string]string{
						"serverAddress": "http://prometheus.monitoring:9090",
						"metricName":    "mojaloop_transfers_per_second",
						"query":         "sum(rate(mojaloop_transfer_requests_total[1m]))",
						"threshold":     "500",
					},
				},
				{
					Type: "cpu",
					Metadata: map[string]string{
						"type":  "Utilization",
						"value": "70",
					},
				},
			},
		},
		// Data Pipeline - scale on Kafka lag
		{
			Name:            "data-pipeline-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "data-pipeline"},
			MinReplicaCount: 2,
			MaxReplicaCount: 20,
			PollingInterval: 30,
			CooldownPeriod:  120,
			Triggers: []KEDATrigger{
				{
					Type: "kafka",
					Metadata: map[string]string{
						"bootstrapServers":       "kafka-0:9092,kafka-1:9092,kafka-2:9092",
						"consumerGroup":          "data-pipeline-group",
						"topic":                  "audit.events",
						"lagThreshold":           "1000",
						"activationLagThreshold": "100",
					},
					AuthenticationRef: &KEDAAuthRef{Name: "kafka-auth", Kind: "TriggerAuthentication"},
				},
			},
		},
		// KYC Service - scale on queue depth
		{
			Name:            "kyc-service-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "kyc-service"},
			MinReplicaCount: 2,
			MaxReplicaCount: 10,
			PollingInterval: 30,
			CooldownPeriod:  120,
			Triggers: []KEDATrigger{
				{
					Type: "redis",
					Metadata: map[string]string{
						"address":              "redis-master:6379",
						"listName":             "kyc:pending",
						"listLength":           "10",
						"activationListLength": "1",
					},
					AuthenticationRef: &KEDAAuthRef{Name: "redis-auth", Kind: "TriggerAuthentication"},
				},
			},
		},
		// Onboarding Service - scale on Temporal workflows
		{
			Name:            "onboarding-service-scaler",
			Namespace:       "payment-switch",
			ScaleTargetRef:  ScaleTargetRef{APIVersion: "apps/v1", Kind: "Deployment", Name: "onboarding-service"},
			MinReplicaCount: 2,
			MaxReplicaCount: 10,
			PollingInterval: 30,
			CooldownPeriod:  120,
			Triggers: []KEDATrigger{
				{
					Type: "prometheus",
					Metadata: map[string]string{
						"serverAddress": "http://prometheus.monitoring:9090",
						"metricName":    "onboarding_pending_applications",
						"query":         "sum(onboarding_applications_pending)",
						"threshold":     "20",
					},
				},
			},
		},
	}
}

// GenerateKEDAScaledObjectYAML generates KEDA ScaledObject YAML
func GenerateKEDAScaledObjectYAML(config KEDAScaledObjectConfig) string {
	yaml := fmt.Sprintf(`apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: %s
  namespace: %s
spec:
  scaleTargetRef:
    apiVersion: %s
    kind: %s
    name: %s
  minReplicaCount: %d
  maxReplicaCount: %d
  pollingInterval: %d
  cooldownPeriod: %d
  triggers:
`,
		config.Name, config.Namespace,
		config.ScaleTargetRef.APIVersion, config.ScaleTargetRef.Kind, config.ScaleTargetRef.Name,
		config.MinReplicaCount, config.MaxReplicaCount,
		config.PollingInterval, config.CooldownPeriod,
	)

	for _, trigger := range config.Triggers {
		yaml += fmt.Sprintf(`  - type: %s
    metadata:
`, trigger.Type)
		for k, v := range trigger.Metadata {
			yaml += fmt.Sprintf(`      %s: "%s"
`, k, v)
		}
		if trigger.AuthenticationRef != nil {
			yaml += fmt.Sprintf(`    authenticationRef:
      name: %s
      kind: %s
`, trigger.AuthenticationRef.Name, trigger.AuthenticationRef.Kind)
		}
	}

	if config.Advanced != nil && config.Advanced.HorizontalPodAutoscalerConfig != nil {
		yaml += `  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
`
		if config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleUp != nil {
			yaml += fmt.Sprintf(`        scaleUp:
          stabilizationWindowSeconds: %d
          selectPolicy: %s
          policies:
`,
				config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleUp.StabilizationWindowSeconds,
				config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleUp.SelectPolicy,
			)
			for _, policy := range config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleUp.Policies {
				yaml += fmt.Sprintf(`          - type: %s
            value: %d
            periodSeconds: %d
`, policy.Type, policy.Value, policy.PeriodSeconds)
			}
		}
		if config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleDown != nil {
			yaml += fmt.Sprintf(`        scaleDown:
          stabilizationWindowSeconds: %d
          selectPolicy: %s
          policies:
`,
				config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleDown.StabilizationWindowSeconds,
				config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleDown.SelectPolicy,
			)
			for _, policy := range config.Advanced.HorizontalPodAutoscalerConfig.Behavior.ScaleDown.Policies {
				yaml += fmt.Sprintf(`          - type: %s
            value: %d
            periodSeconds: %d
`, policy.Type, policy.Value, policy.PeriodSeconds)
			}
		}
	}

	return yaml
}

// GenerateKEDATriggerAuthenticationYAML generates TriggerAuthentication YAML
func GenerateKEDATriggerAuthenticationYAML(name, namespace string, secretTargetRefs map[string]string) string {
	yaml := fmt.Sprintf(`apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: %s
  namespace: %s
spec:
  secretTargetRef:
`, name, namespace)

	for param, secretInfo := range secretTargetRefs {
		yaml += fmt.Sprintf(`  - parameter: %s
    name: %s
    key: %s
`, param, secretInfo, param)
	}

	return yaml
}

// GenerateAllKEDAResources generates all KEDA resources for the platform
func GenerateAllKEDAResources() string {
	var allYAML string

	// Generate TriggerAuthentications
	allYAML += GenerateKEDATriggerAuthenticationYAML("kafka-auth", "payment-switch", map[string]string{
		"sasl": "kafka-credentials",
	})
	allYAML += "---\n"

	allYAML += GenerateKEDATriggerAuthenticationYAML("redis-auth", "payment-switch", map[string]string{
		"password": "redis-secret",
	})
	allYAML += "---\n"

	// Generate ScaledObjects
	for _, config := range OptimalKEDAConfigs() {
		allYAML += GenerateKEDAScaledObjectYAML(config)
		allYAML += "---\n"
	}

	return allYAML
}

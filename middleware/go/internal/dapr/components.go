// Package dapr provides Dapr component configuration helpers.
// Component YAML files should be placed in the dapr/components directory
// and loaded by the Dapr sidecar at startup.
package dapr

// ComponentType defines the Dapr component types used by OG-RMM.
type ComponentType string

const (
	// ComponentPubSubKafka is the Kafka pub/sub component name.
	ComponentPubSubKafka ComponentType = "kafka-pubsub"
	// ComponentStateRedis is the Redis state store component name.
	ComponentStateRedis ComponentType = "redis-state"
	// ComponentSecretKubernetes is the Kubernetes secret store component name.
	ComponentSecretKubernetes ComponentType = "kubernetes"
	// ComponentBindingPostgres is the PostgreSQL output binding component name.
	ComponentBindingPostgres ComponentType = "postgres-binding"
)

// TopicName defines the Dapr pub/sub topics used by OG-RMM.
type TopicName string

const (
	// TopicTelemetry is the topic for real-time telemetry data from wells and sensors.
	TopicTelemetry TopicName = "og-rmm.telemetry"
	// TopicAlarms is the topic for alarm events.
	TopicAlarms TopicName = "og-rmm.alarms"
	// TopicWorkflowEvents is the topic for workflow state change events.
	TopicWorkflowEvents TopicName = "og-rmm.workflow-events"
	// TopicProductionData is the topic for production allocation results.
	TopicProductionData TopicName = "og-rmm.production-data"
	// TopicDroneInspection is the topic for drone inspection findings.
	TopicDroneInspection TopicName = "og-rmm.drone-inspection"
	// TopicEmissions is the topic for emissions measurement events.
	TopicEmissions TopicName = "og-rmm.emissions"
)

// ServiceID defines the Dapr app IDs for each microservice.
type ServiceID string

const (
	ServiceAlarmManager      ServiceID = "alarm-manager"
	ServiceAPIGateway        ServiceID = "api-gateway"
	ServiceEdgeXDevice       ServiceID = "edgex-device-service"
	ServiceERPConnector      ServiceID = "erp-connector"
	ServiceFinancialLedger   ServiceID = "financial-ledger"
	ServiceTelemetryIngest   ServiceID = "telemetry-ingestion"
	ServiceWellManagement    ServiceID = "well-management"
	ServiceWorkflowEngine    ServiceID = "workflow-engine"
	ServiceMLService         ServiceID = "ml-service"
	ServicePhysicsEngine     ServiceID = "physics-engine"
	ServiceMiddleware        ServiceID = "og-rmm-middleware"
)

// ComponentYAML returns the YAML content for a Dapr component configuration.
// These should be written to the dapr/components directory.
func KafkaPubSubYAML(brokers string) string {
	return `apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: kafka-pubsub
  namespace: og-rmm
spec:
  type: pubsub.kafka
  version: v1
  metadata:
  - name: brokers
    value: "` + brokers + `"
  - name: consumerGroup
    value: "og-rmm-dapr"
  - name: authRequired
    value: "false"
  - name: initialOffset
    value: "newest"
  - name: maxMessageBytes
    value: "1048576"
`
}

// RedisStateYAML returns the YAML for a Redis state store component.
func RedisStateYAML(redisHost string) string {
	return `apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: redis-state
  namespace: og-rmm
spec:
  type: state.redis
  version: v1
  metadata:
  - name: redisHost
    value: "` + redisHost + `"
  - name: redisPassword
    value: ""
  - name: enableTLS
    value: "false"
  - name: maxRetries
    value: "3"
  - name: ttlInSeconds
    value: "3600"
`
}

// ResiliencyYAML returns the Dapr resiliency policy for OG-RMM services.
func ResiliencyYAML() string {
	return `apiVersion: dapr.io/v1alpha1
kind: Resiliency
metadata:
  name: og-rmm-resiliency
  namespace: og-rmm
spec:
  policies:
    timeouts:
      defaultTimeout: 30s
      criticalTimeout: 10s
    retries:
      defaultRetry:
        policy: constant
        duration: 1s
        maxRetries: 3
      criticalRetry:
        policy: exponential
        maxInterval: 15s
        maxRetries: 5
    circuitBreakers:
      defaultCircuitBreaker:
        maxRequests: 1
        interval: 8s
        timeout: 45s
        trip: consecutiveFailures >= 5
  targets:
    apps:
      alarm-manager:
        timeout: criticalTimeout
        retry: criticalRetry
        circuitBreaker: defaultCircuitBreaker
      telemetry-ingestion:
        timeout: criticalTimeout
        retry: criticalRetry
        circuitBreaker: defaultCircuitBreaker
    components:
      kafka-pubsub:
        outbound:
          timeout: defaultTimeout
          retry: defaultRetry
      redis-state:
        outbound:
          timeout: defaultTimeout
          retry: defaultRetry
`
}

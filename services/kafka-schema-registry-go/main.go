package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8312" }

	schemas := []map[string]interface{}{
		{"id": "SCH-001", "subject": "transactions.completed-value", "version": 3, "type": "AVRO",
			"compatibility": "BACKWARD_TRANSITIVE", "fields": 24, "registered_at": "2026-05-01"},
		{"id": "SCH-002", "subject": "aml.alerts-value", "version": 2, "type": "AVRO",
			"compatibility": "FULL", "fields": 18, "registered_at": "2026-05-02"},
		{"id": "SCH-003", "subject": "kyc.verifications-value", "version": 4, "type": "AVRO",
			"compatibility": "BACKWARD", "fields": 32, "registered_at": "2026-04-28"},
		{"id": "SCH-004", "subject": "mojaloop.transfers-value", "version": 1, "type": "PROTOBUF",
			"compatibility": "FULL_TRANSITIVE", "fields": 15, "registered_at": "2026-05-05"},
	}

	governance := map[string]interface{}{
		"total_topics": 247, "total_schemas": 89, "total_consumers": 186,
		"dead_letter_topics": 12, "compacted_topics": 34,
		"retention_policies": map[string]interface{}{
			"transactions": "90d", "audit": "7y", "metrics": "30d", "alerts": "1y"},
		"topic_naming_convention": "<domain>.<entity>.<event>",
		"partition_strategy": "customer_id hash for transactions, round-robin for metrics",
		"replication_factor": 3, "min_isr": 2,
	}

	mw := map[string]interface{}{
		"kafka": map[string]interface{}{"topics": []string{"schema.registry.changes", "governance.violations"}},
		"dapr": map[string]interface{}{"stateStore": "schema-registry-state"},
		"fluvio": map[string]interface{}{"topics": []string{"schema-stream"}},
		"temporal": map[string]interface{}{"workflows": []string{"schema-migration", "topic-cleanup"}},
		"postgres": map[string]interface{}{"tables": []string{"kafka_schemas", "kafka_topics", "kafka_consumers"}},
		"keycloak": map[string]interface{}{"roles": []string{"kafka-admin", "kafka-producer", "kafka-consumer"}},
		"permify": map[string]interface{}{"relations": []string{"kafka:can_produce", "kafka:can_consume"}},
		"redis": map[string]interface{}{"keys": []string{"kafka:schema:cache", "kafka:consumer:offsets"}},
		"mojaloop": map[string]interface{}{"oracle": "kafka-mojaloop-bridge"},
		"opensearch": map[string]interface{}{"indices": []string{"kafka-governance-events"}},
		"openappsec": map[string]interface{}{"policy": "kafka-api-protection"},
		"apisix": map[string]interface{}{"route": "/api/kafka-governance/*"},
		"tigerbeetle": map[string]interface{}{"accounts": []string{}},
		"lakehouse": map[string]interface{}{"tables": []string{"kafka_topic_metrics"}},
	}

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "kafka-schema-registry-go", "port": port})
	})
	http.HandleFunc("/api/kafka-governance/schemas", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(schemas)
	})
	http.HandleFunc("/api/kafka-governance/overview", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(governance)
	})
	http.HandleFunc("/api/kafka-governance/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(mw)
	})
	fmt.Printf("Kafka Schema Registry on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}

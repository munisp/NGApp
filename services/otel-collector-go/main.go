package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8326" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"otel-collector-go","port":port}) })
	http.HandleFunc("/api/otel-collector/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"OTel Collector","port":port,"status":"active"})
	})
	http.HandleFunc("/api/otel-collector/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"otel-collector.events"}},"dapr":map[string]interface{}{"stateStore":"otel-collector-state"},"fluvio":map[string]interface{}{"topics":[]string{"otel-collector-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"otel-collector-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"otel-collector_config"}},"keycloak":map[string]interface{}{"roles":[]string{"otel-collector-admin"}},"permify":map[string]interface{}{"relations":[]string{"otel-collector:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"otel-collector:cache"}},"mojaloop":map[string]interface{}{"oracle":"otel-collector-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"otel-collector-events"}},"openappsec":map[string]interface{}{"policy":"otel-collector-protection"},"apisix":map[string]interface{}{"route":"/api/otel-collector/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"otel-collector_analytics"}}})
	})
	fmt.Printf("OTel Collector on :%s\n", port); http.ListenAndServe(":"+port, nil)
}

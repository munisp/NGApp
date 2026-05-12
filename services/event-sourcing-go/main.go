package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8345" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"event-sourcing-go","port":port}) })
	http.HandleFunc("/api/event-sourcing/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Event Sourcing","port":port,"status":"active"})
	})
	http.HandleFunc("/api/event-sourcing/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"event-sourcing.events"}},"dapr":map[string]interface{}{"stateStore":"event-sourcing-state"},"fluvio":map[string]interface{}{"topics":[]string{"event-sourcing-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"event-sourcing-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"event-sourcing_config"}},"keycloak":map[string]interface{}{"roles":[]string{"event-sourcing-admin"}},"permify":map[string]interface{}{"relations":[]string{"event-sourcing:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"event-sourcing:cache"}},"mojaloop":map[string]interface{}{"oracle":"event-sourcing-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"event-sourcing-events"}},"openappsec":map[string]interface{}{"policy":"event-sourcing-protection"},"apisix":map[string]interface{}{"route":"/api/event-sourcing/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"event-sourcing_analytics"}}})
	})
	fmt.Printf("Event Sourcing on :%s\n", port); http.ListenAndServe(":"+port, nil)
}

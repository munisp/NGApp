package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8337" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"fee-management-go","port":port}) })
	http.HandleFunc("/api/fee-management/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Fee Management","port":port,"status":"active"})
	})
	http.HandleFunc("/api/fee-management/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"fee-management.events"}},"dapr":map[string]interface{}{"stateStore":"fee-management-state"},"fluvio":map[string]interface{}{"topics":[]string{"fee-management-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"fee-management-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"fee-management_config"}},"keycloak":map[string]interface{}{"roles":[]string{"fee-management-admin"}},"permify":map[string]interface{}{"relations":[]string{"fee-management:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"fee-management:cache"}},"mojaloop":map[string]interface{}{"oracle":"fee-management-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"fee-management-events"}},"openappsec":map[string]interface{}{"policy":"fee-management-protection"},"apisix":map[string]interface{}{"route":"/api/fee-management/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"fee-management_analytics"}}})
	})
	fmt.Printf("Fee Management on :%s\n", port); http.ListenAndServe(":"+port, nil)
}

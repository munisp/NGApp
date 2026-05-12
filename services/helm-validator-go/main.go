package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8328" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"helm-validator-go","port":port}) })
	http.HandleFunc("/api/helm-validator/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Helm Validator","port":port,"status":"active"})
	})
	http.HandleFunc("/api/helm-validator/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"helm-validator.events"}},"dapr":map[string]interface{}{"stateStore":"helm-validator-state"},"fluvio":map[string]interface{}{"topics":[]string{"helm-validator-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"helm-validator-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"helm-validator_config"}},"keycloak":map[string]interface{}{"roles":[]string{"helm-validator-admin"}},"permify":map[string]interface{}{"relations":[]string{"helm-validator:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"helm-validator:cache"}},"mojaloop":map[string]interface{}{"oracle":"helm-validator-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"helm-validator-events"}},"openappsec":map[string]interface{}{"policy":"helm-validator-protection"},"apisix":map[string]interface{}{"route":"/api/helm-validator/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"helm-validator_analytics"}}})
	})
	fmt.Printf("Helm Validator on :%s\n", port); http.ListenAndServe(":"+port, nil)
}

package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8339" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"regulatory-sandbox-go","port":port}) })
	http.HandleFunc("/api/regulatory-sandbox/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Regulatory Sandbox","port":port,"status":"active"})
	})
	http.HandleFunc("/api/regulatory-sandbox/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"regulatory-sandbox.events"}},"dapr":map[string]interface{}{"stateStore":"regulatory-sandbox-state"},"fluvio":map[string]interface{}{"topics":[]string{"regulatory-sandbox-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"regulatory-sandbox-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"regulatory-sandbox_config"}},"keycloak":map[string]interface{}{"roles":[]string{"regulatory-sandbox-admin"}},"permify":map[string]interface{}{"relations":[]string{"regulatory-sandbox:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"regulatory-sandbox:cache"}},"mojaloop":map[string]interface{}{"oracle":"regulatory-sandbox-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"regulatory-sandbox-events"}},"openappsec":map[string]interface{}{"policy":"regulatory-sandbox-protection"},"apisix":map[string]interface{}{"route":"/api/regulatory-sandbox/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"regulatory-sandbox_analytics"}}})
	})
	fmt.Printf("Regulatory Sandbox on :%s\n", port); http.ListenAndServe(":"+port, nil)
}

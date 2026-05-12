package main
import ("encoding/json";"fmt";"net/http";"os")
func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8341" }
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(map[string]interface{}{"status":"healthy","service":"developer-portal-go","port":port}) })
	http.HandleFunc("/api/developer-portal/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"service":"Developer Portal","port":port,"status":"active"})
	})
	http.HandleFunc("/api/developer-portal/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type","application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"kafka":map[string]interface{}{"topics":[]string{"developer-portal.events"}},"dapr":map[string]interface{}{"stateStore":"developer-portal-state"},"fluvio":map[string]interface{}{"topics":[]string{"developer-portal-stream"}},"temporal":map[string]interface{}{"workflows":[]string{"developer-portal-workflow"}},"postgres":map[string]interface{}{"tables":[]string{"developer-portal_config"}},"keycloak":map[string]interface{}{"roles":[]string{"developer-portal-admin"}},"permify":map[string]interface{}{"relations":[]string{"developer-portal:can_manage"}},"redis":map[string]interface{}{"keys":[]string{"developer-portal:cache"}},"mojaloop":map[string]interface{}{"oracle":"developer-portal-oracle"},"opensearch":map[string]interface{}{"indices":[]string{"developer-portal-events"}},"openappsec":map[string]interface{}{"policy":"developer-portal-protection"},"apisix":map[string]interface{}{"route":"/api/developer-portal/*"},"tigerbeetle":map[string]interface{}{"accounts":[]string{}},"lakehouse":map[string]interface{}{"tables":[]string{"developer-portal_analytics"}}})
	})
	fmt.Printf("Developer Portal on :%s\n", port); http.ListenAndServe(":"+port, nil)
}
